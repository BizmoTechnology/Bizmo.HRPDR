import type { Prisma, PrismaClient } from "@prisma/client";
import { ANALYSIS_AWAITS_REVIEW_REASON } from "../src/lib/ai-connection.js";
import { computeScaleScores } from "../src/services/scoring.service.js";
import { RESPONDENTS } from "./seed-respondents.js";

/**
 * Personel geçmişi demosu (Aşama 2):
 * - Önceki dönem değerlendirmesi ("2026 Yaz"): P006–P008 ve P004 için tamamlanmış oturum.
 *   Ölçek cevapları güncel cevapların 1–2 puan altında; geçmiş/analiz sekmesinde trend görünür.
 *   AI analizi ve İK onayı seed edilmez (sahte AI çıktısı yok); skorlar ölçek cevaplarından hesaplanır.
 * - P004 · Ali Çelik işten ayrılmış olarak işaretlenir (Ayrılanlar görünümü, salt okunur detay,
 *   portal kapalı). Tekrar çalıştırıldığında var olan kayıtlar ezilmez.
 */

const PAST_ASSESSMENT_ID = "seed-assessment-history-prev";
const PAST_TITLE = "2026 Yaz Potansiyel Haritası";
const PAST_DESCRIPTION = "Önceki dönem değerlendirmesi: personel geçmişi ve trend demosu.";
const DAY_MS = 86_400_000;

/** Önceki dönem cevabı: ölçek değeri kişiye göre 1–2 puan düşük (alt sınırda kalır) */
function pastScale(value: number, min: number, offset: number) {
  return Math.max(min, value - offset);
}

export async function seedHistory(params: {
  prisma: PrismaClient;
  organizationId: string;
  questionSetId: string;
  createdById: string;
  now: Date;
}) {
  const { prisma, organizationId, questionSetId, createdById, now } = params;

  const periodEnd = new Date(now.getTime() - 120 * DAY_MS);
  const periodStart = new Date(periodEnd.getTime() - 30 * DAY_MS);
  await prisma.assessment.upsert({
    where: { id: PAST_ASSESSMENT_ID },
    create: {
      id: PAST_ASSESSMENT_ID,
      title: PAST_TITLE,
      description: PAST_DESCRIPTION,
      status: "COMPLETED",
      questionSetId,
      createdById,
      organizationId,
      startsAt: periodStart,
      endsAt: periodEnd,
    },
    update: { title: PAST_TITLE, description: PAST_DESCRIPTION },
  });

  const items = await prisma.questionSetItem.findMany({
    where: { questionSetId },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  const questions = items.map((item) => ({ ...item.question, customWeight: item.customWeight }));

  // P004 ayrılmadan önce bu dönemde değerlendirilmişti
  const people = [
    { employeeId: "P006", answers: RESPONDENTS[0]?.answers, offset: 1, daysBeforeEnd: 6 },
    { employeeId: "P007", answers: RESPONDENTS[1]?.answers, offset: 2, daysBeforeEnd: 9 },
    { employeeId: "P008", answers: RESPONDENTS[2]?.answers, offset: 1, daysBeforeEnd: 3 },
    { employeeId: "P004", answers: RESPONDENTS[1]?.answers, offset: 1, daysBeforeEnd: 12 },
  ];

  for (const p of people) {
    if (!p.answers || p.answers.length !== questions.length) continue;
    const personnel = await prisma.personnel.findFirst({
      where: { organizationId, employeeId: p.employeeId },
      select: { id: true },
    });
    if (!personnel) continue;
    const existing = await prisma.assessmentSession.findUnique({
      where: { assessmentId_personnelId: { assessmentId: PAST_ASSESSMENT_ID, personnelId: personnel.id } },
      select: { id: true },
    });
    if (existing) continue;

    const completedAt = new Date(periodEnd.getTime() - p.daysBeforeEnd * DAY_MS);
    const durationSec = 45 * 60 + p.offset * 300;
    const startedAt = new Date(completedAt.getTime() - durationSec * 1000);
    const perAnswer = Math.floor(durationSec / questions.length);

    const answers = questions.map((q, i) => {
      const value = p.answers![i]!;
      return {
        questionId: q.id,
        textAnswer: typeof value === "string" ? value : null,
        scaleValue:
          typeof value === "number" ? pastScale(value, q.minScale ?? 1, p.offset) : null,
        durationSec: perAnswer,
        answeredAt: new Date(startedAt.getTime() + (i + 1) * perAnswer * 1000),
      };
    });

    await prisma.assessmentSession.create({
      data: {
        assessmentId: PAST_ASSESSMENT_ID,
        personnelId: personnel.id,
        status: "COMPLETED",
        createdAt: new Date(periodStart.getTime()),
        startedAt,
        completedAt,
        durationSec,
        dimensionScores: computeScaleScores(questions, answers) as Prisma.InputJsonValue,
        analysisPipeline: "NOT_QUEUED",
        analysisError: ANALYSIS_AWAITS_REVIEW_REASON,
        requiresHrReview: true,
        answers: { create: answers },
        consentRecords: {
          create: ["DATA_PROCESSING", "AI_ASSESSMENT"].map((consentType) => ({
            consentType,
            legalTextVersion: "1.0",
            accepted: true,
            acceptedAt: startedAt,
            personnelId: personnel.id,
          })),
        },
        sessionEvents: {
          create: [
            { type: "SESSION_STARTED", createdAt: startedAt },
            { type: "SESSION_COMPLETED", createdAt: completedAt, payload: { durationSec } },
          ],
        },
      },
    });
    console.log(`✅ Geçmiş oturum (${PAST_TITLE}): ${p.employeeId}`);
  }

  await seedTerminatedPersonnel({ prisma, organizationId, now });
}

async function seedTerminatedPersonnel(params: {
  prisma: PrismaClient;
  organizationId: string;
  now: Date;
}) {
  const { prisma, organizationId, now } = params;
  const employeeId = "P004";

  const person = await prisma.personnel.findFirst({
    where: { organizationId, employeeId, deletedAt: null },
    select: { id: true, status: true, hireDate: true },
  });
  if (!person) return;
  if (person.status === "TERMINATED") {
    console.log(`✅ Ayrılan personel: ${employeeId} (zaten kayıtlı)`);
    return;
  }

  // Tarih alanları gün başına (UTC) yuvarlanır
  const terminationDate = new Date(now.getTime() - 21 * DAY_MS);
  terminationDate.setUTCHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.personnel.update({
      where: { id: person.id },
      data: {
        status: "TERMINATED",
        hireDate: person.hireDate ?? new Date("2021-09-13T00:00:00.000Z"),
        terminationDate,
        terminationReason: "RESIGNATION",
        terminationNote: "Şehir değişikliği nedeniyle istifa etti. Devir teslim tamamlandı.",
        portalRefreshToken: null,
      },
    }),
    prisma.assessmentSession.updateMany({
      where: { personnelId: person.id, status: { in: ["NOT_STARTED", "IN_PROGRESS", "PAUSED"] } },
      data: { status: "EXPIRED", invitationToken: null },
    }),
  ]);
  console.log(`✅ Ayrılan personel: ${employeeId} → TERMINATED (istifa)`);
}
