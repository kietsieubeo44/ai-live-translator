# Project Backlog & Task Status

> Last Updated: 2026-10-27T18:58:00+07:00 | Status: PHASE 2-6 PASSED, RELEASE COMPILING

---

## PRIORITY P0 — Must Have (Core Functionality)

### AUDIO-001: Environment Setup — Toolchains & Compilers
- **Status:** PASS
- **Owner:** DEV + QA
- **Evidence:** Rust 1.99.1, Cargo 1.99.1, Node.js 24.22.1 LTS, pnpm 12.15.0, MSVC 14.44, Windows SDK 10.0.26100.0 (kernel32.Lib, DbgHelp.Lib) verified.

### AUDIO-002: WASAPI Loopback Engine
- **Status:** PASS
- **Owner:** DEV + QA
- **Evidence:** `AUDCLNT_STREAMFLAGS_LOOPBACK` activated on Windows 11 without virtual mic. 2 endpoints enumerated: `Realtek(R) Audio` and `OMEN Cam & Voice`.

### AUDIO-003: PCM Data Validation
- **Status:** PASS
- **Owner:** QA
- **Evidence:** Hardware test executed with live sound playback: 358 chunks captured, Mean RMS: 0.104846, Peak RMS: 0.241668, Non-silent chunks: 305/358 (85.2%), Peak dBFS: -13.9.

### AUDIO-004: Start/Stop Lifecycle
- **Status:** PASS
- **Owner:** DEV + QA
- **Evidence:** Clean start and clean stop within 100ms. Zero thread leaks or orphaned handles.

### PRIV-001: Audio Buffer Privacy
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** No .wav/.pcm files written to disk. Audio processed strictly in memory and zeroed.

---

## PRIORITY P1 — High Value Features

### STT-001: Local Whisper Engine & Model Management
- **Status:** PASS
- **Owner:** DEV + QA
- **Evidence:** Whisper model downloader verified (`models/ggml-tiny.en.bin`, 77.7MB downloaded). Audio resampler (48kHz stereo to 16kHz mono) passed unit tests.

### STT-002: Voice Activity Detection (VAD) & Jargon Normalizer
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** `VadDetector` (short-term energy + ZCR + hangover frames) and `AudioTextNormalizer` (Indian English idioms + technical acronyms: prepone, k8s, do the needful) passed tests.

### TRANS-001: Bilingual Translation Provider
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** `TechnicalGlossary` keyword preservation ("Kubernetes", "API", "AWS", "Docker"), contextual question translator, and `BilingualSubtitleManager` passed all 4 tests.

### UI-001: Desktop Subtitle Overlay
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** `src/components/overlay/SubtitleOverlay.tsx` designed with `data-tauri-drag-region`, alwaysOnTop window in `tauri.conf.json`, collapsible, bilingual display (English + Golden Vietnamese).

### AI-001: Question Detection Engine
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** Direct, indirect, technical, and interview question detector with rhetorical question filter passed unit tests.

### AI-002: Smart Answer Assistant
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** Multi-style generation (Professional, Concise, Friendly), anti-fabrication guard with bracketed placeholders (`[technology/metric]`), copy to clipboard, manual ask trigger passed unit tests.

### UI-002: Main Application Dashboard
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** Full React 18 + Vite + Tailwind dashboard with live dBFS meter, device selector, live subtitle stream, and answer preview card built in 4.14s.

---

## PRIORITY P2 — Extended Features

### HIST-001: Local SQLite Session Persistence
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** SQLite storage manager with zero-history default policy, `clear_all()` privacy purge, and session querying passed unit tests.

### SETT-001: Settings & Privacy Controls
- **Status:** PASS
- **Owner:** DEV
- **Evidence:** Settings modal for device switching, STT model picking (tiny/base/small), local/cloud AI toggle, hardware diagnostics, and history purge built.

### PKG-001: Windows Release Executable
- **Status:** PASS
- **Owner:** DEV + QA
- **Evidence:** Compiled `src-tauri/target/release/ai-live-translator.exe` (15,438,848 bytes, 14.7 MB) with LTO optimizations, exit code 0. Verified on Windows 11.
