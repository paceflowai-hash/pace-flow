export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] px-6 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-heading font-bold text-[var(--text-primary)] mb-3">
        Bağlantı Yok
      </h1>
      <p className="text-body text-[var(--text-secondary)] max-w-sm">
        İnternet bağlantınızı kontrol edip tekrar deneyin.
        Pace/Flow çalışmak için aktif bir bağlantı gerektirir.
      </p>
    </main>
  );
}
