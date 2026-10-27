# AI Live Translator & Smart Answer Assistant

> Real-time English transcription, Vietnamese translation, and AI answer suggestions for Windows 10/11.

## Overview

This application helps Vietnamese professionals understand English conversations in real time — during meetings, interviews, video calls, and content consumption. It captures system audio, transcribes speech locally, translates to Vietnamese, and suggests contextual answers to questions.

**Key features:**
- 🎧 System audio capture via WASAPI loopback (works with headphones)
- 🗣️ Local speech-to-text using whisper.cpp (no internet required)
- 🌐 English + Vietnamese subtitles in real time
- 🤖 Smart answer suggestions for detected questions
- 🔒 Privacy-first: no audio stored, no cloud by default
- 🖥️ Floating overlay that works above any application

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 (22H2+) | Windows 11 |
| CPU | 4-core x86_64 | 8-core, AMD/Intel modern |
| RAM | 8 GB | 16 GB |
| GPU | — | NVIDIA GPU (CUDA) for faster STT |
| Storage | 2 GB free | 5 GB (with LLM model) |
| Audio | Any output device | WASAPI-compatible device |

---

## Quick Start

### Prerequisites

1. **Rust** (v1.70+): https://rustup.rs
2. **Node.js** (v18+): https://nodejs.org
3. **pnpm**: `npm install -g pnpm`
4. **VS Build Tools 2022** with C++ workload

### Install & Build

```powershell
# Clone repository
git clone <repo-url>
cd ai-live-translator

# Install frontend dependencies
pnpm install

# Build and run in development mode
pnpm tauri dev

# Build release installer
pnpm tauri build
```

### First-Time Setup

1. Launch the application
2. The app will detect your default audio output device
3. Download the whisper STT model (~74MB for base.en) when prompted
4. Optional: Install Ollama for AI answer suggestions
5. Press **Start Listening** to begin

---

## Usage

### Main Controls

| Control | Action |
|---------|--------|
| Start Listening | Begin capturing system audio |
| Stop Listening | Halt all audio capture |
| Ctrl+Shift+H | Hide/show overlay |
| Ctrl+Shift+C | Collapse overlay to title bar |
| Ctrl+Shift+A | Request answer suggestion manually |

### Overlay

The floating overlay shows:
- **Top line:** English transcript (confirmed)
- **Bottom line:** Vietnamese translation
- **Grey/italic:** Interim transcript (being processed)

Drag the overlay anywhere on screen. Resize from any edge. Double-click title to collapse.

### Answer Assistant

When the system detects a question directed at you:
1. The Answer Panel opens automatically
2. Review the suggested answer in English and Vietnamese
3. Use **Copy**, **Shorten**, or **Rewrite** to adjust
4. **Ctrl+Shift+A** triggers a manual suggestion

---

## Architecture

```
src-tauri/          Rust backend
  audio/            WASAPI loopback capture
  stt/              whisper.cpp integration
  translation/      Translation provider
  answer/           Answer generation (LLM)
  storage/          SQLite session history

src/                React frontend
  components/
    overlay/        Subtitle overlay window
    dashboard/      Main control panel
    settings/       Configuration UI
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full diagram.

---

## Privacy

- **No audio recording:** Audio is processed in memory and discarded immediately after transcription
- **Local by default:** All AI processing runs on your machine
- **Cloud opt-in:** You explicitly configure cloud providers (translation, LLM) in Settings
- **No telemetry:** The application does not phone home
- **Transparent:** A badge is shown in the UI whenever cloud features are active

---

## Troubleshooting

### No audio detected
- Ensure Windows audio is not muted
- Check that your playback device is selected in Audio Settings
- WASAPI loopback captures system audio, not microphone
- Bluetooth headphones: ensure device is set as Default Playback Device

### STT model not loading
- Run the app as a standard user (not administrator)
- Check that `models/` directory exists and has read/write permissions
- Re-download the model from Settings → STT Model

### Overlay not showing on top
- Some fullscreen games use exclusive fullscreen mode — use windowed mode
- Try setting overlay opacity in Settings

### High CPU usage
- Switch to a smaller STT model (tiny.en) in Settings → STT Model
- Reduce translation frequency in Settings → Performance

---

## Development

### Running Tests

```powershell
# Rust backend tests
cd src-tauri
cargo test

# Frontend tests
pnpm test

# WASAPI PoC standalone test
cd poc/wasapi
cargo test
cargo run  # Interactive test with real audio
```

### Project Documents

| Document | Description |
|----------|-------------|
| [docs/PRD.md](docs/PRD.md) | Product Requirements |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical Architecture |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Task Backlog with IDs |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Test Plan |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | QA Test Report |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture Decision Log |
| [docs/STATUS.md](docs/STATUS.md) | Current Project Status |

---

## Known Limitations (v1.0)

- Bluetooth codecs: SBC works; AAC/aptX/LDAC may have additional latency
- Process-specific audio isolation not supported (captures all system audio)
- LLM answer quality depends on local model — cloud providers offer better results
- STT accuracy on very fast speech or heavy background noise may degrade
- First startup requires model download (no bundled model to reduce installer size)

---

## License

MIT License. See LICENSE file.
