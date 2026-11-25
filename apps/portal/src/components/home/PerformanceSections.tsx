"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Circle, CircleDot, EyeOff, Route, Users, Radar } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { DIMENSION_LABELS } from "@ph/shared";
import type { PortalCareerPlan, PortalReviewResult, PortalReviewTask } from "@/lib/me";
import { RELATION_FOR_RATER } from "@/lib/reviews";

/**
 * "Panelim" için 360° ve kariyer bölümleri (Aşama 1/3 ↔ Aşama 4 entegrasyonu).
 * Ana sayfaya ayrı bileşen olarak eklenir; sunucu yalnız yayınlanmış/onaylı ve
 * paylaşımı açık kayıtları döndürür.
 */

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function fmt(n: number | null | undefined) {
  return typeof n === "number"
    ? n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "—";
}

function Title({ id, icon: Icon, title, count }: { id: string; icon: React.ComponentType; title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
      <h2 id={id} className="text-[16px] font-bold text-foreground">
        {title}
      </h2>
      {typeof count === "number" && count > 0 && <span className="bz-chip bz-chip--sm tabular-nums">{count}</span>}
    </div>
  );
}

/** Bekleyen 360° değerlendirici görevleri: her biri doğrudan forma açılır */
export function ReviewTasksSection({ tasks }: { tasks: PortalReviewTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="review-tasks-title">
      <Title id="review-tasks-title" icon={Users} title="Değerlendirmem gereken kişiler" count={tasks.length} />
      <ul className="space-y-3">
        {tasks.map((t) => {
          const due = fmtDate(t.cycle.dueAt);
          const overdue = !!t.cycle.dueAt && new Date(t.cycle.dueAt) < new Date();
          return (
            <li key={t.assignmentId}>
              <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-foreground">
                      {t.relation === "SELF" ? "Öz değerlendirme" : `${t.subject.firstName} ${t.subject.lastName}`}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg3">
                      {RELATION_FOR_RATER[t.relation]} · {t.cycle.name}
                    </p>
                  </div>
                  <span className="bz-status" data-status={t.status === "IN_PROGRESS" ? "progress" : "pending"}>
                    {t.status === "IN_PROGRESS" ? "Devam ediyor" : "Başlamadı"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg3">
                  <span className="tabular-nums">
                    {t.answeredCount}/{t.questionCount} soru
                  </span>
                  {due && (
                    <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-danger-ink" : ""}`}>
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {overdue ? "Son gün geçti: " : "Son gün: "}
                      {due}
                    </span>
                  )}
                </div>
                <Link href={`/reviews/${t.assignmentId}`} className="bz-btn bz-btn--soft mt-4">
                  {t.status === "IN_PROGRESS" ? "Devam et" : "Değerlendir"}
                  <ArrowRight />
                </Link>
              </GlassCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Yayınlanmış ve paylaşılan 360° sonuçları */
export function ReviewResultsSection({ results }: { results: PortalReviewResult[] }) {
  if (results.length === 0) return null;
  return (
    <section aria-labelledby="review-results-title">
      <Title id="review-results-title" icon={Radar} title="360° geri bildirimlerim" count={results.length} />
      <ul className="space-y-4">
        {results.map((r) => (
          <li key={r.subjectId}>
            <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">{r.cycle.name}</p>
                  {r.releasedAt && <p className="text-[12.5px] text-fg3">Paylaşıldı: {fmtDate(r.releasedAt)}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-[26px] font-extrabold leading-none tabular-nums text-foreground">
                    {fmt(r.overall.others)}
                  </p>
                  <p className="text-[11.5px] text-fg3">diğerlerinin ortalaması · 10 üzerinden</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="bz-table">
                  <caption className="sr-only">Yetkinlik puanları: siz ve diğerleri</caption>
                  <thead>
                    <tr>
                      <th scope="col">Yetkinlik</th>
                      <th scope="col" className="is-num">Siz</th>
                      <th scope="col" className="is-num">Diğerleri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.dimensions.map((d) => (
                      <tr key={d.dimension}>
                        <td>{(DIMENSION_LABELS as Record<string, string>)[d.dimension] ?? d.dimension}</td>
                        <td className="is-num tabular-nums">{fmt(d.self)}</td>
                        <td className="is-num tabular-nums font-semibold">{fmt(d.others)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {r.groups
                  .filter((g) => g.relation !== "SELF" && g.hiddenReason !== "NO_RATERS")
                  .map((g) =>
                    g.visible ? (
                      <li key={g.relation} className="bz-chip bz-chip--sm tabular-nums">
                        {g.label}: {fmt(g.overall)}
                      </li>
                    ) : (
                      <li key={g.relation} className="bz-chip bz-chip--sm">
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                        {g.label}: gizli (en az {r.anonymityMinRaters} kişi gerekir)
                      </li>
                    ),
                  )}
              </ul>

              {(r.strengths.length > 0 || r.developmentAreas.length > 0) && (
                <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
                  {r.strengths.length > 0 && (
                    <div>
                      <dt className="font-semibold text-foreground">Güçlü yanların</dt>
                      <dd className="mt-1 text-fg2">
                        <ul className="list-disc space-y-0.5 pl-4">
                          {r.strengths.map((i) => (
                            <li key={i.text}>{i.text}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  {r.developmentAreas.length > 0 && (
                    <div>
                      <dt className="font-semibold text-foreground">Gelişim alanların</dt>
                      <dd className="mt-1 text-fg2">
                        <ul className="list-disc space-y-0.5 pl-4">
                          {r.developmentAreas.map((i) => (
                            <li key={i.text}>{i.text}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {r.comments.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[13px] font-semibold text-foreground">
                    Yorumlar ({r.comments.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {r.comments.map((c, i) => (
                      <li key={i} className="bz-well rounded-xl p-3 text-[13px] text-fg2">
                        “{c.text}”
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="mt-3 text-[11.5px] text-fg3">
                Eş düzey ve ast puanları yalnız grup ortalaması olarak gösterilir; kimin ne verdiği görünmez.
              </p>
            </GlassCard>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  DONE: CheckCircle2,
  IN_PROGRESS: CircleDot,
  TODO: Circle,
};
const STEP_LABEL: Record<string, string> = { DONE: "Tamamlandı", IN_PROGRESS: "Devam ediyor", TODO: "Yapılacak" };

/** Onaylı ve paylaşılan kariyer yol haritası */
export function CareerPlanSection({ plan }: { plan: PortalCareerPlan | null }) {
  if (!plan) return null;
  const done = plan.steps.filter((s) => s.status === "DONE").length;
  const pct = plan.steps.length ? Math.round((done / plan.steps.length) * 100) : 0;
  return (
    <section aria-labelledby="career-title">
      <Title id="career-title" icon={Route} title="Kariyer yol haritam" />
      <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
        <p className="text-[15px] font-semibold text-foreground">{plan.targetRole ?? "Kariyer planı"}</p>
        <p className="text-[12.5px] text-fg3">
          {plan.horizonMonths} aylık plan{plan.approvedAt ? ` · Onay: ${fmtDate(plan.approvedAt)}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div
            className="bz-progress flex-1"
            role="progressbar"
            aria-label="Plan ilerlemesi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
          </div>
          <span className="text-xs tabular-nums text-fg3">
            {done}/{plan.steps.length}
          </span>
        </div>
        <ol className="mt-4 space-y-2.5">
          {plan.steps.map((s) => {
            const Icon = STEP_ICON[s.status] ?? Circle;
            return (
              <li key={s.id} className="flex items-start gap-2.5 text-[14px]">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.status === "DONE" ? "text-success" : "text-fg3"}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={s.status === "DONE" ? "text-fg3 line-through" : "text-foreground"}>{s.title}</span>
                  <span className="block text-[12px] text-fg3">
                    {STEP_LABEL[s.status] ?? s.status}
                    {s.targetDate ? ` · Hedef: ${fmtDate(s.targetDate)}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </GlassCard>
    </section>
  );
}
