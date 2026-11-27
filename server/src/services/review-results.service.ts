/**
 * 360° sonuç hesabı: anonimleştirilmiş, ağırlıklı değerlendirme sonucu.
 *
 * Anonimlik kuralları (sunucuda uygulanır; istemciye güvenilmez):
 * - SELF (öz değerlendirme) ve MANAGER (yönetici) grupları her zaman gösterilir;
 *   yönetici puanı yöneticinin adıyla döner.
 * - PEER (eş düzey) ve SUBORDINATE (ast) grupları yalnızca grupta en az
 *   `cycle.anonymityMinRaters` TAMAMLANMIŞ değerlendirici varsa ve yalnızca grup
 *   ortalaması olarak döner. Eşiğin altındaki grubun hiçbir puanı, yorumu ya da
 *   bu puanlardan türetilebilecek bir değer (ör. "diğerleri" ortalaması) yanıtta
 *   yer almaz: gizli grup tüm birleşik hesaplardan da çıkarılır.
 * - Değerlendirici başına ham puan hiçbir zaman dönmez (tek yöneticili MANAGER
 *   grubu ve SELF zaten isimli/kişinin kendisidir).
 *
 * Kullanım (diğer modüller):
 * ```ts
 * import { getSubjectResults } from "../services/review-results.service.js";
 * const results = await getSubjectResults(subjectId, {
 *   viewer: { kind: "admin", organizationId: orgId, role: request.user.role },
 * });
 * // Personel portalı: yalnız yayınlanmış (released) ve kendi sonucu;
 * // paylaşım ayarı (shareWithEmployee) kontrolü ÇAĞIRANIN sorumluluğundadır.
 * const mine = await getSubjectResults(subjectId, {
 *   viewer: { kind: "employee", organizationId: orgId, personnelId: request.user.sub },
 * });
 * ```
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseQuestionScoring } from "../lib/question-scoring.js";
import { HttpError } from "../lib/http-error.js";
import {
  DIMENSIONS,
  computeOverallScore,
  computeScaleScores,
  roundScore,
  scoreAnswer,
  type Dimension,
  type DimensionScores,
} from "./scoring.service.js";
import {
  buildQuestionSetSnapshot,
  parseSnapshot,
  type QuestionSetSnapshot,
  type SnapshotQuestion,
} from "./session-questions.service.js";

// ─── Sabitler ve tipler ─────────────────────────────

export const REVIEW_RELATIONS = ["SELF", "MANAGER", "PEER", "SUBORDINATE"] as const;
export type ReviewRelationKey = (typeof REVIEW_RELATIONS)[number];

/** Anonimlik eşiğine tabi gruplar */
export const ANONYMOUS_RELATIONS: readonly ReviewRelationKey[] = ["PEER", "SUBORDINATE"];

export type RaterWeights = Record<ReviewRelationKey, number>;

export const DEFAULT_RATER_WEIGHTS: RaterWeights = {
  SELF: 10,
  MANAGER: 40,
  PEER: 30,
  SUBORDINATE: 20,
};

export const RELATION_LABELS: Record<ReviewRelationKey, string> = {
  SELF: "Öz değerlendirme",
  MANAGER: "Yönetici",
  PEER: "Eş düzey",
  SUBORDINATE: "Ast",
};

/** Öz puan ile diğerleri arasındaki anlamlı fark (0–10 ölçeğinde) */
export const GAP_THRESHOLD = 1.5;
/** "Güçlü yan" sayılması için diğerlerinin ortalaması */
export const STRENGTH_THRESHOLD = 7;
/** Soru başına ortalama bu sürenin altı "çok hızlı" sayılır (saniye) */
export const FAST_SECONDS_PER_QUESTION = 3;
/** Düz çizgi (hep aynı puan) işareti için en az ölçek cevabı */
export const STRAIGHT_LINE_MIN_ANSWERS = 5;

export type ResultsViewer =
  | { kind: "admin"; organizationId: string; role: string | undefined }
  | { kind: "employee"; organizationId: string; personnelId: string };

