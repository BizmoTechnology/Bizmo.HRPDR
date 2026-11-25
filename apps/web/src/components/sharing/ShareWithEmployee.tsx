"use client";

import { useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fromShareChoice,
  resolveShare,
  toShareChoice,
  useOrgSettings,
  type ShareChoice,
  type ShareOverride,
} from "@/hooks/use-sharing";

/**
 * "Varsayılan (…) / Paylaş / Paylaşma" seçimi. Değer tri-state'tir:
 * null = kurum varsayılanı, true = paylaş, false = paylaşma.
 * Assessment dışındaki kayıtlarda (360° dönemi, kariyer planı) da kullanılabilir.
 */
export function ShareWithEmployeeControl({
  value,
  onChange,
  disabled,
  label = "Sonuçları personelle paylaş",
  className,
}: {
  value: ShareOverride | undefined;
  onChange: (next: ShareOverride) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  const { data: settings, isLoading } = useOrgSettings();
  const orgDefault = settings?.shareResultsDefault ?? false;
  const choice = toShareChoice(value);
  const effective = resolveShare(value, orgDefault);

  const options: { key: ShareChoice; label: string }[] = [
    {
      key: "default",
      label: isLoading ? "Varsayılan" : `Varsayılan (${orgDefault ? "Paylaş" : "Paylaşma"})`,
    },
    { key: "share", label: "Paylaş" },
    { key: "noshare", label: "Paylaşma" },
  ];

  return (
    <div className={cn("bz-form-row", className)}>
      <span className="bz-label" id={labelId}>
        {label}
      </span>
      <div
        className="bz-segmented w-full self-start sm:w-auto"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hintId}
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={choice === o.key}
            disabled={disabled}
            onClick={() => onChange(fromShareChoice(o.key))}
            // Dar ekranda uzun etiket iki satıra kırılır (taşmaz); sm ve üstünde tek satır
            className="h-auto min-h-[30px] min-w-0 flex-auto justify-center py-1 text-center leading-tight sm:flex-none sm:whitespace-nowrap"
          >
            {o.label}
          </button>
        ))}
      </div>
      <p id={hintId} className="bz-hint flex items-start gap-1.5">
        {effective ? (
          <Eye className="mt-[1px] h-3.5 w-3.5 flex-none" aria-hidden="true" />
        ) : (
          <EyeOff className="mt-[1px] h-3.5 w-3.5 flex-none" aria-hidden="true" />
        )}
        <span>
          {effective
            ? "Etkin değer: paylaşılır. İK onayı verilip rapor oluşturulduktan sonra personel sonucunu portalında görür."
            : "Etkin değer: paylaşılmaz. Sonuç personelin portalında görünmez."}
          {choice === "default" && " Ayarlar → Personelle paylaşım bölümündeki kurum varsayılanı uygulanır."}
        </span>
      </p>
    </div>
  );
}

/** Detay sayfaları için durum çipi: sonuçlar personelle paylaşılıyor mu? */
export function ShareStatusChip({
  value,
  className,
}: {
  value: ShareOverride | undefined;
  className?: string;
}) {
  const { data: settings, isLoading } = useOrgSettings();
  if (isLoading) return null;
  const orgDefault = settings?.shareResultsDefault ?? false;
  const effective = resolveShare(value, orgDefault);
  const isDefault = value === null || value === undefined;

  return (
    <span
      className={cn("bz-chip", effective && "bz-chip--success", className)}
      title={
        isDefault
          ? "Kurum varsayılanı uygulanıyor (Ayarlar → Personelle paylaşım)"
          : "Bu değerlendirmeye özel paylaşım ayarı"
      }
    >
      {effective ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
      {effective ? "Personelle paylaşılıyor" : "Personelle paylaşılmıyor"}
      {isDefault && <span className="font-normal opacity-75">· varsayılan</span>}
    </span>
  );
}
