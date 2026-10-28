// Translation Module
// High-Quality Auto-Detecting Bilingual Translation Engine
// Preserves technical terminology (Kubernetes, Docker, Microservices, AWS) and provides natural Vietnamese translation.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

static GLOBAL_GEMINI_KEY: OnceLock<Arc<Mutex<String>>> = OnceLock::new();
static GLOBAL_TRANSLATION_ENGINE: OnceLock<Arc<Mutex<String>>> = OnceLock::new();

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

pub fn get_engine_holder() -> &'static Arc<Mutex<String>> {
    GLOBAL_TRANSLATION_ENGINE.get_or_init(|| Arc::new(Mutex::new("gemini".to_string())))
}

pub fn set_translation_engine_mode(engine: &str) {
    let holder = get_engine_holder();
    if let Ok(mut lock) = holder.lock() {
        *lock = engine.trim().to_lowercase();
    }
}

pub fn get_translation_engine_mode() -> String {
    let holder = get_engine_holder();
    holder.lock().map(|g| g.clone()).unwrap_or_else(|_| "gemini".to_string())
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

    /// Try translating via Gemini 1.5 Flash with detailed error reporting
    pub fn try_gemini(&self, text: &str, api_key: &str) -> std::result::Result<String, String> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err("Chưa nhập Gemini API Key. Vui lòng vào Cài đặt để dán Key.".to_string());
        }

        let prompt = format!(
            "You are an expert real-time interpreter. Automatically identify the source language of the following spoken text (which may be English, Japanese, Chinese, French, Korean, German, Spanish, Vietnamese, or any other language) and translate it into natural, fluent Vietnamese.\n\
            - If the text is already Vietnamese, polish it into clean standard Vietnamese.\n\
            - Preserve specialized technical keywords (e.g. Kubernetes, Docker, React, API, AWS, CI/CD, Bug, Sprint, Scrum, PR, Git, SQL) in their standard technical form.\n\
            - Return ONLY the final Vietnamese translation, without any notes, prefix, quotes, or markdown.\n\n\
            Spoken Text:\n{}",
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
            key
        );

        let resp = self.client.post(&url).json(&payload).send()
            .map_err(|e| format!("Lỗi kết nối Gemini API: {}", e))?;

        let status = resp.status();
        let body = resp.text().unwrap_or_default();

        if !status.is_success() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msg) = json["error"]["message"].as_str() {
                    return Err(format!("Lỗi Gemini ({}): {}", status, msg));
                }
            }
            return Err(format!("Lỗi Gemini HTTP {}", status));
        }

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
            if let Some(txt) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                let clean = txt.trim().to_string();
                if !clean.is_empty() {
                    return Ok(clean);
                }
            }
        }
        Err("Gemini API không trả về nội dung hợp lệ".to_string())
    }

    pub fn test_gemini(&self, api_key: &str) -> std::result::Result<String, String> {
        self.try_gemini("Hello everyone, we are testing the Gemini AI real-time translation integration.", api_key)
    }

    /// Intelligent AI Meeting Minutes & Key Takeaways Generator (inspired by Felo AI)
    pub fn summarize_meeting(&self, transcript: &str, api_key: &str) -> std::result::Result<String, String> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err("Chưa có Gemini API Key để thực hiện tóm tắt cuộc họp.".to_string());
        }

        let prompt = format!(
            "Bạn là một trợ lý thư ký cuộc họp AI chuyên nghiệp cao cấp (tương tự tính năng Felo AI Meeting Minutes).\n\
            Dưới đây là toàn bộ nhật ký phiên dịch cuộc họp / hội thoại thực tế:\n\n\
            \"\"\"\n{}\n\"\"\"\n\n\
            Dựa trên nội dung thảo luận trên, hãy lập một Biên Bản Tóm Tắt Cuộc Họp & Điểm Cốt Lõi bằng Tiếng Việt theo cấu trúc chuẩn Markdown sau:\n\n\
            ### 📌 1. Tổng Quan Cuộc Họp (Overview & Context)\n\
            (Tóm tắt ngắn gọn 2-3 câu về bối cảnh, mục đích và chủ đề chính được trao đổi)\n\n\
            ### 💡 2. Các Luận Điểm Thảo Luận Trọng Tâm (Key Discussion Points)\n\
            (Liệt kê các ý kiến, vấn đề kỹ thuật và giải pháp được thảo luận dưới dạng gạch đầu dòng chi tiết)\n\n\
            ### 🎯 3. Việc Cần Làm & Phân Công Nhiệm Vụ (Action Items & Next Steps)\n\
            (Liệt kê các việc cần làm, ai phụ trách nếu có đề cập)\n\n\
            ### 📖 4. Thuật Ngữ Kỹ Thuật Quan Trọng (Glossary & Tech Stack)\n\
            (Ghi chú ngắn các công nghệ hoặc thuật ngữ nổi bật như Docker, K8s, API, AWS, Sprint...)\n\n\
            Hãy trình bày thật chuyên nghiệp, súc tích, văn phong hiện đại, trực quan.",
            transcript
        );

        let payload = serde_json::json!({
            "contents": [{ "parts": [{ "text": prompt }] }],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1800
            }
        });
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
            key
        );

        let resp = self.client.post(&url).json(&payload).send()
            .map_err(|e| format!("Lỗi kết nối Gemini API: {}", e))?;

        let status = resp.status();
        let body = resp.text().unwrap_or_default();

        if !status.is_success() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msg) = json["error"]["message"].as_str() {
                    return Err(format!("Lỗi Gemini ({}): {}", status, msg));
                }
            }
            return Err(format!("Lỗi Gemini HTTP {}", status));
        }

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
            if let Some(txt) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                let clean = txt.trim().to_string();
                if !clean.is_empty() {
                    return Ok(clean);
                }
            }
        }
        Err("Gemini API không trả về nội dung tóm tắt hợp lệ".to_string())
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

        // 2. Primary: Gemini 1.5 Flash Cloud Translation (Full contextual intelligence)
        let mode = get_translation_engine_mode();
        let gemini_key = get_global_gemini_key();

        if mode == "gemini" {
            if !gemini_key.is_empty() {
                match self.try_gemini(trimmed, &gemini_key) {
                    Ok(gemini_res) => {
                        let final_trans = self.glossary.protect_keywords(&gemini_res);
                        if let Ok(mut cache) = self.cache.lock() {
                            cache.insert(trimmed.to_string(), final_trans.clone());
                        }
                        return Ok(final_trans);
                    }
                    Err(err) => {
                        log::warn!("Gemini translation failed: {}. Falling back to fast auto-detect.", err);
                    }
                }
            } else {
                log::debug!("Gemini mode selected but API key is empty. Proceeding to Google Auto-Detect.");
            }
        }

        // 3. Direct technical meeting idioms lookup
        if let Some(vi) = self.glossary.lookup_phrase(trimmed) {
            let result = format!("{}{}", vi, if trimmed.ends_with('?') && !vi.ends_with('?') { "?" } else { "" });
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(trimmed.to_string(), result.clone());
            }
            return Ok(result);
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

