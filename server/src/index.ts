import { JWT_ACCESS_SECRET } from "./env.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import traceIdPlugin from "./plugins/traceId.js";
import { registerErrorHandlers } from "./plugins/error-handler.js";
import { authenticate, authenticatePortal } from "./middleware/authenticate.js";
import authRoutes from "./modules/auth/auth.routes.js";
import departmentsRoutes from "./modules/departments/departments.routes.js";
import teamsRoutes from "./modules/teams/teams.routes.js";
import personnelRoutes from "./modules/personnel/personnel.routes.js";
import questionsRoutes from "./modules/questions/questions.routes.js";
import questionSetsRoutes from "./modules/question-sets/question-sets.routes.js";
import assessmentsRoutes from "./modules/assessments/assessments.routes.js";
import sessionAdminRoutes, {
  sessionPortalRoutes,
} from "./modules/sessions/sessions.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import aiConfigRoutes from "./modules/ai-config/ai-config.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import aiChatRoutes from "./modules/ai-chat/ai-chat.routes.js";

const app = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
});

// ── Plugins ───────────────────────────────────────

const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) {
  corsOrigins.push(
    process.env["APP_URL"] ?? "http://localhost:3000",
    process.env["PORTAL_URL"] ?? "http://localhost:3002",
  );
}

await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: false,
});

await app.register(cookie);

await app.register(jwt, {
  secret: JWT_ACCESS_SECRET,
  sign: { expiresIn: process.env["JWT_EXPIRES_IN"] ?? "15m" },
});

await app.register(rateLimit, {
  global: false,
  // Gövde ayrıştırıldıktan sonra çalışsın (giriş anahtarı e-posta/sicil içerir)
  hook: "preHandler",
});

await app.register(swagger, {
  openapi: {
    info: { title: "PotansiyelHaritası API", version: "1.1.0" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: "/api/docs",
});

await app.register(fp(traceIdPlugin));

registerErrorHandlers(app);

// ── Decorators ────────────────────────────────────

app.decorate("authenticate", authenticate);
app.decorate("authenticatePortal", authenticatePortal);

// ── Health ────────────────────────────────────────

app.get("/health", async () => ({ status: "ok" }));

app.get("/health/ready", async (_request, reply) => {
  try {
    const { prisma } = await import("./lib/prisma.js");
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", db: "connected" });
  } catch {
    return reply.status(503).send({ status: "error", db: "disconnected" });
  }
});

// ── Routes ────────────────────────────────────────

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(departmentsRoutes, { prefix: "/api/departments" });
await app.register(teamsRoutes, { prefix: "/api/teams" });
await app.register(personnelRoutes, { prefix: "/api/personnel" });
await app.register(questionsRoutes, { prefix: "/api/questions" });
await app.register(questionSetsRoutes, { prefix: "/api/question-sets" });
await app.register(assessmentsRoutes, { prefix: "/api/assessments" });
await app.register(sessionPortalRoutes, { prefix: "/api/sessions" });
await app.register(sessionAdminRoutes, { prefix: "/api/sessions" });
await app.register(analyticsRoutes, { prefix: "/api/analytics" });
await app.register(reportsRoutes, { prefix: "/api/reports" });
await app.register(aiConfigRoutes, { prefix: "/api/ai-config" });
await app.register(notificationsRoutes, { prefix: "/api/notifications" });
await app.register(aiChatRoutes, { prefix: "/api/ai-chat" });

// ── Start ─────────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`🚀 API sunucusu http://0.0.0.0:${PORT} adresinde çalışıyor`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
