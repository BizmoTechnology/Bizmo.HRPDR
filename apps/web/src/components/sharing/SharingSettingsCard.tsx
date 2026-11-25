"use client";

import { Loader2, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { apiErrorMessage } from "@/lib/api";
import {
  useCanEditOrgSettings,
  useOrgSettings,
  useUpdateOrgSettings,
} from "@/hooks/use-sharing";

/**
 * Ayarlar → "Personelle paylaşım": kurum genelindeki varsayılan.
 * Sistem varsayılanı KAPALI'dır; her değerlendirmede ayrıca geçersiz kılınabilir.
 */
export function SharingSettingsCard() {
  const { data, isLoading, isError } = useOrgSettings();
  const update = useUpdateOrgSettings();
  const canEdit = useCanEditOrgSettings();
  const checked = data?.shareResultsDefault ?? false;

  const toggle = () => {
    const next = !checked;
    update.mutate(
      { shareResultsDefault: next },
      {
        onSuccess: () =>
          toast.success(
            next
              ? "Sonuçlar artık varsayılan olarak personelle paylaşılacak"
              : "Sonuçlar artık varsayılan olarak paylaşılmayacak",
          ),
        onError: (err) => toast.error(apiErrorMessage(err, "Ayar kaydedilemedi")),
      },
    );
  };

  return (
    <GlassCard hover={false}>
      <div className="mb-3 flex items-center gap-3">
        <span className="bz-icon-box" aria-hidden="true">
          <Share2 />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-foreground">Personelle paylaşım</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Personelin kendi sonuçlarını portalında görmesi
          </p>
        </div>
      </div>

      <div className="bz-setting">
        <div className="bz-setting__text">
          <p className="bz-setting__title" id="share-default-title">
            Sonuçları varsayılan olarak paylaş
          </p>
          <p className="bz-setting__desc" id="share-default-desc">
            {isLoading
              ? "Yükleniyor..."
              : isError
                ? "Ayar okunamadı"
                : checked
                  ? "Açık: aksi belirtilmeyen değerlendirmelerin sonuçları personelle paylaşılır."
                  : "Kapalı: yalnız “Paylaş” seçilen değerlendirmelerin sonuçları paylaşılır."}
          </p>
        </div>
        <div className="bz-setting__control flex items-center gap-2">
          {update.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-fg3" aria-hidden="true" />
          )}
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby="share-default-title"
            aria-describedby="share-default-desc"
            disabled={!canEdit || isLoading || isError || update.isPending}
            onClick={toggle}
            className="bz-switch disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="bz-callout mt-3" data-tone="info">
        <p className="bz-callout__title">
          <ShieldCheck aria-hidden="true" />
          Ne paylaşılır?
        </p>
        <p className="text-[12.5px]">
          Sonuç yalnız İK onayı verilmiş ve raporu oluşturulmuş testlerde görünür: genel
          skor, boyut skorları, yönetici özeti, güçlü yönler, gelişim alanları ve kariyer
          önerileri. Ham cevaplar, psikolojik analiz ve inceleme yorumları hiçbir zaman
          paylaşılmaz. Her değerlendirmede bu varsayılan “Paylaş / Paylaşma” ile geçersiz
          kılınabilir.
        </p>
      </div>

      {!canEdit && (
        <p className="bz-hint mt-3">Bu ayarı yalnız yöneticiler değiştirebilir.</p>
      )}
    </GlassCard>
  );
}