pub fn generate_local_meeting_summary(transcript: &str) -> String {
    let lines: Vec<&str> = transcript
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with("===") && !l.starts_with("---"))
        .collect();

    let total_lines = lines.len();
    if total_lines == 0 {
        return "Chưa có đủ nội dung hội thoại để tạo biên bản tóm tắt cuộc họp.".to_string();
    }

    let mut key_points = Vec::new();
    let mut action_items = Vec::new();
    let mut tech_terms = Vec::new();

    let tech_keywords = [
        "Kubernetes", "Docker", "AWS", "GCP", "Azure", "API", "Database",
        "Microservices", "Frontend", "Backend", "CI/CD", "Git", "Bug", "Sprint",
        "React", "Rust", "Node", "PostgreSQL", "Redis", "Kafka",
    ];

    for line in &lines {
        let lower = line.to_lowercase();
        // Check for tech terms
        for &kw in &tech_keywords {
            if lower.contains(&kw.to_lowercase()) && !tech_terms.contains(&kw.to_string()) {
                tech_terms.push(kw.to_string());
            }
        }
        // Action keywords
        if lower.contains("need to")
            || lower.contains("cần")
            || lower.contains("phải")
            || lower.contains("will do")
            || lower.contains("deploy")
            || lower.contains("fix")
            || lower.contains("action")
            || lower.contains("tiến hành")
        {
            if action_items.len() < 5 {
                action_items.push(line.to_string());
            }
        } else if key_points.len() < 6 && line.len() > 15 {
            key_points.push(line.to_string());
        }
    }

    let mut out = String::new();
    out.push_str("### 📌 1. Tổng Quan Cuộc Họp (Overview)\n");
    out.push_str(&format!(
        "Cuộc họp gồm **{}** lượt phát biểu đã được ghi nhận và phiên dịch song ngữ tự động.\n\n",
        total_lines
    ));

    out.push_str("### 💡 2. Các Luận Điểm Đáng Chú Ý (Key Discussion Points)\n");
    if key_points.is_empty() {
        out.push_str("- Đã ghi nhận các trao đổi hội thoại và kỹ thuật liên tục.\n");
    } else {
        for p in key_points {
            out.push_str(&format!("- {}\n", p));
        }
    }
    out.push_str("\n");

    out.push_str("### 🎯 3. Việc Cần Làm & Hành Động (Action Items)\n");
    if action_items.is_empty() {
        out.push_str("- Tiếp tục theo dõi tiến độ các hạng mục đã thảo luận.\n");
    } else {
        for a in action_items {
            out.push_str(&format!("- [ ] {}\n", a));
        }
    }
    out.push_str("\n");

    out.push_str("### 📖 4. Thuật Ngữ & Công Nghệ Được Nhắc Đến (Tech Terms)\n");
    if tech_terms.is_empty() {
        out.push_str("- Hệ thống thuật ngữ công nghệ thông dụng.\n");
    } else {
        out.push_str(&format!("- {}\n", tech_terms.join(", ")));
    }

    out
}
