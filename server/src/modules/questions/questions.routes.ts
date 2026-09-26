import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";
import { generateAiQuestions } from "../../services/question-ai-generate.service.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const dimensionEnum = z.enum([
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
]);

const typeEnum = z.enum([
  "OPEN_ENDED",
  "SITUATIONAL",
  "BEHAVIORAL",
  "SCALE",
  "MULTIPLE_CHOICE",
]);

const phaseEnum = z.enum(["ICEBREAKER", "CORE", "CLOSING"]);

const createSchema = z.object({
  text: z.string().min(1).max(2000),
  subText: z.string().max(1000).optional(),
  dimension: dimensionEnum,
  type: typeEnum,
  phase: phaseEnum,
  weight: z.number().min(0).default(1.0),
  followUpPrompt: z.string().max(2000).optional(),
  options: z.any().optional(),
  minScale: z.number().int().optional(),
  maxScale: z.number().int().optional(),
  isActive: z.boolean().default(true),
  isAiGenerated: z.boolean().default(false),
  aiModel: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).default([]),
  language: z.string().max(10).default("tr"),
});

const updateSchema = createSchema.partial();

function parsePagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const raw = parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, raw), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const questionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // GET / — list questions (paginated)
  fastify.get<{
    Querystring: {
      dimension?: string;
      type?: string;
      phase?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };
  }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { dimension, type, phase, search } = request.query;
    const { page, pageSize, skip } = parsePagination(request.query);

    try {
      const where: Record<string, unknown> = {
        organizationId: orgId,
        deletedAt: null,
      };

      if (dimension) where.dimension = dimension;
      if (type) where.type = type;
      if (phase) where.phase = phase;
      if (search) {
        where.OR = [
          { text: { contains: search, mode: "insensitive" } },
          { subText: { contains: search, mode: "insensitive" } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.question.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
        prisma.question.count({ where }),
      ]);

      return reply.send({
        data,
        meta: { total, page, pageSize },
      });
    } catch (err) {
      request.log.error(err, "questions.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Sorular listelenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /ai-generate — AI ile soru üret
  fastify.post<{
    Body: {
      dimension: string;
      questionTypes?: string[];
      count?: number;
      context?: string;
    };
  }>("/ai-generate", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const { dimension, questionTypes, count = 5, context } = request.body;

      if (!dimension || !dimensionEnum.safeParse(dimension).success) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "Geçerli bir boyut seçin: " + dimensionEnum.options.join(", "),
          traceId: request.traceId,
        });
      }

      const clampedCount = Math.min(Math.max(1, count), 10);

      const questions = await generateAiQuestions({
        organizationId: orgId,
        dimension,
        questionTypes,
        count: clampedCount,
        context,
      });

      return reply.send({ data: questions });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI soru üretimi sırasında hata oluştu";
      request.log.error(err, "questions.aiGenerate failed");
      return reply.status(500).send({
        code: "AI_GENERATE_ERROR",
        message,
        traceId: request.traceId,
      });
    }
  });

  // POST / — create question
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = createSchema.parse(request.body);

      const question = await prisma.question.create({
        data: {
          ...body,
          organizationId: orgId,
        },
      });

      return reply.status(201).send({ data: question });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "questions.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /:id — update question
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const body = updateSchema.parse(request.body);

      const existing = await prisma.question.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Soru bulunamadı",
          traceId: request.traceId,
        });
      }

      const updated = await prisma.question.update({
        where: { id },
        data: body,
      });

      return reply.send({ data: updated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "questions.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru güncellenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // DELETE /:id — soft delete
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { id } = request.params;

      try {
        const existing = await prisma.question.findFirst({
          where: { id, organizationId: orgId, deletedAt: null },
        });

        if (!existing) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Soru bulunamadı",
            traceId: request.traceId,
          });
        }

        await prisma.question.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        return reply.send({ data: { ok: true } });
      } catch (err) {
        request.log.error(err, "questions.delete failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Soru silinirken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );
};

export default questionRoutes;
