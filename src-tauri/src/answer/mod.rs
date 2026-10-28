// Smart Answer Assistant Module
// Question Detection, Context Analysis, Knowledge Base Integration, and Answer Generation Engine

use anyhow::Result;
use log::info;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum QuestionType {
    Direct,
    Indirect,
    Interview,
    Technical,
    Clarification,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedQuestion {
    pub id: u64,
    pub question_text: String,
    pub question_type: QuestionType,
    pub confidence: f32,
    pub needs_response: bool,
    pub context_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerVariant {
    pub style: String, // "Professional", "Concise", "Friendly"
    pub text_en: String,
    pub text_vi: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerSuggestion {
    pub id: u64,
    pub question: DetectedQuestion,
    pub primary_answer_en: String,
    pub primary_answer_vi: String,
    pub variants: Vec<AnswerVariant>,
    pub created_at_ms: u64,
    pub is_manual: bool,
}

// ─── Document & Knowledge Base Data Structures ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDoc {
    pub id: String,
    pub title: String,
    pub content: String,
    pub is_active: bool,
    pub created_at_ms: u64,
    pub doc_type: String, // "resume" | "project" | "faq" | "notes" | "general"
    pub word_count: usize,
}

static GLOBAL_KNOWLEDGE_DOCS: OnceLock<Arc<Mutex<Vec<KnowledgeDoc>>>> = OnceLock::new();

fn get_knowledge_file_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let dir = PathBuf::from(app_data).join("com.ailivetranslator.app");
        let _ = std::fs::create_dir_all(&dir);
        return Some(dir.join("knowledge_base.json"));
    }
    None
}

fn load_knowledge_docs_from_disk() -> Option<Vec<KnowledgeDoc>> {
    let path = get_knowledge_file_path()?;
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(docs) = serde_json::from_str::<Vec<KnowledgeDoc>>(&content) {
                return Some(docs);
            }
        }
    }
    None
}

fn save_knowledge_docs_to_disk(docs: &[KnowledgeDoc]) {
    if let Some(path) = get_knowledge_file_path() {
        if let Ok(json) = serde_json::to_string_pretty(docs) {
            let _ = std::fs::write(path, json);
        }
    }
}

pub fn get_knowledge_docs_holder() -> &'static Arc<Mutex<Vec<KnowledgeDoc>>> {
    GLOBAL_KNOWLEDGE_DOCS.get_or_init(|| {
        let loaded = load_knowledge_docs_from_disk().unwrap_or_else(|| {
            vec![
                KnowledgeDoc {
                    id: "default-resume".to_string(),
                    title: "Hồ sơ năng lực & Kinh nghiệm chuyên môn".to_string(),
                    content: "Chuyên môn: Fullstack Software Engineer & AI Systems Developer.\nKinh nghiệm: 5 năm phát triển hệ thống với TypeScript, React, Rust, Python, Docker, Kubernetes, Microservices, AWS.\nThế mạnh: Tối ưu hiệu năng, kiến trúc microservices chịu tải cao, tích hợp AI/LLM thời gian thực, xử lý âm thanh luồng thấp độ trễ.".to_string(),
                    is_active: true,
                    created_at_ms: 1730000000000,
                    doc_type: "resume".to_string(),
                    word_count: 50,
                },
                KnowledgeDoc {
                    id: "default-faq".to_string(),
                    title: "Dự án & Kiến trúc tiêu biểu".to_string(),
                    content: "Dự án chính: AI Live Translator & Smart Answer Assistant.\nKiến trúc: WASAPI loopback audio capture thời gian thực trên Windows, Local Whisper STT với VAD thông minh, Gemini 1.5 Flash Cloud engine hỗ trợ dịch và gợi ý phản hồi theo ngữ cảnh tài liệu.\nKết quả: Giảm độ trễ phiên dịch xuống dưới 500ms, độ chính xác thuật ngữ kỹ thuật đạt trên 95%.".to_string(),
                    is_active: true,
                    created_at_ms: 1730000001000,
                    doc_type: "project".to_string(),
                    word_count: 55,
                }
            ]
        });
        Arc::new(Mutex::new(loaded))
    })
}

