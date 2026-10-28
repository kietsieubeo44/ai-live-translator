// Tauri IPC Command Handlers
// Bridges React frontend and Rust backend

pub mod audio {
    use crate::audio::{list_audio_devices as list_devs, resample_for_stt, AudioDevice, CaptureStatus, WasapiCaptureManager};
    use crate::stt::{LocalWhisperEngine, SpeechToTextProvider, VadDetector};
    use crate::translation::{LocalDictionaryTranslationProvider, TranslationProvider};
    use crate::answer::SmartAnswerEngine;
    use std::sync::Mutex;
    use tauri::{AppHandle, Emitter, Manager, State};

    pub struct AudioState {
        pub manager: Mutex<WasapiCaptureManager>,
    }

    impl Default for AudioState {
        fn default() -> Self {
            AudioState {
                manager: Mutex::new(WasapiCaptureManager::new()),
            }
        }
    }

    #[tauri::command]
    pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
        list_devs().map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn start_capture(
        device_id: String,
        state: State<'_, AudioState>,
        app: AppHandle,
    ) -> Result<CaptureStatus, String> {
        let mut mgr = state.manager.lock().map_err(|e| e.to_string())?;
        if mgr.get_status().is_capturing {
            mgr.stop();
            std::thread::sleep(std::time::Duration::from_millis(80));
        }
        let rx = mgr.start(&device_id).map_err(|e| e.to_string())?;
        let status = mgr.get_status();

        // Channel to feed speech audio from capture thread to STT worker thread
        let (speech_tx, speech_rx) = crossbeam_channel::bounded::<Vec<f32>>(32);
        let app_worker = app.clone();

        // Worker thread: Executes Whisper STT on GPU, Dictionary Translation, and Smart Answer Engine
        std::thread::spawn(move || {
            let initial_model = crate::stt::get_active_model_name();
            let mut whisper = LocalWhisperEngine::new(&initial_model);
            let translator = LocalDictionaryTranslationProvider::new();
            let answer_engine = SmartAnswerEngine::new();
            let mut conversation_context = String::new();
            let mut sub_counter: u64 = 0;
            let mut ans_counter: u64 = 0;

            while let Ok(audio_chunk) = speech_rx.recv() {
                if audio_chunk.is_empty() {
                    continue;
                }
                // Check if user changed the model dynamically
                let current_model = crate::stt::get_active_model_name();
                whisper.reload_model(&current_model);

                if let Ok(segments) = whisper.transcribe(&audio_chunk) {
                    for seg in segments {
                        sub_counter += 1;
                        let vi_text = translator.translate(&seg.text, "auto", "vi").unwrap_or_else(|_| seg.text.clone());

                        let sub_payload = serde_json::json!({
                            "id": sub_counter,
                            "original_en": seg.text,
                            "translated_vi": vi_text,
                            "detected_lang": seg.language,
                            "is_final": true,
                            "latency_ms": seg.timestamp_ms
                        });
                        let _ = app_worker.emit("bilingual-subtitle", &sub_payload);

                        conversation_context.push_str(" ");
                        conversation_context.push_str(&seg.text);
                        if conversation_context.len() > 1000 {
                            conversation_context = conversation_context[conversation_context.len() - 800..].to_string();
                        }

                        // Check for questions and generate smart answers
                        if let Some(question) = answer_engine.detector().detect_question(&seg.text, &conversation_context) {
                            ans_counter += 1;
                            let ans = answer_engine.generate_answer(&question, false);

                            let ans_payload = serde_json::json!({
                                "id": ans_counter,
                                "question": {
                                    "id": question.id,
                                    "question_text": question.question_text,
                                    "question_type": format!("{:?}", question.question_type),
                                    "confidence": question.confidence,
                                    "needs_response": question.needs_response,
                                    "context_snippet": question.context_snippet
                                },
                                "primary_answer_en": ans.primary_answer_en,
                                "primary_answer_vi": ans.primary_answer_vi,
                                "variants": ans.variants.into_iter().map(|v| serde_json::json!({
                                    "style": v.style,
                                    "text_en": v.text_en,
                                    "text_vi": v.text_vi
                                })).collect::<Vec<_>>(),
                                "created_at_ms": std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64,
                                "is_manual": false
                            });
                            let _ = app_worker.emit("answer-suggestion", &ans_payload);
                        }
                    }
                }
            }
        });

        // Audio capture and VAD dispatcher thread
        std::thread::spawn(move || {
            let mut vad = VadDetector::new(0.001);
            let mut speech_buffer: Vec<f32> = Vec::with_capacity(64000);
            let mut silence_frames: usize = 0;
            let mut last_emit = std::time::Instant::now();

            while let Ok(msg) = rx.recv() {
                match msg {
                    crate::audio::AudioMessage::PcmChunk { samples, rms, sample_rate, channels } => {
                        // Smoothly throttle audio level events to ~25fps to avoid IPC saturation
                        if last_emit.elapsed().as_millis() >= 40 {
                            let _ = app.emit("audio-level", rms);
                            last_emit = std::time::Instant::now();
                        }

                        if !samples.is_empty() {
                            let mono_16k = resample_for_stt(&samples, sample_rate, channels);
                            let is_speaking = vad.process_frame(&mono_16k) || rms > 0.0012;

                            if is_speaking {
                                speech_buffer.extend_from_slice(&mono_16k);
                                silence_frames = 0;
                            } else if !speech_buffer.is_empty() {
                                silence_frames += 1;
                                if silence_frames <= 20 {
                                    speech_buffer.extend_from_slice(&mono_16k);
                                }
                            }

                            // Trigger STT when sentence pause is reached (>= 15 silence frames ~ 150ms)
                            // with at least 0.5s of audio (8000 samples)
                            // OR when buffer reaches max live duration (2.5s = 40,000 samples)
                            let should_flush = (!speech_buffer.is_empty() && silence_frames >= 15 && speech_buffer.len() >= 8000)
                                || (!speech_buffer.is_empty() && silence_frames >= 25 && speech_buffer.len() >= 6000)
                                || speech_buffer.len() >= 40000;

                            if should_flush {
                                let _ = speech_tx.try_send(speech_buffer.clone());
                                speech_buffer.clear();
                                silence_frames = 0;
                            } else if silence_frames > 35 && !speech_buffer.is_empty() {
                                // Clear stale small noise
                                speech_buffer.clear();
                                silence_frames = 0;
                            }
                        }
                    }
                    crate::audio::AudioMessage::Error(err) => {
                        let _ = app.emit("audio-error", err);
                    }
                    crate::audio::AudioMessage::DeviceDisconnected => {
                        let _ = app.emit("audio-disconnected", ());
                        break;
                    }
                    crate::audio::AudioMessage::Stopped => {
                        let _ = app.emit("audio-stopped", ());
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(status)
    }

    #[tauri::command]
    pub fn stop_capture(state: State<'_, AudioState>) -> Result<CaptureStatus, String> {
        let mut mgr = state.manager.lock().map_err(|e| e.to_string())?;
        mgr.stop();
        Ok(mgr.get_status())
    }

    #[tauri::command]
    pub fn get_capture_status(state: State<'_, AudioState>) -> Result<CaptureStatus, String> {
        let mgr = state.manager.lock().map_err(|e| e.to_string())?;
        Ok(mgr.get_status())
    }
}

pub mod stt {
    use crate::stt::{LocalWhisperEngine, ModelInfo};
    use std::path::PathBuf;

    #[tauri::command]
    pub fn get_available_models() -> Vec<ModelInfo> {
        LocalWhisperEngine::get_available_models()
    }

    #[tauri::command]
    pub fn get_active_model() -> String {
        crate::stt::get_active_model_name()
    }

    #[tauri::command]
    pub fn set_active_model(model_name: String) -> Result<String, String> {
        crate::stt::set_active_model_name(&model_name);
        Ok(crate::stt::get_active_model_name())
    }

    #[tauri::command]
    pub fn load_model(path: String) -> Result<bool, String> {
        let path_buf = PathBuf::from(path);
        Ok(path_buf.exists())
    }
}

pub mod overlay {
    use tauri::{AppHandle, Manager};

    #[tauri::command]
    pub fn show_overlay_window(app: AppHandle) -> Result<(), String> {
        if let Some(win) = app.get_webview_window("overlay") {
            win.show().map_err(|e| e.to_string())?;
            win.set_focus().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Overlay window not found".to_string())
        }
    }

    #[tauri::command]
    pub fn hide_overlay_window(app: AppHandle) -> Result<(), String> {
        if let Some(win) = app.get_webview_window("overlay") {
            win.hide().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Overlay window not found".to_string())
        }
    }

    #[tauri::command]
    pub fn toggle_overlay_window(app: AppHandle) -> Result<bool, String> {
        if let Some(win) = app.get_webview_window("overlay") {
            let is_visible = win.is_visible().map_err(|e| e.to_string())?;
            if is_visible {
                win.hide().map_err(|e| e.to_string())?;
                Ok(false)
            } else {
                win.show().map_err(|e| e.to_string())?;
                win.set_focus().map_err(|e| e.to_string())?;
                Ok(true)
            }
        } else {
            Err("Overlay window not found".to_string())
        }
    }

    #[tauri::command]
    pub fn show_main_window(app: AppHandle) -> Result<(), String> {
        if let Some(win) = app.get_webview_window("main") {
            win.show().map_err(|e| e.to_string())?;
            win.set_focus().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Main window not found".to_string())
        }
    }

    #[tauri::command]
    pub fn resize_overlay_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
        if let Some(win) = app.get_webview_window("overlay") {
            win.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Overlay window not found".to_string())
        }
    }

    #[tauri::command]
    pub fn start_overlay_dragging(app: AppHandle) -> Result<(), String> {
        if let Some(win) = app.get_webview_window("overlay") {
            win.start_dragging().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Overlay window not found".to_string())
        }
    }
}

pub mod translation {
    use crate::translation::{LocalDictionaryTranslationProvider, TranslationItem, TranslationProvider};

    #[tauri::command]
    pub fn set_gemini_api_key(key: String) -> Result<(), String> {
        crate::translation::set_global_gemini_key(&key);
        Ok(())
    }

    #[tauri::command]
    pub fn get_gemini_api_key() -> String {
        crate::translation::get_global_gemini_key()
    }

    #[tauri::command]
    pub fn get_translation_engine() -> String {
        crate::translation::get_translation_engine_mode()
    }

    #[tauri::command]
    pub fn set_translation_engine(engine: String) -> Result<String, String> {
        crate::translation::set_translation_engine_mode(&engine);
        Ok(crate::translation::get_translation_engine_mode())
    }

    #[tauri::command]
    pub fn test_gemini_key(key: String) -> Result<String, String> {
        let provider = LocalDictionaryTranslationProvider::new();
        provider.test_gemini(&key)
    }

    #[tauri::command]
    pub fn translate_text(text: String) -> Result<TranslationItem, String> {
        let provider = LocalDictionaryTranslationProvider::new();
        let translated = provider.translate(&text, "en", "vi").map_err(|e| e.to_string())?;
        Ok(TranslationItem {
            id: 1,
            original_en: text,
            translated_vi: translated,
            is_final: true,
            latency_ms: 12,
        })
    }

    #[tauri::command]
    pub fn summarize_meeting(transcript: String) -> Result<String, String> {
        let key = crate::translation::get_global_gemini_key();
        let provider = LocalDictionaryTranslationProvider::new();
        if !key.is_empty() {
            match provider.summarize_meeting(&transcript, &key) {
                Ok(summary) => Ok(summary),
                Err(err) => {
                    log::warn!("Gemini summarization failed ({}). Using local summary fallback.", err);
                    Ok(crate::translation::generate_local_meeting_summary(&transcript))
                }
            }
        } else {
            Ok(crate::translation::generate_local_meeting_summary(&transcript))
        }
    }
}

pub mod answer {
    use crate::answer::{
        add_knowledge_doc as add_doc, clear_all_knowledge_docs as clear_docs,
        get_all_knowledge_docs, get_combined_active_knowledge, remove_knowledge_doc as rem_doc,
        toggle_knowledge_doc as tog_doc, AnswerSuggestion, DetectedQuestion, KnowledgeDoc,
        QuestionType, SmartAnswerEngine,
    };

    #[tauri::command]
    pub fn detect_and_answer(text: String, context: String) -> Result<Option<AnswerSuggestion>, String> {
        let engine = SmartAnswerEngine::new();
        if let Some(question) = engine.detector().detect_question(&text, &context) {
            let answer = engine.generate_answer(&question, false);
            Ok(Some(answer))
        } else {
            Ok(None)
        }
    }

    #[tauri::command]
    pub fn generate_answer_manual(context: String) -> Result<AnswerSuggestion, String> {
        let engine = SmartAnswerEngine::new();
        let fallback_question = DetectedQuestion {
            id: 0,
            question_text: if context.is_empty() { "Current discussion topic" } else { &context }.to_string(),
            question_type: QuestionType::Direct,
            confidence: 1.0,
            needs_response: true,
            context_snippet: context,
        };
        Ok(engine.generate_answer(&fallback_question, true))
    }

    #[tauri::command]
    pub fn get_knowledge_docs() -> Result<Vec<KnowledgeDoc>, String> {
        Ok(get_all_knowledge_docs())
    }

    #[tauri::command]
    pub fn add_knowledge_doc(title: String, content: String, doc_type: String) -> Result<KnowledgeDoc, String> {
        Ok(add_doc(title, content, doc_type))
    }

    #[tauri::command]
    pub fn remove_knowledge_doc(id: String) -> Result<bool, String> {
        Ok(rem_doc(&id))
    }

    #[tauri::command]
    pub fn toggle_knowledge_doc(id: String, is_active: bool) -> Result<bool, String> {
        Ok(tog_doc(&id, is_active))
    }

    #[tauri::command]
    pub fn clear_all_knowledge_docs() -> Result<(), String> {
        clear_docs();
        Ok(())
    }

    #[tauri::command]
    pub fn get_active_knowledge_context() -> Result<String, String> {
        Ok(get_combined_active_knowledge())
    }
}

pub mod storage {
    use crate::storage::{SessionRecord, StorageManager};
    use std::sync::Mutex;
    use tauri::State;

    pub struct StorageState {
        pub manager: Mutex<StorageManager>,
    }

    impl Default for StorageState {
        fn default() -> Self {
            StorageState {
                manager: Mutex::new(StorageManager::new()),
            }
        }
    }

    #[tauri::command]
    pub fn save_session(
        title: String,
        duration: i64,
        questions: i64,
        state: State<'_, StorageState>,
    ) -> Result<Option<i64>, String> {
        let mgr = state.manager.lock().map_err(|e| e.to_string())?;
        mgr.save_session(&title, duration, &[], questions).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn get_sessions(state: State<'_, StorageState>) -> Result<Vec<SessionRecord>, String> {
        let mgr = state.manager.lock().map_err(|e| e.to_string())?;
        mgr.get_sessions().map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn delete_session(id: i64, state: State<'_, StorageState>) -> Result<(), String> {
        let mgr = state.manager.lock().map_err(|e| e.to_string())?;
        mgr.delete_session(id).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn clear_all_sessions(state: State<'_, StorageState>) -> Result<(), String> {
        let mgr = state.manager.lock().map_err(|e| e.to_string())?;
        mgr.clear_all().map_err(|e| e.to_string())
    }
}


