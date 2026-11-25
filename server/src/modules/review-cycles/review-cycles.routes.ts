import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { isMailerConfigured } from "../../lib/mailer.js";
import { assertQuestionSetInOrg } from "../../lib/tenant.js";
import { shareOverrideSchema } from "../../lib/sharing.js";
import {
  requireRole,
  requireRoleForWrites,
  ROLE_GROUPS,
} from "../../middleware/authenticate.js";
import { buildQuestionSetSnapshot } from "../../services/session-questions.service.js";
import {
  DEFAULT_RATER_WEIGHTS,
  getSubjectResults,
  readRaterWeights,
  REVIEW_RELATIONS,
  toResultSummary,
} from "../../services/review-results.service.js";
import {
  deliverToRaters,
  suggestRaters,
  validateAssignmentPlan,
  type SubjectSuggestion,
} from "./review-cycles.service.js";

/** Anonimlik eşiğinin alt sınırı: daha azı grup ortalamasını kişiye indirger */
const MIN_ANONYMITY = 3;
/** Aynı değerlendiriciye bu süre içinde ikinci hatırlatma gönderilmez */
const REMIND_COOLDOWN_MS = 60 * 60 * 1000;

const relationEnum = z.enum(REVIEW_RELATIONS);

const weightsSchema = z
  .object({
    SELF: z.number().min(0).max(100),
    MANAGER: z.number().min(0).max(100),
    PEER: z.number().min(0).max(100),
    SUBORDINATE: z.number().min(0).max(100),
  })
  .refine((w) => w.MANAGER + w.PEER + w.SUBORDINATE > 0, {
    message: "Yönetici, eş düzey ve ast ağırlıklarından en az biri sıfırdan büyük olmalı",
  });

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

const cycleBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: emptyToNull(z.string().max(2000).nullable().optional()),
  frequency: z.enum(["ANNUAL", "SEMI_ANNUAL", "QUARTERLY", "ADHOC"]).default("ADHOC"),
  periodStart: emptyToNull(z.coerce.date().nullable().optional()),
  periodEnd: emptyToNull(z.coerce.date().nullable().optional()),
  dueAt: emptyToNull(z.coerce.date().nullable().optional()),
  questionSetId: z.string().min(1),
  raterWeights: weightsSchema.default(DEFAULT_RATER_WEIGHTS),
  anonymityMinRaters: z.number().int().min(MIN_ANONYMITY).max(20).default(3),
  includeSelf: z.boolean().default(true),
  /** Personelle paylaşım: null = kurum varsayılanı (lib/sharing.ts resolveShare) */
  shareWithEmployee: shareOverrideSchema.optional(),
});

const createSchema = cycleBaseSchema.refine(
  (c) => !c.periodStart || !c.periodEnd || c.periodStart <= c.periodEnd,
  { message: "Dönem başlangıcı bitişten sonra olamaz", path: ["periodEnd"] },
);
const updateSchema = cycleBaseSchema.partial();

const assignmentPlanSchema = z.object({
  subjects: z
    .array(
      z.object({
        personnelId: z.string().min(1),
        raters: z
          .array(z.object({ personnelId: z.string().min(1), relation: relationEnum }))
          .max(40),
      }),
    )
    .max(1000),
});

const suggestSchema = z.object({
  personnelIds: z.array(z.string().min(1)).min(1).max(1000),
  includeSelf: z.boolean().optional(),
});

const remindSchema = z
  .object({ assignmentIds: z.array(z.string().min(1)).max(5000).optional() })
  .default({});

const personSelect = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  position: true,
  department: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.PersonnelSelect;

async function findCycle(orgId: string, id: string) {
  const cycle = await prisma.reviewCycle.findFirst({ where: { id, organizationId: orgId } });
  if (!cycle) throw new HttpError("Değerlendirme dönemi bulunamadı", 404, "NOT_FOUND");
  return cycle;
}

function cycleDto<T extends { raterWeights: Prisma.JsonValue; questionSetSnapshot?: unknown }>(c: T) {
  const { questionSetSnapshot: _snap, ...rest } = c;
  return { ...rest, raterWeights: readRaterWeights(c.raterWeights) };
}

// ═══════════════════════════════════════════
// Panel route'ları (prefix: /api/review-cycles)
// ═══════════════════════════════════════════