pub fn get_all_knowledge_docs() -> Vec<KnowledgeDoc> {
    get_knowledge_docs_holder()
        .lock()
        .map(|docs| docs.clone())
        .unwrap_or_default()
}

pub fn add_knowledge_doc(title: String, content: String, doc_type: String) -> KnowledgeDoc {
    let word_count = content.split_whitespace().count();
    let doc = KnowledgeDoc {
        id: format!("doc_{}", rand_or_timestamp()),
        title: if title.trim().is_empty() { "Tài liệu mới".to_string() } else { title.trim().to_string() },
        content: content.trim().to_string(),
        is_active: true,
        created_at_ms: rand_or_timestamp(),
        doc_type: if doc_type.trim().is_empty() { "general".to_string() } else { doc_type.trim().to_string() },
        word_count,
    };

    if let Ok(mut holder) = get_knowledge_docs_holder().lock() {
        holder.push(doc.clone());
        save_knowledge_docs_to_disk(&holder);
    }
    doc
}

pub fn remove_knowledge_doc(id: &str) -> bool {
    if let Ok(mut holder) = get_knowledge_docs_holder().lock() {
        let initial_len = holder.len();
        holder.retain(|d| d.id != id);
        if holder.len() != initial_len {
            save_knowledge_docs_to_disk(&holder);
            return true;
        }
    }
    false
}

pub fn toggle_knowledge_doc(id: &str, is_active: bool) -> bool {
    if let Ok(mut holder) = get_knowledge_docs_holder().lock() {
        if let Some(doc) = holder.iter_mut().find(|d| d.id == id) {
            doc.is_active = is_active;
            save_knowledge_docs_to_disk(&holder);
            return true;
        }
    }
    false
}

pub fn clear_all_knowledge_docs() {
    if let Ok(mut holder) = get_knowledge_docs_holder().lock() {
        holder.clear();
        save_knowledge_docs_to_disk(&holder);
    }
}

pub fn get_combined_active_knowledge() -> String {
    let holder = get_knowledge_docs_holder();
    if let Ok(docs) = holder.lock() {
        let active_texts: Vec<String> = docs.iter()
            .filter(|d| d.is_active && !d.content.trim().is_empty())
            .map(|d| format!("=== TÀI LIỆU: {} [{}] ===\n{}", d.title, d.doc_type, d.content.trim()))
            .collect();
        return active_texts.join("\n\n");
    }
    String::new()
}

fn find_relevant_knowledge_snippet(question: &str, knowledge: &str) -> String {
    if knowledge.trim().is_empty() {
        return String::new();
    }
    let q_words: Vec<&str> = question.split_whitespace()
        .filter(|w| w.len() > 3)
        .collect();

    let mut best_sentence = String::new();
    let mut max_matches = 0;

    for line in knowledge.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("===") {
            continue;
        }
        let lower_line = trimmed.to_lowercase();
        let matches = q_words.iter().filter(|&&w| lower_line.contains(&w.to_lowercase())).count();
        if matches > max_matches {
            max_matches = matches;
            best_sentence = trimmed.to_string();
        }
    }

    if max_matches > 0 {
        best_sentence
    } else {
        knowledge.lines().find(|l| !l.trim().is_empty() && !l.starts_with("===")).unwrap_or("").to_string()
    }
}

// ─── Question Detector ────────────────────────────────────────────────────────

pub struct QuestionDetector {
    rhetorical_patterns: Vec<&'static str>,
    indirect_starters: Vec<&'static str>,
}

