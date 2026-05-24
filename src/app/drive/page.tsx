'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeolocation, useWakeLock, useDeviceMotion } from '@/lib/hooks';
import { MapboxEngine } from '@/components/ui/MapboxEngine';

// ─── Pace Status Logic ────────────────────────────────
type PaceStatus = 'idle' | 'synced' | 'warning' | 'danger';

function getPaceStatus(current: number, target: number): PaceStatus {
  if (target === 0) return 'idle';
  const diff = Math.abs(current - target) / target;
  if (diff <= 0.05) return 'synced';
  if (diff <= 0.15) return 'warning';
  return 'danger';
}

function getGlowColor(status: PaceStatus): string {
  switch (status) {
    case 'synced': return 'rgba(48, 209, 88, 0.4)';
    case 'warning': return 'rgba(255, 159, 10, 0.4)';
    case 'danger': return 'rgba(255, 69, 58, 0.4)';
    default: return 'transparent';
  }
}

function getGlowDuration(status: PaceStatus): number {
  switch (status) {
    case 'synced': return 4;
    case 'warning': return 2;
    case 'danger': return 1;
    default: return 0;
  }
}

function getStatusDotColor(status: PaceStatus): string {
  switch (status) {
    case 'synced': return 'var(--pace-synced)';
    case 'warning': return 'var(--pace-warning)';
    case 'danger': return 'var(--pace-danger)';
    default: return 'var(--text-tertiary)';
  }
}

// ─── Page Component ───────────────────────────────────
export default function DrivePage() {
  const { position, permission, status: geoStatus, error, startWatching, stopWatching } = useGeolocation();
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const { startListening: startMotion, stopListening: stopMotion, lastShock } = useDeviceMotion();

  // Simulated target speed (will come from server in Faz 4)
  const [targetSpeed, setTargetSpeed] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [nearbyCount] = useState(0);
  const [pacingPoints, setPacingPoints] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const currentSpeed = position?.speed_kmh ?? 0;
  const paceStatus = getPaceStatus(currentSpeed, targetSpeed);

  // ── Start Drive Session ──
  useEffect(() => {
    if (permission === 'granted' || permission === 'prompt') {
      startWatching();
      startMotion();
      requestWakeLock();
      setIsSessionActive(true);
    }

    return () => {
      stopWatching();
      stopMotion();
      releaseWakeLock();
      setIsSessionActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-set target speed based on current speed (temporary Faz 3 logic)
  // In Faz 4, this will come from the Python FastAPI brain
  useEffect(() => {
    if (currentSpeed > 10 && targetSpeed === 0) {
      // Set an initial target based on current speed
      setTargetSpeed(Math.round(currentSpeed));
    }
  }, [currentSpeed, targetSpeed]);

  // ── Anti-Panic Smoothing: Animate display speed toward target ──
  useEffect(() => {
    if (targetSpeed === 0) {
      setDisplaySpeed(0);
      return;
    }

    const interval = setInterval(() => {
      setDisplaySpeed((prev) => {
        if (prev === targetSpeed) return prev;
        const diff = targetSpeed - prev;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), 2); // max 2 km/h per tick
        return Math.round(prev + step);
      });
    }, 500); // tick every 500ms → ~2-4 km/h per second

    return () => clearInterval(interval);
  }, [targetSpeed]);

  // ── PacingPoints accrual (every 10 seconds) ──
  useEffect(() => {
    if (!isSessionActive || targetSpeed === 0) return;

    const interval = setInterval(() => {
      if (paceStatus === 'synced') {
        setPacingPoints((p) => p + 1);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isSessionActive, targetSpeed, paceStatus]);

  // ── Shock wave alert indicator ──
  const [showShockAlert, setShowShockAlert] = useState(false);
  useEffect(() => {
    if (lastShock) {
      setShowShockAlert(true);
      const timer = setTimeout(() => setShowShockAlert(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastShock]);

  // ── Permission denied state ──
  if (permission === 'denied') {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <MapboxEngine position={null} />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />
        <div className="relative z-20 max-w-sm">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--pace-danger)] flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--pace-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-3">
            Konum İzni Gerekli
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Pace/Flow, trafiği senkronize etmek için konumunuza ihtiyaç duyar. Lütfen tarayıcı ayarlarından konum iznini aktif edin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden select-none">
      
      {/* 3D Mapbox Traffic Engine */}
      <MapboxEngine position={position} />

      {/* Breathing Glow Overlay */}
      {paceStatus !== 'idle' && (
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none"
          animate={{
            boxShadow: [
              `inset 0 0 60px ${getGlowColor(paceStatus)}`,
              `inset 0 0 120px ${getGlowColor(paceStatus)}`,
              `inset 0 0 60px ${getGlowColor(paceStatus)}`,
            ],
          }}
          transition={{
            duration: getGlowDuration(paceStatus),
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: getStatusDotColor(paceStatus) }}
          />
          <span className="text-xs font-medium text-[var(--text-secondary)] tracking-widest uppercase">
            Pace/Flow
          </span>
        </div>

        {/* PacingPoints */}
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[var(--pace-synced)]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
          </svg>
          <span className="text-sm font-bold text-white tabular-nums">
            {pacingPoints}
          </span>
        </div>
      </div>

      {/* Shock Wave Alert Banner */}
      <AnimatePresence>
        {showShockAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-4 right-4 z-40 bg-[var(--pace-danger)]/20 border border-[var(--pace-danger)] px-4 py-2 text-center"
          >
            <span className="text-xs font-bold text-[var(--pace-danger)] uppercase tracking-widest">
              ⚠ Sert Fren Algılandı — Şok Dalgası Uyarısı
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central HUD */}
      <div className="relative z-20 flex flex-col items-center justify-center">
        
        {/* Current Speed (small, above target) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-2"
        >
          <span className="text-lg text-[var(--text-secondary)] tabular-nums font-medium">
            {Math.round(currentSpeed)}
          </span>
          <span className="text-xs text-[var(--text-tertiary)] ml-1">km/h</span>
        </motion.div>

        {/* Target Speed — THE BIG NUMBER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <span
            className="font-bold tabular-nums leading-none"
            style={{
              fontSize: 'clamp(96px, 20vw, 160px)',
              color: targetSpeed === 0 ? 'var(--text-tertiary)' : 'white',
              textShadow: targetSpeed > 0
                ? `0 0 40px ${getGlowColor(paceStatus)}`
                : 'none',
            }}
          >
            {targetSpeed === 0 ? '—' : displaySpeed}
          </span>
          <span className="text-sm text-[var(--text-tertiary)] uppercase tracking-[0.3em] -mt-2">
            {targetSpeed === 0 ? 'Hedef Bekleniyor' : 'km/h'}
          </span>
        </motion.div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-6 py-6">
        {/* Network Count */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
          <span className="text-xs text-[var(--text-tertiary)] tracking-wider">
            Yakınındaki Ağda: <span className="text-[var(--text-secondary)] font-medium">{nearbyCount}</span> Araç
          </span>
        </div>

        {/* GPS Status */}
        {error && (
          <div className="text-center">
            <span className="text-[10px] text-[var(--pace-warning)] uppercase tracking-widest">
              📡 {error}
            </span>
          </div>
        )}

        {/* Accuracy Indicator */}
        {position && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              GPS: ±{Math.round(position.accuracy)}m
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {position.heading > 0 ? `${Math.round(position.heading)}°` : '—'}
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
