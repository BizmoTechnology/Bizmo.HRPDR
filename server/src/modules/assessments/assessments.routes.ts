import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { assertQuestionSetInOrg } from "../../lib/tenant.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";

const optionalDate = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.date().nullable().optional(),
);

const statusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);

const createSchema = z
  .object({
    title: z.string().trim().min(2).max(300),
    description: z.string().max(2000).nullable().optional(),
    questionSetId: z.string().min(1),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, {
    message: "Bitiş tarihi başlangıçtan sonra olmalı",
    path: ["endsAt"],
  });

const updateSchema = z.object({
  title: z.string().trim().min(2).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: statusEnum.optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

const assignSchema = z.object({
  personnelIds: z.array(z.string().min(1)).min(1).max(1000),
  dueAt: optionalDate,
});

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

const assessmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // ── GET / — Değerlendirme listesi ──────────────
  fastify.get<{
    Querystring: { status?: string; search?: string; page?: string; pageSize?: string };
  }>("/", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const { status, search } = request.query;
      const { page, pageSize, skip } = paginate(request.query);

      const where: Record<string, unknown> = { organizationId: orgId };
      if (status) where.status = status;
      if (search) where.title = { contains: search, mode: "insensitive" };

      const [assessments, total] = await Promise.all([
        prisma.assessment.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            questionSet: { select: { id: true, name: true } },
            _count: { select: { sessions: true } },
            sessions: {
              select: { status: true },
            },
          },
        }),
        prisma.assessment.count({ where }),
      ]);

      const data = assessments.map((a) => {
        const completed = a.sessions.filter((s) => s.status === "COMPLETED").length;
        const inProgress = a.sessions.filter((s) => s.status === "IN_PROGRESS").length;
        const { sessions: _sessions, _count, ...rest } = a;
        return {
          ...rest,
          sessionStats: {
            total: _count.sessions,
            completed,
            inProgress,
          },
        };
      });

      return reply.send({ data, meta: { total, page, pageSize } });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Değerlendirmeler alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── POST / — Yeni değerlendirme ────────────────
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const body = createSchema.parse(request.body);
    await assertQuestionSetInOrg(orgId, body.questionSetId);

    const assessment = await prisma.assessment.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        questionSetId: body.questionSetId,
        createdById: request.user.sub,
        organizationId: orgId,
        status: "DRAFT",
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
      },
      include: {
        questionSet: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send({ data: assessment });
  });

  // ── GET /:id — Değerlendirme detayı ────────────
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const assessment = await prisma.assessment.findFirst({
        where: { id: request.params.id, organizationId: orgId },
        include: {
          questionSet: {
            select: { id: true, name: true, description: true, items: { select: { questionId: true, order: true } } },
          },
          _count: { select: { sessions: true } },
          sessions: { select: { status: true } },
        },
      });

      if (!assessment) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Değerlendirme bulunamadı",
          traceId: request.traceId,
        });
      }

      const completed = assessment.sessions.filter((s) => s.status === "COMPLETED").length;
      const inProgress = assessment.sessions.filter((s) => s.status === "IN_PROGRESS").length;
      const { sessions: _sessions, _count, ...rest } = assessment;

      return reply.send({
        data: {
          ...rest,
          sessionStats: { total: _count.sessions, completed, inProgress },
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Değerlendirme alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── PUT /:id — Değerlendirme güncelleme ────────
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const body = updateSchema.parse(request.body);

    const existing = await prisma.assessment.findFirst({
      where: { id: request.params.id, organizationId: orgId },
      include: { questionSet: { select: { _count: { select: { items: true } } } } },
    });

    if (!existing) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "Değerlendirme bulunamadı",
        traceId: request.traceId,
      });
    }

    if (body.status === "ACTIVE" && existing.questionSet._count.items === 0) {
      return reply.status(409).send({
        code: "EMPTY_QUESTION_SET",
        message: "Soru içermeyen bir soru setiyle değerlendirme etkinleştirilemez",
        traceId: request.traceId,
      });
    }

    const startsAt = body.startsAt !== undefined ? body.startsAt : existing.startsAt;
    const endsAt = body.endsAt !== undefined ? body.endsAt : existing.endsAt;
    if (startsAt && endsAt && startsAt >= endsAt) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Bitiş tarihi başlangıçtan sonra olmalı",
        traceId: request.traceId,
      });
    }

    const assessment = await prisma.assessment.update({
      where: { id: request.params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt }),
      },
    });

    return reply.send({ data: assessment });
  });

  // ── DELETE /:id — Sadece DRAFT silinebilir ─────
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const existing = await prisma.assessment.findFirst({
        where: { id: request.params.id, organizationId: orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Değerlendirme bulunamadı",
          traceId: request.traceId,
        });
      }

      if (existing.status !== "DRAFT") {
        return reply.status(409).send({
          code: "CONFLICT",
          message: "Yalnızca taslak durumundaki değerlendirmeler silinebilir",
          traceId: request.traceId,
        });
      }

      await prisma.assessment.delete({ where: { id: request.params.id } });
      return reply.send({ data: { ok: true } });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Değerlendirme silinirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── POST /:id/activate — Aktif hale getir ─────
  fastify.post<{ Params: { id: string } }>("/:id/activate", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const existing = await prisma.assessment.findFirst({
        where: { id: request.params.id, organizationId: orgId },
        include: { questionSet: { select: { _count: { select: { items: true } } } } },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Değerlendirme bulunamadı",
          traceId: request.traceId,
        });
      }

      if (existing.questionSet._count.items === 0) {
        return reply.status(409).send({
          code: "EMPTY_QUESTION_SET",
          message: "Soru içermeyen bir soru setiyle değerlendirme etkinleştirilemez",
          traceId: request.traceId,
        });
      }

      const assessment = await prisma.assessment.update({
        where: { id: request.params.id },
        data: { status: "ACTIVE" },
      });

      return reply.send({ data: assessment });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Değerlendirme etkinleştirilirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── POST /:id/assign — Personele atama ────────
  fastify.post<{ Params: { id: string } }>("/:id/assign", async (request, reply) => {
    const orgId = request.user.orgId!;
    const body = assignSchema.parse(request.body);
    const personnelIds = [...new Set(body.personnelIds)];

    const existing = await prisma.assessment.findFirst({
      where: { id: request.params.id, organizationId: orgId },
    });

    if (!existing) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "Değerlendirme bulunamadı",
        traceId: request.traceId,
      });
    }

    if (existing.status === "COMPLETED" || existing.status === "ARCHIVED") {
      return reply.status(409).send({
        code: "ASSESSMENT_CLOSED",
        message: "Tamamlanmış veya arşivlenmiş değerlendirmeye atama yapılamaz",
        traceId: request.traceId,
      });
    }

    // Yalnızca aynı organizasyondaki, silinmemiş personel atanabilir
    const validPersonnel = await prisma.personnel.findMany({
      where: { id: { in: personnelIds }, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(validPersonnel.map((p) => p.id));
    const invalidCount = personnelIds.filter((pid) => !validIds.has(pid)).length;
    if (invalidCount > 0) {
      return reply.status(400).send({
        code: "INVALID_PERSONNEL",
        message: `${invalidCount} personel bulunamadı veya silinmiş`,
        traceId: request.traceId,
      });
    }

    const existingSessions = await prisma.assessmentSession.findMany({
      where: { assessmentId: existing.id, personnelId: { in: personnelIds } },
      select: { personnelId: true },
    });

    const alreadyAssigned = new Set(existingSessions.map((s) => s.personnelId));
    const toCreate = personnelIds.filter((pid) => !alreadyAssigned.has(pid));

    if (toCreate.length > 0) {
      await prisma.assessmentSession.createMany({
        data: toCreate.map((personnelId) => ({
          assessmentId: existing.id,
          personnelId,
          dueAt: body.dueAt ?? null,
        })),
        skipDuplicates: true,
      });
    }

    return reply.status(201).send({
      data: { createdCount: toCreate.length, skippedCount: alreadyAssigned.size },
    });
  });

  // ── GET /:id/sessions — Oturum listesi ─────────
  fastify.get<{
    Params: { id: string };
    Querystring: { status?: string; page?: string; pageSize?: string };
  }>("/:id/sessions", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const { status } = request.query;
      const { page, pageSize, skip } = paginate(request.query);

      const assessment = await prisma.assessment.findFirst({
        where: { id: request.params.id, organizationId: orgId },
        select: { id: true },
      });

      if (!assessment) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Değerlendirme bulunamadı",
          traceId: request.traceId,
        });
      }

      const where: Record<string, unknown> = { assessmentId: assessment.id };
      if (status) where.status = status;

      const [sessions, total] = await Promise.all([
        prisma.assessmentSession.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            personnel: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.assessmentSession.count({ where }),
      ]);

      const data = sessions.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        durationSec: s.durationSec,
        dimensionScores: s.dimensionScores,
        analysisPipeline: s.analysisPipeline,
        requiresHrReview: s.requiresHrReview,
        personnel: s.personnel,
      }));

      return reply.send({ data, meta: { total, page, pageSize } });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Oturumlar alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });
};

export default assessmentRoutes;
