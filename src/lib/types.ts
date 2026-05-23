// ============================================
// PACE/FLOW — Merkezi Tip Tanımları
// project_rules.md & coding_bible.md referanslı
// ============================================

// ---- Veritabanı Satır Tipleri ----

export interface User {
  id: string;
  phone_number: string | null;
  email: string | null;
  display_name: string | null;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  license_plate: string;
  vehicle_model: string | null;
  created_at: string;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  current_speed: number;
  target_speed: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  active_segment_id: string | null;
  is_active: boolean;
  started_at: string;
  last_updated_at: string;
}

export interface PacingPoints {
  id: string;
  user_id: string;
  total_points: number;
  total_drive_seconds: number;
  total_sessions: number;
  last_earned_at: string | null;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  user_id: string;
  session_id: string | null;
  points_earned: number;
  reason: 'pace_sync' | 'bonus' | 'streak';
  created_at: string;
}

// ---- Uygulama Tipleri ----

export type PaceStatus = 'synced' | 'warning' | 'danger' | 'idle';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

export type GPSStatus = 'active' | 'waiting' | 'denied' | 'unavailable';

export interface DriveSessionSummary {
  duration: number; // saniye
  pointsEarned: number;
  complianceRate: number; // 0-100 yüzde
  averageSpeed: number;
}

// ---- Broadcast Payload Tipleri ----

export interface PositionBroadcast {
  speed: number;
  lat: number;
  lng: number;
  heading: number | null;
  ts: number;
}

export interface TargetSpeedBroadcast {
  speed: number;
  nearby_count: number;
  segment_id: string;
}

// ---- Hata Tipleri ----

export class AppError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message, 'AUTH_ERROR');
    this.status = status;
    this.name = 'AuthError';
  }
}
