"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Users,
  Clock,
  Calendar,
  FileText,
  Gauge,
  AlertTriangle,
  Loader2,
  X,
  UserX,
  KeyRound,
  Archive,
  UserMinus,
  RotateCcw,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { GlassCard, ScoreGauge, PortalModal } from "@ph/ui";
import { TERMINATION_REASON_LABELS } from "@ph/shared";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { useDeletePersonnel, useSetPortalPassword } from "@/hooks/use-api";
import {
  usePersonnelHistory,
  usePersonnelRecord,
} from "@/hooks/use-personnel-history";
import { PersonnelHistoryTab } from "@/components/personnel/PersonnelHistoryTab";
import { PersonnelAnalysisTab } from "@/components/personnel/PersonnelAnalysisTab";
import { CareerTab } from "@/components/personnel/CareerTab";
import {
  ArchiveDialog,
  ReactivateDialog,
  TerminateDialog,
} from "@/components/personnel/PersonnelDialogs";

/** Personel durumu → Bizmo çipi (DESIGN.md §13). Pasif bir hata değildir: nötr çip. */
const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Aktif", tone: "bz-chip--success" },
  INACTIVE: { label: "Pasif", tone: "" },
  ON_LEAVE: { label: "İzinli", tone: "bz-chip--warning" },
  TERMINATED: { label: "Ayrıldı", tone: "bz-chip--danger" },
};

/** Açık (henüz kapanmamış) HR/PDR oturumları: işten çıkarınca süresi dolmuş sayılır */
const OPEN_SESSION_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "PAUSED"]);

type TabKey = "genel" | "gecmis" | "analiz" | "kariyer";
const TABS: { key: TabKey; label: string }[] = [
  { key: "genel", label: "Genel" },
  { key: "gecmis", label: "Geçmiş" },
  { key: "analiz", label: "Analiz" },
  { key: "kariyer", label: "Kariyer" },
];
const isTabKey = (v: string | null): v is TabKey => TABS.some((t) => t.key === v);

const fmtLongDate = (iso: string) => format(new Date(iso), "d MMMM yyyy", { locale: tr });

const SHIFT_MAP: Record<string, string> = {
  NONE: "Yok",
  MORNING: "Sabah",
  AFTERNOON: "Öğleden sonra",
  NIGHT: "Gece",
  ROTATING: "Dönüşümlü",
};

/** Oturum durumu → süreç durumu rozeti (.bz-status, DESIGN.md §13): şekil + sözcük */
const SESSION_STATUS_MAP: Record<string, { label: string; status: string }> = {
  COMPLETED: { label: "Tamamlandı", status: "done" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  NOT_STARTED: { label: "Başlamadı", status: "draft" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  EXPIRED: { label: "Süresi doldu", status: "cancelled" },
};

function DetailSkeleton() {
  return (
    <div className="w-full space-y-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="bz-skeleton h-[38px] w-[38px] rounded-[10px]" />
        <div className="bz-skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="bz-skeleton h-6 w-56" />
          <div className="bz-skeleton h-3.5 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GlassCard hover={false}>
            <div className="bz-skeleton mb-5 h-4 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="bz-skeleton h-3 w-16" />
                  <div className="bz-skeleton h-4 w-32" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
        <GlassCard hover={false}>
          <div className="bz-skeleton mb-5 h-4 w-24" />
          <div className="bz-skeleton mx-auto h-28 w-28 rounded-full" />
        </GlassCard>
      </div>
    </div>
  );
}

/** Künye satırı: etiket üstte soluk, değer altta kalın (DESIGN.md §41) */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  const empty = value == null || value === "";
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-[3px] h-4 w-4 flex-none text-fg3" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 text-[14px] [overflow-wrap:anywhere]",
            empty ? "text-fg3" : "font-semibold text-foreground"
          )}
        >
          {empty ? "—" : value}
        </dd>
      </div>
    </div>
  );
}

