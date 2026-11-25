import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { CareerPlan, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { shareOverrideSchema } from "../../lib/sharing.js";
import { aiRateLimit } from "../../lib/rate-limit.js";
import { requireRole, ROLE_GROUPS } from "../../middleware/authenticate.js";
import {
  CAREER_STEP_TYPES,
  MAX_HORIZON_MONTHS,
  MIN_HORIZON_MONTHS,
  clampHorizon,
  collectCareerInputs,
  generateCareerSuggestion,
  type CareerSuggestion,
} from "../../services/career-plan-ai.service.js";

/**
 * Kariyer planı uç noktaları. Kayıt yeri: `/api/personnel/:personnelId/career-plans`
 *
 *   GET    /                      Planlar (tüm sürümler, en yeni önce)
 *   GET    /sources               Öneride kullanılacak / kullanılmayacak veriler (LLM çağrısı yok)
 *   POST   /suggest               AI önerisi üretir ve açık taslağa yazar (yoksa taslak açar)
 *   GET    /:planId               Tek plan
 *   POST   /                      Yeni taslak (boş ya da `fromPlanId` sürümünden kopya)
 *   PATCH  /:planId               Taslak: hedef rol, ufuk, adımlar. Onaylı: yalnız adım durumu/notu
 *   POST   /:planId/apply-suggestion  Öneriyi taslağın adımlarına alır ("Taslağa al")
 *   POST   /:planId/approve       Taslağı onaylar; önceki onaylı sürüm arşivlenir
 *   POST   /:planId/archive       Planı arşivler
 *
 * Roller (development.md §8): okuma tüm panel rolleri; VIEWER yalnız onaylı/arşiv
 * planları görür ve AI içeriği (öneri, model, kaynak özeti) ona hiç gönderilmez.
 * Taslak düzenleme/arşivleme: manage. AI önerisi ve onay: analyze.
 */

const STEP_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const MAX_STEPS = 50;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Geçersiz tarih");

const stepSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1, "Adım başlığı boş olamaz").max(200),
  type: z.enum(CAREER_STEP_TYPES),
  targetDate: isoDate.nullable().optional().transform((v) => v ?? null),
  status: z.enum(STEP_STATUSES).default("TODO"),
  note: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});
export type CareerStep = z.infer<typeof stepSchema>;

const stepsSchema = z
  .array(stepSchema)
  .max(MAX_STEPS, `En fazla ${MAX_STEPS} adım eklenebilir`)
  .refine((steps) => new Set(steps.map((s) => s.id)).size === steps.length, "Adım kimlikleri benzersiz olmalı");

const horizonSchema = z.number().int().min(MIN_HORIZON_MONTHS).max(MAX_HORIZON_MONTHS);
const targetRoleSchema = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .optional()
  // Gönderilmeyen alan undefined kalır (PATCH'te mevcut değeri silmez); boş metin → null
  .transform((v) => (v === undefined ? undefined : v || null));

const createSchema = z.object({
  targetRole: targetRoleSchema,
  horizonMonths: horizonSchema.optional(),
  steps: stepsSchema.optional(),
  /** Var olan bir sürümden yeni taslak (revizyon) */
  fromPlanId: z.string().min(1).optional(),
});

const updateSchema = z
  .object({
    targetRole: targetRoleSchema,
    horizonMonths: horizonSchema.optional(),
    steps: stepsSchema.optional(),
    /** Personelle paylaşım: null = kurum varsayılanı (lib/sharing.ts resolveShare) */
    shareWithEmployee: shareOverrideSchema.optional(),
  })
  .strict();

const suggestSchema = z.object({
  targetRole: targetRoleSchema,
  horizonMonths: horizonSchema.optional(),
});

const applySchema = z.object({
  mode: z.enum(["replace", "append"]).default("replace"),
});

type Params = { personnelId: string };
type PlanParams = Params & { planId: string };

function canAnalyze(role: string | undefined): boolean {
  return (ROLE_GROUPS.analyze as readonly string[]).includes(role ?? "");
}

/** VIEWER'a AI içeriği gönderilmez (yalnız gizlenmez). */
function toPublicPlan(plan: CareerPlan, role: string | undefined) {
  if (canAnalyze(role)) return plan;
  return { ...plan, aiSuggestion: null, aiModel: null, aiSuggestedAt: null, sourceSummary: null };
}

