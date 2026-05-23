// ============================================
// Supabase Hata Kodları → Kullanıcı Mesajları
// ============================================

const SUPABASE_ERRORS: Record<string, string> = {
  '23505': 'Bu plaka zaten kayıtlı. Her plaka yalnızca bir hesaba bağlanabilir.',
  '23503': 'İlişkili kayıt bulunamadı.',
  '42501': 'Bu işlem için yetkiniz bulunmuyor.',
  PGRST116: 'Kayıt bulunamadı.',
  PGRST301: 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.',
  otp_expired: 'Doğrulama kodunun süresi doldu. Lütfen yeni bir kod isteyin.',
  invalid_otp: 'Geçersiz doğrulama kodu. Lütfen tekrar deneyin.',
};

/**
 * Supabase hata kodunu kullanıcı dostu mesaja çevirir.
 * İç detay ASLA sızdırılmaz.
 */
export function getErrorMessage(code: string | undefined): string {
  if (!code) return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  return (
    SUPABASE_ERRORS[code] ??
    'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
  );
}

/**
 * UNIQUE violation (23505) kontrolü — plaka çift kayıt engellemesi
 */
export function isDuplicatePlateError(errorCode: string | undefined): boolean {
  return errorCode === '23505';
}
