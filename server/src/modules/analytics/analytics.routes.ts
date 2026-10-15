import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

interface DimensionScoreMap {
  [dimension: string]: number;
}

function accumulateDimensionValues(
  target: Map<string, number[]>,
  dimensionScores: unknown,
): void {
  if (!dimensionScores || typeof dimensionScores !== "object") return;
  const scores = dimensionScores as DimensionScoreMap;
  for (const [dim, val] of Object.entries(scores)) {
    if (typeof val !== "number") continue;
    const arr = target.get(dim) ?? [];
    arr.push(val);
    target.set(dim, arr);
  }
}

function finalizeDimensionAvgs(dimMap: Map<string, number[]>): Record<
  string,
  { avg: number; count: number }
> {
  const out: Record<string, { avg: number; count: number }> = {};
  for (const [dim, values] of dimMap) {
    if (values.length === 0) continue;
    out[dim] = {
      avg:
        Math.round(
          (values.reduce((a, b) => a + b, 0) / values.length) * 100,
        ) / 100,
      count: values.length,
    };
  }
  return out;
}

function extractAvgFromScores(dimensionScores: unknown): number | null {
  if (!dimensionScores || typeof dimensionScores !== "object") return null;
  const scores = Object.values(dimensionScores as DimensionScoreMap).filter(
    (v): v is number => typeof v === "number",
  );
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // ── GET /dashboard — Panel istatistikleri ──────
  fastify.get("/dashboard", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const [
        totalPersonnel,
        activePersonnel,
        totalAssessments,
        activeAssessments,
        totalSessions,
        completedSessions,
        inProgressSessions,
        pendingSessions,
        completedSessionsData,
        recentSessionsRaw,
      ] = await Promise.all([
        prisma.personnel.count({ where: { organizationId: orgId, deletedAt: null } }),
        prisma.personnel.count({ where: { organizationId: orgId, deletedAt: null, status: "ACTIVE" } }),
        prisma.assessment.count({ where: { organizationId: orgId } }),
        prisma.assessment.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
        prisma.assessmentSession.count({ where: { assessment: { organizationId: orgId } } }),
        prisma.assessmentSession.count({ where: { assessment: { organizationId: orgId }, status: "COMPLETED" } }),
        prisma.assessmentSession.count({ where: { assessment: { organizationId: orgId }, status: "IN_PROGRESS" } }),
        prisma.assessmentSession.count({ where: { assessment: { organizationId: orgId }, status: "NOT_STARTED" } }),
        prisma.assessmentSession.findMany({
          where: { assessment: { organizationId: orgId }, status: "COMPLETED", dimensionScores: { not: Prisma.JsonNull } },
          select: { dimensionScores: true },
        }),
        prisma.assessmentSession.findMany({
          where: { assessment: { organizationId: orgId }, status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 10,
          include: {
            personnel: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        }),
      ]);

      const completionRate = totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 10000) / 100
        : 0;

      // Skorlu oturum yoksa ortalama "yok" (0 değil) olarak döner
      let avgScore: number | null = null;
      if (completedSessionsData.length > 0) {
        const allAvgs = completedSessionsData
          .map((s) => extractAvgFromScores(s.dimensionScores))
          .filter((v): v is number => v !== null);
        if (allAvgs.length > 0) {
          avgScore = Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 100) / 100;
        }
      }

      const recentSessions = recentSessionsRaw.map((s) => ({
        id: s.id,
        personnel: {
          firstName: s.personnel.firstName,
          lastName: s.personnel.lastName,
        },
        department: s.personnel.department
          ? { name: s.personnel.department.name }
          : null,
        avgScore: extractAvgFromScores(s.dimensionScores),
        completedAt: s.completedAt?.toISOString() ?? "",
      }));

      // Top 5 performers
      const allCompletedWithScores = await prisma.assessmentSession.findMany({
        where: { assessment: { organizationId: orgId }, status: "COMPLETED", dimensionScores: { not: Prisma.JsonNull } },
        select: {
          personnelId: true,
          dimensionScores: true,
          personnel: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              department: { select: { name: true } },
            },
          },
        },
      });

      const personnelScoreMap = new Map<
        string,
        { firstName: string; lastName: string; position: string; scores: number[] }
      >();
      for (const s of allCompletedWithScores) {
        const avg = extractAvgFromScores(s.dimensionScores);
        if (avg === null) continue;
        const existing = personnelScoreMap.get(s.personnelId);
        if (existing) {
          existing.scores.push(avg);
        } else {
          personnelScoreMap.set(s.personnelId, {
            firstName: s.personnel.firstName,
            lastName: s.personnel.lastName,
            position: s.personnel.position,
            scores: [avg],
          });
        }
      }

      const topPerformers = [...personnelScoreMap.entries()]
        .map(([id, val]) => ({
          id,
          firstName: val.firstName,
          lastName: val.lastName,
          position: val.position,
          avgScore:
            Math.round(
              (val.scores.reduce((a, b) => a + b, 0) / val.scores.length) * 100,
            ) / 100,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5);

      // By department
      const departments = await prisma.department.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, name: true },
      });

      const deptSessions = await prisma.assessmentSession.findMany({
        where: {
          assessment: { organizationId: orgId },
          status: "COMPLETED",
          personnel: { departmentId: { not: null } },
        },
        select: {
          dimensionScores: true,
          personnel: { select: { departmentId: true } },
        },
      });

      const deptStatsMap = new Map<string, { completed: number; scores: number[] }>();
      for (const s of deptSessions) {
        const dId = s.personnel.departmentId!;
        const avg = extractAvgFromScores(s.dimensionScores);
        const existing = deptStatsMap.get(dId) ?? { completed: 0, scores: [] };
        existing.completed++;
        if (avg !== null) existing.scores.push(avg);
        deptStatsMap.set(dId, existing);
      }

      const deptPersonnelCounts = await prisma.personnel.groupBy({
        by: ["departmentId"],
        where: { organizationId: orgId, deletedAt: null, departmentId: { not: null } },
        _count: { id: true },
      });
      const personnelCountMap = new Map(deptPersonnelCounts.map((d) => [d.departmentId!, d._count.id]));

      const byDepartment = departments.map((dept) => {
        const stats = deptStatsMap.get(dept.id);
        const scores = stats?.scores ?? [];
        return {
          id: dept.id,
          name: dept.name,
          personnelCount: personnelCountMap.get(dept.id) ?? 0,
          completedTests: stats?.completed ?? 0,
          avgScore:
            scores.length > 0
              ? Math.round(
                  (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
                ) / 100
              : null,
        };
      });

      return reply.send({
        data: {
          totalPersonnel,
          activePersonnel,
          totalAssessments,
          activeAssessments,
          totalSessions,
          completedSessions,
          inProgressSessions,
          pendingSessions,
          completionRate,
          avgScore,
          recentSessions,
          topPerformers,
          byDepartment,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Panel verileri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── GET /dimensions — Boyut bazlı kırılım ─────
  fastify.get("/dimensions", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const sessions = await prisma.assessmentSession.findMany({
        where: {
          assessment: { organizationId: orgId },
          status: "COMPLETED",
          dimensionScores: { not: Prisma.JsonNull },
        },
        select: { dimensionScores: true },
      });

      const dimensionMap = new Map<string, number[]>();

      for (const s of sessions) {
        if (!s.dimensionScores || typeof s.dimensionScores !== "object") continue;
        const scores = s.dimensionScores as DimensionScoreMap;
        for (const [dim, val] of Object.entries(scores)) {
          if (typeof val !== "number") continue;
          const arr = dimensionMap.get(dim) ?? [];
          arr.push(val);
          dimensionMap.set(dim, arr);
        }
      }

      const dimensions = [...dimensionMap.entries()].map(([dimension, values]) => ({
        dimension,
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      }));

      return reply.send({ data: dimensions });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Boyut verileri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── GET /trends — Son 12 aylık trendler ────────
  fastify.get("/trends", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const sessions = await prisma.assessmentSession.findMany({
        where: {
          assessment: { organizationId: orgId },
          status: "COMPLETED",
          completedAt: { gte: twelveMonthsAgo },
        },
        select: { completedAt: true, dimensionScores: true },
      });

      const monthlyMap = new Map<string, { count: number; scores: number[] }>();

      for (const s of sessions) {
        if (!s.completedAt) continue;
        const key = `${s.completedAt.getFullYear()}-${String(s.completedAt.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyMap.get(key) ?? { count: 0, scores: [] };
        existing.count++;
        const avg = extractAvgFromScores(s.dimensionScores);
        if (avg !== null) existing.scores.push(avg);
        monthlyMap.set(key, existing);
      }

      const trends = [...monthlyMap.entries()]
        .map(([month, val]) => ({
          month,
          completionCount: val.count,
          avgScore: val.scores.length > 0
            ? Math.round((val.scores.reduce((a, b) => a + b, 0) / val.scores.length) * 100) / 100
            : 0,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return reply.send({ data: trends });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Trend verileri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── GET /department-dimensions — Departman bazlı boyut ortalamaları ──
  fastify.get("/department-dimensions", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const sessions = await prisma.assessmentSession.findMany({
        where: {
          assessment: { organizationId: orgId },
          status: "COMPLETED",
          dimensionScores: { not: Prisma.JsonNull },
          personnel: { departmentId: { not: null } },
        },
        select: {
          dimensionScores: true,
          personnel: {
            select: {
              departmentId: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      });

      const byDept = new Map<
        string,
        { name: string; dimMap: Map<string, number[]>; sessionCount: number }
      >();

      for (const s of sessions) {
        const dId = s.personnel.departmentId!;
        const name = s.personnel.department?.name ?? "—";
        let entry = byDept.get(dId);
        if (!entry) {
          entry = { name, dimMap: new Map(), sessionCount: 0 };
          byDept.set(dId, entry);
        }
        entry.sessionCount++;
        accumulateDimensionValues(entry.dimMap, s.dimensionScores);
      }

      const departments = [...byDept.entries()].map(([departmentId, v]) => ({
        departmentId,
        departmentName: v.name,
        sessionCount: v.sessionCount,
        averages: finalizeDimensionAvgs(v.dimMap),
      }));

      departments.sort((a, b) => a.departmentName.localeCompare(b.departmentName, "tr"));

      return reply.send({ data: { departments } });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Departman boyut verileri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });

  // ── GET /monthly-dimensions — Aylık boyut bazlı ortalamalar ──
  fastify.get("/monthly-dimensions", async (request, reply) => {
    try {
      const orgId = request.user.orgId!;

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      twelveMonthsAgo.setDate(1);
      twelveMonthsAgo.setHours(0, 0, 0, 0);

      const sessions = await prisma.assessmentSession.findMany({
        where: {
          assessment: { organizationId: orgId },
          status: "COMPLETED",
          completedAt: { gte: twelveMonthsAgo },
          dimensionScores: { not: Prisma.JsonNull },
        },
        select: { completedAt: true, dimensionScores: true },
      });

      const monthlyDimMap = new Map<string, Map<string, number[]>>();
      const monthlyCounts = new Map<string, number>();

      for (const s of sessions) {
        if (!s.completedAt) continue;
        const key = `${s.completedAt.getFullYear()}-${String(s.completedAt.getMonth() + 1).padStart(2, "0")}`;
        monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
        let dimMap = monthlyDimMap.get(key);
        if (!dimMap) {
          dimMap = new Map();
          monthlyDimMap.set(key, dimMap);
        }
        accumulateDimensionValues(dimMap, s.dimensionScores);
      }

      const months = [...monthlyDimMap.keys()].sort((a, b) =>
        a.localeCompare(b),
      );

      const points = months.map((month) => {
        const dimMap = monthlyDimMap.get(month)!;
        const avgs = finalizeDimensionAvgs(dimMap);
        const flat: Record<string, number> = {};
        for (const [k, v] of Object.entries(avgs)) {
          flat[k] = v.avg;
        }
        return {
          month,
          completionCount: monthlyCounts.get(month) ?? 0,
          dimensions: flat,
        };
      });

      return reply.send({ data: { points } });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: "Aylık boyut trendleri alınırken hata oluştu",
        traceId: request.traceId,
      });
    }
  });
};

export default analyticsRoutes;