async function assertPersonnel(organizationId: string, personnelId: string) {
  const p = await prisma.personnel.findFirst({
    where: { id: personnelId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!p) throw new HttpError("Personel bulunamadı", 404, "NOT_FOUND");
}

async function findPlan(organizationId: string, personnelId: string, planId: string) {
  const plan = await prisma.careerPlan.findFirst({
    where: { id: planId, personnelId, organizationId },
  });
  if (!plan) throw new HttpError("Kariyer planı bulunamadı", 404, "NOT_FOUND");
  return plan;
}

/** Aynı personelin plan sürümü/onayı işlemlerini sıraya sokar (sürüm numarası çakışmaz). */
async function lockPersonnel(tx: Prisma.TransactionClient, personnelId: string) {
  await tx.$queryRaw`SELECT id FROM "Personnel" WHERE id = ${personnelId} FOR UPDATE`;
}

async function nextVersion(tx: Prisma.TransactionClient, personnelId: string): Promise<number> {
  const last = await tx.careerPlan.findFirst({
    where: { personnelId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (last?.version ?? 0) + 1;
}

function readSteps(value: Prisma.JsonValue): CareerStep[] {
  const parsed = stepsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function addMonths(base: Date, months: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** Onaylı planda yalnızca ilerleme (durum, not) değişebilir; içerik için yeni sürüm açılır. */
function assertProgressOnly(before: CareerStep[], after: CareerStep[]) {
  const same =
    before.length === after.length &&
    before.every((b, i) => {
      const a = after[i]!;
      return a.id === b.id && a.title === b.title && a.type === b.type && a.targetDate === b.targetDate;
    });
  if (!same) {
    throw new HttpError(
      "Onaylı planda yalnızca adım durumu ve notu değişebilir. İçeriği değiştirmek için yeni sürüm açın.",
      409,
      "PLAN_LOCKED",
    );
  }
}

const careerPlansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // ── GET / — tüm sürümler
  fastify.get<{ Params: Params }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { personnelId } = request.params;
    await assertPersonnel(orgId, personnelId);
    const role = request.user.role;

    const plans = await prisma.careerPlan.findMany({
      where: {
        personnelId,
        organizationId: orgId,
        // VIEWER taslakları görmez: taslak, İK kararı verilmemiş (AI kaynaklı olabilecek) içeriktir
        ...(canAnalyze(role) ? {} : { status: { in: ["APPROVED", "ARCHIVED"] } }),
      },
      orderBy: { version: "desc" },
    });
    // Geçmişte kimin oluşturduğu/onayladığı (kimlik + ad; aynı kurumun kullanıcıları)
    const userIds = [...new Set(plans.flatMap((p) => [p.createdById, p.approvedById]).filter((v): v is string => !!v))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, organizationId: orgId },
          select: { id: true, name: true, role: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, { name: u.name, role: u.role }]));

    return reply.send({
      data: plans.map((p) => ({
        ...toPublicPlan(p, role),
        createdBy: p.createdById ? byId.get(p.createdById) ?? null : null,
        approvedBy: p.approvedById ? byId.get(p.approvedById) ?? null : null,
      })),
    });
  });

  // ── GET /sources — öneride hangi verilerin kullanılacağı (LLM çağrısı yok)
  fastify.get<{ Params: Params }>(
    "/sources",
    { preHandler: requireRole(ROLE_GROUPS.analyze) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId } = request.params;
      await assertPersonnel(orgId, personnelId);
      const { sources } = await collectCareerInputs({
        organizationId: orgId,
        personnelId,
        targetRole: null,
        horizonMonths: 12,
      });
      return reply.send({ data: sources });
    },
  );

  // ── POST /suggest — AI önerisi (ücretli LLM çağrısı)
  fastify.post<{ Params: Params }>(
    "/suggest",
    {
      preHandler: requireRole(ROLE_GROUPS.analyze),
      config: aiRateLimit("career-plan-suggest", 5),
    },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId } = request.params;
      const body = suggestSchema.parse(request.body ?? {});
      await assertPersonnel(orgId, personnelId);

      const draft = await prisma.careerPlan.findFirst({
        where: { personnelId, organizationId: orgId, status: "DRAFT" },
        orderBy: { version: "desc" },
      });

      const targetRole = body.targetRole ?? draft?.targetRole ?? null;
      const horizonMonths = body.horizonMonths ?? draft?.horizonMonths ?? 12;

      const { suggestion, sources, aiModel } = await generateCareerSuggestion({
        organizationId: orgId,
        personnelId,
        userId: request.user.sub,
        targetRole,
        horizonMonths,
      });

      const aiData = {
        aiSuggestion: suggestion as unknown as Prisma.InputJsonValue,
        aiModel,
        aiSuggestedAt: new Date(),
        sourceSummary: sources as unknown as Prisma.InputJsonValue,
      };

      const plan = await prisma.$transaction(async (tx) => {
        await lockPersonnel(tx, personnelId);
        // LLM beklenirken başka biri taslak açmış olabilir
        const current = await tx.careerPlan.findFirst({
          where: { personnelId, organizationId: orgId, status: "DRAFT" },
          orderBy: { version: "desc" },
        });
        if (current) {
          return tx.careerPlan.update({ where: { id: current.id }, data: aiData });
        }
        return tx.careerPlan.create({
          data: {
            personnelId,
            organizationId: orgId,
            status: "DRAFT",
            targetRole,
            horizonMonths,
            steps: [],
            version: await nextVersion(tx, personnelId),
            createdById: request.user.sub,
            ...aiData,
          },
        });
      });

      return reply.send({ data: plan });
    },
  );

  // ── GET /:planId
  fastify.get<{ Params: PlanParams }>("/:planId", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { personnelId, planId } = request.params;
    await assertPersonnel(orgId, personnelId);
    const plan = await findPlan(orgId, personnelId, planId);
    if (plan.status === "DRAFT" && !canAnalyze(request.user.role)) {
      throw new HttpError("Kariyer planı bulunamadı", 404, "NOT_FOUND");
    }
    return reply.send({ data: toPublicPlan(plan, request.user.role) });
  });

  // ── POST / — yeni taslak
  fastify.post<{ Params: Params }>(
    "/",
    { preHandler: requireRole(ROLE_GROUPS.manage) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId } = request.params;
      const body = createSchema.parse(request.body ?? {});
      await assertPersonnel(orgId, personnelId);

      const plan = await prisma.$transaction(async (tx) => {
        await lockPersonnel(tx, personnelId);
        const openDraft = await tx.careerPlan.findFirst({
          where: { personnelId, organizationId: orgId, status: "DRAFT" },
          select: { id: true },
        });
        if (openDraft) {
          throw new HttpError("Bu personelin açık bir taslağı var. Önce onu onaylayın ya da arşivleyin.", 409, "DRAFT_EXISTS");
        }

        let base: CareerPlan | null = null;
        if (body.fromPlanId) {
          base = await tx.careerPlan.findFirst({
            where: { id: body.fromPlanId, personnelId, organizationId: orgId },
          });
          if (!base) throw new HttpError("Kaynak plan bulunamadı", 404, "NOT_FOUND");
        }

        return tx.careerPlan.create({
          data: {
            personnelId,
            organizationId: orgId,
            status: "DRAFT",
            targetRole: body.targetRole ?? base?.targetRole ?? null,
            horizonMonths: body.horizonMonths ?? base?.horizonMonths ?? 12,
            steps: (body.steps ?? (base ? readSteps(base.steps) : [])) as Prisma.InputJsonValue,
            version: await nextVersion(tx, personnelId),
            basedOnVersion: base?.version ?? null,
            // Revizyon önceki sürümün paylaşım tercihini devralır
            shareWithEmployee: base?.shareWithEmployee ?? null,
            createdById: request.user.sub,
          },
        });
      });

      return reply.status(201).send({ data: plan });
    },
  );

  // ── PATCH /:planId
  fastify.patch<{ Params: PlanParams }>(
    "/:planId",
    { preHandler: requireRole(ROLE_GROUPS.manage) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId, planId } = request.params;
      const body = updateSchema.parse(request.body ?? {});
      await assertPersonnel(orgId, personnelId);
      const plan = await findPlan(orgId, personnelId, planId);

      if (plan.status === "ARCHIVED") {
        throw new HttpError("Arşivlenmiş plan düzenlenemez", 409, "PLAN_ARCHIVED");
      }

      const data: Prisma.CareerPlanUpdateInput = {};
      // Paylaşım tercihi taslakta da onaylı planda da değiştirilebilir
      if (body.shareWithEmployee !== undefined) data.shareWithEmployee = body.shareWithEmployee;
      if (plan.status === "APPROVED") {
        if (body.targetRole !== undefined || body.horizonMonths !== undefined) {
          throw new HttpError(
            "Onaylı planın hedefi değiştirilemez. Yeni sürüm açın.",
            409,
            "PLAN_LOCKED",
          );
        }
        if (body.steps) {
          assertProgressOnly(readSteps(plan.steps), body.steps);
          data.steps = body.steps as Prisma.InputJsonValue;
        }
      } else {
        if (body.targetRole !== undefined) data.targetRole = body.targetRole;
        if (body.horizonMonths !== undefined) data.horizonMonths = body.horizonMonths;
        if (body.steps) data.steps = body.steps as Prisma.InputJsonValue;
      }

      const updated = await prisma.careerPlan.update({ where: { id: plan.id }, data });
      return reply.send({ data: updated });
    },
  );

  // ── POST /:planId/apply-suggestion — "Taslağa al"
  fastify.post<{ Params: PlanParams }>(
    "/:planId/apply-suggestion",
    { preHandler: requireRole(ROLE_GROUPS.manage) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId, planId } = request.params;
      const { mode } = applySchema.parse(request.body ?? {});
      await assertPersonnel(orgId, personnelId);
      const plan = await findPlan(orgId, personnelId, planId);

      if (plan.status !== "DRAFT") {
        throw new HttpError("Öneri yalnızca taslağa alınabilir", 409, "NOT_DRAFT");
      }
      const suggestion = plan.aiSuggestion as unknown as CareerSuggestion | null;
      if (!suggestion || !Array.isArray(suggestion.steps)) {
        throw new HttpError("Bu taslakta alınacak AI önerisi yok", 409, "NO_SUGGESTION");
      }

      const base = new Date();
      const fromAi: CareerStep[] = suggestion.steps.map((s) => ({
        id: randomUUID(),
        title: s.title,
        type: s.type,
        targetDate: addMonths(base, s.monthOffset),
        status: "TODO",
        note: s.description,
      }));
      const steps = mode === "append" ? [...readSteps(plan.steps), ...fromAi] : fromAi;
      if (steps.length > MAX_STEPS) {
        throw new HttpError(`En fazla ${MAX_STEPS} adım eklenebilir`, 400, "TOO_MANY_STEPS");
      }

      const updated = await prisma.careerPlan.update({
        where: { id: plan.id },
        data: {
          steps: steps as Prisma.InputJsonValue,
          targetRole: mode === "replace" || !plan.targetRole ? suggestion.targetRole : plan.targetRole,
          horizonMonths:
            mode === "replace" ? clampHorizon(suggestion.horizonMonths, plan.horizonMonths) : plan.horizonMonths,
        },
      });
      return reply.send({ data: updated });
    },
  );

  // ── POST /:planId/approve — İK kararı
  fastify.post<{ Params: PlanParams }>(
    "/:planId/approve",
    { preHandler: requireRole(ROLE_GROUPS.analyze) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId, planId } = request.params;
      await assertPersonnel(orgId, personnelId);

      const approved = await prisma.$transaction(async (tx) => {
        await lockPersonnel(tx, personnelId);
        const plan = await tx.careerPlan.findFirst({
          where: { id: planId, personnelId, organizationId: orgId },
        });
        if (!plan) throw new HttpError("Kariyer planı bulunamadı", 404, "NOT_FOUND");
        if (plan.status !== "DRAFT") {
          throw new HttpError("Yalnızca taslak onaylanabilir", 409, "NOT_DRAFT");
        }
        if (!plan.targetRole) {
          throw new HttpError("Onay için hedef rol girin", 400, "TARGET_ROLE_REQUIRED");
        }
        if (readSteps(plan.steps).length === 0) {
          throw new HttpError("Onay için en az bir adım ekleyin", 400, "STEPS_REQUIRED");
        }

        const now = new Date();
        await tx.careerPlan.updateMany({
          where: { personnelId, organizationId: orgId, status: "APPROVED", id: { not: plan.id } },
          data: { status: "ARCHIVED", archivedAt: now },
        });
        return tx.careerPlan.update({
          where: { id: plan.id },
          data: { status: "APPROVED", approvedById: request.user.sub, approvedAt: now },
        });
      });

      return reply.send({ data: approved });
    },
  );

  // ── POST /:planId/archive
  fastify.post<{ Params: PlanParams }>(
    "/:planId/archive",
    { preHandler: requireRole(ROLE_GROUPS.manage) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { personnelId, planId } = request.params;
      await assertPersonnel(orgId, personnelId);
      const plan = await findPlan(orgId, personnelId, planId);
      if (plan.status === "ARCHIVED") {
        throw new HttpError("Plan zaten arşivde", 409, "PLAN_ARCHIVED");
      }
      const updated = await prisma.careerPlan.update({
        where: { id: plan.id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      return reply.send({ data: updated });
    },
  );
};

export default careerPlansRoutes;
