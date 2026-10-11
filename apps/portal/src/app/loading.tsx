/** Sayfa geçişi: içeriğin şekli bilinmediği için tam ekran durum + tema döner göstergesi (DESIGN.md §17) */
export default function PortalLoading() {
  return (
    <main className="bz-aurora bz-status-screen min-h-dvh w-full" role="status">
      <div className="flex flex-col items-center gap-3">
        <span className="bz-spinner h-7 w-7" aria-hidden="true" />
        <p className="text-sm text-fg2">Yükleniyor…</p>
      </div>
    </main>
  );
}
