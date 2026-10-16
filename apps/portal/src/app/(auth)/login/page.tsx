"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  LogIn,
  KeyRound,
  MonitorSmartphone,
  MessageSquareText,
  RotateCw,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppMark } from "@/components/AppMark";
import { OtpInput, type OtpInputHandle } from "@/components/OtpInput";
import { api, errorCode, errorMessage, saveSession, type PortalPersonnel } from "@/lib/api";
import { cn } from "@/lib/utils";

const portalLoginSchema = z.object({
  employeeId: z.string().trim().min(1, "Sicil numarası zorunlu"),
  password: z.string().min(1, "Şifre zorunlu"),
});
type PortalLoginInput = z.infer<typeof portalLoginSchema>;

const employeeIdSchema = z.object({
  employeeId: z.string().trim().min(1, "Sicil numarası zorunlu"),
});
type EmployeeIdInput = z.infer<typeof employeeIdSchema>;

type Method = "sms" | "password";

interface OtpSent {
  employeeId: string;
  maskedPhone: string;
  expiresAt: number;
  resendAt: number;
}

interface FormAlert {
  tone: "danger" | "warning";
  title: string;
  text: string;
}

const CODE_LENGTH = 6;

/** Geri sayımlar için saniyede bir yenilenen zaman */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export default function PortalLoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("sms");
  /** null: henüz bilinmiyor (SMS formu gösterilir), false: SMS bağlı değil */
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null);
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const [sent, setSent] = useState<OtpSent | null>(null);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [busy, setBusy] = useState<"send" | "verify" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const methodTouched = useRef(false);
  const otpRef = useRef<OtpInputHandle>(null);
  const now = useNow(sent !== null);

  const idForm = useForm<EmployeeIdInput>({ resolver: zodResolver(employeeIdSchema) });
  const pwForm = useForm<PortalLoginInput>({ resolver: zodResolver(portalLoginSchema) });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired")) {
      toast.info("Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.");
    }
    // SMS bağlı değilse giriş ekranı doğrudan şifre formuyla açılır
    api
      .get<{ data: { sms: boolean } }>("/api/auth/portal/login-options")
      .then((res) => {
        setSmsAvailable(res.data.data.sms);
        if (!res.data.data.sms && !methodTouched.current) setMethod("password");
      })
      .catch(() => setSmsAvailable(null));
  }, []);

  const finishLogin = (data: { accessToken: string; refreshToken: string; personnel: PortalPersonnel }) => {
    saveSession(data);
    toast.success(`Hoş geldiniz, ${data.personnel.firstName}!`);
    router.replace("/welcome");
  };

  const switchMethod = (next: Method) => {
    methodTouched.current = true;
    setMethod(next);
    setAlert(null);
    setSent(null);
    setCode("");
    setCodeInvalid(false);
    // Girilen sicil numarası diğer forma taşınır
    const employeeId = (next === "password" ? idForm.getValues("employeeId") : pwForm.getValues("employeeId")) ?? "";
    if (next === "password") pwForm.setValue("employeeId", employeeId);
    else idForm.setValue("employeeId", employeeId);
  };

  // ── SMS: kod gönder ────────────────────────────
  const sendCode = async (employeeId: string) => {
    setBusy("send");
    setAlert(null);
    try {
      const res = await api.post<{
        data: { status: "SENT" | "ALREADY_SENT"; maskedPhone: string; expiresInSec: number; resendInSec: number };
      }>("/api/auth/portal/otp/request", { employeeId });
      const d = res.data.data;
      const t = Date.now();
      setSent({
        employeeId,
        maskedPhone: d.maskedPhone,
        expiresAt: t + d.expiresInSec * 1000,
        resendAt: t + d.resendInSec * 1000,
      });
      setCode("");
      setCodeInvalid(false);
      toast.success(d.status === "SENT" ? "Kod gönderildi" : "Kodunuz zaten gönderildi; SMS'inizi kontrol edin");
      window.setTimeout(() => otpRef.current?.focus(), 50);
    } catch (err) {
      const c = errorCode(err);
      if (c === "SMS_NOT_CONNECTED") setSmsAvailable(false);
      const wait = c === "OTP_COOLDOWN" || c === "OTP_RATE_LIMITED" || c === "RATE_LIMITED";
      setAlert({
        tone: c === "SMS_NOT_CONNECTED" || wait ? "warning" : "danger",
        title: c === "SMS_NOT_CONNECTED" ? "SMS entegrasyonu bağlı değil" : wait ? "Biraz bekleyin" : "Kod gönderilemedi",
        text: errorMessage(err, "Kod gönderilemedi. Lütfen tekrar deneyin."),
      });
    } finally {
      setBusy(null);
    }
  };

  // ── SMS: kodu doğrula ──────────────────────────
  const verifyCode = async (value: string) => {
    if (!sent || busy) return;
    if (value.length !== CODE_LENGTH) {
      setCodeInvalid(true);
      setAlert({ tone: "danger", title: "Kod eksik", text: "SMS'le gelen 6 haneli kodun tamamını girin." });
      return;
    }
    setBusy("verify");
    setAlert(null);
    try {
      const res = await api.post("/api/auth/portal/otp/verify", { employeeId: sent.employeeId, code: value });
      finishLogin(res.data.data);
    } catch (err) {
      const c = errorCode(err);
      setCodeInvalid(true);
      setCode("");
      if (c === "OTP_LOCKED" || c === "OTP_EXPIRED") {
        // Bu kod artık kullanılamaz; yeni kod, gönderimden 60 sn sonra istenebilir
        setSent((s) => (s ? { ...s, expiresAt: Date.now() } : s));
      }
      setAlert({
        tone: "danger",
        title: "Giriş yapılamadı",
        text: errorMessage(err, "Kod doğrulanamadı. Lütfen tekrar deneyin."),
      });
      window.setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setBusy(null);
    }
  };

  // ── Şifre ile giriş ────────────────────────────
  const onPasswordSubmit = async (data: PortalLoginInput) => {
    setBusy("password");
    setAlert(null);
    try {
      const res = await api.post("/api/auth/portal/login", data);
      finishLogin(res.data.data);
    } catch (err: unknown) {
      setAlert({ tone: "danger", title: "Giriş yapılamadı", text: errorMessage(err, "Sicil numarası veya şifre hatalı") });
    } finally {
      setBusy(null);
    }
  };

  const resendIn = sent ? Math.max(0, Math.ceil((sent.resendAt - now) / 1000)) : 0;
  const expiresIn = sent ? Math.max(0, Math.ceil((sent.expiresAt - now) / 1000)) : 0;
  const smsBlocked = method === "sms" && smsAvailable === false;

  const heading =
    method === "password"
      ? { title: "Şifreyle giriş", sub: "Sicil numaranız ve İK'nın verdiği şifreyle giriş yapın." }
      : sent
        ? { title: "Kodu girin", sub: null }
        : {
            title: "Giriş yapın",
            sub: "Sicil numaranızı girin; kayıtlı cep telefonunuza 6 haneli giriş kodu gönderelim. Şifre gerekmez.",
          };

  return (
    // Bizmo giriş kalıbı (DESIGN.md §39 `.bz-auth`): tek kart, marka kartın içinde, tek birincil eylem
    <main className="bz-auth bz-aurora">
      <motion.div
        className="bz-auth__card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="bz-auth__brand">
          <AppMark size="sm" />
          <span className="min-w-0">
            PotansiyelHaritası
            <span className="mt-1 block font-sans text-xs font-medium text-fg3">
              Personel değerlendirme portalı
            </span>
          </span>
        </div>

        <h1 className="bz-auth__title">{heading.title}</h1>
        {heading.sub ? (
          <p className="bz-auth__sub">{heading.sub}</p>
        ) : sent ? (
          <p className="bz-auth__sub" id="otp-help">
            <span className="whitespace-nowrap font-mono font-semibold text-foreground">{sent.maskedPhone}</span>{" "}
            numaralı telefonunuza gönderilen 6 haneli kodu girin.
          </p>
        ) : null}

        {/* Durumlar kart içinde kalıcı uyarı (DESIGN.md §39: .bz-alert) */}
        {alert && (
          <div role="alert" className={cn("bz-alert", alert.tone === "danger" ? "bz-alert--danger" : "bz-alert--warning")}>
            {alert.tone === "danger" ? <AlertCircle aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            <div>
              <p className="bz-alert__title">{alert.title}</p>
              <p>{alert.text}</p>
            </div>
          </div>
        )}
        {smsBlocked && !alert && (
          <div role="status" className="bz-alert bz-alert--warning">
            <AlertTriangle aria-hidden="true" />
            <div>
              <p className="bz-alert__title">SMS entegrasyonu bağlı değil</p>
              <p>SMS koduyla giriş şu an kullanılamıyor. Şifrenizle giriş yapın ya da İK departmanınıza başvurun.</p>
            </div>
          </div>
        )}

        {method === "sms" && !sent && (
          <form
            onSubmit={idForm.handleSubmit((d) => sendCode(d.employeeId.trim()))}
            noValidate
            className="grid grid-cols-1 gap-4"
          >
            <div className="bz-form-row">
              <label htmlFor="otp-employee-id" className="bz-label">
                Sicil numarası
              </label>
              {/* 16px yazı: iOS odakta sayfayı yakınlaştırmasın */}
              <input
                {...idForm.register("employeeId")}
                id="otp-employee-id"
                type="text"
                placeholder="Örn. P001"
                className="bz-field h-11 text-base sm:text-sm"
                autoComplete="username"
                autoCapitalize="characters"
                enterKeyHint="send"
                autoFocus
                aria-invalid={idForm.formState.errors.employeeId ? true : undefined}
                aria-describedby={idForm.formState.errors.employeeId ? "otp-employee-id-error" : undefined}
              />
              {idForm.formState.errors.employeeId && (
                <p id="otp-employee-id-error" className="bz-error-text">
                  {idForm.formState.errors.employeeId.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy !== null || smsBlocked}
              aria-busy={busy === "send" || undefined}
              className={cn("bz-btn bz-btn--primary bz-btn--lg bz-btn--block mt-1", busy === "send" && "is-loading")}
            >
              {busy === "send" ? (
                "Kod gönderiliyor…"
              ) : (
                <>
                  <MessageSquareText />
                  Kod gönder
                </>
              )}
            </button>
          </form>
        )}

        {method === "sms" && sent && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode(code);
            }}
            noValidate
            className="grid grid-cols-1 gap-4"
          >
            <div className="bz-form-row">
              <div className="flex items-center justify-between gap-2">
                <span className="bz-label">Giriş kodu</span>
                {/* Sicil numarası yanlışsa ilk adıma dönülür (dokunma hedefi 44px) */}
                <button
                  type="button"
                  onClick={() => {
                    setSent(null);
                    setAlert(null);
                    setCode("");
                    setCodeInvalid(false);
                  }}
                  className="bz-btn bz-btn--link min-h-11 text-[13px]"
                  aria-label={`Sicil numarasını değiştir (${sent.employeeId})`}
                >
                  {sent.employeeId} · Değiştir
                </button>
              </div>
              <OtpInput
                ref={otpRef}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (codeInvalid) setCodeInvalid(false);
                }}
                onComplete={(v) => void verifyCode(v)}
                length={CODE_LENGTH}
                invalid={codeInvalid}
                disabled={busy === "verify"}
                label="Giriş kodu, 6 hane"
                describedBy="otp-help otp-expiry"
              />
              <p id="otp-expiry" className="bz-hint tabular-nums" aria-live="off">
                {expiresIn > 0 ? `Kod ${mmss(expiresIn)} içinde geçersiz olur.` : "Kodun süresi doldu; yeni kod isteyin."}
              </p>
            </div>

            <button
              type="submit"
              disabled={busy !== null || expiresIn === 0}
              aria-busy={busy === "verify" || undefined}
              className={cn("bz-btn bz-btn--primary bz-btn--lg bz-btn--block", busy === "verify" && "is-loading")}
            >
              {busy === "verify" ? (
                "Doğrulanıyor…"
              ) : (
                <>
                  <LogIn />
                  Giriş yap
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void sendCode(sent.employeeId)}
              disabled={busy !== null || resendIn > 0}
              aria-busy={busy === "send" || undefined}
              className={cn(
                "bz-btn bz-btn--ghost bz-btn--lg bz-btn--block -mt-1 h-auto min-h-11 whitespace-normal tabular-nums",
                busy === "send" && "is-loading",
              )}
            >
              <RotateCw />
              {resendIn > 0 ? `Tekrar gönder (${mmss(resendIn)})` : "Kodu tekrar gönder"}
            </button>
          </form>
        )}

        {method === "password" && (
          <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} noValidate className="grid grid-cols-1 gap-4">
            <div className="bz-form-row">
              <label htmlFor="portal-employee-id" className="bz-label">
                Sicil numarası
              </label>
              <input
                {...pwForm.register("employeeId")}
                id="portal-employee-id"
                type="text"
                placeholder="Örn. P001"
                className="bz-field h-11 text-base sm:text-sm"
                autoComplete="username"
                autoCapitalize="characters"
                enterKeyHint="next"
                autoFocus
                aria-invalid={pwForm.formState.errors.employeeId ? true : undefined}
                aria-describedby={pwForm.formState.errors.employeeId ? "portal-employee-id-error" : undefined}
              />
              {pwForm.formState.errors.employeeId && (
                <p id="portal-employee-id-error" className="bz-error-text">
                  {pwForm.formState.errors.employeeId.message}
                </p>
              )}
            </div>

            <div className="bz-form-row">
              <label htmlFor="portal-password" className="bz-label">
                Şifre
              </label>
              <div className="relative">
                <input
                  {...pwForm.register("password")}
                  id="portal-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bz-field h-11 pr-12 text-base sm:text-sm"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  aria-invalid={pwForm.formState.errors.password ? true : undefined}
                  aria-describedby={pwForm.formState.errors.password ? "portal-password-error" : undefined}
                />
                {/* Dokunmatikte 44px (DESIGN.md §30): --sm değil, varsayılan boyut */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="bz-icon-btn absolute inset-y-0 right-0.5 my-auto"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  title={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {pwForm.formState.errors.password && (
                <p id="portal-password-error" className="bz-error-text">
                  {pwForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy !== null}
              aria-busy={busy === "password" || undefined}
              className={cn("bz-btn bz-btn--primary bz-btn--lg bz-btn--block mt-1", busy === "password" && "is-loading")}
            >
              {busy === "password" ? (
                "Giriş yapılıyor…"
              ) : (
                <>
                  <LogIn />
                  Giriş yap
                </>
              )}
            </button>
          </form>
        )}

        {/* İkinci yöntem: birincil eylemle yarışmasın diye çerçevesiz düğme. Kod adımında
            gizlenir; "Değiştir" ile ilk adıma dönülünce yeniden görünür. */}
        {!sent && !(method === "password" && smsAvailable === false) && (
          <button
            type="button"
            onClick={() => switchMethod(method === "sms" ? "password" : "sms")}
            className="bz-btn bz-btn--ghost bz-btn--lg bz-btn--block -mt-1 h-auto min-h-11 whitespace-normal"
          >
            {method === "sms" ? (
              <>
                <KeyRound />
                Şifreyle giriş yap
              </>
            ) : (
              <>
                <Smartphone />
                SMS koduyla giriş yap
              </>
            )}
          </button>
        )}

        <div className="grid gap-2.5 border-t border-divider pt-4">
          {method === "password" && smsAvailable === false ? (
            <p className="bz-auth__notice">
              <Smartphone aria-hidden="true" />
              <span>SMS koduyla giriş kapalı: SMS entegrasyonu bağlı değil.</span>
            </p>
          ) : method === "sms" ? (
            <p className="bz-auth__notice">
              <Smartphone aria-hidden="true" />
              <span>Kod gelmezse ya da telefon numaranız değiştiyse İK departmanınızla iletişime geçin.</span>
            </p>
          ) : (
            <p className="bz-auth__notice">
              <KeyRound aria-hidden="true" />
              <span>Şifrenizi bilmiyorsanız SMS koduyla girin ya da İK departmanınızla iletişime geçin.</span>
            </p>
          )}
          <p className="bz-auth__notice">
            <MonitorSmartphone aria-hidden="true" />
            <span>Ortak bir cihaz kullanıyorsanız değerlendirme bitince oturumu kapatın.</span>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
