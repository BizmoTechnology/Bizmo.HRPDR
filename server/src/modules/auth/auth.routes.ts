import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import {
  loginBodySchema,
  portalLoginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  changePasswordBodySchema,
} from "./auth.schema.js";
import {
  adminLogin,
  portalLogin,
  hashPassword,
  createPasswordResetToken,
  validateAndConsumeResetToken,
  refreshSecret,
  PORTAL_ACCESS_TTL,
  hasRefreshTokenHash,
  removeRefreshTokenHash,
  updatePersonnelRefreshTokens,
  updateUserRefreshTokens,
} from "./auth.service.js";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";

/** development.md §12.1 — auth endpoint'leri için IP başına sınır */
const authRateLimit = {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
};

/** Token yenileme httpOnly çerez gerektirir; ortak IP'deki ofisler için daha geniş sınır */
const refreshRateLimit = {
  config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
};

/**
 * Giriş denemeleri hesap kimliği (e-posta/sicil) bazında sınırlandırılır:
 * IP değiştirerek kaba kuvvet denemesi yapılamaz, fabrikada ortak kiosk/IP
 * kullanan personel de birbirini kilitlemez. Hesap bilgisi yoksa IP kullanılır.
 */
function loginRateLimit(field: "email" | "employeeId") {
  return {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as Record<string, unknown> | undefined;
          const account =
            typeof body?.[field] === "string" ? String(body[field]).trim().toLowerCase() : "";
          return account ? `login:${field}:${account}` : `login-ip:${request.ip}`;
        },
      },
    },
  };
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Admin Giriş ──────────────────────────────
  fastify.post("/login", loginRateLimit("email"), async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    try {
      const result = await adminLogin(
        fastify,
        body.email,
        body.password,
        body.rememberMe
      );

      reply
        .setCookie("refreshToken", result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env["NODE_ENV"] === "production",
          sameSite: "strict",
          maxAge: body.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
          path: "/api/auth",
        })
        .send({ data: { accessToken: result.tokens.accessToken, user: result.user } });
    } catch {
      reply.status(401).send({
        code: "INVALID_CREDENTIALS",
        message: "E-posta veya şifre hatalı",
        traceId: request.traceId,
      });
    }
  });

  // ── Admin Çıkış ──────────────────────────────
  // Access token süresi dolmuş olsa da çıkış yapılabilmeli: oturum refresh
  // çerezinden bulunur ve yalnızca bu cihazın token'ı iptal edilir.
  fastify.post("/logout", async (request, reply) => {
    const cookieToken = request.cookies?.["refreshToken"];
    let revoked = false;

    if (cookieToken) {
      try {
        const payload = jwt.verify(cookieToken, refreshSecret()) as { sub: string; type?: string };
        if (payload.type === "refresh") {
          await updateUserRefreshTokens(payload.sub, (stored) =>
            removeRefreshTokenHash(stored, cookieToken),
          );
          revoked = true;
        }
      } catch {
        // Süresi dolmuş/geçersiz çerez: sunucuda iptal edilecek geçerli oturum yok
      }
    }

    if (!revoked) {
      // Çerez yoksa geçerli bir yönetici access token'ı ile tüm oturumlar kapatılır
      try {
        const user = await request.jwtVerify<{ sub: string; type?: string }>();
        if (user.type === undefined) {
          await updateUserRefreshTokens(user.sub, () => null);
        }
      } catch {
        // Kimlik doğrulanamadı; yalnızca çerez temizlenir
      }
    }

    return reply.clearCookie("refreshToken", { path: "/api/auth" }).send({ data: { ok: true } });
  });

  // ── Admin Şifre Değiştirme (oturum açıkken) ──
  fastify.post(
    "/change-password",
    { onRequest: [fastify.authenticate], ...authRateLimit },
    async (request, reply) => {
      const { currentPassword, newPassword } = changePasswordBodySchema.parse(request.body);

      const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return reply.status(400).send({
          code: "INVALID_CURRENT_PASSWORD",
          message: "Mevcut şifre hatalı",
          traceId: request.traceId,
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(newPassword) },
      });

      return reply.send({ data: { message: "Şifreniz güncellendi" } });
    }
  );

  // ── Admin Token Yenileme ─────────────────────
  fastify.post("/refresh", refreshRateLimit, async (request, reply) => {
    const rawToken =
      request.cookies?.["refreshToken"] ??
      (request.body as { refreshToken?: string })?.refreshToken;

    if (!rawToken) {
      return reply.status(401).send({ code: "NO_REFRESH_TOKEN", message: "Yenileme token'ı bulunamadı", traceId: request.traceId });
    }

    try {
      const payload = jwt.verify(rawToken, refreshSecret()) as {
        sub: string;
        type?: string;
      };

      if (payload.type !== "refresh") {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { organization: true },
      });

      if (!user || !user.isActive || user.deletedAt) {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      if (!hasRefreshTokenHash(user.refreshToken, rawToken)) {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      const accessToken = fastify.jwt.sign({
        sub: user.id,
        role: user.role,
        orgId: user.organizationId,
      }, { expiresIn: process.env["JWT_EXPIRES_IN"] ?? "15m" });

      return reply.send({ data: { accessToken } });
    } catch {
      return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
    }
  });

  // ── Admin Şifre Sıfırlama Talebi ─────────────
  fastify.post("/forgot-password", authRateLimit, async (request, reply) => {
    const { email } = forgotPasswordBodySchema.parse(request.body);

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    if (user) {
      const token = await createPasswordResetToken(user.id);
      const appUrl = (process.env["APP_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

      try {
        const sent = await sendMail({
          to: user.email,
          subject: "Şifre sıfırlama talebi",
          text:
            `Merhaba ${user.name},\n\n` +
            `Şifrenizi sıfırlamak için aşağıdaki bağlantıyı 60 dakika içinde kullanın:\n${resetUrl}\n\n` +
            "Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.",
        });
        if (!sent) {
          if (process.env["NODE_ENV"] === "production") {
            request.log.warn({ userId: user.id }, "SMTP yapılandırılmadığı için sıfırlama e-postası gönderilemedi");
          } else {
            // Yalnızca geliştirme: SMTP yokken bağlantı log'a yazılır
            request.log.info({ userId: user.id, resetUrl }, "password_reset_requested (dev)");
          }
        }
      } catch (err) {
        request.log.error({ err, userId: user.id }, "Şifre sıfırlama e-postası gönderilemedi");
      }
    }

    // Güvenlik: kullanıcı var/yok fark etmeksizin aynı yanıt
    return reply.send({
      data: { message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi" },
    });
  });

  // ── Admin Şifre Sıfırlama ─────────────────────
  fastify.post("/reset-password", authRateLimit, async (request, reply) => {
    const { token, password } = resetPasswordBodySchema.parse(request.body);

    try {
      const record = await validateAndConsumeResetToken(token);
      if (!record.adminUserId) {
        return reply.status(400).send({ code: "INVALID_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      const hashed = await hashPassword(password);
      await prisma.user.update({
        where: { id: record.adminUserId },
        data: { password: hashed, refreshToken: null },
      });

      return reply.send({ data: { message: "Şifreniz başarıyla güncellendi" } });
    } catch {
      return reply.status(400).send({ code: "INVALID_OR_EXPIRED_TOKEN", message: "Token geçersiz veya süresi dolmuş", traceId: request.traceId });
    }
  });

  // ── Portal Giriş ──────────────────────────────
  fastify.post("/portal/login", loginRateLimit("employeeId"), async (request, reply) => {
    const body = portalLoginBodySchema.parse(request.body);

    try {
      const result = await portalLogin(fastify, body.employeeId, body.password);
      return reply.send({ data: result });
    } catch {
      return reply.status(401).send({
        code: "INVALID_CREDENTIALS",
        message: "Sicil numarası veya şifre hatalı",
        traceId: request.traceId,
      });
    }
  });

  // ── Portal Token Yenileme ─────────────────────
  fastify.post("/portal/refresh", refreshRateLimit, async (request, reply) => {
    const rawToken = (request.body as { refreshToken?: string })?.refreshToken;
    if (!rawToken) {
      return reply.status(401).send({ code: "NO_REFRESH_TOKEN", message: "Token bulunamadı", traceId: request.traceId });
    }

    try {
      const payload = jwt.verify(rawToken, refreshSecret()) as {
        sub: string;
        type?: string;
      };

      if (payload.type !== "portal_refresh") {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      const personnel = await prisma.personnel.findUnique({
        where: { id: payload.sub },
      });

      if (!personnel || personnel.deletedAt || personnel.status !== "ACTIVE") {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      if (!hasRefreshTokenHash(personnel.portalRefreshToken, rawToken)) {
        return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
      }

      const accessToken = fastify.jwt.sign(
        { sub: personnel.id, type: "portal", orgId: personnel.organizationId },
        { expiresIn: PORTAL_ACCESS_TTL }
      );

      return reply.send({ data: { accessToken } });
    } catch {
      return reply.status(401).send({ code: "INVALID_REFRESH_TOKEN", message: "Geçersiz token", traceId: request.traceId });
    }
  });

  // ── Portal Çıkış ──────────────────────────────
  // Gövdedeki refresh token ile yalnızca bu cihazın oturumu kapatılır
  // (access token süresi dolmuş olsa bile).
  fastify.post("/portal/logout", async (request, reply) => {
    const bodyToken = (request.body as { refreshToken?: string } | undefined)?.refreshToken;

    if (bodyToken) {
      try {
        const payload = jwt.verify(bodyToken, refreshSecret()) as { sub: string; type?: string };
        if (payload.type === "portal_refresh") {
          await updatePersonnelRefreshTokens(payload.sub, (stored) =>
            removeRefreshTokenHash(stored, bodyToken),
          );
        }
      } catch {
        // Geçersiz/süresi dolmuş token: iptal edilecek oturum yok
      }
      return reply.send({ data: { ok: true } });
    }

    // Token gönderilmediyse geçerli portal access token'ı ile tüm oturumlar kapatılır
    try {
      const user = await request.jwtVerify<{ sub: string; type?: string }>();
      if (user.type === "portal") {
        await updatePersonnelRefreshTokens(user.sub, () => null);
      }
    } catch {
      // Kimlik doğrulanamadı
    }
    return reply.send({ data: { ok: true } });
  });
};

export default authRoutes;
