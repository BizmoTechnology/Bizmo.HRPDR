import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import {
  getActiveAiConfig,
  hasAiConsent,
  queueSessionAnalysis,
  runSessionAnalysis,
} from "../../services/session-analysis.service.js";
import { computeScaleScores } from "../../services/scoring.service.js";
import {
  buildQuestionSetSnapshot,
  getSessionSnapshot,
  toPortalQuestion,
  type SnapshotQuestion,
} from "../../services/session-questions.service.js";
import { isHttpError } from "../../lib/http-error.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/authenticate.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function paginate(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const reviewSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  comment: z.string().max(5000).nullable().optional(),
});

// ═══════════════════════════════════════════
// Admin route'ları  (prefix: /api/sessions)
// ═══════════════════════════════════════════

export const sessionAdminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // ── GET /:id — Oturum detayı ───────────────────
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const session = await prisma.assessmentSession.findFirst({
        where: {
          id: request.params.id,
          assessment: { organizationId: orgId },
        },
        include: {
          personnel: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              email: true,
              position: true,
              department: { select: { id: true, name: true } },
            },
          },
          answers: {
            orderBy: { answeredAt: "asc" },
            include: {
              question: {
                select: { id: true, text: true, dimension: true, type: true, phase: true },
              },
            },
          },
          assessment: { select: { id: true, title: true } },
          analysisReview: true,
        },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      return reply.send({
        data: {
          ...session,
          dimensionScores: session.dimensionScores,
          swotAnalysis: session.swotAnalysis,
          careerPaths: session.careerPaths,
          keyInsights: session.keyInsights,
          hrPdrAnalysis: session.hrPdrAnalysis,
          psychologicalAnalysis: session.psychologicalAnalysis,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Oturum detayı alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── GET /:id/events — Oturum olay zaman çizelgesi
  fastify.get<{ Params: { id: string } }>("/:id/events", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const session = await prisma.assessmentSession.findFirst({
        where: { id: request.params.id, assessment: { organizationId: orgId } },
        select: { id: true },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      const events = await prisma.sessionEvent.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({ data: events });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Olay zaman çizelgesi alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── POST /:id/ai-analysis — AI analizi başlat (HR PDR veya Psikolojik)
  fastify.post<{
    Params: { id: string };
    Body: { analysisType: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS" };
  }>("/:id/ai-analysis", { preHandler: requireRole(ROLE_GROUPS.analyze) }, async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const { analysisType } = request.body ?? {};

      if (!["HR_PDR_ANALYSIS", "PSYCHOLOGICAL_ANALYSIS"].includes(analysisType)) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "Geçersiz analiz tipi. HR_PDR_ANALYSIS veya PSYCHOLOGICAL_ANALYSIS kullanın.",
          traceId: request.traceId,
        });
      }

      const session = await prisma.assessmentSession.findFirst({
        where: { id: request.params.id, assessment: { organizationId: orgId } },
        select: { id: true, status: true, analysisPipeline: true },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      if (session.status !== "COMPLETED") {
        return reply.status(409).send({
          code: "SESSION_NOT_COMPLETED",
          message: "Analiz yalnızca tamamlanmış oturumlar için çalıştırılabilir",
          traceId: request.traceId,
        });
      }

      const result = await runSessionAnalysis({
        sessionId: session.id,
        organizationId: orgId,
        analysisType,
      });

      if (analysisType === "HR_PDR_ANALYSIS" && session.analysisPipeline !== "COMPLETED") {
        await prisma.$transaction([
          prisma.assessmentSession.update({
            where: { id: session.id },
            data: { analysisPipeline: "COMPLETED", analysisError: null },
          }),
          prisma.sessionEvent.create({
            data: { sessionId: session.id, type: "ANALYSIS_COMPLETED", payload: { manual: true } },
          }),
        ]);
      }

      return reply.send({ data: result });
    } catch (err) {
      if (isHttpError(err)) {
        return reply.status(err.statusCode).send({
          code: err.code ?? "REQUEST_ERROR",
          message: err.message,
          traceId: request.traceId,
        });
      }
      const message = err instanceof Error ? err.message : "AI analizi sırasında hata oluştu";
      request.log.error(err);
      return reply.status(500).send({
        code: "AI_ANALYSIS_ERROR",
        message,
        traceId: request.traceId,
      });
    }
  });

  // ── POST /:id/review — Analiz incelemesi oluştur/güncelle
  fastify.post<{
    Params: { id: string };
    Body: { status: "PENDING" | "APPROVED" | "REJECTED"; comment?: string };
  }>("/:id/review", { preHandler: requireRole(ROLE_GROUPS.analyze) }, async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const { status, comment } = reviewSchema.parse(request.body);

      const session = await prisma.assessmentSession.findFirst({
        where: { id: request.params.id, assessment: { organizationId: orgId } },
        select: { id: true },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      const decidedAt = status !== "PENDING" ? new Date() : null;
      const review = await prisma.analysisReview.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          reviewerId: request.user.sub,
          status,
          comment: comment ?? null,
          decidedAt,
        },
        update: {
          reviewerId: request.user.sub,
          status,
          comment: comment ?? null,
          decidedAt,
        },
      });

      return reply.send({ data: review });
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "İnceleme kaydedilirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });
};

// ═══════════════════════════════════════════
// Portal route'ları
// ═══════════════════════════════════════════

/** KVKK metin sürümü; metin değiştiğinde artırılır. */
const LEGAL_TEXT_VERSION = "1.0";

const startSchema = z
  .object({
    consents: z
      .object({
        dataProcessing: z.boolean(),
        aiAssessment: z.boolean(),
      })
      .optional(),
  })
  .default({});

const answerSchema = z.object({
  questionId: z.string().min(1),
  textAnswer: z.string().max(10_000).nullable().optional(),
  scaleValue: z.coerce.number().int().nullable().optional(),
  choiceKey: z.string().max(50).nullable().optional(),
  /** Eski istemci uyumluluğu: tipe göre ilgili alana aktarılır */
  answer: z.union([z.string(), z.number()]).nullable().optional(),
  durationSec: z.coerce.number().int().min(0).max(86_400).optional(),
  followUpAsked: z.boolean().optional(),
  followUpAnswer: z.string().max(10_000).nullable().optional(),
  clientDedupeKey: z.string().max(100).optional(),
});

/** Personelin şu anda erişebileceği oturum koşulu */
function portalSessionWhere(personnelId: string, now: Date) {
  return {
    personnelId,
    personnel: { deletedAt: null },
    assessment: { status: "ACTIVE" as const },
    OR: [
      { status: "IN_PROGRESS" as const },
      {
        status: "NOT_STARTED" as const,
        AND: [
          { OR: [{ dueAt: null }, { dueAt: { gte: now } }] },
          { assessment: { OR: [{ startsAt: null }, { startsAt: { lte: now } }] } },
          { assessment: { OR: [{ endsAt: null }, { endsAt: { gte: now } }] } },
        ],
      },
    ],
  };
}

function isAnswered(
  q: SnapshotQuestion,
  a: { textAnswer: string | null; scaleValue: number | null; choiceKey: string | null } | undefined,
) {
  if (!a) return false;
  if (q.type === "SCALE") return a.scaleValue !== null;
  if (q.type === "MULTIPLE_CHOICE") return !!a.choiceKey;
  return !!a.textAnswer?.trim();
}

export const sessionPortalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticatePortal);

  // ── GET /portal/sessions/active — Aktif oturum ─
  fastify.get("/portal/sessions/active", async (request, reply) => {
    const personnelId = request.user.sub;
    const now = new Date();

    const candidates = await prisma.assessmentSession.findMany({
      where: portalSessionWhere(personnelId, now),
      orderBy: { createdAt: "asc" },
      include: {
        assessment: {
          select: { id: true, title: true, description: true, questionSetId: true, endsAt: true },
        },
        answers: {
          select: { questionId: true, textAnswer: true, scaleValue: true, choiceKey: true },
        },
      },
    });

    // Yarım kalan oturum önce, sonra en eski atama
    const session =
      candidates.find((c) => c.status === "IN_PROGRESS") ?? candidates[0];

    if (!session) {
      return reply.send({ data: null });
    }

    const snapshot = await getSessionSnapshot(session);

    return reply.send({
      data: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        dueAt: session.dueAt ?? session.assessment.endsAt,
        assessment: {
          id: session.assessment.id,
          title: session.assessment.title,
          description: session.assessment.description,
        },
        questionCount: snapshot.questions.length,
        questions: snapshot.questions.map(toPortalQuestion),
        answers: session.answers,
      },
    });
  });

  // ── POST /portal/sessions/:id/start — Oturum başlat (veya devam et)
  fastify.post<{ Params: { id: string } }>(
    "/portal/sessions/:id/start",
    async (request, reply) => {
      const personnelId = request.user.sub;
      const body = startSchema.parse(request.body ?? {});
      const now = new Date();

      const session = await prisma.assessmentSession.findFirst({
        where: { id: request.params.id, ...portalSessionWhere(personnelId, now) },
        include: { assessment: { select: { questionSetId: true } } },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Aktif oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      // Yarım kalan oturuma dönüş: tekrar başlatmadan devam edilir
      if (session.status === "IN_PROGRESS") {
        await prisma.sessionEvent.create({
          data: { sessionId: session.id, type: "SESSION_RESUMED" },
        });
        return reply.send({ data: { id: session.id, status: session.status, startedAt: session.startedAt } });
      }

      if (!body.consents?.dataProcessing) {
        return reply.status(400).send({
          code: "CONSENT_REQUIRED",
          message: "Devam etmek için KVKK aydınlatma metnini onaylamalısınız",
          traceId: request.traceId,
        });
      }

      const snapshot = await buildQuestionSetSnapshot(session.assessment.questionSetId);
      if (snapshot.questions.length === 0) {
        return reply.status(409).send({
          code: "EMPTY_QUESTION_SET",
          message: "Bu değerlendirmede soru bulunmuyor. Lütfen İK ile iletişime geçin.",
          traceId: request.traceId,
        });
      }

      const userAgent = request.headers["user-agent"] ?? null;
      const consentBase = {
        personnelId,
        sessionId: session.id,
        legalTextVersion: LEGAL_TEXT_VERSION,
        acceptedAt: now,
        ipAddress: request.ip,
        userAgent,
      };

      // Eşzamanlı iki başlatma isteğinde yalnızca biri geçerli olsun
      const started = await prisma.$transaction(async (tx) => {
        const res = await tx.assessmentSession.updateMany({
          where: { id: session.id, status: "NOT_STARTED" },
          data: {
            status: "IN_PROGRESS",
            startedAt: now,
            ipAddress: request.ip,
            userAgent,
            questionSetSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        if (res.count === 0) return false;

        await tx.sessionEvent.create({
          data: {
            sessionId: session.id,
            type: "SESSION_STARTED",
            payload: { startedAt: now.toISOString(), questionSetVersion: snapshot.version },
          },
        });
        await tx.consentRecord.createMany({
          data: [
            { ...consentBase, consentType: "DATA_PROCESSING", accepted: true },
            {
              ...consentBase,
              consentType: "AI_ASSESSMENT",
              accepted: body.consents?.aiAssessment ?? false,
            },
          ],
        });
        return true;
      });

      if (!started) {
        return reply.status(409).send({
          code: "CONFLICT",
          message: "Oturum zaten başlatılmış",
          traceId: request.traceId,
        });
      }

      return reply.send({ data: { id: session.id, status: "IN_PROGRESS", startedAt: now } });
    },
  );

  // ── POST /portal/sessions/:id/answer — Cevap kaydet
  fastify.post<{ Params: { id: string } }>(
    "/portal/sessions/:id/answer",
    async (request, reply) => {
      const personnelId = request.user.sub;
      const body = answerSchema.parse(request.body);

      const session = await prisma.assessmentSession.findFirst({
        where: {
          id: request.params.id,
          personnelId,
          status: "IN_PROGRESS",
          assessment: { status: "ACTIVE" },
        },
        select: {
          id: true,
          questionSetSnapshot: true,
          assessment: { select: { questionSetId: true } },
        },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Aktif oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      const snapshot = await getSessionSnapshot(session);
      const question = snapshot.questions.find((q) => q.id === body.questionId);
      if (!question) {
        return reply.status(400).send({
          code: "INVALID_QUESTION",
          message: "Soru bu değerlendirmeye ait değil",
          traceId: request.traceId,
        });
      }

      let textAnswer: string | null = body.textAnswer?.trim() || null;
      let scaleValue: number | null = body.scaleValue ?? null;
      let choiceKey: string | null = body.choiceKey ?? null;

      if (body.answer !== undefined && body.answer !== null) {
        if (question.type === "SCALE") scaleValue ??= Number(body.answer);
        else if (question.type === "MULTIPLE_CHOICE") choiceKey ??= String(body.answer);
        else textAnswer ??= String(body.answer).trim() || null;
      }

      if (question.type === "SCALE") {
        const min = question.minScale ?? 1;
        const max = question.maxScale ?? 10;
        if (scaleValue === null || !Number.isInteger(scaleValue) || scaleValue < min || scaleValue > max) {
          return reply.status(400).send({
            code: "INVALID_ANSWER",
            message: `Lütfen ${min}-${max} arasında bir değer seçin`,
            traceId: request.traceId,
          });
        }
        textAnswer = null;
        choiceKey = null;
      } else if (question.type === "MULTIPLE_CHOICE") {
        if (!choiceKey || (question.options && !Object.hasOwn(question.options, choiceKey))) {
          return reply.status(400).send({
            code: "INVALID_ANSWER",
            message: "Lütfen seçeneklerden birini seçin",
            traceId: request.traceId,
          });
        }
        textAnswer = null;
        scaleValue = null;
      } else {
        if (!textAnswer) {
          return reply.status(400).send({
            code: "INVALID_ANSWER",
            message: "Cevap boş bırakılamaz",
            traceId: request.traceId,
          });
        }
        scaleValue = null;
        choiceKey = null;
      }

      const answerData = {
        textAnswer,
        scaleValue,
        choiceKey,
        durationSec: body.durationSec ?? null,
        followUpAsked: body.followUpAsked ?? false,
        followUpAnswer: body.followUpAnswer ?? null,
        answeredAt: new Date(),
      };

      // Soru başına tek cevap: (sessionId, questionId) üzerinden upsert.
      // clientDedupeKey yalnızca ilk kayıtta saklanır (yeniden gönderimlerde çakışmasın).
      const answer = await prisma.answer.upsert({
        where: { sessionId_questionId: { sessionId: session.id, questionId: question.id } },
        create: {
          sessionId: session.id,
          questionId: question.id,
          clientDedupeKey: body.clientDedupeKey ?? null,
          ...answerData,
        },
        update: answerData,
      });

      await prisma.sessionEvent.create({
        data: {
          sessionId: session.id,
          type: "ANSWER_SAVED",
          payload: { questionId: question.id, answerId: answer.id },
        },
      });

      return reply.send({
        data: {
          id: answer.id,
          questionId: answer.questionId,
          textAnswer: answer.textAnswer,
          scaleValue: answer.scaleValue,
          choiceKey: answer.choiceKey,
        },
      });
    },
  );

  // ── POST /portal/sessions/:id/complete — Oturumu tamamla
  fastify.post<{ Params: { id: string } }>(
    "/portal/sessions/:id/complete",
    async (request, reply) => {
      const personnelId = request.user.sub;

      const session = await prisma.assessmentSession.findFirst({
        where: { id: request.params.id, personnelId, status: "IN_PROGRESS" },
        include: {
          assessment: { select: { questionSetId: true, organizationId: true, title: true } },
          personnel: { select: { firstName: true, lastName: true } },
          answers: {
            select: { questionId: true, textAnswer: true, scaleValue: true, choiceKey: true },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Aktif oturum bulunamadı",
          traceId: request.traceId,
        });
      }

      const snapshot = await getSessionSnapshot(session);
      const answersByQuestion = new Map(session.answers.map((a) => [a.questionId, a]));
      const missing = snapshot.questions.filter(
        (q) => q.isRequired && !isAnswered(q, answersByQuestion.get(q.id)),
      );
      if (missing.length > 0) {
        return reply.status(409).send({
          code: "MISSING_ANSWERS",
          message: `${missing.length} zorunlu soru cevaplanmadı`,
          details: { questionIds: missing.map((q) => q.id) },
          traceId: request.traceId,
        });
      }

      const scaleScores = computeScaleScores(snapshot.questions, session.answers);
      const hasScaleScores = Object.keys(scaleScores).length > 0;

      const organizationId = session.assessment.organizationId;
      const aiConfig = await getActiveAiConfig(organizationId);
      const aiConsent = await hasAiConsent(session.id);
      const willAnalyze = !!aiConfig && aiConsent;

      const now = new Date();
      const durationSec = session.startedAt
        ? Math.round((now.getTime() - session.startedAt.getTime()) / 1000)
        : null;

      const completed = await prisma.$transaction(async (tx) => {
        const res = await tx.assessmentSession.updateMany({
          where: { id: session.id, status: "IN_PROGRESS" },
          data: {
            status: "COMPLETED",
            completedAt: now,
            durationSec,
            ...(hasScaleScores && { dimensionScores: scaleScores as Prisma.InputJsonValue }),
            analysisPipeline: willAnalyze ? "QUEUED" : "NOT_QUEUED",
            analysisError: willAnalyze
              ? null
              : !aiConsent
                ? "Personel AI analizine rıza vermedi"
                : "Aktif AI yapılandırması yok",
          },
        });
        if (res.count === 0) return false;

        await tx.sessionEvent.create({
          data: {
            sessionId: session.id,
            type: "SESSION_COMPLETED",
            payload: { completedAt: now.toISOString(), durationSec },
          },
        });

        // Değerlendirmeyi yöneten kullanıcılara uygulama içi bildirim
        const recipients = await tx.user.findMany({
          where: {
            organizationId,
            isActive: true,
            deletedAt: null,
            role: { in: ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"] },
          },
          select: { id: true },
        });
        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((u) => ({
              userId: u.id,
              type: "SESSION_COMPLETED",
              title: "Değerlendirme tamamlandı",
              body: `${session.personnel.firstName} ${session.personnel.lastName} "${session.assessment.title}" değerlendirmesini tamamladı.`,
              metadata: { sessionId: session.id, assessmentId: session.assessmentId },
            })),
          });
        }
        return true;
      });

      if (!completed) {
        return reply.status(409).send({
          code: "CONFLICT",
          message: "Oturum zaten tamamlanmış",
          traceId: request.traceId,
        });
      }

      if (willAnalyze) {
        queueSessionAnalysis(session.id, organizationId, request.log);
      }

      return reply.send({ data: { id: session.id, status: "COMPLETED", completedAt: now } });
    },
  );
};

export default sessionAdminRoutes;