impl QuestionDetector {
    pub fn new() -> Self {
        QuestionDetector {
            rhetorical_patterns: vec![
                "you know what i mean",
                "isn't it",
                "don't you think",
                "you know",
                "right?",
                "makes sense, right",
                "fair enough",
            ],
            indirect_starters: vec![
                "i'd like to hear",
                "i would like to know",
                "could you walk us through",
                "can you tell me about",
                "tell me about",
                "tell us about",
                "what's your thought on",
                "what are your thoughts on",
                "i'm curious about",
                "we'd love to understand",
            ],
        }
    }

    /// Analyze a sentence to determine if it is a question needing user response
    pub fn detect_question(&self, text: &str, context: &str) -> Option<DetectedQuestion> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return None;
        }

        let lower = trimmed.to_lowercase();

        // 1. Filter out rhetorical questions
        for pattern in &self.rhetorical_patterns {
            if lower.contains(pattern) && trimmed.split_whitespace().count() < 8 {
                return None;
            }
        }

        // 2. Check for indirect question prompts
        for starter in &self.indirect_starters {
            if lower.starts_with(starter) || lower.contains(starter) {
                let q_type = if lower.contains("experience") || lower.contains("project") || lower.contains("challenge") || lower.contains("background") {
                    QuestionType::Interview
                } else if lower.contains("architecture") || lower.contains("database") || lower.contains("api") || lower.contains("code") || lower.contains("deploy") {
                    QuestionType::Technical
                } else {
                    QuestionType::Indirect
                };

                return Some(DetectedQuestion {
                    id: rand_or_timestamp(),
                    question_text: trimmed.to_string(),
                    question_type: q_type,
                    confidence: 0.88,
                    needs_response: true,
                    context_snippet: context.to_string(),
                });
            }
        }

        // 3. Direct question with interrogative or auxiliary verbs
        let is_direct_interrogative = lower.starts_with("what")
            || lower.starts_with("why")
            || lower.starts_with("how")
            || lower.starts_with("when")
            || lower.starts_with("where")
            || lower.starts_with("who")
            || lower.starts_with("which")
            || lower.starts_with("can you")
            || lower.starts_with("could you")
            || lower.starts_with("would you")
            || lower.starts_with("have you")
            || lower.starts_with("do you")
            || lower.starts_with("did you")
            || lower.starts_with("are you")
            || lower.starts_with("is there");

        let ends_with_question_mark = trimmed.ends_with('?');

        if is_direct_interrogative || ends_with_question_mark {
            let q_type = if lower.contains("experience") || lower.contains("project") || lower.contains("challenge") || lower.contains("background") {
                QuestionType::Interview
            } else if lower.contains("architecture") || lower.contains("database") || lower.contains("api") || lower.contains("code") || lower.contains("deploy") {
                QuestionType::Technical
            } else {
                QuestionType::Direct
            };

            return Some(DetectedQuestion {
                id: rand_or_timestamp(),
                question_text: trimmed.to_string(),
                question_type: q_type,
                confidence: if ends_with_question_mark && is_direct_interrogative { 0.95 } else { 0.80 },
                needs_response: true,
                context_snippet: context.to_string(),
            });
        }

        None
    }
}

// ─── Smart Answer Generator ───────────────────────────────────────────────────

pub struct SmartAnswerEngine {
    detector: QuestionDetector,
}

impl SmartAnswerEngine {
    pub fn new() -> Self {
        SmartAnswerEngine {
            detector: QuestionDetector::new(),
        }
    }

    pub fn detector(&self) -> &QuestionDetector {
        &self.detector
    }

