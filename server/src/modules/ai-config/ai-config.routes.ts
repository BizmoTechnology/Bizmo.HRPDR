import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/authenticate.js";
import { encrypt, decrypt } from "../../lib/crypto.js";
import { completeChat } from "../../lib/llm.js";
import { fetchAbacusRouteLLMModels } from "../../services/abacus-route-llm.service.js";
import { DEFAULT_HR_PDR_PROMPT, DEFAULT_PSYCHOLOGICAL_PROMPT } from "../../services/session-analysis.service.js";

const AiProviderEnum = z.enum(["CLAUDE", "OPENAI", "GEMINI", "ABACUS", "MOCK"]);

const DEFAULT_PURPOSE = "general";

const createSchema = z
  .object({
    provider: AiProviderEnum,
    modelName: z.string().trim().min(1).max(200),
    /** MOCK sağlayıcı için gerekmez */
    apiKey: z.string().trim().optional(),
    purpose: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => v || DEFAULT_PURPOSE),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    config: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.provider === "MOCK" || (v.apiKey?.length ?? 0) > 0, {
    message: "API anahtarı zorunlu",
    path: ["apiKey"],
  });

const updateSchema = z.object({
  provider: AiProviderEnum.optional(),
  modelName: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().trim().min(1).optional(),
  purpose: z.string().trim().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const listAbacusModelsSchema = z
  .object({
    apiKey: z.string().optional(),
    configId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const key = val.apiKey?.trim();
    const hasKey = !!key && key.length >= 8;
    const hasCfg = !!val.configId?.trim();
    if (!hasKey && !hasCfg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "En az 8 karakterlik apiKey veya kayıtlı yapılandırma kimliği (configId) gerekli",
      });
    }
  });

function maskApiKey(encryptedKey: string): string {
  try {
    const plain = decrypt(encryptedKey);
    if (plain.length <= 4) return "****";
    return "****" + plain.slice(-4);
  } catch {
    return "****";
  }
}

const aiConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRole(ROLE_GROUPS.aiConfig));

  // GET / — list AI configs for org
  fastify.get("/", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const configs = await prisma.aiConfig.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
      });

      const data = configs.map((c) => ({
        id: c.id,
        provider: c.provider,
        modelName: c.modelName,
        maskedApiKey: maskApiKey(c.encryptedApiKey),
        isActive: c.isActive,
        isDefault: c.isDefault,
        purpose: c.purpose,
        config: c.config,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "aiConfig.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "AI yapılandırmaları listelenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST / — create AI config
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = createSchema.parse(request.body);

      const encryptedApiKey = encrypt(body.apiKey ?? "");

      if (body.isDefault) {
        await prisma.aiConfig.updateMany({
          where: { organizationId: orgId, purpose: body.purpose, isDefault: true },
          data: { isDefault: false },
        });
      }

      const config = await prisma.aiConfig.create({
        data: {
          provider: body.provider,
          modelName: body.modelName,
          encryptedApiKey,
          purpose: body.purpose,
          isDefault: body.isDefault,
          isActive: body.isActive,
          config: body.config ? (body.config as Record<string, unknown>) as any : undefined,
          organizationId: orgId,
        },
      });

      return reply.status(201).send({
        data: {
          ...config,
          encryptedApiKey: undefined,
          maskedApiKey: maskApiKey(config.encryptedApiKey),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "aiConfig.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "AI yapılandırması oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /:id — update AI config
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const body = updateSchema.parse(request.body);

      const existing = await prisma.aiConfig.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "AI yapılandırması bulunamadı",
          traceId: request.traceId,
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.provider !== undefined) updateData.provider = body.provider;
      if (body.modelName !== undefined) updateData.modelName = body.modelName;
      if (body.purpose !== undefined) updateData.purpose = body.purpose;
      if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.config !== undefined) updateData.config = body.config;
      if (body.apiKey !== undefined) updateData.encryptedApiKey = encrypt(body.apiKey);

      if (body.isDefault) {
        const purpose = body.purpose ?? existing.purpose;
        await prisma.aiConfig.updateMany({
          where: { organizationId: orgId, purpose, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.aiConfig.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        data: {
          ...updated,
          encryptedApiKey: undefined,
          maskedApiKey: maskApiKey(updated.encryptedApiKey),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "aiConfig.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "AI yapılandırması güncellenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // DELETE /:id — delete AI config
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const existing = await prisma.aiConfig.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "AI yapılandırması bulunamadı",
          traceId: request.traceId,
        });
      }

      await prisma.aiConfig.delete({ where: { id } });

      return reply.send({ data: { ok: true } });
    } catch (err) {
      request.log.error(err, "aiConfig.delete failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "AI yapılandırması silinirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /:id/set-default — set as default for its purpose
  fastify.post<{ Params: { id: string } }>("/:id/set-default", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const existing = await prisma.aiConfig.findFirst({
        where: { id, organizationId: orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "AI yapılandırması bulunamadı",
          traceId: request.traceId,
        });
      }

      await prisma.$transaction([
        prisma.aiConfig.updateMany({
          where: { organizationId: orgId, purpose: existing.purpose, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.aiConfig.update({
          where: { id },
          data: { isDefault: true },
        }),
      ]);

      return reply.send({ data: { ok: true } });
    } catch (err) {
      request.log.error(err, "aiConfig.setDefault failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Varsayılan yapılandırma ayarlanırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /:id/test — bağlantı testi (kısa bir istem gönderir)
  fastify.post<{ Params: { id: string } }>("/:id/test", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cfg = await prisma.aiConfig.findFirst({
      where: { id: request.params.id, organizationId: orgId },
    });
    if (!cfg) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "AI yapılandırması bulunamadı",
        traceId: request.traceId,
      });
    }

    const startedAt = Date.now();
    try {
      const text = await completeChat({
        provider: cfg.provider,
        apiKey: cfg.provider === "MOCK" ? "" : decrypt(cfg.encryptedApiKey),
        modelName: cfg.modelName,
        system: "Bağlantı testi. Yalnızca 'OK' yaz.",
        user: "ping",
        responseFormat: "text",
      });
      return reply.send({
        data: { ok: true, latencyMs: Date.now() - startedAt, sample: text.slice(0, 200) },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bağlantı başarısız";
      request.log.warn({ err }, "aiConfig.test failed");
      return reply.status(502).send({
        code: "AI_CONNECTION_FAILED",
        message,
        traceId: request.traceId,
      });
    }
  });

  // POST /list-abacus-models — Abacus RouteLLM model listesi (Abacus API proxy)
  fastify.post("/list-abacus-models", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = listAbacusModelsSchema.parse(request.body ?? {});
      let apiKeyPlain: string;

      if (body.configId?.trim()) {
        const cfg = await prisma.aiConfig.findFirst({
          where: {
            id: body.configId.trim(),
            organizationId: orgId,
            provider: "ABACUS",
          },
        });
        if (!cfg) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Abacus yapılandırması bulunamadı",
            traceId: request.traceId,
          });
        }
        apiKeyPlain = decrypt(cfg.encryptedApiKey);
      } else {
        apiKeyPlain = body.apiKey!.trim();
      }

      const models = await fetchAbacusRouteLLMModels(apiKeyPlain);
      return reply.send({ data: models });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      const message =
        err instanceof Error ? err.message : "Abacus model listesi alınamadı";
      request.log.warn({ err }, "aiConfig.listAbacusModels failed");
      return reply.status(502).send({
        code: "ABACUS_MODELS_FAILED",
        message,
        traceId: request.traceId,
      });
    }
  });

  // ── Prompt Template Routes ──────────────────────────

  const promptTemplateSchema = z.object({
    type: z.enum(["HR_PDR_ANALYSIS", "PSYCHOLOGICAL_ANALYSIS"]),
    name: z.string().min(1).max(200),
    systemPrompt: z.string().min(10),
    isActive: z.boolean().optional().default(true),
    isDefault: z.boolean().optional().default(false),
  });

  const promptTemplateUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    systemPrompt: z.string().min(10).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  });

  // GET /prompts — list prompt templates
  fastify.get("/prompts", async (request, reply) => {
    const orgId = request.user.orgId!;
    try {
      const templates = await prisma.aiPromptTemplate.findMany({
        where: { organizationId: orgId },
        orderBy: [{ type: "asc" }, { isDefault: "desc" }, { updatedAt: "desc" }],
      });
      return reply.send({ data: templates });
    } catch (err) {
      request.log.error(err, "aiPromptTemplate.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Prompt şablonları listelenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // GET /prompts/defaults — get default prompts (built-in)
  fastify.get("/prompts/defaults", async (_request, reply) => {
    return reply.send({
      data: {
        HR_PDR_ANALYSIS: DEFAULT_HR_PDR_PROMPT,
        PSYCHOLOGICAL_ANALYSIS: DEFAULT_PSYCHOLOGICAL_PROMPT,
      },
    });
  });

  // POST /prompts — create prompt template
  fastify.post("/prompts", async (request, reply) => {
    const orgId = request.user.orgId!;
    try {
      const body = promptTemplateSchema.parse(request.body);

      if (body.isDefault) {
        await prisma.aiPromptTemplate.updateMany({
          where: { organizationId: orgId, type: body.type, isDefault: true },
          data: { isDefault: false },
        });
      }

      const template = await prisma.aiPromptTemplate.create({
        data: {
          type: body.type,
          name: body.name,
          systemPrompt: body.systemPrompt,
          isActive: body.isActive,
          isDefault: body.isDefault,
          organizationId: orgId,
        },
      });

      return reply.status(201).send({ data: template });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "aiPromptTemplate.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Prompt şablonu oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /prompts/:id — update prompt template
  fastify.put<{ Params: { id: string } }>("/prompts/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;
    try {
      const body = promptTemplateUpdateSchema.parse(request.body);

      const existing = await prisma.aiPromptTemplate.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Prompt şablonu bulunamadı",
          traceId: request.traceId,
        });
      }

      if (body.isDefault) {
        await prisma.aiPromptTemplate.updateMany({
          where: { organizationId: orgId, type: existing.type, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.aiPromptTemplate.update({
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
      request.log.error(err, "aiPromptTemplate.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Prompt şablonu güncellenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // DELETE /prompts/:id — delete prompt template
  fastify.delete<{ Params: { id: string } }>("/prompts/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;
    try {
      const existing = await prisma.aiPromptTemplate.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Prompt şablonu bulunamadı",
          traceId: request.traceId,
        });
      }

      await prisma.aiPromptTemplate.delete({ where: { id } });
      return reply.send({ data: { ok: true } });
    } catch (err) {
      request.log.error(err, "aiPromptTemplate.delete failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Prompt şablonu silinirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // GET /usage — AI usage stats
  fastify.get<{
    Querystring: { from?: string; to?: string };
  }>("/usage", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;
      const { from, to } = request.query;

      const dateFilter: Record<string, Date> = {};
      if (from && !Number.isNaN(Date.parse(from))) dateFilter.gte = new Date(from);
      if (to && !Number.isNaN(Date.parse(to))) dateFilter.lte = new Date(to);
      // Kullanım kayıtları organizasyona göre ayrılır (çok kiracılı)
      const createdAtWhere = {
        organizationId: orgId,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      };

      const [totalCalls, costAgg, byProvider, recentLogs] = await Promise.all([
        prisma.aiUsageLog.count({ where: createdAtWhere }),

        prisma.aiUsageLog.aggregate({
          where: createdAtWhere,
          _sum: { costUsd: true },
        }),

        prisma.aiUsageLog.groupBy({
          by: ["provider"],
          where: createdAtWhere,
          _count: { id: true },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        }),

        prisma.aiUsageLog.findMany({
          where: createdAtWhere,
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

      // Prisma Decimal JSON'da metne dönüşür; istemciye sayı olarak gönder
      const toNumber = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

      return reply.send({
        data: {
          totalCalls,
          totalCostUsd: toNumber(costAgg._sum.costUsd),
          byProvider: byProvider.map((bp) => ({
            provider: bp.provider,
            calls: bp._count.id,
            costUsd: toNumber(bp._sum.costUsd),
            inputTokens: bp._sum.inputTokens ?? 0,
            outputTokens: bp._sum.outputTokens ?? 0,
          })),
          recentLogs: recentLogs.map((log) => ({
            ...log,
            costUsd: log.costUsd === null ? null : Number(log.costUsd),
          })),
        },
      });
    } catch (err) {
      request.log.error(err, "aiConfig.usage failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "AI kullanım istatistikleri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });
};

export default aiConfigRoutes;
