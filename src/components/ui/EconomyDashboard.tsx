'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Droplet } from 'lucide-react';

interface EconomyDashboardProps {
  paceStatus: 'speed-up' | 'slow-down' | 'synced';
  isDriving: boolean;
}

export function EconomyDashboard({ paceStatus, isDriving }: EconomyDashboardProps) {
  const [pacePoints, setPacePoints] = useState(0);
  const [fuelSavedML, setFuelSavedML] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    setIsMounted(true);
    const savedPoints = localStorage.getItem('pace_points');
    const savedFuel = localStorage.getItem('pace_fuel');
    if (savedPoints) setPacePoints(parseInt(savedPoints, 10));
    if (savedFuel) setFuelSavedML(parseFloat(savedFuel));
  }, []);

  // Gamification Loop
  useEffect(() => {
    if (!isDriving || paceStatus !== 'synced') return;

    const interval = setInterval(() => {
      setPacePoints(prev => {
        const newVal = prev + 5; // 5 points per second in synced mode
        localStorage.setItem('pace_points', newVal.toString());
        return newVal;
      });
      setFuelSavedML(prev => {
        const newVal = prev + 0.12; // 0.12 mL per second saved
        localStorage.setItem('pace_fuel', newVal.toString());
        return newVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paceStatus, isDriving]);

  if (!isMounted) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-6 left-6 flex flex-col gap-3 pointer-events-none"
    >
      {/* Fuel Saved Widget */}
      <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400">
          <Droplet className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Tasarruf (Yakıt)</div>
          <div className="text-white font-semibold text-sm tracking-tight">
            {fuelSavedML.toFixed(1)} <span className="text-white/40 text-xs">mL</span>
          </div>
        </div>
      </div>

      {/* Pace Points Widget */}
      <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400">
          <Coins className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Pace Puanı</div>
          <div className="text-white font-semibold text-sm tracking-tight">
            {pacePoints.toLocaleString()} <span className="text-white/40 text-xs">Puan</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
