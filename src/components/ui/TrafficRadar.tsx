import React from 'react';
import { motion } from 'framer-motion';

export interface DirectionalDensity {
  front: number;
  right: number;
  back: number;
  left: number;
}

interface TrafficRadarProps {
  directionalDensity: DirectionalDensity | null;
}

function getColor(density: number) {
  if (density >= 70) return '#FF453A'; // Severe/Heavy (Red)
  if (density >= 40) return '#FF9F0A'; // Moderate (Orange)
  if (density > 5) return '#30D158'; // Low (Green)
  return 'rgba(255, 255, 255, 0.05)'; // Clear/No data
}

export function TrafficRadar({ directionalDensity }: TrafficRadarProps) {
  const d = directionalDensity || { front: 0, right: 0, back: 0, left: 0 };
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-16 h-16 rounded-full bg-black/40 backdrop-blur-xl border-2 border-white/10 flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]"
    >
      {/* Sweeping Radar Animation */}
      <motion.div 
        className="absolute inset-0 rounded-full border border-white/5"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(255,255,255,0.1) 360deg)'
        }}
      />

      {/* Front Traffic Glow */}
      <div 
        className="absolute top-0 left-0 right-0 h-1/2 transition-colors duration-1000"
        style={{ 
          background: `radial-gradient(circle at top center, ${getColor(d.front)}, transparent 60%)`,
          opacity: d.front > 0 ? 0.8 : 0.2
        }}
      />
      {/* Right Traffic Glow */}
      <div 
        className="absolute top-0 right-0 bottom-0 w-1/2 transition-colors duration-1000"
        style={{ 
          background: `radial-gradient(circle at right center, ${getColor(d.right)}, transparent 60%)`,
          opacity: d.right > 0 ? 0.8 : 0.2
        }}
      />
      {/* Back Traffic Glow */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/2 transition-colors duration-1000"
        style={{ 
          background: `radial-gradient(circle at bottom center, ${getColor(d.back)}, transparent 60%)`,
          opacity: d.back > 0 ? 0.8 : 0.2
        }}
      />
      {/* Left Traffic Glow */}
      <div 
        className="absolute top-0 left-0 bottom-0 w-1/2 transition-colors duration-1000"
        style={{ 
          background: `radial-gradient(circle at left center, ${getColor(d.left)}, transparent 60%)`,
          opacity: d.left > 0 ? 0.8 : 0.2
        }}
      />
      
      {/* Crosshair lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-full h-[1px] bg-white" />
        <div className="absolute h-full w-[1px] bg-white" />
      </div>

      {/* Center car icon */}
      <div className="absolute w-2 h-2 bg-white rounded-full z-10 shadow-[0_0_8px_#FFF]">
        {/* Forward indicator */}
        <div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#0A84FF] rounded-full" />
      </div>

      {/* Inner Bezel */}
      <div className="absolute inset-0 rounded-full border-[1px] border-white/5 pointer-events-none" />
    </motion.div>
  );
}
