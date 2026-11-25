import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import {
  buildQuestionSetSnapshot,
  parseSnapshot,
  toPortalQuestion,
  type QuestionSetSnapshot,
  type SnapshotQuestion,
} from "../../services/session-questions.service.js";

const answerSchema = z.object({
  questionId: z.string().min(1),
  scaleValue: z.coerce.number().int().nullable().optional(),
  choiceKey: z.string().max(50).nullable().optional(),
  textAnswer: z.string().max(5000).nullable().optional(),
  durationSec: z.coerce.number().int().min(0).max(86_400).optional(),
});

/** Değerlendiricinin şu anda görebileceği atama: kendisinin, dönem devam ediyor */
function myAssignmentWhere(raterId: string) {
  return {
    raterPersonnelId: raterId,
    status: { not: "DECLINED" as const },
    subject: { cycle: { status: "ACTIVE" as const }, personnel: { deletedAt: null } },
  };
}

async function assignmentSnapshot(a: {
  questionSetSnapshot: Prisma.JsonValue | null;
  subject: { cycle: { questionSetSnapshot: Prisma.JsonValue | null; questionSetId: string } };
}): Promise<QuestionSetSnapshot> {
  return (
    parseSnapshot(a.questionSetSnapshot) ??
    parseSnapshot(a.subject.cycle.questionSetSnapshot) ??
    (await buildQuestionSetSnapshot(a.subject.cycle.questionSetId))
  );
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

const subjectSelect = {
  id: true,
  personnel: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      department: { select: { name: true } },
    },
  },
  cycle: {
    select: {
      id: true,
      name: true,
      description: true,
      dueAt: true,
      anonymityMinRaters: true,
      questionSetSnapshot: true,
      questionSetId: true,
    },
  },
} satisfies Prisma.ReviewSubjectSelect;

// ═══════════════════════════════════════════
// Portal route'ları (prefix: /api/reviews/portal) — değerlendirici
// ═══════════════════════════════════════════