    /// Try generating personalized answers using Gemini API + User's Knowledge Base
    pub fn try_gemini_answer(
        &self,
        question: &DetectedQuestion,
        knowledge_context: &str,
        api_key: &str,
    ) -> std::result::Result<AnswerSuggestion, String> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err("Chưa có Gemini API Key".to_string());
        }

        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_millis(4500))
            .build()
            .map_err(|e| e.to_string())?;

        let prompt = format!(
            "You are an elite real-time AI interview and meeting co-pilot.\n\
            The user is in a live conversation or interview. The other speaker just asked this question:\n\
            \"{question_text}\"\n\n\
            THE USER'S PERSONAL KNOWLEDGE BASE / RESUME / PROJECT DOCUMENTS:\n\
            \"\"\"\n\
            {knowledge}\n\
            \"\"\"\n\n\
            YOUR TASK:\n\
            Formulate an accurate, highly persuasive response based strictly on the facts, experience, projects, and skills in the knowledge base above.\n\
            - Do not invent fake facts or company names that contradict the provided document.\n\
            - If the document lacks specific numbers, formulate a confident professional answer reflecting the provided domain expertise.\n\
            - Provide 3 distinct response styles:\n\
              1. Professional: Complete, articulate, well-structured answer.\n\
              2. Concise: 1-2 sentence direct, punchy answer.\n\
              3. Friendly: Warm, natural, collaborative tone.\n\
            - For each style, provide BOTH 'text_en' (in English for speaking) and 'text_vi' (natural Vietnamese translation for quick reading).\n\
            - Output valid JSON ONLY without any markdown code fence or quotes around the JSON:\n\
            {{\n\
              \"primary_en\": \"Professional English answer\",\n\
              \"primary_vi\": \"Professional Vietnamese translation\",\n\
              \"variants\": [\n\
                {{\"style\": \"Professional\", \"text_en\": \"...\", \"text_vi\": \"...\"}},\n\
                {{\"style\": \"Concise\", \"text_en\": \"...\", \"text_vi\": \"...\"}},\n\
                {{\"style\": \"Friendly\", \"text_en\": \"...\", \"text_vi\": \"...\"}}\n\
              ]\n\
            }}",
            question_text = question.question_text,
            knowledge = if knowledge_context.is_empty() { "No specific documents provided. Answer professionally based on software engineering best practices." } else { knowledge_context }
        );

        let payload = serde_json::json!({
            "contents": [{ "parts": [{ "text": prompt }] }],
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": 700
            }
        });

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
            key
        );

        let resp = client.post(&url).json(&payload).send()
            .map_err(|e| format!("Lỗi kết nối Gemini: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Gemini HTTP {}", resp.status()));
        }

        let body = resp.text().unwrap_or_default();
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
            if let Some(raw_text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                let clean = raw_text.trim();
                let json_str = if clean.starts_with("```json") {
                    clean.trim_start_matches("```json").trim_end_matches("```").trim()
                } else if clean.starts_with("```") {
                    clean.trim_start_matches("```").trim_end_matches("```").trim()
                } else {
                    clean
                };

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                    let p_en = parsed["primary_en"].as_str().unwrap_or("").to_string();
                    let p_vi = parsed["primary_vi"].as_str().unwrap_or("").to_string();
                    let mut variants = Vec::new();

                    if let Some(arr) = parsed["variants"].as_array() {
                        for item in arr {
                            variants.push(AnswerVariant {
                                style: item["style"].as_str().unwrap_or("Professional").to_string(),
                                text_en: item["text_en"].as_str().unwrap_or("").to_string(),
                                text_vi: item["text_vi"].as_str().unwrap_or("").to_string(),
                            });
                        }
                    }

                    if !p_en.is_empty() && !variants.is_empty() {
                        return Ok(AnswerSuggestion {
                            id: rand_or_timestamp(),
                            question: question.clone(),
                            primary_answer_en: p_en,
                            primary_answer_vi: p_vi,
                            variants,
                            created_at_ms: rand_or_timestamp(),
                            is_manual: false,
                        });
                    }
                }
            }
        }

        Err("Không phân tích được phản hồi từ Gemini".to_string())
    }

    /// Generate answers: utilizes User's Knowledge Base + Gemini AI if available, else contextual templates
    pub fn generate_answer(&self, question: &DetectedQuestion, is_manual: bool) -> AnswerSuggestion {
        let knowledge = get_combined_active_knowledge();
        let gemini_key = crate::translation::get_global_gemini_key();

        // 1. Try Gemini generation using User's Knowledge Base
        if !gemini_key.is_empty() {
            if let Ok(mut suggestion) = self.try_gemini_answer(question, &knowledge, &gemini_key) {
                suggestion.is_manual = is_manual;
                return suggestion;
            }
        }

        // 2. Fallback: Contextual template generation with knowledge snippet injection
        let snippet = find_relevant_knowledge_snippet(&question.question_text, &knowledge);
        self.generate_fallback_template_answer(question, is_manual, &snippet)
    }

    /// Template-based fallback when offline or without Gemini Key
    fn generate_fallback_template_answer(
        &self,
        question: &DetectedQuestion,
        is_manual: bool,
        knowledge_snippet: &str,
    ) -> AnswerSuggestion {
        let q_lower = question.question_text.to_lowercase();
        let has_doc = !knowledge_snippet.trim().is_empty();

        let (prof_en, prof_vi, concise_en, concise_vi, friendly_en, friendly_vi) = match question.question_type {
            QuestionType::Interview => {
                if q_lower.contains("challenge") || q_lower.contains("difficult") {
                    if has_doc {
                        (
                            format!("In my recent work, we encountered key challenges. Specifically, as documented: {}. I focused on analyzing the root cause, collaborating with the team, and executing a robust solution that improved overall system reliability.", knowledge_snippet),
                            format!("Trong công việc gần đây, chúng tôi đã xử lý các thách thức kỹ thuật quan trọng. Cụ thể: {}. Tôi đã tập trung phân tích nguyên nhân cốt lõi, phối hợp chặt chẽ với team và đưa ra giải pháp giúp tăng độ ổn định của toàn hệ thống.", knowledge_snippet),
                            "I analyzed the root cause, executed the solution, and achieved measurable reliability.".to_string(),
                            "Tôi đã phân tích nguyên nhân gốc rễ, triển khai giải pháp và mang lại kết quả rõ rệt.".to_string(),
                            "That was a great learning experience! We tackled the challenge head-on and achieved excellent results.".to_string(),
                            "Đó là một trải nghiệm rất giá trị! Chúng tôi đã cùng nhau vượt qua thách thức và đạt kết quả rất tốt.".to_string(),
                        )
                    } else {
                        (
                            "In my recent project, the main challenge was optimizing system performance. I addressed it by analyzing the bottlenecks, collaborating with the team, and implementing high-efficiency caching and query optimization.".to_string(),
                            "Trong dự án gần đây của tôi, thách thức chính là tối ưu hiệu năng. Tôi đã giải quyết bằng cách phân tích điểm nghẽn, phối hợp cùng team và triển khai bộ đệm caching cũng như tối ưu truy vấn.".to_string(),
                            "I analyzed the root cause, implemented targeted optimizations, and successfully achieved our performance goals.".to_string(),
                            "Tôi đã phân tích nguyên nhân, triển khai tối ưu và đạt mục tiêu hiệu năng đề ra.".to_string(),
                            "That was an interesting one! We ran into tricky bottlenecks, worked through it together, and it turned out great.".to_string(),
                            "Đó là một trải nghiệm rất thú vị! Chúng tôi gặp một số điểm nghẽn, cùng nhau giải quyết và kết quả rất khả quan.".to_string(),
                        )
                    }
                } else {
                    if has_doc {
                        (
                            format!("I have extensive hands-on experience in this area. Specifically: {}. In my projects, I focus on clean design, maintainability, and delivering scalable solutions.", knowledge_snippet),
                            format!("Tôi có kinh nghiệm thực tế sâu rộng về lĩnh vực này. Cụ thể: {}. Trong các dự án, tôi luôn ưu tiên kiến trúc rõ ràng, tính dễ bảo trì và khả năng mở rộng.", knowledge_snippet),
                            format!("Yes, I have worked extensively with this: {}.", knowledge_snippet),
                            format!("Vâng, tôi đã làm việc rất nhiều với phần này: {}.", knowledge_snippet),
                            "Yes, absolutely! I've been working deeply in this area and really enjoy building robust solutions.".to_string(),
                            "Vâng, chắc chắn rồi! Tôi đã làm việc sâu về lĩnh vực này và rất hào hứng khi xây dựng các giải pháp tối ưu.".to_string(),
                        )
                    } else {
                        (
                            "I have hands-on experience in this domain. In my work, I typically focus on writing clean, maintainable code and delivering reliable solutions.".to_string(),
                            "Tôi có kinh nghiệm thực tế làm việc trong lĩnh vực này. Tôi luôn chú trọng viết code sạch, dễ bảo trì và mang lại giải pháp đáng tin cậy.".to_string(),
                            "Yes, I have worked extensively in this domain on several production systems.".to_string(),
                            "Vâng, tôi đã làm việc nhiều trong lĩnh vực này trên nhiều hệ thống thực tế.".to_string(),
                            "Yes, absolutely! I've been working with these technologies and really enjoy building with them.".to_string(),
                            "Vâng, chắc chắn rồi! Tôi đã làm việc với các công nghệ này và rất thích phát triển trên chúng.".to_string(),
                        )
                    }
                }
            }
            QuestionType::Technical => {
                if has_doc {
                    (
                        format!("From an engineering perspective, based on our project architecture: {}. This approach provides high modularity, scalability, and simplifies testing.", knowledge_snippet),
                        format!("Từ góc độ kỹ thuật dựa trên kiến trúc dự án: {}. Hướng tiếp cận này đem lại tính module cao, khả năng mở rộng tốt và đơn giản hóa việc kiểm thử.", knowledge_snippet),
                        format!("I recommend this architecture: {}.", knowledge_snippet),
                        format!("Tôi đề xuất kiến trúc này: {}.", knowledge_snippet),
                        "I think this approach makes a lot of sense here, keeping our system fast, resilient, and maintainable.".to_string(),
                        "Tôi nghĩ hướng tiếp cận này rất hợp lý, giúp hệ thống hoạt động nhanh, bền bỉ và dễ bảo trì.".to_string(),
                    )
                } else {
                    (
                        "From an architectural standpoint, I recommend a modular, service-oriented design, because it provides high scalability and simplifies testing.".to_string(),
                        "Từ góc độ kiến trúc, tôi đề xuất mô hình module hóa hướng dịch vụ, vì giải pháp này mang lại tính mở rộng cao và dễ kiểm thử.".to_string(),
                        "I recommend this approach to ensure high performance and scalability.".to_string(),
                        "Tôi đề xuất giải pháp này để đảm bảo hiệu năng và khả năng mở rộng.".to_string(),
                        "I think going with a modular approach makes a lot of sense here, keeping things fast and clean.".to_string(),
                        "Tôi nghĩ lựa chọn mô hình module ở đây là rất hợp lý, giúp hệ thống nhanh và gọn gàng.".to_string(),
                    )
                }
            }
            QuestionType::Indirect | QuestionType::Direct | QuestionType::Clarification => {
                if q_lower.starts_with("can you") || q_lower.starts_with("could you") {
                    (
                        "Certainly, I would be happy to walk through that in detail. Let's look at the key components and our workflow.".to_string(),
                        "Chắc chắn rồi, tôi rất sẵn lòng trình bày chi tiết về phần này. Chúng ta cùng xem xét các thành phần chính và quy trình nhé.".to_string(),
                        "Sure, I can definitely do that.".to_string(),
                        "Chắc chắn rồi, tôi có thể thực hiện việc đó.".to_string(),
                        "No problem at all, let's dive right into it!".to_string(),
                        "Không thành vấn đề, chúng ta cùng trao đổi ngay nhé!".to_string(),
                    )
                } else {
                    if has_doc {
                        (
                            format!("Based on our documentation and experience: {}. My recommendation is to align on this direction.", knowledge_snippet),
                            format!("Dựa trên tài liệu và kinh nghiệm thực tế: {}. Đề xuất của tôi là bám sát theo định hướng này.", knowledge_snippet),
                            format!("Key point: {}.", knowledge_snippet),
                            format!("Điểm mấu chốt: {}.", knowledge_snippet),
                            "Here's how I see it: let's build on our proven architecture to move forward quickly.".to_string(),
                            "Theo góc nhìn của tôi: chúng ta hãy kế thừa kiến trúc đã chứng minh hiệu quả để tiến hành nhanh chóng.".to_string(),
                        )
                    } else {
                        (
                            "Based on our current discussion, my perspective is that we should proceed with the robust solution. We can also explore alternatives if needed.".to_string(),
                            "Dựa trên nội dung trao đổi, góc nhìn của tôi là chúng ta nên triển khai theo giải pháp tối ưu. Chúng ta cũng có thể cân nhắc các phương án thay thế nếu cần.".to_string(),
                            "In short: follow the tested best practice.".to_string(),
                            "Nói ngắn gọn: bám sát theo giải pháp chuẩn đã kiểm nghiệm.".to_string(),
                            "Here's how I see it: let's keep it simple, effective, and move quickly.".to_string(),
                            "Theo góc nhìn của tôi: hãy giữ giải pháp đơn giản, hiệu quả và triển khai nhanh gọn.".to_string(),
                        )
                    }
                }
            }
        };

        let variants = vec![
            AnswerVariant {
                style: "Professional".to_string(),
                text_en: prof_en.clone(),
                text_vi: prof_vi.clone(),
            },
            AnswerVariant {
                style: "Concise".to_string(),
                text_en: concise_en,
                text_vi: concise_vi,
            },
            AnswerVariant {
                style: "Friendly".to_string(),
                text_en: friendly_en,
                text_vi: friendly_vi,
            },
        ];

        AnswerSuggestion {
            id: rand_or_timestamp(),
            question: question.clone(),
            primary_answer_en: prof_en,
            primary_answer_vi: prof_vi,
            variants,
            created_at_ms: rand_or_timestamp(),
            is_manual,
        }
    }
}

