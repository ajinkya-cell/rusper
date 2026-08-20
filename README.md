<p align="center">
  <img src="public/logo.png" alt="Rusper Logo" width="100" height="100" style="border-radius: 22px; box-shadow: 0 8px 30px rgba(0,0,0,0.6);" />
</p>

<h1 align="center">Rusper</h1>

<p align="center">
  <strong>The Blazingly Fast, Privacy-First AI Voice Dictation OS for Windows.</strong>
</p>

<p align="center">
  <em>Say goodbye to $20/month subscriptions. Speak at 200+ WPM with sub-300ms cloud inference using your own free Groq API key.</em>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Release-v0.1.0--alpha-emerald?style=for-the-badge&logo=windows" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPLv3_%2B_Trademark-blue?style=for-the-badge" alt="License"></a>
  <a href="https://console.groq.com/keys"><img src="https://img.shields.io/badge/Powered_by-Groq_LPU-orange?style=for-the-badge&logo=fastapi" alt="Groq LPU"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Built_with-Tauri_v2_%2B_Rust-24c8db?style=for-the-badge&logo=rust" alt="Tauri + Rust"></a>
  <img src="https://img.shields.io/badge/Cost-%240%20%2F%20Free%20Forever-success?style=for-the-badge" alt="Free">
</p>

<p align="center">
  <a href="#-why-rusper">Why Rusper?</a> •
  <a href="#-features">Key Features</a> •
  <a href="#-developer-mode--spoken-prompt-expansion">Developer Mode</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-development">Development</a> •
  <a href="#-license">License</a>
</p>

---

## ⚡ What is Rusper?

**Rusper** is a native, ultra-responsive Windows voice dictation companion built with **Rust**, **Tauri v2**, and **React 19**. It sits quietly in your system tray and turns your natural voice into clean, formatted text across **any application** in under 300 milliseconds.

Unlike proprietary tools that lock your voice behind monthly paywalls, Rusper is **100% free**, **open-source (AGPLv3)**, and uses the **BYOK (Bring Your Own Key)** model with **Groq LPUs**—meaning your voice audio streams directly to your personal Groq endpoint with zero intermediate telemetry or server fees.

---

## ⚔️ Rusper vs. The Competition

| Feature | 🎙️ **Rusper** | 💸 **Wispr Flow** | 🪟 **Windows Dictation** |
| :--- | :---: | :---: | :---: |
| **Pricing** | **100% Free Forever** (BYOK) | **$12 – $20 / month** | Free (Bundled) |
| **Speed / Latency** | **Sub-300ms** (Groq LPUs) | ~400ms – 700ms | 1.5s – 3.0s |
| **Speech-to-Text Model** | **Whisper Large v3 Turbo** | Proprietary Whisper | Microsoft Speech SDK |
| **Developer Spoken Commands** | **Yes** (*"make it 50w"*, *"enhance prompt"*) | Basic Formatting | None |
| **Operating Modes** | **Push-to-Talk + Review Capsule** | Push-to-Talk only | Toggle only |
| **Audio Privacy** | **Direct to your API Key** | Sent to Cloud SaaS | Microsoft Cloud Telemetry |
| **Custom LLM Personas** | **Yes** (Coding, Email, Casual, Raw) | Limited | None |
| **System Footprint** | **~25 MB RAM** (Rust + WASAPI) | Electron (~300+ MB) | Windows Background Service |

---

## 🌟 Key Superpowers

### 1. ⚡ Sub-300ms Speech-to-Text
Powered by Groq's specialized Language Processing Units (LPUs), Rusper executes OpenAI's **Whisper Large v3** model in the cloud at **~216x real-time speed**, giving you instantaneous transcription with zero fan noise or CPU spikes on your PC.

### 2. 🎯 Dual Operating Modes
* **Push-to-Talk Capsule**: Hold your hotkey while speaking. Releasing the key transcribes your audio and immediately auto-pastes it into whatever application you're focused on (VS Code, Chrome, Slack, Word, Discord).
* **Interactive Review Mode**: Tap your hotkey once to record. A floating tactile overlay appears allowing you to review the text, trigger one-click copy, re-record (`R`), or inject directly (`Enter`).

### 3. 🧠 Smart Verbal Self-Correction
Saying *"Let's schedule the meeting for Tuesday... wait no, Thursday at 3 PM"* is automatically synthesized into *"Let's schedule the meeting for Thursday at 3:00 PM."* Verbal hesitations (*"um"*, *"uh"*, *"like"*) and stutters are stripped out seamlessly.

