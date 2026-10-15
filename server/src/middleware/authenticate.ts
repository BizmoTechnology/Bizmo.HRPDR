import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "../types/jwt-payload.js";

export type { JwtPayload };

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "HR_MANAGER" | "ANALYST" | "VIEWER";

/** development.md §8 — rol matrisi */
export const ROLE_GROUPS = {
  /** Personel, soru, soru seti, değerlendirme CRUD + AI soru üretimi */
  manage: ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"],
  /** Analiz tetikleme, İK onayı, rapor oluşturma/indirme */
  analyze: ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "ANALYST"],
  /** AI sağlayıcı ve prompt yapılandırması */
  aiConfig: ["SUPER_ADMIN", "ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify<JwtPayload>();
  } catch {
    return reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Kimlik doğrulaması başarısız",
      traceId: request.traceId,
    });
  }

  // Yönetici access token'larında `type` alanı yoktur; refresh ve portal
  // token'ları bu endpoint'lerde kabul edilmez.
  if (request.user.type !== undefined || !request.user.orgId || !request.user.role) {
    const isPortal =
      request.user.type === "portal" || request.user.type === "portal_refresh";
    return reply.status(isPortal ? 403 : 401).send({
      code: isPortal ? "PORTAL_TOKEN_NOT_ALLOWED" : "UNAUTHORIZED",
      message: isPortal
        ? "Bu endpoint yönetici hesabı gerektiriyor"
        : "Kimlik doğrulaması başarısız",
      traceId: request.traceId,
    });
  }
}

export async function authenticatePortal(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify<JwtPayload>();
  } catch {
    return reply.status(401).send({
      code: "UNAUTHORIZED",
      message: "Kimlik doğrulaması başarısız",
      traceId: request.traceId,
    });
  }

  if (request.user.type !== "portal") {
    return reply.status(403).send({
      code: "ADMIN_TOKEN_NOT_ALLOWED",
      message: "Bu endpoint personel hesabı gerektiriyor",
      traceId: request.traceId,
    });
  }
}

/**
 * Rol kontrolü; `authenticate` sonrasında preHandler olarak kullanılır.
 * Örn. `{ preHandler: requireRole(ROLE_GROUPS.manage) }`
 */
export function requireRole(roles: readonly UserRole[]) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply) {
    const role = request.user?.role as UserRole | undefined;
    if (!role || !roles.includes(role)) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Bu işlem için yetkiniz yok",
        traceId: request.traceId,
      });
    }
  };
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Okuma isteklerini serbest bırakıp yazma isteklerinde (POST/PUT/PATCH/DELETE)
 * rol kontrolü yapar. Plugin seviyesinde `preHandler` hook'u olarak eklenir.
 */
export function requireRoleForWrites(roles: readonly UserRole[]) {
  const check = requireRole(roles);
  return async function checkWriteRole(request: FastifyRequest, reply: FastifyReply) {
    if (READ_METHODS.has(request.method)) return;
    return check(request, reply);
  };
}
