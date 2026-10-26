import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import jsonwebtoken, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../types/jwt-payload.js";

/**
 * Access token imzalama/doğrulama (`fastify.jwt.sign`, `request.jwtVerify`).
 *
 * @fastify/jwt@8 kritik açıkları olan fast-jwt@4'e bağlı ve düzeltilmiş sürümü
 * Fastify 5 istiyor; refresh token'larda zaten kullanılan jsonwebtoken ile aynı
 * arayüz sağlanır. Algoritma HS256'ya sabitlenir (alg karışıklığı / "none" reddedilir).
 */
const ALGORITHM = "HS256" as const;

export interface JwtPluginOptions {
  secret: string;
  expiresIn: string;
}

const jwtPlugin: FastifyPluginAsync<JwtPluginOptions> = async (fastify, opts) => {
  if (!opts.secret) throw new Error("JWT secret tanımlı değil");

  fastify.decorate("jwt", {
    sign(payload: object, options: { expiresIn?: string } = {}): string {
      return jsonwebtoken.sign(payload, opts.secret, {
        algorithm: ALGORITHM,
        expiresIn: (options.expiresIn ?? opts.expiresIn) as SignOptions["expiresIn"],
      });
    },
  });

  fastify.decorateRequest("user", null);

  fastify.decorateRequest("jwtVerify", async function jwtVerify<T extends object = JwtPayload>(
    this: FastifyRequest,
  ): Promise<T> {
    const header = this.headers.authorization;
    const match = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) throw new Error("NO_AUTHORIZATION_HEADER");

    const decoded = jsonwebtoken.verify(match[1]!, opts.secret, { algorithms: [ALGORITHM] });
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new Error("INVALID_TOKEN_PAYLOAD");
    }
    this.user = decoded as JwtPayload;
    return decoded as T;
  });
};

export default jwtPlugin;
