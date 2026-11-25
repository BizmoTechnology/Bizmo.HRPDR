import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { isHttpError } from "../../lib/http-error.js";
import { assertDepartmentAndTeam } from "../../lib/tenant.js";
import {
  computeOverallScore,
  dimensionWeightMap,
  readDimensionScores,
} from "../../services/scoring.service.js";
import { parseSnapshot } from "../../services/session-questions.service.js";
import { getPersonnelHistory } from "../../services/personnel-history.service.js";
import {
  requireRoleForWrites,
  ROLE_GROUPS,
  type UserRole,
} from "../../middleware/authenticate.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Formdan seçilebilen durumlar. TERMINATED yalnız `POST /:id/terminate` ile atanır
 * (tarih + neden zorunlu), geri dönüş `POST /:id/reactivate` ile.
 */
const personnelStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]);
const LIST_STATUS_FILTERS = new Set(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]);

/** Arşiv (soft-deleted kayıtlar) yalnız bu rollere açık */
const ARCHIVE_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"];

const terminationReasonEnum = z.enum([
  "RESIGNATION",
  "DISMISSAL",
  "MUTUAL_AGREEMENT",
  "CONTRACT_END",
  "RETIREMENT",
  "OTHER",
]);

/** Ayrılan personelin açık HR/PDR oturumları bu durumlardan EXPIRED'a çekilir */
const OPEN_SESSION_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PAUSED"] as const;
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
  // Yalnızca http(s): javascript:/data: bağlantıları kabul edilmez
  avatarUrl: emptyToNull(
    z.string().url().max(500).regex(/^https?:\/\//i, "Geçerli bir http(s) adresi girin").nullable().optional(),
  ),
  portalPassword: emptyToNull(z.string().min(6).max(128).nullable().optional()),
});

const portalPasswordSchema = z.object({
  password: z.string().min(6).max(128),
});

const updateSchema = createSchema.partial();

const terminateSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: "Geçerli bir ayrılış tarihi girin" }) }),
  reason: z.enum(terminationReasonEnum.options, {
    errorMap: () => ({ message: "Geçerli bir ayrılış nedeni seçin" }),
  }),
  note: emptyToNull(z.string().trim().max(2000).nullable().optional()),
  /** Kişi yöneticiyse doğrudan astlarının managerId'si boşaltılsın mı (İK onayıyla) */
  clearDirectReports: z.boolean().optional(),
});

function hasRole(role: string | undefined, roles: readonly string[]) {
  return !!role && roles.includes(role);
}

