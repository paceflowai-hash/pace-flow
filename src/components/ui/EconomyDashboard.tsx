'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    // Sadece sürüş halindeyken ve "synced" iken puan/yakıt kazansın.
    if (!isDriving || paceStatus !== 'synced') return;

    const interval = setInterval(() => {
      setPacePoints(prev => prev + 5); // 5 points per second in synced mode
      setFuelSavedML(prev => prev + 0.12); // 0.12 mL per second saved
    }, 1000);

    return () => clearInterval(interval);
  }, [paceStatus, isDriving]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-end gap-2 pointer-events-none"
    >
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
