"use client";

import { Route } from "lucide-react";

/**
 * YER TUTUCU — Aşama 3 (AI destekli kariyer yolu) bu dosyanın gerçek sürümünü getirir.
 * Entegrasyonda kariyer oturumunun `CareerTab.tsx` dosyası bunun yerine alınır; arayüz
 * (`<CareerTab personnelId={id} />`) aynı kalmalıdır. Sahte öneri gösterilmez.
 */
export function CareerTab({ personnelId }: { personnelId: string }) {
  return (
    <div className="bz-empty py-12" data-personnel-id={personnelId}>
      <Route className="h-7 w-7 text-fg3" aria-hidden="true" />
      <p className="bz-empty__title text-[15px]">Kariyer yolu planı henüz yok</p>
      <p className="bz-empty__text">
        Kariyer yolu planlama bu sürümde etkin değil. Etkinleştirildiğinde İK onaylı
        analizlere dayalı plan burada görünür.
      </p>
    </div>
  );
}

export default CareerTab;
