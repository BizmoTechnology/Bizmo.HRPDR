"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  FileBarChart2,
  Loader2,
  Lock,
  MailX,
  Rocket,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import {
  RELATION_LABEL,
  describeDelivery,
  useActivateCycle,
  useCloseCycle,
  useCycleDashboard,
  useDeleteReviewCycle,
  useOrgChart,
  useRemindRaters,
  useReviewCycle,
  useSaveAssignments,
  useSuggestRaters,
  useUpdateReviewCycle,
  type ReviewAssignmentStatus,
  type ReviewCycleDetail,
  type SubjectPlan,
} from "@/hooks/use-reviews";
import { Dialog } from "@/components/performance/Dialog";
import { ShareStatusChip, ShareWithEmployeeControl } from "@/components/sharing/ShareWithEmployee";
import { RaterBoard, type BoardPerson } from "@/components/performance/RaterBoard";
import { SubjectPicker } from "@/components/performance/SubjectPicker";
import {
  AssignmentStatusBadge,
  CycleStatusBadge,
  FREQUENCY_LABEL,
  formatDate,
  percent,
  personName,
} from "@/components/performance/shared";

type Tab = "overview" | "raters" | "results";

function planFromCycle(c: ReviewCycleDetail): SubjectPlan[] {
  return c.subjects.map((s) => ({
    personnelId: s.personnel.id,
    raters: s.assignments
      .filter((a) => a.status !== "DECLINED")
      .map((a) => ({ personnelId: a.rater.id, relation: a.relation })),
  }));
}

function samePlan(a: SubjectPlan[], b: SubjectPlan[]) {
  const key = (p: SubjectPlan[]) =>
    JSON.stringify(
      [...p]
        .map((s) => ({
          s: s.personnelId,
          r: [...s.raters].sort((x, y) => x.personnelId.localeCompare(y.personnelId)),
        }))
        .sort((x, y) => x.s.localeCompare(y.s)),
    );
  return key(a) === key(b);
}

