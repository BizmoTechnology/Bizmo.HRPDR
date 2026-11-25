"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Lock,
  LogOut,
  Moon,
  RotateCcw,
  Sprout,
  Star,
  Sun,
} from "lucide-react";
import { GlassCard, useTheme } from "@ph/ui";
import { DIMENSION_DESCRIPTIONS, DIMENSION_LABELS } from "@ph/shared";
import { AppMark } from "@/components/AppMark";
import { errorMessage, getPersonnel, hasToken, logout } from "@/lib/api";
import {
  getProfile,
  getResults,
  getTasks,
  type PortalAssessmentResult,
  type PortalProfile,
  type PortalResults,
  type PortalTask,
  type PortalTasks,
} from "@/lib/me";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

function formatScore(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Personel portalı ana sayfası: bekleyen testler + paylaşılan sonuçlar */
export default function HomePage() {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  const [firstName, setFirstName] = useState<string>("");
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [tasks, setTasks] = useState<PortalTasks | null>(null);
  const [results, setResults] = useState<PortalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, t, r] = await Promise.all([getProfile(), getTasks(), getResults()]);
      setProfile(p);
      setTasks(t);
      setResults(r);
    } catch (err) {
      setLoadError(errorMessage(err, "Panel bilgileri alınamadı"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getPersonnel();
    if (!stored || !hasToken()) {
      router.replace("/login");
      return;
    }
    setFirstName(stored.firstName);
    void load();
  }, [router, load]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  const pending = tasks?.assessments ?? [];
  const shared = results?.assessments ?? [];
  const orgLine = [profile?.position, profile?.department, profile?.team].filter(Boolean).join(" · ");

  return (
    <main className="bz-aurora min-h-dvh w-full px-4 pb-12 pt-5 sm:pt-8">
      <div className="mx-auto w-full max-w-[760px]">
        {/* Üst çubuk: marka + tema + çıkış */}
        <header className="mb-6 flex items-center gap-2.5">
          <AppMark size="sm" />
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
            PotansiyelHaritası
          </span>
          <button
            type="button"
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
            className="bz-icon-btn"
            aria-label={resolved === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            title={resolved === "dark" ? "Açık tema" : "Koyu tema"}
          >
            {resolved === "dark" ? <Sun /> : <Moon />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="bz-btn bz-btn--sm"
          >
            <LogOut />
            Çıkış yap
          </button>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          <div className="mb-6">
            <p className="bz-kicker">Panelim</p>
            <h1 className="mt-1 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground sm:text-[30px]">
              Merhaba{firstName ? `, ${firstName}` : ""}!
            </h1>
            {orgLine && <p className="mt-1 text-[14px] text-fg2">{orgLine}</p>}
          </div>

          {loading ? (
            <div className="space-y-4" role="status" aria-label="Yükleniyor">
              {[0, 1].map((i) => (
                <GlassCard key={i} hover={false} className="rounded-3xl p-5 sm:p-6">
                  <div className="bz-skeleton mb-3 h-4 w-40" />
                  <div className="bz-skeleton mb-2 h-3.5 w-full" />
                  <div className="bz-skeleton h-3.5 w-2/3" />
                </GlassCard>
              ))}
            </div>
          ) : loadError ? (
            <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
              <div role="alert" className="bz-empty px-2 py-8">
                <span className="bz-icon-box text-danger">
                  <AlertCircle />
                </span>
                <p className="bz-empty__title">Panel yüklenemedi</p>
                <p className="bz-empty__text">{loadError}</p>
                <button type="button" onClick={() => void load()} className="bz-btn bz-btn--soft mt-2">
                  <RotateCcw />
                  Tekrar dene
                </button>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-8">
              <TasksSection tasks={pending} onOpen={() => router.push("/welcome")} />
              <ResultsSection results={shared} />
              {/* TODO(entegrasyon): results.reviews (360° sonuçları) ve results.careerPlan
                  (onaylı kariyer yol haritası) burada ayrı bölümler olarak gösterilecek. */}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}

function SectionTitle({
  id,
  icon: Icon,
  title,
  count,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
      <h2 id={id} className="text-[16px] font-bold text-foreground">{title}</h2>
      {typeof count === "number" && count > 0 && (
        <span className="bz-chip bz-chip--sm tabular-nums">{count}</span>
      )}
    </div>
  );
}

function TasksSection({ tasks, onOpen }: { tasks: PortalTask[]; onOpen: () => void }) {
  return (
    <section aria-labelledby="tasks-title">
      <SectionTitle id="tasks-title" icon={ClipboardList} title="Bekleyen testlerim" count={tasks.length} />

      {tasks.length === 0 ? (
        <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bz-icon-box" aria-hidden="true">
              <ClipboardCheck />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">Bekleyen testin yok</p>
              <p className="text-[13px] text-fg3">
                Sana yeni bir değerlendirme atandığında burada görünür.
              </p>
            </div>
          </div>
        </GlassCard>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t, i) => {
            // Portal akışı testleri sırayla açar (yarım kalan önce): yalnız ilki başlatılabilir
            const isNext = i === 0;
            const resume = t.status === "IN_PROGRESS";
            const pct = t.questionCount > 0 ? Math.round((t.answeredCount / t.questionCount) * 100) : 0;
            const due = formatDate(t.dueAt);
            return (
              <li key={t.sessionId}>
                <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug text-foreground">
                        {t.assessment.title}
                      </p>
                      {t.assessment.description && (
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-fg3">{t.assessment.description}</p>
                      )}
                    </div>
                    <span className="bz-status" data-status={resume ? "progress" : "pending"}>
                      {resume ? "Devam ediyor" : "Başlamadı"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg3">
                    <span className="tabular-nums">
                      {t.answeredCount}/{t.questionCount} soru
                    </span>
                    {due && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        Son tarih: {due}
                      </span>
                    )}
                  </div>
                  {resume && (
                    <div
                      className="bz-progress mt-2"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label="Tamamlanma oranı"
                    >
                      <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {isNext ? (
                      <button type="button" onClick={onOpen} className="bz-btn bz-btn--primary">
                        {resume ? "Kaldığın yerden devam et" : "Teste başla"}
                        <ArrowRight />
                      </button>
                    ) : (
                      <p className="inline-flex items-center gap-1.5 text-[13px] text-fg3">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Önceki testi tamamladıktan sonra açılır
                      </p>
                    )}
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ResultsSection({ results }: { results: PortalAssessmentResult[] }) {
  return (
    <section aria-labelledby="results-title">
      <SectionTitle id="results-title" icon={Star} title="Sonuçlarım" count={results.length} />

      {results.length === 0 ? (
        <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
          <div className="bz-empty px-2 py-8">
            <span className="bz-icon-box" aria-hidden="true">
              <Lock />
            </span>
            <p className="bz-empty__title">Henüz paylaşılmış bir sonuç yok</p>
            <p className="bz-empty__text">
              İK ekibin değerlendirme sonucunu incelemesini tamamlayıp seninle paylaştığında
              sonucun burada görünür.
            </p>
          </div>
        </GlassCard>
      ) : (
        <ul className="space-y-4">
          {results.map((r) => (
            <li key={r.sessionId}>
              <ResultCard result={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultCard({ result: r }: { result: PortalAssessmentResult }) {
  const date = formatDate(r.completedAt);
  const career = r.careerPaths;
  const careerSteps = career
    ? [
        { key: "short", label: "Kısa vade", sub: "3 ay", text: career.shortTerm },
        { key: "mid", label: "Orta vade", sub: "6 ay", text: career.midTerm },
        { key: "long", label: "Uzun vade", sub: "1 yıl", text: career.longTerm },
      ].filter((s) => s.text)
    : [];

  return (
    <GlassCard hover={false} className="rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-foreground">{r.assessment.title}</p>
          {date && <p className="mt-0.5 text-[12.5px] text-fg3">Tamamlandı: {date}</p>}
        </div>
        {r.overallScore !== null && (
          <div className="flex-none text-right">
            <p className="font-display text-[28px] font-extrabold leading-none tabular-nums text-foreground">
              {formatScore(r.overallScore)}
              <span className="text-[14px] font-bold text-fg3">/10</span>
            </p>
            <p className="mt-1 text-[11.5px] text-fg3">Genel skor</p>
          </div>
        )}
      </div>

      {r.dimensionScores.length > 0 && (
        <ul className="mt-5 space-y-3" aria-label="Boyut skorları">
          {r.dimensionScores.map((d) => {
            const label = DIMENSION_LABELS[d.dimension] ?? d.dimension;
            const pct = Math.max(0, Math.min(100, d.score * 10));
            return (
              <li key={d.dimension} title={DIMENSION_DESCRIPTIONS[d.dimension]}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-medium text-fg2">{label}</span>
                  <span className="flex-none font-semibold tabular-nums text-foreground">
                    {formatScore(d.score)}
                  </span>
                </div>
                <div
                  className="bz-progress bz-progress--data"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={10}
                  aria-valuenow={d.score}
                  aria-label={label}
                >
                  <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {r.executiveSummary && (
        <p className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-fg2">{r.executiveSummary}</p>
      )}

      <div className="mt-4">
        {r.strengths.length > 0 && (
          <details className="bz-accordion">
            <summary>
              <Star className="h-4 w-4 text-fg3" aria-hidden="true" />
              Güçlü yönlerim
              <span className="bz-chip bz-chip--sm tabular-nums">{r.strengths.length}</span>
            </summary>
            <ul className="list-disc space-y-1.5 pb-4 pl-9 pr-2 text-[13.5px] leading-relaxed text-fg2">
              {r.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
        )}

        {r.developmentAreas.length > 0 && (
          <details className="bz-accordion">
            <summary>
              <Sprout className="h-4 w-4 text-fg3" aria-hidden="true" />
              Gelişim alanlarım
              <span className="bz-chip bz-chip--sm tabular-nums">{r.developmentAreas.length}</span>
            </summary>
            <ul className="space-y-3 pb-4 pl-9 pr-2 text-[13.5px] leading-relaxed">
              {r.developmentAreas.map((d, i) => (
                <li key={i}>
                  <p className="font-semibold text-foreground">{d.area}</p>
                  {d.recommendation && <p className="mt-0.5 text-fg2">{d.recommendation}</p>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {careerSteps.length > 0 && (
          <details className="bz-accordion">
            <summary>
              <Compass className="h-4 w-4 text-fg3" aria-hidden="true" />
              Kariyer önerileri
            </summary>
            <ol className="space-y-3 pb-4 pl-9 pr-2 text-[13.5px] leading-relaxed">
              {careerSteps.map((s) => (
                <li key={s.key}>
                  <p className="font-semibold text-foreground">
                    {s.label} <span className="font-normal text-fg3">· {s.sub}</span>
                  </p>
                  <p className="mt-0.5 text-fg2">{s.text}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      <p className="mt-4 text-[12px] text-fg3">
        Bu sonuç İK ekibin tarafından incelenip seninle paylaşıldı. Sorularını İK yöneticine
        iletebilirsin.
      </p>
    </GlassCard>
  );
}
