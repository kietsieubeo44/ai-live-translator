// Translation Module
// High-Quality Auto-Detecting Bilingual Translation Engine
// Preserves technical terminology (Kubernetes, Docker, Microservices, AWS) and provides natural Vietnamese translation.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

static GLOBAL_GEMINI_KEY: OnceLock<Arc<Mutex<String>>> = OnceLock::new();

pub fn get_gemini_key_holder() -> &'static Arc<Mutex<String>> {
    GLOBAL_GEMINI_KEY.get_or_init(|| {
        let env_key = std::env::var("GEMINI_API_KEY").unwrap_or_default();
        Arc::new(Mutex::new(env_key))
    })
}

pub fn set_global_gemini_key(key: &str) {
    let holder = get_gemini_key_holder();
    if let Ok(mut lock) = holder.lock() {
        *lock = key.trim().to_string();
    }
}

pub fn get_global_gemini_key() -> String {
    let holder = get_gemini_key_holder();
    holder.lock().map(|g| g.clone()).unwrap_or_default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationItem {
    pub id: u64,
    pub original_en: String,
    pub translated_vi: String,
    pub is_final: bool,
    pub latency_ms: u64,
}

pub trait TranslationProvider: Send + Sync {
    fn translate(&self, text: &str, from: &str, to: &str) -> Result<String>;
    fn provider_name(&self) -> &str;
    fn is_local(&self) -> bool;
}

// ─── Technical Glossary & Keyword Preservation ────────────────────────────────

pub struct TechnicalGlossary {
    protected_words: Vec<&'static str>,
    phrase_dict: HashMap<&'static str, &'static str>,
}

impl TechnicalGlossary {
    pub fn new() -> Self {
        let protected_words = vec![
            "API", "REST", "GraphQL", "JSON", "HTTP", "HTTPS", "CI/CD",
            "Kubernetes", "Docker", "Pod", "Cluster", "AWS", "GCP", "Azure",
            "Git", "GitHub", "GitLab", "PR", "Pull Request", "Commit", "Branch",
            "SQL", "NoSQL", "PostgreSQL", "MongoDB", "Redis", "Kafka",
            "Frontend", "Backend", "Fullstack", "DevOps", "QA", "UI/UX",
            "Bug", "Hotfix", "Sprint", "Scrum", "Agile", "Standup",
            "Microservices", "Microservice", "Architecture",
            "Google", "Microsoft", "Amazon", "Apple", "Meta",
        ];

        let mut phrase_dict = HashMap::new();
        // Common meeting & tech interview phrases
        phrase_dict.insert("hello everyone", "Xin chào mọi người");
        phrase_dict.insert("can you hear me", "Bạn có nghe rõ tôi nói không?");
        phrase_dict.insert("let's get started", "Chúng ta bắt đầu nhé");
        phrase_dict.insert("any questions so far", "Có câu hỏi nào cho đến lúc này không?");
        phrase_dict.insert("can you share your screen", "Bạn có thể chia sẻ màn hình được không?");
        phrase_dict.insert("thank you for your time", "Cảm ơn bạn đã dành thời gian");
        phrase_dict.insert("what is your experience with", "Kinh nghiệm của bạn là gì đối với");
        phrase_dict.insert("could you explain more about", "Bạn có thể giải thích chi tiết hơn về");
        phrase_dict.insert("let's discuss this offline", "Chúng ta sẽ trao đổi thêm vấn đề này sau buổi họp nhé");
        phrase_dict.insert("i agree with this approach", "Tôi hoàn toàn đồng ý với hướng tiếp cận này");
        phrase_dict.insert("sounds good to me", "Nghe rất hợp lý");
        phrase_dict.insert("let me know if you need help", "Hãy nhắn tôi nếu bạn cần hỗ trợ");
        phrase_dict.insert("we are on track", "Chúng ta đang đúng tiến độ");
        phrase_dict.insert("i'll see you guys in this", "Hẹn gặp lại các bạn ở đây");
        phrase_dict.insert("see you later", "Hẹn gặp lại sau nhé");
        phrase_dict.insert("in middle of the preparation", "đang trong quá trình chuẩn bị");
        phrase_dict.insert("in the middle of preparation", "đang trong quá trình chuẩn bị");

        TechnicalGlossary {
            protected_words,
            phrase_dict,
        }
    }

    pub fn lookup_phrase(&self, text: &str) -> Option<String> {
        let lower = text.trim().to_lowercase();
        let clean = lower.trim_end_matches(['?', '.', '!', ',', ';', ':']);
        self.phrase_dict.get(clean).map(|&s| s.to_string())
    }

    pub fn protect_keywords(&self, text: &str) -> String {
        let mut protected = text.to_string();
        for &word in &self.protected_words {
            let re_pattern = format!(r"(?i)\b{}\b", regex::escape(word));
            if let Ok(re) = regex::Regex::new(&re_pattern) {
                protected = re.replace_all(&protected, word).to_string();
            }
        }
        protected
    }
}

// ─── Dual-Engine Real-Time Bilingual Provider ────────────────────────────────

pub struct LocalDictionaryTranslationProvider {
    glossary: TechnicalGlossary,
    client: reqwest::blocking::Client,
    cache: Mutex<HashMap<String, String>>,
}

impl LocalDictionaryTranslationProvider {
    pub fn new() -> Self {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(3500))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();

        LocalDictionaryTranslationProvider {
            glossary: TechnicalGlossary::new(),
            client,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Try translating via Gemini 1.5 Flash if API key is supplied
    fn try_gemini(&self, text: &str, api_key: &str) -> Option<String> {
        if api_key.trim().is_empty() {
            return None;
        }

        let prompt = format!(
            "Translate this live meeting speech into fluent, natural Vietnamese. Preserve technical words (Kubernetes, Docker, API, microservices, AWS, Jira) in English. Return ONLY the translated sentence, without any explanation or quotes:\n\n{}",
            text
        );
        let payload = serde_json::json!({
            "contents": [{ "parts": [{ "text": prompt }] }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 200
            }
        });
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
            api_key.trim()
        );

        if let Ok(resp) = self.client.post(&url).json(&payload).send() {
            if let Ok(json) = resp.json::<serde_json::Value>() {
                if let Some(txt) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                    let clean = txt.trim().to_string();
                    if !clean.is_empty() {
                        return Some(clean);
                    }
                }
            }
        }
        None
    }

    /// Primary Chrome-Extension Google Translate API (fastest, supports auto-detect)
    fn try_google_dict_chrome(&self, text: &str, target_lang: &str) -> Option<String> {
        let resp = self.client
            .get("https://clients5.google.com/translate_a/t")
            .query(&[
                ("client", "dict-chrome-ex"),
                ("sl", "auto"),
                ("tl", target_lang),
                ("q", text),
            ])
            .send()
            .ok()?;

        if let Ok(json) = resp.json::<serde_json::Value>() {
            if let Some(arr) = json.as_array() {
                if let Some(translated) = arr.get(0).and_then(|v| v.as_str()) {
                    let clean = translated.trim();
                    if !clean.is_empty() {
                        return Some(clean.to_string());
                    }
                }
            }
        }
        None
    }

    /// Secondary Google Translate GTX API (fallback)
    fn try_google_gtx(&self, text: &str, target_lang: &str) -> Option<String> {
        let resp = self.client
            .get("https://translate.googleapis.com/translate_a/single")
            .query(&[
                ("client", "gtx"),
                ("sl", "auto"),
                ("tl", target_lang),
                ("dt", "t"),
                ("q", text),
            ])
            .send()
            .ok()?;

        if let Ok(json) = resp.json::<serde_json::Value>() {
            if let Some(sentences) = json.get(0).and_then(|v| v.as_array()) {
                let mut full = String::new();
                for s in sentences {
                    if let Some(part) = s.get(0).and_then(|v| v.as_str()) {
                        full.push_str(part);
                    }
                }
                let clean = full.trim();
                if !clean.is_empty() {
                    return Some(clean.to_string());
                }
            }
        }
        None
    }
}

