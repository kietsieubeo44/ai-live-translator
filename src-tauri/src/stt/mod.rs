// Speech-To-Text (STT) Module
// Voice Activity Detection (VAD), Audio Buffer, and Local Whisper Engine

use anyhow::{anyhow, Result};
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: u64,
    pub text: String,
    pub is_final: bool,
    pub confidence: f32,
    pub timestamp_ms: u64,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub is_downloaded: bool,
    pub size_mb: u32,
    pub recommended_for: String,
}

// ─── VAD (Voice Activity Detection) ──────────────────────────────────────────

pub struct VadDetector {
    energy_threshold: f32,
    speech_frame_count: usize,
    silence_frame_count: usize,
    hangover_frames: usize,
    is_speaking: bool,
}

impl VadDetector {
    pub fn new(energy_threshold: f32) -> Self {
        VadDetector {
            energy_threshold,
            speech_frame_count: 0,
            silence_frame_count: 0,
            hangover_frames: 15, // ~300ms hangover at 20ms frames
            is_speaking: false,
        }
    }

    /// Process a frame of 16kHz mono audio (typically 320 to 512 samples)
    pub fn process_frame(&mut self, samples: &[f32]) -> bool {
        if samples.is_empty() {
            return self.is_speaking;
        }

        let energy = samples.iter().map(|&s| s * s).sum::<f32>() / samples.len() as f32;
        let rms = energy.sqrt();

        // Calculate zero-crossing rate for distinguishing speech from low-freq rumble
        let mut zcr = 0;
        for i in 1..samples.len() {
            if (samples[i] >= 0.0 && samples[i - 1] < 0.0) || (samples[i] < 0.0 && samples[i - 1] >= 0.0) {
                zcr += 1;
            }
        }
        let zcr_rate = zcr as f32 / samples.len() as f32;

        let frame_has_speech = rms > self.energy_threshold && zcr_rate > 0.02 && zcr_rate < 0.45;

        if frame_has_speech {
            self.speech_frame_count += 1;
            self.silence_frame_count = 0;
            if self.speech_frame_count >= 2 {
                self.is_speaking = true;
            }
        } else {
            self.silence_frame_count += 1;
            self.speech_frame_count = 0;
            if self.silence_frame_count > self.hangover_frames {
                self.is_speaking = false;
            }
        }

        self.is_speaking
    }

    pub fn is_active(&self) -> bool {
        self.is_speaking
    }

    pub fn reset(&mut self) {
        self.speech_frame_count = 0;
        self.silence_frame_count = 0;
        self.is_speaking = false;
    }
}

// ─── Indian English & Tech Jargon Normalizer ──────────────────────────────────

pub struct AudioTextNormalizer {
    jargon_map: HashMap<&'static str, &'static str>,
}

impl AudioTextNormalizer {
    pub fn new() -> Self {
        let mut map = HashMap::new();
        // Indian English common idioms & technical pronunciation variations
        map.insert("prepone", "reschedule earlier");
        map.insert("do the needful", "take the required action");
        map.insert("revert back", "reply");
        map.insert("pass out of college", "graduated from college");
        map.insert("out of station", "out of town");
        map.insert("updation", "update");
        map.insert("doubt regarding", "question regarding");
        // Tech terms & acronyms
        map.insert("k8s", "Kubernetes");
        map.insert("ci cd", "CI/CD");
        map.insert("pr", "Pull Request");
        map.insert("repo", "repository");
        map.insert("db", "database");
        map.insert("api", "API");
        map.insert("aws", "AWS");
        map.insert("gcp", "GCP");

        AudioTextNormalizer { jargon_map: map }
    }

    pub fn normalize(&self, text: &str) -> String {
        let mut normalized = text.to_string();
        for (pattern, replacement) in &self.jargon_map {
            let re_pattern = format!(r"(?i)\b{}\b", regex::escape(pattern));
            if let Ok(re) = regex::Regex::new(&re_pattern) {
                normalized = re.replace_all(&normalized, *replacement).to_string();
            }
        }
        normalized
    }
}

// ─── Transcript Deduplicator ──────────────────────────────────────────────────

fn normalize_key(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
}

pub struct TranscriptDeduplicator {
    last_confirmed_text: String,
    history: Vec<String>,
}

impl TranscriptDeduplicator {
    pub fn new() -> Self {
        TranscriptDeduplicator {
            last_confirmed_text: String::new(),
            history: Vec::new(),
        }
    }

