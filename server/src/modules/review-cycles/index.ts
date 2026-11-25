import type { FastifyPluginAsync } from "fastify";
import { orgChartRoutes } from "./org-chart.routes.js";
import { reviewCycleRoutes } from "./review-cycles.routes.js";
import { reviewPortalRoutes } from "./review-portal.routes.js";

/**
 * Performans modülü (360° değerlendirme, dönemler, org şeması).
 * `/api` önekiyle kaydedilir:
 * - /api/org-chart          → panel: org şeması
 * - /api/review-cycles      → panel: dönemler, atamalar, sonuçlar
 * - /api/reviews/portal     → personel portalı: değerlendirici görevleri
 */
const performanceRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(orgChartRoutes, { prefix: "/org-chart" });
  await fastify.register(reviewCycleRoutes, { prefix: "/review-cycles" });
  await fastify.register(reviewPortalRoutes, { prefix: "/reviews/portal" });
};

export default performanceRoutes;
