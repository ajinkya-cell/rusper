# 🚀 Rusper (Flow-Dictate): Product Enhancement & Aesthetic Roadmap

This document outlines high-impact visual, sensory, and functional ideas to make Rusper look, feel, and perform like an industry-leading desktop AI app (competing with **Wispr Flow, Superwhisper, Raycast, and Apple Dynamic Island**).

---

## 🎨 Category A: Visual Aesthetics & Motion Design

### 1. 🌊 Real-Time Audio-Reactive Waveform
* **Current State**: A looping CSS/Framer animation that moves uniformly regardless of whether you are speaking or silent.
* **The Upgrade**: Connect the waveform visualizer directly to the real-time audio volume stream (`audio-volume` event).
  * Bars dynamically surge, pulse, and illuminate in response to your voice amplitude and frequency.
  * Voice intensity creates a subtle glowing gradient aura behind the capsule.
* **Visual Inspiration**: Siri / Apple Intelligence wave & Teenage Engineering OP-1 visualizer.

### 2. 💊 Dynamic Island Glassmorphic Capsule
* **Current State**: A simple dark capsule on screen.
* **The Upgrade**:
  * Frosted acrylic glassmorphism (`backdrop-filter: blur(28px)` with ultra-subtle `1px` translucent edge sheen).
  * **Live Duration Timer** (e.g. `00:03`) with a pulsing neon red/cyan recording dot.
  * Ultra-smooth spring-physics transitions when expanding from a tiny capsule into a review card.

### 3. 🎭 Custom Visual Themes
* Provide a **Theme Selector** in the Dashboard:
  * **Obsidian Noir** (Default): Ultra-deep OLED true-black with brushed steel tactile borders.
  * **Titanium Slate**: Space-gray frosted acrylic with cool silver highlights (Raycast / macOS style).
  * **Cyber Amber**: Warm retro-futuristic glowing amber typography and amber waveform.
  * **Pure Frost**: Minimal translucent glass with crisp monochrome accents.

### 4. ⌨️ Tactile Mechanical Keycap Badges
* Replace plain text badges with 3D-styled mechanical keycaps for keyboard shortcuts:
  * `[ ↵ Paste ]`, `[ R Redo ]`, `[ Esc Dismiss ]`, `[ E Quick Edit ]`.
  * Subtle depression animation and glow when pressed on your physical keyboard.

---

## 🔊 Category B: Audio & Haptic Sensory Feedback

### 5. 🎧 Tactile Synthesized Sound Engine (Zero-Asset Web Audio API)
* Zero external audio files required (synthesized on-the-fly using browser Web Audio oscillators):
  * **Mic Active**: Soft futuristic frequency blip when recording begins.
  * **Transcribed**: Subtle, satisfying harmonic two-tone chime when text is ready.
  * **Pasted**: Crisp tactile snap sound as text enters your active application.
  * **Cancelled**: Gentle low-frequency drop.
* Fully customizable in settings: **Mute Toggle** and **Volume Slider**.

---

## ⚡ Category C: Floating HUD Superpowers & Text Tools

### 6. ✨ 1-Click Quick AI Transform Chips (Pre-Paste Formatting)
* In Interactive Review mode, add 1-click transformation pill buttons right above the text before pasting:
  * `✨ Formalize`: Transforms spoken casual draft into polished corporate/professional prose.
  * `📋 Bullets`: Automatically formats thoughts into crisp markdown bullet points.
  * `💻 Code`: Preserves and wraps code variables, JSON keys, and markdown backticks.
  * `⚡ Shorten`: Condenses wordy speech into a punchy, direct sentence.
  * `✍️ Verbatim`: Restores the raw, exact transcribed words with zero LLM alterations.

### 7. 📊 Live Speech Stats & Speaking Pace
* Display real-time telemetry underneath the transcription:
  * **Word Count** (e.g. `42 words`)
  * **Speaking Speed** (e.g. `165 WPM • Fast pace`)
  * **Reading Time** (e.g. `~12 sec read`)

### 8. 📋 Direct Inline Editing & 1-Click Clipboard Copy
* Allow clicking anywhere inside the review text to make instant typing adjustments.
* A floating **Copy Button** with an animated checkmark (`Copied! ✓`) in case you want the text in your clipboard without auto-injecting into the current window.

---

## 📜 Category D: Productivity, History & Dashboard

### 9. 🗄️ Dictation History & Snippet Vault
* Add a dedicated **"📜 Dictation History"** tab to the Dashboard:
  * Stores past dictations locally on your machine with timestamps and word counts.
  * **Search & Filter**: Search through anything you've ever dictated.
  * **1-Click Actions**: Re-copy to clipboard, delete item, or clear all history.
  * **Export**: Export history to a clean `.md` or `.txt` file.

### 10. 🎙️ Real-Time Hardware dB Peak Meter
* In the **Audio & Devices** settings tab:
  * Live visual VU/dB audio meter with green/yellow/red peak indicators.
  * Visual confirmation of microphone sensitivity and background noise levels before dictating.

### 11. 🧠 AI Prompt Playground & Scratchpad
* In the **Prompt Engine** tab:
  * A live test sandbox where you can type or speak sample text to see how your custom system prompt transforms it in real time before setting it live.

### 12. 🎯 App-Aware Context Presets (Smart Profiles)
* Ability to link prompt personas to active applications:
  * Automatically switch to **Developer & Technical Specification** when inside VSCode, Cursor, or Windows Terminal.
  * Automatically switch to **Professional Email** when inside Outlook, Gmail, or Slack.
  * Automatically switch to **Smart Self-Correction (Banger)** for all other apps.

---

## 🎛️ Category E: Windows Native Polish & Quick Tray Controls

### 13. 📍 Screen Placement Presets & Edge Snapping
* Expand overlay placement options:
  * **Follow Cursor / Active Window**: Positions the review card directly above the text caret or active window.
  * **Dock to Screen Edge**: Snaps cleanly to the top-center (Dynamic Island), bottom-center, or bottom-right.

### 14. 🖱️ Quick System Tray Menu Controls
* Right-clicking the Rusper tray icon allows:
  * 1-click Dictation Mode toggle (`Interactive` ↔ `Push-to-Talk`).
  * 1-click Persona switcher (`🔥 Banger`, `✉️ Email`, `💻 Developer`, `✍️ Verbatim`).
  * Current global hotkey quick indicator.

---

## 📋 Selection Checklist

Which of these would you like to implement first? Pick any numbers or categories:

| Category | Features | Priority |
| :--- | :--- | :--- |
| **A: Visuals & Motion** | Audio-Reactive Waveform (#1), Glassmorphic Island (#2), Themes (#3), Keycaps (#4) | ⭐⭐⭐ |
| **B: Audio SFX** | Synthesized Sound Feedback Engine (#5) | ⭐⭐⭐ |
| **C: Floating HUD** | 1-Click AI Transforms (#6), Live Speech Stats (#7), Direct Inline Edit & Copy (#8) | ⭐⭐⭐ |
| **D: Vault & Settings**| Dictation History Vault (#9), Hardware dB Meter (#10), Prompt Playground (#11) | ⭐⭐⭐ |
| **E: Native Polish** | Tray Quick Controls (#14), App-Aware Profiles (#12) | ⭐⭐ |

---

*Select the features you'd like to add, and we will build them step by step!*
