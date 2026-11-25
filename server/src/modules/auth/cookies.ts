import type { FastifyReply } from "fastify";

/** Yönetici refresh token çerezi (şifre ve Bizmo.ID girişi ortak) */
export function setAdminRefreshCookie(reply: FastifyReply, refreshToken: string, rememberMe: boolean) {
  return reply.setCookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
    path: "/api/auth",
  });
}