export const reviewPortalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticatePortal);

  // ── GET /assignments — Değerlendirmem gereken kişiler ──
  fastify.get("/assignments", async (request, reply) => {
    const me = request.user.sub;
    const rows = await prisma.reviewAssignment.findMany({
      where: myAssignmentWhere(me),
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        relation: true,
        status: true,
        startedAt: true,
        completedAt: true,
        questionSetSnapshot: true,
        subject: { select: subjectSelect },
        _count: { select: { answers: true } },
      },
    });

    const notices = await prisma.notification.findMany({
      where: { personnelId: me, readAt: null, type: { in: ["REVIEW_INVITE", "REVIEW_REMINDER"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, title: true, body: true, createdAt: true },
    });

    const data = await Promise.all(
      rows.map(async (a) => {
        const snap = await assignmentSnapshot(a);
        const { cycle, personnel } = a.subject;
        return {
          id: a.id,
          relation: a.relation,
          status: a.status,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          questionCount: snap.questions.length,
          answeredCount: a._count.answers,
          subject: {
            firstName: personnel.firstName,
            lastName: personnel.lastName,
            position: personnel.position,
            department: personnel.department?.name ?? null,
          },
          cycle: { id: cycle.id, name: cycle.name, dueAt: cycle.dueAt },
        };
      }),
    );

    return reply.send({ data, meta: { notices } });
  });

  // ── POST /notices/read — 360° bildirimlerini okundu say ──
  fastify.post("/notices/read", async (request, reply) => {
    const res = await prisma.notification.updateMany({
      where: {
        personnelId: request.user.sub,
        readAt: null,
        type: { in: ["REVIEW_INVITE", "REVIEW_REMINDER"] },
      },
      data: { readAt: new Date() },
    });
    return reply.send({ data: { updated: res.count } });
  });

  // ── GET /assignments/:id — Form ve kayıtlı cevaplarım ──
  fastify.get<{ Params: { id: string } }>("/assignments/:id", async (request, reply) => {
    const a = await prisma.reviewAssignment.findFirst({
      where: { id: request.params.id, ...myAssignmentWhere(request.user.sub) },
      select: {
        id: true,
        relation: true,
        status: true,
        startedAt: true,
        completedAt: true,
        questionSetSnapshot: true,
        subject: { select: subjectSelect },
        answers: {
          select: { questionId: true, scaleValue: true, choiceKey: true, textAnswer: true },
        },
      },
    });
    if (!a) throw new HttpError("Değerlendirme bulunamadı", 404, "NOT_FOUND");

    const snap = await assignmentSnapshot(a);
    const { cycle, personnel } = a.subject;
    return reply.send({
      data: {
        id: a.id,
        relation: a.relation,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        subject: {
          firstName: personnel.firstName,
          lastName: personnel.lastName,
          position: personnel.position,
          department: personnel.department?.name ?? null,
        },
        cycle: {
          id: cycle.id,
          name: cycle.name,
          description: cycle.description,
          dueAt: cycle.dueAt,
          anonymityMinRaters: cycle.anonymityMinRaters,
        },
        questions: snap.questions.map(toPortalQuestion),
        answers: a.answers,
      },
    });
  });

  // ── POST /assignments/:id/start ──
  fastify.post<{ Params: { id: string } }>("/assignments/:id/start", async (request, reply) => {
    const a = await prisma.reviewAssignment.findFirst({
      where: { id: request.params.id, ...myAssignmentWhere(request.user.sub) },
      select: {
        id: true,
        status: true,
        startedAt: true,
        questionSetSnapshot: true,
        subject: { select: { cycle: { select: { questionSetSnapshot: true, questionSetId: true } } } },
      },
    });
    if (!a) throw new HttpError("Değerlendirme bulunamadı", 404, "NOT_FOUND");
    if (a.status === "COMPLETED") {
      throw new HttpError("Bu değerlendirmeyi zaten tamamladınız", 409, "ALREADY_COMPLETED");
    }
    if (a.status === "IN_PROGRESS") {
      return reply.send({ data: { id: a.id, status: a.status, startedAt: a.startedAt } });
    }

    const snap = await assignmentSnapshot(a);
    const now = new Date();
    const res = await prisma.reviewAssignment.updateMany({
      where: { id: a.id, status: "NOT_STARTED" },
      data: {
        status: "IN_PROGRESS",
        startedAt: now,
        questionSetSnapshot: snap as unknown as Prisma.InputJsonValue,
      },
    });
    if (res.count === 0) {
      const fresh = await prisma.reviewAssignment.findUnique({
        where: { id: a.id },
        select: { status: true, startedAt: true },
      });
      return reply.send({ data: { id: a.id, ...fresh } });
    }
    return reply.send({ data: { id: a.id, status: "IN_PROGRESS", startedAt: now } });
  });

  // ── POST /assignments/:id/answer ──
  fastify.post<{ Params: { id: string } }>("/assignments/:id/answer", async (request, reply) => {
    const body = answerSchema.parse(request.body);
    const a = await prisma.reviewAssignment.findFirst({
      where: { id: request.params.id, ...myAssignmentWhere(request.user.sub), status: "IN_PROGRESS" },
      select: {
        id: true,
        questionSetSnapshot: true,
        subject: { select: { cycle: { select: { questionSetSnapshot: true, questionSetId: true } } } },
      },
    });
    if (!a) throw new HttpError("Devam eden değerlendirme bulunamadı", 404, "NOT_FOUND");

    const snap = await assignmentSnapshot(a);
    const q = snap.questions.find((x) => x.id === body.questionId);
    if (!q) throw new HttpError("Soru bu forma ait değil", 400, "INVALID_QUESTION");

    let scaleValue: number | null = null;
    let choiceKey: string | null = null;
    let textAnswer: string | null = null;
    if (q.type === "SCALE") {
      const min = q.minScale ?? 1;
      const max = q.maxScale ?? 10;
      const v = body.scaleValue;
      if (v === null || v === undefined || v < min || v > max) {
        throw new HttpError(`Lütfen ${min}-${max} arasında bir değer seçin`, 400, "INVALID_ANSWER");
      }
      scaleValue = v;
    } else if (q.type === "MULTIPLE_CHOICE") {
      const k = body.choiceKey;
      if (!k || (q.options && !Object.hasOwn(q.options, k))) {
        throw new HttpError("Lütfen seçeneklerden birini seçin", 400, "INVALID_ANSWER");
      }
      choiceKey = k;
    } else {
      textAnswer = body.textAnswer?.trim() || null;
      // İsteğe bağlı açık uçlu soru boş bırakılabilir: kayıt silinir
      if (!textAnswer) {
        if (q.isRequired) throw new HttpError("Cevap boş bırakılamaz", 400, "INVALID_ANSWER");
        await prisma.reviewAnswer.deleteMany({ where: { assignmentId: a.id, questionId: q.id } });
        return reply.send({ data: { questionId: q.id, cleared: true } });
      }
    }

    const data = {
      scaleValue,
      choiceKey,
      textAnswer,
      durationSec: body.durationSec ?? null,
      answeredAt: new Date(),
    };
    const saved = await prisma.reviewAnswer.upsert({
      where: { assignmentId_questionId: { assignmentId: a.id, questionId: q.id } },
      create: { assignmentId: a.id, questionId: q.id, ...data },
      update: data,
      select: { questionId: true, scaleValue: true, choiceKey: true, textAnswer: true },
    });
    return reply.send({ data: saved });
  });

  // ── POST /assignments/:id/complete ──
  fastify.post<{ Params: { id: string } }>("/assignments/:id/complete", async (request, reply) => {
    const a = await prisma.reviewAssignment.findFirst({
      where: { id: request.params.id, ...myAssignmentWhere(request.user.sub), status: "IN_PROGRESS" },
      select: {
        id: true,
        questionSetSnapshot: true,
        subject: { select: { cycle: { select: { questionSetSnapshot: true, questionSetId: true } } } },
        answers: { select: { questionId: true, scaleValue: true, choiceKey: true, textAnswer: true } },
      },
    });
    if (!a) throw new HttpError("Devam eden değerlendirme bulunamadı", 404, "NOT_FOUND");

    const snap = await assignmentSnapshot(a);
    const byQ = new Map(a.answers.map((x) => [x.questionId, x]));
    const missing = snap.questions.filter((q) => q.isRequired && !isAnswered(q, byQ.get(q.id)));
    if (missing.length > 0) {
      return reply.status(409).send({
        code: "MISSING_ANSWERS",
        message: `${missing.length} zorunlu soru cevaplanmadı`,
        details: { questionIds: missing.map((q) => q.id) },
        traceId: request.traceId,
      });
    }

    const now = new Date();
    const res = await prisma.reviewAssignment.updateMany({
      where: { id: a.id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (res.count === 0) throw new HttpError("Değerlendirme zaten tamamlanmış", 409, "CONFLICT");
    return reply.send({ data: { id: a.id, status: "COMPLETED", completedAt: now } });
  });

  // ── POST /assignments/:id/decline — "Bu kişiyi değerlendiremem" ──
  fastify.post<{ Params: { id: string } }>("/assignments/:id/decline", async (request, reply) => {
    const a = await prisma.reviewAssignment.findFirst({
      where: { id: request.params.id, ...myAssignmentWhere(request.user.sub) },
      select: { id: true, status: true, relation: true },
    });
    if (!a) throw new HttpError("Değerlendirme bulunamadı", 404, "NOT_FOUND");
    if (a.relation === "SELF") {
      throw new HttpError("Öz değerlendirme reddedilemez", 409, "SELF_NOT_DECLINABLE");
    }
    if (a.status === "COMPLETED") {
      throw new HttpError("Tamamlanmış değerlendirme reddedilemez", 409, "ALREADY_COMPLETED");
    }
    await prisma.$transaction([
      prisma.reviewAnswer.deleteMany({ where: { assignmentId: a.id } }),
      prisma.reviewAssignment.update({
        where: { id: a.id },
        data: { status: "DECLINED", declinedAt: new Date() },
      }),
    ]);
    return reply.send({ data: { id: a.id, status: "DECLINED" } });
  });
};
