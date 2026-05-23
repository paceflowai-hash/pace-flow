// ============================================
// PACE/FLOW — Sabitler
// project_rules.md & algorithm_spec.md referanslı
// ============================================

// Hız Sabitleri
export const MAX_SPEED_THRESHOLD = 300; // km/h — bu üstü reject
export const MIN_SPEED_THRESHOLD = 0;
export const STOP_SPEED_THRESHOLD = 5; // km/h — durma tespiti
export const STOP_DURATION_THRESHOLD = 15; // saniye

// Tolerans
export const PACE_TOLERANCE_PERCENT = 0.05; // ±%5
export const PACE_WARNING_PERCENT = 0.15; // ±%15
export const MAX_SPEED_DROP_PERCENT = 0.85; // tek seferde maks %15 düşüş

// GPS
export const GPS_UPDATE_INTERVAL_MS = 1000; // 1 saniye
export const GPS_TIMEOUT_MS = 10000; // 10 saniye
export const GPS_MAX_AGE_MS = 0; // her zaman taze
export const SPOOFING_SPEED_THRESHOLD = 300; // km/h — imkansız hız sıçraması
export const SPOOFING_DISTANCE_THRESHOLD = 500; // metre — 1 saniyede maks

// Realtime
export const BROADCAST_INTERVAL_MS = 1000; // saniyede 1
export const TARGET_SPEED_RECALC_INTERVAL_MS = 2000;
export const NEARBY_COUNT_INTERVAL_MS = 5000;
export const RECONNECT_MAX_RETRIES = 5;

// Puan
export const POINTS_CHECK_INTERVAL_MS = 10000; // 10 saniye
export const POINTS_PER_INTERVAL = 1;

// Segment
export const GEOHASH_PRECISION = 6; // ~1.2km × 0.6km
export const NEARBY_RADIUS_KM = 5;
export const MIN_SEGMENT_VEHICLES = 3;

// UI
export const MIN_TOUCH_TARGET = 48; // px
export const BREATHING_SYNCED_DURATION = 4000; // ms
export const BREATHING_WARNING_DURATION = 2000;
export const BREATHING_DANGER_DURATION = 1000;

// Rate Limiting
export const MAX_UPDATES_PER_SECOND = 2;

// Plaka Regex (Türkiye)
export const LICENSE_PLATE_REGEX =
  /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-Z]{1,3}\s?\d{2,4}$/;
