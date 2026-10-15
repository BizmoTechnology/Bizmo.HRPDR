import type { FastifyError, FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { isHttpError } from "../lib/http-error.js";

/**
 * Tüm 4xx/5xx yanıtları için standart gövde (development.md §12.4):
 * `{ code, message, details?, traceId }`
 *
 * Route'larda yakalanmayan Zod, Prisma ve HttpError hataları burada
 * doğru HTTP durumuna çevrilir (aksi halde Fastify hepsini 500 döndürür).
 */
export function registerErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const traceId = request.traceId;

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: error.errors
          .map((e) => (e.path.length ? `${e.path.join(".")}: ${e.message}` : e.message))
          .join(", "),
        details: error.flatten(),
        traceId,
      });
    }

    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({
        code: error.code ?? "REQUEST_ERROR",
        message: error.message,
        traceId,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.status(409).send({
          code: "DUPLICATE_ENTRY",
          message: "Bu kayıt zaten mevcut",
          details: { target: error.meta?.["target"] },
          traceId,
        });
      }
      if (error.code === "P2025") {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Kayıt bulunamadı",
          traceId,
        });
      }
      if (error.code === "P2003") {
        return reply.status(400).send({
          code: "INVALID_REFERENCE",
          message: "İlişkili kayıt bulunamadı",
          traceId,
        });
      }
    }

    const fastifyError = error as FastifyError;
    const status = fastifyError.statusCode ?? 500;

    if (status === 429) {
      return reply.status(429).send({
        code: "RATE_LIMITED",
        message: "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin.",
        traceId,
      });
    }

    if (status < 500) {
      // Fastify'ın kendi 4xx hataları (geçersiz JSON gövdesi, rate limit vb.)
      return reply.status(status).send({
        code: fastifyError.code ?? "REQUEST_ERROR",
        message: fastifyError.message,
        traceId,
      });
    }

    request.log.error({ err: error }, "unhandled error");
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Beklenmeyen bir sunucu hatası oluştu",
      traceId,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: "ROUTE_NOT_FOUND",
      message: `${request.method} ${request.url} bulunamadı`,
      traceId: request.traceId,
    });
  });
}
