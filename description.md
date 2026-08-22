# 🎙️ Rusper v0.1.0 — Initial Public Release

> **The Blazingly Fast, Privacy-First AI Voice Dictation OS for Windows.**

Say goodbye to expensive $20/month subscriptions. **Rusper** is a lightweight, ultra-responsive Windows voice dictation companion built with **Rust**, **Tauri v2**, and **Groq Whisper LPUs**. Speak naturally at 200+ WPM and have your thoughts transcribed across any application in under **300 milliseconds**.

---

### ✨ Key Superpowers

* ⚡ **Sub-300ms Cloud Inference**: Powered by Groq's specialized Language Processing Units (LPUs) executing OpenAI's `whisper-large-v3-turbo` in the cloud at **~216x real-time speed**.
* 🎯 **Dual Operating Modes**:
  * **Push-to-Talk Capsule**: Hold your hotkey while speaking. Releasing the key auto-pastes directly into your active window.
  * **Interactive Review Mode**: Click your hotkey once to record; review with a floating tactile card, edit, or copy before pasting.
* 🧠 **Developer Mode Spoken Prompt Expansion**:
  * Speak natural directives like *"make it 50 words"*, *"enhance this prompt to more words"*, *"expand to 100 words"*, or *"condense to 20 words"*.
  * The engine strips the command cue, extracts your seed thought, and enriches it into a full technical specification.
* 🗣️ **Smart Verbal Self-Correction**: Strips verbal fillers (*um*, *uh*, *like*) and automatically fixes mid-sentence plan changes (*"Tuesday... wait no, Thursday at 3 PM"* ➔ *"Thursday at 3:00 PM"*).
* ⌨️ **Universal Global Hotkeys**: Works everywhere across VS Code, JetBrains IDEs, Chrome, Slack, Discord, Microsoft Word, and Notion.
* 🔒 **100% Free & Privacy-First (BYOK)**: No subscription fees and no intermediate data collection. Audio streams directly from your PC to your personal Groq API endpoint.

---

### 📦 Quick Start & Installation

1. Download **`rusper_0.1.0_x64-setup.exe`** (or the `.zip` archive) below.
2. Run the installer.
3. *(If the Windows SmartScreen blue popup appears, click **More info** ➔ **Run anyway**)*.
4. Open the Rusper Dashboard, paste your free [Groq API Key](https://console.groq.com/keys), and press **`ScrollLock`** to start speaking!

---

### 🛡️ Verified Checksums (SHA-256)

| File | SHA-256 Hash |
| :--- | :--- |
| **`rusper_0.1.0_x64-setup.exe`** | `05D70E4C801E2354A51D87A537B4823B8AA74EB09B1C547369ABBFCCA726EA3B` |
| **`rusper_0.1.0_x64-setup.zip`** | `EC6655E66562ABA0770A5FA0F18B5A739A20D0D93C26BED2E6380E9E6B9C8B65` |

---

### 💡 Support & Feedback
* Report issues or suggest features on [GitHub Issues](https://github.com/ajinkya-cell/rusper/issues).
* Star the repository if Rusper saves you typing time! ⭐
