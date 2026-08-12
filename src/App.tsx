import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './Dashboard';

const WAVE_BAR_COUNT = 16;

function WaveformMarquee() {
  const bars = Array.from({ length: WAVE_BAR_COUNT }, (_, index) => index);

  return (
    <div className="flex h-12 items-center justify-center gap-1.5 px-2">
      {bars.map((index) => (
        <motion.span
          key={index}
          className="block w-1.5 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          animate={{
            height: ['20%', `${30 + (index % 8) * 7}%`, '70%', '20%'],
          }}
          transition={{
            duration: 0.35 + (index % 4) * 0.1,
            ease: 'linear',
            repeat: Infinity,
            repeatType: 'reverse',
            delay: index * 0.05,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const isDashboard = window.location.hash.includes('dashboard');
  if (isDashboard) {
    return <Dashboard />;
  }

  const [viewState, setViewState] = useState<'recording' | 'processing' | 'review' | 'settings'>('recording');
  const [resultText, setResultText] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load initial API key on startup
  useEffect(() => {
    invoke<string | null>('get_api_key')
      .then((key) => {
        if (key) {
          setApiKeyInput(key);
        } else {
          setViewState('settings');
        }
      })
      .catch(() => setViewState('settings'));
  }, []);

  // Listen for backend UI state events
  useEffect(() => {
    const unlistenUI = listen<string>('ui-state', (event) => {
      if (event.payload === 'recording') {
        setViewState('recording');
        setResultText('');
      }
    });

    return () => {
      unlistenUI.then((fn) => fn());
    };
  }, []);

  // Handlers
  const handleStopRecording = useCallback(async () => {
    setViewState('processing');
    try {
      const text = await invoke<string>('stop_recording_and_process');
      setResultText(text || '(No speech detected)');
      setViewState('review');
    } catch (err) {
      setResultText(`Error: ${err}`);
      setViewState('review');
    }
  }, []);

  const handleAcceptText = useCallback(async () => {
    try {
      await invoke('accept_text');
    } catch (err) {
      console.error('Accept text error:', err);
    }
  }, []);

  const handleCancelPopover = useCallback(async () => {
    try {
      await invoke('cancel_popover');
    } catch (err) {
      console.error('Cancel popover error:', err);
    }
  }, []);

  const handleSaveApiKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKeyInput.trim()) {
      setSaveStatus('Please enter a valid API key');
      return;
    }
    try {
      await invoke('save_api_key', { key: apiKeyInput.trim() });
      setSaveStatus('API key saved! ✓');
      setTimeout(() => {
        setSaveStatus(null);
        setViewState('recording');
      }, 1000);
    } catch (err) {
      setSaveStatus(`Failed to save: ${err}`);
    }
  };

  // Keyboard Shortcuts (Enter / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (viewState === 'recording') {
          e.preventDefault();
          handleStopRecording();
        } else if (viewState === 'review') {
          e.preventDefault();
          handleAcceptText();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelPopover();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, handleStopRecording, handleAcceptText, handleCancelPopover]);

  return (
    <main className="flex items-end justify-center h-screen w-screen p-2 bg-transparent">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="skeuo-bevel-card w-full max-w-[360px] p-4 text-white flex flex-col gap-3 relative overflow-hidden"
      >
        {/* Top Prismatic Border Highlight Overlay */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] z-20 rounded-t-2xl"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 25%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.18) 75%, transparent 100%)',
          }}
        />
        {/* Header navigation */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span className="font-bold text-white tracking-wider uppercase text-[11px]">
            RUSPER
          </span>
          <button
            onClick={() => setViewState(viewState === 'settings' ? 'recording' : 'settings')}
            title="Configure API Key"
            className="hover:text-white transition cursor-pointer font-medium"
          >
            ⚙ Settings
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* State 1: Recording View */}
          {viewState === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center justify-between gap-3 h-12"
            >
              <div className="skeuo-inner-socket flex-1 h-12 rounded-xl flex items-center justify-center px-1 overflow-hidden">
                <WaveformMarquee />
              </div>
              <button
                onClick={handleStopRecording}
                title="Done (Enter)"
                className="skeuo-raised-btn w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition cursor-pointer hover:bg-zinc-100"
              >
                <img src="/check-circle.svg" alt="Done" className="w-6 h-6 text-black" />
              </button>
            </motion.div>
          )}

          {/* State 2: Processing View */}
          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-center h-12 text-xs text-zinc-300 gap-2.5"
            >
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Transcribing with Groq Whisper...</span>
            </motion.div>
          )}

          {/* State 3: Review View */}
          {viewState === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex flex-col gap-3"
            >
              <div className="skeuo-inner-socket rounded-xl p-3 text-xs text-zinc-100 max-h-24 overflow-y-auto break-words leading-relaxed font-mono">
                {resultText}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelPopover}
                  className="skeuo-raised-btn-dark text-xs px-3.5 py-2 rounded-xl transition cursor-pointer text-zinc-300 border-none"
                >
                  ✕ Cancel [Esc]
                </button>
                <button
                  onClick={handleAcceptText}
                  className="skeuo-inject-btn text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  ✓ Inject [↵]
                </button>
              </div>
            </motion.div>
          )}

          {/* State 4: Settings View */}
          {viewState === 'settings' && (
            <motion.form
              key="settings"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onSubmit={handleSaveApiKey}
              className="flex flex-col gap-2.5 py-0.5"
            >
              <label className="text-[11px] font-medium text-zinc-300">Configure Groq API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="skeuo-sub-well w-full rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-mono"
              />
              {saveStatus && (
                <span className="text-[10px] text-zinc-300 font-medium">{saveStatus}</span>
              )}
              <div className="flex items-center justify-between mt-1">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-zinc-400 hover:text-white underline"
                >
                  Get Key ↗
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewState('recording')}
                    className="skeuo-raised-btn-dark text-xs px-3 py-1.5 rounded-lg text-zinc-300 cursor-pointer border-none"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="skeuo-raised-btn text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer transition border-none"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
