import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './Dashboard';

const WAVE_BAR_COUNT = 16;

function WaveformMarquee({ compact }: { compact?: boolean }) {
  const bars = Array.from({ length: WAVE_BAR_COUNT }, (_, index) => index);

  return (
    <div className={`flex items-center justify-center gap-1.5 px-2 ${compact ? 'h-6 py-0.5' : 'h-10'}`}>
      {bars.map((index) => (
        <motion.span
          key={index}
          className={`block shrink-0 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.85)] ${
            compact ? 'w-1' : 'w-1.5'
          }`}
          animate={{
            height: compact
              ? ['15%', `${20 + (index % 6) * 5}%`, '45%', '15%']
              : ['20%', `${30 + (index % 8) * 7}%`, '65%', '20%'],
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
  const [dictationMode, setDictationMode] = useState<'interactive' | 'push_to_talk'>('interactive');
  const [toast, setToast] = useState<{ message: string; type: 'warning' | 'info' | 'success' } | null>(null);

  const showToast = useCallback((message: string, type: 'warning' | 'info' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Load initial API key & dictation mode on startup
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

    invoke<string>('get_dictation_mode')
      .then((m) => {
        if (m === 'push_to_talk' || m === 'interactive') {
          setDictationMode(m);
        }
      })
      .catch(() => {});
  }, []);

  // Handlers
  const handleStopRecording = useCallback(async () => {
    setViewState('processing');
    try {
      const text = await invoke<string>('stop_recording_and_process');
      const clean = text ? text.trim() : '';
      if (!clean || clean === '(No audio detected)' || clean === '(No speech detected)') {
        setResultText('(No audio detected)');
        showToast('🔇 No audio detected. Left input field blank.', 'warning');
      } else {
        setResultText(clean);
      }
      setViewState('review');
    } catch (err) {
      setResultText(`Error: ${err}`);
      setViewState('review');
    }
  }, [showToast]);

  // Listen for backend UI state, silence timeout, and max recording duration events
  useEffect(() => {
    const unlistenUI = listen<string>('ui-state', (event) => {
      if (event.payload === 'recording') {
        setViewState('recording');
        setResultText('');
        invoke<string>('get_dictation_mode')
          .then((m) => {
            if (m === 'push_to_talk' || m === 'interactive') {
              setDictationMode(m);
              invoke('sync_window_size', { mode: m }).catch(() => {});
            }
          })
          .catch(() => {});
      } else if (event.payload === 'processing') {
        setViewState('processing');
      }
    });

    const unlistenSilence = listen('silence-timeout', () => {
      showToast('🔇 No audio detected for 15s. Dictation auto-paused.', 'warning');
    });

    const unlistenMaxDuration = listen('max-duration-reached', () => {
      showToast('⏱️ Max recording limit reached (90s). Processing audio...', 'info');
      handleStopRecording();
    });

    return () => {
      unlistenUI.then((fn) => fn());
      unlistenSilence.then((fn) => fn());
      unlistenMaxDuration.then((fn) => fn());
    };
  }, [showToast, handleStopRecording]);

  const handleAcceptText = useCallback(async () => {
    if (!resultText || resultText === '(No audio detected)' || resultText === '(No speech detected)') {
      showToast('🔇 No audio detected. Nothing to paste.', 'warning');
      return;
    }
    try {
      const isValidField = await invoke<boolean>('validate_active_text_field');
      if (!isValidField) {
        showToast('⚠️ No active text field detected. Click into an app to paste.', 'warning');
        return;
      }
      await invoke('accept_text');
    } catch (err) {
      console.error('Accept text error:', err);
    }
  }, [resultText, showToast]);

  const handleRedoRecording = useCallback(async () => {
    setResultText('');
    setViewState('recording');
    try {
      await invoke('start_recording');
    } catch (err) {
      console.error('Redo recording error:', err);
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

  useEffect(() => {
    const handleFocus = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const isPushToTalk = dictationMode === 'push_to_talk';

  return (
    <main
      tabIndex={-1}
      className="flex items-center justify-center w-full h-full p-0 m-0 bg-transparent overflow-hidden outline-none focus:outline-none border-none select-none"
    >
      <motion.div
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`skeuo-bevel-card text-white relative overflow-hidden outline-none focus:outline-none border border-white/[0.08] shadow-2xl transition-all duration-200 ${
          isPushToTalk
            ? 'w-[260px] h-[52px] rounded-full px-2.5 py-1.5 flex flex-row items-center justify-between'
            : 'w-[360px] h-[200px] p-4 rounded-2xl flex flex-col justify-between'
        }`}
      >
        {/* Top Prismatic Specular Highlight Line */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] z-20 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.22) 70%, transparent 100%)',
          }}
        />

        {/* Top Header Navigation (Interactive Mode Only) */}
        {!isPushToTalk && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
            <span className="font-bold text-white tracking-wider text-xs uppercase">
              Rusper
            </span>
            <button
              onClick={() => setViewState(viewState === 'settings' ? 'recording' : 'settings')}
              title="Configure API Key"
              className="hover:text-white transition cursor-pointer font-medium"
            >
              ⚙ Settings
            </button>
          </div>
        )}

        {/* Toast Notification Banner */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`p-2 rounded-xl text-[10px] font-semibold flex items-center justify-between shadow-lg border ${
                toast.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-700 text-amber-200'
                  : toast.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                  : 'bg-zinc-900 border-zinc-700 text-white'
              }`}
            >
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 font-bold opacity-70 hover:opacity-100 cursor-pointer">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* State 1: Recording View */}
          {viewState === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex items-center justify-between gap-3 ${isPushToTalk ? 'w-full h-full' : 'h-12'}`}
            >
              <div className={`skeuo-inner-socket flex-1 flex items-center justify-center px-1 overflow-hidden ${isPushToTalk ? 'h-9 rounded-full' : 'h-12 rounded-xl'}`}>
                <WaveformMarquee compact={isPushToTalk} />
              </div>
              {!isPushToTalk && (
                <button
                  onClick={handleStopRecording}
                  title="Done (Enter)"
                  className="skeuo-raised-btn w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition cursor-pointer hover:bg-zinc-100"
                >
                  <img src="/check-circle.svg" alt="Done" className="w-6 h-6 text-black" />
                </button>
              )}
            </motion.div>
          )}

          {/* State 2: Processing View */}
          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`skeuo-inner-socket flex items-center justify-center gap-2.5 overflow-hidden ${
                isPushToTalk ? 'flex-1 h-9 rounded-full px-3' : 'h-12 rounded-xl px-4 text-xs border border-white/[0.04]'
              }`}
            >
              <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <span className="font-semibold text-white tracking-wide text-xs truncate">
                {isPushToTalk ? 'Transcribing...' : 'Processing with Groq Whisper...'}
              </span>
            </motion.div>
          )}

          {/* State 3: Review View (Interactive Mode) */}
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
                  onClick={handleRedoRecording}
                  title="Discard & Re-record audio dictation"
                  className="skeuo-raised-btn-dark text-xs px-3 py-2 rounded-xl transition cursor-pointer text-zinc-300 border-none flex items-center gap-1 hover:text-white"
                >
                  🔁 Redo
                </button>
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
