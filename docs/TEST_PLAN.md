# Test Plan

**Project:** AI Live Translator & Smart Answer Assistant  
**Version:** 1.0  
**Date:** 2026-10-27

---

## Test Strategy

- All P0 tests must pass before proceeding to P1 features
- Tests marked [HARDWARE] require physical Windows machine — document as SIMULATED if run in constrained env
- Tests marked [AUTO] can be automated via CI
- QA evaluates independently from DEV claims

---

## Module 1: Audio Capture (AUDIO)

### AUDIO-TC-001: Default Output Device Listing [AUTO]
- **Precondition:** Windows audio service running
- **Steps:** Call list_devices() API
- **Expected:** Returns ≥1 device with name, id, sample_rate
- **Pass Criteria:** List non-empty, no crash

### AUDIO-TC-002: WASAPI Loopback Init [HARDWARE]
- **Precondition:** Default playback device available
- **Steps:** Initialize WASAPI loopback capture on default device
- **Expected:** Capture stream opens within 500ms
- **Pass Criteria:** No error, stream state = Active

### AUDIO-TC-003: PCM Data Non-Zero During Playback [HARDWARE]
- **Precondition:** Audio actively playing (YouTube, music, etc.)
- **Steps:** Capture 3s of audio, compute RMS
- **Expected:** RMS > 0.001
- **Pass Criteria:** Mean RMS over 3s > threshold

### AUDIO-TC-004: PCM Data Near-Zero During Silence [HARDWARE]
- **Precondition:** No audio playing, system muted or silent
- **Steps:** Capture 3s of audio, compute RMS
- **Expected:** RMS < 0.0001
- **Pass Criteria:** Silence correctly detected

### AUDIO-TC-005: Headphone Wired Capture [HARDWARE]
- **Precondition:** Wired headphones connected as default device
- **Steps:** Play audio through headphones, capture and measure RMS
- **Expected:** PCM data received even with headphones as output
- **Pass Criteria:** RMS > 0.001

### AUDIO-TC-006: Headphone Bluetooth Capture [HARDWARE]
- **Precondition:** Bluetooth headphones connected as default device
- **Steps:** Play audio through BT headphones, capture and measure RMS
- **Expected:** PCM data received
- **Pass Criteria:** RMS > 0.001 OR documented limitation

### AUDIO-TC-007: Stop Capture Cleanly [AUTO+HARDWARE]
- **Steps:** Start capture, stop after 2s, attempt to read after stop
- **Expected:** No data after stop, no crash
- **Pass Criteria:** isCapturing() = false, no thread leak

### AUDIO-TC-008: Device Disconnect Recovery [HARDWARE]
- **Precondition:** Capture running on device
- **Steps:** Unplug/disable audio device during capture
- **Expected:** Error handled gracefully, no crash, error event emitted
- **Pass Criteria:** Application continues, error logged

### AUDIO-TC-009: Device Change Handling [HARDWARE]
- **Precondition:** Capture running
- **Steps:** Switch Windows default output device
- **Expected:** Capture detects change, offers reconnect or auto-reconnects
- **Pass Criteria:** No crash, user notified

### AUDIO-TC-010: Restart After Stop [AUTO]
- **Steps:** Start → Stop → Start → Stop
- **Expected:** Each cycle works cleanly
- **Pass Criteria:** All cycles succeed without error

---

## Module 2: Speech-to-Text (STT)

### STT-TC-001: Model Load [AUTO]
- **Steps:** Initialize whisper with base.en model
- **Expected:** Model loads within 10s
- **Pass Criteria:** isReady() = true

### STT-TC-002: Clear English Transcription [HARDWARE]
- **Input:** "The quick brown fox jumps over the lazy dog" (spoken clearly)
- **Expected WER:** < 10%
- **Latency Target:** < 2.5s

### STT-TC-003: Indian English Transcription [HARDWARE]
- **Input:** Sample Indian English phrases with technical terms
- **Expected WER:** < 25%
- **Latency Target:** < 3s

### STT-TC-004: Fast Speech [HARDWARE]
- **Input:** Fast native English speaker (150+ WPM)
- **Expected:** No major word drops
- **Pass Criteria:** WER < 20%

### STT-TC-005: Technical Terms [HARDWARE]
- **Input:** "Kubernetes, Docker, Prometheus, API gateway, CI/CD pipeline"
- **Expected:** Terms recognized correctly or phonetically close
- **Pass Criteria:** > 70% exact match on technical terms

### STT-TC-006: No Duplicate Sentences [AUTO]
- **Steps:** Feed same audio segment twice
- **Expected:** Deduplication prevents duplicate output
- **Pass Criteria:** Zero duplicates in transcript output

### STT-TC-007: Interim vs Final [AUTO]
- **Steps:** Stream audio and observe transcript events
- **Expected:** Interim events before final confirmation
- **Pass Criteria:** Events correctly typed as interim/final

---

## Module 3: Translation (TRANS)

### TRANS-TC-001: Short Sentence [AUTO]
- **Input:** "Hello, how are you?"
- **Expected:** "Xin chào, bạn có khỏe không?"
- **Pass Criteria:** Semantic equivalence

