import { create } from "zustand";

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
  channels: number;
  sample_rate: number;
  bits_per_sample: number;
}

export interface SubtitleItem {
  id: number;
  original_en: string;
  translated_vi: string;
  is_final: boolean;
  detected_lang?: string;
  latency_ms?: number;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at_ms: number;
  doc_type: string;
  word_count: number;
}

export interface AnswerVariant {
  style: string;
  text_en: string;
  text_vi: string;
}

export interface DetectedQuestion {
  id: number;
  question_text: string;
  question_type: string;
  confidence: number;
  needs_response: boolean;
  context_snippet: string;
}

export interface AnswerSuggestion {
  id: number;
  question: DetectedQuestion;
  primary_answer_en: string;
  primary_answer_vi: string;
  variants: AnswerVariant[];
  created_at_ms: number;
  is_manual: boolean;
}

interface AppState {
  // Audio state
  devices: AudioDevice[];
  selectedDeviceId: string;
  isCapturing: boolean;
  audioLevel: number;
  audioPeakDbfs: number;

  // Subtitles & transcription
  subtitles: SubtitleItem[];
  interimTranscript: string;

  // Smart Answer & Knowledge Base
  latestSuggestion: AnswerSuggestion | null;
  suggestionHistory: AnswerSuggestion[];
  selectedVariantStyle: string;
  knowledgeDocs: KnowledgeDoc[];

  // Overlay state
  isOverlayCollapsed: boolean;
  overlayFontSize: number;
  overlayOpacity: number;

  // Navigation
  activeTab: "dashboard" | "answers" | "subtitles" | "settings" | "history" | "knowledge";

  // Actions
  setDevices: (devices: AudioDevice[]) => void;
  setSelectedDeviceId: (id: string) => void;
  setIsCapturing: (capturing: boolean) => void;
  setAudioLevel: (level: number) => void;
  addSubtitle: (sub: SubtitleItem) => void;
  setInterimTranscript: (text: string) => void;
  setLatestSuggestion: (suggestion: AnswerSuggestion | null) => void;
  setSelectedVariantStyle: (style: string) => void;
  setKnowledgeDocs: (docs: KnowledgeDoc[]) => void;
  addKnowledgeDocItem: (doc: KnowledgeDoc) => void;
  removeKnowledgeDocItem: (id: string) => void;
  toggleKnowledgeDocItem: (id: string, is_active: boolean) => void;
  toggleOverlayCollapse: () => void;
  setActiveTab: (tab: "dashboard" | "answers" | "subtitles" | "settings" | "history" | "knowledge") => void;
  clearSubtitles: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  devices: [],
  selectedDeviceId: "default",
  isCapturing: false,
  audioLevel: 0,
  audioPeakDbfs: -60,

  subtitles: [
    {
      id: 1,
      original_en: "Welcome to AI Live Translator. Start listening to see real-time subtitles.",
      translated_vi: "Chào mừng bạn đến với AI Live Translator. Nhấn 'Start Listening' để xem phụ đề thời gian thực.",
      is_final: true,
      latency_ms: 0,
    }
  ],
  interimTranscript: "",

  latestSuggestion: null,
  suggestionHistory: [],
  selectedVariantStyle: "Professional",
  knowledgeDocs: [],

  isOverlayCollapsed: false,
  overlayFontSize: 16,
  overlayOpacity: 0.9,

  activeTab: "dashboard",

  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setIsCapturing: (isCapturing) => set({ isCapturing }),
  setAudioLevel: (audioLevel) => {
    const dbfs = audioLevel > 0 ? 20 * Math.log10(audioLevel) : -60;
    set({ audioLevel, audioPeakDbfs: Math.max(-60, Math.round(dbfs * 10) / 10) });
  },
  addSubtitle: (sub) =>
    set((state) => {
      const cleanEn = sub.original_en.trim().toLowerCase().replace(/[.,!?;:'"()-\[\]]/g, '');
      if (!cleanEn || cleanEn === "music" || cleanEn === "blankaudio" || cleanEn === "applause") {
        return state;
      }

      // Remove placeholder welcome subtitle when real audio subtitles start arriving
      const existing = state.subtitles.filter((s) => s.id !== 1 || s.latency_ms !== 0);

      // Check if this subtitle ID already exists (e.g. Gemini refinement of instant translation)
      const existingIdx = existing.findIndex((s) => s.id === sub.id);
      if (existingIdx !== -1) {
        const updated = [...existing];
        updated[existingIdx] = { ...updated[existingIdx], ...sub };
        return { subtitles: updated, interimTranscript: "" };
      }

      // Ignore if identical to any of the last 3 subtitles
      const isDup = existing.slice(-3).some((s) => {
        const existingClean = s.original_en.trim().toLowerCase().replace(/[.,!?;:'"()-\[\]]/g, '');
        return existingClean === cleanEn;
      });

      if (isDup) {
        return state;
      }

      return {
        subtitles: [...existing.slice(-49), sub],
        interimTranscript: "",
      };
    }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setLatestSuggestion: (latestSuggestion) =>
    set((state) => {
      if (!latestSuggestion) {
        return { latestSuggestion: null };
      }
      if (
        state.latestSuggestion &&
        state.latestSuggestion.question.question_text.trim().toLowerCase() ===
          latestSuggestion.question.question_text.trim().toLowerCase()
      ) {
        return state;
      }
      return {
        latestSuggestion,
        suggestionHistory: [latestSuggestion, ...state.suggestionHistory.slice(0, 19)],
      };
    }),
  setSelectedVariantStyle: (selectedVariantStyle) => set({ selectedVariantStyle }),
  setKnowledgeDocs: (knowledgeDocs) => set({ knowledgeDocs }),
  addKnowledgeDocItem: (doc) => set((state) => ({ knowledgeDocs: [...state.knowledgeDocs, doc] })),
  removeKnowledgeDocItem: (id) => set((state) => ({ knowledgeDocs: state.knowledgeDocs.filter((d) => d.id !== id) })),
  toggleKnowledgeDocItem: (id, is_active) =>
    set((state) => ({
      knowledgeDocs: state.knowledgeDocs.map((d) => (d.id === id ? { ...d, is_active } : d)),
    })),
  toggleOverlayCollapse: () => set((state) => ({ isOverlayCollapsed: !state.isOverlayCollapsed })),
  setActiveTab: (activeTab) => set({ activeTab }),
  clearSubtitles: () => set({ subtitles: [] }),
}));
