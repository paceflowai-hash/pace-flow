import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Şu path'ler hariç tüm istekleri eşle:
     * - _next/static (statik dosyalar)
     * - _next/image (görsel optimizasyonu)
     * - favicon.ico (favicon)
     * - public klasörü (ikonlar, manifest vs.)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
