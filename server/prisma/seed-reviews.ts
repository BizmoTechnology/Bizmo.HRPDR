/**
 * Seed: org şeması (yönetici hiyerarşisi) ve örnek 360° değerlendirme dönemi.
 *
 * - P002 Mehmet Demir → P001, P005, P006, P008'in yöneticisi
 * - P003 Fatma Kaya → P007'nin yöneticisi
 * - "2026 Yıl sonu 360° (örnek)" dönemi (ACTIVE):
 *   - Ahmet Yılmaz: öz + yönetici + 3 eş düzey tamamlandı → eş düzey grubu görünür
 *     (P008'in cevapları "hep aynı puan / çok hızlı" örneği)
 *   - Mehmet Demir: 4 asttan 2'si tamamladı → ast grubu eşik altında, gizli
 *   - Zeynep Arslan: öz değerlendirme yarıda, yönetici başlamadı
 *
 * Gerçek kişi ya da telefon numarası içermez. Dönem zaten varsa yeniden yazılmaz.
 */
import type { Prisma, PrismaClient, QuestionDimension } from "@prisma/client";
import { buildQuestionSetSnapshot } from "../src/services/session-questions.service.js";

const CYCLE_ID = "seed-review-cycle-2026";
const SET_ID = "seed-question-set-360";

const QUESTIONS: Array<{ id: string; text: string; dimension: QuestionDimension; type: "SCALE" | "OPEN_ENDED" }> = [
  { id: "seed-q360-01", text: "Karşılaştığı sorunları adım adım çözümler.", dimension: "LOGICAL_ALGORITHMIC", type: "SCALE" },
  { id: "seed-q360-02", text: "Kararlarını veriye ve ölçüme dayandırır.", dimension: "LOGICAL_ALGORITHMIC", type: "SCALE" },
  { id: "seed-q360-03", text: "Zor durumlarda sorumluluk alır ve ekibi yönlendirir.", dimension: "LEADERSHIP", type: "SCALE" },
  { id: "seed-q360-04", text: "Ekip arkadaşlarına net ve zamanında geri bildirim verir.", dimension: "LEADERSHIP", type: "SCALE" },
  { id: "seed-q360-05", text: "Farklı görüşleri dinler ve saygıyla karşılar.", dimension: "SOCIAL_INTELLIGENCE", type: "SCALE" },
  { id: "seed-q360-06", text: "Vardiya devrinde bilgiyi eksiksiz paylaşır.", dimension: "SOCIAL_INTELLIGENCE", type: "SCALE" },
  { id: "seed-q360-07", text: "Yeni yöntem ve teknolojileri öğrenmeye isteklidir.", dimension: "GROWTH_POTENTIAL", type: "SCALE" },
  { id: "seed-q360-08", text: "Hatalarından ders çıkarıp davranışını değiştirir.", dimension: "GROWTH_POTENTIAL", type: "SCALE" },
  { id: "seed-q360-09", text: "İş güvenliği ve kalite kurallarına özenle uyar.", dimension: "DOMAIN_ALIGNMENT", type: "SCALE" },
  { id: "seed-q360-10", text: "Tezgah ve ekipmanı iyi tanır, verimli kullanır.", dimension: "DOMAIN_ALIGNMENT", type: "SCALE" },
  { id: "seed-q360-11", text: "Bu kişinin en güçlü yönü nedir?", dimension: "GROWTH_POTENTIAL", type: "OPEN_ENDED" },
  { id: "seed-q360-12", text: "Hangi konuda gelişmesini önerirsiniz?", dimension: "GROWTH_POTENTIAL", type: "OPEN_ENDED" },
];

type Rel = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";
interface DemoRating {
  rater: string;
  relation: Rel;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  scale?: number[];
  comments?: [string | null, string | null];
  /** Başlangıçtan tamamlanmaya geçen süre (saniye) */
  durationSec?: number;
}

