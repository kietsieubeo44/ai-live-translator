// Tauri IPC Command Handlers
// Bridges React frontend and Rust backend

pub mod audio {
    use crate::audio::{list_audio_devices as list_devs, AudioDevice, CaptureStatus, WasapiCaptureManager};
    use std::sync::Mutex;
    use tauri::{AppHandle, Emitter, State};

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
        let rx = mgr.start(&device_id).map_err(|e| e.to_string())?;
        let status = mgr.get_status();

        // Spawn background event dispatcher to stream audio levels and events to windows
        std::thread::spawn(move || {
            while let Ok(msg) = rx.recv() {
                match msg {
                    crate::audio::AudioMessage::PcmChunk { rms, .. } => {
                        let _ = app.emit("audio-level", rms);
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
    pub fn load_model(path: String) -> Result<bool, String> {
        let path_buf = PathBuf::from(path);
        Ok(path_buf.exists())
    }
}

pub mod translation {
    use crate::translation::{LocalDictionaryTranslationProvider, TranslationItem, TranslationProvider};

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
}

pub mod answer {
    use crate::answer::{AnswerSuggestion, DetectedQuestion, QuestionType, SmartAnswerEngine};

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
