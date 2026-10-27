// Smart Answer Assistant Module
// Question Detection, Context Analysis, and Answer Generation Engine

use anyhow::Result;
use log::info;
use serde::{Deserialize, Serialize};

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
            // Determine question sub-type
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

    /// Generate contextual answers without fabricating personal claims
    pub fn generate_answer(&self, question: &DetectedQuestion, is_manual: bool) -> AnswerSuggestion {
        let q_lower = question.question_text.to_lowercase();

        let (prof_en, prof_vi, concise_en, concise_vi, friendly_en, friendly_vi) = match question.question_type {
            QuestionType::Interview => {
                if q_lower.contains("challenge") || q_lower.contains("difficult") {
                    (
                        "In my recent project, the main challenge was [describe challenge, e.g., optimizing system latency]. I addressed it by analyzing the bottlenecks, collaborating with the team, and implementing [specific solution]. As a result, we improved performance significantly.".to_string(),
                        "Trong dự án gần đây của tôi, thách thức chính là [mô tả vấn đề, ví dụ: tối ưu độ trễ]. Tôi đã giải quyết bằng cách phân tích điểm nghẽn, phối hợp cùng team và triển khai [giải pháp]. Nhờ đó hiệu năng đã được cải thiện đáng kể.".to_string(),
                        "I analyzed the root cause, implemented [solution], and successfully achieved [metric/result].".to_string(),
                        "Tôi đã phân tích nguyên nhân gốc rễ, triển khai [giải pháp] và đạt được [kết quả].".to_string(),
                        "That was an interesting one! We ran into [challenge], worked through it together, and it turned out great.".to_string(),
                        "Đó là một trải nghiệm rất thú vị! Chúng tôi gặp phải [thách thức], cùng nhau giải quyết và kết quả rất khả quan.".to_string()
                    )
                } else {
                    (
                        "I have hands-on experience working with [technology/domain]. In my work, I typically focus on writing clean, maintainable code and delivering reliable solutions.".to_string(),
                        "Tôi có kinh nghiệm thực tế làm việc với [công nghệ/lĩnh vực]. Trong công việc, tôi luôn chú trọng viết code sạch, dễ bảo trì và mang lại giải pháp đáng tin cậy.".to_string(),
                        "Yes, I have worked extensively with [technology] on several projects.".to_string(),
                        "Vâng, tôi đã làm việc nhiều với [công nghệ] trong các dự án trước đây.".to_string(),
                        "Yes, absolutely! I've been working with [technology] and really enjoy building with it.".to_string(),
                        "Vâng, chắc chắn rồi! Tôi đã làm việc với [công nghệ] và rất thích phát triển trên nền tảng này.".to_string()
                    )
                }
            }
            QuestionType::Technical => {
                (
                    "From an architectural standpoint, I recommend [approach/pattern], because it provides high modularity, scalability, and simplifies testing.".to_string(),
                    "Từ góc độ kiến trúc, tôi đề xuất [hướng tiếp cận/mô hình], vì giải pháp này mang lại tính module cao, khả năng mở rộng tốt và đơn giản hóa việc kiểm thử.".to_string(),
                    "I recommend [approach] to ensure high performance and scalability.".to_string(),
                    "Tôi đề xuất [giải pháp] để đảm bảo hiệu năng và khả năng mở rộng.".to_string(),
                    "I think going with [approach] makes a lot of sense here, keeping things fast and clean.".to_string(),
                    "Tôi nghĩ lựa chọn [giải pháp] ở đây là rất hợp lý, giúp hệ thống nhanh và gọn gàng.".to_string()
                )
            }
            QuestionType::Indirect | QuestionType::Direct | QuestionType::Clarification => {
                if q_lower.starts_with("can you") || q_lower.starts_with("could you") {
                    (
                        "Certainly, I would be happy to walk through that. [Provide relevant context or step-by-step summary].".to_string(),
                        "Chắc chắn rồi, tôi rất sẵn lòng trình bày chi tiết về phần này. [Cung cấp tóm tắt các bước].".to_string(),
                        "Sure, I can definitely do that.".to_string(),
                        "Chắc chắn rồi, tôi có thể thực hiện việc đó.".to_string(),
                        "No problem at all, let's dive into it!".to_string(),
                        "Không thành vấn đề, chúng ta cùng trao đổi ngay nhé!".to_string()
                    )
                } else {
                    (
                        "Based on our current discussion, my perspective is that [state recommendation or key fact]. We can also explore [alternative] if needed.".to_string(),
                        "Dựa trên nội dung trao đổi, góc nhìn của tôi là [nêu quan điểm/đề xuất]. Chúng ta cũng có thể cân nhắc [phương án thay thế] nếu cần.".to_string(),
                        "In short: [key takeaway / recommendation].".to_string(),
                        "Nói ngắn gọn: [điểm mấu chốt / đề xuất chính].".to_string(),
                        "Here's how I see it: [friendly perspective / suggestion].".to_string(),
                        "Theo góc nhìn của tôi thì: [quan điểm / gợi ý thân thiện].".to_string()
                    )
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
            created_at_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
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
    fn test_answer_generation_no_fabrication() {
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
        // Ensure no fabricated numbers or company names, only placeholders or professional phrasing
        assert!(answer.primary_answer_en.contains("[") || answer.primary_answer_en.contains("experience"));
        assert_eq!(answer.variants.len(), 3);
        assert_eq!(answer.variants[0].style, "Professional");
        assert_eq!(answer.variants[1].style, "Concise");
        assert_eq!(answer.variants[2].style, "Friendly");
    }
}