/** Ayrılan personelin kaydı salt okunurdur; değişiklik için önce yeniden etkinleştirilir */
const TERMINATED_READ_ONLY = {
  code: "PERSONNEL_TERMINATED",
  message: "İşten ayrılan personelin kaydı salt okunurdur. Değişiklik için önce yeniden etkinleştirin.",
} as const;

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
      // Çalışan personel: ayrılanlar ve arşivlenenler toplamda sayılmaz
      const baseWhere = {
        organizationId: orgId,
        deletedAt: null,
        status: { not: "TERMINATED" as const },
      };
      const canSeeArchive = hasRole(request.user.role, ARCHIVE_ROLES);

      const [total, active, inactive, onLeave, terminated, archived, byDepartmentRaw] =
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
          prisma.personnel.count({
            where: { organizationId: orgId, deletedAt: null, status: "TERMINATED" },
          }),
          canSeeArchive
            ? prisma.personnel.count({
                where: { organizationId: orgId, deletedAt: { not: null } },
              })
            : Promise.resolve(null),
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
        data: { total, active, inactive, onLeave, terminated, archived, byDepartment },
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
      /** "archived": arşivlenmiş (soft-deleted) kayıtlar; yalnız SUPER_ADMIN/ADMIN */
      view?: string;
      page?: string;
      pageSize?: string;
    };
  }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { search, departmentId, teamId, status, view } = request.query;
    const { page, pageSize, skip } = parsePagination(request.query);
    const archived = view === "archived";

    if (archived && !hasRole(request.user.role, ARCHIVE_ROLES)) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Arşivi görüntüleme yetkiniz yok",
        traceId: request.traceId,
      });
    }
    if (status && !LIST_STATUS_FILTERS.has(status)) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Geçersiz durum süzgeci",
        traceId: request.traceId,
      });
    }

    try {
      const where: Record<string, unknown> = {
        organizationId: orgId,
        deletedAt: archived ? { not: null } : null,
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
      // Varsayılan liste çalışan personeldir; ayrılanlar "Ayrılanlar" görünümünde (status=TERMINATED)
      else if (!archived) where.status = { not: "TERMINATED" };

      const orderBy: Prisma.PersonnelOrderByWithRelationInput[] = archived
        ? [{ deletedAt: "desc" }]
        : status === "TERMINATED"
          ? [{ terminationDate: { sort: "desc", nulls: "last" } }, { firstName: "asc" }]
          : [{ firstName: "asc" }, { lastName: "asc" }];

      const [data, total] = await Promise.all([
        prisma.personnel.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
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
  // Ayrılan personel de açılır (salt okunur); arşivlenmiş kayıt yalnız SUPER_ADMIN/ADMIN'e.
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;
    const canSeeArchive = hasRole(request.user.role, ARCHIVE_ROLES);
    // Skor ve analiz yalnız analyze grubuna (VIEWER görmez)
    const canAnalyze = hasRole(request.user.role, ROLE_GROUPS.analyze);

    try {
      const personnel = await prisma.personnel.findFirst({
        where: {
          id,
          organizationId: orgId,
          ...(canSeeArchive ? {} : { deletedAt: null }),
        },
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
              questionSetSnapshot: true,
              assessment: {
                select: {
                  id: true,
                  title: true,
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
      const sessions = assessmentSessions.map(
        ({ report, questionSetSnapshot, dimensionScores, assessment, ...s }) => {
          // Rapor ve geçmiş ekranıyla aynı hesap: soru seti ağırlıkları
          const weights =
            parseSnapshot(questionSetSnapshot)?.weights ??
            dimensionWeightMap(assessment.questionSet);
          return {
            ...s,
            assessment: { id: assessment.id, title: assessment.title },
            dimensionScores: canAnalyze ? dimensionScores : null,
            reportId: canAnalyze ? (report?.id ?? null) : null,
            avgScore: canAnalyze
              ? computeOverallScore(readDimensionScores(dimensionScores), weights)
              : null,
          };
        },
      );
      const scored = sessions
        .filter((s) => s.status === "COMPLETED" && s.avgScore !== null)
        .map((s) => s.avgScore as number);
      const avgScore =
        scored.length > 0
          ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
          : null;

      return reply.send({
        data: { ...rest, sessions, avgScore, readOnly: rest.status === "TERMINATED" || !!rest.deletedAt },
      });
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
      if (existing.status === "TERMINATED") {
        return reply.status(409).send({ ...TERMINATED_READ_ONLY, traceId: request.traceId });
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
        select: { id: true, status: true },
      });
      if (!personnel) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }
      if (personnel.status === "TERMINATED") {
        return reply.status(409).send({ ...TERMINATED_READ_ONLY, traceId: request.traceId });
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

  // GET /:id/history — birleştirilmiş zaman çizelgesi + boyut trendi
  fastify.get<{ Params: { id: string } }>("/:id/history", async (request, reply) => {
    const orgId = request.user.orgId!;
    try {
      const history = await getPersonnelHistory({
        organizationId: orgId,
        personnelId: request.params.id,
        canViewAnalysis: hasRole(request.user.role, ROLE_GROUPS.analyze),
        includeArchived: hasRole(request.user.role, ARCHIVE_ROLES),
      });
      if (!history) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }
      return reply.send({ data: history });
    } catch (err) {
      request.log.error(err, "personnel.history failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel geçmişi alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /:id/terminate — işten çıkar (manage rolleri; plugin preHandler'ı)
  fastify.post<{ Params: { id: string } }>("/:id/terminate", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    let body: z.infer<typeof terminateSchema>;
    try {
      body = terminateSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      throw err;
    }

    try {
      const personnel = await prisma.personnel.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, status: true, hireDate: true },
      });
      if (!personnel) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }
      if (personnel.status === "TERMINATED") {
        return reply.status(409).send({
          code: "ALREADY_TERMINATED",
          message: "Bu personel zaten işten ayrılmış olarak kayıtlı",
          traceId: request.traceId,
        });
      }
      // İleri tarihli ayrılış desteklenmez: durum hemen TERMINATED olur (saat dilimi payı: 1 gün)
      if (body.date.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "Ayrılış tarihi bugünden ileri olamaz",
          traceId: request.traceId,
        });
      }
      if (personnel.hireDate && body.date < personnel.hireDate) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "Ayrılış tarihi işe giriş tarihinden önce olamaz",
          traceId: request.traceId,
        });
      }

      const [updated, expired] = await prisma.$transaction([
        prisma.personnel.update({
          where: { id },
          data: {
            status: "TERMINATED",
            terminationDate: body.date,
            terminationReason: body.reason,
            terminationNote: body.note ?? null,
            // Portal oturumu kapanır; giriş ve yenileme ACTIVE ister (auth.service, authenticatePortal)
            portalRefreshToken: null,
          },
          include: {
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
          },
        }),
        // Açık HR/PDR oturumları kapanır; tamamlanmış oturumlar ve analizler korunur
        prisma.assessmentSession.updateMany({
          where: {
            personnelId: id,
            assessment: { organizationId: orgId },
            status: { in: [...OPEN_SESSION_STATUSES] },
          },
          data: { status: "EXPIRED", invitationToken: null },
        }),
        // Kullanılmamış portal şifre sıfırlama bağlantıları geçersiz olur
        prisma.passwordResetToken.deleteMany({
          where: { personnelId: id, usedAt: null },
        }),
        // Değerlendirici olarak açık 360° görevleri kapanır (yarım cevaplar silinir);
        // tamamlanmış değerlendirmeler ve kişinin kendi sonuçları korunur
        prisma.reviewAnswer.deleteMany({
          where: {
            assignment: {
              raterPersonnelId: id,
              status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
              subject: { cycle: { organizationId: orgId } },
            },
          },
        }),
        prisma.reviewAssignment.updateMany({
          where: {
            raterPersonnelId: id,
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
            subject: { cycle: { organizationId: orgId } },
          },
          data: { status: "DECLINED", declinedAt: new Date() },
        }),
        // Yöneticiyse astlarının yöneticisi yalnız İK onayıyla (clearDirectReports) boşaltılır
        prisma.personnel.updateMany({
          where: {
            managerId: id,
            organizationId: orgId,
            // Onay yoksa hiçbir satır eşleşmez (işlem dizisi sabit kalsın diye koşul burada)
            ...(body.clearDirectReports ? {} : { id: { in: [] } }),
          },
          data: { managerId: null },
        }),
      ]);

      return reply.send({
        data: { ...toPublicPersonnel(updated), expiredSessions: expired.count },
      });
    } catch (err) {
      request.log.error(err, "personnel.terminate failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel işten çıkarılırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST /:id/reactivate — ayrılan personeli yeniden etkinleştir (manage rolleri)
  fastify.post<{ Params: { id: string } }>("/:id/reactivate", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const personnel = await prisma.personnel.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!personnel) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Personel bulunamadı",
          traceId: request.traceId,
        });
      }
      if (personnel.status !== "TERMINATED") {
        return reply.status(409).send({
          code: "NOT_TERMINATED",
          message: "Yalnız işten ayrılmış personel yeniden etkinleştirilebilir",
          traceId: request.traceId,
        });
      }

      // Süresi dolan oturumlar geri açılmaz; gerekirse yeni değerlendirme atanır.
      // Portal şifresi korunur, oturum yeniden giriş ister.
      const updated = await prisma.personnel.update({
        where: { id },
        data: {
          status: "ACTIVE",
          terminationDate: null,
          terminationReason: null,
          terminationNote: null,
        },
        include: {
          department: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      });

      return reply.send({ data: toPublicPersonnel(updated) });
    } catch (err) {
      request.log.error(err, "personnel.reactivate failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Personel yeniden etkinleştirilirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // DELETE /:id — arşivle (soft delete: deletedAt; kayıt ve geçmiş korunur, listelerden gizlenir)
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
          message: "Personel arşivlenirken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );
};

export default personnelRoutes;
