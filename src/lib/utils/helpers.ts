// ============================================
// Hız & Konum Yardımcı Fonksiyonları
// ============================================

/**
 * m/s hızını km/h'ye çevirir
 */
export function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

/**
 * İki koordinat arası mesafeyi metre cinsinden hesaplar (Haversine)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Dünya yarıçapı (metre)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Hız tolerans kontrolü — PaceStatus belirler
 */
export function getPaceStatus(
  currentSpeed: number,
  targetSpeed: number
): 'synced' | 'warning' | 'danger' | 'idle' {
  if (targetSpeed <= 0) return 'idle';

  const diff = Math.abs(currentSpeed - targetSpeed);
  const ratio = diff / targetSpeed;

  if (ratio <= 0.05) return 'synced';
  if (ratio <= 0.15) return 'warning';
  return 'danger';
}

/**
 * Hız değerini formatlar (65.4 → "65")
 */
export function formatSpeed(speed: number): string {
  return Math.round(speed).toString();
}

/**
 * Süreyi okunabilir formata çevirir (1234 saniye → "20 dk 34 sn")
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} sn`;
  return `${mins} dk ${secs} sn`;
}

/**
 * GPS spoofing tespiti — iki nokta arası fiziksel olarak imkansız hız
 */
export function isSpoofedPosition(
  prevLat: number,
  prevLon: number,
  currLat: number,
  currLon: number,
  timeDeltaMs: number
): boolean {
  if (timeDeltaMs <= 0) return true;

  const distanceM = haversineDistance(prevLat, prevLon, currLat, currLon);
  const timeDeltaS = timeDeltaMs / 1000;
  const impliedSpeedKmh = (distanceM / timeDeltaS) * 3.6;

  return impliedSpeedKmh > 300; // 300 km/h üstü = spoof
}
