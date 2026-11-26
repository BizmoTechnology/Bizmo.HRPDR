"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, BellRing, CheckCircle2, Loader2, RotateCcw, Users } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { AppMark } from "@/components/AppMark";
import { api, errorMessage, getPersonnel, hasToken } from "@/lib/api";
import {
  RELATION_FOR_RATER,
  formatDue,
  type ReviewAssignmentSummary,
  type ReviewNotice,
} from "@/lib/reviews";

export default function ReviewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewAssignmentSummary[]>([]);
  const [notices, setNotices] = useState<ReviewNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/api/reviews/portal/assignments");
      setItems(data?.data ?? []);
      const n: ReviewNotice[] = data?.meta?.notices ?? [];
      setNotices(n);
      // Görülen hatırlatmalar okundu sayılır
      if (n.length > 0) void api.post("/api/reviews/portal/notices/read").catch(() => undefined);
    } catch (err) {
      setError(errorMessage(err, "Değerlendirmeler yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const p = getPersonnel();
    if (!p || !hasToken()) {
      router.replace("/login");
      return;
    }
    setFirstName(p.firstName);
    void load();
  }, [router, load]);

  const pending = items.filter((a) => a.status === "NOT_STARTED" || a.status === "IN_PROGRESS");
  const done = items.filter((a) => a.status === "COMPLETED");

  return (
    <main className="bz-aurora flex min-h-dvh w-full justify-center px-4 py-8 sm:py-12">
      <motion.div
        className="w-full max-w-[560px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link href="/home" className="bz-btn bz-btn--ghost bz-btn--sm text-fg2">
            <ArrowLeft />
            Panelim
          </Link>
          <div className="flex items-center gap-2">
            <AppMark size="sm" />
            <span className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
              PotansiyelHaritası
            </span>
          </div>
        </div>

        <GlassCard className="rounded-3xl p-5 shadow-2 sm:p-7">
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
            Değerlendirmem gereken kişiler
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-fg2">
            {firstName ? `${firstName}, ` : ""}360° geri bildirim döneminde sizden görüş bekleyen çalışma arkadaşlarınız.
          </p>

          {notices.length > 0 && (
            <div className="bz-alert bz-alert--info mt-4" role="status">
              <BellRing aria-hidden="true" />
              <div>
                <p className="bz-alert__title">{notices[0]!.title}</p>
                {notices[0]!.body && <p>{notices[0]!.body}</p>}
              </div>
            </div>
          )}

          {loading ? (
            <div role="status" className="flex flex-col items-center gap-3 py-12 text-fg3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Yükleniyor…</p>
            </div>
          ) : error ? (
            <div role="alert" className="bz-empty px-2 py-8">
              <span className="bz-icon-box text-danger">
                <AlertCircle />
              </span>
              <p className="bz-empty__title">Liste yüklenemedi</p>
              <p className="bz-empty__text">{error}</p>
              <button type="button" onClick={() => void load()} className="bz-btn bz-btn--soft mt-2">
                <RotateCcw />
                Tekrar dene
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="bz-empty px-2 py-8">
              <span className="bz-icon-box">
                <Users />
              </span>
              <p className="bz-empty__title">Bekleyen değerlendirme yok</p>
              <p className="bz-empty__text">İK bir 360° dönemi başlattığında değerlendirmeniz istenen kişiler burada görünür.</p>
            </div>
          ) : (
            <>
              <section className="mt-5" aria-labelledby="pending-title">
                <h2 id="pending-title" className="bz-kicker mb-2.5">
                  Bekleyen ({pending.length})
                </h2>
                {pending.length === 0 ? (
                  <p className="rounded-2xl border border-divider bg-surface-2 px-4 py-3 text-[14px] text-fg2">
                    Tüm değerlendirmeleri tamamladınız. Teşekkürler!
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {pending.map((a) => {
                      const due = formatDue(a.cycle.dueAt);
                      const overdue = !!a.cycle.dueAt && new Date(a.cycle.dueAt) < new Date();
                      const pct = a.questionCount > 0 ? Math.round((a.answeredCount / a.questionCount) * 100) : 0;
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/reviews/${a.id}`}
                            className="group flex items-center gap-3 rounded-2xl border border-divider bg-surface-2 px-4 py-3.5 transition-colors hover:border-[var(--bz-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-foreground">
                                {a.relation === "SELF" ? "Kendiniz" : `${a.subject.firstName} ${a.subject.lastName}`}
                              </span>
                              <span className="block truncate text-[12.5px] text-fg3">
                                {RELATION_FOR_RATER[a.relation]} · {a.subject.position}
                              </span>
                              <span className="mt-2 flex items-center gap-2">
                                <span
                                  className="bz-progress flex-1"
                                  role="progressbar"
                                  aria-label="Cevaplanan soru"
                                  aria-valuenow={pct}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                >
                                  <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
                                </span>
                                <span className="text-[11.5px] tabular-nums text-fg3">
                                  {a.answeredCount}/{a.questionCount}
                                </span>
                              </span>
                              {due && (
                                <span className={`mt-1 block text-[11.5px] ${overdue ? "font-semibold text-danger-ink" : "text-fg3"}`}>
                                  {overdue ? "Son gün geçti: " : "Son gün: "}
                                  {due}
                                </span>
                              )}
                            </span>
                            <span className="bz-btn bz-btn--soft bz-btn--sm shrink-0">
                              {a.status === "IN_PROGRESS" ? "Devam et" : "Başla"}
                              <ArrowRight />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {done.length > 0 && (
                <section className="mt-6" aria-labelledby="done-title">
                  <h2 id="done-title" className="bz-kicker mb-2.5">
                    Tamamlanan ({done.length})
                  </h2>
                  <ul className="space-y-1.5">
                    {done.map((a) => (
                      <li key={a.id} className="flex items-center gap-2.5 px-1 text-[14px] text-fg2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.relation === "SELF" ? "Öz değerlendirme" : `${a.subject.firstName} ${a.subject.lastName}`}
                        </span>
                        <span className="text-xs text-fg3">{a.cycle.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </GlassCard>
      </motion.div>
    </main>
  );
}
