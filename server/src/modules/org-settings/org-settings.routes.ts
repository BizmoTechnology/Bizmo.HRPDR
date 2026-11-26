import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  DEFAULT_ORG_SETTINGS,
  getOrgSettings,
  orgSettingsPatchSchema,
  updateOrgSettings,
} from "../../lib/sharing.js";
import { requireRoleForWrites, type UserRole } from "../../middleware/authenticate.js";

/** Kurum genelindeki ayarları yalnız yöneticiler değiştirebilir */
const SETTINGS_WRITE_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN"];

/**
 * Kurum ayarları (prefix: /api/org-settings)
 * - GET  /  → tüm panel rolleri okuyabilir (formlar etkin varsayılanı gösterir)
 * - PUT  /  → kısmi güncelleme, yalnız ADMIN/SUPER_ADMIN
 */
const orgSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(SETTINGS_WRITE_ROLES));

  fastify.get("/", async (request, reply) => {
    const settings = await getOrgSettings(request.user.orgId!);
    return reply.send({ data: settings, meta: { defaults: DEFAULT_ORG_SETTINGS } });
  });

  fastify.put("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const patch = orgSettingsPatchSchema.parse(request.body ?? {});

    const { before, after } = await prisma.$transaction(async (tx) => {
      const res = await updateOrgSettings(orgId, patch, tx);
      await tx.auditLog.create({
        data: {
          userId: request.user.sub,
          action: "ORG_SETTINGS_UPDATED",
          entity: "Organization",
          entityId: orgId,
          before: res.before as Prisma.InputJsonValue,
          after: res.after as Prisma.InputJsonValue,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
          traceId: request.traceId,
        },
      });
      return res;
    });

    request.log.info({ orgId, before, after }, "org settings updated");
    return reply.send({ data: after, meta: { defaults: DEFAULT_ORG_SETTINGS } });
  });
};

export default orgSettingsRoutes;
