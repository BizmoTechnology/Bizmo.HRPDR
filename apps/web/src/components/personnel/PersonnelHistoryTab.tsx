"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Briefcase,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  History,
  Hourglass,
  PlayCircle,
  Radar,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";
import { TERMINATION_REASON_LABELS } from "@ph/shared";
import { cn } from "@/lib/utils";
import type {
  HistoryEvent,
  HistoryReviewResult,
  HistorySession,
  PersonnelHistory,
} from "@/hooks/use-personnel-history";

type Filter = "all" | "sessions" | "events";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "sessions", label: "Testler ve 360°" },
  { key: "events", label: "Olaylar" },
];

/** Oturum durumu → süreç durumu rozeti (.bz-status, DESIGN.md §13) */
const SESSION_STATUS: Record<string, { label: string; status: string }> = {
  COMPLETED: { label: "Tamamlandı", status: "done" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  NOT_STARTED: { label: "Başlamadı", status: "draft" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  EXPIRED: { label: "Süresi doldu", status: "cancelled" },
};

const REVIEW_CHIP: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "İK onaylı", tone: "bz-chip--success" },
  PENDING: { label: "İK onayı bekliyor", tone: "bz-chip--warning" },
  REJECTED: { label: "İK reddetti", tone: "bz-chip--danger" },
};

const fmtDate = (iso: string) => format(new Date(iso), "d MMMM yyyy", { locale: tr });
const fmtDateTime = (iso: string) => format(new Date(iso), "d MMM yyyy · HH:mm", { locale: tr });

