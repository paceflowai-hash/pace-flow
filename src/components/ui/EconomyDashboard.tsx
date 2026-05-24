'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Droplet } from 'lucide-react';

interface EconomyDashboardProps {
  paceStatus: 'idle' | 'speed_up' | 'synced' | 'slow_down';
  isDriving: boolean;
}

export function EconomyDashboard({ paceStatus, isDriving }: EconomyDashboardProps) {
  const [pacePoints, setPacePoints] = useState(0);
  const [fuelSavedML, setFuelSavedML] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Gamification Loop (Per Session)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const streakRef = useRef(0);
  const multiplierRef = useRef(1);
  const toleranceRef = useRef<number | null>(null);
  
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const [isComboActive, setIsComboActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isDriving) {
        if (paceStatus === 'synced') {
          // Clear any breaking tolerance timer
          if (toleranceRef.current) {
            clearTimeout(toleranceRef.current);
            toleranceRef.current = null;
          }

          streakRef.current += 1;
          
          if (streakRef.current >= 60) multiplierRef.current = 3;
          else if (streakRef.current >= 30) multiplierRef.current = 2;
          else multiplierRef.current = 1;

          setDisplayMultiplier(multiplierRef.current);
          setIsComboActive(multiplierRef.current > 1);

          setPacePoints(prev => prev + (5 * multiplierRef.current));
          setFuelSavedML(prev => prev + (0.12 * multiplierRef.current));
        } else {
          // Tolerance mechanism: allow 5 seconds out of sync before breaking streak
          if (!toleranceRef.current && streakRef.current > 0) {
            toleranceRef.current = window.setTimeout(() => {
              streakRef.current = 0;
              multiplierRef.current = 1;
              setDisplayMultiplier(1);
              setIsComboActive(false);
              toleranceRef.current = null;
            }, 5000); // 5s tolerance
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [paceStatus, isDriving]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none"
    >
      {/* Green Wave Combo Badge */}
      <AnimatePresence>
        {isComboActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.5, x: 20 }}
            className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/50 backdrop-blur-md px-3 py-1 rounded-full shadow-[0_0_15px_#f97316] mb-1"
          >
            <span className="text-sm animate-bounce">🔥</span>
            <span className="text-orange-400 font-bold text-xs tracking-wider">GREEN WAVE x{displayMultiplier}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fuel Saved Widget */}
      <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-lg">
        <Droplet className="w-3.5 h-3.5 text-emerald-400" />
        <div className="flex items-baseline gap-1">
          <span className="text-white font-bold text-sm tracking-tight">{fuelSavedML.toFixed(1)}</span>
          <span className="text-white/50 text-[10px] uppercase font-bold tracking-widest">mL</span>
        </div>
      </div>

      {/* Pace Points Widget */}
      <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-amber-500/20 px-3 py-1.5 rounded-full shadow-lg">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <div className="flex items-baseline gap-1">
          <span className="text-white font-bold text-sm tracking-tight">{pacePoints}</span>
          <span className="text-white/50 text-[10px] uppercase font-bold tracking-widest">Puan</span>
        </div>
      </div>
    </motion.div>
  );
}
