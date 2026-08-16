import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './Dashboard';

function WaveformMarquee({ compact }: { compact?: boolean }) {
  const barCount = compact ? 12 : 10;
  const bars = Array.from({ length: barCount }, (_, index) => index);

  return (
    <div className={`flex items-center justify-center gap-1.5 px-3 overflow-hidden ${compact ? 'h-7 py-0.5' : 'h-14'}`}>
      {bars.map((index) => {
        const taper = Math.sin(((index + 1) / (barCount + 1)) * Math.PI);
        const minH = Math.round(18 * taper + 8);
        const midH = Math.round((35 + (index % 4) * 12) * taper + 12);
        const maxH = Math.round(75 * taper + 15);

        return (
          <motion.span
            key={index}
            className={`block shrink-0 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.7)] ${
              compact ? 'w-1.5' : 'w-2'
            }`}
            animate={{
              height: [`${minH}%`, `${midH}%`, `${maxH}%`, `${minH}%`],
              opacity: [0.75, 1, 0.75],
            }}
            transition={{
              duration: 0.35 + (index % 4) * 0.08,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'reverse',
              delay: index * 0.04,
            }}
          />
        );
      })}
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
  const [showApiKey, setShowApiKey] = useState(false);
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
      }, 900);
    } catch (err) {
      setSaveStatus(`Failed to save: ${err}`);
    }
  };

  // Keyboard Shortcuts (Enter / Esc / R)
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
      } else if ((e.key === 'r' || e.key === 'R') && viewState === 'review' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleRedoRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, handleStopRecording, handleAcceptText, handleCancelPopover, handleRedoRecording]);

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        style={{ borderRadius: isPushToTalk ? '9999px' : '16px' }}
        className={`skeuo-capsule-card text-white relative overflow-hidden outline-none focus:outline-none transition-all duration-150 ${
          isPushToTalk
            ? 'w-full h-full !rounded-full px-3 py-1 flex flex-row items-center justify-center'
            : 'w-full h-full p-3.5 rounded-2xl flex flex-col justify-between'
        }`}
      >

        {/* Top Header Navigation (Interactive Mode Only) */}
        {!isPushToTalk && (
          <div className="flex items-center justify-between text-zinc-400 shrink-0 pb-1 border-b border-white/5">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Rusper" className="w-5 h-5 rounded-md object-contain shadow-sm border border-white/10" />
              <span className="font-display italic text-2xl text-white font-normal tracking-wide">
                Rusper
              </span>
            </div>
            <button
              onClick={() => setViewState(viewState === 'settings' ? 'recording' : 'settings')}
              title="Configure Settings"
              className="font-ui text-xs text-zinc-400 hover:text-white transition cursor-pointer font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Settings</span>
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
              className={`p-2 rounded-xl text-[11px] font-ui font-medium flex items-center justify-between shadow-lg border ${
                toast.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-600/70 text-amber-200'
                  : toast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-600/70 text-emerald-200'
                  : 'bg-zinc-900/95 border-zinc-700 text-white'
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
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`flex ${isPushToTalk ? 'items-center justify-center w-full h-full' : 'flex-col justify-center flex-1 gap-2'}`}
            >
              {isPushToTalk ? (
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  <WaveformMarquee compact={true} />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 w-full my-auto">
                  <div className="flex-1 flex items-center justify-center px-1 overflow-hidden">
                    <WaveformMarquee compact={false} />
                  </div>
                  <button
                    onClick={handleStopRecording}
                    title="Done & Transcribe (Enter)"
                    className="skeuo-raised-btn text-xs font-ui font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer select-none text-zinc-950 shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Done</span>
                    <span className="font-code text-[10px] opacity-60 font-bold ml-0.5">[↵]</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* State 2: Processing View */}
          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`flex items-center justify-center gap-2.5 overflow-hidden ${
                isPushToTalk ? 'flex-1 h-9 rounded-full px-2' : 'h-14 rounded-xl px-4 my-auto'
              }`}
            >
              <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <span className="font-ui font-medium text-white tracking-wide text-xs truncate">
                Transcribing...
              </span>
            </motion.div>
          )}

          {/* State 3: Review View (Interactive Mode) */}
          {viewState === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col justify-between flex-1 gap-2 pt-0.5"
            >
              <div className="skeuo-inner-socket px-3.5 py-3 rounded-xl text-xs text-zinc-100 max-h-24 overflow-y-auto break-words leading-relaxed font-code select-text">
                {resultText}
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  onClick={handleRedoRecording}
                  title="Discard & Re-record (R)"
                  className="skeuo-raised-btn-dark font-ui text-xs px-2.5 py-1.5 rounded-lg cursor-pointer text-zinc-200 flex items-center gap-1 hover:text-white"
                >
                  <span>🔁 Redo</span>
                  <span className="font-code text-[10px] text-zinc-400 font-semibold">[R]</span>
                </button>
                <button
                  onClick={handleCancelPopover}
                  title="Cancel & Dismiss (Esc)"
                  className="skeuo-raised-btn-dark font-ui text-xs px-2.5 py-1.5 rounded-lg cursor-pointer text-zinc-200 hover:text-white"
                >
                  ✕ Cancel <span className="font-code text-[10px] text-zinc-400">[Esc]</span>
                </button>
                <button
                  onClick={handleAcceptText}
                  title="Paste transcription into active app (Enter)"
                  className="skeuo-raised-btn font-ui text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 tracking-tight text-zinc-950"
                >
                  <span>✓ Paste</span>
                  <span className="font-code text-[10px] opacity-70 font-bold">[↵]</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* State 4: Settings View */}
          {viewState === 'settings' && (
            <motion.form
              key="settings"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onSubmit={handleSaveApiKey}
              className="flex flex-col gap-2 py-0.5"
            >
              <div className="flex items-center justify-between">
                <label className="font-ui text-xs font-medium text-zinc-200">Groq API Key</label>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="font-ui text-[11px] text-zinc-400 hover:text-white underline"
                >
                  Get Key ↗
                </a>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="skeuo-sub-well w-full rounded-xl px-3 py-1.5 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none transition font-code"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 text-zinc-400 hover:text-white text-xs cursor-pointer"
                  title={showApiKey ? 'Hide Key' : 'Show Key'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>

              {saveStatus && (
                <span className="font-ui text-[11px] text-zinc-300 font-medium">{saveStatus}</span>
              )}

              <div className="flex items-center justify-end gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={() => setViewState('recording')}
                  className="skeuo-raised-btn-dark font-ui text-xs px-3 py-1.5 rounded-lg text-zinc-300 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="skeuo-raised-btn font-ui text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition text-zinc-950"
                >
                  Save Key
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

