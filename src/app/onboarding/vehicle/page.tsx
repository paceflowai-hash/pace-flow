'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TeslaCanvasEngine } from '@/components/ui/TeslaCanvasEngine';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types';

export default function VehicleRegistrationPage() {
  const router = useRouter();
  const [licensePlate, setLicensePlate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePlate = (plate: string) => {
    // Türkiye plaka formatı: 34ABC123 veya 34 ABC 123
    const plateRegex = /^(0[1-9]|[1-7][0-9]|8[0-1])\s*[A-Z]{1,3}\s*[0-9]{2,4}$/i;
    return plateRegex.test(plate.trim());
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const formattedPlate = licensePlate.toUpperCase().trim();
    
    if (!validatePlate(formattedPlate)) {
      setError('Geçersiz plaka formatı. (Örn: 34 ABC 123)');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Oturum kontrolü
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Supabase'e kaydet (UNIQUE constraint hatası dönebilir)
      const { error: dbError } = await supabase
        .from('vehicles')
        .insert({
          user_id: user.id,
          license_plate: formattedPlate,
          vehicle_model: null,
        });

      if (dbError) {
        // Hata kodu 23505 = UNIQUE kısıtlaması ihlali (Aynı plaka var)
        if (dbError.code === '23505') {
          throw new Error('Bu plaka ağda zaten kayıtlı. Her araç tek bir profile bağlanabilir.');
        }
        throw new Error(dbError.message || 'Kayıt sırasında hata oluştu.');
      }

      // Başarılı ise kullanıcı flag'ini güncelle
      await supabase
        .from('users')
        .update({ is_onboarded: true })
        .eq('id', user.id);

      // Sürüş ekranına yönlendir
      router.push('/drive');

    } catch (err: any) {
      setError(err.message || 'Bilinmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden">
      
      {/* 3D Background Engine */}
      <TeslaCanvasEngine />

      {/* Blur Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10" />

      {/* Registration Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-20 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-[var(--pace-warning)] animate-pulse" />
            <span className="text-xs font-medium text-[var(--pace-warning)] tracking-widest uppercase">
              Kayıt Bekleniyor
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-[0.1em] mb-2">
            Araç Tanımlama
          </h1>
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
            Ağda eşsiz olarak tanımlanabilmeniz için araç plakanızı sisteme bağlayın.
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-6">
          <Input
            label="Araç Plakası"
            type="text"
            placeholder="34 ABC 123"
            value={licensePlate}
            onChange={(val) => setLicensePlate(val.toUpperCase())}
            error={error || undefined}
            required
            maxLength={12}
            autoFocus
          />
          
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isLoading}
          >
            Sisteme Bağla
          </Button>

          <p className="text-[10px] text-[var(--text-tertiary)] text-center mt-2 leading-relaxed opacity-70">
            DİKKAT: KAYITLI PLAKALAR AĞ GÜVENLİĞİ İÇİN KİMLİĞİNİZLE EŞLEŞTİRİLİR VE DAHA SONRA DEĞİŞTİRİLEMEZ.
          </p>
        </form>
      </motion.div>
    </main>
  );
}
