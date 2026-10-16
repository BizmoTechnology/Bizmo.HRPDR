// ─────────────────────────────────────────
// TÜRKİYE CEP TELEFONU (SMS ile portal girişi)
// ─────────────────────────────────────────

/** Ülke kodu ve baştaki 0 olmadan: 5XX XXX XX XX */
const TR_MOBILE_LOCAL = /^5\d{9}$/;

/**
 * Türkiye cep numarasını E.164 biçimine (+905321234567) çevirir; geçersizse `null`.
 * Kabul edilen yazımlar: 0532 123 45 67 · 532 123 45 67 · +90 532 123 45 67 ·
 * 0090 532 123 45 67 · 90 532 123 45 67 (boşluk, tire, nokta ve parantez yok sayılır).
 */
export function normalizeTrMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, "");
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return TR_MOBILE_LOCAL.test(d) ? `+90${d}` : null;
}

/** Görüntüleme: "0532 123 45 67" (cep numarası değilse olduğu gibi) */
export function formatTrMobile(value: string | null | undefined): string {
  if (!value) return "";
  const e164 = normalizeTrMobile(value);
  if (!e164) return value;
  const l = e164.slice(3);
  return `0${l.slice(0, 3)} ${l.slice(3, 6)} ${l.slice(6, 8)} ${l.slice(8)}`;
}

/** Kodun gönderildiği numarayı göstermek için: yalnız son iki hane açık ("05** *** **67") */
export function maskTrMobile(value: string | null | undefined): string {
  const e164 = normalizeTrMobile(value);
  if (!e164) return "";
  return `05** *** **${e164.slice(-2)}`;
}
