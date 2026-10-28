import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import { Mic, MicOff, Volume2, Sparkles, Languages, Activity, Radio, Tv, Cpu, Check } from "lucide-react";

export const Dashboard: React.FC = () => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const subtitlesEndRef = React.useRef<HTMLDivElement>(null);
  const [activeModel, setActiveModel] = useState("base.en");
  const [translationEngine, setTranslationEngine] = useState("gemini");
  const [overlayActive, setOverlayActive] = useState(false);

  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isCapturing,
    setIsCapturing,
    audioPeakDbfs,
    subtitles,
    latestSuggestion,
    setActiveTab,
  } = useAppStore();

  useEffect(() => {
    invoke("get_active_model")
      .then((m: any) => {
        if (m) setActiveModel(m);
      })
      .catch(console.warn);

    const savedEngine = localStorage.getItem("translation_engine") || "gemini";
    setTranslationEngine(savedEngine);
    invoke("set_translation_engine", { engine: savedEngine }).catch(console.warn);
  }, []);

  const handleSelectModel = async (model: string) => {
    try {
      const updated: any = await invoke("set_active_model", { modelName: model });
      setActiveModel(updated || model);
    } catch (e) {
      console.error("Failed to switch model:", e);
    }
  };

  const handleSelectEngine = async (engine: string) => {
    try {
      setTranslationEngine(engine);
      localStorage.setItem("translation_engine", engine);
      await invoke("set_translation_engine", { engine });
    } catch (e) {
      console.error("Failed to switch translation engine:", e);
    }
  };

  const handleToggleOverlay = async () => {
    try {
      const isNowVisible: any = await invoke("toggle_overlay_window");
      setOverlayActive(!!isNowVisible);
    } catch (e) {
      console.error("Failed to toggle overlay window:", e);
    }
  };

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    subtitlesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [subtitles]);

  const handleToggleCapture = async () => {
    try {
      if (isCapturing) {
        console.log("[Dashboard] Stopping capture...");
        await invoke("stop_capture");
        setIsCapturing(false);
      } else {
        console.log("[Dashboard] Starting capture for device:", selectedDeviceId);
        await invoke("start_capture", {
          deviceId: selectedDeviceId,
        });
        setIsCapturing(true);
      }
    } catch (e: any) {
      console.error("[Dashboard] Capture toggle failed:", e);
      alert(`Could not start audio capture: ${e?.message || e}`);
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6">
      {/* Top Header & Status Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Languages className="w-6 h-6" />
            </span>
            AI Live Translator & Smart Answer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time WASAPI loopback capture • Local whisper.cpp • Instant Vietnamese translation
          </p>
        </div>

        {/* Global Status Pill */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isCapturing
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isCapturing ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
            {isCapturing ? "LISTENING TO SYSTEM AUDIO" : "AUDIO CAPTURE STOPPED"}
          </div>

          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            🔒 100% Local First
          </div>
        </div>
      </div>

      {/* Quick Action Toolbar: Transparent Overlay Button & AI Model Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOverlay}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
              overlayActive
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 border border-amber-400"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 border border-indigo-400/30 hover:scale-[1.02]"
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>{overlayActive ? "📺 Đang Bật Phụ Đề Nổi (Bấm để Ẩn)" : "📺 Bật Cửa Sổ Phụ Đề Nổi Trong Suốt"}</span>
          </button>
          <button
            onClick={() => setActiveTab("subtitles")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-purple-200 border border-purple-500/30 transition-all"
            title="Xem toàn bộ phụ đề và tóm tắt cuộc họp bằng AI (Felo style)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Felo Feed & Tóm Tắt AI</span>
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline">
            (Cửa sổ trong suốt ghim trên màn hình, xem cùng lúc với video/meeting)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Whisper STT Model Selector */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 px-2 font-medium">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Whisper STT:
            </span>
            <button
              onClick={() => handleSelectModel("base.en")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeModel === "base.en"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Độ chính xác cao, nhận diện tốt ngữ âm tiếng Anh"
            >
              {activeModel === "base.en" && <Check className="w-3 h-3 text-white" />}
              Base (Chuẩn)
            </button>
            <button
              onClick={() => handleSelectModel("tiny.en")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeModel === "tiny.en"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Tốc độ dịch siêu nhanh, tốn rất ít CPU/RAM"
            >
              {activeModel === "tiny.en" && <Check className="w-3 h-3 text-white" />}
              Tiny (Nhanh)
            </button>
          </div>

          {/* Translation Engine Selector */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 px-2 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Bộ Dịch:
            </span>
            <button
              onClick={() => handleSelectEngine("gemini")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                translationEngine === "gemini"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Dịch hoàn toàn bằng AI Gemini 1.5 Flash (Hiểu ngữ cảnh meeting, tự nhiên)"
            >
              {translationEngine === "gemini" && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
              ✨ Gemini AI (Cloud Pro)
            </button>
            <button
              onClick={() => handleSelectEngine("google")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                translationEngine === "google"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Dịch nhanh bằng Google Auto-Detect (Cơ bản, không cần key)"
            >
              {translationEngine === "google" && <Check className="w-3 h-3 text-white" />}
              ⚡ Google Auto
            </button>
          </div>
        </div>
      </div>

      {/* Hero Control Card: Audio Source & Big Start/Stop Button */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800/80">
        <div className="flex-1 space-y-4 w-full">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Windows Output Audio Device (Loopback)
            </label>
            <span className="text-xs text-slate-500">Auto-detects headphones & speakers</span>
          </div>

          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={isCapturing}
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          >
            <option value="default">Default Playback Device (Recommended)</option>
            {devices.map((d, i) => (
              <option key={d.id || i} value={d.id}>
                {d.name} {d.is_default ? "(Default)" : ""} — {d.channels}ch {d.sample_rate}Hz
              </option>
            ))}
          </select>

          {/* Real-time Audio Level Meter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                PCM Signal Level
              </span>
              <span className="font-mono text-slate-300">
                {isCapturing ? `${audioPeakDbfs.toFixed(1)} dBFS` : "-- dBFS"}
              </span>
            </div>

            <div className="w-full h-3 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  audioPeakDbfs > -6 ? "bg-red-500" : audioPeakDbfs > -18 ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{
                  width: isCapturing ? `${Math.min(100, Math.max(2, (audioPeakDbfs + 60) * 1.66))}%` : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Master Start / Stop Action Button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleToggleCapture}
            className={`relative group px-8 py-5 rounded-2xl font-bold text-base flex items-center gap-3 transition-all duration-300 shadow-xl ${
              isCapturing
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02]"
            }`}
          >
            {isCapturing ? (
              <>
                <MicOff className="w-6 h-6 animate-pulse" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                <span>Start Listening</span>
              </>
            )}
          </button>
          <span className="text-xs text-slate-400 font-medium">
            {isCapturing ? "Capturing active sound" : "Click to start live translation"}
          </span>
        </div>
      </div>

      {/* Main Grid: Live Subtitle Feed & Smart Answer Preview */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: Live Subtitles Stream (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              Live Bilingual Subtitles
            </h2>
            <button
              onClick={() => setActiveTab("subtitles")}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View Full History →
            </button>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-3 pt-3 pr-2 scroll-smooth">
            {subtitles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
                <Mic className="w-8 h-8 mb-2 opacity-40" />
                <p>No speech detected yet.</p>
                <p className="text-xs text-slate-600">Play any English video or meeting to see live translation.</p>
              </div>
            ) : (
              <>
                {subtitles.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-1.5"
                  >
                    <p className="text-sm font-medium text-slate-100 leading-snug">
                      {sub.original_en}
                    </p>
                    <p className="text-sm font-semibold text-amber-300/90 leading-snug">
                      {sub.translated_vi}
                    </p>
                    {sub.latency_ms !== undefined && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        ⚡ {sub.latency_ms}ms latency
                      </span>
                    )}
                  </div>
                ))}
                <div ref={subtitlesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Right Column: AI Smart Answer Assistant Card (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Smart Answer Assistant
            </h2>
            <button
              onClick={() => setActiveTab("answers")}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              Expand Panel →
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 space-y-4">
            {latestSuggestion ? (
              <div className="space-y-4">
                {/* Detected Question Banner */}
                <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      Detected Question ({latestSuggestion.question.question_type})
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300">
                      {(latestSuggestion.question.confidence * 100).toFixed(0)}% Match
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    "{latestSuggestion.question.question_text}"
                  </p>
                </div>

                {/* Suggested Answer Box */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Suggested Response (English)
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(latestSuggestion.primary_answer_en)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed font-normal">
                    {latestSuggestion.primary_answer_en}
                  </p>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-xs font-semibold text-slate-400">Vietnamese Meaning:</span>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      {latestSuggestion.primary_answer_vi}
                    </p>
                  </div>
                </div>

                {/* Manual Trigger Option */}
                <button
                  onClick={() => setActiveTab("answers")}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition-all border border-slate-700/50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  View All Styles (Concise, Friendly, Professional)
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
                <Sparkles className="w-8 h-8 mb-2 opacity-40" />
                <p>Waiting for questions in the conversation...</p>
                <p className="text-xs text-slate-600 text-center mt-1">
                  Questions directed to you will automatically generate smart answer suggestions here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