const PLAN: Array<{ subject: string; ratings: DemoRating[] }> = [
  {
    subject: "P001",
    ratings: [
      { rater: "P001", relation: "SELF", status: "COMPLETED", scale: [5, 5, 4, 5, 4, 4, 5, 5, 4, 4], durationSec: 540,
        comments: ["Teknik konularda hızlı çözüm üretirim.", "Ekip içi geri bildirimde daha düzenli olabilirim."] },
      { rater: "P002", relation: "MANAGER", status: "COMPLETED", scale: [4, 4, 3, 3, 4, 4, 4, 4, 4, 3], durationSec: 620,
        comments: ["Arıza anında soğukkanlı ve çözüm odaklı.", "Yeni başlayanlara geri bildirim vermeyi geliştirmeli."] },
      { rater: "P005", relation: "PEER", status: "COMPLETED", scale: [4, 3, 3, 2, 5, 5, 4, 4, 4, 4], durationSec: 480,
        comments: ["Vardiya devrinde çok titiz.", "Kararlarını ekiple daha çok paylaşabilir."] },
      { rater: "P006", relation: "PEER", status: "COMPLETED", scale: [5, 4, 3, 3, 4, 5, 5, 4, 4, 4], durationSec: 510,
        comments: ["Yeni tezgahı ilk öğrenen o oldu.", null] },
      { rater: "P008", relation: "PEER", status: "COMPLETED", scale: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], durationSec: 20 },
    ],
  },
  {
    subject: "P002",
    ratings: [
      { rater: "P002", relation: "SELF", status: "NOT_STARTED" },
      { rater: "P001", relation: "SUBORDINATE", status: "NOT_STARTED" },
      { rater: "P005", relation: "SUBORDINATE", status: "COMPLETED", scale: [4, 4, 4, 3, 4, 3, 4, 4, 5, 5], durationSec: 450,
        comments: ["Planlamayı önceden paylaşıyor.", "Toplantıları kısa tutabilir."] },
      { rater: "P006", relation: "SUBORDINATE", status: "COMPLETED", scale: [5, 4, 4, 4, 3, 3, 4, 5, 5, 4], durationSec: 400 },
      { rater: "P008", relation: "SUBORDINATE", status: "NOT_STARTED" },
    ],
  },
  {
    subject: "P007",
    ratings: [
      { rater: "P007", relation: "SELF", status: "IN_PROGRESS", scale: [4, 4, 3, 4] },
      { rater: "P003", relation: "MANAGER", status: "NOT_STARTED" },
    ],
  },
];

