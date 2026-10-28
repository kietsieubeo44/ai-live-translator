import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { Move, Minus, Maximize2, Sparkles, X, ExternalLink, Eye } from "lucide-react";

// ---------------------------------------------------------------------------
// Payload types for Tauri events
// ---------------------------------------------------------------------------

interface BilingualSubtitlePayload {
  id: number;
  original_en: string;
  translated_vi: string;
  detected_lang?: string;
  is_final: boolean;
  latency_ms: number;
}

interface AnswerSuggestionPayload {
  id: number;
  question: { question_text: string; question_type: string; confidence: number };
  primary_answer_en: string;
  primary_answer_vi: string;
  variants: Array<{ style: string; text_en: string; text_vi: string }>;
  is_manual: boolean;
}

// ---------------------------------------------------------------------------
// Deduplication helper
// ---------------------------------------------------------------------------

/** Strip punctuation and lowercase a string for comparison. */
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

const MAX_SUBTITLES = 50;
const DEDUP_WINDOW = 3;

function deduplicatedAdd(
  prev: BilingualSubtitlePayload[],
  incoming: BilingualSubtitlePayload
): BilingualSubtitlePayload[] {
  const tail = prev.slice(-DEDUP_WINDOW);
  const normIncoming = normalise(incoming.original_en);
  const isDuplicate = tail.some((s) => normalise(s.original_en) === normIncoming);
  if (isDuplicate) return prev;
  const next = [...prev, incoming];
  return next.length > MAX_SUBTITLES ? next.slice(next.length - MAX_SUBTITLES) : next;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SubtitleOverlay: React.FC = () => {
  // ── Local data state (replaces Zustand reads) ────────────────────────────
  const [subtitles, setSubtitles] = useState<BilingualSubtitlePayload[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [latestSuggestion, setLatestSuggestion] = useState<AnswerSuggestionPayload | null>(null);

  // ── UI-only state (fully local — store is isolated in this WebView) ───────
  const [isOverlayCollapsed, setIsOverlayCollapsed] = useState(false);
  const toggleOverlayCollapse = () => setIsOverlayCollapsed((v) => !v);

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

  // Size Presets for quick 1-click window resizing
  const sizePresets = [
    { label: "S", w: 650, h: 140, title: "Nhỏ (650 × 140 px)" },
    { label: "M", w: 800, h: 180, title: "Vừa (800 × 180 px - Chuẩn)" },
    { label: "L", w: 1020, h: 240, title: "Lớn (1020 × 240 px)" },
    { label: "XL", w: 1300, h: 300, title: "Cực đại (1300 × 300 px)" },
  ];
  const [activePreset, setActivePreset] = useState<string>("M");

  // ── Tauri event subscriptions ────────────────────────────────────────────
  // Keep a ref to the latest subtitles list so the event closure always sees
  // fresh state without needing to be re-registered on every render.
  const subtitlesRef = useRef<BilingualSubtitlePayload[]>([]);
  subtitlesRef.current = subtitles;

  useEffect(() => {
    // --- bilingual-subtitle ---
    const unlistenSubtitle = listen<BilingualSubtitlePayload>(
      "bilingual-subtitle",
      (event) => {
        const payload = event.payload;
        if (!payload.is_final) {
          // Treat non-final segments as interim transcript
          setInterimTranscript(payload.original_en);
          return;
        }
        // Final segment: clear interim, deduplicate, then append
        setInterimTranscript("");
        setIsCapturing(true);
        setSubtitles((prev) => deduplicatedAdd(prev, payload));
      }
    );

    // --- audio-level ---
    // Use audio-level bursts as a proxy for "is currently capturing"
    const unlistenAudioLevel = listen<number>("audio-level", (event) => {
      // Any non-zero RMS means the capture session is active
      setIsCapturing(event.payload > 0);
    });

    // --- answer-suggestion ---
    const unlistenSuggestion = listen<AnswerSuggestionPayload>(
      "answer-suggestion",
      (event) => {
        setLatestSuggestion(event.payload);
      }
    );

    // Cleanup: unlisten all on unmount
    return () => {
      unlistenSubtitle.then((fn) => fn());
      unlistenAudioLevel.then((fn) => fn());
      unlistenSuggestion.then((fn) => fn());
    };
  }, []); // run once — closures use refs/setState which are stable

  // ── Derived display values ───────────────────────────────────────────────
  const currentSub = subtitles[subtitles.length - 1];
  const prevSub = subtitles.length > 1 ? subtitles[subtitles.length - 2] : null;

  // ── Window Drag Handler ──────────────────────────────────────────────────
  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], .no-drag, .resize-handle')) {
      return;
    }
    e.preventDefault();
    try {
      getCurrentWindow().startDragging().catch(() => {
        invoke("start_overlay_dragging").catch(console.warn);
      });
    } catch {
      invoke("start_overlay_dragging").catch(console.warn);
    }
  };

  // ── Window Resize Drag Handler (frameless edge / corner drag) ───────────
  const handleResizeStart = (
    e: React.MouseEvent,
    direction: "East" | "South" | "SouthEast" | "SouthWest" | "West"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      getCurrentWindow().startResizeDragging(direction).catch((err) => {
        console.warn("startResizeDragging failed:", err);
      });
    } catch (err) {
      console.warn("startResizeDragging error:", err);
    }
  };

  // ── Apply Quick Preset Size ───────────────────────────────────────────────
  const handleSetPresetSize = async (w: number, h: number, label: string) => {
    setActivePreset(label);
    try {
      await getCurrentWindow().setSize(new LogicalSize(w, h));
    } catch {
      await invoke("resize_overlay_window", { width: w, height: h }).catch(console.warn);
    }
  };

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

  // ── Collapsed mini-bar view ──────────────────────────────────────────────
  if (isOverlayCollapsed) {
    return (
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className={`w-full h-full flex items-center justify-between px-3 py-1.5 ${opacities[opacityIdx].bg} backdrop-blur-md rounded-xl cursor-move select-none border shadow-2xl`}
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-indigo-400 opacity-80" />
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

  // ── Full overlay view ────────────────────────────────────────────────────
  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleStartDrag}
      className={`relative w-full h-full flex flex-col justify-between p-3 ${opacities[opacityIdx].bg} backdrop-blur-md rounded-2xl select-none border shadow-2xl overflow-hidden`}
    >
      {/* Edge & Corner Resize Drag Zones */}
      {/* Right Edge */}
      <div
        className="resize-handle absolute top-0 right-0 w-2.5 h-full cursor-e-resize z-30"
        title="Kéo cạnh phải để đổi chiều rộng"
        onMouseDown={(e) => handleResizeStart(e, "East")}
      />
      {/* Bottom Edge */}
      <div
        className="resize-handle absolute bottom-0 left-0 h-2.5 w-full cursor-s-resize z-30"
        title="Kéo cạnh dưới để đổi chiều cao"
        onMouseDown={(e) => handleResizeStart(e, "South")}
      />
      {/* Left Edge */}
      <div
        className="resize-handle absolute top-0 left-0 w-2.5 h-full cursor-w-resize z-30"
        title="Kéo cạnh trái để đổi chiều rộng"
        onMouseDown={(e) => handleResizeStart(e, "West")}
      />
      {/* Bottom-Left Corner */}
      <div
        className="resize-handle absolute bottom-0 left-0 w-3.5 h-3.5 cursor-sw-resize z-30"
        onMouseDown={(e) => handleResizeStart(e, "SouthWest")}
      />
      {/* Bottom-Right Corner Visual Grip Handle */}
      <div
        className="resize-handle absolute bottom-0.5 right-0.5 w-6 h-6 flex items-end justify-end cursor-se-resize p-1 z-30 group"
        title="Kéo góc này để tùy chỉnh kích cỡ cửa sổ tự do"
        onMouseDown={(e) => handleResizeStart(e, "SouthEast")}
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400/60 group-hover:text-amber-300 group-hover:scale-110 transition-all drop-shadow"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="13" cy="13" r="1.5" />
          <circle cx="13" cy="8.5" r="1.5" />
          <circle cx="8.5" cy="13" r="1.5" />
          <circle cx="13" cy="4" r="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <circle cx="4" cy="13" r="1.5" />
        </svg>
      </div>

      {/* Top Drag & Control Bar */}
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className="flex items-center justify-between text-xs text-slate-300 pb-1.5 border-b border-white/10 cursor-move"
      >
        {/* Drag Icon & Title */}
        <div data-tauri-drag-region className="flex items-center gap-2">
          <div
            data-tauri-drag-region
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 cursor-grab active:cursor-grabbing"
            title="Nhấn giữ và kéo để di chuyển vị trí cửa sổ"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-200 tracking-wide text-[11px] uppercase">
              Phụ Đề Trực Tiếp
            </span>
          </div>
          {isCapturing && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          )}
          {currentSub?.detected_lang && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              {currentSub.detected_lang} → VI
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Quick Size Presets: S, M, L, XL */}
          <div
            className="flex items-center bg-white/5 rounded border border-white/10 p-0.5"
            title="Kích cỡ cửa sổ phụ đề"
          >
            <span className="text-[10px] text-slate-400 px-1 font-mono">Cỡ:</span>
            {sizePresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleSetPresetSize(preset.w, preset.h, preset.label)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                  activePreset === preset.label
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title={preset.title}
              >
                {preset.label}
              </button>
            ))}
          </div>

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
      <div
        data-tauri-drag-region
        onMouseDown={handleStartDrag}
        className="flex-1 flex flex-col justify-center py-1.5 space-y-1 overflow-hidden cursor-move"
      >
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
