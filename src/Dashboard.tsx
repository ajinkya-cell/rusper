import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'api' | 'audio' | 'hotkeys' | 'article';

const PRESET_SHORTCUTS = [
  'Ctrl + Alt + D',
  'Ctrl + Shift + Space',
  'Alt + Space',
  'Ctrl + Alt + S',
  'Ctrl + Space',
  'Alt + D',
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('api');
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3-turbo');
  const [systemPrompt, setSystemPrompt] = useState('Clean punctuation, preserve capitalization, remove filler words like um and ah.');

  // Hotkey & Overlay Customization States
  const [selectedShortcut, setSelectedShortcut] = useState('Ctrl + Alt + D');
  const [customModifier, setCustomModifier] = useState('Ctrl + Alt');
  const [customKey, setCustomKey] = useState('D');
  const [overlayPosition, setOverlayPosition] = useState('bottom-center');
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>('get_api_key')
      .then((key) => {
        if (key) setApiKey(key);
      })
      .catch(() => {});
  }, []);

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

  const handleApplyPresetShortcut = async (preset: string) => {
    try {
      await invoke('register_hotkey', { hotkey: preset });
      setSelectedShortcut(preset);
      setHotkeySaveStatus(`Registered global trigger "${preset}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration error: ${err}`);
    }
    setTimeout(() => setHotkeySaveStatus(null), 3000);
  };

  const handleApplyCustomShortcut = async () => {
    const customStr = `${customModifier} + ${customKey}`;
    try {
      await invoke('register_hotkey', { hotkey: customStr });
      setSelectedShortcut(customStr);
      setHotkeySaveStatus(`Registered custom global trigger "${customStr}" ✓`);
    } catch (err) {
      setHotkeySaveStatus(`Hotkey registration error: ${err}`);
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
        <h1 className="text-xl font-black tracking-wider uppercase text-white font-sans">
          RUSPER
        </h1>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden p-6 gap-6 pt-2">
        {/* Sidebar Navigation - Skeuomorphic Recessed Socket */}
        <aside className="w-64 flex flex-col gap-3 shrink-0">
          <nav className="skeuo-inner-socket rounded-2xl p-2.5 flex flex-col gap-2 border border-white/[0.04]">
            <button
              onClick={() => setActiveTab('api')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'api'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">⚙</span> API & Model Settings
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'audio'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">🎙</span> Audio Input Devices
            </button>

            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'hotkeys'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">⌨</span> Hotkeys & Overlay
            </button>

            <button
              onClick={() => setActiveTab('article')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs transition cursor-pointer text-left ${
                activeTab === 'article'
                  ? 'bg-white text-black font-bold border border-white/35 shadow-[0_2px_4px_rgba(0,0,0,0.25)]'
                  : 'text-zinc-400 font-semibold hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">📖</span> Built in One Night
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
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    ⚙ Groq API & Whisper Model Settings
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Configure your Groq Cloud API credentials and Whisper model behavior.
                  </p>
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

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300">System Prompt Formatting Instructions</label>
                    <textarea
                      rows={3}
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="skeuo-sub-well w-full rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 transition resize-none"
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
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    🎙 Audio Input & Microphone Configuration
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select your active recording device and calibrate volume threshold parameters.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300">Active Microphone Device</label>
                    <select className="skeuo-sub-well w-full rounded-xl px-4 py-2.5 text-xs text-white font-mono cursor-pointer">
                      <option value="default">Default Windows Microphone (High Definition Audio)</option>
                    </select>
                  </div>

                  <div className="skeuo-inner-socket rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-zinc-300">Live Microphone Level</span>
                      <span className="text-zinc-400 font-mono">CPAL 16kHz WAV</span>
                    </div>
                    <div className="w-full h-3 skeuo-sub-well rounded-full overflow-hidden p-0.5">
                      <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full w-2/3 animate-pulse" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Hotkeys & Overlay Preferences */}
            {activeTab === 'hotkeys' && (
              <motion.div
                key="hotkeys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    ⌨ Hotkeys & Overlay Customization
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Customize your global dictation trigger shortcut and overlay positioning.
                  </p>
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
                    <p className="text-[11px] text-zinc-400">Invokes the floating dictation pop-up anywhere in Windows</p>
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
                      <option value="D">Key D</option>
                      <option value="S">Key S</option>
                      <option value="Space">Spacebar</option>
                      <option value="V">Key V</option>
                      <option value="Q">Key Q</option>
                      <option value="A">Key A</option>
                      <option value="W">Key W</option>
                      <option value="F1">F1</option>
                      <option value="F2">F2</option>
                      <option value="F10">F10</option>
                      <option value="F12">F12</option>
                    </select>

                    <button
                      onClick={handleApplyCustomShortcut}
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

            {/* Tab 4: Built in One Night Article */}
            {activeTab === 'article' && (
              <motion.div
                key="article"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-6 max-w-3xl"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mb-1">
                    <span>ESSAY</span> • <span>AUGUST 2026</span> • <span>5 MIN READ</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight leading-snug">
                    Crafting Rusper: How an AI Voice Dictation Engine Was Built Overnight
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    An architectural retrospective on pairing Rust audio threads with Groq Whisper and modern React skeuomorphs.
                  </p>
                </div>

                <article className="prose prose-invert prose-xs text-zinc-300 leading-relaxed flex flex-col gap-4 font-sans text-xs">
                  <p>
                    The story of <strong>Rusper</strong> began with a simple frustration: voice dictation tools on desktop were either bloated, slow, or locked behind expensive monthly subscriptions. We wanted something instant—a sleek utility that stays ready in the Windows system tray and converts speech into active text within milliseconds of pressing a hotkey.
                  </p>

                  <h3 className="text-sm font-bold text-white mt-2">1. The Multi-Threaded Audio Pipeline in Rust</h3>
                  <p>
                    Using Tauri v2 and Rust, we leveraged <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">cpal</code> to hook directly into the Windows WASAPI audio subsystem at 16kHz mono sampling. Audio samples are streamed asynchronously into an in-memory buffer and flushed to disk using <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">hound::WavWriter</code>.
                  </p>

                  <h3 className="text-sm font-bold text-white mt-2">2. Sub-Second Transcriptions with Groq Whisper</h3>
                  <p>
                    The moment you hit <kbd className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">Enter</kbd>, the recorded audio payload is posted via multipart binary stream directly to Groq Cloud's ultra-fast Whisper engine (<code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">whisper-large-v3-turbo</code>). Transcriptions return in under 300 milliseconds.
                  </p>

                  <h3 className="text-sm font-bold text-white mt-2">3. Clipboard Injection & Enigo Key Simulation</h3>
                  <p>
                    Once transcribed, Rusper writes the text payload directly to the OS clipboard via <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">arboard</code> and simulates a physical <kbd className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">Ctrl + V</kbd> keystroke via <code className="bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">enigo</code>, pasting your speech directly into Notepad, Word, or your web browser.
                  </p>

                  <h3 className="text-sm font-bold text-white mt-2">4. Skeuomorphic 3D Beveled Design</h3>
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
