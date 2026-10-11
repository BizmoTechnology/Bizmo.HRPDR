"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList, Clock, MessageCircle, ArrowRight, Shield, CalendarX2,
  AlertCircle, LogOut, RotateCcw, ChevronDown, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { PortalHeader } from "@/components/PortalHeader";
import { api, errorMessage, getPersonnel, hasToken, logout } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ActiveSession {
  id: string;
  status: "NOT_STARTED" | "IN_PROGRESS";
  dueAt?: string | null;
  assessment?: {
    title: string;
    description?: string | null;
  };
  questionCount?: number;
  questions?: unknown[];
  answers?: unknown[];
}

export default function WelcomePage() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get("/api/sessions/portal/sessions/active");
      const activeSession: ActiveSession | null = data?.data ?? null;
      if (!activeSession?.id) {
        setNoSession(true);
      } else {
        setNoSession(false);
        setSession(activeSession);
      }
    } catch (err) {
      setLoadError(errorMessage(err, "Değerlendirme bilgisi alınamadı"));
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
    setPersonnel(stored);
    void load();
  }, [router, load]);

  const isResume = session?.status === "IN_PROGRESS";
  // AI analizi rızası isteğe bağlıdır (KVKK: açık rıza özgür iradeyle verilmeli);
  // verilmezse cevaplar AI ile analiz edilmez.
  const canStart = !!session && (isResume || consentChecked);

  const questionCount = session?.questionCount ?? session?.questions?.length ?? 0;
  const answeredCount = session?.answers?.length ?? 0;
  const estimatedDuration = Math.max(5, Math.round(questionCount * 1.5));

  const handleStart = async () => {
    if (!canStart || !session) return;
    setStarting(true);
    try {
      await api.post(`/api/sessions/portal/sessions/${session.id}/start`, {
        consents: { dataProcessing: consentChecked, aiAssessment: aiConsentChecked },
      });
      router.push("/assessment");
    } catch (err) {
      toast.error(errorMessage(err, "Değerlendirme başlatılamadı"));
      setStarting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <main className="bz-aurora flex min-h-dvh w-full justify-center px-4 pb-8 pt-4 sm:items-center sm:py-12">
      <motion.div
        className="w-full max-w-[480px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <PortalHeader>
          {/* İkincil eylem üst satırda: telefonda kaydırmadan erişilir, dokunmatikte 44px */}
          <button type="button" onClick={handleLogout} className="bz-btn bz-btn--ghost text-fg2">
            <LogOut />
            Çıkış yap
          </button>
        </PortalHeader>

        <GlassCard className="rounded-3xl p-5 shadow-2 sm:p-8">
          {loading ? (
            <WelcomeSkeleton />
          ) : loadError ? (
            <div role="alert" className="bz-empty px-2 py-8">
              <span className="bz-icon-box text-danger">
                <AlertCircle />
              </span>
              <p className="bz-empty__title">Değerlendirme yüklenemedi</p>
              <p className="bz-empty__text">{loadError}</p>
              <button type="button" onClick={() => void load()} className="bz-btn bz-btn--soft mt-2">
                <RotateCcw />
                Tekrar dene
              </button>
            </div>
          ) : noSession ? (
            // Boş durum: ne olduğu + ne yapılacağı + tek eylem (DESIGN.md §17)
            <div className="bz-empty px-2 py-8">
              <span className="bz-icon-box">
                <CalendarX2 />
              </span>
              <p className="bz-empty__title">Aktif değerlendirme yok</p>
              <p className="bz-empty__text">
                Şu anda size atanmış bir değerlendirme bulunmuyor. Atandığında burada görünür;
                sorunuz varsa İK yöneticinizle iletişime geçin.
              </p>
              <button type="button" onClick={() => void load()} className="bz-btn bz-btn--soft mt-2">
                <RotateCcw />
                Yeniden kontrol et
              </button>
            </div>
          ) : (
            <>
              {/* Karşılama */}
              <div className="text-center">
                <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
                  Merhaba, {personnel?.firstName ?? ""}!
                </h1>
                <p className="mx-auto mt-2 max-w-[36ch] text-[15px] leading-relaxed text-fg2">
                  {isResume
                    ? "Kaldığınız yerden devam edebilirsiniz; önceki cevaplarınız kaydedildi."
                    : "Sizinle birlikte potansiyelinizi keşfetmek için kısa bir konuşma yapacağız."}
                </p>
              </div>

              {/* Değerlendirme */}
              {session?.assessment?.title && (
                <div className="bz-well mt-6 px-4 py-3.5">
                  <p className="bz-kicker">Değerlendirme</p>
                  <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground">
                    {session.assessment.title}
                  </p>
                  {session.assessment.description && (
                    <p className="mt-0.5 text-[13px] text-fg2">{session.assessment.description}</p>
                  )}
                </div>
              )}

              {/* Özet */}
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[
                  {
                    icon: ClipboardList,
                    label: `${questionCount} soru`,
                    sub: isResume ? `${answeredCount} cevaplandı` : "toplam",
                  },
                  { icon: Clock, label: `~${estimatedDuration} dk`, sub: "tahmini süre" },
                  { icon: MessageCircle, label: "Sohbet", sub: "tarzında" },
                ].map((info) => (
                  <div
                    key={info.sub}
                    className="bz-well flex flex-col items-center gap-1 px-2 py-3 text-center"
                  >
                    <info.icon className="h-[18px] w-[18px] text-fg3" aria-hidden="true" />
                    <dt className="order-2 text-xs text-fg3">{info.sub}</dt>
                    <dd className="order-1 font-display text-base font-extrabold tabular-nums text-foreground">
                      {info.label}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Yaklaşım */}
              <p className="mx-auto mt-5 max-w-[40ch] text-center text-sm leading-relaxed text-fg2">
                &ldquo;Bu, sizi değerlendiren değil,{" "}
                <strong className="font-semibold text-foreground">sizinle birlikte keşfeden</strong>{" "}
                bir konuşma.&rdquo;
              </p>

              {/* KVKK ve açık rıza (devam ederken tekrar istenmez; rıza başlangıçta kaydedildi) */}
              {!isResume && (
                <fieldset className="mt-6 grid gap-2.5">
                  <legend className="bz-kicker mb-2.5">Başlamadan önce</legend>

                  <label htmlFor="consent-data" className="bz-choice-card">
                    <input
                      type="checkbox"
                      id="consent-data"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      aria-required="true"
                    />
                    <span className="text-sm leading-relaxed text-fg2">
                      <strong className="font-semibold text-foreground">
                        Kişisel verilerin işlenmesi{" "}
                        {/* .bz-req yalnız .bz-label içinde renklenir; burada aynı mürekkep elle verilir */}
                        <span className="text-danger-ink" aria-hidden="true">
                          *
                        </span>
                        <span className="bz-sr-only">(zorunlu)</span>
                      </strong>
                      <br />
                      6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında kişisel
                      verilerimin işlenmesine ilişkin aydınlatma metnini okudum ve onaylıyorum.
                    </span>
                  </label>

                  {/* Aydınlatma metni: etiketin dışında, eldivenle de basılabilir tam boy düğme */}
                  <button
                    type="button"
                    onClick={() => setShowKvkk((v) => !v)}
                    aria-expanded={showKvkk}
                    aria-controls="kvkk-text"
                    className="bz-btn bz-btn--ghost justify-self-start"
                  >
                    <FileText />
                    {showKvkk ? "Aydınlatma metnini gizle" : "Aydınlatma metnini oku"}
                    <ChevronDown
                      className={cn("transition-transform", showKvkk && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>

                  {showKvkk && (
                    <div
                      id="kvkk-text"
                      tabIndex={0}
                      aria-label="KVKK aydınlatma metni"
                      className="bz-well max-h-56 space-y-1.5 overflow-y-auto p-3.5 text-[13px] leading-relaxed text-fg2"
                    >
                      <p className="font-semibold text-foreground">KVKK aydınlatma metni (sürüm 1.0)</p>
                      <p>
                        6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca; bu değerlendirme
                        kapsamında verdiğiniz cevaplar, kimlik ve görev bilgileriniz, işvereniniz
                        tarafından veri sorumlusu sıfatıyla yetkinlik ve gelişim değerlendirmesi,
                        eğitim ve kariyer planlaması amaçlarıyla işlenecektir.
                      </p>
                      <p>
                        Veriler yalnızca yetkili İK personeli ve yöneticilerle paylaşılır; yurt dışına
                        aktarılmaz ve kurum saklama politikasında belirtilen süre boyunca saklanır.
                      </p>
                      <p>
                        Kanunun 11. maddesi kapsamındaki haklarınızı (bilgi talep etme, düzeltme,
                        silme vb.) İK birimine başvurarak kullanabilirsiniz.
                      </p>
                    </div>
                  )}

                  <label htmlFor="consent-ai" className="bz-choice-card">
                    <input
                      type="checkbox"
                      id="consent-ai"
                      checked={aiConsentChecked}
                      onChange={(e) => setAiConsentChecked(e.target.checked)}
                    />
                    <span className="text-sm leading-relaxed text-fg2">
                      <strong className="font-semibold text-foreground">
                        AI destekli değerlendirme{" "}
                        <span className="font-normal text-fg3">(isteğe bağlı)</span>
                      </strong>
                      <br />
                      Cevaplarımın yapay zekâ ile analiz edilmesine ve kariyer raporumun
                      oluşturulmasına açık rıza veriyorum.
                    </span>
                  </label>
                </fieldset>
              )}

              {/* Gizlilik notu */}
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg3">
                <Shield className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <span>
                  Cevaplarınız yalnızca İK ve yetkili yöneticilerinizle paylaşılır. Doğru ya da
                  yanlış cevap yoktur.
                </span>
              </p>

              {/* Ekrandaki tek birincil eylem; pasifken nedeni altta yazar */}
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart || starting}
                aria-busy={starting || undefined}
                aria-describedby={!canStart && !starting && !isResume ? "start-hint" : undefined}
                className={cn(
                  "bz-btn bz-btn--primary bz-btn--lg bz-btn--block mt-6",
                  starting && "is-loading",
                )}
              >
                {starting ? (
                  "Başlatılıyor…"
                ) : (
                  <>
                    {isResume ? "Kaldığınız yerden devam edin" : "Değerlendirmeye başla"}
                    <ArrowRight />
                  </>
                )}
              </button>

              {!canStart && !starting && !isResume && (
                <p id="start-hint" className="bz-hint mt-2.5 text-center">
                  Başlamak için KVKK aydınlatma metnini onaylayın. AI analizi onayı isteğe bağlıdır.
                </p>
              )}
            </>
          )}
        </GlassCard>
      </motion.div>
    </main>
  );
}

/** Yükleniyor: gerçek içeriğin şeklinde iskelet (DESIGN.md §17) */
function WelcomeSkeleton() {
  return (
    <div role="status" aria-label="Değerlendirme bilgileri yükleniyor" className="grid gap-3">
      <span className="bz-sr-only">Yükleniyor…</span>
      <div className="bz-skeleton mx-auto h-7 w-2/3 rounded-lg" />
      <div className="bz-skeleton mx-auto h-4 w-4/5" />
      <div className="bz-skeleton mt-3 h-[72px] rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        <div className="bz-skeleton h-[84px] rounded-2xl" />
        <div className="bz-skeleton h-[84px] rounded-2xl" />
        <div className="bz-skeleton h-[84px] rounded-2xl" />
      </div>
      <div className="bz-skeleton mt-3 h-[76px] rounded-2xl" />
      <div className="bz-skeleton h-[76px] rounded-2xl" />
      <div className="bz-skeleton mt-3 h-11 rounded-xl" />
    </div>
  );
}
