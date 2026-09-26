import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { hashToken, tokenMatchesHash } from "../../lib/crypto.js";
import { JWT_REFRESH_SECRET } from "../../env.js";
import type { FastifyInstance } from "fastify";

export function refreshSecret(): string {
  return JWT_REFRESH_SECRET;
}

/**
 * Refresh token'ların SHA-256 özetleri kullanıcı kaydında virgülle ayrılmış
 * liste olarak tutulur; böylece aynı hesap birden fazla cihazda açık kalabilir.
 * En eski oturum, sınır aşılınca düşer. Çıkışta yalnızca ilgili token silinir.
 */
const MAX_ACTIVE_SESSIONS = 5;

function parseTokenHashes(stored: string | null | undefined): string[] {
  return stored ? stored.split(",").filter(Boolean) : [];
}

export function addRefreshTokenHash(stored: string | null | undefined, token: string): string {
  const hash = hashToken(token);
  return [hash, ...parseTokenHashes(stored).filter((h) => h !== hash)]
    .slice(0, MAX_ACTIVE_SESSIONS)
    .join(",");
}

export function hasRefreshTokenHash(stored: string | null | undefined, token: string): boolean {
  return parseTokenHashes(stored).some((h) => tokenMatchesHash(token, h));
}

export function removeRefreshTokenHash(
  stored: string | null | undefined,
  token: string,
): string | null {
  const hash = hashToken(token);
  const rest = parseTokenHashes(stored).filter((h) => h !== hash);
  return rest.length > 0 ? rest.join(",") : null;
}

/** Portal access token ömrü (development.md §12.1: 60 dk oturum zaman aşımı) */
export const PORTAL_ACCESS_TTL = "1h";
const PORTAL_REFRESH_TTL_SEC = 60 * 60 * 24;

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 dakika

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function signTokens(
  fastify: FastifyInstance,
  payload: { sub: string; role: string; orgId: string },
  rememberMe = false
): Promise<TokenPair> {
  const accessToken = fastify.jwt.sign(payload, {
    expiresIn: process.env["JWT_EXPIRES_IN"] ?? "15m",
  });

  const refreshTtlSec = rememberMe
    ? 60 * 60 * 24 * 30
    : parseInt(process.env["JWT_REFRESH_EXPIRES_SEC"] ?? `${60 * 60 * 24 * 7}`, 10);

  // jwtid: aynı saniyede verilen token'lar da benzersiz olsun (oturum bazlı iptal için)
  const refreshToken = jwt.sign(
    { sub: payload.sub, type: "refresh" },
    refreshSecret(),
    { expiresIn: refreshTtlSec, jwtid: randomUUID() }
  );

  const current = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { refreshToken: true },
  });
  await prisma.user.update({
    where: { id: payload.sub },
    data: { refreshToken: addRefreshTokenHash(current?.refreshToken, refreshToken) },
  });

  return { accessToken, refreshToken };
}

export async function adminLogin(
  fastify: FastifyInstance,
  email: string,
  password: string,
  rememberMe: boolean
) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: { organization: true },
  });

  if (!user || !user.isActive) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await signTokens(
    fastify,
    { sub: user.id, role: user.role, orgId: user.organizationId },
    rememberMe
  );

  return {
    tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organization: { id: user.organization.id, name: user.organization.name },
    },
  };
}

export async function portalLogin(
  fastify: FastifyInstance,
  employeeId: string,
  password: string
) {
  const personnel = await prisma.personnel.findFirst({
    where: { employeeId, deletedAt: null },
    include: { organization: true },
  });

  if (!personnel || !personnel.portalPasswordHash || personnel.status !== "ACTIVE") {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, personnel.portalPasswordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  await prisma.personnel.update({
    where: { id: personnel.id },
    data: { lastPortalLogin: new Date() },
  });

  const accessToken = fastify.jwt.sign(
    { sub: personnel.id, type: "portal", orgId: personnel.organizationId },
    { expiresIn: PORTAL_ACCESS_TTL }
  );

  const portalRefreshToken = jwt.sign(
    { sub: personnel.id, type: "portal_refresh" },
    refreshSecret(),
    { expiresIn: PORTAL_REFRESH_TTL_SEC, jwtid: randomUUID() }
  );

  await prisma.personnel.update({
    where: { id: personnel.id },
    data: {
      portalRefreshToken: addRefreshTokenHash(personnel.portalRefreshToken, portalRefreshToken),
    },
  });

  return {
    accessToken,
    refreshToken: portalRefreshToken,
    personnel: {
      id: personnel.id,
      employeeId: personnel.employeeId,
      firstName: personnel.firstName,
      lastName: personnel.lastName,
      preferredLanguage: personnel.preferredLanguage,
    },
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function createPasswordResetToken(
  userId?: string,
  personnelId?: string
): Promise<string> {
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      adminUserId: userId,
      personnelId,
    },
  });

  return token;
}

export async function validateAndConsumeResetToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  // Aynı token'ın eşzamanlı iki istekte kullanılmasını engelle
  const consumed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    throw new Error("INVALID_OR_EXPIRED_TOKEN");
  }

  return record;
}
