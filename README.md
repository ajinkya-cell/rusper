# Rusper 🎙️✨
> **Fast, Tactile AI Voice Dictation for Windows** — Powered by Rust, Tauri v2, Groq Whisper, and Skeuomorphic Design.

---

## Overview

**Rusper** is a lightweight, ultra-responsive voice dictation utility designed for speed and simplicity. It sits quietly in the Windows system tray and converts speech into clean, polished text in under 300 milliseconds.

- ⚡ **Sub-Second Latency**: Streams audio payloads directly to Groq Cloud's `whisper-large-v3-turbo` on dedicated LPUs.
- 🎯 **Dual Dictation Modes**:
  - **Interactive Review Mode**: Press a hotkey to record; review, redo, or edit with quick hotkeys (`Enter` to Paste, `R` to Redo, `Esc` to Cancel).
  - **Push-to-Talk Capsule**: Hold your shortcut to speak; releasing auto-pastes directly into your focused app.
- 🧠 **Smart Self-Correction Prompt Engine**: Fixes mid-sentence plan changes, eliminates verbal fillers (*um*, *uh*), and fixes stutters seamlessly.
- ⌨️ **Universal Global Hotkeys**: Works across all Windows games, IDEs (VS Code, JetBrains), browsers, and word processors.
- 🎨 **Tactile 3D Skeuomorphic Interface**: Curated typographic hierarchy featuring **Instrument Serif**, **DM Sans**, and **JetBrains Mono**.

---

## Getting Started

### Prerequisites
- Windows 10/11
- [Node.js 18+](https://nodejs.org/)
- [Rust & Cargo](https://rustup.rs/)
- Free [Groq Cloud API Key](https://console.groq.com/keys)

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/<YOUR_USERNAME>/rusper.git
cd rusper

# 2. Install dependencies
npm install

# 3. Start local development mode
npm run tauri dev
```

### Building Standalone Installers (.exe / .msi)

```bash
npm run tauri build
```

The standalone installer will be packaged in:
`src-tauri/target/release/bundle/nsis/Rusper_0.1.0_x64-setup.exe`

---

## Architecture

```
[ Microphone (WASAPI) ] ──> [ cpal 16kHz Mono ] ──> [ Groq Whisper API ]
                                                            │
                                                     (Sub-300ms Transcribe)
                                                            │
                                                            ▼
[ Focused Active App ] <── [ Enigo Ctrl+V ] <── [ Clipboard Injection ]
```

- **Audio Engine**: Multi-threaded WASAPI capture via `cpal` with real-time dB-normalized RMS level metering.
- **IPC & Windowing**: Pure floating transparent overlay window with zero taskbar intrusion using Tauri v2.
- **Frontend**: React 19, Tailwind CSS, Framer Motion, with responsive sound-wave visualizers.

---

## License

MIT License © 2026 Rusper.

