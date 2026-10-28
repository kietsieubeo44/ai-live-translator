import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import { Move, Minus, Maximize2, Sparkles, X, ExternalLink, Eye } from "lucide-react";

export const SubtitleOverlay: React.FC = () => {
  const {
    subtitles,
    interimTranscript,
    isOverlayCollapsed,
    toggleOverlayCollapse,
    isCapturing,
    latestSuggestion,
  } = useAppStore();

  // Opacity presets: 0.35, 0.60, 0.85, 0.95
  const opacities = [
    { label: "35%", bg: "bg-black/35 border-white/10" },
    { label: "60%", bg: "bg-black/60 border-white/15" },
    { label: "85%", bg: "bg-black/85 border-white/20" },
    { label: "95%", bg: "bg-black/95 border-white/25" },
  ];
  const [opacityIdx, setOpacityIdx] = useState(1); // default 60%

  // Font size scale: normal (14px/16px), large (16px/18px), extra large (18px/22px)
  const fontSizes = [
    { en: "text-xs", vi: "text-sm" },
    { en: "text-sm", vi: "text-base" },
    { en: "text-base", vi: "text-lg" },
    { en: "text-lg", vi: "text-xl" },
  ];
  const [fontSizeIdx, setFontSizeIdx] = useState(1);

  const currentSub = subtitles[subtitles.length - 1];
  const prevSub = subtitles.length > 1 ? subtitles[subtitles.length - 2] : null;

  const handleCloseOverlay = async () => {
    try {
      await invoke("hide_overlay_window");
    } catch (e) {
      console.warn("Failed to hide overlay window:", e);
    }
  };

  const handleOpenMainWindow = async () => {
    try {
      await invoke("show_main_window");
    } catch (e) {
      console.warn("Failed to show main window:", e);
    }
  };

  const cycleOpacity = () => {
    setOpacityIdx((prev) => (prev + 1) % opacities.length);
  };

  const increaseFontSize = () => {
    setFontSizeIdx((prev) => Math.min(fontSizes.length - 1, prev + 1));
  };

  const decreaseFontSize = () => {
    setFontSizeIdx((prev) => Math.max(0, prev - 1));
  };

  if (isOverlayCollapsed) {
    return (
      <div
        data-tauri-drag-region
        className={`w-full h-full flex items-center justify-between px-3 py-1.5 ${opacities[opacityIdx].bg} backdrop-blur-md rounded-xl cursor-move select-none border shadow-2xl`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isCapturing ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          <span className="text-xs font-semibold text-slate-200">AI Subtitles</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleOverlayCollapse}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Mở rộng"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCloseOverlay}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
            title="Đóng phụ đề"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tauri-drag-region
      className={`w-full h-full flex flex-col justify-between p-3 ${opacities[opacityIdx].bg} backdrop-blur-md rounded-2xl cursor-move select-none border shadow-2xl overflow-hidden`}
    >
      {/* Top Drag & Control Bar */}
      <div data-tauri-drag-region className="flex items-center justify-between text-xs text-slate-300 pb-1 border-b border-white/10">
        <div data-tauri-drag-region className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-indigo-400 opacity-80" />
          <span className="font-bold text-slate-200 tracking-wide text-[11px] uppercase">
            Phụ Đề Trực Tiếp (Subtitles)
          </span>
          {isCapturing && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Opacity Cycle */}
          <button
            onClick={cycleOpacity}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-[10px] text-slate-300 hover:text-white transition-colors border border-white/10"
            title="Độ trong suốt kính"
          >
            <Eye className="w-3 h-3 text-indigo-400" />
            <span>{opacities[opacityIdx].label}</span>
          </button>

          {/* Font Controls */}
          <div className="flex items-center bg-white/5 rounded border border-white/10 px-1">
            <button
              onClick={decreaseFontSize}
              disabled={fontSizeIdx === 0}
              className="px-1 text-[11px] font-bold text-slate-300 hover:text-white disabled:opacity-30"
              title="Giảm cỡ chữ"
            >
              A-
            </button>
            <span className="text-[10px] text-slate-500 px-0.5">|</span>
            <button
              onClick={increaseFontSize}
              disabled={fontSizeIdx === fontSizes.length - 1}
              className="px-1 text-[11px] font-bold text-slate-300 hover:text-white disabled:opacity-30"
              title="Tăng cỡ chữ"
            >
              A+
            </button>
          </div>

          {/* Return to Main App */}
          <button
            onClick={handleOpenMainWindow}
            className="p-1 rounded hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors border border-indigo-500/20"
            title="Mở ứng dụng chính"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Collapse Overlay */}
          <button
            onClick={toggleOverlayCollapse}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Thu nhỏ thanh phụ đề"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close Overlay Window */}
          <button
            onClick={handleCloseOverlay}
            className="p-1 rounded hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 transition-colors"
            title="Ẩn cửa sổ phụ đề"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bilingual Subtitle Content Display */}
      <div className="flex-1 flex flex-col justify-center py-1.5 space-y-1 overflow-hidden">
        {/* Previous Subtitle context if present */}
        {prevSub && (
          <p className="text-[11px] text-slate-400/80 truncate leading-tight drop-shadow">
            <span className="italic">{prevSub.original_en}</span> • <span className="text-amber-200/80">{prevSub.translated_vi}</span>
          </p>
        )}

        {/* Current English Original */}
        <p className={`${fontSizes[fontSizeIdx].en} font-medium text-white leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}>
          {interimTranscript ? (
            <span className="italic text-slate-200">{interimTranscript}</span>
          ) : currentSub ? (
            currentSub.original_en
          ) : (
            <span className="text-slate-400/80 text-xs italic">
              Đang nghe âm thanh hệ thống... (Sẵn sàng hiển thị phụ đề khi có tiếng nói)
            </span>
          )}
        </p>

        {/* Current Vietnamese Translation (Golden Accent) */}
        {currentSub && (
          <p className={`${fontSizes[fontSizeIdx].vi} font-bold text-amber-300 leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]`}>
            {currentSub.translated_vi}
          </p>
        )}
      </div>

      {/* Optional AI Smart Answer Prompt Banner */}
      {latestSuggestion && (
        <div className="pt-1 flex items-center justify-between border-t border-white/5 text-[11px]">
          <span className="flex items-center gap-1 text-amber-300 font-semibold truncate">
            <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span>Gợi ý trả lời:</span>
            <span className="text-white font-normal truncate">{latestSuggestion.primary_answer_en}</span>
          </span>
          <button
            onClick={handleOpenMainWindow}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline ml-2 flex-shrink-0"
          >
            Xem chi tiết
          </button>
        </div>
      )}
    </div>
  );
};
