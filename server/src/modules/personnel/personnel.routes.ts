import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { isHttpError } from "../../lib/http-error.js";
import { assertDepartmentAndTeam } from "../../lib/tenant.js";
import { computeOverallScore, readDimensionScores } from "../../services/scoring.service.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const personnelStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]);
const personnelShiftEnum = z.enum([
  "NONE",
  "MORNING",
  "AFTERNOON",
  "NIGHT",
  "ROTATING",
]);

/** Formlardaki boş metinleri ("") null'a çevirir */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

const createSchema = z.object({
  employeeId: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: emptyToNull(z.string().max(30).nullable().optional()),
  position: z.string().trim().min(1).max(200),
  experienceYear: z.number().int().min(0).default(0),
  status: personnelStatusEnum.default("ACTIVE"),
  shift: personnelShiftEnum.default("NONE"),
  preferredLanguage: z.string().max(10).default("tr"),
  departmentId: emptyToNull(z.string().min(1).nullable().optional()),
  teamId: emptyToNull(z.string().min(1).nullable().optional()),
  hireDate: emptyToNull(z.coerce.date().nullable().optional()),
  birthDate: emptyToNull(z.coerce.date().nullable().optional()),
  notes: emptyToNull(z.string().max(2000).nullable().optional()),
  avatarUrl: emptyToNull(z.string().url().max(500).nullable().optional()),
  portalPassword: emptyToNull(z.string().min(6).max(128).nullable().optional()),
});

const portalPasswordSchema = z.object({
  password: z.string().min(6).max(128),
});

const updateSchema = createSchema.partial();

/** Şifre ve token özetlerini yanıttan çıkarır */
function toPublicPersonnel<T extends { portalPasswordHash: string | null; portalRefreshToken: string | null }>(
  p: T,
) {
  const { portalPasswordHash, portalRefreshToken: _rt, ...rest } = p;
  return { ...rest, hasPortalPassword: !!portalPasswordHash };
}