fn rand_or_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_direct_question_detection() {
        let detector = QuestionDetector::new();
        let q = detector.detect_question("Can you explain how the API handles authentication?", "Context snippet");
        assert!(q.is_some());
        let res = q.unwrap();
        assert_eq!(res.question_type, QuestionType::Technical);
        assert!(res.confidence >= 0.8);
    }

    #[test]
    fn test_indirect_question_detection() {
        let detector = QuestionDetector::new();
        let q = detector.detect_question("Tell me about a difficult challenge in your previous project.", "Context snippet");
        assert!(q.is_some());
        let res = q.unwrap();
        assert_eq!(res.question_type, QuestionType::Interview);
    }

    #[test]
    fn test_rhetorical_filter() {
        let detector = QuestionDetector::new();
        let q = detector.detect_question("You know what I mean?", "");
        assert!(q.is_none(), "Rhetorical questions must be filtered out");
    }

    #[test]
    fn test_answer_generation_with_knowledge() {
        let engine = SmartAnswerEngine::new();
        let q = DetectedQuestion {
            id: 1,
            question_text: "What is your experience with Kubernetes?".to_string(),
            question_type: QuestionType::Interview,
            confidence: 0.9,
            needs_response: true,
            context_snippet: "".to_string(),
        };

        let answer = engine.generate_answer(&q, false);
        assert_eq!(answer.variants.len(), 3);
        assert_eq!(answer.variants[0].style, "Professional");
        assert_eq!(answer.variants[1].style, "Concise");
        assert_eq!(answer.variants[2].style, "Friendly");
    }
}
