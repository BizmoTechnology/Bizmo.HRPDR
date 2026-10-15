/**
 * Skor sözleşmesi (development.md §4.1) — tek kaynak.
 *
 * - Tüm boyut skorları 0.0–10.0 aralığında, bir ondalık hassasiyetle saklanır.
 * - SCALE cevapları minScale/maxScale aralığından 0–10 bandına normalize edilir.
 * - effectiveQuestionWeight = Question.weight × (QuestionSetItem.customWeight ?? 1)
 *   (boyut ağırlığı yalnızca bileşik/genel skorda uygulanır).
 */

export const DIMENSIONS = [
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type DimensionScores = Partial<Record<Dimension, number>>;

export interface ScorableQuestion {
  id: string;
  dimension: string;
  type: string;
  weight?: number | null;
  customWeight?: number | null;
  minScale?: number | null;
  maxScale?: number | null;
}

export interface ScorableAnswer {
  questionId: string;
  scaleValue: number | null;
}

export function roundScore(value: number): number {
  const clamped = Math.min(10, Math.max(0, value));
  return Math.round(clamped * 10) / 10;
}

function isDimension(v: string): v is Dimension {
  return (DIMENSIONS as readonly string[]).includes(v);
}

/** SCALE cevaplarından deterministik boyut skorları (AI gerektirmez). */
export function computeScaleScores(
  questions: ScorableQuestion[],
  answers: ScorableAnswer[],
): DimensionScores {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const acc = new Map<Dimension, { sum: number; weight: number }>();

  for (const q of questions) {
    if (q.type !== "SCALE" || !isDimension(q.dimension)) continue;
    const value = byQuestion.get(q.id)?.scaleValue;
    if (value === null || value === undefined) continue;

    const min = q.minScale ?? 1;
    const max = q.maxScale ?? 10;
    if (max <= min) continue;

    const normalized = ((value - min) / (max - min)) * 10;
    const weight = (q.weight ?? 1) * (q.customWeight ?? 1);
    if (weight <= 0) continue;

    const cur = acc.get(q.dimension) ?? { sum: 0, weight: 0 };
    cur.sum += normalized * weight;
    cur.weight += weight;
    acc.set(q.dimension, cur);
  }

  const out: DimensionScores = {};
  for (const [dim, { sum, weight }] of acc) {
    out[dim] = roundScore(sum / weight);
  }
  return out;
}

function normalizeText(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

const DIMENSION_ALIASES: Record<string, Dimension> = {
  logicalalgorithmic: "LOGICAL_ALGORITHMIC",
  mantiksalalgoritmik: "LOGICAL_ALGORITHMIC",
  mantiksal: "LOGICAL_ALGORITHMIC",
  leadership: "LEADERSHIP",
  liderlik: "LEADERSHIP",
  socialintelligence: "SOCIAL_INTELLIGENCE",
  sosyalzeka: "SOCIAL_INTELLIGENCE",
  growthpotential: "GROWTH_POTENTIAL",
  gelisimpotansiyeli: "GROWTH_POTENTIAL",
  buyumepotansiyeli: "GROWTH_POTENTIAL",
  domainalignment: "DOMAIN_ALIGNMENT",
  alanuyumu: "DOMAIN_ALIGNMENT",
};

/** AI çıktısındaki boyut adını (enum veya Türkçe etiket) enum değerine çevirir. */
export function normalizeDimensionKey(raw: unknown): Dimension | null {
  if (typeof raw !== "string") return null;
  if (isDimension(raw)) return raw;
  return DIMENSION_ALIASES[normalizeText(raw)] ?? null;
}

/**
 * HR PDR analizindeki `competencyAnalysis[].score` değerlerinden boyut skorları.
 * Skorlar 0–10 bandında beklenir; 10'dan büyükse 0–100 kabul edilip ölçeklenir.
 */
export function scoresFromHrPdrAnalysis(analysis: unknown): DimensionScores {
  const out: DimensionScores = {};
  if (!analysis || typeof analysis !== "object") return out;
  const list = (analysis as { competencyAnalysis?: unknown }).competencyAnalysis;
  if (!Array.isArray(list)) return out;

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const dim = normalizeDimensionKey((item as { dimension?: unknown }).dimension);
    const rawScore = Number((item as { score?: unknown }).score);
    if (!dim || !Number.isFinite(rawScore)) continue;
    out[dim] = roundScore(rawScore > 10 ? rawScore / 10 : rawScore);
  }
  return out;
}

/** AI skorunu tercih eder; AI'ın değerlendirmediği boyutlar için skala skorunu korur. */
export function mergeDimensionScores(
  base: DimensionScores | null | undefined,
  preferred: DimensionScores,
): DimensionScores {
  const out: DimensionScores = {};
  for (const dim of DIMENSIONS) {
    const v = preferred[dim] ?? base?.[dim];
    if (typeof v === "number" && Number.isFinite(v)) out[dim] = roundScore(v);
  }
  return out;
}

export interface DimensionWeights {
  weightLogical: number;
  weightLeadership: number;
  weightSocial: number;
  weightGrowth: number;
  weightDomain: number;
}

export function dimensionWeightMap(w: DimensionWeights): Record<Dimension, number> {
  return {
    LOGICAL_ALGORITHMIC: w.weightLogical,
    LEADERSHIP: w.weightLeadership,
    SOCIAL_INTELLIGENCE: w.weightSocial,
    GROWTH_POTENTIAL: w.weightGrowth,
    DOMAIN_ALIGNMENT: w.weightDomain,
  };
}

/** Soru seti boyut ağırlıklarıyla bileşik (genel) skor. */
export function computeOverallScore(
  scores: DimensionScores | null | undefined,
  weights?: Partial<Record<Dimension, number>> | null,
): number | null {
  if (!scores) return null;
  let sum = 0;
  let total = 0;
  for (const dim of DIMENSIONS) {
    const v = scores[dim];
    if (typeof v !== "number") continue;
    const w = weights?.[dim] ?? 1;
    if (w <= 0) continue;
    sum += v * w;
    total += w;
  }
  return total > 0 ? roundScore(sum / total) : null;
}

/** Json alanından sayısal boyut skorlarını okur. */
export function readDimensionScores(value: unknown): DimensionScores | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: DimensionScores = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isDimension(k) && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}
