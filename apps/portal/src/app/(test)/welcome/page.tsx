"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList, Clock, MessageCircle, ArrowRight,
  Shield, Loader2, AlertCircle, LogOut, RotateCcw, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { api, errorMessage, getPersonnel, hasToken, logout } from "@/lib/api";

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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-bold text-xl select-none">PH</span>
          </div>
        </div>

        <GlassCard className="rounded-2xl">
          {loading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-14 w-14 rounded-xl bg-accent-red/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-7 w-7 text-accent-red" />
              </div>
              <p className="text-sm text-muted-foreground text-center mb-4">{loadError}</p>
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4"
              >
                <RotateCcw className="h-4 w-4" />
                Tekrar dene
              </button>
            </div>
          ) : noSession ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-14 w-14 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
                <AlertCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2 text-center">
                Aktif Değerlendirme Yok
              </h2>
              <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
                Şu anda atanmış bir değerlendirmeniz bulunmuyor. Lütfen İK
                yöneticinizle iletişime geçin.
              </p>
            </div>
          ) : (
            <>
              {/* Greeting */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Merhaba,{" "}
                  <span className="text-primary">{personnel?.firstName ?? ""}!</span>
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Seninle birlikte potansiyelini keşfetmek için
                  <br />
                  kısa bir konuşma yapacağız.
                </p>
              </div>

              {/* Assessment Title */}
              {session?.assessment?.title && (
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 mb-4 text-center">
                  <p className="text-sm font-semibold text-primary">
                    {session.assessment.title}
                  </p>
                  {session.assessment.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {session.assessment.description}
                    </p>
                  )}
                </div>
              )}

              {/* Info Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  {
                    icon: ClipboardList,
                    label: `${questionCount} Soru`,
                    sub: isResume ? `${answeredCount} cevaplandı` : "toplam",
                  },
                  {
                    icon: Clock,
                    label: `~${estimatedDuration} dk`,
                    sub: "tahmini süre",
                  },
                  { icon: MessageCircle, label: "Sohbet", sub: "tarzında" },
                ].map((info) => (
                  <div
                    key={info.label}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <info.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{info.label}</p>
                    <p className="text-[10px] text-muted-foreground">{info.sub}</p>
                  </div>
                ))}
              </div>

              {/* Motivation */}
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 mb-6">
                <p className="text-sm text-center text-muted-foreground italic leading-relaxed">
                  &ldquo;Bu, seni değerlendiren değil,{" "}
                  <span className="text-primary font-medium">
                    seninle birlikte keşfeden
                  </span>{" "}
                  bir konuşma.&rdquo;
                </p>
              </div>

              {/* KVKK Consent (devam ederken tekrar istenmez; rıza başlangıçta kaydedildi) */}
              {!isResume && (
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <input
                    type="checkbox"
                    id="consent-data"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30 flex-shrink-0 cursor-pointer"
                  />
                  <label
                    htmlFor="consent-data"
                    className="text-xs text-muted-foreground cursor-pointer leading-relaxed"
                  >
                    <span className="font-semibold text-foreground">
                      Kişisel Verilerin İşlenmesi:
                    </span>{" "}
                    6698 sayılı KVKK kapsamında kişisel verilerimin işlenmesine
                    ilişkin{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowKvkk((v) => !v);
                      }}
                      className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5"
                    >
                      aydınlatma metnini
                      <ChevronDown className={`h-3 w-3 transition-transform ${showKvkk ? "rotate-180" : ""}`} />
                    </button>{" "}
                    okudum ve onaylıyorum.
                  </label>
                </div>

                {showKvkk && (
                  <div className="rounded-xl bg-muted/20 border border-border/40 p-3 text-[11px] leading-relaxed text-muted-foreground max-h-48 overflow-y-auto">
                    <p className="font-semibold text-foreground mb-1">KVKK Aydınlatma Metni (sürüm 1.0)</p>
                    <p className="mb-1">
                      6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca; bu değerlendirme kapsamında
                      verdiğiniz cevaplar, kimlik ve görev bilgileriniz, işvereniniz tarafından veri sorumlusu
                      sıfatıyla yetkinlik ve gelişim değerlendirmesi, eğitim ve kariyer planlaması amaçlarıyla
                      işlenecektir.
                    </p>
                    <p className="mb-1">
                      Veriler yalnızca yetkili İK personeli ve yöneticilerle paylaşılır; yurt dışına aktarılmaz ve
                      kurum saklama politikasında belirtilen süre boyunca saklanır.
                    </p>
                    <p>
                      Kanunun 11. maddesi kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) İK
                      birimine başvurarak kullanabilirsiniz.
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <input
                    type="checkbox"
                    id="consent-ai"
                    checked={aiConsentChecked}
                    onChange={(e) => setAiConsentChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30 flex-shrink-0 cursor-pointer"
                  />
                  <label
                    htmlFor="consent-ai"
                    className="text-xs text-muted-foreground cursor-pointer leading-relaxed"
                  >
                    <span className="font-semibold text-foreground">
                      AI Destekli Değerlendirme:
                    </span>{" "}
                    Cevaplarımın yapay zeka ile analiz edilmesine ve kariyer
                    raporumun oluşturulmasına açık rıza veriyorum.
                  </label>
                </div>
              </div>
              )}

              {/* Privacy note */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
                <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span>
                  Cevapların yalnızca İK ve yetkili yöneticilerinle paylaşılır.
                  Doğru ya da yanlış cevap yoktur.
                </span>
              </div>

              {/* Start Button */}
              <motion.button
                onClick={handleStart}
                disabled={!canStart || starting}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base
                  hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
                whileHover={canStart ? { scale: 1.01 } : {}}
                whileTap={canStart ? { scale: 0.98 } : {}}
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Başlatılıyor...
                  </>
                ) : (
                  <>
                    {isResume ? "Kaldığın yerden devam et" : "Başlayalım"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              {!canStart && !starting && !isResume && (
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  Başlamak için KVKK aydınlatma metnini onaylayın. AI analizi onayı isteğe bağlıdır.
                </p>
              )}
            </>
          )}
        </GlassCard>

        <div className="flex justify-center mt-4">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Çıkış yap
          </button>
        </div>
      </motion.div>
    </div>
  );
}
