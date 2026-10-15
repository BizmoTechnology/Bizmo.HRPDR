import { z } from "zod";

/**
 * Sorunun deterministik puanlama kuralı (`Question.scoring`).
 *
 * - SCALE: `{ "reverse": true }` → ters puanlanan Likert maddesi
 *   (ör. "İşlerimi son ana bırakırım": katılım arttıkça puan düşer).
 * - MULTIPLE_CHOICE: `{ "key": { "A": 3, "B": 0, "C": 1, "D": 2 } }` → seçenek
 *   puanları (durumsal yargı testi veya tek doğru cevaplı bilgi sorusu). Seçilen
 *   seçeneğin puanı anahtardaki en düşük–en yüksek aralığından 0–10'a çevrilir.
 *
 * Kural personele hiçbir zaman gönderilmez (bkz. `toPortalQuestion`). Kuralı
 * olmayan sorular eskisi gibi puanlanır: SCALE doğrusal, çoktan seçmeli puansız.
 */
const scoringShape = {
  reverse: z.boolean().optional(),
  key: z.record(z.string().min(1).max(50), z.number().finite().min(0).max(100)).optional(),
};

/** API girdisi: bilinmeyen alan kabul edilmez. */
export const questionScoringInputSchema = z.object(scoringShape).strict();

const storedScoringSchema = z.object(scoringShape);

export interface QuestionScoring {
  reverse?: true;
  key?: Record<string, number>;
}

/** Json alanını okur; geçersiz veya etkisiz kural `null` döner (soru eski usulle puanlanır). */
export function parseQuestionScoring(raw: unknown): QuestionScoring | null {
  if (raw === null || raw === undefined) return null;
  const parsed = storedScoringSchema.safeParse(raw);
  if (!parsed.success) return null;

  const out: QuestionScoring = {};
  if (parsed.data.reverse) out.reverse = true;
  const key = parsed.data.key;
  if (key && new Set(Object.values(key)).size >= 2) out.key = key;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Kuralın soru tipi ve seçeneklerle uyumunu denetler; sorun yoksa `null`,
 * varsa kullanıcıya gösterilecek açıklama döner.
 */
export function questionScoringIssue(
  type: string,
  scoring: z.infer<typeof questionScoringInputSchema> | null | undefined,
  options: Record<string, string> | null,
): string | null {
  if (!scoring) return null;

  if (scoring.reverse && type !== "SCALE") {
    return "Ters puanlama yalnızca skala sorularında kullanılabilir";
  }

  if (scoring.key) {
    if (type !== "MULTIPLE_CHOICE") {
      return "Puan anahtarı yalnızca çoktan seçmeli sorularda kullanılabilir";
    }
    const keys = Object.keys(scoring.key);
    if (new Set(Object.values(scoring.key)).size < 2) {
      return "Puan anahtarında en az iki farklı puan olmalı";
    }
    if (!options) return "Puan anahtarı için seçenekler tanımlanmalı";
    const missing = Object.keys(options).filter((k) => !keys.includes(k));
    const unknown = keys.filter((k) => !Object.hasOwn(options, k));
    if (missing.length > 0) return `Puan anahtarında eksik seçenek: ${missing.join(", ")}`;
    if (unknown.length > 0) return `Puan anahtarında tanımsız seçenek: ${unknown.join(", ")}`;
  }

  return null;
}

/** Seçilen seçeneğin anahtar puanı (0–10); anahtar yoksa veya seçenek anahtarda değilse `null`. */
export function keyedChoiceScore(scoring: QuestionScoring | null, choiceKey: string | null | undefined): number | null {
  const key = scoring?.key;
  if (!key || !choiceKey || !Object.hasOwn(key, choiceKey)) return null;
  const values = Object.values(key);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi <= lo) return null;
  return ((key[choiceKey]! - lo) / (hi - lo)) * 10;
}
