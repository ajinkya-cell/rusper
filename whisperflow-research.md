# Whisper Flow — Feature & Microinteraction Research

Research compiled from whisperflow.app (product site, docs, blog, comparison pages) for reference while building **flow-dictate**.

---

## 1. What makes it different (differentiators)

### 1.1 AI auto-editing, not raw transcription
- Auto-removes filler words ("um", "uh", "like"), repeated phrases, and false starts
- Corrects speech/grammar/spelling mistakes, adds punctuation + readable formatting
- Turns a rambled thought into a concise message — output is *publish-ready*, not a transcript

### 1.2 Works in every app, inline
- Dictates directly into Gmail, Slack, Docs, ChatGPT, Notion — no record-then-copy-paste flow
- The app is a background service (hotkey-driven); text types itself into the focused app

### 1.3 Personal dictionary
- Learns names, company jargon, technical terms, uncommon phrases over time
- Generic STT fails exactly here — this is the "understands me" selling point

### 1.4 Snippet library
- Spoken shortcuts expand into reusable text (intros, support replies, prompt templates)

### 1.5 Natural speech model
- No robot-speak, no dictating punctuation marks
- "Speak in complete thoughts, correct yourself when needed, let Whisper Flow organize the result"
- Designed for long-form writing, not just short commands

### 1.6 100+ languages with auto-detection
- Detects language automatically, switches mid-session effortlessly

### 1.7 Speed positioning
- 220 wpm speech vs 45 wpm typing → "4x faster"
- Brand promise is *flow state* — "less friction between thinking and writing"

### 1.8 Platform coverage
- Mac, Windows, iPhone, Android — one account everywhere

### 1.9 Pricing psychology
- Lifetime plan alongside monthly/annual options (recurring-phobic buyers)

---

## 2. Microinteractions (product-level details)

1. **Press-and-hold to dictate, release to commit** — global hotkey (`Ctrl+Shift+Space`) held while speaking; text appears in the active app on release. Hold = record, release = type. Zero clicking.
2. **Button state morph** — CTA changes from "Speak" → "Tap to end" while recording; state change, not just color
3. **Words appear instantly while speaking** (streaming, not after-you-stop)
4. **Mic permission onboarding** — explicit "Allow" prompt with a graceful path when denied ("check your browser settings") — never a dead end
5. **Recording limits surfaced in UI** ("Max recording time is 2 minutes")
6. **Theme toggle + language switcher** in the nav (implies in-app theming)
7. **Workflow personas selector** (Creators/Developers/Sales/Support/Leaders/Students) — content adapts to selection (onboarding pattern)
8. **Word-by-word highlight during replay** — transcript syncs to audio playback

---

## 3. Small details to keep in mind (implementation-level)

### 3.1 Recording / UX state machine
- Clear visual state: idle → recording (live waveform/level meter) → processing → committed
- Hold-to-record with haptic/visual "armed" feedback before mic engages (prevents clipping the first syllable)
- Cancel gesture (Esc) discards instead of committing
- Silence auto-stop after N seconds; quiet-audio hint ("we couldn't hear you")

### 3.2 Text insertion layer (the desktop magic)
- Hotkey must work over any app (system-level, tray-resident)
- Commit = type into focused field; support Undo immediately after insertion
- Streaming partial results into foreign apps is risky — insert on release; show preview UI first if streaming

### 3.3 Editing affordances
- After insertion, offer "edit/polish" affordance — fillers removed, punctuation added; show what changed (subtle diff/strike) or give rephrase options
- Undo/re-insert pattern: one-key redo of last dictation

### 3.4 Dictionary / snippets UX
- Add words *right after a misheard dictation* (in-context correction — the killer moment)
- Snippet trigger feedback: brief toast/flash so the user knows the shortcut fired

### 3.5 Language & settings
- Auto-detect badge during recording; manual override in a corner
- Personalization: tones (Formal/Casual/Funny/Polite/Social) — optional AI rewrite layer
- Local vs cloud toggle (privacy-first on-device option is a trust signal)

### 3.6 Empty / permission states
- First-run: "allow microphone" with re-request path
- No focused text field: toast "no text field detected"
- All states must never strand the user mid-flow

---

## 4. Source notes

- Product: **Whisper Flow** (whisperflow.app) — AI voice dictation for Mac, Windows, iPhone, Android
- Related but distinct: **Wispr Flow** (wisprflow.ai) — mature competitor with Basic/Pro/Team tiers, verified dictionary + snippets + per-session language detection
- Context7 has no docs for this product (not a library) — research is from web sources
