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

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setError(null);
    setIsLoading(true);
    
    try {
      const supabase = createBrowserClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || `${provider} ile giriş yapılırken bir hata oluştu.`);
      setIsLoading(false);
    }
  };

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
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-[var(--pace-synced)] animate-pulse shadow-[0_0_10px_rgba(48,209,88,0.5)]" />
            <span className="text-lg font-semibold text-white tracking-[0.15em] uppercase">
              PaceFlow
            </span>
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
          <div className="flex flex-col gap-6">
            
            {/* Social Logins */}
            <div className="flex flex-col gap-3">
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => handleOAuthLogin('apple')}
                className="border-[var(--text-tertiary)] hover:border-white hover:text-white flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                Apple ile Devam Et
              </Button>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                onClick={() => handleOAuthLogin('google')}
                className="border-[var(--text-tertiary)] hover:border-white hover:text-white flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google ile Devam Et
              </Button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[var(--text-tertiary)] opacity-30"></div>
              <span className="flex-shrink-0 mx-4 text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
                veya E-Posta ile
              </span>
              <div className="flex-grow border-t border-[var(--text-tertiary)] opacity-30"></div>
            </div>

            {/* Email Login Form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
          </div>
        )}
      </motion.div>

      {/* Footer Logo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="absolute bottom-8 z-20 flex flex-col items-center gap-2"
      >
        <img 
          src="/logo.png" 
          alt="PaceFlow Logo" 
          className="w-auto h-10 object-contain mix-blend-screen opacity-50" 
        />
        <p className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider opacity-50">
          PaceFlow AI INC. © 2026
        </p>
      </motion.div>
    </main>
  );
}
