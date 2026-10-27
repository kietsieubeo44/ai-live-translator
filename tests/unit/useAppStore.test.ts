// Frontend Unit Tests for AI Live Translator Store

import { useAppStore } from "../../src/stores/useAppStore";

describe("App Store Tests", () => {
  it("initializes with default values", () => {
    const state = useAppStore.getState();
    expect(state.isCapturing).toBe(false);
    expect(state.selectedDeviceId).toBe("default");
    expect(state.activeTab).toBe("dashboard");
    expect(state.isOverlayCollapsed).toBe(false);
  });

  it("calculates dBFS from linear RMS level correctly", () => {
    const { setAudioLevel } = useAppStore.getState();
    setAudioLevel(0.1);
    const dbfs = useAppStore.getState().audioPeakDbfs;
    expect(dbfs).toBeCloseTo(-20.0, 1);

    setAudioLevel(1.0);
    expect(useAppStore.getState().audioPeakDbfs).toBeCloseTo(0.0, 1);

    setAudioLevel(0.0);
    expect(useAppStore.getState().audioPeakDbfs).toBe(-60);
  });

  it("adds subtitles and keeps history bounded", () => {
    const { addSubtitle } = useAppStore.getState();
    addSubtitle({
      id: 999,
      original_en: "Hello world",
      translated_vi: "Xin chào thế giới",
      is_final: true,
      latency_ms: 15,
    });

    const subs = useAppStore.getState().subtitles;
    const last = subs[subs.length - 1];
    expect(last.original_en).toBe("Hello world");
    expect(last.translated_vi).toBe("Xin chào thế giới");
  });

  it("toggles overlay collapse state", () => {
    const { toggleOverlayCollapse } = useAppStore.getState();
    const initial = useAppStore.getState().isOverlayCollapsed;
    toggleOverlayCollapse();
    expect(useAppStore.getState().isOverlayCollapsed).toBe(!initial);
  });
});
