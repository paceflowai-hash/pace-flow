'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TeslaCanvasEngine } from '@/components/ui/TeslaCanvasEngine';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Create supabase client
      const supabase = createBrowserClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden">
      
      {/* 3D Background Engine */}
      <TeslaCanvasEngine />

      {/* Blur Overlay to make the form readable */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10" />

      {/* Auth Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-20 w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <div className="flex flex-col items-center justify-center mb-6">
            <img 
              src="/logo.png" 
              alt="PaceFlow Logo" 
              className="w-auto h-16 object-contain mix-blend-screen opacity-90 drop-shadow-[0_0_15px_rgba(48,209,88,0.3)]" 
            />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.1em] mb-2">
            Sisteme Bağlan
          </h1>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
            Senkronizasyon ağına katılmak için yetkilendirme gerekli.
          </p>
        </div>

        {isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black/50 border border-[var(--pace-synced)] p-6 text-center shadow-[0_0_20px_rgba(48,209,88,0.1)]"
          >
            <div className="w-12 h-12 rounded-full border-2 border-[var(--pace-synced)] text-[var(--pace-synced)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg text-white font-medium uppercase tracking-widest mb-2">
              Bağlantı Gönderildi
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {email} adresine güvenli giriş bağlantısı iletildi. Lütfen gelen kutunuzu kontrol edin.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <Input
              label="E-posta Adresi"
              type="email"
              placeholder="PROTOKOL@ORNEK.COM"
              value={email}
              onChange={setEmail}
              error={error || undefined}
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              Bağlantı Linki Gönder
            </Button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
