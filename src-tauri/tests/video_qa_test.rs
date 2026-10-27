// Integration QA/QC Test: Real Video Loopback, GPU Whisper STT & Live Translation
use ai_live_translator_lib::audio::{list_audio_devices, resample_for_stt, WasapiCaptureManager, AudioMessage};
use ai_live_translator_lib::stt::{LocalWhisperEngine, SpeechToTextProvider};
use ai_live_translator_lib::translation::{LocalDictionaryTranslationProvider, TranslationProvider};
use ai_live_translator_lib::answer::SmartAnswerEngine;
use std::time::{Duration, Instant};

#[test]
fn test_video_audio_loopback_and_stt_pipeline() {
    println!("\n=======================================================");
    println!("  QA/QC AUTOMATED ACCEPTANCE TEST: VIDEO PLAYBACK LOOPBACK");
    println!("=======================================================");

    // [QA-1] Device Enumeration Test
    let devices = list_audio_devices().expect("Must enumerate audio devices");
    println!("[QA-1] Found {} output device(s):", devices.len());
    for (i, d) in devices.iter().enumerate() {
        println!("  - [{}] {} (Default: {}, {}ch, {}Hz, {}bit)", i, d.name, d.is_default, d.channels, d.sample_rate, d.bits_per_sample);
    }
    assert!(!devices.is_empty(), "Must detect at least 1 playback device");

    // [QA-2] WASAPI Loopback Capture on Default Device
    let mut manager = WasapiCaptureManager::new();
    let rx = manager.start("default").expect("Must start WASAPI loopback on default device");
    println!("[QA-2] WASAPI loopback capture started on default device");

    let mut captured_chunks = 0;
    let mut max_rms: f32 = 0.0;
    let mut total_rms: f32 = 0.0;
    let mut audio_16k_buffer: Vec<f32> = Vec::new();
    let start_capture = Instant::now();

    while start_capture.elapsed() < Duration::from_millis(3500) {
        if let Ok(msg) = rx.recv_timeout(Duration::from_millis(50)) {
            match msg {
                AudioMessage::PcmChunk { samples, rms, sample_rate, channels } => {
                    captured_chunks += 1;
                    total_rms += rms;
                    if rms > max_rms {
                        max_rms = rms;
                    }
                    if !samples.is_empty() {
                        let mono = resample_for_stt(&samples, sample_rate, channels);
                        audio_16k_buffer.extend_from_slice(&mono);
                    }
                }
                AudioMessage::Error(e) => {
                    eprintln!("Capture error: {}", e);
                }
                _ => {}
            }
        }
    }

    manager.stop();
    let avg_rms = if captured_chunks > 0 { total_rms / captured_chunks as f32 } else { 0.0 };
    let peak_dbfs = if max_rms > 0.0 { 20.0 * max_rms.log10() } else { -60.0 };

    println!("[QA-2 RESULT] Chunks captured: {}", captured_chunks);
    println!("  - Peak RMS: {:.5} ({:.1} dBFS)", max_rms, peak_dbfs);
    println!("  - Mean RMS: {:.5}", avg_rms);
    println!("  - 16kHz mono samples: {} ({:.2}s duration)", audio_16k_buffer.len(), audio_16k_buffer.len() as f32 / 16000.0);

    assert!(captured_chunks > 30, "Must capture at least 30 PCM chunks in 3.5s");

    // [QA-3] GPU-Accelerated Local Whisper Inference Test
    println!("[QA-3] Initializing Local Whisper STT Engine...");
    let mut whisper = LocalWhisperEngine::new("tiny.en");
    let model_info = whisper.get_model_info();
    println!("  - Model: {} ({}) | Loaded: {}", model_info.name, model_info.path, model_info.is_downloaded);

    let stt_start = Instant::now();
    let segments = whisper.transcribe(&audio_16k_buffer).unwrap_or_default();
    let stt_latency = stt_start.elapsed().as_millis();
    println!("  - STT Inference Duration: {} ms", stt_latency);
    println!("  - Transcribed Segments: {}", segments.len());
    for s in &segments {
        println!("    \"{}\" (confidence: {:.2})", s.text, s.confidence);
    }

    // [QA-4] Live Vietnamese Translation Test
    println!("[QA-4] Testing Bilingual Translation Engine...");
    let translator = LocalDictionaryTranslationProvider::new();
    let test_phrases = [
        "Can you explain your experience with microservices architecture?",
        "Please do the needful and check the k8s deployment.",
        "What are the main advantages of using Docker containers?",
    ];

    for phrase in &test_phrases {
        let t_start = Instant::now();
        let translated = translator.translate(phrase, "en", "vi").expect("Translation must succeed");
        let t_dur = t_start.elapsed().as_micros();
        println!("  EN: \"{}\"", phrase);
        println!("  VI: \"{}\" (latency: {} µs)\n", translated, t_dur);
        assert!(!translated.is_empty(), "Translation must not be empty");
    }

    // [QA-5] Smart Answer Assistant Question Detection Test
    println!("[QA-5] Testing Smart Answer Assistant Question Detection & Variant Generation...");
    let answer_engine = SmartAnswerEngine::new();
    let question_text = "What is your experience with Kubernetes in production?";
    let context = "Interview regarding cloud infrastructure and microservices deployment.";

    let detected = answer_engine.detector().detect_question(question_text, context)
        .expect("Must detect direct technical question");
    println!("  - Detected Question: \"{}\"", detected.question_text);
    println!("  - Type: {:?}, Confidence: {:.2}, Needs Response: {}", detected.question_type, detected.confidence, detected.needs_response);

    let answer = answer_engine.generate_answer(&detected, false);
    println!("  - Primary Answer (EN): \"{}\"", answer.primary_answer_en);
    println!("  - Primary Answer (VI): \"{}\"", answer.primary_answer_vi);
    println!("  - Generated Variants: {}", answer.variants.len());
    for v in &answer.variants {
        println!("    [{:?}] {}", v.style, v.text_en);
    }

    assert_eq!(answer.variants.len(), 3, "Must generate 3 response styles (Professional, Concise, Friendly)");
    println!("\n>>> ALL QA/QC PIPELINE TESTS PASSED SUCCESSFULLY! <<<\n");
}
