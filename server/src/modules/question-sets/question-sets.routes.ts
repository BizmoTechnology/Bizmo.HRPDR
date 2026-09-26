import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError, isHttpError } from "../../lib/http-error.js";
import { assertQuestionsInOrg } from "../../lib/tenant.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";
import { suggestQuestionSetFromAi } from "../../services/question-set-ai-suggest.service.js";

const aiSuggestSchema = z.object({
  brief: z
    .string()
    .min(20, "En az 20 karakterlik bir açıklama girin")
    .max(2000),
  maxQuestions: z.coerce.number().int().min(3).max(50).optional().default(20),
});

const itemSchema = z.object({
  questionId: z.string().min(1),
  order: z.number().int().min(0),
  isRequired: z.boolean().default(true),
  customWeight: z.number().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  weightLogical: z.number().min(0).default(20),
  weightLeadership: z.number().min(0).default(20),
  weightSocial: z.number().min(0).default(20),
  weightGrowth: z.number().min(0).default(20),
  weightDomain: z.number().min(0).default(20),
  items: z.array(itemSchema).default([]),
});

const updateSchema = createSchema.partial();

/** Öğelerin aynı organizasyona ait, tekrarsız soru ve sıra içerdiğini doğrular */
async function validateItems(
  organizationId: string,
  items: Array<{ questionId: string; order: number }>,
  questionSetId?: string,
) {
  const orders = items.map((i) => i.order);
  if (new Set(orders).size !== orders.length) {
    throw new HttpError("Soru sıraları tekil olmalı", 400, "DUPLICATE_ORDER");
  }
  const existing = questionSetId
    ? await prisma.questionSetItem.findMany({
        where: { questionSetId },
        select: { questionId: true },
      })
    : [];
  await assertQuestionsInOrg(
    organizationId,
    items.map((i) => i.questionId),
    new Set(existing.map((e) => e.questionId)),
  );
}

const questionSetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // GET / — list question sets with item count
  fastify.get<{
    Querystring: { search?: string };
  }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { search } = request.query;

    try {
      const where = {
        organizationId: orgId,
        deletedAt: null,
        ...(search && {
          name: { contains: search, mode: "insensitive" as const },
        }),
      };

      const sets = await prisma.questionSet.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { items: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      const data = sets.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        isActive: s.isActive,
        isDefault: s.isDefault,
        version: s.version,
        weightLogical: s.weightLogical,
        weightLeadership: s.weightLeadership,
        weightSocial: s.weightSocial,
        weightGrowth: s.weightGrowth,
        weightDomain: s.weightDomain,
        itemCount: s._count.items,
        createdBy: s.createdBy,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "questionSets.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru setleri listelenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST / — create question set with items
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const userId = request.user.sub;

    try {
      const body = createSchema.parse(request.body);
      const { items, ...meta } = body;
      await validateItems(orgId, items);

      const questionSet = await prisma.$transaction(async (tx) => {
        if (meta.isDefault) {
          await tx.questionSet.updateMany({
            where: { organizationId: orgId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const qs = await tx.questionSet.create({
          data: {
            ...meta,
            organizationId: orgId,
            createdById: userId,
          },
        });

        if (items.length > 0) {
          await tx.questionSetItem.createMany({
            data: items.map((item) => ({
              questionSetId: qs.id,
              questionId: item.questionId,
              order: item.order,
              isRequired: item.isRequired,
              customWeight: item.customWeight,
            })),
          });
        }

        return tx.questionSet.findUnique({
          where: { id: qs.id },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                question: {
                  select: { id: true, text: true, dimension: true, type: true, phase: true },
                },
              },
            },
          },
        });
      });

      return reply.status(201).send({ data: questionSet });
    } catch (err) {
      if (isHttpError(err)) throw err;
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "questionSets.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru seti oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /ai-suggest — AI ile soru seti taslağı (soru havuzundan seçim)
  fastify.post("/ai-suggest", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = aiSuggestSchema.parse(request.body);
      const data = await suggestQuestionSetFromAi({
        organizationId: orgId,
        brief: body.brief,
        maxQuestions: body.maxQuestions,
      });
      return reply.send({ data });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      const message =
        err instanceof Error ? err.message : "AI önerisi alınamadı";
      request.log.warn({ err }, "questionSets.aiSuggest failed");
      return reply.status(400).send({
        code: "AI_SUGGEST_FAILED",
        message,
        traceId: request.traceId,
      });
    }
  });

  // GET /:id — get question set with items
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const questionSet = await prisma.questionSet.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        include: {
          createdBy: { select: { id: true, name: true } },
          items: {
            orderBy: { order: "asc" },
            include: {
              question: {
                select: {
                  id: true,
                  text: true,
                  subText: true,
                  dimension: true,
                  type: true,
                  phase: true,
                  weight: true,
                  options: true,
                  minScale: true,
                  maxScale: true,
                },
              },
            },
          },
        },
      });

      if (!questionSet) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Soru seti bulunamadı",
          traceId: request.traceId,
        });
      }

      return reply.send({ data: questionSet });
    } catch (err) {
      request.log.error(err, "questionSets.getById failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru seti getirilirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /:id — update question set metadata + replace items
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const body = updateSchema.parse(request.body);
      const { items, ...meta } = body;

      const existing = await prisma.questionSet.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Soru seti bulunamadı",
          traceId: request.traceId,
        });
      }

      if (items !== undefined) await validateItems(orgId, items, id);

      const updated = await prisma.$transaction(async (tx) => {
        if (meta.isDefault) {
          await tx.questionSet.updateMany({
            where: { organizationId: orgId, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }
        if (Object.keys(meta).length > 0 || items !== undefined) {
          await tx.questionSet.update({
            where: { id },
            data: {
              ...meta,
              // İçerik değiştiğinde sürüm artar (oturumlar başlangıçtaki anlık görüntüyü kullanır)
              ...(items !== undefined && { version: { increment: 1 } }),
            },
          });
        }

        if (items !== undefined) {
          await tx.questionSetItem.deleteMany({
            where: { questionSetId: id },
          });

          if (items.length > 0) {
            await tx.questionSetItem.createMany({
              data: items.map((item) => ({
                questionSetId: id,
                questionId: item.questionId,
                order: item.order,
                isRequired: item.isRequired,
                customWeight: item.customWeight,
              })),
            });
          }
        }

        return tx.questionSet.findUnique({
          where: { id },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                question: {
                  select: { id: true, text: true, dimension: true, type: true, phase: true },
                },
              },
            },
          },
        });
      });

      return reply.send({ data: updated });
    } catch (err) {
      if (isHttpError(err)) throw err;
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "questionSets.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Soru seti güncellenirken hata oluştu",
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
        const existing = await prisma.questionSet.findFirst({
          where: { id, organizationId: orgId, deletedAt: null },
        });

        if (!existing) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Soru seti bulunamadı",
            traceId: request.traceId,
          });
        }

        await prisma.questionSet.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        return reply.send({ data: { ok: true } });
      } catch (err) {
        request.log.error(err, "questionSets.delete failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Soru seti silinirken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );

  // POST /:id/duplicate — duplicate question set
  fastify.post<{ Params: { id: string } }>(
    "/:id/duplicate",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const source = await prisma.questionSet.findFirst({
          where: { id, organizationId: orgId, deletedAt: null },
          include: { items: { orderBy: { order: "asc" } } },
        });

        if (!source) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Kaynak soru seti bulunamadı",
            traceId: request.traceId,
          });
        }

        const nameBody = (request.body as { name?: string } | null)?.name;
        const newName = nameBody ?? `${source.name} (Kopya)`;

        const duplicate = await prisma.$transaction(async (tx) => {
          const qs = await tx.questionSet.create({
            data: {
              name: newName,
              description: source.description,
              isActive: source.isActive,
              isDefault: false,
              weightLogical: source.weightLogical,
              weightLeadership: source.weightLeadership,
              weightSocial: source.weightSocial,
              weightGrowth: source.weightGrowth,
              weightDomain: source.weightDomain,
              organizationId: orgId,
              createdById: userId,
            },
          });

          if (source.items.length > 0) {
            await tx.questionSetItem.createMany({
              data: source.items.map((item) => ({
                questionSetId: qs.id,
                questionId: item.questionId,
                order: item.order,
                isRequired: item.isRequired,
                customWeight: item.customWeight,
              })),
            });
          }

          return tx.questionSet.findUnique({
            where: { id: qs.id },
            include: {
              items: {
                orderBy: { order: "asc" },
                include: {
                  question: {
                    select: { id: true, text: true, dimension: true, type: true, phase: true },
                  },
                },
              },
            },
          });
        });

        return reply.status(201).send({ data: duplicate });
      } catch (err) {
        request.log.error(err, "questionSets.duplicate failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Soru seti kopyalanırken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );
};

export default questionSetRoutes;
