import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

export const SubtitlesFeed: React.FC = () => {
  const { subtitles, clearSubtitles, isCapturing } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new subtitles if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [subtitles, autoScroll]);

  // Filter subtitles based on search query
  const filteredSubtitles = subtitles.filter((sub) => {
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
      .map(
        (s, i) =>
          `[#${i + 1}] ${s.original_en}\n➔ ${s.translated_vi}`
      )
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Export transcript as .txt file
  const handleExportTxt = () => {
    const fullText = `=== AI LIVE TRANSLATOR - NHẬT KÝ PHỤ ĐỀ PHIÊN DỊCH ===\nThời gian xuất: ${new Date().toLocaleString()}\nTổng số câu: ${subtitles.length}\n\n` +
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
    link.download = `ai_live_transcript_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full p-6 gap-5 overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-indigo-400" />
            Nhật Ký Phụ Đề Toàn Diện (Live Subtitles Feed)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Toàn bộ nội dung hội thoại được nhận dạng giọng nói tự động và biên dịch sang Tiếng Việt chuẩn xác theo thời gian thực.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
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
            <span>Tự Cuộn: {autoScroll ? "Bật" : "Tắt"}</span>
          </button>

          {/* Copy All */}
          <button
            onClick={handleCopyAll}
            disabled={subtitles.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-all"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? "Đã Sao Chép!" : "Sao Chép Hết"}</span>
          </button>

          {/* Export File */}
          <button
            onClick={handleExportTxt}
            disabled={subtitles.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-all"
            title="Xuất file văn bản .txt"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Xuất .TXT</span>
          </button>

          {/* Clear List */}
          <button
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử phụ đề hiện tại?")) {
                clearSubtitles();
              }
            }}
            disabled={subtitles.length === 0}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 border border-rose-500/20 transition-all"
            title="Xóa danh sách phụ đề"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm từ khóa trong bản gốc hoặc bản dịch tiếng Việt..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="font-mono bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            {filteredSubtitles.length} / {subtitles.length} câu
          </span>
          {isCapturing && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Đang Thu Âm
            </span>
          )}
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
                  <span className="font-mono text-slate-400 font-semibold">
                    #{idx + 1}
                  </span>
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
                  onClick={() =>
                    handleCopySingle(sub.id, `${sub.original_en}\n${sub.translated_vi}`)
                  }
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
              <p className="text-sm font-medium text-slate-200 leading-snug">
                {sub.original_en}
              </p>

              {/* Vietnamese Translation (Golden Accent) */}
              <p className="text-sm font-semibold text-amber-300 leading-snug pt-1 border-t border-white/5">
                {sub.translated_vi}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
