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
  latency_ms?: number;
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

  // Smart Answer
  latestSuggestion: AnswerSuggestion | null;
  suggestionHistory: AnswerSuggestion[];
  selectedVariantStyle: string;

  // Overlay state
  isOverlayCollapsed: boolean;
  overlayFontSize: number;
  overlayOpacity: number;

  // Navigation
  activeTab: "dashboard" | "answers" | "subtitles" | "settings" | "history";

  // Actions
  setDevices: (devices: AudioDevice[]) => void;
  setSelectedDeviceId: (id: string) => void;
  setIsCapturing: (capturing: boolean) => void;
  setAudioLevel: (level: number) => void;
  addSubtitle: (sub: SubtitleItem) => void;
  setInterimTranscript: (text: string) => void;
  setLatestSuggestion: (suggestion: AnswerSuggestion | null) => void;
  setSelectedVariantStyle: (style: string) => void;
  toggleOverlayCollapse: () => void;
  setActiveTab: (tab: "dashboard" | "answers" | "subtitles" | "settings" | "history") => void;
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

  latestSuggestion: {
    id: 1,
    question: {
      id: 1,
      question_text: "Can you tell us about your experience with microservices architecture?",
      question_type: "Interview",
      confidence: 0.94,
      needs_response: true,
      context_snippet: "Discussion on system design and scaling",
    },
    primary_answer_en: "In my recent projects, I have worked with microservices using Docker and Kubernetes, focusing on clean service separation, API gateways, and asynchronous event messaging.",
    primary_answer_vi: "Trong các dự án gần đây, tôi đã làm việc với kiến trúc microservices sử dụng Docker và Kubernetes, tập trung vào phân tách service rõ ràng, API gateway và giao tiếp bất đồng bộ qua event.",
    variants: [
      {
        style: "Professional",
        text_en: "In my recent projects, I have worked with microservices using Docker and Kubernetes, focusing on clean service separation, API gateways, and asynchronous event messaging.",
        text_vi: "Trong các dự án gần đây, tôi đã làm việc với kiến trúc microservices sử dụng Docker và Kubernetes, tập trung vào phân tách service rõ ràng, API gateway và giao tiếp bất đồng bộ qua event."
      },
      {
        style: "Concise",
        text_en: "I design microservices with containerization, API gateways, and reliable message queues for scale.",
        text_vi: "Tôi thiết kế microservices với container, API gateway và message queue tin cậy để mở rộng hệ thống."
      },
      {
        style: "Friendly",
        text_en: "I really enjoy building microservices! Containerizing with Docker and orchestrating on Kubernetes makes deployment so smooth.",
        text_vi: "Tôi rất thích phát triển microservices! Việc đóng gói với Docker và điều phối trên Kubernetes giúp triển khai rất mượt mà."
      }
    ],
    created_at_ms: Date.now(),
    is_manual: false,
  },
  suggestionHistory: [],
  selectedVariantStyle: "Professional",

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
    set((state) => ({
      subtitles: [...state.subtitles.slice(-49), sub],
      interimTranscript: "",
    })),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setLatestSuggestion: (latestSuggestion) =>
    set((state) => ({
      latestSuggestion,
      suggestionHistory: latestSuggestion ? [latestSuggestion, ...state.suggestionHistory.slice(0, 19)] : state.suggestionHistory,
    })),
  setSelectedVariantStyle: (selectedVariantStyle) => set({ selectedVariantStyle }),
  toggleOverlayCollapse: () => set((state) => ({ isOverlayCollapsed: !state.isOverlayCollapsed })),
  setActiveTab: (activeTab) => set({ activeTab }),
  clearSubtitles: () => set({ subtitles: [] }),
}));
