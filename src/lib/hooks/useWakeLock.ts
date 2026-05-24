'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────
export interface UseWakeLockReturn {
  isActive: boolean;
  isSupported: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────
// Prevents the screen from turning off during active drive sessions.
// Uses the Screen Wake Lock API (W3C standard).
// Automatically re-acquires the lock when the tab regains visibility
// (e.g., user switches apps and comes back).
export function useWakeLock(): UseWakeLockReturn {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Check support on mount ──
  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  // ── Request wake lock ──
  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      // Listen for release (system may release when tab is hidden)
      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err) {
      // Wake lock request failed (e.g., low battery, permission denied)
      console.warn('[WakeLock] Request failed:', err);
      setIsActive(false);
    }
  }, []);

  // ── Release wake lock ──
  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Already released — ignore
      }
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  // ── Re-acquire on visibility change ──
  // When user switches away and returns, the wake lock is
  // automatically released by the browser. We re-acquire it.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isActive) {
        // Tab came back to foreground — re-acquire
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, request]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  return { isActive, isSupported, request, release };
}
