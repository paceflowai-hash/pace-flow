'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────
export interface ShockEvent {
  gForce: number;      // negative = braking
  timestamp: number;
}

export interface UseDeviceMotionReturn {
  isSupported: boolean;
  isListening: boolean;
  lastShock: ShockEvent | null;
  startListening: () => void;
  stopListening: () => void;
}

// ─── Constants ─────────────────────────────────────────
const HARD_BRAKE_THRESHOLD = -6; // m/s² (strong deceleration)
const THROTTLE_MS = 1000;        // Max 1 reading per second (normal)

// ─── Hook ──────────────────────────────────────────────
// Detects hard braking events using the device's accelerometer.
// When a sudden negative G-force is detected (driver slams brakes),
// the system flags it as a SHOCK_WAVE_ALERT for immediate upstream
// propagation to prevent phantom traffic jams.
export function useDeviceMotion(): UseDeviceMotionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastShock, setLastShock] = useState<ShockEvent | null>(null);

  const lastEventTimeRef = useRef(0);

  // ── Check support ──
  useEffect(() => {
    setIsSupported('DeviceMotionEvent' in window);
  }, []);

  // ── Motion handler ──
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const now = Date.now();

    // Throttle normal readings to 1/sec
    if (now - lastEventTimeRef.current < THROTTLE_MS) {
      // But ALWAYS check for shock events (bypass throttle)
      const az = event.accelerationIncludingGravity?.z ?? 0;
      if (az < HARD_BRAKE_THRESHOLD) {
        setLastShock({ gForce: az, timestamp: now });
        lastEventTimeRef.current = now;
      }
      return;
    }

    lastEventTimeRef.current = now;

    const az = event.accelerationIncludingGravity?.z ?? 0;

    // Detect hard braking (strong negative acceleration on Z-axis)
    if (az < HARD_BRAKE_THRESHOLD) {
      setLastShock({ gForce: az, timestamp: now });
    }
  }, []);

  // ── Start / Stop ──
  const startListening = useCallback(() => {
    if (!('DeviceMotionEvent' in window)) return;
    window.addEventListener('devicemotion', handleMotion);
    setIsListening(true);
  }, [handleMotion]);

  const stopListening = useCallback(() => {
    window.removeEventListener('devicemotion', handleMotion);
    setIsListening(false);
  }, [handleMotion]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion]);

  return { isSupported, isListening, lastShock, startListening, stopListening };
}
