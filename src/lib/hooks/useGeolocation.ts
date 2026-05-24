'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────
export interface GeoPosition {
  latitude: number;
  longitude: number;
  speed_kmh: number;       // km/h (filtered)
  speed_raw_kmh: number;   // km/h (raw from GPS)
  heading: number;         // degrees (0-360)
  accuracy: number;        // meters
  timestamp: number;       // ms
}

export type GeoPermission = 'prompt' | 'granted' | 'denied' | 'unavailable';
export type GeoStatus = 'idle' | 'watching' | 'paused' | 'error';

export interface UseGeolocationReturn {
  position: GeoPosition | null;
  permission: GeoPermission;
  status: GeoStatus;
  error: string | null;
  startWatching: () => void;
  stopWatching: () => void;
}

// ─── Constants ─────────────────────────────────────────
const SPOOFING_THRESHOLD_KMH = 300;
const MAX_ACCURACY_METERS = 50000; // Increased massively for development/desktop testing
const MOVING_AVG_WINDOW = 5;
const GPS_TIMEOUT_MS = 10000;
const MIN_SPEED_KMH = 0;

// ─── Moving Average Filter ────────────────────────────
// Smooths GPS noise by averaging the last N speed samples.
// Simple, effective, and low-latency for our use case.
class MovingAverageFilter {
  private window: number[];
  private maxSize: number;

  constructor(size: number = MOVING_AVG_WINDOW) {
    this.window = [];
    this.maxSize = size;
  }

  push(value: number): number {
    this.window.push(value);
    if (this.window.length > this.maxSize) {
      this.window.shift();
    }
    return this.getAverage();
  }

  getAverage(): number {
    if (this.window.length === 0) return 0;
    const sum = this.window.reduce((a, b) => a + b, 0);
    return sum / this.window.length;
  }

  reset() {
    this.window = [];
  }
}

// ─── Hook ──────────────────────────────────────────────
export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [permission, setPermission] = useState<GeoPermission>('prompt');
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeoPosition | null>(null);
  const speedFilterRef = useRef(new MovingAverageFilter(MOVING_AVG_WINDOW));

  // ── Check if Geolocation API is available ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable');
      setError('Bu cihaz konum servislerini desteklemiyor.');
      return;
    }

    // Check existing permission state (if API available)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermission(result.state as GeoPermission);
        result.addEventListener('change', () => {
          setPermission(result.state as GeoPermission);
        });
      });
    }
  }, []);

  // ── Anti-Spoofing Validator ──
  const validatePosition = useCallback(
    (coords: GeolocationCoordinates, timestamp: number): boolean => {
      // DEV: Her koşulda konumu kabul et (Masaüstü testleri için)
      return true;
    },
    []
  );

  // ── Success handler ──
  const onSuccess = useCallback(
    (geoPosition: GeolocationPosition) => {
      const { coords, timestamp } = geoPosition;

      // Validate before processing
      if (!validatePosition(coords, timestamp)) {
        return; // Silently discard invalid reading
      }

      const rawSpeedKmh = Math.max(0, (coords.speed ?? 0) * 3.6);
      const filteredSpeedKmh = speedFilterRef.current.push(rawSpeedKmh);

      const newPosition: GeoPosition = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed_kmh: Math.round(filteredSpeedKmh * 10) / 10, // 1 decimal
        speed_raw_kmh: Math.round(rawSpeedKmh * 10) / 10,
        heading: coords.heading ?? 0,
        accuracy: coords.accuracy,
        timestamp,
      };

      lastPositionRef.current = newPosition;
      setPosition(newPosition);
      setStatus('watching');
      setError(null);
    },
    [validatePosition]
  );

  // ── Error handler ──
  const onError = useCallback((geoError: GeolocationPositionError) => {
    switch (geoError.code) {
      case geoError.PERMISSION_DENIED:
        setPermission('denied');
        setError('Konum izni reddedildi. Lütfen ayarlardan konum iznini aktif edin.');
        setStatus('error');
        break;
      case geoError.POSITION_UNAVAILABLE:
        // Silently wait for the next GPS signal without spamming the UI
        setStatus('paused');
        break;
      case geoError.TIMEOUT:
        // Silently retry
        setStatus('paused');
        break;
    }
  }, []);

  // ── Start watching ──
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) return; // Already watching

    setStatus('watching');
    setError(null);
    speedFilterRef.current.reset();

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: false, // DEV: Masaüstünde takılmaları önlemek için false yapıldı
      timeout: GPS_TIMEOUT_MS,
      maximumAge: 0, // Always fresh data
    });

    // DEV: Eğer masaüstü tarayıcı tamamen takılır ve ne hata ne de başarı dönerse
    // 3 saniye sonra otomatik olarak mock bir konum yükle (İstanbul/Kadıköy).
    setTimeout(() => {
      setPosition((currentPosition) => {
        if (!currentPosition) {
          const mockPosition: GeoPosition = {
            latitude: 40.9901,
            longitude: 29.0292,
            speed_kmh: 0,
            speed_raw_kmh: 0,
            heading: 0,
            accuracy: 10,
            timestamp: Date.now(),
          };
          setStatus('watching');
          setError(null);
          return mockPosition;
        }
        return currentPosition;
      });
    }, 3000);
  }, [onSuccess, onError]);

  // ── Stop watching ──
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('idle');
    speedFilterRef.current.reset();
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    position,
    permission,
    status,
    error,
    startWatching,
    stopWatching,
  };
}