    /// Check if new text is a duplicate or continuation of previous text
    pub fn filter_duplicate(&mut self, text: &str) -> Option<String> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return None;
        }

        let new_norm = normalize_key(trimmed);
        if new_norm.is_empty() {
            return None;
        }

        let last_norm = normalize_key(&self.last_confirmed_text);

        // Exact normalized match with last text
        if new_norm == last_norm {
            return None;
        }

        // Check if identical to any of the last 4 items in history
        if self.history.iter().rev().take(4).any(|h| normalize_key(h) == new_norm) {
            return None;
        }

        // Substring check: if last confirmed text ends with new text or contains it entirely
        if !last_norm.is_empty() && last_norm.contains(&new_norm) {
            return None;
        }

        // If new text starts with the old text, extract only the delta continuation
        let delta = if trimmed.starts_with(&self.last_confirmed_text) && !self.last_confirmed_text.is_empty() {
            trimmed[self.last_confirmed_text.len()..].trim().to_string()
        } else {
            trimmed.to_string()
        };

        if delta.is_empty() || normalize_key(&delta).is_empty() {
            return None;
        }

        self.last_confirmed_text = trimmed.to_string();
        self.history.push(delta.clone());
        if self.history.len() > 50 {
            self.history.remove(0);
        }

        Some(delta)
    }

    pub fn clear(&mut self) {
        self.last_confirmed_text.clear();
        self.history.clear();
    }
}

// ─── Speech-To-Text Provider Trait ────────────────────────────────────────────

pub trait SpeechToTextProvider: Send + Sync {
    fn transcribe(&mut self, audio_16k_mono: &[f32]) -> Result<Vec<TranscriptSegment>>;
    fn get_model_info(&self) -> ModelInfo;
    fn is_ready(&self) -> bool;
}

// ─── Local STT Engine Implementation ──────────────────────────────────────────

pub fn find_whisper_cli() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("models/whisper-cli/main.exe"),
        PathBuf::from("../models/whisper-cli/main.exe"),
    ];
    for p in &candidates {
        if p.exists() {
            return Some(p.clone());
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join("models").join("whisper-cli").join("main.exe");
            if p1.exists() { return Some(p1); }
            if let Some(grandparent) = parent.parent() {
                let p2 = grandparent.join("models").join("whisper-cli").join("main.exe");
                if p2.exists() { return Some(p2); }
            }
        }
    }
    None
}

static CURRENT_MODEL: std::sync::OnceLock<std::sync::Arc<std::sync::Mutex<String>>> = std::sync::OnceLock::new();

pub fn get_current_model_holder() -> &'static std::sync::Arc<std::sync::Mutex<String>> {
    CURRENT_MODEL.get_or_init(|| std::sync::Arc::new(std::sync::Mutex::new("base.en".to_string())))
}

pub fn set_active_model_name(name: &str) {
    if let Ok(mut lock) = get_current_model_holder().lock() {
        *lock = name.trim().to_string();
    }
}

pub fn get_active_model_name() -> String {
    get_current_model_holder().lock().map(|l| l.clone()).unwrap_or_else(|_| "base.en".to_string())
}

pub fn find_whisper_model(model_name: &str) -> Option<PathBuf> {
    let name = if model_name.is_empty() {
        get_active_model_name()
    } else {
        model_name.to_string()
    };

    let filename = if name.starts_with("ggml-") {
        name.clone()
    } else {
        format!("ggml-{}.bin", name)
    };

    let target_candidates = [
        PathBuf::from(format!("models/{}", filename)),
        PathBuf::from(format!("../models/{}", filename)),
        PathBuf::from(format!("src-tauri/target/debug/models/{}", filename)),
    ];
    for p in &target_candidates {
        if p.exists() {
            return Some(p.clone());
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p1 = parent.join("models").join(&filename);
            if p1.exists() { return Some(p1); }
            if let Some(grandparent) = parent.parent() {
                let p2 = grandparent.join("models").join(&filename);
                if p2.exists() { return Some(p2); }
            }
        }
    }

    // Fallback: If requested model is not found, try base.en then tiny.en
    for fallback in &["ggml-base.en.bin", "ggml-tiny.en.bin"] {
        let fallback_candidates = [
            PathBuf::from(format!("models/{}", fallback)),
            PathBuf::from(format!("../models/{}", fallback)),
            PathBuf::from(format!("src-tauri/target/debug/models/{}", fallback)),
        ];
        for p in &fallback_candidates {
            if p.exists() {
                return Some(p.clone());
            }
        }
    }
    None
}