function parsePagination(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const raw = parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, raw), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const personnelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // GET /stats — personnel statistics (registered before parameterized routes)
  fastify.get("/stats", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const baseWhere = { organizationId: orgId, deletedAt: null };

      const [total, active, inactive, onLeave, byDepartmentRaw] =
        await Promise.all([
          prisma.personnel.count({ where: baseWhere }),
          prisma.personnel.count({
            where: { ...baseWhere, status: "ACTIVE" },
          }),
          prisma.personnel.count({
            where: { ...baseWhere, status: "INACTIVE" },
          }),
          prisma.personnel.count({
            where: { ...baseWhere, status: "ON_LEAVE" },
          }),
          prisma.personnel.groupBy({
            by: ["departmentId"],
            where: baseWhere,
            _count: { id: true },
          }),
        ]);

      const departmentIds = byDepartmentRaw
        .map((r) => r.departmentId)
        .filter(Boolean) as string[];

      const departments =
        departmentIds.length > 0
          ? await prisma.department.findMany({
              where: { id: { in: departmentIds } },
              select: { id: true, name: true },
            })
          : [];

      const deptMap = new Map(departments.map((d) => [d.id, d.name]));

      const byDepartment = byDepartmentRaw.map((r) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentId ? deptMap.get(r.departmentId) ?? null : null,
        count: r._count.id,
      }));

      return reply.send({
        data: { total, active, inactive, onLeave, byDepartment },
      });
    } catch (err) {
      request.log.error(err, "personnel.stats failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel istatistikleri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // GET / — list personnel (paginated)
  fastify.get<{
    Querystring: {
      search?: string;
      departmentId?: string;
      teamId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    };
  }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { search, departmentId, teamId, status } = request.query;
    const { page, pageSize, skip } = parsePagination(request.query);

    try {
      const where: Record<string, unknown> = {
        organizationId: orgId,
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { employeeId: { contains: search, mode: "insensitive" } },
        ];
      }
      if (departmentId) where.departmentId = departmentId;
      if (teamId) where.teamId = teamId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        prisma.personnel.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          include: {
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
          },
        }),
        prisma.personnel.count({ where }),
      ]);

      return reply.send({
        data: data.map(toPublicPersonnel),
        meta: { total, page, pageSize },
      });
    } catch (err) {
      request.log.error(err, "personnel.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel listesi alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST / — create personnel
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = createSchema.parse(request.body);
      await assertDepartmentAndTeam(orgId, body.departmentId, body.teamId);

      const { portalPassword, ...rest } = body;
      const portalPasswordHash = portalPassword
        ? await bcrypt.hash(portalPassword, 12)
        : undefined;

      const personnel = await prisma.personnel.create({
        data: {
          ...rest,
          organizationId: orgId,
          ...(portalPasswordHash && { portalPasswordHash }),
        },
      });

      return reply.status(201).send({ data: toPublicPersonnel(personnel) });
    } catch (err) {
      if (isHttpError(err)) throw err;
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return reply.status(409).send({
          code: "DUPLICATE_ENTRY",
          message: "Bu sicil numarası veya e-posta adresi zaten kayıtlı",
          traceId: request.traceId,
        });
      }
      request.log.error(err, "personnel.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // GET /:id — get personnel detail
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const personnel = await prisma.personnel.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        include: {
          department: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
          assessmentSessions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
              dimensionScores: true,
              assessment: { select: { id: true, title: true } },
              report: { select: { id: true } },
            },
          },
        },
      });

      if (!personnel) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }

      const { assessmentSessions, ...rest } = toPublicPersonnel(personnel);
      const sessions = assessmentSessions.map(({ report, ...s }) => ({
        ...s,
        reportId: report?.id ?? null,
        avgScore: computeOverallScore(readDimensionScores(s.dimensionScores)),
      }));
      const scored = sessions
        .filter((s) => s.status === "COMPLETED" && s.avgScore !== null)
        .map((s) => s.avgScore as number);
      const avgScore =
        scored.length > 0
          ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
          : null;

      return reply.send({ data: { ...rest, sessions, avgScore } });
    } catch (err) {
      request.log.error(err, "personnel.getById failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel bilgisi alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /:id — update personnel
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const body = updateSchema.parse(request.body);

      const existing = await prisma.personnel.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });

      if (!existing) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }

      // Departman değişip ekip gönderilmediyse eski ekip yeni departmana ait olmayabilir
      const nextDepartmentId =
        body.departmentId !== undefined ? body.departmentId : existing.departmentId;
      let nextTeamId = body.teamId !== undefined ? body.teamId : existing.teamId;
      if (body.departmentId !== undefined && body.teamId === undefined && nextTeamId) {
        const team = await prisma.team.findUnique({
          where: { id: nextTeamId },
          select: { departmentId: true },
        });
        if (team?.departmentId !== nextDepartmentId) nextTeamId = null;
      }
      await assertDepartmentAndTeam(orgId, nextDepartmentId, nextTeamId);

      const { portalPassword, ...rest } = body;
      const portalPasswordHash = portalPassword
        ? await bcrypt.hash(portalPassword, 12)
        : undefined;

      const updated = await prisma.personnel.update({
        where: { id },
        data: {
          ...rest,
          teamId: nextTeamId,
          ...(portalPasswordHash && { portalPasswordHash, portalRefreshToken: null }),
          // Pasife alınan personelin portal oturumu sonlandırılır
          ...(rest.status && rest.status !== "ACTIVE" && { portalRefreshToken: null }),
        },
      });

      return reply.send({ data: toPublicPersonnel(updated) });
    } catch (err) {
      if (isHttpError(err)) throw err;
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return reply.status(409).send({
          code: "DUPLICATE_ENTRY",
          message: "Bu sicil numarası veya e-posta adresi zaten kayıtlı",
          traceId: request.traceId,
        });
      }
      request.log.error(err, "personnel.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel güncellenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /:id/portal-password — portal şifresi oluştur/sıfırla
  fastify.post<{ Params: { id: string } }>(
    "/:id/portal-password",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { id } = request.params;
      const { password } = portalPasswordSchema.parse(request.body);

      const personnel = await prisma.personnel.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!personnel) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }

      await prisma.personnel.update({
        where: { id },
        data: {
          portalPasswordHash: await bcrypt.hash(password, 12),
          // Eski portal oturumları geçersiz olsun
          portalRefreshToken: null,
        },
      });

      return reply.send({ data: { ok: true } });
    },
  );

  // DELETE /:id — soft delete
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const { id } = request.params;

      try {
        const personnel = await prisma.personnel.findFirst({
          where: { id, organizationId: orgId, deletedAt: null },
        });

        if (!personnel) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Personel bulunamadı",
            traceId: request.traceId,
          });
        }

        await prisma.personnel.update({
          where: { id },
          data: { deletedAt: new Date(), portalRefreshToken: null },
        });

        return reply.send({ data: { ok: true } });
      } catch (err) {
        request.log.error(err, "personnel.delete failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Personel silinirken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );
};

export default personnelRoutes;
