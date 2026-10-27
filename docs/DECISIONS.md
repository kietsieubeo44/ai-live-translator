# Architecture & Technology Decision Log

> Format: [DATE] DECISION-ID: Decision | Rationale | Alternatives | Risk

---

## DEC-001 — Desktop Runtime: Tauri 2
**Date:** 2026-10-27  
**Decision:** Use Tauri 2 as the application framework  
**Rationale:**
- Rust backend — perfect for audio/STT integration
- Much smaller bundle than Electron (~5MB vs ~80MB+)
- Native WebView, no bundled Chromium
- Windows-native build with MSVC toolchain
- Active project with v2 stable release

**Alternatives considered:**
- Electron: Too heavy, Node.js overhead for audio processing
- Qt: C++ complexity, licensing concerns for commercial use
- WinForms/.NET: Less suited for modern UI, harder to port later

**Risk:** Tauri 2 API surface is newer; some plugins may be less mature  
**Mitigation:** Stick to core IPC/commands pattern; avoid experimental plugins

---

## DEC-002 — Audio Capture: WASAPI Loopback via `windows` crate
**Date:** 2026-10-27  
**Decision:** Use Microsoft's WASAPI loopback capture via the `windows` crate (Rust)  
**Rationale:**
- Native Windows API — best compatibility with all audio devices including headphones
- WASAPI loopback specifically designed for system audio capture
- No virtual microphone (VoiceMeeter, etc.) required
- Direct PCM access at OS level

**Alternatives considered:**
- `cpal` crate: Higher-level abstraction but loopback support is less reliable on Windows
- PortAudio: C library binding, less idiomatic for Rust/Tauri
- WASAPI via `wasapi` crate: Older crate, less maintained

**Risk:** WASAPI loopback may have issues with some Bluetooth codecs (SBC works, AAC/aptX may not)  
**Mitigation:** Test with multiple device types; document limitations clearly

---

## DEC-003 — STT: whisper.cpp via `whisper-rs`
**Date:** 2026-10-27  
**Decision:** Use whisper.cpp with Rust bindings (whisper-rs) for local speech-to-text  
**Rationale:**
- Best-in-class accuracy for English STT
- Runs locally, fully offline
- CUDA acceleration available (user has RTX 3050)
- Multiple model sizes (tiny/base/small/medium) for hardware flexibility
- Excellent Indian English performance (multilingual training data)
- MIT License

**Alternatives considered:**
- Vosk: Good, smaller, but lower accuracy than Whisper
- faster-whisper (Python): Requires Python runtime, adds complexity
- Google Cloud STT: Paid, requires internet, privacy concern
- Azure STT: Paid, requires internet

**Model default selection:** `ggml-base.en` (74MB, ~RTX 3050 handles real-time)  
**Upgrade path:** `ggml-small.en` (244MB) if accuracy insufficient

**Risk:** First-time model download required (74-244MB)  
**Mitigation:** Bundle progress bar; allow offline model placement

---

## DEC-004 — Translation: OPUS-MT (local) with cloud adapter
**Date:** 2026-10-27  
**Decision:** Use local OPUS-MT model for EN→VI translation by default  
**Rationale:**
- Open source (Helsinki-NLP/opus-mt-en-vi)
- Runs on CPU, reasonable speed
- No API key or internet required
- Pluggable adapter pattern allows DeepL/Google fallback

**Alternatives considered:**
- LibreTranslate (self-hosted): Extra server setup complexity
- DeepL API: Paid after free tier, privacy concern
- Google Translate API: Paid, privacy concern

**Risk:** OPUS-MT quality for technical terms may be lower than DeepL  
**Mitigation:** Post-process to preserve technical terms; allow cloud upgrade

---

## DEC-005 — LLM for Answer Generation: Ollama REST (local) with OpenAI adapter
**Date:** 2026-10-27  
**Decision:** Use Ollama to serve local LLM for answer generation  
**Rationale:**
- Ollama handles model download, serving, GPU acceleration automatically
- REST API — easy to swap between local and cloud
- Compatible with OpenAI API spec (same adapter for GPT-4 fallback)
- User has RTX 3050 (6GB VRAM) — can run Llama 3.2 3B or Phi-3 mini

**Default model:** `phi3.5:mini` or `llama3.2:3b` (fits in 6GB VRAM with quantization)  
**Alternatives considered:**
- llama.cpp direct: More complex setup, no model manager
- GPT-4 API: Paid, privacy risk by default
- Gemini API: Paid after free tier

**Risk:** Ollama must be installed separately  
**Mitigation:** Detect Ollama; provide install guide; graceful fallback to cloud if configured

---

## DEC-006 — State Management: Zustand (frontend) + Tauri Commands (IPC)
**Date:** 2026-10-27  
**Decision:** Use Zustand for frontend state, Tauri commands + events for IPC  
**Rationale:**
- Zustand is lightweight, TypeScript-friendly, no boilerplate
- Tauri 2 IPC is well-suited for event streaming (transcript events, audio level updates)
- Avoid Redux complexity for this use case

---

## DEC-007 — Testing: Rust tests + Vitest + Playwright (future)
**Date:** 2026-10-27  
**Decision:** Use Rust built-in test framework for backend, Vitest for frontend unit tests  
**Rationale:**
- Rust tests: zero setup, cargo test
- Vitest: Fast, native Vite integration
- Playwright deferred to Phase 7 — adds complexity, focus on functional first

---

## Open Questions

| ID | Question | Priority | Resolution |
|----|----------|----------|------------|
| OQ-001 | whisper.cpp CUDA build on Windows 11 — linker issues? | P0 | Test during AUDIO-002 |
| OQ-002 | Bluetooth loopback latency acceptable? | P1 | Benchmark during AUDIO-TC-006 |
| OQ-003 | Ollama install requirement — deal breaker for non-technical users? | P1 | Add auto-download option or use cloud fallback as default |
| OQ-004 | OPUS-MT model quality for technical EN→VI | P1 | Benchmark during TRANS-TC-002 |
