# 🧪 Rusper AI Voice Dictation — Master Verification & Spoken Test Suite (`test.md`)

This document is a comprehensive, end-to-end testing workbook for **Rusper**. Use these categorized spoken audio test inputs, highlighted base texts, and target setups to verify every single capability and edge-case safeguard across your system.

---

## 📑 Table of Contents
1. [Test Category 1: ✨ Voice Smart Edit (Highlight & Transform)](#-test-category-1--voice-smart-edit-highlight--transform)
2. [Test Category 2: 🗣️ Smart Verbal Self-Correction & Backtracking](#-test-category-2-️-smart-verbal-self-correction--backtracking)
3. [Test Category 3: 🧹 Emotion Stripping & Filler Word Removal](#-test-category-3--emotion-stripping--filler-word-removal)
4. [Test Category 4: 💻 Developer Mode & Spoken Prompt Expansion](#-test-category-4--developer-mode--spoken-prompt-expansion)
5. [Test Category 5: 🎯 App-Aware Context Formatting (IDE, Terminal, Email, Chat)](#-test-category-5--app-aware-context-formatting)
6. [Test Category 6: 📚 Custom Vocabulary & Phonetic Dictionary](#-test-category-6--custom-vocabulary--phonetic-dictionary)
7. [Test Category 7: 🎮 Operating Modes (Push-to-Talk vs Interactive Review)](#-test-category-7--operating-modes)
8. [Test Category 8: 🛡️ Edge Cases, Silence & Safeguards](#-test-category-8-️-edge-cases-silence--safeguards)

---

## ✨ Test Category 1: Voice Smart Edit (Highlight & Transform)

> **Instructions**: Highlight the **Base Text** in any text editor, browser input, or document. Press your Rusper hotkey (<kbd>ScrollLock</kbd> or custom trigger), speak the **Spoken Voice Directive**, and verify the **Expected Output**.

---

### Test 1.1: Highlight & Shorten / Condense
* **Target Setup**: Open Notepad or Word, type and **highlight** the following text:
  ```text
  We are currently in the process of reviewing several different architectural options for our upcoming database migration project, and we plan to finalize our decision sometime next week.
  ```
* **🗣️ Spoken Audio**:
  > *"make it shorter and direct"*
* **✅ Expected Output**:
  ```text
  We are reviewing architectural options for our database migration and will finalize our decision next week.
  ```
* **Verification Check**:
  - [ ] Selected text was replaced in-place without manual copy-pasting.
  - [ ] Word count was reduced by ~50% while preserving the core meaning.

---

### Test 1.2: Highlight & Expand with Detail
* **Target Setup**: In an issue tracker (GitHub, Jira, or text file), **highlight**:
  ```text
  Fix the login button bug.
  ```
* **🗣️ Spoken Audio**:
  > *"expand this into a detailed developer bug report description"*
* **✅ Expected Output**:
  ```text
  Investigate and resolve the issue where the login button fails to trigger authentication on click. Ensure form validation triggers correctly, error messages display upon failure, and add unit test coverage for submission states.
  ```
* **Verification Check**:
  - [ ] Expanded logically into a structured, technical bug description.

---

### Test 1.3: Highlight & Tone Shift (Casual → Executive Formal)
* **Target Setup**: In Slack, Gmail compose, or editor, **highlight**:
  ```text
  hey guys, api is broken and we cant launch today, maybe tomorrow if john fixes it
  ```
* **🗣️ Spoken Audio**:
  > *"make it sound like a professional executive status update"*
* **✅ Expected Output**:
  ```text
  Hi Team,

  Please be advised that the launch is temporarily postponed due to an API issue currently under investigation. We are working on a resolution and anticipate deploying tomorrow once verification is complete.
  ```
* **Verification Check**:
  - [ ] Slang and casual phrasing converted into crisp corporate prose.

---

### Test 1.4: Highlight & Multi-Language Translation
* **Target Setup**: In any text box, **highlight**:
  ```text
  Welcome to our new platform. Please let us know if you need any assistance getting started.
  ```
* **🗣️ Spoken Audio**:
  > *"translate this to Spanish"*
* **✅ Expected Output**:
  ```text
  Bienvenido a nuestra nueva plataforma. Por favor, háganos saber si necesita ayuda para comenzar.
  ```
* **Verification Check**:
  - [ ] Accurate Spanish translation replaces the original English selection.

---

### Test 1.5: Highlight & Targeted Revision / Entity Replacement
* **Target Setup**: **Highlight**:
  ```text
  Our team standup will take place on Tuesday at 10:00 AM in Conference Room B with the marketing department.
  ```
* **🗣️ Spoken Audio**:
  > *"change Tuesday to Friday at 2:30 PM in Room A and replace marketing with engineering"*
* **✅ Expected Output**:
  ```text
  Our team standup will take place on Friday at 2:30 PM in Conference Room A with the engineering department.
  ```
* **Verification Check**:
  - [ ] Targeted entities (day, time, room, department) replaced accurately without modifying the rest of the sentence.

---

### Test 1.6: Highlight & Convert to Markdown Bullet Points
* **Target Setup**: **Highlight**:
  ```text
  For the launch we need to configure DNS records, verify SSL certificates, run load tests on the cluster, and send notification emails to early access users.
Make it 50 words.
  ```
* **🗣️ Spoken Audio**:
  > *"turn this into a clean checklist with bullet points"*
* **✅ Expected Output**:
  ```markdown
  - Configure DNS records
  - Verify SSL certificates
  - Run load tests on the cluster
  - Send notification emails to early access users
  ```
* **Verification Check**:
  - [ ] Text cleanly restructured into markdown list items.

---

## 🗣️ Test Category 2: Smart Verbal Self-Correction & Backtracking

> **Instructions**: Set System Prompt to **Smart Self-Correction & Emotion Stripping (Banger)** in the Dashboard. Place cursor in an empty input field and speak with deliberate backtracking.

---

### Test 2.1: Date & Time Mid-Sentence Revision
* **Target Setup**: Empty text area.
* **🗣️ Spoken Audio**:
  > *"Hey team let's schedule the release call for Tuesday at 10am... actually no scratch that, 10am is too early let's do Wednesday at 2pm in room 4B... wait room 4A because the screen works there."*
* **✅ Expected Output**:
  ```text
  Schedule the release call for Wednesday at 2:00 PM in room 4A.
  ```
* **Verification Check**:
  - [ ] Discarded plans (Tuesday 10am, Room 4B) are completely erased.
  - [ ] Only the final decision (Wednesday 2:00 PM, Room 4A) is output.

---

### Test 2.2: Technical Architecture Pivot Mid-Thought
* **Target Setup**: Empty text field in VS Code or browser.
* **🗣️ Spoken Audio**:
  > *"We should probably store the session tokens in local storage... wait no, that is vulnerable to XSS attacks, let's store them in secure HTTP-only cookies with SameSite strict."*
* **✅ Expected Output**:
  ```text
  Store session tokens in secure HTTP-only cookies with SameSite=Strict to prevent XSS vulnerabilities.
  ```
* **Verification Check**:
  - [ ] Erased discarded `localStorage` thought.
  - [ ] Formatted security rationale crisply.

---

### Test 2.3: Name & Number Correction
* **Target Setup**: Empty text field.
* **🗣️ Spoken Audio**:
  > *"Please assign this ticket to Sarah... wait no, Sarah is on vacation, assign it to Alex and set the priority to P1... actually P0 because it's affecting checkout."*
* **✅ Expected Output**:
  ```text
  Assign this ticket to Alex and set the priority to P0 because it is affecting checkout.
  ```
* **Verification Check**:
  - [ ] Correct assignee (Alex) and priority (P0) retained.

---

## 🧹 Test Category 3: Emotion Stripping & Filler Word Removal

---

### Test 3.1: Frustration & Emotional Venting
* **Target Setup**: Empty input field.
* **🗣️ Spoken Audio**:
  > *"Ugh I am so sick of this stupid bug why does CSS flexbox never work on Safari, whatever, add display flex and justify content space between to the navbar container."*
* **✅ Expected Output**:
  ```text
  Add `display: flex` and `justify-content: space-between` to the navbar container.
  ```
* **Verification Check**:
  - [ ] Emotional rant (*"Ugh I am so sick of this..."*) stripped.
  - [ ] Core instruction retained with clean code syntax.

---

### Test 3.2: Extreme Stutters, Hesitations & Fillers
* **Target Setup**: Empty input field.
* **🗣️ Spoken Audio**:
  > *"Um, like, so yeah, basically, you know, we need to, like, we need to restart the staging server because the memory usage is, um, way too high."*
* **✅ Expected Output**:
  ```text
  We need to restart the staging server because the memory usage is too high.
  ```
* **Verification Check**:
  - [ ] All fillers (*"um", "like", "you know", "basically", "so yeah"*) and stuttered repetitions (*"we need to, like, we need to"*) removed.

---

## 💻 Test Category 4: Developer Mode & Spoken Prompt Expansion

> **Instructions**: Set System Prompt to **Developer & Technical Specification** in the Dashboard (or test via the Dashboard Prompt Tester).

---

### Test 4.1: Spoken Length Directive (~50 Words)
* **Target Setup**: Empty field or AI chat input (Claude / ChatGPT / Cursor).
* **🗣️ Spoken Audio**:
  > *"Create a FastAPI endpoint for uploading images make it 50 words"*
* **✅ Expected Output (approx. 50 words)**:
  ```text
  Create a FastAPI endpoint `/upload/image` accepting multipart files (`PNG`, `JPEG`, `WebP`) with a 10MB limit. Validate MIME types, generate unique UUID filenames, stream chunks asynchronously to local storage or an S3 bucket, and return a JSON payload containing the file URL, size, and upload timestamp.
  ```
* **Verification Check**:
  - [ ] The trigger phrase *"make it 50 words"* is **NOT** present in the output.
  - [ ] Expanded into a comprehensive, ~50-word developer prompt with parameters, error handling, and JSON response.

---

### Test 4.2: Spoken Prompt Enhancement Directive
* **Target Setup**: Empty text editor.
* **🗣️ Spoken Audio**:
  > *"Build a custom React debounce hook enhance this prompt to more words"*
* **✅ Expected Output**:
  ```text
  Develop a TypeScript custom React hook named `useDebounce<T>` that accepts a generic value and a delay in milliseconds. Implement `useEffect` and `setTimeout` to update the debounced state upon timer completion, ensure proper timer cleanup on unmount or dependency change, and provide unit test examples using Vitest.
  ```
* **Verification Check**:
  - [ ] Trigger *"enhance this prompt to more words"* stripped.
  - [ ] High-quality technical prompt generated with types, lifecycle cleanup, and testing instructions.

---

## 🎯 Test Category 5: App-Aware Context Formatting

> **Instructions**: Ensure **App-Aware Context Formatting** is enabled in the Dashboard. Dictate inside different active applications to verify automated tone/syntax adaptation.

---

### Test 5.1: Inside Code Editor / IDE (VS Code, Cursor)
* **Target Setup**: Focus an active file in **VS Code** (e.g. `auth.ts` or `main.rs`).
* **🗣️ Spoken Audio**:
  > *"define a function calculate total price that takes items array and discount percentage"*
* **✅ Expected Output**:
  ```text
  Define a function `calculateTotalPrice` that takes an `items` array and `discountPercentage`.
  ```
* **Verification Check**:
  - [ ] Variable identifiers formatted with `camelCase` and wrapped in markdown backticks.

---

### Test 5.2: Inside Terminal / CLI (PowerShell, Windows Terminal, CMD)
* **Target Setup**: Focus **Windows Terminal** or **PowerShell**.
* **🗣️ Spoken Audio**:
  > *"cargo build release and run migrations with verbose flag"*
* **✅ Expected Output**:
  ```text
  cargo build --release && run migrations --verbose
  ```
* **Verification Check**:
  - [ ] CLI arguments formatted as shell flags (`--release`, `--verbose`).

---

### Test 5.3: Inside Email Client (Gmail, Outlook)
* **Target Setup**: Focus compose window in **Gmail / Outlook**.
* **🗣️ Spoken Audio**:
  > *"hi team quick reminder quarterly budget reviews are due this friday please submit your department spreadsheets"*
* **✅ Expected Output**:
  ```text
  Hi Team,

  Quick reminder: quarterly budget reviews are due this Friday. Please submit your department spreadsheets on time.
  ```
* **Verification Check**:
  - [ ] Structured into professional email paragraphs with greeting and proper punctuation.

---

## 📚 Test Category 6: Custom Vocabulary & Phonetic Dictionary

> **Instructions**: Ensure preset terms or custom words are registered in the **Custom Vocabulary** tab of the Dashboard.

---

### Test 6.1: Brand Name Normalization (Rusper)
* **Target Setup**: Any text field.
* **🗣️ Spoken Audio** *(deliberately mispronounced or varied)*:
  > *"I am testing raspur dictation and rosper is really fast."*
* **✅ Expected Output**:
  ```text
  I am testing Rusper dictation and Rusper is really fast.
  ```
* **Verification Check**:
  - [ ] Spelled strictly as **"Rusper"** (never *Raspur*, *Rosper*, *Rasper*, or *Rustper*).

---

### Test 6.2: Technical Acronyms & Jargon
* **Target Setup**: Any text field.
* **🗣️ Spoken Audio**:
  > *"We deployed kubernetes with kube control and configured our c i c d pipeline for o k r tracking."*
* **✅ Expected Output**:
  ```text
  We deployed Kubernetes with kubectl and configured our CI/CD pipeline for OKR tracking.
  ```
* **Verification Check**:
  - [ ] *"kube control"* -> `kubectl`
  - [ ] *"c i c d"* -> `CI/CD`
  - [ ] *"o k r"* -> `OKR`
  - [ ] Exact casing preserved.

---

## 🎮 Test Category 7: Operating Modes

---

### Test 7.1: Push-to-Talk Capsule Mode
* **Setup**: In Dashboard -> Dictation Modes -> Select **Push-to-Talk Capsule**.
* **Steps**:
  1. Hold down your global hotkey (e.g. <kbd>ScrollLock</kbd>).
  2. Notice the sleek mini capsule appear with live audio reactive waveform.
  3. Speak: *"Testing push to talk instant dictation."*
  4. Release the hotkey.
* **✅ Expected Behavior**:
  - [ ] Capsule shows spinning processing indicator for ~200ms.
  - [ ] Text is instantly pasted into the active caret position.
  - [ ] Capsule smoothly fades out. Zero clicks needed.

---

### Test 7.2: Interactive Review Mode
* **Setup**: In Dashboard -> Dictation Modes -> Select **Interactive Review**.
* **Steps**:
  1. Tap your global hotkey once.
  2. Floating card appears with live waveform & timer. Speak: *"Testing interactive review card."*
  3. Hit <kbd>Enter</kbd> or click **Done**.
  4. Review socket displays transcribed text.
  5. Press <kbd>R</kbd> on your keyboard -> Audio re-records from scratch.
  6. Re-record speech, then press <kbd>Enter</kbd> -> Pastes text into active window.
* **✅ Expected Behavior**:
  - [ ] Keyboard shortcuts work: <kbd>Enter</kbd> (Paste), <kbd>R</kbd> (Redo), <kbd>Esc</kbd> (Cancel).

---

## 🛡️ Test Category 8: Edge Cases, Silence & Safeguards

---

### Test 8.1: No Speech / Background Silence
* **Setup**: Start dictation and remain completely silent for 3 seconds, then finish.
* **✅ Expected Output**:
  - [ ] Displays `(No audio detected)` or shows friendly toast: *"🔇 No audio detected. Left input field blank."*
  - [ ] Does **NOT** paste garbage hallucinated text (e.g. "Thank you for watching" or "Amara.org").

---

### Test 8.2: 15-Second Silence Auto-Pause
* **Setup**: Start recording in Interactive Review mode and leave microphone open in quiet room.
* **✅ Expected Behavior**:
  - [ ] After 15 seconds of continuous silence, recording pauses and displays toast warning.

---

### Test 8.3: Instant Undo Shortcut
* **Setup**: Complete any voice dictation that pastes text into an editor.
* **Steps**:
  1. Press <kbd>Ctrl + Z</kbd> (or call `undo_last_injection`).
* **✅ Expected Behavior**:
  - [ ] The entire injected text block is cleanly undone in 1 keystroke.

---

## 🏁 Master Verification Scorecard

| # | Feature Area | Test Cases | Status (Pass/Fail) | Notes |
| :-: | :--- | :--- | :---: | :--- |
| **1** | **Voice Smart Edit** | Tests 1.1 – 1.6 (Shorten, Expand, Formalize, Translate, Replace, Bullets) | ⬜ PASS / ⬜ FAIL | |
| **2** | **Self-Correction** | Tests 2.1 – 2.3 (Date/Time, Tech Pivot, Priority Changes) | ⬜ PASS / ⬜ FAIL | |
| **3** | **Emotion Stripping** | Tests 3.1 – 3.2 (Frustration Removal, Filler Words Removal) | ⬜ PASS / ⬜ FAIL | |
| **4** | **Prompt Expansion** | Tests 4.1 – 4.2 (Spoken Length ~50w, Enhanced Developer Prompts) | ⬜ PASS / ⬜ FAIL | |
| **5** | **App Context** | Tests 5.1 – 5.3 (IDE Code syntax, Terminal flags, Email paragraphs) | ⬜ PASS / ⬜ FAIL | |
| **6** | **Custom Vocabulary** | Tests 6.1 – 6.2 (Brand Spelling 'Rusper', `kubectl`, `CI/CD`, `OKR`) | ⬜ PASS / ⬜ FAIL | |
| **7** | **Operating Modes** | Tests 7.1 – 7.2 (Push-to-Talk Auto-Paste & Interactive Review Keyboard nav) | ⬜ PASS / ⬜ FAIL | |
| **8** | **Edge Safeguards** | Tests 8.1 – 8.3 (Silence Filter, 15s Timeout, 1-Click Undo) | ⬜ PASS / ⬜ FAIL | |

---

*Happy Testing! 🚀 Rusper is verified and ready for high-speed voice dictation.*
