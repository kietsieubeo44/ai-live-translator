import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import { Settings as SettingsIcon, Shield, Cpu, Volume2, Trash2, CheckCircle2, Sparkles, Zap } from "lucide-react";

export const SettingsModal: React.FC = () => {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    clearSubtitles,
  } = useAppStore();

  const [selectedModel, setSelectedModel] = useState("base.en");
  const [clearedNotice, setClearedNotice] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [engineMode, setEngineMode] = useState("gemini");
  const [testPhrase, setTestPhrase] = useState("I believe Huang is in middle of the preparation for Kubernetes deployment.");
  const [testResult, setTestResult] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gemini_api_key") || "";
    setGeminiApiKey(saved);
    if (saved) {
      invoke("set_gemini_api_key", { key: saved }).catch(console.error);
    }
    const savedEngine = localStorage.getItem("translation_engine") || "gemini";
    setEngineMode(savedEngine);
    invoke("set_translation_engine", { engine: savedEngine }).catch(console.error);

    invoke("get_active_model")
      .then((m: any) => {
        if (m) setSelectedModel(m);
      })
      .catch(console.warn);
  }, []);

  const handleSelectEngine = async (engine: string) => {
    try {
      setEngineMode(engine);
      localStorage.setItem("translation_engine", engine);
      await invoke("set_translation_engine", { engine });
    } catch (e) {
      console.error("Failed to set translation engine:", e);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    try {
      setSelectedModel(modelId);
      await invoke("set_active_model", { modelName: modelId });
    } catch (e) {
      console.error("Failed to set active model:", e);
    }
  };

  const handleSaveGeminiKey = async () => {
    try {
      localStorage.setItem("gemini_api_key", geminiApiKey);
      await invoke("set_gemini_api_key", { key: geminiApiKey });
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2500);
    } catch (e) {
      console.error("Failed to save Gemini key:", e);
    }
  };

  const handleTestTranslation = async () => {
    if (!testPhrase.trim()) return;
    setIsTranslating(true);
    setTestResult("");
    setTestStatus("idle");
    try {
      if (engineMode === "gemini") {
        if (!geminiApiKey.trim()) {
          setTestResult("Vui lòng nhập Gemini API Key ở ô phía trên trước khi thử nghiệm.");
          setTestStatus("error");
          setIsTranslating(false);
          return;
        }
        await invoke("set_gemini_api_key", { key: geminiApiKey });
      }
      const res: any = await invoke("translate_text", { text: testPhrase });
      setTestResult(res?.translated_vi || "Không có kết quả");
      setTestStatus("success");
    } catch (e: any) {
      setTestResult(`Lỗi: ${e?.message || e}`);
      setTestStatus("error");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClearHistory = () => {
    clearSubtitles();
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <SettingsIcon className="w-5 h-5 text-indigo-400" />
          Application Settings & Translation Engine
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure audio loopback, local whisper.cpp model, bilingual translation quality, and privacy.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Section 1: Translation Engine Selection */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Bộ Dịch Phụ Đề (Translation Engine)
            </h3>
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
              engineMode === "gemini"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
            }`}>
              {engineMode === "gemini" ? "✨ Đang Dùng AI Gemini" : "⚡ Google Auto-Detect"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Chọn bộ máy dịch theo ý muốn. Bạn có thể chuyển hẳn sang dùng 100% Google Gemini AI qua API Key để có chất lượng dịch chuẩn văn phong hội thoại cao nhất.
          </p>

          {/* Engine Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => handleSelectEngine("google")}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                engineMode === "google"
                  ? "bg-indigo-600/20 border-indigo-400 shadow-lg shadow-indigo-600/10 text-white ring-1 ring-indigo-400/50"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Họp Trực Tiếp Real-Time (Direct Meeting)
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  engineMode === "google" ? "bg-emerald-400 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
                }`}>
                  {engineMode === "google" ? "✓ ĐANG DÙNG CHO HỌP" : "Khuyên dùng cho Họp"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Dịch trực tiếp lời nói trong cuộc họp Zoom/Teams/Meet qua bộ engine Chrome-Dict và từ điển kỹ thuật. Tốc độ siêu tốc &lt;25ms, không giật lag, nói đến đâu hiện chữ đến đó.
              </p>
            </div>

            <div
              onClick={() => handleSelectEngine("gemini")}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                engineMode === "gemini"
                  ? "bg-amber-500/15 border-amber-400/80 shadow-lg shadow-amber-500/10 text-white ring-1 ring-amber-400/50"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Google Gemini 1.5 Flash (Cloud Pro)
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  engineMode === "gemini" ? "bg-amber-400 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
                }`}>
                  {engineMode === "gemini" ? "✓ ĐANG KÍCH HOẠT" : "Chuyên sâu"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Dịch bằng trí tuệ nhân tạo Gemini qua Cloud. Thích hợp khi nghe bài giảng, đọc hiểu tài liệu phức tạp cần phân tích ngữ pháp sâu.
              </p>
            </div>
          </div>

          {/* Gemini API Key Configuration Box */}
          <div className={`p-4 rounded-xl space-y-3 transition-all ${
            engineMode === "gemini"
              ? "bg-amber-950/20 border border-amber-500/30"
              : "bg-slate-900/60 border border-slate-800"
          }`}>
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Google Gemini API Key:
              </span>
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-amber-400 hover:text-amber-300 underline"
              >
                Lấy Key miễn phí tại Google AI Studio ↗
              </a>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy... (Dán key Gemini của bạn vào đây)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSaveGeminiKey}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md"
              >
                {keySaved ? "Đã Lưu Key!" : "Lưu Key"}
              </button>
            </div>
            {engineMode === "gemini" && !geminiApiKey && (
              <p className="text-[11px] text-amber-300/90 font-medium">
                ⚠️ Chế độ Gemini AI đang bật: Hãy dán key vào ô trên và bấm "Lưu Key" để AI bắt đầu dịch.
              </p>
            )}

            {/* Test Translation Box */}
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Thử nghiệm dịch thực tế (Test):</span>
                <button
                  onClick={handleTestTranslation}
                  disabled={isTranslating}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
                >
                  {isTranslating ? "Đang dịch..." : "Dịch Thử Nghiệm"}
                </button>
              </div>
              <input
                type="text"
                value={testPhrase}
                onChange={(e) => setTestPhrase(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              />
              {testResult && (
                <div className={`p-2.5 rounded-lg text-xs font-medium border ${
                  testStatus === "error"
                    ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                    : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                }`}>
                  {testStatus === "error" ? "❌ " : "🇻🇳 "}
                  <span className="font-semibold text-white">{testResult}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Audio Device */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            Audio Capture Device (WASAPI Loopback)
          </h3>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Select output stream to listen to:</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="default">Windows Default Render Endpoint (Recommended)</option>
              {devices.map((d, i) => (
                <option key={d.id || i} value={d.id}>
                  {d.name} {d.is_default ? "(System Default)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Captures all system audio, including wired and Bluetooth headphones, without requiring virtual audio cables.
            </p>
          </div>
        </div>

        {/* Section 3: Speech-To-Text Model */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Local Speech-To-Text (whisper.cpp)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: "tiny.en",
                title: "Tiny (39 MB)",
                desc: "Fastest response, lowest RAM/CPU. Ideal for battery saver mode.",
                badge: "Ultralight",
              },
              {
                id: "base.en",
                title: "Base (74 MB)",
                desc: "Recommended. Balanced latency and accuracy for Indian English.",
                badge: "Active Default",
              },
              {
                id: "small.en",
                title: "Small (244 MB)",
                desc: "Highest accuracy for heavy accents and technical jargon.",
                badge: "GPU Optimal",
              },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => handleModelSelect(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
                  selectedModel === m.id
                    ? "bg-indigo-600/25 border-indigo-400 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{m.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    selectedModel === m.id ? "bg-indigo-500 text-white font-bold" : "bg-slate-800 text-indigo-400"
                  }`}>
                    {selectedModel === m.id ? "✓ Đang kích hoạt" : m.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Privacy & Data Retention */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Zero Audio Storage Policy
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-slate-200">Zero Audio Storage Verified</p>
                <p className="text-slate-400">
                  Audio PCM frames exist solely in RAM buffers during active inference and are instantly overwritten. No WAV/MP3 files are stored on disk.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-semibold text-slate-300">Clear Current Subtitle History</p>
                <p className="text-[11px] text-slate-500">Purges in-memory transcript cards from the current session.</p>
              </div>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearedNotice ? "History Cleared!" : "Clear History"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
