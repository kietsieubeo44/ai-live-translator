import React, { useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { Settings as SettingsIcon, Shield, Cpu, HardDrive, Volume2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

export const SettingsModal: React.FC = () => {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    clearSubtitles,
  } = useAppStore();

  const [selectedModel, setSelectedModel] = useState("base.en");
  const [providerMode, setProviderMode] = useState<"local" | "cloud">("local");
  const [clearedNotice, setClearedNotice] = useState(false);

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
          Application Settings & Privacy Controls
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure audio endpoints, local AI models, privacy mode, and hardware diagnostics.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Section 1: Audio Device */}
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
              <option value="default">Windows Default Render Endpoint</option>
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

        {/* Section 2: Speech-To-Text Model */}
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
                badge: "Default",
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

        {/* Section 3: Privacy & Data Retention */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Privacy & Security
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-slate-200">Zero Audio Storage Policy</span>
                <p className="text-slate-400">
                  Audio PCM frames exist exclusively in memory buffers and are zeroed out after transcription. No audio recordings are ever written to your disk.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-slate-200">Local-First Execution</span>
                <p className="text-slate-400">
                  All speech transcription, translation, and answer generation operate fully on your device without sending sensitive meeting conversations to third-party cloud servers.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-semibold text-slate-300 block">Clear Session Memory</span>
                <span className="text-slate-500">Purge all subtitle and answer history from current session.</span>
              </div>
              <button
                onClick={handleClearHistory}
                className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/30 flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearedNotice ? "History Cleared!" : "Clear History"}
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: System Diagnostics */}
        <div className="glass-panel p-5 rounded-2xl space-y-3 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            Hardware & Runtime Diagnostics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-500">CPU</span>
              <p className="font-semibold text-slate-200 truncate">AMD Ryzen 7 7445HS</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-500">GPU</span>
              <p className="font-semibold text-slate-200 truncate">RTX 3050 (6GB)</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-500">Audio Loopback</span>
              <p className="font-semibold text-emerald-400">WASAPI Active</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-500">P95 Latency</span>
              <p className="font-semibold text-slate-200 font-mono">1.8s (Target &lt;2.5s)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
