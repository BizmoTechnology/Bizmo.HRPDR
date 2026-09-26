import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireRoleForWrites, ROLE_GROUPS } from "../../middleware/authenticate.js";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  color: z.string().max(30).optional(),
});

const updateSchema = createSchema.partial();

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);
  fastify.addHook("preHandler", requireRoleForWrites(ROLE_GROUPS.manage));

  // GET / — list departments
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

      const departments = await prisma.department.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              teams: { where: { deletedAt: null } },
              personnel: { where: { deletedAt: null } },
            },
          },
        },
      });

      const data = departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        color: d.color,
        teamCount: d._count.teams,
        personnelCount: d._count.personnel,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));

      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "departments.list failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Departmanlar listelenirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // POST / — create department
  fastify.post("/", async (request, reply) => {
    const orgId = request.user.orgId!;

    try {
      const body = createSchema.parse(request.body);

      const existing = await prisma.department.findFirst({
        where: { organizationId: orgId, name: body.name, deletedAt: null },
      });

      if (existing) {
        return reply.status(409).send({
          code: "DUPLICATE_NAME",
          message: "Bu isimde bir departman zaten mevcut",
          traceId: request.traceId,
        });
      }

      // (organizationId, name) veritabanında tekil: aynı adla silinmiş bir
      // kayıt varsa yeni kayıt açmak yerine geri yüklenir.
      const softDeleted = await prisma.department.findFirst({
        where: { organizationId: orgId, name: body.name, deletedAt: { not: null } },
      });

      const department = softDeleted
        ? await prisma.department.update({
            where: { id: softDeleted.id },
            data: {
              deletedAt: null,
              description: body.description ?? null,
              color: body.color ?? null,
            },
          })
        : await prisma.department.create({
            data: {
              name: body.name,
              description: body.description,
              color: body.color,
              organizationId: orgId,
            },
          });

      return reply.status(201).send({ data: department });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "departments.create failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Departman oluşturulurken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // GET /:id — get department detail
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const department = await prisma.department.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        include: {
          teams: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
          },
          _count: {
            select: {
              personnel: { where: { deletedAt: null } },
            },
          },
        },
      });

      if (!department) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Departman bulunamadı",
          traceId: request.traceId,
        });
      }

      const data = {
        id: department.id,
        name: department.name,
        description: department.description,
        color: department.color,
        teams: department.teams,
        personnelCount: department._count.personnel,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      };

      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "departments.getById failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Departman getirilirken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // PUT /:id — update department
  fastify.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const orgId = request.user.orgId!;
    const { id } = request.params;

    try {
      const body = updateSchema.parse(request.body);

      const department = await prisma.department.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });

      if (!department) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Departman bulunamadı",
          traceId: request.traceId,
        });
      }

      if (body.name && body.name !== department.name) {
        // Silinmiş kayıtlar da tekil kısıtına dahildir
        const duplicate = await prisma.department.findFirst({
          where: {
            organizationId: orgId,
            name: body.name,
            id: { not: id },
          },
        });

        if (duplicate) {
          return reply.status(409).send({
            code: "DUPLICATE_NAME",
            message: "Bu isimde bir departman zaten mevcut",
            traceId: request.traceId,
          });
        }
      }

      const updated = await prisma.department.update({
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
      request.log.error(err, "departments.update failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Departman güncellenirken hata oluştu",
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
        const department = await prisma.department.findFirst({
          where: { id, organizationId: orgId, deletedAt: null },
        });

        if (!department) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Departman bulunamadı",
            traceId: request.traceId,
          });
        }

        const now = new Date();
        await prisma.$transaction([
          // Personel silinmiş departman/ekiplere bağlı kalmasın
          prisma.personnel.updateMany({
            where: { organizationId: orgId, departmentId: id },
            data: { departmentId: null, teamId: null },
          }),
          prisma.team.updateMany({
            where: { departmentId: id, deletedAt: null },
            data: { deletedAt: now },
          }),
          prisma.department.update({
            where: { id },
            data: { deletedAt: now },
          }),
        ]);

        return reply.send({ data: { ok: true } });
      } catch (err) {
        request.log.error(err, "departments.delete failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Departman silinirken hata oluştu",
          traceId: request.traceId,
        });
      }
    },
  );
};

export default departmentRoutes;