function durationText(sec: number | null) {
  if (!sec || sec <= 0) return null;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} dk`;
  return `${Math.floor(min / 60)} sa ${min % 60} dk`;
}

function sessionTone(s: HistorySession): string | undefined {
  if (s.review?.status === "REJECTED") return "warning";
  if (s.status === "COMPLETED" && s.review?.status === "APPROVED") return "success";
  if (s.status === "IN_PROGRESS" || s.status === "PAUSED") return "info";
  return undefined;
}

function SessionIcon({ s }: { s: HistorySession }) {
  if (s.review?.status === "REJECTED") return <XCircle aria-hidden="true" />;
  if (s.status === "COMPLETED") return <CheckCircle2 aria-hidden="true" />;
  if (s.status === "IN_PROGRESS" || s.status === "PAUSED") return <PlayCircle aria-hidden="true" />;
  if (s.status === "EXPIRED") return <Hourglass aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function ScoreText({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span className="tabular-nums">
      Genel skor{" "}
      <b
        className={cn(
          "font-semibold",
          value >= 8 ? "text-success-ink" : value >= 6 ? "text-warning-ink" : "text-danger-ink",
        )}
      >
        {value.toFixed(1)}
      </b>
      <span className="text-fg3"> /10</span>
    </span>
  );
}

function SessionItem({ s, canViewAnalysis }: { s: HistorySession; canViewAnalysis: boolean }) {
  const status = SESSION_STATUS[s.status];
  const review = s.review ? REVIEW_CHIP[s.review.status] : null;
  const date = s.completedAt ?? s.startedAt ?? s.createdAt;
  const dateLabel = s.completedAt ? "Tamamlandı" : s.startedAt ? "Başladı" : "Atandı";
  const duration = durationText(s.durationSec);
  const strengths = s.swot?.strengths ?? [];
  const weaknesses = s.swot?.weaknesses ?? [];

  return (
    <li className="bz-timeline-item" data-tone={sessionTone(s)}>
      <span className="bz-timeline-item__dot">
        <SessionIcon s={s} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/assessments/${s.assessment.id}?session=${s.id}`}
            className="text-[14px] font-semibold text-foreground hover:underline focus-visible:underline"
          >
            {s.assessment.title}
          </Link>
          {status ? (
            <span className="bz-status" data-status={status.status}>
              {status.label}
            </span>
          ) : (
            <span className="bz-chip">{s.status}</span>
          )}
          {review && <span className={cn("bz-chip bz-chip--sm", review.tone)}>{review.label}</span>}
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-fg3">
          <time dateTime={date} className="tabular-nums">
            {dateLabel} · {fmtDateTime(date)}
          </time>
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {duration}
            </span>
          )}
          {canViewAnalysis && (
            <span className="text-fg2">
              <ScoreText value={s.overallScore} />
            </span>
          )}
        </p>

        {canViewAnalysis && s.keyInsights && (
          <p className="max-w-[72ch] text-[13px] leading-relaxed text-fg2">{s.keyInsights}</p>
        )}

        {canViewAnalysis && (strengths.length > 0 || weaknesses.length > 0) && (
          <dl className="grid max-w-[72ch] gap-1.5 text-[12.5px] sm:grid-cols-2 sm:gap-x-6">
            {strengths.length > 0 && (
              <div className="min-w-0">
                <dt className="font-semibold text-foreground">Güçlü yanlar</dt>
                <dd className="mt-0.5 text-fg2">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {strengths.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="min-w-0">
                <dt className="font-semibold text-foreground">Gelişim alanları</dt>
                <dd className="mt-0.5 text-fg2">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {weaknesses.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}

        {canViewAnalysis && s.careerPaths?.shortTerm && (
          <p className="max-w-[72ch] text-[12.5px] text-fg2">
            <span className="font-semibold text-foreground">Kısa vadeli kariyer hedefi: </span>
            {s.careerPaths.shortTerm}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-[12.5px]">
          <Link
            href={`/assessments/${s.assessment.id}?session=${s.id}`}
            className="bz-link inline-flex items-center gap-1"
          >
            Oturumu aç
          </Link>
          {canViewAnalysis && s.reportId && (
            <Link
              href={`/reports/${s.reportId}`}
              className="bz-link bz-link--data inline-flex items-center gap-1"
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              Rapor
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function EventItem({ e }: { e: HistoryEvent }) {
  if (e.type === "TERMINATED") {
    return (
      <li className="bz-timeline-item" data-tone="danger">
        <span className="bz-timeline-item__dot">
          <UserMinus aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[14px] font-semibold text-foreground">
            İşten ayrıldı
            {e.reason && (
              <span className="font-normal text-fg2"> · {TERMINATION_REASON_LABELS[e.reason]}</span>
            )}
          </p>
          <p className="text-[12.5px] text-fg3">
            <time dateTime={e.date} className="tabular-nums">
              {fmtDate(e.date)}
            </time>
          </p>
          {e.note && (
            <p className="max-w-[72ch] whitespace-pre-wrap text-[13px] leading-relaxed text-fg2">
              {e.note}
            </p>
          )}
        </div>
      </li>
    );
  }
  const hired = e.type === "HIRED";
  return (
    <li className="bz-timeline-item" data-tone={hired ? "success" : undefined}>
      <span className="bz-timeline-item__dot">
        {hired ? <UserPlus aria-hidden="true" /> : <Briefcase aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[14px] font-semibold text-foreground">
          {hired ? "İşe başladı" : "Personel kaydı oluşturuldu"}
        </p>
        <p className="text-[12.5px] text-fg3">
          <time dateTime={e.date} className="tabular-nums">
            {fmtDate(e.date)}
          </time>
        </p>
      </div>
    </li>
  );
}

/** 360° dönem sonucu (kapanmış dönem); rapor bağlantısı yalnız analiz yetkisine */
function ReviewItem({ r, canViewAnalysis }: { r: HistoryReviewResult; canViewAnalysis: boolean }) {
  const date = r.releasedAt ?? r.closedAt ?? r.periodEnd;
  return (
    <li className="bz-timeline-item" data-tone="info">
      <span className="bz-timeline-item__dot">
        <Radar aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {canViewAnalysis ? (
            <Link
              href={`/performance/cycles/${r.cycleId}/subjects/${r.id}`}
              className="text-[14px] font-semibold text-foreground hover:underline focus-visible:underline"
            >
              360° · {r.cycleName}
            </Link>
          ) : (
            <span className="text-[14px] font-semibold text-foreground">360° · {r.cycleName}</span>
          )}
          <span className="bz-status" data-status={r.released ? "approved" : "done"}>
            {r.released ? "Yayınlandı" : "Kapandı"}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-fg3">
          {date && (
            <time dateTime={date} className="tabular-nums">
              {r.released ? "Yayınlandı" : "Kapandı"} · {fmtDate(date)}
            </time>
          )}
          {canViewAnalysis && r.totalRaters !== null && (
            <span className="tabular-nums">
              {r.completedRaters} / {r.totalRaters} değerlendirici
            </span>
          )}
          {canViewAnalysis && (
            <span className="text-fg2">
              <ScoreText value={r.overallScore} />
            </span>
          )}
        </p>
        {canViewAnalysis && (r.selfScore !== null || r.othersScore !== null) && (
          <p className="text-[12.5px] text-fg2 tabular-nums">
            Öz {r.selfScore?.toLocaleString("tr-TR") ?? "—"} · Diğerleri{" "}
            {r.othersScore?.toLocaleString("tr-TR") ?? "—"}
          </p>
        )}
      </div>
    </li>
  );
}

export function PersonnelHistoryTab({ history }: { history: PersonnelHistory }) {
  const [filter, setFilter] = useState<Filter>("all");

  const sessionsById = useMemo(
    () => new Map(history.sessions.map((s) => [s.id, s])),
    [history.sessions],
  );
  const eventsById = useMemo(
    () => new Map(history.events.map((e) => [e.id, e])),
    [history.events],
  );
  const reviewsById = useMemo(
    () => new Map(history.reviews.map((r) => [r.id, r])),
    [history.reviews],
  );

  const entries = history.timeline.filter((t) =>
    filter === "all" ? true : filter === "sessions" ? t.kind !== "event" : t.kind === "event",
  );

  const { summary } = history;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg2 tabular-nums">
          <b className="text-foreground">{summary.totalSessions}</b> test ·{" "}
          <b className="text-foreground">{summary.completedSessions}</b> tamamlandı ·{" "}
          <b className="text-foreground">{summary.approvedSessions}</b> İK onaylı
        </p>
        <div className="bz-segmented" role="group" aria-label="Zaman çizelgesi süzgeci">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bz-empty py-10">
          <History className="h-7 w-7 text-fg3" aria-hidden="true" />
          <p className="bz-empty__title text-[15px]">Kayıt yok</p>
          <p className="bz-empty__text">
            {filter === "sessions"
              ? "Bu personele henüz test atanmamış."
              : "Bu süzgeçte gösterilecek olay yok."}
          </p>
        </div>
      ) : (
        <ol className="bz-timeline" aria-label="Personel geçmişi, en yeni üstte">
          {entries.map((t) => {
            if (t.kind === "session") {
              const s = sessionsById.get(t.sessionId);
              return s ? (
                <SessionItem key={t.id} s={s} canViewAnalysis={history.canViewAnalysis} />
              ) : null;
            }
            if (t.kind === "event") {
              const e = eventsById.get(t.eventId);
              return e ? <EventItem key={t.id} e={e} /> : null;
            }
            const r = reviewsById.get(t.reviewId);
            return r ? <ReviewItem key={t.id} r={r} canViewAnalysis={history.canViewAnalysis} /> : null;
          })}
        </ol>
      )}

      {!history.canViewAnalysis && (
        <p className="text-[12.5px] text-fg3">
          Skorlar, analiz özetleri ve raporlar yalnız analiz yetkisi olan rollere görünür.
        </p>
      )}
    </div>
  );
}