export default function PersonnelDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading } = usePersonnelRecord(id);
  const { data: history, isLoading: historyLoading, isError: historyError } =
    usePersonnelHistory(id);
  const deleteMutation = useDeletePersonnel();
  const setPortalPassword = useSetPortalPassword();
  const { canManage, canAnalyze } = usePermissions();
  const [dialog, setDialog] = useState<
    null | "archive" | "portal" | "terminate" | "reactivate"
  >(null);
  const [portalPassword, setPortalPasswordValue] = useState("");
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(isTabKey(tabParam) ? tabParam : "genel");
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    genel: null,
    gecmis: null,
    analiz: null,
    kariyer: null,
  });

  const closeDialog = useCallback(() => setDialog(null), []);

  const selectTab = useCallback(
    (key: TabKey, focus = false) => {
      setTab(key);
      if (focus) tabRefs.current[key]?.focus();
      // Sekme bağlantıyla paylaşılabilir (?tab=gecmis); geçmiş yığınına eklenmez
      const sp = new URLSearchParams(window.location.search);
      if (key === "genel") sp.delete("tab");
      else sp.set("tab", key);
      const qs = sp.toString();
      router.replace(`/personnel/${id}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, id]
  );

  /** Sekmeler arasında ok tuşları, Home/End (DESIGN.md §41, role=tablist) */
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    selectTab(TABS[next]!.key, true);
  };

  const handleSetPortalPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portalPassword.length < 6) {
      toast.error("Portal şifresi en az 6 karakter olmalı");
      return;
    }
    try {
      await setPortalPassword.mutateAsync({ id, password: portalPassword });
      toast.success("Portal şifresi güncellendi");
      setDialog(null);
      setPortalPasswordValue("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Portal şifresi güncellenemedi"));
    }
  };

  const handleArchive = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Personel arşivlendi");
      router.push("/personnel");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel arşivlenirken hata oluştu"));
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!person) {
    return (
      <div className="bz-card">
        <div className="bz-empty py-16">
          <UserX className="h-8 w-8 text-fg3" aria-hidden="true" />
          <p className="bz-empty__title">Personel bulunamadı</p>
          <p className="bz-empty__text">
            Kayıt arşivlenmiş ya da bağlantı hatalı olabilir.
          </p>
          <Link href="/personnel" className="bz-btn">
            <ArrowLeft />
            Personel listesine dön
          </Link>
        </div>
      </div>
    );
  }

  const terminated = person.status === "TERMINATED";
  const archived = !!person.deletedAt;
  const readOnly = person.readOnly || terminated || archived;
  const statusInfo = archived
    ? { label: "Arşivde", tone: "" }
    : (STATUS_MAP[person.status] ?? { label: person.status, tone: "" });
  const fullName = `${person.firstName} ${person.lastName}`;
  const openSessionCount =
    person.sessions?.filter((s) => OPEN_SESSION_STATUSES.has(s.status)).length ?? 0;
  const historyCount = history?.timeline.length;

  return (
    <div className="bz-record w-full" data-locked={readOnly || undefined}>
      {/* Kayıt başlığı: kimlik + durum + kayıt eylemleri (DESIGN.md §41) */}
      <motion.div
        className="bz-record__head"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={terminated ? "/personnel?view=terminated" : archived ? "/personnel?view=archived" : "/personnel"}
            className="bz-icon-btn"
            aria-label="Personel listesine dön"
            title="Personel listesine dön"
          >
            <ArrowLeft />
          </Link>
          <span
            className={cn("bz-avatar bz-avatar--lg", readOnly && "opacity-60 grayscale")}
            aria-hidden="true"
          >
            {person.firstName[0]}
            {person.lastName[0]}
          </span>
          <div className="bz-record__heading gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="bz-record__title">{fullName}</h1>
              <span className={cn("bz-chip", statusInfo.tone)}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Sicil no{" "}
              <span className="font-mono text-[12.5px] font-semibold text-fg2">
                {person.employeeId}
              </span>
              <span className="text-fg3"> · {person.position}</span>
            </p>
          </div>
        </div>

        {canManage && !archived && (
          <div className="bz-record__actions">
            {!terminated && (
              <Link
                href={`/personnel/${id}/edit`}
                className="bz-btn bz-btn--primary bz-record__edit"
              >
                <Pencil />
                <span>Düzenle</span>
              </Link>
            )}
            {/* İkincil ve yıkıcı eylemler ⋯ menüsünde; yıkıcı öğe en sonda, kırmızı (DESIGN.md §15, §41) */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="bz-btn"
                  aria-label="Diğer eylemler"
                  title="Diğer eylemler"
                >
                  <MoreHorizontal />
                  <span>Eylemler</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="bz-menu z-[260]"
                >
                  {!terminated && (
                    <>
                      <DropdownMenu.Item
                        className="bz-menu-item cursor-pointer outline-none"
                        onSelect={() => setDialog("portal")}
                      >
                        <KeyRound />
                        {person.hasPortalPassword
                          ? "Portal şifresini sıfırla"
                          : "Portal şifresi belirle"}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="bz-menu-item cursor-pointer outline-none"
                        onSelect={() => setDialog("terminate")}
                      >
                        <UserMinus />
                        İşten çıkar…
                      </DropdownMenu.Item>
                    </>
                  )}
                  {terminated && (
                    <DropdownMenu.Item
                      className="bz-menu-item cursor-pointer outline-none"
                      onSelect={() => setDialog("reactivate")}
                    >
                      <RotateCcw />
                      Yeniden etkinleştir…
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="bz-menu-sep" />
                  <DropdownMenu.Item
                    className="bz-menu-item bz-menu-item--danger cursor-pointer outline-none"
                    onSelect={() => setDialog("archive")}
                  >
                    <Archive />
                    Arşivle…
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </motion.div>

      {/* Ayrılış bandı: neden + ne zaman + yol (DESIGN.md §41 kilit bandı) */}
      {terminated && !archived && (
        <div className="bz-record__lock" role="status" data-testid="terminated-banner">
          <UserMinus aria-hidden="true" />
          <div>
            <b>Ayrıldı</b>
            {person.terminationDate && (
              <>
                {" · "}
                <time dateTime={person.terminationDate} className="font-semibold text-foreground tabular-nums">
                  {fmtLongDate(person.terminationDate)}
                </time>
              </>
            )}
            {person.terminationReason && (
              <> · {TERMINATION_REASON_LABELS[person.terminationReason]}</>
            )}
            <span className="block text-fg3">
              Kayıt salt okunur; portal erişimi kapalı. Geçmiş ve analizler korunur.
            </span>
            {person.terminationNote && (
              <span className="mt-1 block whitespace-pre-wrap text-fg2">
                {person.terminationNote}
              </span>
            )}
          </div>
          {canManage && (
            <button
              type="button"
              className="bz-btn bz-btn--primary bz-btn--sm"
              onClick={() => setDialog("reactivate")}
            >
              <RotateCcw />
              Yeniden etkinleştir
            </button>
          )}
        </div>
      )}

      {archived && (
        <div className="bz-record__lock" role="status">
          <Lock aria-hidden="true" />
          <div>
            <b>Arşivde</b>
            {person.deletedAt && (
              <>
                {" · "}
                <time dateTime={person.deletedAt} className="tabular-nums">
                  {fmtLongDate(person.deletedAt)}
                </time>
              </>
            )}
            <span className="block text-fg3">
              Kayıt listelerden kaldırıldı ve salt okunur. Değerlendirme geçmişi korunur.
            </span>
          </div>
        </div>
      )}

      {/* Portal şifresi yoksa kalıcı uyarı (DESIGN.md §17) */}
      {!readOnly && !person.hasPortalPassword && (
        <div role="status" className="bz-alert bz-alert--warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <p className="bz-alert__title">Portal şifresi yok</p>
            <p>
              Bu personel atanan değerlendirmelere giriş yapamaz.
              {canManage && " “Portal şifresi belirle” ile şifre oluşturun."}
            </p>
          </div>
        </div>
      )}

      {/* Sekmeler + içerik tek kart (DESIGN.md §41) */}
      <motion.div
        className="bz-record__panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <div
          className="bz-tabs"
          role="tablist"
          aria-label="Personel kaydı"
          onKeyDown={onTabKeyDown}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-controls={`panel-${t.key}`}
              aria-selected={tab === t.key}
              tabIndex={tab === t.key ? 0 : -1}
              className="bz-tab"
              onClick={() => selectTab(t.key)}
            >
              {t.label}
              {t.key === "gecmis" && historyCount != null && (
                <span className="bz-tab__count">{historyCount}</span>
              )}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="panel-genel"
          aria-labelledby="tab-genel"
          hidden={tab !== "genel"}
          tabIndex={0}
        >
          {tab === "genel" && (
            <GeneralTab person={person} canAnalyze={canAnalyze} />
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-gecmis"
          aria-labelledby="tab-gecmis"
          hidden={tab !== "gecmis"}
          tabIndex={0}
        >
          {tab === "gecmis" && (
            <HistoryLoader loading={historyLoading} error={historyError}>
              {history && <PersonnelHistoryTab history={history} />}
            </HistoryLoader>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-analiz"
          aria-labelledby="tab-analiz"
          hidden={tab !== "analiz"}
          tabIndex={0}
        >
          {tab === "analiz" && (
            <HistoryLoader loading={historyLoading} error={historyError}>
              {history && <PersonnelAnalysisTab history={history} />}
            </HistoryLoader>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-kariyer"
          aria-labelledby="tab-kariyer"
          hidden={tab !== "kariyer"}
          tabIndex={0}
        >
          {tab === "kariyer" && <CareerTab personnelId={id} />}
        </div>
      </motion.div>

      {/* Portal şifresi: form penceresi (DESIGN.md §16) */}
      <AnimatePresence>
        {dialog === "portal" && (
          <PortalModal>
            <motion.div
              className="bz-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeDialog}
              aria-hidden="true"
            />
            <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center p-3">
              <motion.form
                role="dialog"
                aria-modal="true"
                aria-labelledby="portal-password-title"
                aria-describedby="portal-password-desc"
                onSubmit={handleSetPortalPassword}
                className="pointer-events-auto relative w-full max-w-[480px] rounded-3xl border border-glass-border bg-popover p-6 shadow-3 backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={{ duration: 0.2 }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeDialog();
                }}
              >
                <button
                  type="button"
                  onClick={closeDialog}
                  className="bz-icon-btn bz-icon-btn--sm absolute right-4 top-4"
                  aria-label="Kapat"
                  title="Kapat"
                >
                  <X />
                </button>

                <div className="pr-8">
                  <h2
                    id="portal-password-title"
                    className="font-display text-[19px] font-bold leading-snug text-foreground"
                  >
                    Portal şifresi
                  </h2>
                  <p
                    id="portal-password-desc"
                    className="mt-1 text-[13px] leading-relaxed text-fg2"
                  >
                    <strong>{fullName}</strong> portala sicil numarası (
                    <span className="font-mono text-[12.5px] font-semibold text-foreground">
                      {person.employeeId}
                    </span>
                    ) ve bu şifreyle giriş yapar. Mevcut portal oturumları
                    sonlandırılır.
                  </p>
                </div>

                <div className="bz-form-row mt-5">
                  <label htmlFor="portal-password" className="bz-label">
                    Yeni şifre <span className="bz-req">*</span>
                  </label>
                  <input
                    id="portal-password"
                    type="password"
                    autoComplete="new-password"
                    value={portalPassword}
                    onChange={(e) => setPortalPasswordValue(e.target.value)}
                    placeholder="En az 6 karakter"
                    aria-describedby="portal-password-hint"
                    className="bz-field"
                    autoFocus
                  />
                  <span id="portal-password-hint" className="bz-hint">
                    Şifre en az 6 karakter olmalıdır.
                  </span>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={closeDialog} className="bz-btn">
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={setPortalPassword.isPending}
                    className="bz-btn bz-btn--primary"
                  >
                    {setPortalPassword.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <KeyRound />
                    )}
                    {setPortalPassword.isPending ? "Kaydediliyor" : "Şifreyi kaydet"}
                  </button>
                </div>
              </motion.form>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog === "terminate" && (
          <TerminateDialog
            personnelId={id}
            fullName={fullName}
            hireDate={person.hireDate}
            openSessionCount={openSessionCount}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog === "reactivate" && (
          <ReactivateDialog personnelId={id} fullName={fullName} onClose={closeDialog} />
        )}
      </AnimatePresence>

      {/* Arşivleme onayı (soft delete): kayıt ve geçmiş korunur (DESIGN.md §16) */}
      <AnimatePresence>
        {dialog === "archive" && (
          <ArchiveDialog
            fullName={fullName}
            pending={deleteMutation.isPending}
            onConfirm={handleArchive}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryLoader({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="bz-skeleton h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bz-skeleton h-4 w-56" />
              <div className="bz-skeleton h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="bz-alert bz-alert--danger" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <p className="bz-alert__title">Geçmiş yüklenemedi</p>
          <p>Sayfayı yenileyip tekrar deneyin.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Genel sekmesi: künye, skor ve son değerlendirmeler */
function GeneralTab({
  person,
  canAnalyze,
}: {
  person: NonNullable<ReturnType<typeof usePersonnelRecord>["data"]>;
  canAnalyze: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bilgiler (2/3) */}
        <section className="min-w-0 lg:col-span-2" aria-labelledby="info-title">
          <h2 id="info-title" className="bz-record__group">
            Kişisel ve iş bilgileri
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoRow icon={Mail} label="E-posta" value={person.email} />
            <InfoRow icon={Phone} label="Telefon" value={person.phone} />
            <InfoRow icon={Briefcase} label="Pozisyon" value={person.position} />
            <InfoRow icon={Building2} label="Departman" value={person.department?.name} />
            <InfoRow icon={Users} label="Takım" value={person.team?.name} />
            <InfoRow
              icon={Clock}
              label="Vardiya"
              value={SHIFT_MAP[person.shift] ?? person.shift}
            />
            <InfoRow
              icon={Briefcase}
              label="Deneyim"
              value={<span className="tabular-nums">{person.experienceYear} yıl</span>}
            />
            <InfoRow
              icon={Calendar}
              label="İşe giriş"
              value={
                person.hireDate ? (
                  <span className="tabular-nums">
                    {format(new Date(person.hireDate), "d MMMM yyyy", { locale: tr })}
                  </span>
                ) : null
              }
            />
            {person.status === "TERMINATED" && (
              <InfoRow
                icon={UserMinus}
                label="Ayrılış"
                value={
                  person.terminationDate ? (
                    <span className="tabular-nums">
                      {format(new Date(person.terminationDate), "d MMMM yyyy", { locale: tr })}
                      {person.terminationReason && (
                        <span className="font-normal text-fg2">
                          {" · "}
                          {TERMINATION_REASON_LABELS[person.terminationReason]}
                        </span>
                      )}
                    </span>
                  ) : null
                }
              />
            )}
          </dl>

          {person.notes && (
            <div className="mt-5 border-t border-divider pt-4">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-[3px] h-4 w-4 flex-none text-fg3" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-muted-foreground">Notlar</p>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                    {person.notes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Skor (1/3) */}
        <section
          className="flex flex-col rounded-[var(--bz-radius-md)] border border-border p-4"
          aria-labelledby="score-title"
        >
          <h2 id="score-title" className="text-[15px] font-bold text-foreground">
            Genel skor
          </h2>
          {!canAnalyze ? (
            <div className="bz-empty flex-1 justify-center px-2 py-8">
              <Lock className="h-7 w-7 text-fg3" aria-hidden="true" />
              <p className="bz-empty__title text-[15px]">Yetki gerekli</p>
              <p className="bz-empty__text">
                Skorlar yalnız analiz yetkisi olan rollere görünür.
              </p>
            </div>
          ) : person.avgScore != null ? (
            <div className="flex flex-1 items-center justify-center py-4">
              <ScoreGauge score={person.avgScore} size="lg" label="Ortalama potansiyel" />
            </div>
          ) : (
            <div className="bz-empty flex-1 justify-center px-2 py-8">
              <Gauge className="h-7 w-7 text-fg3" aria-hidden="true" />
              <p className="bz-empty__title text-[15px]">Henüz değerlendirme yok</p>
              <p className="bz-empty__text">
                İlk değerlendirme tamamlandığında ortalama skor burada görünür.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Değerlendirmeler */}
      <section aria-labelledby="sessions-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="sessions-title" className="bz-record__group mb-0">
            Son değerlendirmeler
          </h2>
          {!!person.sessions?.length && (
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {person.sessions.length} kayıt
            </span>
          )}
        </div>

        {!person.sessions?.length ? (
          <div className="bz-empty rounded-[var(--bz-radius-md)] border border-border py-12">
            <FileText className="h-7 w-7 text-fg3" aria-hidden="true" />
            <p className="bz-empty__title text-[15px]">Henüz değerlendirme atanmamış</p>
            <p className="bz-empty__text">
              Bu personele atanan değerlendirmeler burada listelenir.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--bz-radius-md)] border border-border">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>Değerlendirme</th>
                  <th>Durum</th>
                  {canAnalyze && <th className="is-num">Skor</th>}
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {person.sessions.map((s) => {
                  const sessionStatus = SESSION_STATUS_MAP[s.status];
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link
                          href={`/assessments/${s.assessment.id}?session=${s.id}`}
                          className="font-medium text-foreground hover:underline focus-visible:underline"
                        >
                          {s.assessment.title}
                        </Link>
                        {s.reportId && canAnalyze && (
                          <Link
                            href={`/reports/${s.reportId}`}
                            className="bz-link bz-link--data ml-2 inline-flex items-center gap-1 text-[12px]"
                          >
                            <FileText className="h-3 w-3" aria-hidden="true" />
                            Rapor
                          </Link>
                        )}
                      </td>
                      <td>
                        {sessionStatus ? (
                          <span className="bz-status" data-status={sessionStatus.status}>
                            {sessionStatus.label}
                          </span>
                        ) : (
                          <span className="bz-chip">{s.status}</span>
                        )}
                      </td>
                      {canAnalyze && (
                        <td className="is-num">
                          {s.avgScore != null ? (
                            <>
                              <span
                                className={cn(
                                  "font-semibold",
                                  s.avgScore >= 8
                                    ? "text-success-ink"
                                    : s.avgScore >= 6
                                      ? "text-warning-ink"
                                      : "text-danger-ink"
                                )}
                              >
                                {s.avgScore.toFixed(1)}
                              </span>
                              <span className="text-[12px] text-fg3"> /10</span>
                            </>
                          ) : (
                            <span className="text-fg3">—</span>
                          )}
                        </td>
                      )}
                      <td className="text-fg2 tabular-nums">
                        {format(new Date(s.completedAt ?? s.createdAt), "dd MMM yyyy", {
                          locale: tr,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
