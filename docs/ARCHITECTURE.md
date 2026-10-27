# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TAURI 2 APPLICATION                       │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │     FRONTEND (React)     │  │    BACKEND (Rust)        │   │
│  │                         │  │                          │   │
│  │  ┌──────────────────┐   │  │  ┌──────────────────┐   │   │
│  │  │  Main Dashboard  │   │  │  │  AudioCapture    │   │   │
│  │  └──────────────────┘   │  │  │  (WASAPI Loop.)  │   │   │
│  │  ┌──────────────────┐   │  │  └────────┬─────────┘   │   │
│  │  │  Subtitle Overlay│   │  │           │ PCM data     │   │
│  │  └──────────────────┘   │  │  ┌────────▼─────────┐   │   │
│  │  ┌──────────────────┐   │  │  │  VAD + Buffer    │   │   │
│  │  │  Answer Panel    │   │  │  └────────┬─────────┘   │   │
│  │  └──────────────────┘   │  │           │ audio chunks │   │
│  │  ┌──────────────────┐   │  │  ┌────────▼─────────┐   │   │
│  │  │  Settings        │   │  │  │  STT Provider    │   │   │
│  │  └──────────────────┘   │  │  │  (whisper.cpp)   │   │   │
│  │  ┌──────────────────┐   │  │  └────────┬─────────┘   │   │
│  │  │  Diagnostics     │   │  │           │ transcript   │   │
│  │  └──────────────────┘   │  │  ┌────────▼─────────┐   │   │
│  │                         │  │  │  Translation     │   │   │
│  │  Tauri IPC (Events)     │  │  │  Provider        │   │   │
│  │  ◄──────────────────────┼──┼──│  (OPUS-MT/Cloud) │   │   │
│  │                         │  │  └────────┬─────────┘   │   │
│  └─────────────────────────┘  │           │ en+vi text   │   │
│                                │  ┌────────▼─────────┐   │   │
│                                │  │  Answer Engine   │   │   │
│                                │  │  (LLM Provider)  │   │   │
│                                │  └────────┬─────────┘   │   │
│                                │           │ suggestions  │   │
│                                │  ┌────────▼─────────┐   │   │
│                                │  │  Storage         │   │   │
│                                │  │  (SQLite opt.)   │   │   │
│                                │  └──────────────────┘   │   │
│                                └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Provider Interfaces

### AudioCaptureProvider (Rust trait)
```rust
pub trait AudioCaptureProvider: Send + Sync {
    fn list_devices(&self) -> Result<Vec<AudioDevice>>;
    fn start_capture(&mut self, device_id: &str, callback: AudioCallback) -> Result<()>;
    fn stop_capture(&mut self) -> Result<()>;
    fn get_level(&self) -> f32; // 0.0 - 1.0
    fn is_capturing(&self) -> bool;
}
```

### SpeechToTextProvider (Rust trait)
```rust
pub trait SpeechToTextProvider: Send + Sync {
    fn transcribe(&mut self, audio: &[f32]) -> Result<TranscriptResult>;
    fn get_model_info(&self) -> ModelInfo;
    fn is_ready(&self) -> bool;
}
```

### TranslationProvider (Rust trait)
```rust
pub trait TranslationProvider: Send + Sync {
    fn translate(&self, text: &str, from: &str, to: &str) -> Result<String>;
    fn is_local(&self) -> bool;
}
```

### AnswerGenerationProvider (Rust trait)
```rust
pub trait AnswerGenerationProvider: Send + Sync {
    fn detect_question(&self, context: &ConversationContext) -> Result<Option<Question>>;
    fn generate_answer(&self, question: &Question, context: &ConversationContext) -> Result<AnswerSuggestion>;
    fn is_local(&self) -> bool;
}
```

### StorageProvider (Rust trait)
```rust
pub trait StorageProvider: Send + Sync {
    fn save_session(&self, session: &Session) -> Result<SessionId>;
    fn get_sessions(&self) -> Result<Vec<SessionSummary>>;
    fn delete_session(&self, id: SessionId) -> Result<()>;
    fn clear_all(&self) -> Result<()>;
}
```

## Data Flow

```
System Audio
    │
    ▼ (16kHz PCM f32, WASAPI loopback)
AudioCaptureProvider
    │
    ▼ (100ms chunks with overlap)
VAD Filter (Silero VAD or energy-based)
    │
    ▼ (speech segments ~2-5s)
SpeechToTextProvider (whisper.cpp)
    │
    ├──► Interim transcript ──► UI (shown in grey/italic)
    │
    ▼ (confirmed segments)
Confirmed Transcript
    │
    ├──► TranslationProvider ──► EN + VI ──► Subtitle Overlay
    │
    └──► AnswerGenerationProvider
              │
              ├──► Question detected? ──► Answer Panel
              └──► No question ──► (ignore)
```

## Technology Stack Decision Log

| Component | Chosen | Alternatives Considered | Reason |
|-----------|--------|------------------------|--------|
| Desktop runtime | Tauri 2 | Electron, Qt, WinForms | Smallest bundle, Rust backend, no Node runtime overhead |
| UI framework | React 18 + TypeScript | Vue, Svelte, vanilla | Ecosystem maturity, team familiarity, Tauri IPC bindings |
| Build tool | Vite | CRA, webpack | Fast HMR, native TS support |
| Audio capture | WASAPI loopback (windows crate) | PortAudio, CPAL | Native Windows API, best headphone support, no virtual mic needed |
| STT | whisper.cpp (whisper-rs) | Vosk, faster-whisper | Best accuracy, GPU acceleration, runs local |
| Translation | OPUS-MT (local), DeepL adapter | Google Translate, LibreTranslate | Free, offline-capable, good EN→VI |
| LLM | Ollama REST (local) + OpenAI adapter | llama.cpp direct, GPT-4 | Ollama handles model management, easy swap |
| Database | SQLite (rusqlite) | sled, PostgreSQL | Simple, embedded, sufficient for session history |
| Package mgr | pnpm | npm, yarn | Fastest installs, disk efficient |

## File Structure

```
ai-live-translator/
├── docs/                          # Project documentation
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── BACKLOG.md
│   ├── TEST_PLAN.md
│   ├── TEST_REPORT.md
│   ├── DECISIONS.md
│   └── STATUS.md
├── poc/
│   └── wasapi/                    # WASAPI PoC standalone project
├── src/                           # React frontend
│   ├── components/
│   │   ├── dashboard/
│   │   ├── overlay/
│   │   └── settings/
│   ├── hooks/
│   ├── stores/                    # Zustand state management
│   └── main.tsx
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── audio/                 # AudioCaptureProvider impl
│   │   ├── stt/                   # SpeechToTextProvider impl
│   │   ├── translation/           # TranslationProvider impl
│   │   ├── answer/                # AnswerGenerationProvider impl
│   │   ├── storage/               # StorageProvider impl
│   │   ├── commands.rs            # Tauri IPC commands
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Security Architecture

- API keys stored in OS keychain (via Tauri's secure storage)
- Audio buffer zeroed after STT processing
- No network calls without explicit user configuration
- Logs sanitized before write (no keys, no transcript unless opted in)
- Tauri CSP enforced in production build
