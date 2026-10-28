import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, KnowledgeDoc } from "../../stores/useAppStore";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  BookOpen,
  Briefcase,
  Layers,
  HelpCircle,
  Send,
  Eye,
  Copy,
  Check,
} from "lucide-react";

export const KnowledgeBase: React.FC = () => {
  const {
    knowledgeDocs,
    setKnowledgeDocs,
    addKnowledgeDocItem,
    removeKnowledgeDocItem,
    toggleKnowledgeDocItem,
    setLatestSuggestion,
    setActiveTab,
  } = useAppStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("resume");
  const [viewDoc, setViewDoc] = useState<KnowledgeDoc | null>(null);

  // Test question runner
  const [testQuestion, setTestQuestion] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedVariant, setCopiedVariant] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing docs on mount
  useEffect(() => {
    const loadDocs = async () => {
      try {
        const docs = await invoke<KnowledgeDoc[]>("get_knowledge_docs");
        if (Array.isArray(docs)) {
          setKnowledgeDocs(docs);
        }
      } catch (err) {
        console.warn("Failed to fetch knowledge docs:", err);
      }
    };
    loadDocs();
  }, [setKnowledgeDocs]);

  // Handle File Upload (.txt, .md, .json, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) return;

      const title = file.name.replace(/\.[^/.]+$/, "");
      let docType = "general";
      if (title.toLowerCase().includes("cv") || title.toLowerCase().includes("resume")) {
        docType = "resume";
      } else if (title.toLowerCase().includes("project") || title.toLowerCase().includes("architecture")) {
        docType = "project";
      } else if (title.toLowerCase().includes("faq") || title.toLowerCase().includes("question")) {
        docType = "faq";
      }

      try {
        const newDoc = await invoke<KnowledgeDoc>("add_knowledge_doc", {
          title,
          content,
          docType,
        });
        addKnowledgeDocItem(newDoc);
      } catch (err) {
        console.error("Failed to add file doc:", err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle Manual Document Submission
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      const newDoc = await invoke<KnowledgeDoc>("add_knowledge_doc", {
        title: newTitle.trim(),
        content: newContent.trim(),
        docType: newType,
      });
      addKnowledgeDocItem(newDoc);
      setNewTitle("");
      setNewContent("");
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add custom doc:", err);
    }
  };

  // Toggle active state
  const handleToggle = async (id: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    toggleKnowledgeDocItem(id, nextActive);
    try {
      await invoke("toggle_knowledge_doc", { id, isActive: nextActive });
    } catch (err) {
      console.warn("Failed to toggle doc:", err);
    }
  };

  // Remove document
  const handleRemove = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này khỏi bộ nhớ tri thức?")) return;
    removeKnowledgeDocItem(id);
    try {
      await invoke("remove_knowledge_doc", { id });
    } catch (err) {
      console.warn("Failed to delete doc:", err);
    }
  };

  // Load Preset Templates
  const handleLoadPreset = async (presetType: "resume" | "project" | "faq") => {
    let title = "";
    let content = "";
    let docType = presetType;

    if (presetType === "resume") {
      title = "CV Kỹ Sư Phần Mềm (Mẫu Chuẩn)";
      content = `Họ và tên: Kỹ sư Phần mềm Cao cấp (Senior Software Engineer).
Kinh nghiệm: 5+ năm phát triển hệ thống Back-end và Fullstack.
Kỹ năng chính: React, TypeScript, Rust, Python, Go, Node.js.
Hạ tầng & Cloud: Docker, Kubernetes, AWS (EKS, Lambda, S3, RDS), GCP, CI/CD GitHub Actions.
Cơ sở dữ liệu: PostgreSQL, Redis, MongoDB, Elasticsearch, Kafka.
Thành tích nổi bật:
- Thiết kế hệ thống xử lý giao dịch thời gian thực với throughput 10,000 req/s, giảm 40% độ trễ.
- Triển khai kiến trúc Event-driven microservices giúp scale độc lập 8 dịch vụ cốt lõi.
- Dẫn dắt team 6 kỹ sư, chuẩn hóa quy trình review code và kiểm thử tự động (Unit test coverage > 85%).`;
    } else if (presetType === "project") {
      title = "Kiến Trúc Dự Án AI Trực Tiếp (Mẫu Chuẩn)";
      content = `Tên dự án: AI Live Translator & Smart Answer Assistant.
Mục tiêu: Phiên dịch phụ đề thời gian thực từ âm thanh hệ thống và hỗ trợ gợi ý câu trả lời tức thì cho phỏng vấn/cuộc họp.
Công nghệ sử dụng:
- Audio Capture: Windows WASAPI Loopback 16kHz mono độ trễ cực thấp.
- Speech-To-Text: Local Whisper C++ với Voice Activity Detection (VAD) tối ưu năng lượng.
- Translation Engine: Gemini 1.5 Flash Cloud engine bảo tồn chuẩn xác 100% thuật ngữ kỹ thuật (Kubernetes, Docker, API, PR).
- Smart Answer Engine: RAG ngữ cảnh cục bộ đối chiếu với hồ sơ ứng viên để đề xuất 3 phong cách trả lời (Chuyên nghiệp, Ngắn gọn, Thân thiện).`;
    } else {
      title = "FAQ & Định Hướng Phỏng Vấn (Mẫu Chuẩn)";
      content = `Q: Điểm mạnh lớn nhất của bạn là gì?
A: Khả năng phân tích nguyên nhân gốc rễ và thiết kế hệ thống có tính mở rộng cao, dễ bảo trì lâu dài.

Q: Bạn xử lý bất đồng ý kiến trong team kỹ thuật như thế nào?
A: Tôi dựa vào dữ liệu thực tế, benchmark đo đạc và tài liệu kiến trúc (RFC/ADR) để thảo luận minh bạch trên tinh thần tôn trọng mục tiêu chung.

Q: Tại sao bạn muốn làm việc với công nghệ mới?
A: Tôi luôn đam mê tối ưu hiệu năng và ứng dụng AI để giải quyết các bài toán tự động hóa mang lại giá trị cao cho người dùng.`;
    }

    try {
      const newDoc = await invoke<KnowledgeDoc>("add_knowledge_doc", {
        title,
        content,
        docType,
      });
      addKnowledgeDocItem(newDoc);
    } catch (err) {
      console.error("Failed to load preset:", err);
    }
  };

  // Test question using current active knowledge
  const handleTestQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuestion.trim()) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const suggestion = await invoke<any>("generate_answer_manual", { context: testQuestion.trim() });
      setTestResult(suggestion);
    } catch (err) {
      console.error("Test failed:", err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVariant(key);
    setTimeout(() => setCopiedVariant(null), 2000);
  };

  const activeDocs = knowledgeDocs.filter((d) => d.is_active);
  const totalWords = activeDocs.reduce((acc, d) => acc + d.word_count, 0);

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto bg-slate-950 text-slate-100">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt,.md,.json,.csv"
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Tài Liệu & Ngữ Cảnh Tri Thức (Knowledge Base)
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Nạp CV, tài liệu dự án, hồ sơ kỹ năng hoặc câu hỏi FAQ của bạn. Khi AI nhận diện người nói đang đặt câu hỏi, hệ thống sẽ tự động dùng tài liệu này để đưa ra gợi ý câu trả lời chính xác 100% theo kinh nghiệm của bạn!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tải Tệp (.txt, .md, .json)</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Văn Bản Mới</span>
          </button>
        </div>
      </div>

      {/* AI Active Context Status Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Trạng Thái Bộ Gợi Ý AI Smart Answer
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Đang Áp Dụng
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Đang tham chiếu <strong className="text-indigo-300">{activeDocs.length} tài liệu</strong> ({totalWords} từ ngữ cảnh tri thức) để đối chiếu câu hỏi tự động.
            </p>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 px-2 font-medium">Nạp mẫu nhanh:</span>
          <button
            onClick={() => handleLoadPreset("resume")}
            className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            + Mẫu CV
          </button>
          <button
            onClick={() => handleLoadPreset("project")}
            className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            + Mẫu Dự Án
          </button>
          <button
            onClick={() => handleLoadPreset("faq")}
            className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            + Mẫu FAQ
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>Danh Sách Tài Liệu Tri Thức ({knowledgeDocs.length})</span>
        </h3>

        {knowledgeDocs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">Chưa có tài liệu tri thức nào</p>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
              Hãy tải lên CV hoặc văn bản mô tả kinh nghiệm, dự án để AI có thể hiểu rõ chuyên môn của bạn khi đưa ra câu trả lời.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleLoadPreset("resume")}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium border border-indigo-500/30"
              >
                Nạp Mẫu CV Thử Nghiệm
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
              >
                Nhập Văn Bản Của Bạn
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeDocs.map((doc) => {
              const isResume = doc.doc_type === "resume";
              const isProject = doc.doc_type === "project";
              const isFaq = doc.doc_type === "faq";
              const Icon = isResume ? Briefcase : isProject ? Layers : isFaq ? HelpCircle : FileText;

              return (
                <div
                  key={doc.id}
                  className={`rounded-2xl p-4 flex flex-col justify-between transition-all border ${
                    doc.is_active
                      ? "bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-950/20"
                      : "bg-slate-900/40 border-slate-800/80 opacity-60"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isResume
                              ? "bg-emerald-500/20 text-emerald-400"
                              : isProject
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                          {doc.doc_type}
                        </span>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        onClick={() => handleToggle(doc.id, doc.is_active)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                          doc.is_active
                            ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                            : "text-slate-400 bg-slate-800 hover:bg-slate-700"
                        }`}
                        title={doc.is_active ? "Nhấn để tạm dừng sử dụng tài liệu này" : "Nhấn để kích hoạt tài liệu này"}
                      >
                        {doc.is_active ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-400" />
                            <span>Bật</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-slate-500" />
                            <span>Tắt</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-white line-clamp-1">{doc.title}</h4>

                    {/* Snippet */}
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {doc.content}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{doc.word_count} từ</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewDoc(doc)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Xem toàn bộ nội dung"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemove(doc.id)}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Test Panel */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Thử Nghiệm Gợi Ý Câu Hỏi Trực Tiếp Từ Tài Liệu
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Nhập thử một câu hỏi phỏng vấn hoặc cuộc họp để xem AI tạo câu trả lời dựa trên kho tri thức đã nạp ở trên:
          </p>
        </div>

        <form onSubmit={handleTestQuestion} className="flex gap-2">
          <input
            type="text"
            value={testQuestion}
            onChange={(e) => setTestQuestion(e.target.value)}
            placeholder="Ví dụ: What is your experience with Kubernetes? hoặc Bạn đã từng xử lý sự cố nào khó khăn nhất?"
            className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isTesting || !testQuestion.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
          >
            {isTesting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Tạo Gợi Ý Thử</span>
              </>
            )}
          </button>
        </form>

        {/* Test Result Display */}
        {testResult && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300">
                Kết quả đề xuất dựa trên {activeDocs.length} tài liệu đang kích hoạt:
              </span>
              <button
                onClick={() => {
                  setLatestSuggestion(testResult);
                  setActiveTab("answers");
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Mở trong tab Smart Answer ➔
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {testResult.variants?.map((v: any) => (
                <div key={v.style} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-indigo-400">
                        {v.style}
                      </span>
                      <button
                        onClick={() => handleCopy(v.text_en, v.style)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                        title="Sao chép câu tiếng Anh"
                      >
                        {copiedVariant === v.style ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{v.text_en}</p>
                    <p className="text-[11px] text-amber-200/90 italic leading-relaxed pt-1 border-t border-white/5">
                      {v.text_vi}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Thêm Tài Liệu Tri Thức Mới
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDoc} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tiêu đề tài liệu
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kinh nghiệm làm việc tại Công ty ABC, Dự án E-commerce..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phân loại tài liệu
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="resume">Hồ sơ năng lực / CV (Resume)</option>
                  <option value="project">Dự án & Kiến trúc (Project)</option>
                  <option value="faq">Câu hỏi thường gặp (FAQ)</option>
                  <option value="notes">Ghi chú & Định hướng (Notes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nội dung chi tiết (Dán văn bản)
                </label>
                <textarea
                  required
                  rows={8}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Dán toàn bộ nội dung CV, các dự án, công nghệ, kỹ năng hoặc các trường hợp xử lý vấn đề của bạn vào đây..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Số từ: {newContent.split(/\s+/).filter(Boolean).length} từ
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  Lưu Vào Bộ Nhớ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {viewDoc.doc_type}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{viewDoc.title}</h3>
              </div>
              <button
                onClick={() => setViewDoc(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
              {viewDoc.content}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewDoc(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
