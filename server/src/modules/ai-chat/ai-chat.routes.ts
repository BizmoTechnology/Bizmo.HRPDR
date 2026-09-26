import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { generateHrAssistantReply } from "../../services/ai-chat.service.js";

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32_000),
});

const aiChatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /conversations
  fastify.post("/conversations", async (request, reply) => {
    const orgId = request.user.orgId!;
    const userId = request.user.sub;

    try {
      const body = createConversationSchema.parse(request.body ?? {});

      const conv = await prisma.aiChatConversation.create({
        data: {
          organizationId: orgId,
          userId,
          title: body.title ?? null,
        },
      });

      return reply.status(201).send({ data: conv });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: err.errors.map((e) => e.message).join(", "),
          traceId: request.traceId,
        });
      }
      request.log.error(err, "aiChat.createConversation failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Sohbet oluşturulamadı",
        traceId: request.traceId,
      });
    }
  });

  // GET /conversations
  fastify.get("/conversations", async (request, reply) => {
    const orgId = request.user.orgId!;
    const userId = request.user.sub;

    try {
      const list = await prisma.aiChatConversation.findMany({
        where: { organizationId: orgId, userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      });

      const data = list.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c._count.messages,
      }));

      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "aiChat.listConversations failed");
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Sohbetler listelenemedi",
        traceId: request.traceId,
      });
    }
  });

  // GET /conversations/:id
  fastify.get<{ Params: { id: string } }>(
    "/conversations/:id",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const conv = await prisma.aiChatConversation.findFirst({
          where: { id, organizationId: orgId, userId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
          },
        });

        if (!conv) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Sohbet bulunamadı",
            traceId: request.traceId,
          });
        }

        return reply.send({
          data: {
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messages: conv.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              metadata: m.metadata,
              createdAt: m.createdAt,
            })),
          },
        });
      } catch (err) {
        request.log.error(err, "aiChat.getConversation failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Sohbet getirilemedi",
          traceId: request.traceId,
        });
      }
    },
  );

  // DELETE /conversations/:id
  fastify.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const userId = request.user.sub;
      const { id } = request.params;

      try {
        const existing = await prisma.aiChatConversation.findFirst({
          where: { id, organizationId: orgId, userId },
        });

        if (!existing) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Sohbet bulunamadı",
            traceId: request.traceId,
          });
        }

        await prisma.aiChatConversation.delete({ where: { id } });

        return reply.send({ data: { ok: true } });
      } catch (err) {
        request.log.error(err, "aiChat.deleteConversation failed");
        return reply.status(500).send({
          code: "INTERNAL_ERROR",
          message: "Sohbet silinemedi",
          traceId: request.traceId,
        });
      }
    },
  );

  // POST /conversations/:id/messages
  fastify.post<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    async (request, reply) => {
      const orgId = request.user.orgId!;
      const userId = request.user.sub;
      const { id: conversationId } = request.params;

      try {
        const body = sendMessageSchema.parse(request.body);

        const conv = await prisma.aiChatConversation.findFirst({
          where: { id: conversationId, organizationId: orgId, userId },
        });

        if (!conv) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: "Sohbet bulunamadı",
            traceId: request.traceId,
          });
        }

        const priorUserCount = await prisma.aiChatMessage.count({
          where: { conversationId, role: "user" },
        });

        await prisma.aiChatMessage.create({
          data: {
            conversationId,
            role: "user",
            content: body.content.trim(),
          },
        });

        if (!conv.title && priorUserCount === 0) {
          await prisma.aiChatConversation.update({
            where: { id: conversationId },
            data: { title: body.content.trim().slice(0, 80) },
          });
        }

        const all = await prisma.aiChatMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
        });

        const dialogue = all.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const aiResult = await generateHrAssistantReply({
          organizationId: orgId,
          dialogue,
        });

        const assistantMsg = await prisma.aiChatMessage.create({
          data: {
            conversationId,
            role: "assistant",
            content: aiResult.reply,
            metadata: aiResult.metadata as object,
          },
        });

        await prisma.aiChatConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        await prisma.aiUsageLog.create({
          data: {
            provider: aiResult.aiProvider,
            modelName: aiResult.modelName,
            purpose: "AI_HR_CHAT",
            requestType: "ai_chat",
            status: "SUCCESS",
            userId,
            organizationId: orgId,
            metadata: {
              conversationId,
              assistantMessageId: assistantMsg.id,
            } as object,
          },
        });

        return reply.send({
          data: {
            assistantMessage: {
              id: assistantMsg.id,
              role: assistantMsg.role,
              content: assistantMsg.content,
              metadata: assistantMsg.metadata,
              createdAt: assistantMsg.createdAt,
            },
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
        const message =
          err instanceof Error ? err.message : "AI yanıtı oluşturulamadı";
        request.log.error(err, "aiChat.sendMessage failed");
        return reply.status(502).send({
          code: "AI_CHAT_FAILED",
          message,
          traceId: request.traceId,
        });
      }
    },
  );
};

export default aiChatRoutes;
