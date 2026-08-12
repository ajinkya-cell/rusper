import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [viewState, setViewState] = useState<'recording' | 'processing' | 'review'>('recording');
  const [resultText, setResultText] = useState('');
  const [volume, setVolume] = useState(0.1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Listen for real-time audio volume events from Rust
  useEffect(() => {
    const unlistenAudio = listen<number>('audio-volume', (event) => {
      setVolume(Math.min(1.0, Math.max(0.1, event.payload * 5)));
    });

    const unlistenUI = listen<string>('ui-state', (event) => {
      if (event.payload === 'recording') {
        setViewState('recording');
        setResultText('');
      }
    });

    return () => {
      unlistenAudio.then((fn) => fn());
      unlistenUI.then((fn) => fn());
    };
  }, []);

  // 2. Render audio waveform on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6366f1'; // Indigo tint

      const bars = 8;
      const spacing = 4;
      const barWidth = (canvas.width - bars * spacing) / bars;

      for (let i = 0; i < bars; i++) {
        const height = Math.max(4, Math.sin(Date.now() * 0.01 + i * 0.8) * 12 * volume + 6);
        const x = i * (barWidth + spacing);
        const y = (canvas.height - height) / 2;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, height, 4);
        } else {
          ctx.rect(x, y, barWidth, height);
        }
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animId);
  }, [volume]);

  // 3. Handlers for calling Rust backend
  const handleStopRecording = async () => {
    setViewState('processing');
    try {
      const text = await invoke<string>('stop_recording_and_process');
      setResultText(text || '(No speech detected)');
      setViewState('review');
    } catch (err) {
      setResultText(`Error: ${err}`);
      setViewState('review');
    }
  };

  return (
    <main className="flex items-center justify-center h-screen w-screen p-2 bg-transparent">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[300px] bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl text-white flex flex-col gap-2"
      >
        <AnimatePresence mode="wait">
          {/* State 1: Recording View */}
          {viewState === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between"
            >
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
              <canvas ref={canvasRef} width={120} height={24} />
              <button
                onClick={handleStopRecording}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Done ✓
              </button>
            </motion.div>
          )}

          {/* State 2: Processing View */}
          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-1 text-xs text-zinc-400 gap-2"
            >
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Refining dictation...</span>
            </motion.div>
          )}

          {/* State 3: Review & Action View */}
          {viewState === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              <div className="bg-black/40 rounded-lg p-2 text-xs text-zinc-200 max-h-16 overflow-y-auto break-words">
                {resultText}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => invoke('cancel_popover')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-2.5 py-1 rounded-md transition cursor-pointer"
                >
                  ✕
                </button>
                <button
                  onClick={() => invoke('accept_text')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold px-3 py-1 rounded-md transition cursor-pointer"
                >
                  ✓ Inject
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