pub fn write_wav_file(path: &Path, samples: &[f32], sample_rate: u32) -> std::io::Result<()> {
    use std::io::Write;
    let mut file = std::fs::File::create(path)?;
    let num_samples = samples.len() as u32;
    let byte_rate = sample_rate * 2;
    let data_len = num_samples * 2;
    let riff_len = 36 + data_len;

    file.write_all(b"RIFF")?;
    file.write_all(&riff_len.to_le_bytes())?;
    file.write_all(b"WAVEfmt ")?;
    file.write_all(&16u32.to_le_bytes())?;
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&1u16.to_le_bytes())?;
    file.write_all(&sample_rate.to_le_bytes())?;
    file.write_all(&byte_rate.to_le_bytes())?;
    file.write_all(&2u16.to_le_bytes())?;
    file.write_all(&16u16.to_le_bytes())?;
    file.write_all(b"data")?;
    file.write_all(&data_len.to_le_bytes())?;

    for &sample in samples {
        let clamped = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
        file.write_all(&clamped.to_le_bytes())?;
    }
    file.flush()?;
    Ok(())
}

pub struct LocalWhisperEngine {
    model_name: String,
    model_path: Option<PathBuf>,
    cli_path: Option<PathBuf>,
    is_loaded: bool,
    normalizer: AudioTextNormalizer,
    deduplicator: TranscriptDeduplicator,
    segment_counter: u64,
}

impl LocalWhisperEngine {
    pub fn new(model_name: &str) -> Self {
        let name = if model_name.is_empty() { get_active_model_name() } else { model_name.to_string() };
        let model = find_whisper_model(&name);
        let cli = find_whisper_cli();
        let loaded = model.is_some() && cli.is_some();
        LocalWhisperEngine {
            model_name: name,
            model_path: model,
            cli_path: cli,
            is_loaded: loaded,
            normalizer: AudioTextNormalizer::new(),
            deduplicator: TranscriptDeduplicator::new(),
            segment_counter: 0,
        }
    }

    pub fn reload_model(&mut self, model_name: &str) {
        if !model_name.is_empty() && self.model_name != model_name {
            info!("Dynamic STT model switch: {} -> {}", self.model_name, model_name);
            self.model_name = model_name.to_string();
            self.model_path = find_whisper_model(model_name);
            self.is_loaded = self.model_path.is_some() && self.cli_path.is_some();
        }
    }

    pub fn set_model_path(&mut self, path: PathBuf) {
        if path.exists() {
            self.model_path = Some(path);
            self.is_loaded = self.cli_path.is_some();
            info!("Whisper model loaded from: {:?}", self.model_path);
        }
    }

    /// List standard whisper model options
    pub fn get_available_models() -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                name: "tiny.en".to_string(),
                path: "models/ggml-tiny.en.bin".to_string(),
                is_downloaded: Path::new("models/ggml-tiny.en.bin").exists(),
                size_mb: 39,
                recommended_for: "Fastest response, minimal CPU/RAM (laptops)".to_string(),
            },
            ModelInfo {
                name: "base.en".to_string(),
                path: "models/ggml-base.en.bin".to_string(),
                is_downloaded: Path::new("models/ggml-base.en.bin").exists(),
                size_mb: 74,
                recommended_for: "Recommended: Optimal balance of speed and Indian English accuracy".to_string(),
            },
            ModelInfo {
                name: "small.en".to_string(),
                path: "models/ggml-small.en.bin".to_string(),
                is_downloaded: Path::new("models/ggml-small.en.bin").exists(),
                size_mb: 244,
                recommended_for: "Highest accuracy, ideal with RTX 3050 GPU".to_string(),
            },
        ]
    }
}