/** Panelde 360° bireysel puanları görebilen roller (ROLE_GROUPS.analyze ile aynı) */
const ANALYZE_ROLES = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "ANALYST"];

export interface GroupResult {
  relation: ReviewRelationKey;
  label: string;
  weight: number;
  assigned: number;
  completed: number;
  /** false ise `scores`, `overall` null ve grubun hiçbir verisi yanıtta yok */
  visible: boolean;
  hiddenReason: "INSUFFICIENT_RATERS" | "NO_RATERS" | null;
  /** Yalnız MANAGER için: yönetici(ler)in adı */
  raterNames: string[] | null;
  scores: DimensionScores | null;
  overall: number | null;
}

export interface DimensionResult {
  dimension: Dimension;
  self: number | null;
  /** Görünür, öz olmayan grupların ağırlıklı ortalaması */
  others: number | null;
  /** Öz dahil görünür tüm grupların ağırlıklı ortalaması */
  weighted: number | null;
  /** self − others (pozitif: kendini diğerlerinden yüksek görüyor) */
  gap: number | null;
  byGroup: Partial<Record<ReviewRelationKey, number>>;
}

export interface ItemResult {
  questionId: string;
  text: string;
  dimension: string;
  self: number | null;
  others: number | null;
  gap: number | null;
  byGroup: Partial<Record<ReviewRelationKey, number>>;
  /** Ters puanlanan madde: puan çevrilmiştir; metin olumsuz ifadedir */
  reverse: boolean;
}

export interface CommentResult {
  id: string;
  relation: ReviewRelationKey;
  questionText: string;
  text: string;
  /** Yalnız MANAGER yorumlarında dolu */
  authorName: string | null;
}

export type RaterFlagReason = "TOO_FAST" | "STRAIGHT_LINE";

export interface RaterFlag {
  assignmentId: string;
  raterName: string;
  relation: ReviewRelationKey;
  reasons: RaterFlagReason[];
  durationSec: number | null;
  answeredScaleCount: number;
}

export interface SubjectResults {
  subject: {
    id: string;
    personnelId: string;
    name: string;
    position: string;
    department: string | null;
    status: "OPEN" | "CLOSED" | "RELEASED";
    releasedAt: string | null;
  };
  cycle: {
    id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "CLOSED";
    periodStart: string | null;
    periodEnd: string | null;
    dueAt: string | null;
  };
  anonymityMinRaters: number;
  weights: RaterWeights;
  groups: GroupResult[];
  dimensions: DimensionResult[];
  overall: { self: number | null; others: number | null; weighted: number | null };
  items: ItemResult[];
  /** Diğerlerinin en yüksek puan verdiği maddeler (≥ STRENGTH_THRESHOLD) */
  strengths: ItemResult[];
  /** Diğerlerinin en düşük puan verdiği maddeler */
  developmentAreas: ItemResult[];
  /** Kör nokta: öz puan diğerlerinden en az GAP_THRESHOLD yüksek */
  blindSpots: ItemResult[];
  /** Gizli güçlü yan: diğerleri öz puandan en az GAP_THRESHOLD yüksek */
  hiddenStrengths: ItemResult[];
  /** Karıştırılmış (tamamlanma sırasını yansıtmaz) yorumlar */
  comments: CommentResult[];
  /** Özensiz değerlendirici işaretleri; yalnız panel (admin) görünümünde dolu */
  raterFlags: RaterFlag[] | null;
  completedRaters: number;
  totalRaters: number;
  computedAt: string;
}

/** Dönem kapanınca ReviewSubject.resultJson'a yazılan anonim özet */
export interface SubjectResultSummary {
  version: 1;
  computedAt: string;
  anonymityMinRaters: number;
  overall: SubjectResults["overall"];
  dimensions: Partial<
    Record<Dimension, { self: number | null; others: number | null; weighted: number | null }>
  >;
  groups: Array<Pick<GroupResult, "relation" | "completed" | "visible" | "overall">>;
}

