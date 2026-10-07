import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { openExternalUrl } from './utils/opener';

type Tab = 'api' | 'audio' | 'mode' | 'vocabulary' | 'hotkeys' | 'prompts' | 'article';

interface VocabularyEntry {
  id: string;
  word: string;
  category?: string;
  sounds_like?: string;
  enabled: boolean;
}

interface AppContextInfo {
  process_name: string;
  window_title: string;
  app_category: string;
  context_summary: string;
}

const PRESET_SHORTCUTS = [
  'ScrollLock',
  'Pause',
  'Insert',
  'F8',
  'F9',
  'F12',
  'Ctrl + Alt + D',
  'Ctrl + Shift + Space',
  'Alt + Space',
  'Ctrl + Alt + S',
];

const PROMPT_PRESETS = [
  {
    id: 'banger',
    name: '🔥 Smart Self-Correction & Emotion Stripping (Banger)',
    desc: 'Strips emotional venting, complaints, rambles, and filler words while resolving mid-sentence plan revisions and self-corrections into crisp, publication-ready text.',
    prompt: `You are an intelligent voice dictation cleaning engine. Your mission is to convert raw, rambling, stream-of-consciousness spoken voice into crisp, clear, publication-ready text.

CORE PROCESSING DIRECTIVES:
1. STRIP EMOTIONAL VENTING & META-COMMENTARY: Remove all emotional venting, complaints, frustration, conversational throat-clearing, and meta-talk (e.g., "Ugh I hate this bug", "Why is this so hard", "Let me see", "How do I say this"). Keep only the actual core message, thought, or instruction.
2. RESOLVE SELF-CORRECTIONS & ABANDONED THOUGHTS: If the speaker backtracks, changes their mind, corrects dates/times/names/plans, or replaces a thought mid-sentence (e.g., "Let's do Tuesday... wait no, Wednesday afternoon"), ONLY output the final chosen thought ("Let's do Wednesday afternoon."). Erase the discarded first attempt.
3. REMOVE FILLER WORDS & HESITATIONS: Completely eliminate "um", "uh", "like", "you know", "I mean", "basically", "so yeah", and stuttered/repeated words ("the the", "we need to we need to").
4. PERFECT PUNCTUATION & CAPITALIZATION: Structure into clear sentences, paragraphs, or lists where natural. Capitalize correctly.
5. PRESERVE ACCURACY & INTENT: Never invent facts or change the speaker's true meaning.
6. BRAND & KEYWORD SPELLING: Always spell the app name as "Rusper" (never "Raspur", "Raspar", "Rosper", "Rasper", "Rustper", or "Russper").

EXAMPLES:
Input: "Ugh I'm so annoyed with this bug, wait no, let's actually just fix the database query by adding an index on user_id, yeah that should do it, oh wait also tell John to deploy it by 5pm."
Output: Add an index on user_id to fix the database query, and tell John to deploy it by 5:00 PM.

Input: "Hey so um I was thinking we should maybe, you know, schedule the team meeting for 10am... actually no scratch that, 10am is too early let's do 2pm in room 4B... wait room 4A because the projector is better there."
Output: Schedule the team meeting for 2:00 PM in room 4A.

OUTPUT CONSTRAINT:
Output ONLY the final cleaned text. Do NOT include greetings, conversational replies, explanations, markdown quotes, or thinking blocks.`,
  },
  {
    id: 'email',
    name: '✉️ Professional Email & Workplace Message',
    desc: 'Transforms spoken rambles into clean, structured corporate emails and Slack/Teams messages.',
    prompt: `You are a professional executive writing assistant. Transform spoken dictation into clear, well-structured professional emails or workplace messages.

DIRECTIVES:
1. Resolve all mid-sentence self-corrections and speech revisions cleanly.
2. Format with clean paragraph breaks, proper greeting/sign-off if implied, and logical bullet points when lists are spoken.
3. Maintain a professional, polite, and direct corporate tone.
4. Erase all filler phrases, stutters, and verbal hesitations.
5. BRAND & VOCABULARY: Always spell the app name as "Rusper".
Output ONLY the finalized message body.

EXAMPLES:
Input: "hey team quick update we finished the API endpoints and tomorrow... wait Monday we launch"
Output: Hi Team,\n\nQuick update: we have completed the API endpoints. We are scheduled to launch on Monday.`,
  },
  {
    id: 'developer',
    name: '💻 Developer & Technical Specification',
    desc: 'Preserves code syntax, technical terms (camelCase, JSON, PostgreSQL), and auto-detects spoken length commands ("make it 50 words", "enhance this prompt to more words").',
    prompt: `You are a senior software engineering writing and prompt engineering assistant. Your mission is to format spoken technical notes, commit messages, PR descriptions, architectural thoughts, and AI prompts into clean, robust developer specifications.

CORE DIRECTIVES:
1. RESOLVE SELF-CORRECTIONS & CODE TERMS:
   - Resolve backtracking cleanly ("let's use Postgres... wait no, Redis" -> "Let's use Redis").
   - Preserve technical terms, API endpoints, variable names, and code syntax accurately (camelCase, snake_case, JSON, OAuth2, Docker, async/await).
   - Wrap code variables, signatures, and file names in markdown backticks (\`foo\`).

2. DYNAMIC SPOKEN LENGTH & PROMPT EXPANSION:
   - Detect spoken length or expansion directives such as:
     * "make it [N] words", "expand to [N] words", "target [N] words", "[N] word prompt"
     * "enhance this prompt to more words", "elaborate on this prompt", "make this prompt more detailed"
     * "condense this prompt", "shorten to [N] words"
   - When a length/expansion command is detected:
     a) Strip out the literal command trigger (do NOT write "make it 50 words" in the output).
     b) Extract the core technical concept or prompt goal.
     c) Dynamically expand the seed thought into a comprehensive, high-quality developer prompt or technical specification matching the requested length (~N words), incorporating inputs/outputs, edge case considerations, architectural constraints, and structure.

3. BRAND & VOCABULARY:
   - Always spell the application name as "Rusper" (never "Raspur", "Raspar", "Rosper", "Rasper", "Rustper", or "Russper").

4. OUTPUT CONSTRAINT:
   - Output ONLY the final polished, expanded developer prompt or documentation text. Never include conversational preambles, explanations, quotes, or markdown code block fences around the whole response.

EXAMPLES:
Input: "create a fast api endpoint for uploading images make it 50 words"
Output: Create a FastAPI endpoint \`/upload/image\` that accepts multipart image files (\`PNG\`, \`JPEG\`, \`WebP\`) with a 10MB size limit. Validate MIME types, generate unique UUID filenames, stream chunks asynchronously to local storage or an S3 bucket, and return a JSON payload with the file URL and upload timestamp.

Input: "build a custom react hook for debounce enhance this prompt to more words"
Output: Develop a TypeScript custom React hook named \`useDebounce<T>\` that takes a generic value and a delay in milliseconds. Use \`useEffect\` and \`setTimeout\` to delay updating the debounced state until the timer completes. Ensure proper cleanup on unmount or value change to prevent memory leaks, and include unit test examples with Vitest.`,
  },
  {
    id: 'summary',
    name: '📝 Executive Summary & Action Items',
    desc: 'Converts raw spoken brain dumps into concise markdown bullet points and action items.',
    prompt: `You are an executive assistant specializing in rapid note synthesis. Convert spoken brain dumps and meeting rambles into clean, bulleted action items and summary points.

DIRECTIVES:
1. Extract key decisions, action items, and main points.
2. Eliminate all speech revisions, stuttering, and conversational fluff.
3. BRAND SPELLING: Always spell the app name as "Rusper".
4. Present information using clear markdown bullet points and bold section headers where helpful. Output ONLY the structured summary.`,
  },
  {
    id: 'verbatim',
    name: '✍️ Minimal Polish & Clean Verbatim (Strict Original Words)',
    desc: 'Low-polishing mode: Fixes capitalization, punctuation, and stutters while keeping your EXACT spoken words and phrasing 100% intact.',
    prompt: `You are a minimal voice transcription cleaner. Your ONLY job is to add proper capitalization, fix spelling errors, add basic punctuation, and remove repeated stuttered words (e.g. 'the the').

STRICT DIRECTIVES:
1. DO NOT REWRITE OR REPHRASE: Keep the speaker's EXACT words, word order, and original phrasing completely intact. Do not change words or sentence structures.
2. DO NOT ALTER MEANING: Do not summarize, reorganize, or rewrite any thoughts.
3. STUTTER & FILLER REMOVAL ONLY: Remove duplicated stuttered words ('I I', 'the the') and explicit fillers ('um', 'uh').
4. PUNCTUATION & CAPITALIZATION ONLY: Insert missing periods, commas, question marks, and initial sentence capitalization.
5. BRAND SPELLING: If the user says the application name "Rusper", ensure it is spelled as "Rusper" (not "Raspur", "Raspar", "Rosper", etc.).
6. Output ONLY the minimally cleaned text with no comments or conversational fluff.`,
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('api');
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3-turbo');
  const [systemPrompt, setSystemPrompt] = useState(PROMPT_PRESETS[0].prompt);

  const [selectedShortcut, setSelectedShortcut] = useState('ScrollLock');
  const [customModifier, setCustomModifier] = useState('None');
  const [customKey, setCustomKey] = useState('ScrollLock');
  const [overlayPosition, setOverlayPosition] = useState('bottom-center');
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<string | null>(null);
  const [dictationMode, setDictationModeState] = useState<'interactive' | 'push_to_talk'>('interactive');
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const [isSafeguardsOpen, setIsSafeguardsOpen] = useState<boolean>(false);

  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Custom Vocabulary & Context State
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const [vocabSearch, setVocabSearch] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newSoundsLike, setNewSoundsLike] = useState('');
  const [contextAwareEnabled, setContextAwareEnabled] = useState(true);
  const [activeContext, setActiveContext] = useState<AppContextInfo | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);

  useEffect(() => {
    invoke<string | null>('get_api_key').then((key) => { if (key) setApiKey(key); }).catch(() => {});
    invoke<string>('get_saved_hotkey').then((hk) => { if (hk) setSelectedShortcut(hk); }).catch(() => {});
    invoke<string>('get_dictation_mode').then((m) => { if (m === 'push_to_talk' || m === 'interactive') setDictationModeState(m); }).catch(() => {});
    invoke<string>('get_system_prompt').then((prompt) => { if (prompt && prompt.trim()) setSystemPrompt(prompt); }).catch(() => {});
    invoke<string[]>('get_audio_devices').then((devs) => { if (devs && devs.length > 0) setAudioDevices(devs); }).catch(() => {});
    invoke<string | null>('get_selected_audio_device').then((dev) => { if (dev) setSelectedDevice(dev); }).catch(() => {});
    invoke<string>('get_overlay_position').then((pos) => { if (pos) setOverlayPosition(pos); }).catch(() => {});
    invoke<VocabularyEntry[]>('get_custom_vocabulary').then((v) => { if (v) setVocabulary(v); }).catch(() => {});
    invoke<boolean>('get_context_aware_enabled').then((b) => setContextAwareEnabled(b)).catch(() => {});
    invoke<AppContextInfo>('get_active_context_preview').then((ctx) => setActiveContext(ctx)).catch(() => {});
  }, []);

  const micTestTimerRef = useRef<number | null>(null);

  const stopTestingMic = useCallback(async () => {
    if (micTestTimerRef.current) {
      clearTimeout(micTestTimerRef.current);
      micTestTimerRef.current = null;
    }
    setIsTestingMic(false);
    setMicVolume(0);
    try {
      await invoke('stop_mic_test');
    } catch (err) {
      console.error('Stop mic test error:', err);
    }
  }, []);

  useEffect(() => {
    const unlisten = listen<number>('test-audio-volume', (event) => setMicVolume(event.payload));
    return () => {
      unlisten.then((fn: () => void) => fn());
      if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
      invoke('stop_mic_test').catch(() => {});
    };
  }, []);

  const handleDeviceChange = async (deviceName: string) => {
    setSelectedDevice(deviceName);
    try {
      await invoke('set_selected_audio_device', { deviceName });
      setHotkeySaveStatus(`Microphone set to "${deviceName}" ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
      if (isTestingMic) {
        if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
        await invoke('start_mic_test');
        micTestTimerRef.current = window.setTimeout(() => {
          stopTestingMic();
          setHotkeySaveStatus('Mic test finished (1 min limit reached) ✓');
          setTimeout(() => setHotkeySaveStatus(null), 3000);
        }, 60000);
      }
    } catch (err) { console.error('Device change error:', err); }
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
      await stopTestingMic();
    } else {
      setIsTestingMic(true);
      try {
        await invoke('start_mic_test');
        if (micTestTimerRef.current) clearTimeout(micTestTimerRef.current);
        micTestTimerRef.current = window.setTimeout(() => {
          stopTestingMic();
          setHotkeySaveStatus('Mic test finished (1 min limit reached) ✓');
          setTimeout(() => setHotkeySaveStatus(null), 3000);
        }, 60000);
      } catch (err) {
        console.error('Start mic test error:', err);
        setIsTestingMic(false);
        setHotkeySaveStatus(`Mic test error: ${err}`);
        setTimeout(() => setHotkeySaveStatus(null), 4000);
      }
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) { setSaveStatus('Please enter a valid API key'); return; }
    try {
      await invoke('save_api_key', { key: apiKey.trim() });
      setSaveStatus('API key saved successfully ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus(`Failed to save: ${err}`); }
  };

  const handleApplySystemPromptPreset = async (promptText: string) => {
    setSystemPrompt(promptText);
    try {
      await invoke('save_system_prompt', { prompt: promptText });
      setSaveStatus('System prompt updated & active ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus(`Failed to save prompt: ${err}`); }
  };

  const handleSetDictationMode = async (mode: 'interactive' | 'push_to_talk') => {
    setDictationModeState(mode);
    try {
      await invoke('set_dictation_mode', { mode });
      await invoke('sync_window_size', { mode }).catch(() => {});
      setHotkeySaveStatus(`Mode switched to ${mode === 'interactive' ? 'Interactive Review' : 'Push-to-Talk'} ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) { console.error('Set mode error:', err); }
  };

  const handleApplyPresetShortcut = async (shortcut: string) => {
    try {
      await invoke('register_hotkey', { hotkey: shortcut, shortcut });
      setSelectedShortcut(shortcut);
      setHotkeySaveStatus(`Global trigger registered: "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3500);
  };

  const handleSaveCustomShortcut = async () => {
    let shortcut = customKey;
    if (customModifier !== 'None') shortcut = `${customModifier} + ${customKey}`;
    try {
      await invoke('register_hotkey', { hotkey: shortcut, shortcut });
      setSelectedShortcut(shortcut);
      setHotkeySaveStatus(`Custom shortcut registered: "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3500);
  };

  const handleSetOverlayPosition = async (posId: string) => {
    setOverlayPosition(posId);
    try {
      await invoke('set_overlay_position', { position: posId });
      setHotkeySaveStatus(`Overlay position set to "${posId.replace('-', ' ')}" ✓`);
    } catch (err) { setHotkeySaveStatus(`Position update error: ${err}`); }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  // Vocabulary Handlers
  const handleToggleWord = async (id: string) => {
    const updated = vocabulary.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    setVocabulary(updated);
    try {
      await invoke('save_custom_vocabulary', { entries: updated });
    } catch (err) {
      console.error('Failed to update vocabulary:', err);
    }
  };

  const handleDeleteWord = async (id: string) => {
    const updated = vocabulary.filter((item) => item.id !== id);
    setVocabulary(updated);
    try {
      await invoke('delete_vocabulary_entry', { id });
      setHotkeySaveStatus('Word removed from vocabulary ✓');
      setTimeout(() => setHotkeySaveStatus(null), 2500);
    } catch (err) {
      console.error('Failed to delete word:', err);
    }
  };

  const handleAddWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordClean = newWord.trim();
    if (!wordClean) return;

    const entry: VocabularyEntry = {
      id: `word_${Date.now()}`,
      word: wordClean,
      sounds_like: newSoundsLike.trim() ? newSoundsLike.trim() : undefined,
      enabled: true,
    };

    const updated = [entry, ...vocabulary.filter((v) => v.word.toLowerCase() !== wordClean.toLowerCase())];
    setVocabulary(updated);
    setNewWord('');
    setNewSoundsLike('');

    try {
      await invoke('add_vocabulary_entry', { entry });
      setHotkeySaveStatus(`Added "${entry.word}" to custom dictionary ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to add word:', err);
    }
  };

  const handleImportDevPreset = async () => {
    try {
      const updated = await invoke<VocabularyEntry[]>('import_vocabulary_preset', { presetId: 'dev' });
      if (updated) {
        setVocabulary(updated);
        setHotkeySaveStatus('Imported Tech & Developer vocabulary pack ✓');
        setTimeout(() => setHotkeySaveStatus(null), 3000);
      }
    } catch (err) {
      console.error('Import preset error:', err);
    }
  };

  const handleCopyAllWords = () => {
    const text = vocabulary.map((v) => v.word).join(', ');
    navigator.clipboard.writeText(text);
    setHotkeySaveStatus('Copied vocabulary words to clipboard ✓');
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const handleClearAllVocabulary = async () => {
    if (!window.confirm('Clear all custom vocabulary words?')) return;
    setVocabulary([]);
    try {
      await invoke('save_custom_vocabulary', { entries: [] });
      setHotkeySaveStatus('Cleared custom vocabulary ✓');
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) {
      console.error('Clear vocabulary error:', err);
    }
  };

  const handleToggleContextAware = async (enabled: boolean) => {
    setContextAwareEnabled(enabled);
    try {
      await invoke('set_context_aware_enabled', { enabled });
      setHotkeySaveStatus(`Context-aware formatting ${enabled ? 'enabled' : 'disabled'} ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) {
      console.error('Context toggle error:', err);
    }
  };

  const handleRefreshActiveContext = async () => {
    setIsContextLoading(true);
    try {
      const ctx = await invoke<AppContextInfo>('get_active_context_preview');
      setActiveContext(ctx);
    } catch (err) {
      console.error('Failed to query context:', err);
    } finally {
      setIsContextLoading(false);
    }
  };

  const navTabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'api', label: 'AI Engine & Keys', icon: '⚡' },
    { id: 'audio', label: 'Audio & Devices', icon: '🎙️' },
    { id: 'mode', label: 'Dictation Modes', icon: '🎯' },
    { id: 'vocabulary', label: 'Custom Vocabulary', icon: '📚' },
    { id: 'hotkeys', label: 'Hotkeys & Overlay', icon: '⌨️' },
    { id: 'prompts', label: 'Prompt Engine', icon: '🧠' },
    { id: 'article', label: 'Why Rusper', icon: '💡' },
  ];

  const filteredVocabulary = vocabulary.filter((item) =>
    item.word.toLowerCase().includes(vocabSearch.toLowerCase()) ||
    (item.sounds_like && item.sounds_like.toLowerCase().includes(vocabSearch.toLowerCase()))
  );

  return (
    <div className="w-screen h-screen bg-[#070709] text-white flex flex-col select-none overflow-hidden font-ui p-5 gap-3.5">
      {/* Top macOS-style Glass Branding Header */}
      <header className="flex items-center justify-between shrink-0 px-2 py-0.5">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Rusper Logo"
            className="w-6 h-6 rounded-lg object-contain border border-white/10 shadow-sm"
          />
          <h1 className="font-display italic text-2xl font-normal tracking-tight text-white leading-none">
            Rusper
          </h1>
        </div>
        {hotkeySaveStatus && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="font-ui text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {hotkeySaveStatus}
          </motion.div>
        )}
      </header>

      {/* Main Apple macOS Split-View Layout */}
      <div className="flex flex-1 overflow-hidden gap-4">
        {/* Left Translucent Sidebar */}
        <aside className="w-60 flex flex-col shrink-0">
          <nav className="apple-sidebar rounded-2xl p-2 flex flex-col gap-1 flex-1">
            <div className="px-2.5 py-1.5">
              <span className="font-ui text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Settings
              </span>
            </div>

            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-ui text-xs transition-colors cursor-pointer text-left ${
                    isActive ? 'text-zinc-950 font-semibold' : 'text-zinc-400 font-medium hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_1px_8px_rgba(255,255,255,0.18)]"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 text-sm opacity-90">{tab.icon}</span>
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}

            {/* Bottom Active Trigger Card */}
            <div className="apple-grouped-card rounded-xl p-3 flex flex-col gap-1.5 mt-auto border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="font-ui text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Global Trigger
                </span>
                <span className="font-code text-[9px] text-zinc-400 bg-white/[0.05] px-1.5 py-0.5 rounded">
                  {dictationMode === 'interactive' ? 'Review' : 'Push-to-Talk'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="font-code text-xs font-bold text-white bg-black/40 border border-white/10 px-2.5 py-1 rounded-lg shadow-inner">
                  {selectedShortcut}
                </kbd>
              </div>
            </div>
          </nav>
        </aside>

        {/* Right Main Content Canvas */}
        <main className="flex-1 apple-main-canvas rounded-2xl overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scroll-smooth">
            <AnimatePresence mode="wait">
              {/* TAB 1: AI Engine & Keys */}
              {activeTab === 'api' && (
                <motion.div
                  key="api"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">AI Engine & API Credentials</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">Connect your Groq Cloud credentials for sub-300ms speech-to-text inference.</p>
                  </div>

                  <form onSubmit={handleSaveApiKey} className="flex flex-col gap-4">
                    <div className="apple-grouped-card rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="font-ui text-xs font-semibold text-zinc-300">Groq API Key</label>
                          <button
                            type="button"
                            onClick={() => openExternalUrl('https://console.groq.com/keys')}
                            className="font-ui text-xs text-zinc-400 hover:text-white underline cursor-pointer transition"
                          >
                            Get free API key on Groq ↗
                          </button>
                        </div>
                        <div className="flex gap-2.5">
                          <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="gsk_..."
                            className="apple-input flex-1 rounded-xl px-3.5 py-2 text-xs text-white font-code placeholder:text-zinc-600 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="apple-btn-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Save Key
                          </button>
                        </div>
                        {saveStatus && <span className="font-ui text-xs font-medium text-emerald-400 mt-1">{saveStatus}</span>}
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.05]">
                        <label className="font-ui text-xs font-semibold text-zinc-300">Whisper AI Model</label>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="apple-input w-full rounded-xl px-3.5 py-2 text-xs text-white font-code focus:outline-none cursor-pointer bg-[#0c0c10]"
                        >
                          <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Ultra Fast • ~200ms latency)</option>
                          <option value="whisper-large-v3">whisper-large-v3 (Maximum Accuracy • Multilingual)</option>
                        </select>
                      </div>
                    </div>

                    <div className="apple-grouped-card rounded-2xl p-4 flex flex-col gap-1.5 border border-white/[0.04]">
                      <span className="font-ui text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                        ⚡ Cloud Hardware Acceleration
                      </span>
                      <p className="font-ui text-xs text-zinc-400 leading-relaxed">
                        Rusper utilizes Groq Language Processing Units (LPUs) to execute Whisper Large v3 directly in the cloud at <strong>~216x real-time speed</strong>, eliminating CPU spikes, heat, and fan noise.
                      </p>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* TAB 2: Audio & Devices */}
              {activeTab === 'audio' && (
                <motion.div
                  key="audio"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">Audio Input & Microphone Test</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">Select your input device and monitor real-time hardware sampling at 16kHz mono.</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="apple-grouped-card rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <label className="font-ui text-xs font-semibold text-zinc-300">Active Microphone</label>
                          <button
                            type="button"
                            onClick={() => { invoke<string[]>('get_audio_devices').then((devs) => { if (devs) setAudioDevices(devs); }); }}
                            className="font-ui text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                          >
                            ↻ Refresh Devices
                          </button>
                        </div>
                        <select
                          value={selectedDevice}
                          onChange={(e) => handleDeviceChange(e.target.value)}
                          className="apple-input w-full rounded-xl px-3.5 py-2 text-xs text-white font-code cursor-pointer focus:outline-none bg-[#0c0c10]"
                        >
                          <option value="default">Default Windows Microphone (System Default)</option>
                          {audioDevices.map((dev, idx) => <option key={idx} value={dev}>{dev}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.05]">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-ui text-xs font-semibold text-zinc-200">Live Hardware dB Level</span>
                            {isTestingMic && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                          </div>
                          <button
                            type="button"
                            onClick={toggleMicTest}
                            className={`px-3 py-1.5 rounded-xl font-ui text-xs font-medium transition cursor-pointer ${
                              isTestingMic
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                                : 'apple-btn-secondary'
                            }`}
                          >
                            {isTestingMic ? '⏹ Stop Testing' : '▶ Test Live Levels'}
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/[0.06] relative">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                              style={{ width: `${Math.min(100, Math.max(3, Math.round(micVolume * 100)))}%` }}
                            />
                          </div>
                          <span className="font-code text-xs font-semibold text-zinc-300 shrink-0 w-10 text-right">
                            {Math.min(100, Math.round(micVolume * 100))}%
                          </span>
                        </div>

                        {/* Smooth Visualizer Bars */}
                        <div className="flex items-end justify-between h-12 pt-2 px-3 bg-black/40 rounded-xl border border-white/[0.04] overflow-hidden">
                          {Array.from({ length: 20 }).map((_, i) => {
                            const taper = Math.sin(((i + 1) / 21) * Math.PI);
                            const baseVol = Math.round(micVolume * 100);
                            const wave = Math.sin(i * 0.6 + baseVol * 0.08);
                            const dynamicHeight = isTestingMic && baseVol > 0
                              ? Math.min(100, Math.max(10, Math.round(baseVol * taper * (0.7 + wave * 0.3))))
                              : 10;
                            return (
                              <div
                                key={i}
                                className={`w-1.5 rounded-full transition-all duration-75 ${
                                  isTestingMic && baseVol > 0
                                    ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-white shadow-[0_0_6px_rgba(45,212,191,0.5)]'
                                    : 'bg-white/10'
                                }`}
                                style={{ height: `${dynamicHeight}%` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: Dictation Modes */}
              {activeTab === 'mode' && (
                <motion.div
                  key="mode"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">Dictation Operating Modes</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">Choose how Rusper interacts with your speech and active applications.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      onClick={() => handleSetDictationMode('interactive')}
                      className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${
                        dictationMode === 'interactive'
                          ? 'bg-white/[0.08] text-white border-white/40 shadow-sm'
                          : 'apple-grouped-card text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-ui text-sm font-semibold">Interactive Review</span>
                        {dictationMode === 'interactive' ? (
                          <svg
                            className="w-4 h-4 text-white shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                        )}
                      </div>
                      <p className="font-ui text-xs text-zinc-400 leading-relaxed">
                        Press hotkey once to record. Displays a floating review card to edit, redo (<kbd className="font-code text-[10px]">R</kbd>), or paste (<kbd className="font-code text-[10px]">↵</kbd>).
                      </p>
                    </button>

                    <button
                      onClick={() => handleSetDictationMode('push_to_talk')}
                      className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${
                        dictationMode === 'push_to_talk'
                          ? 'bg-white/[0.08] text-white border-white/40 shadow-sm'
                          : 'apple-grouped-card text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-ui text-sm font-semibold">Push-to-Talk Capsule</span>
                        {dictationMode === 'push_to_talk' ? (
                          <svg
                            className="w-4 h-4 text-white shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                        )}
                      </div>
                      <p className="font-ui text-xs text-zinc-400 leading-relaxed">
                        Hold hotkey while speaking. Releasing the key transcribes & auto-pastes directly into the active field with zero clicks.
                      </p>
                    </button>
                  </div>

                  {/* Smart Safeguards */}
                  <div className="apple-grouped-card rounded-2xl border border-white/[0.06] overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setIsSafeguardsOpen(!isSafeguardsOpen)}
                      className="w-full px-4 py-3 flex items-center justify-between font-ui font-medium text-zinc-300 cursor-pointer hover:bg-white/[0.03] transition"
                    >
                      <span className="flex items-center gap-2"><span>🛡️</span> Built-in Dictation Safeguards</span>
                      <span className="font-code text-xs text-zinc-500">{isSafeguardsOpen ? 'Hide ▲' : 'Details ▼'}</span>
                    </button>
                    <AnimatePresence>
                      {isSafeguardsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-4 border-t border-white/[0.04]"
                        >
                          <ul className="font-ui text-xs text-zinc-400 leading-relaxed flex flex-col gap-2 list-disc pl-4 mt-3">
                            <li><strong>90-Second Buffer Ceiling</strong>: Prevents unbounded audio capture in long dictations.</li>
                            <li><strong>15-Second Silence Auto-Pause</strong>: Auto-pauses recording when speech ceases.</li>
                            <li><strong>Active Target Validation</strong>: Confirms active application window before text injection.</li>
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: Custom Vocabulary */}
              {activeTab === 'vocabulary' && (
                <motion.div
                  key="vocabulary"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-5 max-w-2xl"
                >
                  {/* Clean Header */}
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">Custom Vocabulary</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">
                      Biases Whisper speech recognition and guarantees exact casing for specialized jargon, acronyms, and product names.
                    </p>
                  </div>

                  {/* 1. Subtle macOS App-Aware Context Switch */}
                  <div className="apple-grouped-card rounded-2xl p-4 flex items-center justify-between border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <span className="text-base opacity-80">🎯</span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-ui text-xs font-semibold text-white">App-Aware Context Formatting</span>
                          {contextAwareEnabled && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        <span className="font-ui text-[11px] text-zinc-400">
                          {activeContext ? `${activeContext.process_name} (${activeContext.app_category})` : 'Auto-adapts for IDEs, Terminals, Email, Slack'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleRefreshActiveContext}
                        disabled={isContextLoading}
                        className="text-[11px] font-ui text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Scan current foreground app"
                      >
                        {isContextLoading ? 'Scanning...' : 'Scan Context ↻'}
                      </button>

                      {/* iOS-Style Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleContextAware(!contextAwareEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          contextAwareEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      >
                        <motion.div
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`w-4 h-4 rounded-full bg-white shadow-sm ${
                            contextAwareEnabled ? 'ml-auto' : 'ml-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 2. Minimal Inline Add Bar */}
                  <form onSubmit={handleAddWordSubmit} className="apple-grouped-card rounded-2xl p-2.5 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Word or Name (e.g. Rusper, kubectl, FastAPI)"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      required
                      className="apple-input flex-1 px-3 py-1.5 rounded-xl text-xs text-white font-code focus:outline-none placeholder:text-zinc-600"
                    />
                    <input
                      type="text"
                      placeholder="Sounds like (optional, e.g. kube ctl)"
                      value={newSoundsLike}
                      onChange={(e) => setNewSoundsLike(e.target.value)}
                      className="apple-input flex-1 px-3 py-1.5 rounded-xl text-xs text-white font-ui focus:outline-none placeholder:text-zinc-600"
                    />
                    <button
                      type="submit"
                      disabled={!newWord.trim()}
                      className="apple-btn-primary px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      + Add
                    </button>
                  </form>

                  {/* 3. Apple Settings-Style Grouped Dictionary List */}
                  <div className="apple-grouped-card rounded-2xl overflow-hidden flex flex-col border border-white/[0.06]">
                    {/* Search & Counter Header */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.05] bg-black/20">
                      <div className="flex items-center gap-2">
                        <span className="font-ui text-xs font-medium text-zinc-300">Registered Words</span>
                        <span className="font-code text-[10px] text-zinc-400 bg-white/[0.06] px-2 py-0.5 rounded-full">
                          {filteredVocabulary.length}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Search dictionary..."
                        value={vocabSearch}
                        onChange={(e) => setVocabSearch(e.target.value)}
                        className="apple-input px-2.5 py-1 rounded-lg text-xs text-white font-ui focus:outline-none w-44 placeholder:text-zinc-600"
                      />
                    </div>

                    {/* Word Rows */}
                    <div className="flex flex-col divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
                      {filteredVocabulary.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs font-ui">
                          No vocabulary words found. Type a term in the add bar above.
                        </div>
                      ) : (
                        filteredVocabulary.map((item) => (
                          <div
                            key={item.id}
                            className={`px-4 py-2.5 flex items-center justify-between transition group ${
                              item.enabled ? 'hover:bg-white/[0.02]' : 'opacity-40 hover:opacity-70'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Toggle Checkbox */}
                              <button
                                type="button"
                                onClick={() => handleToggleWord(item.id)}
                                className={`w-4 h-4 rounded flex items-center justify-center border transition cursor-pointer ${
                                  item.enabled
                                    ? 'bg-white text-zinc-950 border-white'
                                    : 'border-zinc-600 bg-transparent'
                                }`}
                              >
                                {item.enabled && <span className="text-[10px] font-bold">✓</span>}
                              </button>

                              {/* Target Word */}
                              <span className="font-code text-xs font-semibold text-white tracking-wide">
                                {item.word}
                              </span>

                              {/* Phonetic Sounds-Like Badge */}
                              {item.sounds_like && (
                                <span className="font-ui text-[11px] text-zinc-400 italic">
                                  "{item.sounds_like}"
                                </span>
                              )}
                            </div>

                            {/* Hover Delete Action */}
                            <button
                              type="button"
                              onClick={() => handleDeleteWord(item.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded transition opacity-0 group-hover:opacity-100 cursor-pointer text-xs"
                              title="Delete word"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 py-2 flex items-center justify-between border-t border-white/[0.04] bg-black/10 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleImportDevPreset}
                          className="font-ui text-zinc-400 hover:text-white transition cursor-pointer text-[11px]"
                        >
                          + Tech & Dev Pack
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyAllWords}
                          className="font-ui text-zinc-400 hover:text-white transition cursor-pointer text-[11px]"
                        >
                          Copy Words
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearAllVocabulary}
                        className="font-ui text-zinc-500 hover:text-red-400 transition cursor-pointer text-[11px]"
                      >
                        Clear Dictionary
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 5: Hotkeys & Overlay */}
              {activeTab === 'hotkeys' && (
                <motion.div
                  key="hotkeys"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">Global Hotkeys & Screen Placement</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">Configure global trigger key combinations and floating overlay position.</p>
                  </div>

                  <div className="apple-grouped-card rounded-2xl p-5 flex items-center justify-between border border-white/[0.06]">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-ui text-xs font-semibold text-white">Active Global Trigger</span>
                      <span className="font-ui text-xs text-zinc-400">Press this key anywhere in Windows to dictate</span>
                    </div>
                    <kbd className="font-code text-xs font-bold text-white bg-black/50 border border-white/10 px-3 py-1.5 rounded-lg shadow-inner">
                      {selectedShortcut}
                    </kbd>
                  </div>

                  {/* Preset Grid */}
                  <div className="flex flex-col gap-2">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Quick Shortcut Presets</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_SHORTCUTS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleApplyPresetShortcut(preset)}
                          className={`px-3 py-2 rounded-xl text-xs font-code transition cursor-pointer border ${
                            selectedShortcut === preset
                              ? 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                              : 'apple-grouped-card text-zinc-300 hover:text-white hover:border-zinc-500'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Shortcut Builder */}
                  <div className="apple-grouped-card rounded-2xl p-4 flex flex-col gap-3">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Build Custom Shortcut</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={customModifier}
                        onChange={(e) => setCustomModifier(e.target.value)}
                        className="apple-input rounded-xl px-3 py-1.5 text-xs text-white font-code cursor-pointer bg-[#0c0c10]"
                      >
                        <option value="None">None (Single Key)</option>
                        <option value="Ctrl + Alt">Ctrl + Alt</option>
                        <option value="Ctrl + Shift">Ctrl + Shift</option>
                        <option value="Alt">Alt</option>
                        <option value="Ctrl">Ctrl</option>
                        <option value="Shift">Shift</option>
                      </select>
                      <span className="font-ui text-xs text-zinc-400 font-bold">+</span>
                      <select
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        className="apple-input rounded-xl px-3 py-1.5 text-xs text-white font-code cursor-pointer bg-[#0c0c10]"
                      >
                        <option value="Insert">Insert</option>
                        <option value="ScrollLock">ScrollLock</option>
                        <option value="Pause">Pause</option>
                        <option value="Space">Space</option>
                        <option value="F1">F1</option>
                        <option value="F2">F2</option>
                        <option value="F3">F3</option>
                        <option value="F4">F4</option>
                        <option value="F5">F5</option>
                        <option value="F6">F6</option>
                        <option value="F7">F7</option>
                        <option value="F8">F8</option>
                        <option value="F9">F9</option>
                        <option value="F10">F10</option>
                        <option value="F11">F11</option>
                        <option value="F12">F12</option>
                        <option value="D">D</option>
                        <option value="S">S</option>
                        <option value="A">A</option>
                        <option value="V">V</option>
                        <option value="Q">Q</option>
                        <option value="W">W</option>
                        <option value="Delete">Delete</option>
                        <option value="Home">Home</option>
                        <option value="End">End</option>
                        <option value="PageUp">PageUp</option>
                        <option value="PageDown">PageDown</option>
                        <option value="CapsLock">CapsLock</option>
                      </select>
                      <button
                        onClick={handleSaveCustomShortcut}
                        className="apple-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ml-auto"
                      >
                        Set Hotkey
                      </button>
                    </div>
                  </div>

                  {/* Overlay Position */}
                  <div className="flex flex-col gap-2">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Overlay Screen Position</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'bottom-center', label: 'Bottom Center' },
                        { id: 'bottom-right', label: 'Bottom Right' },
                        { id: 'top-right', label: 'Top Right' },
                        { id: 'center', label: 'Screen Center' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => handleSetOverlayPosition(pos.id)}
                          className={`px-3 py-2 rounded-xl font-ui text-xs font-medium transition cursor-pointer border ${
                            overlayPosition === pos.id
                              ? 'bg-white text-zinc-950 font-semibold border-white shadow-sm'
                              : 'apple-grouped-card text-zinc-300 hover:text-white hover:border-zinc-500'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 6: Prompt Engine */}
              {activeTab === 'prompts' && (
                <motion.div
                  key="prompts"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <h2 className="font-display text-2xl font-normal text-white tracking-tight">AI Prompt Tuning & Personas</h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">Select specialized editing personas or customize your custom LLM directives.</p>
                  </div>

                  {/* Preset Personas */}
                  <div className="flex flex-col gap-2">
                    <label className="font-ui text-xs font-semibold text-zinc-300">Persona Presets</label>
                    <div className="flex flex-col gap-2">
                      {PROMPT_PRESETS.map((preset) => {
                        const isSelected = systemPrompt.trim() === preset.prompt.trim();
                        const isHovered = hoveredPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onMouseEnter={() => setHoveredPresetId(preset.id)}
                            onMouseLeave={() => setHoveredPresetId(null)}
                            onClick={() => handleApplySystemPromptPreset(preset.prompt)}
                            className={`p-3.5 rounded-xl flex flex-col gap-1 transition cursor-pointer text-left border ${
                              isSelected
                                ? 'bg-white/[0.08] text-white border-white/40 shadow-sm'
                                : 'apple-grouped-card text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-ui text-xs font-semibold">{preset.name}</span>
                              {isSelected && (
                                <span className="text-[10px] bg-white text-zinc-950 px-2 py-0.5 rounded font-code font-bold">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <AnimatePresence>
                              {(isHovered || isSelected) && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="font-ui text-xs text-zinc-400 leading-relaxed mt-1"
                                >
                                  {preset.desc}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Prompt Instructions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="font-ui text-xs font-semibold text-zinc-300">Custom Prompt Instructions</label>
                      <button
                        type="button"
                        onClick={() => handleApplySystemPromptPreset(systemPrompt)}
                        className="font-ui text-xs text-white font-semibold underline hover:text-zinc-300 transition cursor-pointer"
                      >
                        Save Custom Prompt
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="apple-input w-full rounded-xl p-3.5 text-xs text-zinc-200 font-code leading-relaxed focus:outline-none resize-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* TAB 7: Story / Why */}
              {activeTab === 'article' && (
                <motion.div
                  key="article"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="flex flex-col gap-6 max-w-2xl"
                >
                  <div>
                    <div className="flex items-center gap-2 font-code text-xs text-zinc-500 mb-1">
                      <span>STORY</span> • <span>THE INSPIRATION</span>
                    </div>
                    <h2 className="font-display text-3xl font-normal text-white tracking-tight leading-snug">
                      Why I Built Rusper
                    </h2>
                    <p className="font-ui text-xs text-zinc-400 mt-1">A personal project crafted for speed, simplicity, and freedom.</p>
                  </div>

                  <div className="apple-grouped-card rounded-2xl p-6 flex flex-col gap-4 border border-white/[0.06]">
                    <article className="font-ui text-zinc-300 leading-relaxed flex flex-col gap-4 text-sm">
                      <p>
                        Recently, I saw an advertisement for tools like Whisper Flow and other voice dictation apps. The core concept felt magical: just talk, and your thoughts appear instantly on the screen without typing.
                      </p>
                      <p>
                        However, when I checked them out, I realized almost all of them were either bloated or locked behind recurring monthly subscriptions. I wondered: <em>why should something as natural as speaking to your computer cost a monthly fee?</em>
                      </p>
                      <p>
                        I had never worked with <strong>Rust</strong> before. But I did know one thing: <strong>Rust makes desktop software blazingly fast and lightweight.</strong> So I teamed up with <strong>Antigravity</strong> to build <strong>Rusper</strong> from scratch.
                      </p>
                      <p>
                        Rusper is <strong>100% free</strong> and open. There are no subscriptions, no credit cards, and no paywalls. All you need is your own free Groq API key, and it works like an absolute charm—transcribing your voice in milliseconds across any code editor, browser, or app you use.
                      </p>
                      <p className="text-zinc-500 text-xs italic pt-2 border-t border-white/[0.06]">
                        I hope Rusper saves you countless hours of typing and lets your ideas flow naturally. Enjoy! ✨
                      </p>
                    </article>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
