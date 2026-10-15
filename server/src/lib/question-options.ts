/**
 * Çoktan seçmeli seçenekleri tek biçime getirir: `{ "A": "Etiket", ... }`.
 *
 * Kabul edilen girişler:
 * - `{ A: "..." }` (kanonik)
 * - `[{ key: "A", label: "..." }]` (AI çıktısı)
 * - `["...", "..."]` (anahtarlar A, B, C… olarak atanır)
 */
export function normalizeQuestionOptions(raw: unknown): Record<string, string> | null {
  if (raw === null || raw === undefined) return null;

  const out: Record<string, string> = {};

  if (Array.isArray(raw)) {
    raw.forEach((item, i) => {
      const fallbackKey = String.fromCharCode(65 + i);
      if (typeof item === "string") {
        out[fallbackKey] = item;
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const key = typeof o["key"] === "string" && o["key"] ? o["key"] : fallbackKey;
        const label = o["label"] ?? o["text"] ?? o["value"];
        if (typeof label === "string" && label.trim()) out[key] = label;
      }
    });
  } else if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}
