import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/authenticate.js";
import {
  DIMENSIONS,
  computeOverallScore,
  dimensionWeightMap,
  readDimensionScores,
  type Dimension,
} from "../../services/scoring.service.js";
import { parseSnapshot } from "../../services/session-questions.service.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const DIMENSION_LABELS: Record<Dimension, string> = {
  LOGICAL_ALGORITHMIC: "Mantıksal / Algoritmik",
  LEADERSHIP: "Liderlik",
  SOCIAL_INTELLIGENCE: "Sosyal Zeka",
  GROWTH_POTENTIAL: "Gelişim Potansiyeli",
  DOMAIN_ALIGNMENT: "Alan Uyumu",
};

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["GENERATING", "READY", "FAILED"]).optional(),
  assessmentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const generateBodySchema = z.object({ sessionId: z.string().min(1) });

const personnelSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  email: true,
  position: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.PersonnelSelect;

const reportDetailInclude = {
  personnel: { select: personnelSummarySelect },
  generatedBy: { select: { id: true, name: true } },
  session: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      durationSec: true,
      dimensionScores: true,
      swotAnalysis: true,
      careerPaths: true,
      keyInsights: true,
      analysisPipeline: true,
      hrPdrAnalysis: true,
      psychologicalAnalysis: true,
      requiresHrReview: true,
      analysisReview: {
        select: { status: true, comment: true, decidedAt: true, reviewer: { select: { name: true } } },
      },
      assessment: { select: { id: true, title: true, description: true } },
      answers: {
        orderBy: { answeredAt: "asc" },
        select: {
          id: true,
          textAnswer: true,
          scaleValue: true,
          choiceKey: true,
          followUpAnswer: true,
          answeredAt: true,
          durationSec: true,
          question: {
            select: {
              text: true,
              subText: true,
              dimension: true,
              type: true,
              phase: true,
              options: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReportInclude;

/**
 * Rapor detayına genel skoru ekler: rapor üretilirken kaydedilen değer, yoksa
 * (ör. eski/seed raporlar) oturumun boyut skorlarından hesaplanan değer.
 */
function withOverallScore<
  T extends { fullReportJson: Prisma.JsonValue; session: { dimensionScores: Prisma.JsonValue } | null },
>(report: T): T & { overallScore: number | null } {
  const stored = (report.fullReportJson as { overallScore?: unknown } | null)?.overallScore;
  return {
    ...report,
    overallScore:
      typeof stored === "number"
        ? stored
        : computeOverallScore(readDimensionScores(report.session?.dimensionScores)),
  };
}

/** Özet metni: AI özeti > İK içgörüsü > skorlardan üretilen kısa özet */
function buildExecutiveSummary(params: {
  fullName: string;
  hrPdrAnalysis: unknown;
  keyInsights: string | null;
  scores: Partial<Record<Dimension, number>> | null;
  overallScore: number | null;
}): string | null {
  const hr = params.hrPdrAnalysis as { performanceSummary?: unknown } | null;
  if (hr && typeof hr.performanceSummary === "string" && hr.performanceSummary.trim()) {
    return hr.performanceSummary;
  }
  if (params.keyInsights?.trim()) return params.keyInsights;

  if (!params.scores) return null;
  const ranked = DIMENSIONS.filter((d) => typeof params.scores?.[d] === "number").sort(
    (a, b) => (params.scores![b] ?? 0) - (params.scores![a] ?? 0),
  );
  const best = ranked[0];
  const weakest = ranked[ranked.length - 1];
  if (!best || !weakest) return null;

  const parts = [
    `${params.fullName} için genel potansiyel skoru ${params.overallScore?.toFixed(1) ?? "—"}/10.`,
    `En güçlü boyut: ${DIMENSION_LABELS[best]} (${params.scores[best]?.toFixed(1)}).`,
  ];
  if (weakest !== best) {
    parts.push(`Gelişime en açık boyut: ${DIMENSION_LABELS[weakest]} (${params.scores[weakest]?.toFixed(1)}).`);
  }
  return parts.join(" ");
}

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  // development.md §8: rapor oluşturma/indirme VIEWER hariç
  fastify.addHook("preHandler", requireRole(ROLE_GROUPS.analyze));

  // ── GET / — Rapor listesi ─────────────────────
  fastify.get("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const q = listQuerySchema.parse(request.query);

    const where: Prisma.ReportWhereInput = {
      personnel: { organizationId: orgId },
      ...(q.status && { status: q.status }),
      ...(q.assessmentId && { session: { assessmentId: q.assessmentId } }),
      ...(q.search && {
        OR: [
          { personnel: { firstName: { contains: q.search, mode: "insensitive" } } },
          { personnel: { lastName: { contains: q.search, mode: "insensitive" } } },
          { personnel: { employeeId: { contains: q.search, mode: "insensitive" } } },
          { session: { assessment: { title: { contains: q.search, mode: "insensitive" } } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          generatedAt: true,
          createdAt: true,
          executiveSummary: true,
          fullReportJson: true,
          personnel: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { id: true, name: true } },
            },
          },
          session: {
            select: {
              id: true,
              status: true,
              completedAt: true,
              dimensionScores: true,
              assessment: { select: { id: true, title: true } },
            },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    const data = rows.map(({ fullReportJson, session, ...r }) => {
      const stored = (fullReportJson as { overallScore?: unknown } | null)?.overallScore;
      return {
        ...r,
        overallScore:
          typeof stored === "number"
            ? stored
            : computeOverallScore(readDimensionScores(session.dimensionScores)),
        session: {
          id: session.id,
          status: session.status,
          completedAt: session.completedAt,
          assessment: session.assessment,
        },
      };
    });

    return reply.send({ data, meta: { total, page: q.page, pageSize: q.pageSize } });
  });

  // ── POST /generate — Rapor üret ({ sessionId }) ve /generate/:sessionId
  const generate = async (
    sessionId: string,
    orgId: string,
    userId: string,
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const session = await prisma.assessmentSession.findFirst({
      where: { id: sessionId, assessment: { organizationId: orgId } },
      include: {
        personnel: { select: { id: true, firstName: true, lastName: true } },
        analysisReview: { select: { status: true, comment: true } },
        assessment: {
          select: {
            questionSet: {
              select: {
                weightLogical: true,
                weightLeadership: true,
                weightSocial: true,
                weightGrowth: true,
                weightDomain: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return { status: 404, body: { code: "NOT_FOUND", message: "Oturum bulunamadı" } };
    }

    if (session.status !== "COMPLETED") {
      return {
        status: 409,
        body: {
          code: "SESSION_NOT_COMPLETED",
          message: "Rapor yalnızca tamamlanmış oturumlar için üretilebilir",
        },
      };
    }

    // development.md §7.5: İK onayı gerekiyorsa rapor onaydan sonra üretilir
    if (session.requiresHrReview && session.analysisReview?.status !== "APPROVED") {
      return {
        status: 409,
        body: {
          code: "HR_REVIEW_REQUIRED",
          message:
            session.analysisReview?.status === "REJECTED"
              ? "Analiz İK tarafından reddedildi; rapor üretilemez"
              : "Rapor üretmeden önce analizin İK tarafından onaylanması gerekiyor",
        },
      };
    }

    const scores = readDimensionScores(session.dimensionScores);
    const weights =
      parseSnapshot(session.questionSetSnapshot)?.weights ??
      dimensionWeightMap(session.assessment.questionSet);
    const overallScore = computeOverallScore(scores, weights);

    if (!scores && !session.hrPdrAnalysis && !session.keyInsights) {
      return {
        status: 409,
        body: {
          code: "NO_ANALYSIS",
          message: "Bu oturum için henüz skor veya analiz yok. Önce AI analizini çalıştırın.",
        },
      };
    }

    const fullName = `${session.personnel.firstName} ${session.personnel.lastName}`;
    const now = new Date();
    const fullReportJson = {
      generatedAt: now.toISOString(),
      overallScore,
      dimensionWeights: weights,
      dimensionScores: scores,
      swotAnalysis: session.swotAnalysis,
      careerPaths: session.careerPaths,
      keyInsights: session.keyInsights,
      hrPdrAnalysis: session.hrPdrAnalysis,
      psychologicalAnalysis: session.psychologicalAnalysis,
      review: session.analysisReview,
    } as Prisma.InputJsonValue;

    const executiveSummary = buildExecutiveSummary({
      fullName,
      hrPdrAnalysis: session.hrPdrAnalysis,
      keyInsights: session.keyInsights,
      scores,
      overallScore,
    });

    const report = await prisma.$transaction(async (tx) => {
      const saved = await tx.report.upsert({
        where: { sessionId: session.id },
        create: {
          sessionId: session.id,
          personnelId: session.personnel.id,
          generatedById: userId,
          status: "READY",
          executiveSummary,
          fullReportJson,
          generatedAt: now,
        },
        update: {
          generatedById: userId,
          status: "READY",
          executiveSummary,
          fullReportJson,
          generatedAt: now,
        },
      });
      await tx.sessionEvent.create({
        data: { sessionId: session.id, type: "REPORT_READY", payload: { reportId: saved.id } },
      });
      return saved;
    });

    const detail = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
      include: reportDetailInclude,
    });
    return { status: 201, body: { data: withOverallScore(detail) } };
  };

  fastify.post("/generate", async (request, reply) => {
    const { sessionId } = generateBodySchema.parse(request.body);
    const res = await generate(sessionId, request.user.orgId!, request.user.sub);
    return reply.status(res.status).send({ ...res.body, ...(res.status >= 400 && { traceId: request.traceId }) });
  });

  fastify.post<{ Params: { sessionId: string } }>("/generate/:sessionId", async (request, reply) => {
    const res = await generate(request.params.sessionId, request.user.orgId!, request.user.sub);
    return reply.status(res.status).send({ ...res.body, ...(res.status >= 400 && { traceId: request.traceId }) });
  });

  // ── GET /by-session/:sessionId — Oturumun raporu (yoksa null)
  fastify.get<{ Params: { sessionId: string } }>("/by-session/:sessionId", async (request, reply) => {
    const orgId = request.user.orgId!;
    const report = await prisma.report.findFirst({
      where: { sessionId: request.params.sessionId, personnel: { organizationId: orgId } },
      select: { id: true, status: true, generatedAt: true },
    });
    return reply.send({ data: report });
  });

  // ── GET /:id — Rapor detayı ───────────────────
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const report = await prisma.report.findFirst({
      where: { id: request.params.id, personnel: { organizationId: orgId } },
      include: reportDetailInclude,
    });

    if (!report) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "Rapor bulunamadı",
        traceId: request.traceId,
      });
    }

    return reply.send({ data: withOverallScore(report) });
  });

  // ── DELETE /:id — Rapor sil ───────────────────
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const report = await prisma.report.findFirst({
      where: { id: request.params.id, personnel: { organizationId: orgId } },
      select: { id: true },
    });

    if (!report) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "Rapor bulunamadı",
        traceId: request.traceId,
      });
    }

    await prisma.report.delete({ where: { id: report.id } });
    return reply.send({ data: { ok: true } });
  });
};

export default reportsRoutes;
