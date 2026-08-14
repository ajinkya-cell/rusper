import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'api' | 'audio' | 'mode' | 'hotkeys' | 'article';

const PRESET_SHORTCUTS = [
  'ScrollLock',
  'Pause',
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
    name: '🔥 Smart Self-Correction & Plan Revision (Banger)',
    desc: 'Intelligently resolves mid-sentence plan changes, stuttering, and speech revisions (e.g. "meet at 20th... wait, 21st" -> "Meet at 21st")',
    prompt: `You are an expert real-time voice transcription editor. Your job is to convert spoken stream-of-consciousness into polished, clean text while resolving all self-corrections, plan revisions, stuttering, and false starts.

RULES & EDITING DIRECTIVES:
1. RESOLVE SELF-CORRECTIONS & REVISIONS: If the speaker changes their mind, dates, times, names, or plans mid-sentence (e.g., 'let's meet on the 20th... actually no, the 21st', 'email John... wait, I mean Sarah'), ONLY output the final corrected version ('Let's meet on the 21st.', 'Email Sarah.'). Completely erase the abandoned initial thought.
2. REMOVE VERBAL FILLERS: Strip out filler words ('um', 'uh', 'like', 'you know', 'I mean', 'basically', 'sort of', 'kind of').
3. FIX STUTTERS & FALSE STARTS: Remove repeated words ('the the', 'I was I was') and false sentence starts.
4. PUNCTUATION & CAPITALIZATION: Insert clean sentence structure, proper capitalization, and correct punctuation.
5. PRESERVE INTENT & MEANING: Never alter the underlying core message or add information that was not spoken. Output ONLY the final polished text with zero conversational commentary.

EXAMPLES:
Input: "let's deploy to staging at 4... wait no make it 5pm instead"
Output: Let's deploy to staging at 5:00 PM.

Input: "um so I was thinking we should use PostgreSQL... actually wait Redis is better"
Output: I was thinking we should use Redis.`,
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
4. Erase all filler phrases, stutters, and verbal hesitations. Output ONLY the finalized message body.

EXAMPLES:
Input: "hey team quick update we finished the API endpoints and tomorrow... wait Monday we launch"
Output: Hi Team,\n\nQuick update: we have completed the API endpoints. We are scheduled to launch on Monday.`,
  },
  {
    id: 'developer',
    name: '💻 Developer & Technical Specification',
    desc: 'Preserves code syntax, technical terms (camelCase, JSON, PostgreSQL), and structures PR notes & specs.',
    prompt: `You are a senior software engineer editor for voice dictation. Format spoken technical notes, commit messages, PR descriptions, and architectural thoughts into clean developer documentation.

DIRECTIVES:
1. Resolve self-corrections ('let's use Postgres... wait no, Redis' -> 'Let's use Redis').
2. Preserve technical terms, API endpoints, variable names, and code syntax accurately (e.g., camelCase, snake_case, JSON, OAuth2, Docker, async/await).
3. Format code snippets or inline references in markdown backticks where appropriate.
4. Output crisp, technical, structured prose without filler words.

EXAMPLES:
Input: "add a new field user_id in the json response and use async await"
Output: Add a new field \`user_id\` in the JSON response and use \`async/await\`.`,
  },
  {
    id: 'summary',
    name: '📝 Executive Summary & Action Items',
    desc: 'Converts raw spoken brain dumps into concise markdown bullet points and action items.',
    prompt: `You are an executive assistant specializing in rapid note synthesis. Convert spoken brain dumps and meeting rambles into clean, bulleted action items and summary points.

DIRECTIVES:
1. Extract key decisions, action items, and main points.
2. Eliminate all speech revisions, stuttering, and conversational fluff.
3. Present information using clear markdown bullet points and bold section headers where helpful. Output ONLY the structured summary.`,
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
5. Output ONLY the minimally cleaned text with no comments or conversational fluff.`,
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('api');
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3-turbo');
  const [systemPrompt, setSystemPrompt] = useState(PROMPT_PRESETS[0].prompt);

  // Hotkey & Overlay Customization States
  const [selectedShortcut, setSelectedShortcut] = useState('ScrollLock');
  const [customModifier, setCustomModifier] = useState('None');
  const [customKey, setCustomKey] = useState('ScrollLock');
  const [overlayPosition, setOverlayPosition] = useState('bottom-center');
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<string | null>(null);
  const [dictationMode, setDictationModeState] = useState<'interactive' | 'push_to_talk'>('interactive');
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const [isSafeguardsOpen, setIsSafeguardsOpen] = useState<boolean>(false);

  // Audio Devices State
  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);

  useEffect(() => {
    invoke<string | null>('get_api_key')
      .then((key) => {
        if (key) setApiKey(key);
      })
      .catch(() => {});

    invoke<string>('get_saved_hotkey')
      .then((hk) => {
        if (hk) setSelectedShortcut(hk);
      })
      .catch(() => {});

    invoke<string>('get_dictation_mode')
      .then((m) => {
        if (m === 'push_to_talk' || m === 'interactive') {
          setDictationModeState(m);
        }
      })
      .catch(() => {});

    invoke<string>('get_system_prompt')
      .then((prompt) => {
        if (prompt && prompt.trim()) setSystemPrompt(prompt);
      })
      .catch(() => {});

    invoke<string[]>('get_audio_devices')
      .then((devs) => {
        if (devs && devs.length > 0) setAudioDevices(devs);
      })
      .catch(() => {});

    invoke<string | null>('get_selected_audio_device')
      .then((dev) => {
        if (dev) setSelectedDevice(dev);
      })
      .catch(() => {});
  }, []);

  // Listen for live mic test volume
  useEffect(() => {
    const unlisten = listen<number>('test-audio-volume', (event) => {
      setMicVolume(event.payload);
    });
    return () => {
      unlisten.then((fn: () => void) => fn());
    };
  }, []);

  const handleDeviceChange = async (deviceName: string) => {
    setSelectedDevice(deviceName);
    try {
      await invoke('set_selected_audio_device', { deviceName });
      setHotkeySaveStatus(`Microphone changed to "${deviceName}" ✓`);
      setTimeout(() => setHotkeySaveStatus(null), 3000);
    } catch (err) {
      console.error('Device change error:', err);
    }
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
      setIsTestingMic(false);
      setMicVolume(0);
      try {
        await invoke('stop_mic_test');
      } catch (err) {
        console.error('Stop mic test error:', err);
      }
    } else {
      setIsTestingMic(true);
      try {
        await invoke('start_mic_test');
        setHotkeySaveStatus('Testing microphone live... Speak into your mic! 🎙️');
      } catch (err) {
        setIsTestingMic(false);
        setHotkeySaveStatus(`Mic test error: ${err}`);
      }
    }
  };

  const handleApplySystemPromptPreset = async (presetPrompt: string) => {
    setSystemPrompt(presetPrompt);
    try {
      await invoke('save_system_prompt', { prompt: presetPrompt });
      setSaveStatus('System prompt preset saved! ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Failed to save preset: ${err}`);
    }
  };

  const handleSetDictationMode = async (mode: 'interactive' | 'push_to_talk') => {
    setDictationModeState(mode);
    try {
      await invoke('set_dictation_mode', { mode });
      setHotkeySaveStatus(`Dictation mode updated to ${mode === 'push_to_talk' ? '"Push-to-Talk (Instant Direct Paste)"' : '"Interactive Review"'} ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Mode update error: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKey.trim()) {
      setSaveStatus('Please enter a valid API key');
      return;
    }
    try {
      await invoke('save_api_key', { key: apiKey.trim() });
      setSaveStatus('API key saved securely! ✓');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Failed to save: ${err}`);
    }
  };

  const handleApplyPresetShortcut = async (shortcut: string) => {
    setSelectedShortcut(shortcut);
    try {
      await invoke('register_hotkey', { shortcut });
      setHotkeySaveStatus(`Global shortcut updated to "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const handleSaveCustomShortcut = async () => {
    let shortcut = customKey;
    if (customModifier !== 'None') {
      shortcut = `${customModifier} + ${customKey}`;
    }
    setSelectedShortcut(shortcut);
    try {
      await invoke('register_hotkey', { shortcut });
      setHotkeySaveStatus(`Custom shortcut registered: "${shortcut}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration failed: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const handleSetOverlayPosition = async (posId: string) => {
    setOverlayPosition(posId);
    try {
      await invoke('set_overlay_position', { position: posId });
      setHotkeySaveStatus(`Overlay position updated to "${posId.replace('-', ' ')}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Position update error: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  return (
    <div className="w-screen h-screen bg-[#111111] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header - Minimal Title Only */}
      <header className="px-8 pt-6 pb-2 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold tracking-wider text-white font-sans uppercase">
          Rusper
        </h1>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6 pt-2">
        {/* Sidebar Navigation - Skeuomorphic Recessed Socket */}
        <aside className="w-64 flex flex-col gap-3 shrink-0">
          <nav className="skeuo-inner-socket rounded-2xl p-2.5 flex flex-col gap-2 border border-white/[0.04]">
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'api'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              API & Model Settings
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'audio'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              Audio Input Devices
            </button>

            <button
              onClick={() => setActiveTab('mode')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'mode'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              Operating Mode
            </button>

            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'hotkeys'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              Hotkeys & Overlay
            </button>

            <button
              onClick={() => setActiveTab('article')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'article'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              Built in One Night
            </button>
          </nav>

          {/* Hotkey Hint Box */}
          <div className="skeuo-bevel-card rounded-2xl p-4 flex flex-col gap-2 mt-auto">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Active Trigger</span>
            <div className="flex items-center gap-1.5 font-mono text-xs text-white">
              <span className="skeuo-inner-socket px-2.5 py-1 rounded-md text-[11px] font-bold">{selectedShortcut}</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">Press anywhere in Windows to initiate voice dictation.</p>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 overflow-y-auto skeuo-bevel-card rounded-2xl p-6 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {/* Tab 1: API & Model Settings */}
            {activeTab === 'api' && (
              <motion.div
                key="api"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Groq API & Whisper Model Settings
                  </h2>
                </div>

                <form onSubmit={handleSaveApiKey} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300">Groq API Key</label>
                    <div className="flex gap-3">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className="skeuo-sub-well flex-1 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                      />
                      <button
                        type="submit"
                        className="skeuo-inject-btn px-5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Save Credentials
                      </button>
                    </div>
                    {saveStatus && (
                      <span className="text-xs font-medium text-emerald-400 mt-1">{saveStatus}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300">Whisper AI Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="skeuo-sub-well w-full rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-500 transition cursor-pointer"
                    >
                      <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (Ultra Fast - Default)</option>
                      <option value="whisper-large-v3">whisper-large-v3 (Maximum Accuracy)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">System Prompt Presets</label>
                      <span className="text-[11px] text-zinc-400 font-mono">Hover to preview • 1-Click Apply</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
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
                                ? 'bg-white text-black border-white/50 shadow-md font-bold'
                                : 'skeuo-inner-socket text-zinc-300 hover:text-white border-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">{preset.name}</span>
                              {isSelected && (
                                <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-mono font-semibold">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <AnimatePresence>
                              {isHovered && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className={`text-[11px] leading-relaxed mt-1 overflow-hidden ${isSelected ? 'text-zinc-700' : 'text-zinc-400'}`}
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

                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Active System Prompt Instructions</label>
                      <button
                        type="button"
                        onClick={() => handleApplySystemPromptPreset(systemPrompt)}
                        className="text-xs text-white font-semibold underline hover:text-zinc-300 transition cursor-pointer"
                      >
                        Save Custom Prompt
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="skeuo-sub-well w-full rounded-xl p-3.5 text-xs text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-zinc-500 transition resize-none"
                    />
                  </div>
                </form>
              </motion.div>
            )}

            {/* Tab 2: Audio Input Settings */}
            {activeTab === 'audio' && (
              <motion.div
                key="audio"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Audio Input Devices
                  </h2>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Active Microphone Device</label>
                      <button
                        type="button"
                        onClick={() => {
                          invoke<string[]>('get_audio_devices').then(devs => {
                            if (devs) setAudioDevices(devs);
                          });
                        }}
                        className="text-[11px] text-zinc-400 hover:text-white underline font-mono cursor-pointer"
                      >
                        Refresh Devices
                      </button>
                    </div>
                    <select
                      value={selectedDevice}
                      onChange={(e) => handleDeviceChange(e.target.value)}
                      className="skeuo-sub-well w-full rounded-xl px-4 py-2.5 text-xs text-white font-mono cursor-pointer focus:outline-none focus:border-zinc-500 transition"
                    >
                      <option value="default">Default Windows Microphone (System Default)</option>
                      {audioDevices.map((dev, idx) => (
                        <option key={idx} value={dev}>
                          {dev}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="skeuo-inner-socket rounded-2xl p-4 flex flex-col gap-3 border border-white/[0.04]">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-300">Live Microphone Level & Audio Tester</span>
                        {isTestingMic && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={toggleMicTest}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          isTestingMic
                            ? 'bg-rose-950 text-rose-200 border-rose-700 hover:bg-rose-900'
                            : 'skeuo-raised-btn text-zinc-200 hover:text-white border-zinc-700'
                        }`}
                      >
                        {isTestingMic ? 'Stop Testing' : 'Test Microphone Live'}
                      </button>
                    </div>

                    {/* Live Volume Percentage Progress Bar */}
                    <div className="flex items-center gap-3">
                      <div className="w-full h-3.5 skeuo-sub-well rounded-full overflow-hidden p-0.5 relative">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-75"
                          style={{ width: `${Math.min(100, Math.max(3, Math.round(micVolume * 100)))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-white shrink-0 w-12 text-right">
                        {Math.min(100, Math.round(micVolume * 100))}%
                      </span>
                    </div>

                    {/* Animated 16-Bar Equalizer Visualizer */}
                    <div className="flex items-end justify-between h-10 pt-2 px-1">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const baseVol = Math.round(micVolume * 100);
                        const wave = Math.sin((i * 0.7) + (baseVol * 0.1));
                        const heightPct = isTestingMic
                          ? Math.min(100, Math.max(12, Math.round(baseVol * (0.6 + wave * 0.4))))
                          : 12;
                        return (
                          <div
                            key={i}
                            className="w-1.5 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-full transition-all duration-75"
                            style={{ height: `${heightPct}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Operating Mode Preferences */}
            {activeTab === 'mode' && (
              <motion.div
                key="mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Operating Mode Selection
                  </h2>
                </div>

                {hotkeySaveStatus && (
                  <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs px-4 py-2.5 rounded-xl font-medium">
                    {hotkeySaveStatus}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleSetDictationMode('interactive')}
                      className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${
                        dictationMode === 'interactive'
                          ? 'bg-white text-black border-white/50 shadow-md font-bold'
                          : 'skeuo-inner-socket text-zinc-300 hover:text-white border-white/[0.04]'
                      }`}
                    >
                      {dictationMode === 'interactive' && (
                        <svg className="w-5 h-5 text-black absolute top-4 right-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.707 8.707a1 1 0 00-1.414-1.414L11 12.586l-1.707-1.707a1 1 0 00-1.414 1.414l2.414 2.414a1 1 0 001.414 0l4.707-4.707z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold">Interactive Review Mode</span>
                      </div>
                      <p className={`text-xs leading-relaxed ${dictationMode === 'interactive' ? 'text-zinc-700' : 'text-zinc-400'}`}>
                        Click hotkey once to record. Displays a floating pop-up before injecting text.
                      </p>
                    </button>

                    <button
                      onClick={() => handleSetDictationMode('push_to_talk')}
                      className={`relative p-5 rounded-2xl flex flex-col gap-2 transition cursor-pointer text-left border ${
                        dictationMode === 'push_to_talk'
                          ? 'bg-white text-black border-white/50 shadow-md font-bold'
                          : 'skeuo-inner-socket text-zinc-300 hover:text-white border-white/[0.04]'
                      }`}
                    >
                      {dictationMode === 'push_to_talk' && (
                        <svg className="w-5 h-5 text-black absolute top-4 right-4" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.707 8.707a1 1 0 00-1.414-1.414L11 12.586l-1.707-1.707a1 1 0 00-1.414 1.414l2.414 2.414a1 1 0 001.414 0l4.707-4.707z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold">Push-to-Talk Mode</span>
                      </div>
                      <p className={`text-xs leading-relaxed ${dictationMode === 'push_to_talk' ? 'text-zinc-700' : 'text-zinc-400'}`}>
                        Hold hotkey while speaking. Releasing key transcribes & pastes text directly into active app.
                      </p>
                    </button>
                  </div>

                  {/* Collapsible Accordion: Smart Dictation Safeguards */}
                  <div className="skeuo-inner-socket rounded-2xl border border-white/[0.04] overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setIsSafeguardsOpen(!isSafeguardsOpen)}
                      className="w-full px-4 py-3.5 flex items-center justify-between font-semibold text-white cursor-pointer hover:bg-white/5 transition"
                    >
                      <span className="flex items-center gap-2">
                        <span>🛡️</span> Built-in Smart Dictation Safeguards & Limits
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {isSafeguardsOpen ? '▲ Hide' : '▼ View Details'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {isSafeguardsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-4 border-t border-white/[0.04]"
                        >
                          <ul className="text-[11px] text-zinc-400 leading-relaxed flex flex-col gap-2 list-disc pl-4 mt-3 font-mono">
                            <li><strong>90-Second Max Recording Limit</strong>: Hard stop and auto-processing after 1 min 30 sec.</li>
                            <li><strong>15-Second Silence Auto-Pause</strong>: Auto-pauses recording if no audio volume is detected for 15s.</li>
                            <li><strong>Active Text Field Validation</strong>: Checks Win32 active app window before pasting.</li>
                            <li><strong>Instant Undo Support</strong>: Revert last dictation chunk via <strong>↩ Undo</strong> button or <code>Ctrl + Z</code>.</li>
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 4: Hotkeys & Overlay Preferences */}
            {activeTab === 'hotkeys' && (
              <motion.div
                key="hotkeys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Hotkeys & Overlay
                  </h2>
                </div>

                {hotkeySaveStatus && (
                  <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs px-4 py-2.5 rounded-xl font-medium">
                    {hotkeySaveStatus}
                  </div>
                )}

                {/* Section 1: Current Shortcut Display */}
                <div className="skeuo-inner-socket rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white">Current Global Trigger Shortcut</h3>
                  </div>
                  <span className="skeuo-raised-btn px-4 py-2 rounded-xl text-xs font-mono font-bold">
                    {selectedShortcut}
                  </span>
                </div>

                {/* Section 2: Premade Shortcut Presets */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-zinc-300">Premade Shortcut Presets</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {PRESET_SHORTCUTS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleApplyPresetShortcut(preset)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-mono transition cursor-pointer border ${
                          selectedShortcut === preset
                            ? 'bg-white text-black font-bold border-white/40 shadow-md'
                            : 'skeuo-sub-well text-zinc-300 hover:text-white hover:border-zinc-600'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 3: Custom Hotkey Builder */}
                <div className="skeuo-inner-socket rounded-2xl p-4 flex flex-col gap-3">
                  <label className="text-xs font-semibold text-zinc-300">Build Custom Hotkey Combination</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={customModifier}
                      onChange={(e) => setCustomModifier(e.target.value)}
                      className="skeuo-sub-well rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
                    >
                      <option value="None">None (Single Key)</option>
                      <option value="Ctrl + Alt">Ctrl + Alt</option>
                      <option value="Ctrl + Shift">Ctrl + Shift</option>
                      <option value="Alt">Alt</option>
                      <option value="Ctrl">Ctrl</option>
                    </select>

                    <span className="text-xs text-zinc-400 font-bold">+</span>
                    <select
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="skeuo-sub-well rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer"
                    >
                      <option value="ScrollLock">ScrollLock</option>
                      <option value="Pause">Pause</option>
                      <option value="Insert">Insert</option>
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
                    </select>

                    <button
                      onClick={handleSaveCustomShortcut}
                      className="skeuo-inject-btn px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ml-auto"
                    >
                      Set Custom Hotkey
                    </button>
                  </div>
                </div>

                {/* Fn Key Technical Callout Note */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-zinc-300">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    ℹ Note on Laptop Fn Key
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    The <strong>Fn key</strong> on laptops is a hardware-level firmware modifier that does not emit standard OS key events to Windows. For 1-click or easy access, select options like <strong>Alt + Space</strong>, <strong>Ctrl + Shift + Space</strong>, <strong>Ctrl + Alt + D</strong>, or <strong>F1-F12</strong>.
                  </p>
                </div>

                {/* Section 4: Overlay Position Customization */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-zinc-300">Pop-up Overlay Screen Position</label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { id: 'bottom-center', label: 'Bottom Center' },
                      { id: 'bottom-right', label: 'Bottom Right' },
                      { id: 'top-right', label: 'Top Right' },
                      { id: 'center', label: 'Screen Center' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => handleSetOverlayPosition(pos.id)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                          overlayPosition === pos.id
                            ? 'bg-white text-black font-bold border-white/40 shadow-md'
                            : 'skeuo-sub-well text-zinc-300 hover:text-white hover:border-zinc-600'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 5: Built in One Night Article */}
            {activeTab === 'article' && (
              <motion.div
                key="article"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="article-section flex flex-col gap-6 max-w-3xl"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-article-body mb-1">
                    <span>ESSAY</span> • <span>AUGUST 2026</span> • <span>5 MIN READ</span>
                  </div>
                  <h2 className="font-article-heading text-2xl font-extrabold text-white tracking-tight leading-snug">
                    Crafting Rusper: How an AI Voice Dictation Engine Was Built Overnight
                  </h2>
                  <p className="font-article-heading text-xs text-zinc-300 mt-1">
                    An architectural retrospective on pairing Rust audio threads with Groq Whisper and modern React skeuomorphs.
                  </p>
                </div>

                <article className="font-article-body text-zinc-300 leading-relaxed flex flex-col gap-4 text-xs">
                  <p>
                    The story of <strong>Rusper</strong> began with a simple frustration: voice dictation tools on desktop were either bloated, slow, or locked behind expensive monthly subscriptions. We wanted something instant—a sleek utility that stays ready in the Windows system tray and converts speech into active text within milliseconds of pressing a hotkey.
                  </p>

                  <h3 className="font-article-heading text-base font-bold text-white mt-2">
                    1. The Multi-Threaded Audio Pipeline in Rust
                  </h3>
                  <p>
                    Using Tauri v2 and Rust, we leveraged <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">cpal</code> to hook directly into the Windows WASAPI audio subsystem at 16kHz mono sampling. Audio samples are streamed asynchronously into an in-memory buffer and flushed to disk using <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">hound::WavWriter</code>.
                  </p>

                  <h3 className="font-article-heading text-base font-bold text-white mt-2">
                    2. Sub-Second Transcriptions with Groq Whisper
                  </h3>
                  <p>
                    The moment you hit <kbd className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">Enter</kbd>, the recorded audio payload is posted via multipart binary stream directly to Groq Cloud's ultra-fast Whisper engine (<code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">whisper-large-v3-turbo</code>). Transcriptions return in under 300 milliseconds.
                  </p>

                  <h3 className="font-article-heading text-base font-bold text-white mt-2">
                    3. Clipboard Injection & Enigo Key Simulation
                  </h3>
                  <p>
                    Once transcribed, Rusper writes the text payload directly to the OS clipboard via <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">arboard</code> and simulates a physical <kbd className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">Ctrl + V</kbd> keystroke via <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">enigo</code>, pasting your speech directly into Notepad, Word, or your web browser.
                  </p>

                  <h3 className="font-article-heading text-base font-bold text-white mt-2">
                    4. Skeuomorphic 3D Beveled Design
                  </h3>
                  <p>
                    Finally, the interface was crafted using a tactile 3D beveled dark charcoal chassis (<code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">#171717</code>) with recessed obsidian sockets (<code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">#070707</code>), top specular light catches, and glowing white waveform animations.
                  </p>
                </article>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
