import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizeQuestionOptions } from "../lib/question-options.js";
import { dimensionWeightMap, type Dimension } from "./scoring.service.js";

export interface SnapshotQuestion {
  id: string;
  text: string;
  subText: string | null;
  dimension: string;
  type: string;
  phase: string;
  weight: number;
  customWeight: number | null;
  options: Record<string, string> | null;
  minScale: number | null;
  maxScale: number | null;
  order: number;
  isRequired: boolean;
}

/**
 * Oturum başladığında soru setinin dondurulmuş hali. Soru seti daha sonra
 * düzenlense bile personel aynı soruları görür ve skorlar aynı ağırlıklarla
 * hesaplanır.
 */
export interface QuestionSetSnapshot {
  questionSetId: string;
  version: number;
  weights: Record<Dimension, number>;
  questions: SnapshotQuestion[];
}

export async function buildQuestionSetSnapshot(
  questionSetId: string,
): Promise<QuestionSetSnapshot> {
  const set = await prisma.questionSet.findUniqueOrThrow({
    where: { id: questionSetId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { question: true },
      },
    },
  });

  return {
    questionSetId: set.id,
    version: set.version,
    weights: dimensionWeightMap(set),
    questions: set.items
      .filter((item) => !item.question.deletedAt)
      .map((item) => ({
        id: item.question.id,
        text: item.question.text,
        subText: item.question.subText,
        dimension: item.question.dimension,
        type: item.question.type,
        phase: item.question.phase,
        weight: item.question.weight,
        customWeight: item.customWeight,
        options: normalizeQuestionOptions(item.question.options),
        minScale: item.question.minScale,
        maxScale: item.question.maxScale,
        order: item.order,
        isRequired: item.isRequired,
      })),
  };
}

/** Eski kayıtlarda snapshot doğrudan soru dizisi olarak saklanmış olabilir. */
export function parseSnapshot(value: Prisma.JsonValue | null | undefined): QuestionSetSnapshot | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return {
      questionSetId: "",
      version: 0,
      weights: dimensionWeightMap({
        weightLogical: 20,
        weightLeadership: 20,
        weightSocial: 20,
        weightGrowth: 20,
        weightDomain: 20,
      }),
      questions: value as unknown as SnapshotQuestion[],
    };
  }
  if (typeof value === "object" && Array.isArray((value as { questions?: unknown }).questions)) {
    return value as unknown as QuestionSetSnapshot;
  }
  return null;
}

/** Oturumun snapshot'ı varsa onu, yoksa soru setinin güncel halini döndürür. */
export async function getSessionSnapshot(session: {
  questionSetSnapshot: Prisma.JsonValue | null;
  assessment: { questionSetId: string };
}): Promise<QuestionSetSnapshot> {
  return (
    parseSnapshot(session.questionSetSnapshot) ??
    (await buildQuestionSetSnapshot(session.assessment.questionSetId))
  );
}

/** Personele gösterilecek alanlar (ağırlık ve boyut gibi iç bilgiler hariç). */
export function toPortalQuestion(q: SnapshotQuestion) {
  return {
    id: q.id,
    text: q.text,
    subText: q.subText,
    type: q.type,
    phase: q.phase,
    options: q.options,
    minScale: q.minScale,
    maxScale: q.maxScale,
    order: q.order,
    isRequired: q.isRequired,
  };
}
