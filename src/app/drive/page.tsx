'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeolocation, useWakeLock, useDeviceMotion } from '@/lib/hooks';
import { MapboxEngine } from '@/components/ui/MapboxEngine';
import { EconomyDashboard } from '@/components/ui/EconomyDashboard';

// ─── Pace Status Logic ────────────────────────────────
type PaceStatus = 'idle' | 'speed_up' | 'synced' | 'slow_down';

function getPaceStatus(current: number, target: number): PaceStatus {
  if (target === 0) return 'idle';
  
  const ratio = current / target;
  
  if (ratio >= 0.95 && ratio <= 1.05) return 'synced'; // +/- 5% tolerance
  if (ratio > 1.05) return 'slow_down'; // Going too fast
  return 'speed_up'; // Going too slow
}

function getGlowColor(status: PaceStatus): string {
  switch (status) {
    case 'speed_up': return 'rgba(48, 209, 88, 0.15)'; // Yeşil (Hızlan) - Hafifletildi
    case 'synced': return 'transparent'; // Hedefteyiz, sıfır ışık kirliliği
    case 'slow_down': return 'rgba(255, 69, 58, 0.15)'; // Kırmızı (Yavaşla) - Hafifletildi
    default: return 'transparent';
  }
}

function getGlowDuration(status: PaceStatus): number {
  switch (status) {
    case 'speed_up': return 2; // Daha hızlı nabız (Teşvik edici)
    case 'synced': return 4;
    case 'slow_down': return 0.5; // Çok hızlı yanıp sönme (Aciliyet)
    default: return 0;
  }
}

