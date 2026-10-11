import type { ReactNode } from "react";
import { AppMark } from "@/components/AppMark";

/**
 * Giriş sonrası ekranların üst satırı: solda uygulama simgesi ve adı, sağda ekranın ikincil eylemi
 * (ör. "Çıkış yap", soru sayacı). Dokunmatikte satır en az 44px (DESIGN.md §30).
 */
export function PortalHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <AppMark size="sm" />
        <span className="truncate font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
          PotansiyelHaritası
        </span>
      </div>
      {children}
    </header>
  );
}
