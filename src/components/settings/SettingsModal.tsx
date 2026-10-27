import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/useAppStore";
import { Settings as SettingsIcon, Shield, Cpu, Volume2, Trash2, CheckCircle2, Globe, Sparkles } from "lucide-react";

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
  const [testPhrase, setTestPhrase] = useState("I believe Huang is in middle of the preparation.");
  const [testResult, setTestResult] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gemini_api_key") || "";
    setGeminiApiKey(saved);
    if (saved) {
      invoke("set_gemini_api_key", { key: saved }).catch(console.error);
    }
  }, []);

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
    try {
      const res: any = await invoke("translate_text", { text: testPhrase });
      setTestResult(res?.translated_vi || "Translation returned empty");
    } catch (e: any) {
      setTestResult(`Error: ${e?.message || e}`);
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
        {/* Section 1: Translation Engine & Language Auto-Detect */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            Bilingual Vietnamese Translation Engine
          </h3>
          <p className="text-xs text-slate-400">
            Automatically detects spoken language (English, etc.) and translates naturally to Vietnamese with technical term protection (Kubernetes, Docker, Microservices, AWS).
          </p>

          <div className="space-y-3 pt-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Optional Gemini 1.5 Flash API Key (for Context-Aware Pro Translation)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy... (leave blank to use instant Google Auto-Detect)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSaveGeminiKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
              >
                {keySaved ? "Saved!" : "Save Key"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              When left blank, the app uses the built-in fast Auto-Detect Google translation engine (free, instant, 0 setup).
            </p>

            {/* Test Translation Box */}
            <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Live Translation Test:</span>
                <button
                  onClick={handleTestTranslation}
                  disabled={isTranslating}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
                >
                  {isTranslating ? "Translating..." : "Test Translate"}
                </button>
              </div>
              <input
                type="text"
                value={testPhrase}
                onChange={(e) => setTestPhrase(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              />
              {testResult && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                  🇻🇳 Tiếng Việt: <span className="font-semibold text-white">{testResult}</span>
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
                onClick={() => setSelectedModel(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
                  selectedModel === m.id
                    ? "bg-indigo-600/20 border-indigo-500 text-white"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{m.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 font-mono">
                    {m.badge}
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
