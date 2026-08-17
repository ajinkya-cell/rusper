import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AudioReactiveWaveformProps {
  volume: number; // 0.0 to 1.0 (dB normalized)
  compact?: boolean;
  durationSeconds?: number;
  showTimer?: boolean;
}

export default function AudioReactiveWaveform({
  volume,
  compact = false,
  durationSeconds = 0,
  showTimer = false,
}: AudioReactiveWaveformProps) {
  const barCount = compact ? 16 : 18;
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.2)
  );

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const heightsRef = useRef<number[]>(
    Array.from({ length: barCount }, () => 0.2)
  );

  useEffect(() => {
    let animationFrameId: number;

    const updatePhysics = () => {
      const currentVol = volumeRef.current;
      const isSpeaking = currentVol > 0.05;
      const now = Date.now();
      const nextHeights: number[] = [];

      for (let i = 0; i < barCount; i++) {
        const normalizedIndex = (i + 1) / (barCount + 1);
        const taper = Math.sin(normalizedIndex * Math.PI); // Parabolic bell curve

        // Dual-harmonic traveling wave with continuous phase propagation
        const wave1 = Math.sin(now * 0.0075 + i * 0.48);
        const wave2 = Math.sin(now * 0.012 - i * 0.35);
        const wave3 = Math.cos(now * 0.005 + i * 0.65);
        const combinedWave = wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15; // -1.0 to 1.0
        const wave01 = (combinedWave + 1.0) / 2.0; // 0.0 to 1.0

        // Resting gentle wave when silent (15% to 42% height)
        const idleMin = 0.15;
        const idleMax = 0.42;
        const idleHeight = (idleMin + wave01 * (idleMax - idleMin)) * (0.65 + taper * 0.35);

        // Active voice-driven surge: expands wave crests and surges peak height up to 100%
        const voiceIntensity = Math.min(1.0, currentVol * 2.2); // high sensitivity
        const activeMin = 0.22 + voiceIntensity * 0.35; // base lifts with speech
        const activeMax = 0.52 + voiceIntensity * 0.48; // peaks up to 100%
        const activeHeight = (activeMin + wave01 * (activeMax - activeMin)) * (0.55 + taper * 0.45);

        // Target height
        const target = isSpeaking ? Math.min(1.0, activeHeight) : idleHeight;

        const prev = heightsRef.current[i] || 0.2;
        // Fast attack on speech transients, smooth fluid decay
        const lerpFactor = target > prev ? 0.38 : 0.16;
        const next = prev + (target - prev) * lerpFactor;

        nextHeights.push(next);
        heightsRef.current[i] = next;
      }

      setBarHeights(nextHeights);
      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    animationFrameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameId);
  }, [barCount]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`relative flex items-center justify-center overflow-hidden w-full h-full ${compact ? 'p-0' : 'px-2 gap-3'}`}>
      {/* Optional Live Recording Status Dot & Timer */}
      {showTimer && (
        <div className="flex items-center gap-1.5 shrink-0 z-10 select-none pr-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="font-code text-xs font-semibold tracking-wider text-white/90">
            {formatTime(durationSeconds)}
          </span>
        </div>
      )}

      {/* Reactive Bars Array */}
      <div className={`flex items-center justify-center gap-[3px] z-10 w-full h-full`}>
        {barHeights.map((heightNorm, i) => {
          const maxHeight = compact ? 22 : 38;
          const minHeight = compact ? 4 : 8;
          const barHeightPx = Math.max(minHeight, Math.min(maxHeight, Math.round(heightNorm * maxHeight)));

          return (
            <motion.div
              key={i}
              className="block shrink-0 rounded-full w-[3.5px]"
              style={{
                height: `${barHeightPx}px`,
                background: '#ffffff',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