### 4. ⌨️ True Global Hotkey Flexibility
Bind your voice trigger to any physical key or combination globally across Windows:
* `ScrollLock` *(Default single-key trigger)*
* `Pause / Break`
* `Insert`
* `F8` / `F9` / `F12`
* `Ctrl + Shift + Space` / `Alt + Space`

### 5. 🎙️ High-Fidelity 16kHz Audio Engine
Multi-threaded Windows WASAPI audio capture via `cpal` resampled to 16kHz mono, equipped with built-in 90-second runaway protection and a 15-second silence auto-pause.

---

## 🧠 Developer Mode & Spoken Prompt Expansion

When you select the **Developer Persona** in the Rusper Dashboard, you can speak natural prompt-length directives directly. The engine extracts your core technical intent, strips the verbal command cue, and enriches it to match your target length:

| Spoken Cue | What Rusper Does |
| :--- | :--- |
| **🗣️ *"make it 50 words"*** | Expands the spoken concept to ~50 words with concrete inputs, outputs, and edge cases. |
| **🗣️ *"enhance this prompt to more words"*** | Generates a full architectural specification ready to paste directly into Claude, ChatGPT, or Cursor. |
| **🗣️ *"expand to 100 words"*** | Crafts an in-depth, multi-paragraph prompt or GitHub Pull Request description. |
| **🗣️ *"condense to 20 words"*** | Distills rambling thoughts into a clean, punchy single-line command. |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    A[🎙️ Microphone / WASAPI] -->|16kHz Mono Stream| B[🦀 Rust Audio Engine]
    B -->|WAV Payload| C[⚡ Groq Whisper LPU]
    C -->|Raw Transcript| D[🧠 LLM Prompt Refiner]
    D -->|Polished Text| E[📋 Windows Clipboard]
    E -->|Enigo Keystroke Injection| F[💻 Active Focused App]
    
    style A fill:#17171a,stroke:#34d399,stroke-width:2px,color:#fff
    style B fill:#17171a,stroke:#24c8db,stroke-width:2px,color:#fff
    style C fill:#17171a,stroke:#f97316,stroke-width:2px,color:#fff
    style D fill:#17171a,stroke:#a855f7,stroke-width:2px,color:#fff
    style E fill:#17171a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style F fill:#17171a,stroke:#10b981,stroke-width:2px,color:#fff
```

---

## 🚀 Quick Start

### 1. Download & Install
1. Grab the latest `Rusper-Setup.exe` from the [Releases](https://github.com/) page.
2. Run the installer. *(If the Windows SmartScreen blue popup appears, click **More info** $\rightarrow$ **Run anyway**)*.

### 2. Connect Your Free Groq Key
1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys).
2. Open the Rusper Dashboard from the system tray.
3. Paste your API key into the **AI Engine & Keys** tab and click **Save Key**.

### 3. Start Dictating!
Press **`ScrollLock`** (or your custom hotkey) anywhere in Windows and start speaking.

---

## 🛠️ Local Development

### Prerequisites
* Windows 10 or 11
* [Node.js 18+](https://nodejs.org/)
* [Rust & Cargo](https://rustup.rs/) (latest stable)
* [C++ Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Setup & Run

```bash
# 1. Clone the repository
git clone https://github.com/<YOUR_USERNAME>/rusper.git
cd rusper

# 2. Install frontend dependencies
npm install

# 3. Launch Tauri in development mode (hot-reload enabled)
npm run tauri dev
```

### Building the Release Executable (.exe)

```bash
npm run tauri build
```
The compiled installer will be located in:
`src-tauri/target/release/bundle/nsis/Rusper_0.1.0_x64-setup.exe`

---

## 🛡️ License & Trademark

Rusper is licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)** with **Section 7 Trademark & Brand Protection**:

* **Copyleft**: Any modifications or derivative software must remain 100% open source under the same AGPLv3 license.
* **Trademark Protection**: The name **"Rusper"**, the Rusper logo, and visual design assets remain the exclusive intellectual property of the project creator. Derivative works or forks must remove all "Rusper" branding prior to public distribution.

---

<p align="center">
  Built with ❤️ for developers who love speed, freedom, and tactile software.
</p>


