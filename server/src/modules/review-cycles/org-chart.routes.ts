import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";
import { assertNoManagerCycle } from "./review-cycles.service.js";

/** Org şemasında gösterilen durumlar (ayrılan/silinen personel ağaçta yer almaz) */
const CHART_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE"] as const;

const setManagerSchema = z.object({ managerId: z.string().min(1).nullable() });

// ═══════════════════════════════════════════
// Org şeması (prefix: /api/org-chart)
// ═══════════════════════════════════════════

export const orgChartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // ── GET / — Düz liste (istemci managerId ile ağacı kurar) ──
  fastify.get("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const people = await prisma.personnel.findMany({
      where: { organizationId: orgId, deletedAt: null, status: { in: [...CHART_STATUSES] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        position: true,
        status: true,
        avatarUrl: true,
        managerId: true,
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Ağaçta olmayan (silinmiş / ayrılmış) bir yöneticiye bağlı kişiler kökte görünür
    const ids = new Set(people.map((p) => p.id));
    return reply.send({
      data: people.map((p) => ({
        ...p,
        managerId: p.managerId && ids.has(p.managerId) ? p.managerId : null,
      })),
    });
  });

  // ── PUT /:id/manager — Yöneticiyi değiştir (null: en üst düzey) ──
  fastify.put<{ Params: { id: string } }>("/:id/manager", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { managerId } = setManagerSchema.parse(request.body);

    const person = await prisma.personnel.findFirst({
      where: { id: request.params.id, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!person) throw new HttpError("Personel bulunamadı", 404, "NOT_FOUND");

    if (managerId) {
      const manager = await prisma.personnel.findFirst({
        where: {
          id: managerId,
          organizationId: orgId,
          deletedAt: null,
          status: { in: [...CHART_STATUSES] },
        },
        select: { id: true },
      });
      if (!manager) throw new HttpError("Yönetici bulunamadı", 400, "INVALID_MANAGER");
    }

    // Kurum başına kilit: eşzamanlı iki taşıma (A→B, B→A) birlikte döngü oluşturamasın
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"org-chart:" + orgId}))`;
      if (managerId) await assertNoManagerCycle(orgId, person.id, managerId, tx);
      return tx.personnel.update({
        where: { id: person.id },
        data: { managerId },
        select: { id: true, managerId: true },
      });
    });
    return reply.send({ data: updated });
  });
};
