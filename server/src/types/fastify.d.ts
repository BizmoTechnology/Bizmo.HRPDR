import type { FastifyReply, FastifyRequest } from "fastify";
import type { JwtPayload } from "./jwt-payload.js";

type AuthPreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<FastifyReply | void>;

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
    /** `authenticate` / `authenticatePortal` sonrasında dolu */
    user: JwtPayload;
    jwtVerify<T extends object = JwtPayload>(): Promise<T>;
  }

  interface FastifyInstance {
    jwt: { sign(payload: object, options?: { expiresIn?: string }): string };
    authenticate: AuthPreHandler;
    authenticatePortal: AuthPreHandler;
  }
}

export {};