// ─── Yardımcılar ───────────────────────────────────

/** Json alanından grup ağırlıklarını okur; eksik/negatif değerler varsayılanla tamamlanır */
export function readRaterWeights(value: Prisma.JsonValue | null | undefined): RaterWeights {
  const out: RaterWeights = { ...DEFAULT_RATER_WEIGHTS };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of REVIEW_RELATIONS) {
      const v = (value as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[r] = v;
    }
  }
  return out;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(v: number | null): number | null {
  return v === null ? null : roundScore(v);
}

/** Ağırlıklı ortalama; değeri olmayan gruplar ağırlıkla birlikte düşer */
function weightedMean(
  entries: Array<{ value: number | null | undefined; weight: number }>,
): number | null {
  let sum = 0;
  let total = 0;
  for (const e of entries) {
    if (typeof e.value !== "number" || e.weight <= 0) continue;
    sum += e.value * e.weight;
    total += e.weight;
  }
  return total > 0 ? sum / total : null;
}

/**
 * SCALE cevabını 0–10 bandına çevirir. Boyut puanlarıyla (computeScaleScores) aynı
 * kuralı kullanır; ters puanlanan maddelerde (`scoring.reverse`) ölçek ters çevrilir.
 */
function normalizeScale(q: SnapshotQuestion, value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return scoreAnswer(q, { questionId: q.id, scaleValue: value });
}

/** Deterministik karıştırma: sıra tamamlanma zamanını ele vermez, her çağrıda aynıdır */
function stableShuffle<T extends { id: string }>(items: T[], salt: string): T[] {
  const key = (id: string) => createHash("sha256").update(`${salt}:${id}`).digest("hex");
  return [...items].sort((a, b) => (key(a.id) < key(b.id) ? -1 : 1));
}

const COMMENT_TYPES = new Set(["OPEN_ENDED", "BEHAVIORAL", "SITUATIONAL"]);

async function resolveSnapshot(cycle: {
  questionSetSnapshot: Prisma.JsonValue | null;
  questionSetId: string;
}): Promise<QuestionSetSnapshot> {
  return (
    parseSnapshot(cycle.questionSetSnapshot) ?? (await buildQuestionSetSnapshot(cycle.questionSetId))
  );
}

// ─── Ana fonksiyon ─────────────────────────────────

/**
 * Bir değerlendirilenin (ReviewSubject) anonimleştirilmiş, ağırlıklı 360° sonucu.
 *
 * @param subjectId ReviewSubject.id
 * @param opts.viewer
 *   - `{ kind: "admin", organizationId, role }`: panel kullanıcısı. Rol
 *     ROLE_GROUPS.analyze dışındaysa 403. `raterFlags` dolu döner.
 *   - `{ kind: "employee", organizationId, personnelId }`: değerlendirilen kişinin
 *     kendisi. Sonuç yayınlanmamışsa (status !== RELEASED) ya da kişi başkasıysa
 *     404. `raterFlags` null döner. Paylaşım ayarı kontrolü çağıranındır.
 * @throws HttpError 404 (bulunamadı / başka kurum / yayınlanmamış), 403 (rol)
 */
