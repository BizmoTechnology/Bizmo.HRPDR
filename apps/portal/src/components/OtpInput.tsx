"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface OtpInputHandle {
  focus: () => void;
}

/**
 * Tek kullanımlık kod kutuları (DESIGN.md §39 `.bz-otp`). Temanın `bizmoOtpInput`
 * yardımcısının React karşılığı; farkı: SMS otomatik doldurma (iOS / Android klavye)
 * ve yapıştırmada kodun tamamı tek kutuya gelir — kutulara dağıtılır. Kod sırayla
 * dolar: boş kutulardan ilerisine odaklanılamaz, böylece arada boşluk kalmaz.
 */
export const OtpInput = forwardRef<
  OtpInputHandle,
  {
    value: string;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    length?: number;
    invalid?: boolean;
    disabled?: boolean;
    label?: string;
    describedBy?: string;
  }
>(function OtpInput(
  { value, onChange, onComplete, length = 6, invalid, disabled, label = "Doğrulama kodu", describedBy },
  ref,
) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focusBox = (i: number) => boxes.current[Math.max(0, Math.min(i, length - 1))]?.focus();

  useImperativeHandle(ref, () => ({ focus: () => focusBox(value.length) }));

  /** i. kutudan başlayarak haneleri yazar (tek hane, otomatik doldurma ya da yapıştırma) */
  const writeFrom = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const chars = value.split("");
    digits.split("").forEach((d, k) => {
      if (i + k < length) chars[i + k] = d;
    });
    const next = chars.join("").slice(0, length);
    onChange(next);
    focusBox(Math.min(i + digits.length, length - 1));
    if (next.length === length) onComplete?.(next);
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="bz-otp"
      data-state={invalid ? "error" : undefined}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          // iOS / Android SMS'teki kodu klavyenin üstünde önerir
          autoComplete={i === 0 ? "one-time-code" : "off"}
          enterKeyHint={i === length - 1 ? "go" : "next"}
          aria-label={`${i + 1}. hane`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={value[i] ?? ""}
          onFocus={(e) => {
            if (i > value.length) focusBox(value.length);
            else e.currentTarget.select();
          }}
          onChange={(e) => {
            // Dolu kutuya tek hane yazılınca (eski hane seçili değilse) yalnız yeni hane alınır;
            // çok haneli değer (otomatik doldurma) olduğu gibi dağıtılır
            const raw = e.currentTarget.value;
            const old = value[i] ?? "";
            writeFrom(i, raw.length === 2 && old && raw.includes(old) ? raw.replace(old, "") : raw);
          }}
          onPaste={(e) => {
            e.preventDefault();
            writeFrom(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (value[i]) {
                onChange(value.slice(0, i) + value.slice(i + 1));
              } else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focusBox(i - 1);
              }
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focusBox(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              if (i < value.length) focusBox(i + 1);
            }
          }}
          className={cn(disabled && "opacity-60")}
        />
      ))}
    </div>
  );
});
