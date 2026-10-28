import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import {
  Radio,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Mic,
  ArrowDownCircle,
  Zap,
  Sparkles,
  FileText,
  Clock,
  Gauge,
  X,
  Languages,
} from "lucide-react";

export const SubtitlesFeed: React.FC = () => {
  const { subtitles, clearSubtitles, isCapturing } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "questions" | "tech">("all");

  // AI Meeting Minutes & Summary Modal state (Felo-inspired)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState<string>("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Session timer
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const endRef = useRef<HTMLDivElement>(null);

  // Count active capture time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCapturing) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCapturing]);

  // Format session timer HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Estimate total words & WPM (Words per minute)
  const totalWords = subtitles.reduce(
    (acc, s) => acc + (s.original_en ? s.original_en.trim().split(/\s+/).length : 0),
    0
  );
  const wpm = sessionSeconds > 10 ? Math.round((totalWords / sessionSeconds) * 60) : 0;

  // Auto-scroll to bottom on new subtitles if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [subtitles, autoScroll]);

  // Filter subtitles based on search query & filter tag
  const filteredSubtitles = subtitles.filter((sub) => {
    if (filterMode === "questions") {
      const isQ =
        sub.original_en.includes("?") ||
        /^(what|why|how|who|when|where|can you|could you|is there|do you)/i.test(sub.original_en.trim());
      if (!isQ) return false;
    } else if (filterMode === "tech") {
      const isTech = /(api|kubernetes|docker|cloud|aws|gcp|azure|git|database|sql|cluster|microservices|frontend|backend|sprint|bug)/i.test(
        sub.original_en
      );
      if (!isTech) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.original_en.toLowerCase().includes(q) ||
      sub.translated_vi.toLowerCase().includes(q) ||
      (sub.detected_lang && sub.detected_lang.toLowerCase().includes(q))
    );
  });

  // Copy individual subtitle
  const handleCopySingle = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Copy entire transcript
  const handleCopyAll = () => {
    const fullText = subtitles
      .map((s, i) => `[#${i + 1}] ${s.original_en}\n➔ ${s.translated_vi}`)
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Export transcript as .txt file (Bilingual)
  const handleExportTxt = () => {
    const fullText =
      `=== AI LIVE TRANSLATOR (FELO-INSPIRED) - NHẬT KÝ PHỤ ĐỀ PHIÊN DỊCH ===\n` +
      `Thời gian xuất: ${new Date().toLocaleString()}\n` +
      `Thời lượng phiên họp: ${formatTimer(sessionSeconds)}\n` +
      `Tổng số câu: ${subtitles.length} | Tổng số từ: ${totalWords}\n\n` +
      subtitles
        .map(
          (s, i) =>
            `[Câu #${i + 1} | ${s.detected_lang?.toUpperCase() || "EN"} -> VI]\nBản gốc: ${s.original_en}\nBản dịch: ${s.translated_vi}\n`
        )
        .join("\n----------------------------------------\n\n");

    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_transcript_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export standard .SRT subtitle file for VLC, Premiere, YouTube, CapCut
  const handleExportSrt = () => {
    if (subtitles.length === 0) return;

    const formatSrtTime = (ms: number) => {
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      const millis = ms % 1000;
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
    };

    let currentMs = 1000;
    const srtBlocks = subtitles
      .map((s, i) => {
        const wordCount = s.original_en.split(/\s+/).length;
        const duration = Math.max(2200, wordCount * 380);
        const startStr = formatSrtTime(currentMs);
        const endStr = formatSrtTime(currentMs + duration);
        currentMs += duration + 350;

        return `${i + 1}\n${startStr} --> ${endStr}\n${s.original_en}\n${s.translated_vi}\n`;
      })
      .join("\n");

    const blob = new Blob([srtBlocks], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_subtitles_${Date.now()}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate AI Meeting Summary (Felo Meeting Minutes)
  const handleGenerateSummary = async () => {
    if (subtitles.length === 0) {
      alert("Chưa có phụ đề nào để tóm tắt. Vui lòng nói hoặc mở âm thanh trước.");
      return;
    }
    setIsSummaryOpen(true);
    setIsSummarizing(true);
    setSummaryContent("");

    try {
      const transcriptText = subtitles
        .map((s, i) => `[#${i + 1}] (${s.detected_lang || "EN"}) ${s.original_en} -> ${s.translated_vi}`)
        .join("\n");

      const res: string = await invoke("summarize_meeting", { transcript: transcriptText });
      setSummaryContent(res || "Không thể tạo tóm tắt.");
    } catch (e: any) {
      setSummaryContent(`Lỗi khi tạo tóm tắt cuộc họp: ${e?.message || e}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Download Markdown summary report
  const handleDownloadSummaryMarkdown = () => {
    if (!summaryContent) return;
    const blob = new Blob([summaryContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting_minutes_ai_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full p-6 gap-4 overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Nhật Ký Phụ Đề Toàn Diện (Live Subtitles Feed)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30">
              Felo Style RRT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Nhận dạng giọng nói tự động song song với biên dịch thời gian thực và trích xuất biên bản họp thông minh.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Meeting Summary Button (Signature Felo Feature) */}
          <button
            onClick={handleGenerateSummary}
            disabled={subtitles.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
            title="Tóm tắt nội dung cuộc họp & Action Items bằng AI (Felo style)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Tóm Tắt Cuộc Họp AI</span>
          </button>

          {/* Export SRT Subtitles */}
          <button
            onClick={handleExportSrt}
            disabled={subtitles.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 hover:border-indigo-500/40 transition-all"
            title="Xuất file phụ đề chuẩn .SRT cho Premiere, YouTube, CapCut, VLC"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xuất .SRT</span>
          </button>

          {/* Export TXT */}
          <button
            onClick={handleExportTxt}
            disabled={subtitles.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 hover:border-indigo-500/40 transition-all"
            title="Xuất biên bản dạng file văn bản .TXT"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Xuất .TXT</span>
          </button>

          {/* Copy All */}
          <button
            onClick={handleCopyAll}
            disabled={subtitles.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-all"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? "Đã Sao Chép!" : "Sao Chép"}</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              autoScroll
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title={autoScroll ? "Tự động cuộn xuống câu mới nhất (Đang bật)" : "Bật tự động cuộn"}
          >
            <ArrowDownCircle className={`w-3.5 h-3.5 ${autoScroll ? "text-indigo-400" : ""}`} />
            <span>Tự Cuộn</span>
          </button>

          {/* Clear List */}
          <button
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử phụ đề hiện tại?")) {
                clearSubtitles();
              }
            }}
            disabled={subtitles.length === 0}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-500/20 transition-all"
            title="Xóa danh sách phụ đề"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meeting Analytics Bar (Felo Real-Time Stats) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Thời lượng ghi</div>
            <div className="text-sm font-bold text-white font-mono">{formatTimer(sessionSeconds)}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Tổng số câu</div>
            <div className="text-sm font-bold text-white font-mono">{subtitles.length} câu</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Tốc độ phát biểu</div>
            <div className="text-sm font-bold text-white font-mono">{wpm > 0 ? `${wpm} từ/phút` : "--"}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Ngôn ngữ đích</div>
            <div className="text-sm font-bold text-emerald-300 font-mono flex items-center gap-1.5">
              <span>🇻🇳 Tiếng Việt</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Tags Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 relative w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm từ khóa trong bản gốc tiếng Anh hoặc bản dịch tiếng Việt..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter tags: All, Questions, Tech keywords */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[
            { id: "all", label: "Tất cả" },
            { id: "questions", label: "❓ Câu hỏi" },
            { id: "tech", label: "⚡ Công nghệ" },
          ].map((tag) => (
            <button
              key={tag.id}
              onClick={() => setFilterMode(tag.id as any)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filterMode === tag.id
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitles Scrollable Feed */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 scroll-smooth">
        {filteredSubtitles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
            <Mic className="w-12 h-12 mb-3 opacity-30 text-indigo-400" />
            <p className="text-base font-medium text-slate-300">
              {searchQuery ? "Không tìm thấy phụ đề nào khớp với từ khóa" : "Chưa có phụ đề nào được ghi nhận"}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              {searchQuery
                ? "Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
                : "Bật âm thanh cuộc họp, video hoặc phim để hệ thống bắt đầu phiên dịch thời gian thực."}
            </p>
          </div>
        ) : (
          filteredSubtitles.map((sub, idx) => (
            <div
              key={sub.id || idx}
              className="group p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all space-y-2 relative"
            >
              {/* Card Meta Row */}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 font-semibold">#{idx + 1}</span>
                  {sub.detected_lang && (
                    <span className="font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold uppercase">
                      {sub.detected_lang} ➔ VI
                    </span>
                  )}
                  {sub.latency_ms !== undefined && sub.latency_ms > 0 && (
                    <span className="flex items-center gap-1 font-mono text-slate-500 text-[10px]">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {sub.latency_ms}ms
                    </span>
                  )}
                </div>

                {/* 1-click Copy button */}
                <button
                  onClick={() => handleCopySingle(sub.id, `${sub.original_en}\n${sub.translated_vi}`)}
                  className="p-1 rounded text-slate-400 hover:text-white opacity-40 group-hover:opacity-100 transition-opacity"
                  title="Sao chép câu này"
                >
                  {copiedId === sub.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Original Spoken Text */}
              <p className="text-sm font-medium text-slate-200 leading-snug">{sub.original_en}</p>

              {/* Vietnamese Translation (Golden Accent) */}
              <p className="text-sm font-semibold text-amber-300 leading-snug pt-1 border-t border-white/5">
                {sub.translated_vi}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* AI Meeting Summary Modal (Felo Meeting Minutes) */}
      {isSummaryOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Biên Bản & Tóm Tắt Cuộc Họp AI (Meeting Minutes)</h3>
                  <p className="text-[11px] text-slate-400">Trích xuất tự động các điểm thảo luận cốt lõi và hành động tiếp theo</p>
                </div>
              </div>
              <button
                onClick={() => setIsSummaryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-200 text-xs leading-relaxed">
              {isSummarizing ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-200">AI đang phân tích toàn bộ hội thoại và trích xuất biên bản họp...</p>
                  <p className="text-xs text-slate-500">Đang tổng hợp các chủ đề chính, câu hỏi và danh sách hành động (Action Items)</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none space-y-3">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 whitespace-pre-wrap font-sans text-slate-300">
                    {summaryContent}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {subtitles.length} câu hội thoại • Phân tích bởi Gemini AI / Local Engine
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(summaryContent);
                    setSummaryCopied(true);
                    setTimeout(() => setSummaryCopied(false), 2000);
                  }}
                  disabled={!summaryContent || isSummarizing}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
                >
                  {summaryCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{summaryCopied ? "Đã Sao Chép!" : "Sao Chép"}</span>
                </button>

                <button
                  onClick={handleDownloadSummaryMarkdown}
                  disabled={!summaryContent || isSummarizing}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Báo Cáo (.MD)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