impl SpeechToTextProvider for LocalWhisperEngine {
    fn transcribe(&mut self, audio_16k_mono: &[f32]) -> Result<Vec<TranscriptSegment>> {
        if audio_16k_mono.is_empty() {
            return Ok(Vec::new());
        }

        // Energy verification: only reject absolute digital silence
        let energy = audio_16k_mono.iter().map(|&s| s * s).sum::<f32>() / audio_16k_mono.len() as f32;
        if energy.sqrt() < 0.0003 {
            return Ok(Vec::new());
        }

        let start_time = Instant::now();
        self.segment_counter += 1;

        let mut extracted_texts: Vec<String> = Vec::new();
        let mut detected_language = "auto".to_string();

        if let (Some(cli_path), Some(model_path)) = (&self.cli_path, &self.model_path) {
            let temp_wav = std::env::temp_dir().join(format!("ai_live_{}_{}.wav", std::process::id(), self.segment_counter));
            if write_wav_file(&temp_wav, audio_16k_mono, 16000).is_ok() {
                let mut cmd = std::process::Command::new(cli_path);
                cmd.arg("-m")
                    .arg(model_path)
                    .arg("-f")
                    .arg(&temp_wav)
                    .arg("-t")
                    .arg("6");

                let model_str = model_path.to_string_lossy().to_lowercase();
                if model_str.contains(".en.") || model_str.contains(".en") {
                    cmd.arg("-l").arg("en");
                }

                cmd.arg("--prompt")
                    .arg("Software engineering meeting, system architecture, microservices, cloud, Kubernetes, deployment.");

                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }

                if let Ok(output) = cmd.output() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let combined = format!("{}\n{}", stdout, stderr);

                    if let Some(pos) = combined.find("language = ") {
                        let sub = &combined[pos + 11..];
                        if let Some(end) = sub.find(|c: char| c == ',' || c == ' ' || c == '\n' || c == '\r') {
                            let lang_str = sub[..end].trim();
                            if !lang_str.is_empty() {
                                detected_language = lang_str.to_string();
                            }
                        }
                    }

                    if let Ok(re) = regex::Regex::new(r"\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.+)") {
                        for cap in re.captures_iter(&stdout) {
                            if let Some(m) = cap.get(1) {
                                let txt = m.as_str().trim();
                                if !txt.is_empty() && txt != "[BLANK_AUDIO]" && !txt.starts_with('[') {
                                    extracted_texts.push(txt.to_string());
                                }
                            }
                        }
                    }
                    if extracted_texts.is_empty() {
                        for line in stdout.lines() {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() 
                                && !trimmed.starts_with("whisper_") 
                                && !trimmed.starts_with("main:") 
                                && !trimmed.starts_with("system_info:") 
                                && trimmed != "[BLANK_AUDIO]" 
                            {
                                extracted_texts.push(trimmed.to_string());
                            }
                        }
                    }
                }
                let _ = std::fs::remove_file(&temp_wav);
            }
        }

        let raw_text = if !extracted_texts.is_empty() {
            extracted_texts.join(" ")
        } else {
            // If whisper CLI did not return text or in unit-test environment:
            return Ok(Vec::new());
        };

        let normalized = self.normalizer.normalize(&raw_text);

        if let Some(clean_text) = self.deduplicator.filter_duplicate(&normalized) {
            let seg = TranscriptSegment {
                id: self.segment_counter,
                text: clean_text,
                is_final: true,
                confidence: 0.95,
                timestamp_ms: start_time.elapsed().as_millis() as u64,
                language: detected_language,
            };
            Ok(vec![seg])
        } else {
            Ok(Vec::new())
        }
    }

    fn get_model_info(&self) -> ModelInfo {
        ModelInfo {
            name: self.model_name.clone(),
            path: self.model_path.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
            is_downloaded: self.is_loaded,
            size_mb: 74,
            recommended_for: "Local Whisper STT (NVIDIA RTX GPU)".to_string(),
        }
    }

    fn is_ready(&self) -> bool {
        self.is_loaded
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vad_silence() {
        let mut vad = VadDetector::new(0.01);
        let silence = vec![0.0f32; 320];
        let is_speech = vad.process_frame(&silence);
        assert!(!is_speech, "Silence must not trigger VAD");
    }

    #[test]
    fn test_vad_speech_sine() {
        let mut vad = VadDetector::new(0.01);
        // Create 440Hz sine wave (speech frequency range)
        let sine: Vec<f32> = (0..320)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 16000.0).sin() * 0.2)
            .collect();

        // Feed multiple frames to trigger speech
        vad.process_frame(&sine);
        let is_speech = vad.process_frame(&sine);
        assert!(is_speech, "Sufficient energy in speech frequency range must trigger VAD");
    }

    #[test]
    fn test_text_normalizer_indian_english() {
        let normalizer = AudioTextNormalizer::new();
        let input = "Please do the needful and prepone the meeting regarding k8s deployment.";
        let output = normalizer.normalize(input);
        assert!(output.contains("take the required action"), "Normalized text must replace idioms");
        assert!(output.contains("reschedule earlier"), "Normalized text must replace prepone");
        assert!(output.contains("Kubernetes"), "Normalized text must expand k8s");
    }

    #[test]
    fn test_deduplicator() {
        let mut dedup = TranscriptDeduplicator::new();
        let first = dedup.filter_duplicate("Hello world");
        assert_eq!(first, Some("Hello world".to_string()));

        // Exactly identical text
        let second = dedup.filter_duplicate("Hello world");
        assert_eq!(second, None, "Exact duplicate should be filtered");

        // Continuation
        let third = dedup.filter_duplicate("Hello world how are you");
        assert_eq!(third, Some("how are you".to_string()), "Continuation should only return delta");
    }
}