impl TranslationProvider for LocalDictionaryTranslationProvider {
    fn translate(&self, text: &str, _from: &str, to: &str) -> Result<String> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Ok(String::new());
        }

        // 1. Cache hit check
        if let Ok(cache) = self.cache.lock() {
            if let Some(cached) = cache.get(trimmed) {
                return Ok(cached.clone());
            }
        }

        // 2. Direct technical meeting idioms lookup
        if let Some(vi) = self.glossary.lookup_phrase(trimmed) {
            let result = format!("{}{}", vi, if trimmed.ends_with('?') && !vi.ends_with('?') { "?" } else { "" });
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(trimmed.to_string(), result.clone());
            }
            return Ok(result);
        }

        // 3. Optional Gemini 1.5 Flash translation
        let gemini_key = get_global_gemini_key();
        if !gemini_key.is_empty() {
            if let Some(gemini_res) = self.try_gemini(trimmed, &gemini_key) {
                let final_trans = self.glossary.protect_keywords(&gemini_res);
                if let Ok(mut cache) = self.cache.lock() {
                    cache.insert(trimmed.to_string(), final_trans.clone());
                }
                return Ok(final_trans);
            }
        }

        // 4. Primary Google Translate Chrome-Dict endpoint (high speed, auto-detects language)
        let target_lang = if to.is_empty() { "vi" } else { to };
        if let Some(trans) = self.try_google_dict_chrome(trimmed, target_lang) {
            let final_trans = self.glossary.protect_keywords(&trans);
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(trimmed.to_string(), final_trans.clone());
            }
            return Ok(final_trans);
        }

        // 5. Secondary Google Translate GTX endpoint
        if let Some(trans) = self.try_google_gtx(trimmed, target_lang) {
            let final_trans = self.glossary.protect_keywords(&trans);
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(trimmed.to_string(), final_trans.clone());
            }
            return Ok(final_trans);
        }

        // 6. Intelligent contextual rule-based fallback if network is completely unreachable
        let lower = trimmed.to_lowercase();
        let translated = if lower.starts_with("can you explain") || lower.starts_with("could you explain") {
            format!("Bạn có thể giải thích {} không?", &trimmed[15..].trim_end_matches('?'))
        } else if lower.starts_with("can you") || lower.starts_with("could you") {
            format!("Bạn có thể {} không?", &trimmed[7..].trim_end_matches('?'))
        } else if lower.starts_with("what is") || lower.starts_with("what are") {
            format!("{} là gì?", &trimmed[7..].trim_end_matches('?'))
        } else if lower.starts_with("i believe") || lower.starts_with("i think") {
            format!("Tôi tin rằng {}", &trimmed[9..].trim())
        } else if lower.starts_with("how do we") || lower.starts_with("how can we") {
            format!("Làm thế nào để chúng ta {}?", &trimmed[9..].trim_end_matches('?'))
        } else if lower.starts_with("why did you") {
            format!("Tại sao bạn lại {}?", &trimmed[11..].trim_end_matches('?'))
        } else {
            self.glossary.protect_keywords(trimmed)
        };

        let final_trans = self.glossary.protect_keywords(&translated);
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(trimmed.to_string(), final_trans.clone());
        }
        Ok(final_trans)
    }

    fn provider_name(&self) -> &str {
        "Auto-Detecting Real-Time Bilingual Engine"
    }

    fn is_local(&self) -> bool {
        true
    }
}
