'use client';

import { useEffect, useState, useRef } from 'react';
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
  
  // Real-time Traffic Density from Mapbox Spatial Calculation
  const [trafficDensity, setTrafficDensity] = useState(0);

  // Derived Local Area Delay
  const delayMinutes = Math.round(Math.pow(trafficDensity / 100, 2) * 20);
  const delayPercentage = Math.max(2, (delayMinutes / 20) * 100);

  // ── Reverse Geocoding (Sokak İsmi) ──
  const [currentStreet, setCurrentStreet] = useState<string>('Konum Aranıyor...');
  const lastGeocodeRef = useRef<{lat: number, lng: number, time: number} | null>(null);

  useEffect(() => {
    if (!position) return;
    
    const now = Date.now();
    const last = lastGeocodeRef.current;
    
    // Throttle to every 10 seconds to save API calls
    if (last && now - last.time < 10000) return;

    const fetchStreet = async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;
        
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${position.longitude},${position.latitude}.json?types=address,poi,neighborhood,locality&access_token=${token}`);
        const data = await res.json();
        
        if (data.features && data.features.length > 0) {
          // Find the best match (closest specific feature)
          const feature = data.features[0];
          setCurrentStreet(feature.text || 'Bilinmeyen Yol');
        } else {
          setCurrentStreet('Bilinmeyen Yol');
        }
        
        lastGeocodeRef.current = { lat: position.latitude, lng: position.longitude, time: Date.now() };
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    };

    fetchStreet();
  }, [position?.latitude, position?.longitude]);

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
      <MapboxEngine 
        position={position} 
        onTrafficDensityChange={setTrafficDensity}
      />

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

      {/* Traffic Density Bar (Left Vertical) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
        <span className="text-[10px] text-white/70 font-bold tabular-nums mb-2">
          {Math.round(trafficDensity)}%
        </span>
        <div className="w-1.5 h-32 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-3">
          <motion.div 
            className="w-full rounded-full animate-pulse"
            style={{ 
              backgroundColor: trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158',
              boxShadow: `0 0 10px ${trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158'}`
            }}
            animate={{ height: `${Math.max(2, trafficDensity)}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">
          Trafik Yoğunluğu
        </span>
      </div>

      {/* Delay Bar (Right Vertical) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
        <span className="text-[10px] text-white/70 font-bold tabular-nums mb-2">
          +{delayMinutes}dk
        </span>
        <div className="w-1.5 h-32 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-3">
          <motion.div 
            className="w-full rounded-full animate-pulse"
            style={{ 
              backgroundColor: delayMinutes > 10 ? '#FF453A' : delayMinutes > 3 ? '#FF9F0A' : '#30D158',
              boxShadow: `0 0 10px ${delayMinutes > 10 ? '#FF453A' : delayMinutes > 3 ? '#FF9F0A' : '#30D158'}`
            }}
            animate={{ height: `${delayPercentage}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">
          Gecikme Süresi
        </span>
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

      {/* HUD (Bottom Center) */}
      <div className="absolute bottom-24 left-0 right-0 z-30 flex flex-col items-center justify-center pointer-events-none">
        
        {targetSpeed === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-5 py-2.5 shadow-2xl"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
            <span className="text-[11px] text-white/80 uppercase tracking-[0.25em] font-medium">
              Hedef Hesaplanıyor
            </span>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center bg-black/40 backdrop-blur-sm border border-white/5 rounded-[2rem] px-8 py-4 shadow-2xl">
            {/* Current Speed (small, above target) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-0"
            >
              <span className="text-sm text-white/60 tabular-nums font-medium">
                {Math.round(currentSpeed)}
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest ml-1">mevcut</span>
            </motion.div>

            {/* Target Speed */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-baseline gap-2"
            >
              <span
                className="font-bold tabular-nums leading-none tracking-tighter"
                style={{
                  fontSize: '96px',
                  color: 'white',
                  textShadow: `0 0 40px ${getGlowColor(paceStatus)}`,
                }}
              >
                {displaySpeed}
              </span>
              <span className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium">
                km/h
              </span>
            </motion.div>
          </div>
        )}

        {/* Street Name Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5"
        >
          <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] text-white/50 uppercase tracking-[0.2em]">{currentStreet}</span>
        </motion.div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-6 py-8 flex flex-col items-center">
        
        {/* Network Count */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <span className="text-[11px] text-white/40 tracking-wider">
            Ağdaki Araç: <span className="text-white/80 font-medium">{nearbyCount}</span>
          </span>
        </div>

        {/* GPS Status */}
        {error && (
          <div className="text-center mb-2">
            <span className="text-[10px] text-[var(--pace-warning)] uppercase tracking-widest">
              📡 {error}
            </span>
          </div>
        )}

        {/* Accuracy Indicator */}
        {position && (
          <div className="flex items-center justify-center gap-4">
            <span className="text-[9px] text-white/30 uppercase tracking-widest">
              GPS ±{Math.round(position.accuracy)}m
            </span>
            <span className="text-[9px] text-white/30 uppercase tracking-widest">
              {position.heading > 0 ? `${Math.round(position.heading)}°` : 'YÖN BEKLENİYOR'}
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
