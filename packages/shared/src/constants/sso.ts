/**
 * Bizmo.ID ile giriş hata kodları (sunucu: `?sso_error=<KOD>` ile giriş ekranına döner).
 * İç ayrıntı gösterilmez; kod destek için ekranda kalır.
 */
export type SsoErrorCode =
  | "NOT_CONFIGURED"
  | "IDP_UNAVAILABLE"
  | "IDP_ERROR"
  | "INVALID_FLOW"
  | "TOKEN_INVALID"
  | "ACCESS_DENIED"
  | "EMAIL_NOT_VERIFIED"
  | "NO_ACCOUNT"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_CONFLICT"
  | "PORTAL_DISABLED";

const COMMON: Record<SsoErrorCode, string> = {
  NOT_CONFIGURED: "Bizmo.ID bağlı değil.",
  IDP_UNAVAILABLE: "Bizmo.ID'ye şu anda ulaşılamıyor. Biraz sonra yeniden deneyin.",
  IDP_ERROR: "Bizmo.ID girişi tamamlanmadı. Yeniden deneyin.",
  INVALID_FLOW:
    "Giriş oturumunun süresi doldu ya da giriş başka bir sekmede başlatıldı. Yeniden deneyin.",
  TOKEN_INVALID:
    "Bizmo.ID yanıtı doğrulanamadı. Yeniden deneyin; sorun sürerse yöneticinize başvurun.",
  ACCESS_DENIED: "Bizmo.ID hesabınızın bu uygulamaya erişim yetkisi yok. Yöneticinize başvurun.",
  EMAIL_NOT_VERIFIED: "Bizmo.ID e-posta adresiniz doğrulanmamış. Bizmo.ID yöneticinize başvurun.",
  NO_ACCOUNT:
    "Bizmo.ID hesabınız bu paneldeki bir kullanıcıya bağlı değil. Yöneticinizden hesap açmasını isteyin.",
  ACCOUNT_DISABLED: "Hesabınız etkin değil. Yöneticinize başvurun.",
  ACCOUNT_CONFLICT:
    "Bu hesap başka bir Bizmo.ID kimliğine bağlı ya da birden fazla kayıtla eşleşiyor. Yöneticinize başvurun.",
  PORTAL_DISABLED: "Personel portalında Bizmo.ID ile giriş açık değil.",
};

const PORTAL: Partial<Record<SsoErrorCode, string>> = {
  NO_ACCOUNT:
    "Bizmo.ID hesabınız bir personel kaydıyla eşleşmedi. Sicil numaranız ve şifrenizle giriş yapın ya da İK'ya başvurun.",
  ACCOUNT_DISABLED: "Personel kaydınız etkin değil. İK'ya başvurun.",
  ACCESS_DENIED: "Bizmo.ID hesabınızın personel portalına erişim yetkisi yok. İK'ya başvurun.",
};

export function ssoErrorMessage(code: string | null | undefined, app: "admin" | "portal" = "admin"): string | null {
  if (!code) return null;
  const key = code as SsoErrorCode;
  if (!(key in COMMON)) return "Bizmo.ID girişi tamamlanmadı. Yeniden deneyin.";
  return (app === "portal" ? PORTAL[key] : undefined) ?? COMMON[key];
}
