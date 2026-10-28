import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./stores/useAppStore";
import { Dashboard } from "./components/dashboard/Dashboard";
import { SubtitleOverlay } from "./components/overlay/SubtitleOverlay";
import { AnswerPanel } from "./components/dashboard/AnswerPanel";
import { SettingsModal } from "./components/settings/SettingsModal";
import { KnowledgeBase } from "./components/knowledge/KnowledgeBase";
import {
  LayoutDashboard,
  Sparkles,
  Radio,
  Settings as SettingsIcon,
  Shield,
  Layers,
  BookOpen,
} from "lucide-react";

export const App: React.FC = () => {
  const { activeTab, setActiveTab, setDevices, setIsCapturing, setAudioLevel, addSubtitle, setLatestSuggestion } = useAppStore();
  const isOverlayInitial = typeof window !== "undefined" && (window.location.hash === "#overlay" || new URLSearchParams(window.location.search).get("view") === "overlay");
  const [isOverlayMode, setIsOverlayMode] = useState(isOverlayInitial);

  useEffect(() => {
    // Check if opened as floating overlay window
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "overlay" || window.location.hash === "#overlay") {
      setIsOverlayMode(true);
    }

    // Initialize Tauri event listeners & device listing
    const initTauri = async () => {
      try {
        console.log("[Tauri Init] Subscribing to audio and subtitle events...");
        // Listen for real-time audio levels
        await listen<number>("audio-level", (event) => {
          setAudioLevel(event.payload);
        });

        // Listen for bilingual subtitles
        await listen<any>("bilingual-subtitle", (event) => {
          console.log("[Tauri Event] New bilingual subtitle:", event.payload);
          addSubtitle(event.payload);
        });

        // Listen for smart answer suggestions
        await listen<any>("answer-suggestion", (event) => {
          console.log("[Tauri Event] New smart answer suggestion:", event.payload);
          setLatestSuggestion(event.payload);
        });
        console.log("[Tauri Init] Event subscriptions active!");
      } catch (e) {
        console.warn("[Tauri Init] Event subscription failed:", e);
      }

      try {
        console.log("[Tauri Init] Fetching audio output devices...");
        const devs: any = await invoke("list_audio_devices");
        console.log("[Tauri Init] Discovered audio devices:", devs);
        if (Array.isArray(devs) && devs.length > 0) {
          setDevices(devs);
        }
      } catch (e) {
        console.warn("[Tauri Init] list_audio_devices failed:", e);
      }

      // Sync Gemini API Key and Translation Engine between Rust backend and frontend
      try {
        const rustKey = (await invoke("get_gemini_api_key")) as string;
        const localKey = localStorage.getItem("gemini_api_key") || "";
        if (rustKey && !localKey) {
          localStorage.setItem("gemini_api_key", rustKey);
        } else if (localKey && (!rustKey || rustKey !== localKey)) {
          await invoke("set_gemini_api_key", { key: localKey });
        }
        const engine = localStorage.getItem("translation_engine") || "gemini";
        await invoke("set_translation_engine", { engine });
      } catch (e) {
        console.warn("[Tauri Init] Failed to sync Gemini key/engine:", e);
      }

      // Auto-start capture ONLY on main window, never on overlay
      if (!isOverlayInitial) {
        try {
          console.log("[Tauri Init] Auto-starting capture on default device...");
          await invoke("start_capture", { deviceId: "default", device_id: "default" });
          setIsCapturing(true);
          console.log("[Tauri Init] Capture auto-started successfully!");
        } catch (e) {
          console.warn("[Tauri Init] Auto-start capture failed:", e);
        }
      }
    };

    initTauri();
  }, [setDevices, setIsCapturing, setAudioLevel, addSubtitle, setLatestSuggestion]);

  // If this window is the overlay, render ONLY the floating overlay widget
  if (isOverlayMode) {
    return (
      <div className="w-screen h-screen bg-transparent p-0 select-none overflow-hidden box-border">
        <SubtitleOverlay />
      </div>
    );
  }

  // Otherwise, render full application with sidebar
  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900/80 border-r border-slate-800/80 flex flex-col justify-between p-4">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                AI Live Translator
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Smart Answer v1.0</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "answers", label: "Smart Answer", icon: Sparkles, badge: "AI" },
              { id: "knowledge", label: "Tài Liệu & Tri Thức", icon: BookOpen, badge: "Docs" },
              { id: "subtitles", label: "Subtitles Feed", icon: Radio },
              { id: "settings", label: "Settings & Audio", icon: SettingsIcon },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Privacy Status Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            <span>Local & Private</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Audio stays in RAM. No recordings stored on disk.
          </p>
        </div>
      </aside>

      {/* Main Dynamic Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "answers" && <AnswerPanel />}
        {activeTab === "knowledge" && <KnowledgeBase />}
        {activeTab === "subtitles" && <Dashboard />}
        {activeTab === "settings" && <SettingsModal />}
      </main>
    </div>
  );
};
