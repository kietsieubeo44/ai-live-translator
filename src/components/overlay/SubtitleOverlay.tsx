import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { Move, Minus, Maximize2, Sparkles, Volume2 } from "lucide-react";

export const SubtitleOverlay: React.FC = () => {
  const {
    subtitles,
    interimTranscript,
    isOverlayCollapsed,
    toggleOverlayCollapse,
    isCapturing,
    latestSuggestion,
  } = useAppStore();

  const currentSub = subtitles[subtitles.length - 1];

  if (isOverlayCollapsed) {
    return (
      <div
        data-tauri-drag-region
        className="w-full h-full flex items-center justify-between px-4 py-2 glass-overlay rounded-xl cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isCapturing ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          <span className="text-xs font-semibold text-slate-200">AI Subtitles</span>
        </div>
        <button
          onClick={toggleOverlayCollapse}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full flex flex-col justify-between p-3.5 glass-overlay rounded-2xl cursor-move select-none border border-indigo-500/30 overflow-hidden"
    >
      {/* Top Drag & Control Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-indigo-400 opacity-60" />
          <span className="font-semibold text-slate-300 tracking-wide text-[11px] uppercase">
            Live Subtitles
          </span>
          {isCapturing && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {latestSuggestion && (
            <button
              onClick={() => alert(`Suggested Answer: ${latestSuggestion.primary_answer_en}`)}
              className="flex items-center gap-1 text-[11px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-0.5 rounded-full transition-colors border border-amber-500/30"
            >
              <Sparkles className="w-3 h-3" />
              AI Answer Ready
            </button>
          )}

          <button
            onClick={toggleOverlayCollapse}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Collapse Overlay"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bilingual Subtitle Content Display */}
      <div className="flex-1 flex flex-col justify-center py-1 space-y-1">
        {/* English Original */}
        <p className="text-sm font-medium text-slate-100 leading-snug drop-shadow-sm">
          {interimTranscript ? (
            <span className="italic text-slate-300">{interimTranscript}</span>
          ) : currentSub ? (
            currentSub.original_en
          ) : (
            <span className="text-slate-500 text-xs">Waiting for speech...</span>
          )}
        </p>

        {/* Vietnamese Translation (Golden Accent) */}
        <p className="text-sm font-bold text-amber-300 leading-snug drop-shadow-sm">
          {currentSub ? currentSub.translated_vi : ""}
        </p>
      </div>
    </div>
  );
};
