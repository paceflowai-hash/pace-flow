'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { TeslaRoad } from '@/components/ui/TeslaRoad';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  // Service Worker kaydı
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }
  }, []);

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
      
      {/* 3D Tesla Autopilot Background */}
      <TeslaRoad />

      {/* Logo / Branding */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="mb-12 relative z-10"
      >
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-[var(--pace-synced)] animate-pulse shadow-[0_0_10px_rgba(48,209,88,0.5)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)] tracking-widest uppercase">
            Pace/Flow
          </span>
        </div>

        <h1 className="text-heading font-bold text-[var(--text-primary)] leading-tight mb-6">
          Trafik Akışını
          <br />
          <span className="text-[var(--pace-synced)] drop-shadow-[0_0_15px_rgba(48,209,88,0.5)]">Birlikte Senkronize Et</span>
        </h1>

        <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed opacity-90">
          Hayalet sıkışıklıkları yok et. Otonom seviyesinde veri görselleştirmesi ve kusursuz senkronizasyon ile yeni nesil sürüş deneyimine bağlan.
        </p>
      </motion.div>

      {/* CTA Butonları */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        className="flex flex-col gap-3 w-full max-w-sm relative z-10"
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push('/login')}
        >
          Başla
        </Button>

        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={() => router.push('/login')}
        >
          Zaten hesabım var
        </Button>
      </motion.div>

      {/* Alt bilgi */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="mt-12 flex flex-col items-center gap-4 relative z-10"
      >
        <img 
          src="/logo.png" 
          alt="PaceFlow Logo" 
          className="w-auto h-12 object-contain mix-blend-screen opacity-60" 
        />
        <div className="flex flex-col gap-1 items-center">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
            PaceFlow AI INC. 2026 All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] opacity-70">
            Pace/Flow bir trafik danışmanlığı hizmeti değildir.
          </p>
        </div>
      </motion.div>
    </main>
  );
}