export async function seedReviews(params: {
  prisma: PrismaClient;
  organizationId: string;
  createdById: string;
  now: Date;
}): Promise<void> {
  const { prisma, organizationId, createdById, now } = params;

  const people = await prisma.personnel.findMany({
    where: { organizationId, employeeId: { in: ["P001", "P002", "P003", "P004", "P005", "P006", "P007", "P008"] } },
    select: { id: true, employeeId: true, managerId: true },
  });
  const byEmp = new Map(people.map((p) => [p.employeeId, p]));
  if (byEmp.size < 8) {
    console.warn(`⚠️ 360° seed: P001–P008'in hepsi yok (${byEmp.size}); atlandı`);
    return;
  }
  const id = (emp: string) => byEmp.get(emp)!.id;

  // ── Org şeması (yalnız yöneticisi boş olanlara yazılır; elle yapılan düzenleme ezilmez) ──
  const hierarchy: Record<string, string> = {
    P001: "P002",
    P005: "P002",
    P006: "P002",
    P008: "P002",
    P007: "P003",
  };
  for (const [emp, mgr] of Object.entries(hierarchy)) {
    await prisma.personnel.updateMany({
      where: { id: id(emp), managerId: null },
      data: { managerId: id(mgr) },
    });
  }
  console.log("✅ Org şeması: P002 → P001/P005/P006/P008, P003 → P007");

  // ── 360° soru seti ──
  for (const q of QUESTIONS) {
    await prisma.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        text: q.text,
        dimension: q.dimension,
        type: q.type,
        phase: q.type === "SCALE" ? "CORE" : "CLOSING",
        minScale: q.type === "SCALE" ? 1 : null,
        maxScale: q.type === "SCALE" ? 5 : null,
        tags: ["360"],
        organizationId,
      },
      update: {},
    });
  }
  const existingSet = await prisma.questionSet.findUnique({ where: { id: SET_ID } });
  if (!existingSet) {
    await prisma.questionSet.create({
      data: {
        id: SET_ID,
        name: "360° Yetkinlik Formu (örnek)",
        description: "Yönetici, eş düzey, ast ve öz değerlendirme için ortak davranış ifadeleri (1–5).",
        createdById,
        organizationId,
        items: {
          create: QUESTIONS.map((q, i) => ({
            questionId: q.id,
            order: i + 1,
            isRequired: q.type === "SCALE",
          })),
        },
      },
    });
  }
  console.log(`✅ QuestionSet: 360° Yetkinlik Formu (örnek) (${QUESTIONS.length} soru)`);

  // ── Örnek dönem ──
  if (await prisma.reviewCycle.findUnique({ where: { id: CYCLE_ID } })) {
    console.log("ℹ️  360° örnek dönem zaten var; atlandı");
    return;
  }

  const snapshot = await buildQuestionSetSnapshot(SET_ID);
  const day = 24 * 60 * 60 * 1000;
  await prisma.reviewCycle.create({
    data: {
      id: CYCLE_ID,
      name: "2026 Yıl sonu 360° (örnek)",
      description: "Örnek dönem: anonimlik eşiği, rapor ve portal akışını denemek için.",
      frequency: "ANNUAL",
      status: "ACTIVE",
      periodStart: new Date(now.getFullYear(), 0, 1),
      periodEnd: new Date(now.getFullYear(), 11, 31),
      dueAt: new Date(now.getTime() + 14 * day),
      raterWeights: { SELF: 10, MANAGER: 40, PEER: 30, SUBORDINATE: 20 },
      anonymityMinRaters: 3,
      includeSelf: true,
      questionSetId: SET_ID,
      questionSetSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      createdById,
      organizationId,
      activatedAt: new Date(now.getTime() - 7 * day),
    },
  });

  const scaleIds = QUESTIONS.filter((q) => q.type === "SCALE").map((q) => q.id);
  const commentIds = QUESTIONS.filter((q) => q.type === "OPEN_ENDED").map((q) => q.id);

  for (const s of PLAN) {
    const subject = await prisma.reviewSubject.create({
      data: { cycleId: CYCLE_ID, personnelId: id(s.subject) },
    });
    for (const [i, r] of s.ratings.entries()) {
      const completedAt = new Date(now.getTime() - (2 * day + i * 3600_000));
      const startedAt =
        r.status === "NOT_STARTED"
          ? null
          : new Date(completedAt.getTime() - (r.durationSec ?? 300) * 1000);
      const answers: Prisma.ReviewAnswerCreateWithoutAssignmentInput[] = [];
      (r.scale ?? []).forEach((v, qi) =>
        answers.push({
          questionId: scaleIds[qi]!,
          scaleValue: v,
          durationSec: Math.max(1, Math.round((r.durationSec ?? 300) / 12)),
          answeredAt: completedAt,
        }),
      );
      (r.comments ?? []).forEach((text, qi) => {
        if (text) answers.push({ questionId: commentIds[qi]!, textAnswer: text, answeredAt: completedAt });
      });
      await prisma.reviewAssignment.create({
        data: {
          subjectId: subject.id,
          raterPersonnelId: id(r.rater),
          relation: r.relation,
          status: r.status,
          startedAt,
          completedAt: r.status === "COMPLETED" ? completedAt : null,
          questionSetSnapshot:
            r.status === "NOT_STARTED" ? undefined : (snapshot as unknown as Prisma.InputJsonValue),
          answers: { create: answers },
        },
      });
    }
  }
  console.log("✅ 360° örnek dönem: Ahmet (eş düzey görünür), Mehmet (ast gizli 2/3), Zeynep (yarıda)");
}