export const reviewCycleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // ── GET / — Dönem listesi ──────────────────────
  fastify.get<{ Querystring: { status?: string } }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const status = z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional().parse(request.query.status || undefined);

    const cycles = await prisma.reviewCycle.findMany({
      where: { organizationId: orgId, ...(status && { status }) },
      orderBy: [{ createdAt: "desc" }],
      include: {
        questionSet: { select: { id: true, name: true } },
        _count: { select: { subjects: true } },
      },
    });

    const perCycle = await prisma.$queryRaw<
      Array<{ cycleId: string; total: bigint; completed: bigint }>
    >`
      SELECT s."cycleId" AS "cycleId",
             COUNT(a.id) FILTER (WHERE a.status <> 'DECLINED') AS total,
             COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed
      FROM "ReviewAssignment" a
      JOIN "ReviewSubject" s ON s.id = a."subjectId"
      JOIN "ReviewCycle" c ON c.id = s."cycleId"
      WHERE c."organizationId" = ${orgId}
      GROUP BY s."cycleId"`;
    const byCycle = new Map(perCycle.map((r) => [r.cycleId, r]));

    return reply.send({
      data: cycles.map((c) => {
        const s = byCycle.get(c.id);
        return {
          ...cycleDto(c),
          subjectCount: c._count.subjects,
          assignmentStats: {
            total: Number(s?.total ?? 0),
            completed: Number(s?.completed ?? 0),
          },
        };
      }),
    });
  });

  // ── POST /suggest-raters — Org şemasından öneri (kaydetmez) ──
  fastify.post("/suggest-raters", async (request, reply) => {
    const orgId = request.user.orgId!;
    const body = suggestSchema.parse(request.body);
    const data = await suggestRaters(orgId, body.personnelIds, {
      includeSelf: body.includeSelf ?? true,
    });
    return reply.send({ data });
  });

  // ── POST / — Taslak dönem oluştur ──────────────
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const body = createSchema.parse(request.body);
    await assertQuestionSetInOrg(orgId, body.questionSetId);

    const cycle = await prisma.reviewCycle.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        frequency: body.frequency,
        periodStart: body.periodStart ?? null,
        periodEnd: body.periodEnd ?? null,
        dueAt: body.dueAt ?? null,
        questionSetId: body.questionSetId,
        raterWeights: body.raterWeights,
        anonymityMinRaters: body.anonymityMinRaters,
        includeSelf: body.includeSelf,
        shareWithEmployee: body.shareWithEmployee ?? null,
        createdById: request.user.sub,
        organizationId: orgId,
      },
    });
    return reply.status(201).send({ data: cycleDto(cycle) });
  });

  // ── GET /:id — Dönem detayı (değerlendirilenler ve atamalar) ──
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await prisma.reviewCycle.findFirst({
      where: { id: request.params.id, organizationId: orgId },
      include: {
        questionSet: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        subjects: {
          orderBy: { createdAt: "asc" },
          include: {
            personnel: { select: personSelect },
            assignments: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                relation: true,
                status: true,
                startedAt: true,
                completedAt: true,
                reminderSentAt: true,
                reminderCount: true,
                rater: { select: personSelect },
              },
            },
          },
        },
      },
    });
    if (!cycle) throw new HttpError("Değerlendirme dönemi bulunamadı", 404, "NOT_FOUND");

    const snapshotQuestions = Array.isArray(
      (cycle.questionSetSnapshot as { questions?: unknown } | null)?.questions,
    )
      ? ((cycle.questionSetSnapshot as { questions: unknown[] }).questions.length)
      : null;

    return reply.send({
      data: {
        ...cycleDto(cycle),
        questionCount: snapshotQuestions,
        subjects: cycle.subjects.map(({ resultJson: _r, ...s }) => s),
      },
    });
  });

  // ── PUT /:id — Dönemi güncelle ─────────────────
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    const body = updateSchema.parse(request.body);

    if (cycle.status === "CLOSED") {
      // Kapanmış dönemde yalnız personelle paylaşım tercihi değişebilir
      const others = Object.entries(body).filter(([k, v]) => k !== "shareWithEmployee" && v !== undefined);
      if (others.length > 0) {
        throw new HttpError("Kapanmış dönemde yalnız paylaşım tercihi değiştirilebilir", 409, "CYCLE_CLOSED");
      }
    }
    if (cycle.status === "ACTIVE") {
      // Başlamış dönemde form, ağırlık ve anonimlik eşiği değişmez: aksi halde
      // verilmiş cevaplar farklı kurallarla raporlanır (ör. eşik düşürülüp grup açılır).
      const locked = (["questionSetId", "raterWeights", "anonymityMinRaters", "includeSelf"] as const)
        .filter((k) => body[k] !== undefined);
      if (locked.length > 0) {
        throw new HttpError(
          "Başlamış dönemde form, ağırlıklar ve anonimlik eşiği değiştirilemez",
          409,
          "CYCLE_LOCKED",
        );
      }
    }
    if (body.questionSetId) await assertQuestionSetInOrg(orgId, body.questionSetId);

    const periodStart = body.periodStart !== undefined ? body.periodStart : cycle.periodStart;
    const periodEnd = body.periodEnd !== undefined ? body.periodEnd : cycle.periodEnd;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new HttpError("Dönem başlangıcı bitişten sonra olamaz", 400, "VALIDATION_ERROR");
    }

    const updated = await prisma.reviewCycle.update({
      where: { id: cycle.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.frequency !== undefined && { frequency: body.frequency }),
        ...(body.periodStart !== undefined && { periodStart: body.periodStart }),
        ...(body.periodEnd !== undefined && { periodEnd: body.periodEnd }),
        ...(body.dueAt !== undefined && { dueAt: body.dueAt }),
        ...(body.questionSetId !== undefined && { questionSetId: body.questionSetId }),
        ...(body.raterWeights !== undefined && { raterWeights: body.raterWeights }),
        ...(body.anonymityMinRaters !== undefined && { anonymityMinRaters: body.anonymityMinRaters }),
        ...(body.includeSelf !== undefined && { includeSelf: body.includeSelf }),
        ...(body.shareWithEmployee !== undefined && { shareWithEmployee: body.shareWithEmployee }),
      },
    });
    return reply.send({ data: cycleDto(updated) });
  });

  // ── DELETE /:id — Yalnız taslak silinir ────────
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    if (cycle.status !== "DRAFT") {
      throw new HttpError("Yalnız taslak dönem silinebilir; başlamış dönemi kapatın", 409, "CYCLE_NOT_DRAFT");
    }
    await prisma.reviewCycle.delete({ where: { id: cycle.id } });
    return reply.send({ data: { id: cycle.id } });
  });

  // ── POST /:id/preview-assignments — Bu dönem için öneri (kaydetmez) ──
  fastify.post<{ Params: { id: string } }>("/:id/preview-assignments", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    const body = suggestSchema.parse(request.body);
    const data = await suggestRaters(orgId, body.personnelIds, {
      includeSelf: body.includeSelf ?? cycle.includeSelf,
    });
    return reply.send({ data });
  });

  // ── PUT /:id/assignments — Değerlendirilen ve değerlendiricileri toplu kaydet ──
  // Gövde dönemin istenen TAM halidir; listede olmayan değerlendirilenler çıkarılır.
  // Başlamış dönemde tamamlanmış değerlendirme kaldırılamaz ya da grubu değiştirilemez.
  fastify.put<{ Params: { id: string } }>("/:id/assignments", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    if (cycle.status === "CLOSED") {
      throw new HttpError("Kapanmış dönemde atama değiştirilemez", 409, "CYCLE_CLOSED");
    }
    const plan = assignmentPlanSchema.parse(request.body).subjects as SubjectSuggestion[];
    await validateAssignmentPlan(orgId, plan);

    const addedIds = await prisma.$transaction(async (tx) => {
      // Dönem satırı kilitlenir: eşzamanlı iki kayıt birbirinin üzerine yazmasın
      await tx.$queryRaw`SELECT id FROM "ReviewCycle" WHERE id = ${cycle.id} FOR UPDATE`;
      const existing = await tx.reviewSubject.findMany({
        where: { cycleId: cycle.id },
        include: { assignments: { select: { id: true, raterPersonnelId: true, relation: true, status: true } } },
      });
      const existingBySubject = new Map(existing.map((s) => [s.personnelId, s]));
      const desiredSubjects = new Set(plan.map((s) => s.personnelId));

      const removedSubjects = existing.filter((s) => !desiredSubjects.has(s.personnelId));
      for (const s of removedSubjects) {
        if (s.assignments.some((a) => a.status === "COMPLETED")) {
          throw new HttpError(
            "Tamamlanmış değerlendirmesi olan kişi dönemden çıkarılamaz",
            409,
            "COMPLETED_ASSIGNMENT",
          );
        }
      }
      if (removedSubjects.length > 0) {
        await tx.reviewSubject.deleteMany({ where: { id: { in: removedSubjects.map((s) => s.id) } } });
      }

      const added: string[] = [];
      for (const s of plan) {
        let subject = existingBySubject.get(s.personnelId);
        if (!subject) {
          const created = await tx.reviewSubject.create({
            data: { cycleId: cycle.id, personnelId: s.personnelId },
          });
          subject = { ...created, assignments: [] };
        }
        const desired = new Map(s.raters.map((r) => [r.personnelId, r.relation]));
        const current = new Map(subject.assignments.map((a) => [a.raterPersonnelId, a]));

        const toDelete: string[] = [];
        for (const a of subject.assignments) {
          const rel = desired.get(a.raterPersonnelId);
          if (rel === undefined) {
            // Reddedilen atama panoda görünmez; plandan düşmesi silinmesi anlamına gelmez
            if (a.status === "DECLINED") continue;
            if (a.status === "COMPLETED") {
              throw new HttpError("Tamamlanmış değerlendirme kaldırılamaz", 409, "COMPLETED_ASSIGNMENT");
            }
            toDelete.push(a.id);
          } else if (a.status === "DECLINED") {
            // İK reddeden kişiyi yeniden ekledi: görev baştan açılır ve yeniden davet edilir
            await tx.reviewAssignment.update({
              where: { id: a.id },
              data: { relation: rel, status: "NOT_STARTED", declinedAt: null, startedAt: null },
            });
            added.push(a.id);
          } else if (rel !== a.relation) {
            if (a.status === "COMPLETED") {
              throw new HttpError(
                "Tamamlanmış değerlendirmenin grubu değiştirilemez",
                409,
                "COMPLETED_ASSIGNMENT",
              );
            }
            await tx.reviewAssignment.update({ where: { id: a.id }, data: { relation: rel } });
          }
        }
        if (toDelete.length > 0) {
          await tx.reviewAssignment.deleteMany({ where: { id: { in: toDelete } } });
        }
        for (const r of s.raters) {
          if (current.has(r.personnelId)) continue;
          const a = await tx.reviewAssignment.create({
            data: { subjectId: subject.id, raterPersonnelId: r.personnelId, relation: r.relation },
            select: { id: true },
          });
          added.push(a.id);
        }
      }
      return added;
    });

    // Başlamış dönemde yeni eklenen değerlendiricilere davet
    let delivery = null;
    if (cycle.status === "ACTIVE" && addedIds.length > 0) {
      const assignments = await prisma.reviewAssignment.findMany({
        where: { id: { in: addedIds } },
        select: {
          id: true,
          relation: true,
          rater: { select: { id: true, firstName: true, email: true } },
          subject: { select: { personnel: { select: { firstName: true, lastName: true } } } },
        },
      });
      delivery = await deliverToRaters({ kind: "INVITE", cycle, assignments, log: request.log });
    }

    return reply.send({ data: { added: addedIds.length, delivery } });
  });

  // ── POST /:id/activate — Dönemi başlat ─────────
  fastify.post<{ Params: { id: string } }>("/:id/activate", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    if (cycle.status !== "DRAFT") {
      throw new HttpError("Yalnız taslak dönem başlatılabilir", 409, "CYCLE_NOT_DRAFT");
    }

    const assignmentCount = await prisma.reviewAssignment.count({
      where: { subject: { cycleId: cycle.id } },
    });
    if (assignmentCount === 0) {
      throw new HttpError("Başlatmak için en az bir değerlendirici atayın", 409, "NO_ASSIGNMENTS");
    }

    const snapshot = await buildQuestionSetSnapshot(cycle.questionSetId);
    if (!snapshot.questions.some((q) => q.type === "SCALE")) {
      throw new HttpError(
        "Seçilen soru setinde ölçek (SCALE) sorusu yok; 360° puanı hesaplanamaz",
        409,
        "NO_SCALE_QUESTIONS",
      );
    }

    const now = new Date();
    const res = await prisma.reviewCycle.updateMany({
      where: { id: cycle.id, status: "DRAFT" },
      data: {
        status: "ACTIVE",
        activatedAt: now,
        questionSetSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    if (res.count === 0) throw new HttpError("Dönem zaten başlatılmış", 409, "CONFLICT");

    const assignments = await prisma.reviewAssignment.findMany({
      where: { subject: { cycleId: cycle.id } },
      select: {
        id: true,
        relation: true,
        rater: { select: { id: true, firstName: true, email: true } },
        subject: { select: { personnel: { select: { firstName: true, lastName: true } } } },
      },
    });
    const delivery = await deliverToRaters({ kind: "INVITE", cycle, assignments, log: request.log });

    return reply.send({ data: { id: cycle.id, status: "ACTIVE", activatedAt: now, delivery } });
  });

  // ── POST /:id/close — Dönemi kapat ve sonuçları dondur ──
  fastify.post<{ Params: { id: string } }>("/:id/close", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    if (cycle.status !== "ACTIVE") {
      throw new HttpError("Yalnız devam eden dönem kapatılabilir", 409, "CYCLE_NOT_ACTIVE");
    }
    const now = new Date();
    const res = await prisma.reviewCycle.updateMany({
      where: { id: cycle.id, status: "ACTIVE" },
      data: { status: "CLOSED", closedAt: now },
    });
    if (res.count === 0) throw new HttpError("Dönem zaten kapatılmış", 409, "CONFLICT");

    // Kapanıştaki anonim özet (diğer modüller geçmiş/trend için okur)
    const subjects = await prisma.reviewSubject.findMany({
      where: { cycleId: cycle.id },
      select: { id: true },
    });
    for (const s of subjects) {
      const results = await getSubjectResults(s.id, {
        viewer: { kind: "admin", organizationId: orgId, role: "ADMIN" },
      });
      await prisma.reviewSubject.update({
        where: { id: s.id },
        data: {
          resultJson: toResultSummary(results) as unknown as Prisma.InputJsonValue,
          status: "CLOSED",
        },
      });
    }

    return reply.send({ data: { id: cycle.id, status: "CLOSED", closedAt: now } });
  });

  // ── GET /:id/dashboard — İlerleme, departman kırılımı, bekleyenler ──
  fastify.get<{ Params: { id: string } }>("/:id/dashboard", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);

    const assignments = await prisma.reviewAssignment.findMany({
      where: { subject: { cycleId: cycle.id } },
      select: {
        id: true,
        relation: true,
        status: true,
        reminderSentAt: true,
        reminderCount: true,
        startedAt: true,
        rater: { select: personSelect },
        subject: { select: { id: true, personnel: { select: personSelect } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    const isOverdue = !!cycle.dueAt && cycle.dueAt < now && cycle.status === "ACTIVE";
    const active = assignments.filter((a) => a.status !== "DECLINED");
    const count = (s: string) => assignments.filter((a) => a.status === s).length;

    const deptMap = new Map<
      string,
      { departmentId: string | null; name: string; subjects: Set<string>; total: number; completed: number }
    >();
    for (const a of active) {
      const dept = a.subject.personnel.department;
      const key = dept?.id ?? "none";
      const row = deptMap.get(key) ?? {
        departmentId: dept?.id ?? null,
        name: dept?.name ?? "Departmansız",
        subjects: new Set<string>(),
        total: 0,
        completed: 0,
      };
      row.subjects.add(a.subject.id);
      row.total += 1;
      if (a.status === "COMPLETED") row.completed += 1;
      deptMap.set(key, row);
    }

    const pending = active
      .filter((a) => a.status === "NOT_STARTED" || a.status === "IN_PROGRESS")
      .map((a) => ({
        assignmentId: a.id,
        relation: a.relation,
        status: a.status,
        reminderSentAt: a.reminderSentAt,
        reminderCount: a.reminderCount,
        startedAt: a.startedAt,
        rater: a.rater,
        subject: { id: a.subject.id, personnel: a.subject.personnel },
      }));

    return reply.send({
      data: {
        cycle: { id: cycle.id, name: cycle.name, status: cycle.status, dueAt: cycle.dueAt },
        isOverdue,
        mailConfigured: isMailerConfigured(),
        totals: {
          subjects: new Set(assignments.map((a) => a.subject.id)).size,
          assignments: active.length,
          completed: count("COMPLETED"),
          inProgress: count("IN_PROGRESS"),
          notStarted: count("NOT_STARTED"),
          declined: count("DECLINED"),
        },
        byDepartment: [...deptMap.values()]
          .map((d) => ({
            departmentId: d.departmentId,
            name: d.name,
            subjects: d.subjects.size,
            total: d.total,
            completed: d.completed,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "tr")),
        pending,
      },
    });
  });

  // ── POST /:id/remind — Bekleyen değerlendiricilere hatırlatma ──
  fastify.post<{ Params: { id: string } }>("/:id/remind", async (request, reply) => {
    const orgId = request.user.orgId!;
    const cycle = await findCycle(orgId, request.params.id);
    if (cycle.status !== "ACTIVE") {
      throw new HttpError("Hatırlatma yalnız devam eden dönemde gönderilir", 409, "CYCLE_NOT_ACTIVE");
    }
    const body = remindSchema.parse(request.body ?? {});

    const candidates = await prisma.reviewAssignment.findMany({
      where: {
        subject: { cycleId: cycle.id },
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        ...(body.assignmentIds && { id: { in: body.assignmentIds } }),
      },
      select: {
        id: true,
        relation: true,
        reminderSentAt: true,
        rater: { select: { id: true, firstName: true, email: true } },
        subject: { select: { personnel: { select: { firstName: true, lastName: true } } } },
      },
    });

    const cutoff = Date.now() - REMIND_COOLDOWN_MS;
    const targets = candidates.filter((a) => !a.reminderSentAt || a.reminderSentAt.getTime() < cutoff);
    const skippedRecent = candidates.length - targets.length;

    const delivery = await deliverToRaters({ kind: "REMIND", cycle, assignments: targets, log: request.log });
    if (targets.length > 0) {
      await prisma.reviewAssignment.updateMany({
        where: { id: { in: targets.map((a) => a.id) } },
        data: { reminderSentAt: new Date(), reminderCount: { increment: 1 } },
      });
    }

    return reply.send({
      data: { targeted: targets.length, skippedRecent, delivery },
    });
  });

  // ── GET /:id/subjects/:sid/results — 360° bireysel sonuç (anonim) ──
  fastify.get<{ Params: { id: string; sid: string } }>(
    "/:id/subjects/:sid/results",
    { preHandler: requireRole(ROLE_GROUPS.analyze) },
    async (request, reply) => {
      const orgId = request.user.orgId!;
      await findCycle(orgId, request.params.id);
      const subject = await prisma.reviewSubject.findFirst({
        where: { id: request.params.sid, cycleId: request.params.id },
        select: { id: true },
      });
      if (!subject) throw new HttpError("Değerlendirme sonucu bulunamadı", 404, "NOT_FOUND");
      const data = await getSubjectResults(subject.id, {
        viewer: { kind: "admin", organizationId: orgId, role: request.user.role },
      });
      return reply.send({ data });
    },
  );

  // ── POST|DELETE /:id/subjects/:sid/release — Sonucu yayınla / geri al ──
  const setRelease = (released: boolean) =>
    async (request: { params: { id: string; sid: string }; user: { orgId?: string; sub: string } }) => {
      const orgId = request.user.orgId!;
      const cycle = await findCycle(orgId, request.params.id);
      if (cycle.status !== "CLOSED") {
        throw new HttpError(
          "Sonuç dönem kapandıktan sonra yayınlanır; önce dönemi kapatın",
          409,
          "CYCLE_NOT_CLOSED",
        );
      }
      const subject = await prisma.reviewSubject.findFirst({
        where: { id: request.params.sid, cycleId: cycle.id },
        select: { id: true },
      });
      if (!subject) throw new HttpError("Değerlendirilen bulunamadı", 404, "NOT_FOUND");
      return prisma.reviewSubject.update({
        where: { id: subject.id },
        data: released
          ? { status: "RELEASED", releasedAt: new Date(), releasedById: request.user.sub }
          : { status: "CLOSED", releasedAt: null, releasedById: null },
        select: { id: true, status: true, releasedAt: true },
      });
    };

  fastify.post<{ Params: { id: string; sid: string } }>(
    "/:id/subjects/:sid/release",
    async (request, reply) => reply.send({ data: await setRelease(true)(request) }),
  );
  fastify.delete<{ Params: { id: string; sid: string } }>(
    "/:id/subjects/:sid/release",
    async (request, reply) => reply.send({ data: await setRelease(false)(request) }),
  );
};
