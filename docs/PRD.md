# Product Requirements Document (PRD)

**Product:** AI Live Translator & Smart Answer Assistant  
**Version:** 1.0  
**Date:** 2026-10-27  
**Platform:** Windows 10/11  
**Strategy:** Local-first, Privacy-focused, Modular AI

---

## 1. Executive Summary

AI Live Translator & Smart Answer Assistant is a Windows desktop application that helps users understand real-time English conversations — especially when wearing headphones in meetings, video calls, interviews, lectures, or any audio content. It captures system audio via WASAPI loopback, transcribes speech locally, translates to Vietnamese in real time, and provides intelligent answer suggestions for questions directed at the user.

---

## 2. Problem Statement

Users who are non-native English speakers (particularly Vietnamese) face challenges:
- Following fast-paced English conversations in real-time
- Understanding Indian English accents and technical jargon
- Responding quickly and appropriately in professional settings
- Doing all this without revealing they need assistance

---

## 3. Goals

| Goal | Description |
|------|-------------|
| Real-time subtitles | Show English + Vietnamese in <2.5s from speech |
| Local-first | All core features work without internet |
| Privacy | No audio recording stored, no cloud by default |
| Smart answers | Detect questions and suggest contextual responses |
| Usability | Non-technical users can install and use it |
| Extensibility | AI providers swappable without rewrite |

---

## 4. Non-Goals (MVP)

- Auto-inject answers into meeting apps
- Multi-language (non-Vietnamese) in v1
- Mobile / macOS / Linux support
- Speaker diarization (who said what)
- Real-time noise cancellation

---

## 5. Users

**Primary:** Vietnamese professionals in English-language environments — meetings, interviews, video content.

**Secondary:** Language learners, support engineers, students.

---

## 6. Feature Requirements

### F1 — System Audio Capture (P0)
- Capture system audio via WASAPI loopback (NOT microphone)
- List available output devices
- Support wired and Bluetooth headphones
- Show audio level meter
- Start/Stop controls
- Handle device disconnect gracefully
- Verify actual PCM data (not just meter activity)

### F2 — Speech-to-Text (P1)
- Local STT using whisper.cpp
- English recognition, optimized for Indian English
- Handle technical terms and abbreviations
- VAD (Voice Activity Detection)
- Buffer management for continuous speech
- Distinguish interim vs. confirmed transcripts
- Configurable model (tiny/base/small) by hardware

### F3 — Live Translation (P1)
- English original displayed
- Vietnamese translation below, in sync
- Contextual translation (not word-by-word)
- Preserve proper nouns and technical terms
- No duplicate sentences
- Rate-limited UI updates

### F4 — Smart Answer Assistant (P1)
- Detect direct and indirect questions from transcript
- Distinguish questions for user vs. rhetorical questions
- Generate contextual answer suggestions
- Display in English + Vietnamese
- Allow: copy, shorten, rewrite
- Manual trigger button (user can request suggestions)
- Never fabricate user's personal info/experience

### F5 — Desktop Overlay (P1)
- Always-on-top floating window
- Draggable, resizable, collapsible, hideable
- Keyboard shortcuts
- Bilingual display (EN + VI)
- Minimal screen footprint
- Multiple screen resolution support

### F6 — Settings (P2)
- Audio device selection
- STT model selection
- Translation provider (local/cloud)
- LLM provider (local/cloud) + API key
- Privacy controls
- Diagnostics/logs panel

### F7 — Privacy (P0/P1)
- No audio stored by default
- No data sent to cloud without explicit config
- Visual indicator when cloud is in use
- Stop all capture immediately on Stop
- No sensitive data in logs
- Clear history option

---

## 7. Technical Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full diagram.

**Stack:**
- Desktop: Tauri 2 (Rust backend + Web frontend)
- UI: React 18 + TypeScript + Vite
- Audio: WASAPI loopback via `windows` crate
- STT: whisper.cpp via `whisper-rs` bindings
- Translation: Local OPUS-MT model or cloud adapter
- LLM: llama.cpp via `llama-cpp-rs` or Ollama REST API
- DB: SQLite via `rusqlite` (optional history)
- Testing: Rust tests, Vitest, Playwright

**Provider Interfaces:**
- `AudioCaptureProvider`
- `SpeechToTextProvider`
- `TranslationProvider`
- `AnswerGenerationProvider`
- `StorageProvider`

---

## 8. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Subtitle latency (first display) | P95 ≤ 2.5s | From speech end to UI display |
| Translation latency | P95 ≤ 3.5s | From transcript confirmed to translation shown |
| Answer suggestion latency | P95 ≤ 5s | From question detected to suggestion shown |
| STT word error rate (clear English) | < 10% | Benchmark with standard test set |
| STT WER (Indian English) | < 20% | Benchmark with Indian English samples |
| CPU usage (idle capture) | < 5% | Background baseline |
| CPU usage (active STT) | < 40% | During transcription burst |

---

## 9. Privacy Requirements

| Requirement | Implementation |
|-------------|----------------|
| No audio stored by default | Audio buffer discarded after STT |
| No cloud without explicit config | All providers default to local |
| Cloud usage indicator | Visual badge in UI |
| Immediate stop on user request | Stop button kills capture thread |
| No sensitive data in logs | Log scrubbing for API keys |
| History deletion | Clear session command |

---

## 10. Definition of Done

- [ ] Source code in workspace
- [ ] Build succeeds
- [ ] WASAPI loopback verified with real PCM data
- [ ] STT recognizes real audio input
- [ ] EN + VI displayed in sync
- [ ] Overlay functional (always-on-top, draggable)
- [ ] Smart Answer generates contextual suggestions
- [ ] Start/Stop works correctly
- [ ] All P0/P1 tests executed
- [ ] No critical unresolved errors
- [ ] Installer or runnable artifact exists
- [ ] User guide written
- [ ] Honest QA report published
- [ ] Known limitations documented