export async function getSubjectResults(
  subjectId: string,
  opts: { viewer: ResultsViewer },
): Promise<SubjectResults> {
  const { viewer } = opts;

  if (viewer.kind === "admin" && !ANALYZE_ROLES.includes(viewer.role ?? "")) {
    throw new HttpError("Bu işlem için yetkiniz yok", 403, "FORBIDDEN");
  }

  const subject = await prisma.reviewSubject.findFirst({
    where: { id: subjectId, cycle: { organizationId: viewer.organizationId } },
    include: {
      cycle: true,
      personnel: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          department: { select: { name: true } },
        },
      },
      assignments: {
        include: {
          rater: { select: { firstName: true, lastName: true } },
          answers: true,
        },
      },
    },
  });

  if (!subject) throw new HttpError("Değerlendirme sonucu bulunamadı", 404, "NOT_FOUND");
  if (
    viewer.kind === "employee" &&
    (subject.personnelId !== viewer.personnelId || subject.status !== "RELEASED")
  ) {
    throw new HttpError("Değerlendirme sonucu bulunamadı", 404, "NOT_FOUND");
  }

  const cycle = subject.cycle;
  const snapshot = await resolveSnapshot(cycle);
  const weights = readRaterWeights(cycle.raterWeights);
  const minRaters = Math.max(1, cycle.anonymityMinRaters);
  const scaleQuestions = snapshot.questions.filter((q) => q.type === "SCALE");
  const questionById = new Map(snapshot.questions.map((q) => [q.id, q]));

  const active = subject.assignments.filter((a) => a.status !== "DECLINED");
  const completed = active.filter((a) => a.status === "COMPLETED");

  // ── Grup görünürlüğü ──
  const byRelation = new Map<ReviewRelationKey, typeof completed>();
  for (const r of REVIEW_RELATIONS) byRelation.set(r, []);
  for (const a of completed) byRelation.get(a.relation as ReviewRelationKey)!.push(a);

  const visibleRelations = new Set<ReviewRelationKey>();
  const groupMeta = REVIEW_RELATIONS.map((relation) => {
    const done = byRelation.get(relation)!;
    const assigned = active.filter((a) => a.relation === relation).length;
    let hiddenReason: GroupResult["hiddenReason"] = null;
    if (done.length === 0) hiddenReason = "NO_RATERS";
    else if (ANONYMOUS_RELATIONS.includes(relation) && done.length < minRaters) {
      hiddenReason = "INSUFFICIENT_RATERS";
    }
    if (!hiddenReason) visibleRelations.add(relation);
    return { relation, assigned, done, hiddenReason };
  });

  // ── Değerlendirici başına skorlar (yalnız görünür gruplar; dışarı çıkmaz) ──
  const raterScores = new Map<string, DimensionScores>();
  const raterItems = new Map<string, Map<string, number>>();
  for (const a of completed) {
    if (!visibleRelations.has(a.relation as ReviewRelationKey)) continue;
    raterScores.set(a.id, computeScaleScores(scaleQuestions, a.answers));
    const items = new Map<string, number>();
    for (const ans of a.answers) {
      const q = questionById.get(ans.questionId);
      if (!q || q.type !== "SCALE") continue;
      const v = normalizeScale(q, ans.scaleValue);
      if (v !== null) items.set(q.id, v);
    }
    raterItems.set(a.id, items);
  }

  const groupDim = (relation: ReviewRelationKey, dim: Dimension): number | null => {
    if (!visibleRelations.has(relation)) return null;
    const values = byRelation
      .get(relation)!
      .map((a) => raterScores.get(a.id)?.[dim])
      .filter((v): v is number => typeof v === "number");
    return mean(values);
  };
  const groupItem = (relation: ReviewRelationKey, questionId: string): number | null => {
    if (!visibleRelations.has(relation)) return null;
    const values = byRelation
      .get(relation)!
      .map((a) => raterItems.get(a.id)?.get(questionId))
      .filter((v): v is number => typeof v === "number");
    return mean(values);
  };

  const otherRelations = REVIEW_RELATIONS.filter((r) => r !== "SELF");

  // ── Boyutlar ──
  const dimensions: DimensionResult[] = [];
  for (const dim of DIMENSIONS) {
    const byGroupRaw = Object.fromEntries(
      REVIEW_RELATIONS.map((r) => [r, groupDim(r, dim)]),
    ) as Record<ReviewRelationKey, number | null>;
    if (REVIEW_RELATIONS.every((r) => byGroupRaw[r] === null)) continue;

    const self = byGroupRaw.SELF;
    const others = weightedMean(otherRelations.map((r) => ({ value: byGroupRaw[r], weight: weights[r] })));
    const weighted = weightedMean(
      REVIEW_RELATIONS.map((r) => ({ value: byGroupRaw[r], weight: weights[r] })),
    );
    const byGroup: DimensionResult["byGroup"] = {};
    for (const r of REVIEW_RELATIONS) {
      const v = byGroupRaw[r];
      if (v !== null) byGroup[r] = roundScore(v);
    }
    dimensions.push({
      dimension: dim,
      self: round1(self),
      others: round1(others),
      weighted: round1(weighted),
      gap: self !== null && others !== null ? Math.round((self - others) * 10) / 10 : null,
      byGroup,
    });
  }

  // ── Maddeler (yetkinlik detayı) ──
  const items: ItemResult[] = [];
  for (const q of scaleQuestions) {
    const byGroupRaw = Object.fromEntries(
      REVIEW_RELATIONS.map((r) => [r, groupItem(r, q.id)]),
    ) as Record<ReviewRelationKey, number | null>;
    if (REVIEW_RELATIONS.every((r) => byGroupRaw[r] === null)) continue;
    const self = byGroupRaw.SELF;
    const others = weightedMean(otherRelations.map((r) => ({ value: byGroupRaw[r], weight: weights[r] })));
    const byGroup: ItemResult["byGroup"] = {};
    for (const r of REVIEW_RELATIONS) {
      const v = byGroupRaw[r];
      if (v !== null) byGroup[r] = roundScore(v);
    }
    items.push({
      questionId: q.id,
      text: q.text,
      dimension: q.dimension,
      self: round1(self),
      others: round1(others),
      gap: self !== null && others !== null ? Math.round((self - others) * 10) / 10 : null,
      byGroup,
      reverse: parseQuestionScoring(q.scoring)?.reverse === true,
    });
  }

  // Öne çıkan listeler (güçlü yan, gelişim alanı, kör nokta) yalnız düz ifadelerden
  // seçilir: ters maddenin metni olumsuzdur ("Kolayca strese girerim"), yüksek
  // puanla "güçlü yan" diye gösterilmesi okuyanı yanıltır. Detay tablosunda kalır.
  const highlightable = items.filter((i) => !i.reverse);
  const withOthers = highlightable.filter((i) => i.others !== null);
  const strengths = [...withOthers]
    .filter((i) => i.others! >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.others! - a.others!)
    .slice(0, 3);
  const strengthIds = new Set(strengths.map((s) => s.questionId));
  const developmentAreas = [...withOthers]
    .filter((i) => !strengthIds.has(i.questionId))
    .sort((a, b) => a.others! - b.others!)
    .slice(0, 3);
  const blindSpots = highlightable
    .filter((i) => i.gap !== null && i.gap >= GAP_THRESHOLD)
    .sort((a, b) => b.gap! - a.gap!);
  const hiddenStrengths = highlightable
    .filter((i) => i.gap !== null && i.gap <= -GAP_THRESHOLD)
    .sort((a, b) => a.gap! - b.gap!);

  // ── Gruplar ──
  const groups: GroupResult[] = groupMeta.map(({ relation, assigned, done, hiddenReason }) => {
    const visible = hiddenReason === null;
    let scores: DimensionScores | null = null;
    if (visible) {
      scores = {};
      for (const dim of DIMENSIONS) {
        const v = groupDim(relation, dim);
        if (v !== null) scores[dim] = roundScore(v);
      }
    }
    return {
      relation,
      label: RELATION_LABELS[relation],
      weight: weights[relation],
      assigned,
      completed: done.length,
      visible,
      hiddenReason,
      raterNames:
        relation === "MANAGER" && visible
          ? done.map((a) => `${a.rater.firstName} ${a.rater.lastName}`)
          : null,
      scores,
      overall: scores ? computeOverallScore(scores, snapshot.weights) : null,
    };
  });

  // ── Genel skorlar ──
  const dimScores = (key: "self" | "others" | "weighted"): DimensionScores => {
    const out: DimensionScores = {};
    for (const d of dimensions) {
      const v = d[key];
      if (v !== null) out[d.dimension] = v;
    }
    return out;
  };
  const overall = {
    self: computeOverallScore(dimScores("self"), snapshot.weights),
    others: computeOverallScore(dimScores("others"), snapshot.weights),
    weighted: computeOverallScore(dimScores("weighted"), snapshot.weights),
  };

  // ── Yorumlar (yalnız görünür gruplar) ──
  const rawComments: CommentResult[] = [];
  for (const a of completed) {
    const relation = a.relation as ReviewRelationKey;
    if (!visibleRelations.has(relation)) continue;
    for (const ans of a.answers) {
      const q = questionById.get(ans.questionId);
      const text = ans.textAnswer?.trim();
      if (!q || !text || !COMMENT_TYPES.has(q.type)) continue;
      rawComments.push({
        id: ans.id,
        relation,
        questionText: q.text,
        text,
        authorName: relation === "MANAGER" ? `${a.rater.firstName} ${a.rater.lastName}` : null,
      });
    }
  }
  const comments = stableShuffle(rawComments, subject.id);

  // ── Özensiz değerlendirici işaretleri (yalnız panel) ──
  let raterFlags: RaterFlag[] | null = null;
  if (viewer.kind === "admin") {
    raterFlags = [];
    for (const a of completed) {
      const scale = a.answers.filter(
        (ans) => questionById.get(ans.questionId)?.type === "SCALE" && ans.scaleValue !== null,
      );
      const reasons: RaterFlagReason[] = [];
      const durationSec =
        a.startedAt && a.completedAt
          ? Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 1000)
          : null;
      const answeredCount = a.answers.length;
      if (
        durationSec !== null &&
        answeredCount > 0 &&
        durationSec / answeredCount < FAST_SECONDS_PER_QUESTION
      ) {
        reasons.push("TOO_FAST");
      }
      if (
        scale.length >= STRAIGHT_LINE_MIN_ANSWERS &&
        new Set(scale.map((s) => s.scaleValue)).size === 1
      ) {
        reasons.push("STRAIGHT_LINE");
      }
      if (reasons.length > 0) {
        raterFlags.push({
          assignmentId: a.id,
          raterName: `${a.rater.firstName} ${a.rater.lastName}`,
          relation: a.relation as ReviewRelationKey,
          reasons,
          durationSec,
          answeredScaleCount: scale.length,
        });
      }
    }
  }

  return {
    subject: {
      id: subject.id,
      personnelId: subject.personnel.id,
      name: `${subject.personnel.firstName} ${subject.personnel.lastName}`,
      position: subject.personnel.position,
      department: subject.personnel.department?.name ?? null,
      status: subject.status,
      releasedAt: subject.releasedAt?.toISOString() ?? null,
    },
    cycle: {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      periodStart: cycle.periodStart?.toISOString() ?? null,
      periodEnd: cycle.periodEnd?.toISOString() ?? null,
      dueAt: cycle.dueAt?.toISOString() ?? null,
    },
    anonymityMinRaters: minRaters,
    weights,
    groups,
    dimensions,
    overall,
    items,
    strengths,
    developmentAreas,
    blindSpots,
    hiddenStrengths,
    comments,
    raterFlags,
    completedRaters: completed.length,
    totalRaters: active.length,
    computedAt: new Date().toISOString(),
  };
}

/** Tam sonuçtan, resultJson'a yazılacak anonim özet (ham puan ve yorum içermez) */
export function toResultSummary(r: SubjectResults): SubjectResultSummary {
  const dimensions: SubjectResultSummary["dimensions"] = {};
  for (const d of r.dimensions) {
    dimensions[d.dimension] = { self: d.self, others: d.others, weighted: d.weighted };
  }
  return {
    version: 1,
    computedAt: r.computedAt,
    anonymityMinRaters: r.anonymityMinRaters,
    overall: r.overall,
    dimensions,
    groups: r.groups.map((g) => ({
      relation: g.relation,
      completed: g.completed,
      visible: g.visible,
      overall: g.overall,
    })),
  };
}