### TRANS-TC-002: Technical Sentence [AUTO]
- **Input:** "The API endpoint returns a JSON response with a 200 status code."
- **Expected:** Technical terms (API, JSON, endpoint) preserved or transliterated
- **Pass Criteria:** No mistranslation of technical terms

### TRANS-TC-003: Proper Nouns [AUTO]
- **Input:** "John Smith from Google presented at the AWS conference."
- **Expected:** Names preserved: John Smith, Google, AWS
- **Pass Criteria:** Zero proper noun over-translation

### TRANS-TC-004: Long Sentence [AUTO]
- **Input:** Sentence > 30 words
- **Expected:** Complete translation, no truncation
- **Pass Criteria:** Full output, semantic match

### TRANS-TC-005: Continuous Stream [AUTO]
- **Input:** 5 sentences back to back
- **Expected:** No sentence pairing errors (wrong VI with wrong EN)
- **Pass Criteria:** All sentences correctly paired

### TRANS-TC-006: Translation Latency [HARDWARE]
- **Steps:** Measure time from confirmed transcript to translation display
- **Expected:** P95 ≤ 3.5s
- **Pass Criteria:** Latency within target

---

## Module 4: Answer Assistant (AI)

### AI-TC-001: Direct Question Detection [AUTO]
- **Input:** "Can you tell me about your experience with React?"
- **Expected:** Question detected, type = DIRECT
- **Pass Criteria:** Detection = true

### AI-TC-002: Indirect Question Detection [AUTO]
- **Input:** "I'd love to hear more about what you've worked on recently."
- **Expected:** Question detected, type = INDIRECT
- **Pass Criteria:** Detection = true

### AI-TC-003: Rhetorical Filter [AUTO]
- **Input:** "Isn't it amazing how far technology has come?"
- **Expected:** NOT flagged as question needing response
- **Pass Criteria:** Detection = false (no answer generated)

### AI-TC-004: Non-Personal Question Filter [AUTO]
- **Input:** "What is the capital of France?"
- **Expected:** May or may not trigger, but answer is factual, not personal
- **Pass Criteria:** No personal info fabricated

### AI-TC-005: Answer Quality — Professional [AUTO]
- **Input:** "Tell me about a challenging project you've worked on."
- **Expected:** Generic template answer, notes [customize with your experience]
- **Pass Criteria:** No fabricated project names or company names

### AI-TC-006: Answer Style Variants [AUTO]
- **Input:** Question requiring answer
- **Expected:** Short, Professional, Friendly variants available
- **Pass Criteria:** All 3 styles produce different output

### AI-TC-007: Answer Latency [HARDWARE]
- **Steps:** Measure from question detected to answer displayed
- **Expected:** P95 ≤ 5s
- **Pass Criteria:** Latency within target

### AI-TC-008: Manual Trigger [AUTO]
- **Steps:** Press "Suggest Answer" button without auto-detection
- **Expected:** Answer generated for most recent context
- **Pass Criteria:** Answer panel opens with content

---

## Module 5: Desktop UI (UI)

### UI-TC-001: Always-on-Top [HARDWARE]
- **Steps:** Open overlay, open any fullscreen app
- **Expected:** Overlay remains visible
- **Pass Criteria:** Overlay not hidden by other windows

### UI-TC-002: Draggable [HARDWARE]
- **Steps:** Drag overlay to different screen positions
- **Expected:** Overlay moves and stays at new position
- **Pass Criteria:** Position retained after drag

### UI-TC-003: Collapsible [HARDWARE]
- **Steps:** Press collapse shortcut or button
- **Expected:** Overlay minimizes to title bar only
- **Pass Criteria:** Content hidden, restore works

### UI-TC-004: Multi-Monitor [HARDWARE]
- **Steps:** Run at 1920x1080 and 2560x1440
- **Expected:** UI renders without clipping
- **Pass Criteria:** All elements visible and usable

### UI-TC-005: App Crash Recovery [AUTO]
- **Steps:** Force-close app during capture
- **Expected:** No orphaned audio threads
- **Pass Criteria:** No zombie processes after exit

---

## Benchmark Targets

| Test | Target | Measurement Method |
|------|--------|--------------------|
| Subtitle first display | P95 ≤ 2.5s | Timestamp from audio end to UI update |
| Translation display | P95 ≤ 3.5s | Timestamp from transcript confirm to VI display |
| Answer suggestion | P95 ≤ 5.0s | Timestamp from question detect to panel update |
| App startup | < 5s | Cold start to ready state |
| STT WER (clear EN) | < 10% | Comparison with ground truth |
| STT WER (Indian EN) | < 25% | Comparison with ground truth |

---

## Environment Notes

Tests marked [HARDWARE] require the physical Windows 11 machine with:
- Active audio output device
- Audio content playing (browser, media player)
- Available for hardware tests: AMD Ryzen 7 7445HS, 15GB RAM, RTX 3050

Tests marked [AUTO] can be run in this environment via cargo test.