export default function ReviewCycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canManage, canAnalyze } = usePermissions();
  const [tab, setTab] = useState<Tab>("overview");
  const { data: cycle, isLoading, isError, refetch } = useReviewCycle(id);
  const isDraft = cycle?.status === "DRAFT";
  const { data: dash } = useCycleDashboard(id, !!cycle && !isDraft);
  const { data: chart } = useOrgChart();

  const activate = useActivateCycle();
  const close = useCloseCycle();
  const remove = useDeleteReviewCycle();
  const remind = useRemindRaters();
  const save = useSaveAssignments();
  const suggest = useSuggestRaters();
  const updateCycle = useUpdateReviewCycle();

  const [plan, setPlan] = useState<SubjectPlan[]>([]);
  const [confirm, setConfirm] = useState<"close" | "delete" | "activate" | null>(null);

  const serverPlan = useMemo(() => (cycle ? planFromCycle(cycle) : []), [cycle]);
  useEffect(() => setPlan(serverPlan), [serverPlan]);
  const dirty = !samePlan(plan, serverPlan);

  // Taslak dönemde ilk sekme değerlendiricilerdir (henüz ilerleme yok)
  useEffect(() => {
    if (isDraft) setTab("raters");
  }, [isDraft]);

  // Panoda değerlendirici olarak yalnız aktif personel; dönemde zaten olanlar da görünsün
  const people: BoardPerson[] = useMemo(() => {
    const map = new Map<string, BoardPerson>();
    for (const p of chart ?? []) if (p.status === "ACTIVE") map.set(p.id, p);
    for (const s of cycle?.subjects ?? []) {
      map.set(s.personnel.id, map.get(s.personnel.id) ?? s.personnel);
      for (const a of s.assignments) map.set(a.rater.id, map.get(a.rater.id) ?? a.rater);
    }
    return [...map.values()].sort((a, b) => personName(a).localeCompare(personName(b), "tr"));
  }, [chart, cycle]);

  const statusMap = useMemo(() => {
    const m = new Map<string, ReviewAssignmentStatus>();
    for (const s of cycle?.subjects ?? []) for (const a of s.assignments) m.set(`${s.personnel.id}:${a.rater.id}`, a.status);
    return m;
  }, [cycle]);

  if (isLoading) {
    return (
      <div className="bz-card space-y-3 p-5" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bz-skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !cycle) {
    return (
      <div className="bz-card">
        <div className="bz-empty" role="alert">
          <span className="bz-icon-box text-danger">
            <AlertCircle />
          </span>
          <p className="bz-empty__title">Dönem bulunamadı</p>
          <button type="button" className="bz-btn bz-btn--soft mt-2" onClick={() => void refetch()}>
            Tekrar dene
          </button>
        </div>
      </div>
    );
  }

  const canEditRaters = canManage && cycle.status !== "CLOSED";

  async function saveRaters() {
    try {
      const res = await save.mutateAsync({ id, subjects: plan });
      toast.success("Değerlendiriciler kaydedildi", {
        description: res.delivery ? describeDelivery(res.delivery) : undefined,
        duration: res.delivery ? 8000 : 4000,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Değerlendiriciler kaydedilemedi"));
    }
  }

  async function addSubjects(ids: string[]) {
    try {
      const s = await suggest.mutateAsync({ personnelIds: ids, includeSelf: cycle!.includeSelf });
      setPlan((prev) => [...prev, ...s.filter((x) => !prev.some((p) => p.personnelId === x.personnelId))]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Öneri alınamadı"));
    }
  }

  async function doRemind(assignmentIds?: string[]) {
    try {
      const r = await remind.mutateAsync({ id, assignmentIds });
      if (r.targeted === 0) {
        toast.info(
          r.skippedRecent > 0
            ? "Seçilenlere son bir saat içinde hatırlatma gönderilmiş; tekrar gönderilmedi."
            : "Hatırlatılacak bekleyen değerlendirme yok.",
        );
        return;
      }
      toast.success(`${r.targeted} değerlendirme için hatırlatma işlendi`, {
        description: describeDelivery(r.delivery) + (r.skippedRecent ? ` ${r.skippedRecent} kişi son bir saatte hatırlatıldığı için atlandı.` : ""),
        duration: 8000,
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Hatırlatma gönderilemedi"));
    }
  }

  async function runConfirm() {
    const action = confirm;
    setConfirm(null);
    try {
      if (action === "activate") {
        if (dirty) await save.mutateAsync({ id, subjects: plan });
        const r = await activate.mutateAsync(id);
        toast.success("Dönem başlatıldı", { description: describeDelivery(r.delivery), duration: 8000 });
        setTab("overview");
      } else if (action === "close") {
        await close.mutateAsync(id);
        toast.success("Dönem kapatıldı; sonuçlar donduruldu");
        setTab("results");
      } else if (action === "delete") {
        await remove.mutateAsync(id);
        toast.success("Taslak dönem silindi");
        router.push("/performance/cycles");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "İşlem tamamlanamadı"));
    }
  }

  const totals = dash?.totals;
  const pct = totals ? percent(totals.completed, totals.assignments) : 0;

  return (
    <div className="w-full">
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text min-w-0">
          <Link href="/performance/cycles" className="bz-btn bz-btn--ghost bz-btn--sm -ml-2 mb-1 w-fit">
            <ArrowLeft />
            360° dönemleri
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="bz-page-header__title">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
            <ShareStatusChip value={cycle.shareWithEmployee} />
          </div>
          <p className="bz-page-header__sub">
            {FREQUENCY_LABEL[cycle.frequency]} · {cycle.questionSet.name}
            {cycle.dueAt ? ` · Son gün ${formatDate(cycle.dueAt, true)}` : ""} · Eşik en az {cycle.anonymityMinRaters} kişi
          </p>
        </div>
        {canManage && (
          <div className="bz-page-header__actions">
            {cycle.status === "DRAFT" && (
              <>
                <button type="button" className="bz-btn bz-btn--ghost" onClick={() => setConfirm("delete")}>
                  <Trash2 />
                  Sil
                </button>
                <button type="button" className="bz-btn bz-btn--primary" onClick={() => setConfirm("activate")}>
                  <Rocket />
                  Dönemi başlat
                </button>
              </>
            )}
            {cycle.status === "ACTIVE" && (
              <button type="button" className="bz-btn" onClick={() => setConfirm("close")}>
                <Lock />
                Dönemi kapat
              </button>
            )}
          </div>
        )}
      </motion.div>

      <div className="bz-tabs mb-4" role="tablist" aria-label="Dönem bölümleri">
        {(
          [
            ["overview", "Genel bakış"],
            ["raters", "Değerlendiriciler"],
            ["results", "Sonuçlar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className="bz-tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Genel bakış ── */}
      {tab === "overview" && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-4">
          {isDraft ? (
            <div className="bz-card">
              <div className="bz-empty">
                <p className="bz-empty__title">Dönem henüz başlamadı</p>
                <p className="bz-empty__text">Değerlendiricileri gözden geçirip dönemi başlatınca ilerleme burada görünür.</p>
              </div>
            </div>
          ) : !dash ? (
            <div className="bz-skeleton h-40 rounded-2xl" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="bz-card bz-stat">
                  <span className="bz-stat__label">Tamamlanan</span>
                  <span className="bz-stat__value tabular-nums">%{pct}</span>
                  <span className="text-xs text-fg3 tabular-nums">
                    {totals!.completed} / {totals!.assignments} değerlendirme
                  </span>
                </div>
                <div className="bz-card bz-stat">
                  <span className="bz-stat__label">Değerlendirilen</span>
                  <span className="bz-stat__value tabular-nums">{totals!.subjects}</span>
                </div>
                <div className="bz-card bz-stat">
                  <span className="bz-stat__label">Devam eden</span>
                  <span className="bz-stat__value tabular-nums">{totals!.inProgress}</span>
                </div>
                <div className="bz-card bz-stat">
                  <span className="bz-stat__label">Başlamayan</span>
                  <span className={`bz-stat__value tabular-nums ${dash.isOverdue && totals!.notStarted > 0 ? "text-danger-ink" : ""}`}>
                    {totals!.notStarted}
                  </span>
                  {totals!.declined > 0 && <span className="text-xs text-fg3">{totals!.declined} kişi reddetti</span>}
                </div>
              </div>

              {!dash.mailConfigured && cycle.status === "ACTIVE" && (
                <div className="bz-alert bz-alert--info" role="status">
                  <MailX aria-hidden="true" />
                  <div>
                    <p className="bz-alert__title">E-posta bağlı değil</p>
                    <p>SMTP yapılandırılmadığı için davet ve hatırlatmalar yalnız portalda uygulama içi bildirim olarak görünür.</p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <section className="bz-card p-4" aria-labelledby="dept-progress">
                  <h2 id="dept-progress" className="mb-3 text-[15px] font-bold text-foreground">
                    Departmanlara göre ilerleme
                  </h2>
                  {dash.byDepartment.length === 0 ? (
                    <p className="text-sm text-fg3">Atama yok.</p>
                  ) : (
                    <ul className="space-y-3">
                      {dash.byDepartment.map((d) => {
                        const p = percent(d.completed, d.total);
                        return (
                          <li key={d.departmentId ?? "none"}>
                            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                              <span className="truncate font-semibold text-foreground">{d.name}</span>
                              <span className="shrink-0 tabular-nums text-fg2">
                                {d.completed} / {d.total} · %{p}
                              </span>
                            </div>
                            <div
                              className="bz-progress"
                              role="progressbar"
                              aria-label={`${d.name} ilerleme`}
                              aria-valuenow={p}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={{ "--value": `${p}%` } as CSSProperties} />
                            </div>
                            <p className="mt-0.5 text-[11.5px] text-fg3">{d.subjects} değerlendirilen</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="bz-card min-w-0 p-4" aria-labelledby="pending-title">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 id="pending-title" className="mr-auto text-[15px] font-bold text-foreground">
                      Bekleyen değerlendirmeler
                      <span className="ml-2 text-[13px] font-normal text-fg3">{dash.pending.length}</span>
                    </h2>
                    {dash.isOverdue && dash.pending.length > 0 && (
                      <span className="bz-chip bz-chip--danger">Son gün geçti</span>
                    )}
                    {canManage && cycle.status === "ACTIVE" && dash.pending.length > 0 && (
                      <button
                        type="button"
                        className="bz-btn bz-btn--soft bz-btn--sm"
                        onClick={() => void doRemind()}
                        disabled={remind.isPending}
                      >
                        {remind.isPending ? <Loader2 className="animate-spin" /> : <BellRing />}
                        Tümüne hatırlat
                      </button>
                    )}
                  </div>
                  {dash.pending.length === 0 ? (
                    <p className="text-sm text-fg3">Bekleyen değerlendirme yok.</p>
                  ) : (
                    <div className="bz-table-wrap">
                      <table className="bz-table">
                        <thead>
                          <tr>
                            <th scope="col">Değerlendirici</th>
                            <th scope="col" className="hidden sm:table-cell">
                              Değerlendirilen
                            </th>
                            <th scope="col">Durum</th>
                            <th scope="col" className="hidden md:table-cell">
                              Son hatırlatma
                            </th>
                            <th scope="col">
                              <span className="sr-only">Eylem</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dash.pending.map((p) => (
                            <tr key={p.assignmentId}>
                              <td className="whitespace-normal py-2">
                                <p className="font-semibold text-foreground">{personName(p.rater)}</p>
                                <p className="text-xs text-fg3">{p.rater.department?.name ?? "—"}</p>
                              </td>
                              <td className="hidden whitespace-normal sm:table-cell">
                                <p className="text-foreground">
                                  {p.relation === "SELF" ? "Kendisi" : personName(p.subject.personnel)}
                                </p>
                                <p className="text-xs text-fg3">{RELATION_LABEL[p.relation]}</p>
                              </td>
                              <td>
                                <AssignmentStatusBadge status={p.status} />
                              </td>
                              <td className="hidden text-xs text-fg2 md:table-cell">
                                {p.reminderSentAt
                                  ? `${formatDate(p.reminderSentAt, true)} (${p.reminderCount})`
                                  : "—"}
                              </td>
                              <td className="text-right">
                                {canManage && cycle.status === "ACTIVE" && (
                                  <button
                                    type="button"
                                    className="bz-btn bz-btn--ghost bz-btn--sm"
                                    onClick={() => void doRemind([p.assignmentId])}
                                    disabled={remind.isPending}
                                    aria-label={`${personName(p.rater)} kişisine hatırlat`}
                                  >
                                    <BellRing />
                                    <span className="hidden sm:inline">Hatırlat</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Değerlendiriciler ── */}
      {tab === "raters" && (
        <div id="panel-raters" role="tabpanel" aria-labelledby="tab-raters" className="space-y-3">
          {canEditRaters ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-[13px] text-fg2">
                {cycle.status === "ACTIVE"
                  ? "Dönem sürerken değerlendirici ekleyip çıkarabilirsiniz; yeni eklenenlere davet gider. Tamamlanan değerlendirmeler kilitlidir."
                  : "Kişileri sürükleyerek ya da “Taşı” ile gruplara yerleştirin."}
              </p>
              <SubjectPicker
                people={people}
                existing={new Set(plan.map((s) => s.personnelId))}
                onAdd={(ids) => void addSubjects(ids)}
              />
              {dirty && (
                <button type="button" className="bz-btn" onClick={() => setPlan(serverPlan)} disabled={save.isPending}>
                  <Undo2 />
                  Vazgeç
                </button>
              )}
              <button
                type="button"
                className="bz-btn bz-btn--primary"
                onClick={() => void saveRaters()}
                disabled={!dirty || save.isPending}
              >
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Değişiklikleri kaydet
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-fg2">
              {cycle.status === "CLOSED" ? "Dönem kapandı; değerlendiriciler değiştirilemez." : "Düzenleme yetkiniz yok."}
            </p>
          )}
          <RaterBoard
            people={people}
            plan={plan}
            onChange={setPlan}
            anonymityMinRaters={cycle.anonymityMinRaters}
            statusOf={(sid, rid) => statusMap.get(`${sid}:${rid}`)}
            onRemoveSubject={
              canEditRaters
                ? (sid) => {
                    const done = cycle.subjects
                      .find((s) => s.personnel.id === sid)
                      ?.assignments.some((a) => a.status === "COMPLETED");
                    if (done) {
                      toast.error("Tamamlanmış değerlendirmesi olan kişi dönemden çıkarılamaz");
                      return;
                    }
                    setPlan((p) => p.filter((s) => s.personnelId !== sid));
                  }
                : undefined
            }
            disabled={!canEditRaters}
          />
        </div>
      )}

      {/* ── Sonuçlar ── */}
      {tab === "results" && (
        <div id="panel-results" role="tabpanel" aria-labelledby="tab-results" className="space-y-3">
          {!canAnalyze && (
            <div className="bz-alert bz-alert--info" role="status">
              <Lock aria-hidden="true" />
              <p>Bireysel 360° sonuçlarını yalnız İK ve analist rolleri görebilir.</p>
            </div>
          )}
          {canManage && (
            <div className="bz-card p-4">
              <ShareWithEmployeeControl
                value={cycle.shareWithEmployee}
                disabled={updateCycle.isPending}
                label="Yayınlanan sonuçları personelle paylaş"
            requirement="Personel, yalnız yayınladığınız 360° sonucunu portalında görür."
                onChange={async (next) => {
                  try {
                    await updateCycle.mutateAsync({ id: cycle.id, data: { shareWithEmployee: next } });
                    toast.success("Paylaşım tercihi kaydedildi");
                  } catch (err) {
                    toast.error(apiErrorMessage(err, "Paylaşım tercihi kaydedilemedi"));
                  }
                }}
              />
              <p className="bz-hint mt-1">
                Personel yalnız yayınladığınız sonucu ve paylaşım açıksa görür; eşik altındaki gruplar orada da gizli kalır.
              </p>
            </div>
          )}
          {cycle.status !== "CLOSED" && (
            <p className="text-[13px] text-fg2">
              Sonuçlar dönem sürerken anlık hesaplanır. Dönem kapanınca dondurulur ve personelle paylaşım için yayınlanabilir.
            </p>
          )}
          <div className="bz-table-wrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th scope="col">Değerlendirilen</th>
                  <th scope="col" className="hidden md:table-cell">
                    Departman
                  </th>
                  <th scope="col" className="is-num">
                    Tamamlanan
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    Yayın
                  </th>
                  <th scope="col">
                    <span className="sr-only">Rapor</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cycle.subjects.map((s) => {
                  const active = s.assignments.filter((a) => a.status !== "DECLINED");
                  const done = active.filter((a) => a.status === "COMPLETED").length;
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-normal py-2">
                        <p className="font-semibold text-foreground">{personName(s.personnel)}</p>
                        <p className="text-xs text-fg3">{s.personnel.position}</p>
                      </td>
                      <td className="hidden text-fg2 md:table-cell">{s.personnel.department?.name ?? "—"}</td>
                      <td className="is-num">
                        {done} / {active.length}
                      </td>
                      <td className="hidden sm:table-cell">
                        {s.status === "RELEASED" ? (
                          <span className="bz-status" data-status="approved">
                            Yayınlandı
                          </span>
                        ) : (
                          <span className="bz-status" data-status="draft">
                            Yayınlanmadı
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {canAnalyze && (
                          <Link
                            href={`/performance/cycles/${cycle.id}/subjects/${s.id}`}
                            className="bz-btn bz-btn--ghost bz-btn--sm"
                          >
                            <FileBarChart2 />
                            Rapor
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "close" ? "Dönemi kapat" : confirm === "delete" ? "Taslağı sil" : "Dönemi başlat"
        }
        description={
          confirm === "close"
            ? "Kapanınca değerlendiriciler portalda formu göremez; sonuçlar dondurulur. Bu işlem geri alınamaz."
            : confirm === "delete"
              ? "Taslak dönem ve atamaları silinir. Bu işlem geri alınamaz."
              : "Form ve ağırlıklar dondurulur; değerlendiricilere davet gider."
        }
        footer={
          <>
            <button type="button" className="bz-btn" onClick={() => setConfirm(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className={confirm === "delete" ? "bz-btn bz-btn--danger" : "bz-btn bz-btn--primary"}
              onClick={() => void runConfirm()}
            >
              {confirm === "close" ? "Kapat" : confirm === "delete" ? "Sil" : "Başlat"}
            </button>
          </>
        }
      >
        {confirm === "activate" && dirty && (
          <p className="text-[13px] text-fg2">Kaydedilmemiş değerlendirici değişiklikleri önce kaydedilecek.</p>
        )}
        {confirm === "close" && dash && dash.pending.length > 0 && (
          <p className="text-[13px] text-warning-ink">{dash.pending.length} değerlendirme henüz tamamlanmadı.</p>
        )}
      </Dialog>
    </div>
  );
}