function getStatusDotColor(status: PaceStatus): string {
  switch (status) {
    case 'speed_up': return '#30D158'; // Yeşil nokta
    case 'synced': return 'transparent'; // Noktaya gerek yok
    case 'slow_down': return '#FF453A'; // Kırmızı nokta
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
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [serverShock, setServerShock] = useState(0);
  const [simulatedShock, setSimulatedShock] = useState(false); // Manual trigger for Radar

  const currentSpeed = position?.speed_kmh ?? 0;
  const paceStatus = getPaceStatus(currentSpeed, targetSpeed);
  
  // Real-time Traffic Density from Mapbox Spatial Calculation
  const [trafficDensity, setTrafficDensity] = useState(0);
  const [districtDensity, setDistrictDensity] = useState(0);
  const [cityDensity, setCityDensity] = useState(0);

  // ── Regional Density Simulation (Phase 3) ──
  useEffect(() => {
    // Calculate City Density based on Time of Day (predictive modeling)
    const hour = new Date().getHours();
    let baseCity = 20; 
    if (hour >= 7 && hour <= 10) baseCity = 85; // Morning rush
    else if (hour > 10 && hour <= 15) baseCity = 55; // Midday
    else if (hour > 15 && hour <= 20) baseCity = 90; // Evening rush
    else if (hour > 20 && hour <= 23) baseCity = 40; // Night

    // Add macro-level noise
    const currentCity = baseCity + (Math.sin(Date.now() / 50000) * 15);
    setCityDensity(Math.max(5, Math.min(95, currentCity)));

    // District is a weighted blend of Local Traffic and City Traffic
    const targetDistrict = (trafficDensity * 0.5) + (currentCity * 0.5);
    
    // Add momentum to District density for realism
    setDistrictDensity(prev => {
      const diff = targetDistrict - prev;
      return prev + (diff * 0.15); 
    });
  }, [trafficDensity]);

  // Derived Local Area Delay & Speed
  const delayMinutes = Math.round(Math.pow(trafficDensity / 100, 2) * 20);
  const districtDelayMinutes = Math.round(Math.pow(districtDensity / 100, 2) * 30);
  const cityDelayMinutes = Math.round(Math.pow(cityDensity / 100, 2) * 45);

  const delayPercentage = Math.max(2, (delayMinutes / 20) * 100);
  const districtDelayPercentage = Math.max(2, (districtDelayMinutes / 30) * 100);
  const cityDelayPercentage = Math.max(2, (cityDelayMinutes / 45) * 100);

  // Average Area Speed (0% congestion = 60 km/h, 100% congestion = 5 km/h)
  const averageAreaSpeed = Math.round(60 - (trafficDensity / 100) * 55);

  const [currentTime, setCurrentTime] = useState<string>('--:--');
  useEffect(() => {
    setCurrentTime(new Date().getHours().toString().padStart(2, '0') + ':00');
    const interval = setInterval(() => {
      setCurrentTime(new Date().getHours().toString().padStart(2, '0') + ':00');
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const wsRef = useRef<WebSocket | null>(null);

  // ── Connect to FastAPI WebSocket (Faz 4: The Brain) ──
  useEffect(() => {
    if (!isSessionActive) return;

    // TODO: Change localhost to actual backend URL in production
    const ws = new WebSocket('ws://localhost:8001/ws/telemetry');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to PaceFlow Backend (KWT Engine)');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.target_speed !== undefined) {
          setTargetSpeed(data.target_speed);
        }
        if (data.shockwave_alert) {
          setServerShock(Date.now());
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from PaceFlow Backend');
    };

    return () => {
      ws.close();
    };
  }, [isSessionActive]);

  // ── Send Telemetry Loop (1Hz) ──
  useEffect(() => {
    if (!isSessionActive || !wsRef.current) return;
    
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          latitude: position?.latitude || 0,
          longitude: position?.longitude || 0,
          speed: currentSpeed,
          heading: position?.heading || 0,
          local_density: trafficDensity,
          district_density: districtDensity,
          city_density: cityDensity
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, position, currentSpeed, trafficDensity]);

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

  // ── Manual Shockwave Radar Trigger (For Demo) ──
  const triggerSuddenBrake = () => {
    setSimulatedShock(true);
    setTimeout(() => setSimulatedShock(false), 5000); // Radar alert lasts 5 seconds
  };

  // ── Shock wave alert indicator ──
  const [showShockAlert, setShowShockAlert] = useState(false);
  useEffect(() => {
    if (lastShock || serverShock || simulatedShock) {
      setShowShockAlert(true);
      const timer = setTimeout(() => setShowShockAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastShock, serverShock, simulatedShock]);

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
        targetSpeed={targetSpeed}
        currentSpeed={currentSpeed}
        showShockAlert={showShockAlert}
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
      <div className="absolute top-6 left-0 right-0 z-50 flex items-center justify-between px-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: getStatusDotColor(paceStatus) }}
          />
          <span className="text-xs font-medium text-[var(--text-secondary)] tracking-widest uppercase shadow-md">
            Pace/Flow
          </span>
        </div>

        {/* Economy Dashboard (Right Side) */}
        <EconomyDashboard paceStatus={paceStatus} isDriving={isSessionActive && currentSpeed > 5} />
      </div>

      {/* Traffic Density Cluster (Left Vertical) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
        
        {/* Bars Container */}
        <div className="flex flex-col items-center pointer-events-none gap-4 bg-black/40 backdrop-blur-md border border-white/5 rounded-full px-2 py-6 shadow-2xl">
          
          {/* Local Area */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-extrabold text-white/90 tabular-nums mb-2">
            {Math.round(trafficDensity)}%
          </span>
          <div className="w-1 h-28 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-3">
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
            Yakın Bölge
          </span>
        </div>

        {/* District */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-extrabold text-white/80 tabular-nums mb-1.5">{Math.round(districtDensity)}%</span>
          <div className="w-1 h-20 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-2">
            <motion.div 
              className="w-full rounded-full"
              style={{ backgroundColor: districtDensity > 70 ? '#FF453A' : districtDensity > 40 ? '#FF9F0A' : '#30D158' }}
              animate={{ height: `${Math.max(2, districtDensity)}%` }}
              transition={{ duration: 2, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[8px] text-white/30 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">İlçe</span>
        </div>

        {/* City */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-extrabold text-white/70 tabular-nums mb-1">{Math.round(cityDensity)}%</span>
          <div className="w-0.5 h-16 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-2">
            <motion.div 
              className="w-full rounded-full"
              style={{ backgroundColor: cityDensity > 70 ? '#FF453A' : cityDensity > 40 ? '#FF9F0A' : '#30D158' }}
              animate={{ height: `${Math.max(2, cityDensity)}%` }}
              transition={{ duration: 3, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[7px] text-white/30 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">İl</span>
        </div>
        
        </div> {/* End of Bars Container */}
      </div>

      {/* Delay Cluster (Right Vertical Stack) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
        
        {/* Delay Bars Container */}
        <div className="flex flex-col items-center pointer-events-none gap-4 bg-black/40 backdrop-blur-md border border-white/5 rounded-full px-2 py-6 shadow-2xl">
          
          {/* Local Delay */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-extrabold text-white/90 tabular-nums mb-2">+{delayMinutes}dk</span>
          <div className="w-1 h-28 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-3">
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
          <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">Gecikme</span>
        </div>

        {/* District Delay */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-extrabold text-white/80 tabular-nums mb-1.5">+{districtDelayMinutes}dk</span>
          <div className="w-1 h-20 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-2">
            <motion.div 
              className="w-full rounded-full"
              style={{ backgroundColor: districtDelayMinutes > 15 ? '#FF453A' : districtDelayMinutes > 5 ? '#FF9F0A' : '#30D158' }}
              animate={{ height: `${districtDelayPercentage}%` }}
              transition={{ duration: 2, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[8px] text-white/30 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">İlçe</span>
        </div>

        {/* City Delay */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-extrabold text-white/70 tabular-nums mb-1">+{cityDelayMinutes}dk</span>
          <div className="w-0.5 h-16 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end mb-2">
            <motion.div 
              className="w-full rounded-full"
              style={{ backgroundColor: cityDelayMinutes > 20 ? '#FF453A' : cityDelayMinutes > 10 ? '#FF9F0A' : '#30D158' }}
              animate={{ height: `${cityDelayPercentage}%` }}
              transition={{ duration: 3, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[7px] text-white/30 uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180">İl</span>
        </div>
        
        </div> {/* End of Delay Bars */}
      </div>

      {/* Shock Wave Alert Banner */}
      <AnimatePresence>
        {showShockAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#FF453A]/90 backdrop-blur-xl border border-[#FF453A]/50 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(255,69,58,0.5)] z-50 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-black/20 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg uppercase tracking-wider">İleride Ani Fren</h2>
              <p className="text-white/80 text-sm font-medium">1 km ileride tehlike. Lütfen yavaşlayın.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Dashboard SafeArea (Prevents overlaps, responsive scaling) */}
      <div className="absolute bottom-24 left-0 right-0 z-30 flex justify-between items-end px-4 sm:px-6 pointer-events-none">

        {/* Average Area Speed (Bottom Left) */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-[1.2rem] px-4 py-2.5 shadow-2xl pointer-events-none transform scale-[0.85] sm:scale-100 origin-bottom-left">
          <div 
            className="w-1.5 h-1.5 rounded-full animate-pulse" 
            style={{ 
              backgroundColor: trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158',
              boxShadow: `0 0 6px ${trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158'}`
            }}
          />
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white tabular-nums tracking-tighter leading-none">{averageAreaSpeed}</span>
            <span className="text-[7px] text-white/50 uppercase tracking-widest font-medium mt-1">KM/S</span>
          </div>
        </div>

        {/* HUD (Bottom Center) */}
        <div className="flex-1 flex flex-col items-center justify-end mx-2 transform scale-[0.9] sm:scale-100 origin-bottom">
        
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
              className="flex flex-col items-center justify-center -mt-2"
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
              <span className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium mt-1">
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
        </div> {/* End of Bottom Center */}

        {/* Hourly Trend (Bottom Right) */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-[1.2rem] px-4 py-2.5 shadow-2xl pointer-events-none transform scale-[0.85] sm:scale-100 origin-bottom-right">
          <div className="flex items-end gap-1 h-4">
             <div className="w-1 h-2 bg-white/30 rounded-full" />
             <div 
               className="w-1.5 h-4 rounded-full animate-pulse" 
               style={{ 
                 backgroundColor: trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158',
                 boxShadow: `0 0 6px ${trafficDensity > 70 ? '#FF453A' : trafficDensity > 40 ? '#FF9F0A' : '#30D158'}`
               }}
             />
             <div className="w-1 h-3 bg-white/30 rounded-full" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-white tabular-nums tracking-wider leading-none mt-0.5">
              {currentTime}
            </span>
          </div>
        </div>

      </div> {/* End of Bottom Dashboard SafeArea */}

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
