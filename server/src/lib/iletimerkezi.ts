import { normalizeTrMobile } from "@ph/shared";

/**
 * İletimerkezi SMS istemcisi (JSON API: https://www.toplusmsapi.com/en/sms/gonder/json).
 *
 * - Kimlik bilgileri (key/hash) yalnız POST gövdesinde gider; URL'de ve log'da yer almaz.
 * - Yapılandırma yoksa sahte (mock) ya da konsola gönderim yapılmaz: çağıran taraf
 *   "SMS entegrasyonu bağlı değil" uyarısını gösterir.
 * - Giriş kodu bilgilendirme (işlemsel) iletisidir, ticari değildir: `iys: "0"` ile
 *   İYS onay sorgusu yapılmaz. `iys: "1"` + `BIREYSEL` ticari ileti içindir ve ticari
 *   izni olmayan personele kodun gitmesini engeller.
 */

const DEFAULT_API_URL = "https://api.iletimerkezi.com";
const REQUEST_TIMEOUT_MS = 10_000;

/** API ve arayüzün gösterdiği tek mesaj (AI_NOT_CONNECTED_MESSAGE ile aynı kalıp) */
export const SMS_NOT_CONNECTED_MESSAGE = "SMS entegrasyonu bağlı değil.";

interface SmsConfig {
  key: string;
  hash: string;
  sender: string;
  apiUrl: string;
}

function readConfig(): SmsConfig | null {
  const key = process.env["ILETIMERKEZI_API_KEY"]?.trim();
  const hash = process.env["ILETIMERKEZI_API_HASH"]?.trim();
  const sender = process.env["ILETIMERKEZI_SENDER"]?.trim();
  if (!key || !hash || !sender) return null;
  const apiUrl = (process.env["ILETIMERKEZI_API_URL"]?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
  return { key, hash, sender, apiUrl };
}

export function isSmsConfigured(): boolean {
  return readConfig() !== null;
}

/** Onaylı gönderici başlığı (ör. BIZMO); yapılandırma yoksa null */
export function smsSender(): string | null {
  return readConfig()?.sender ?? null;
}

export class SmsNotConfiguredError extends Error {
  constructor() {
    super(SMS_NOT_CONNECTED_MESSAGE);
    this.name = "SmsNotConfiguredError";
  }
}

/** Sağlayıcının reddi ya da ulaşılamaması. `providerCode`: İletimerkezi durum kodu (401, 402, 450…) */
export class SmsProviderError extends Error {
  constructor(
    message: string,
    readonly providerCode: string | null,
  ) {
    super(message);
    this.name = "SmsProviderError";
  }
}

interface ProviderResponse {
  response?: {
    status?: { code?: string | number; message?: string };
    order?: { id?: string | number };
    balance?: { amount?: string | number; sms?: string | number };
  };
}

async function call(
  cfg: SmsConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<NonNullable<ProviderResponse["response"]>> {
  let res: Response;
  try {
    res = await fetch(`${cfg.apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        request: { authentication: { key: cfg.key, hash: cfg.hash }, ...body },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "zaman aşımı" : "bağlantı hatası";
    throw new SmsProviderError(`İletimerkezi'ye ulaşılamadı (${reason})`, null);
  }

  let parsed: ProviderResponse | null = null;
  try {
    parsed = (await res.json()) as ProviderResponse;
  } catch {
    // JSON dışı yanıt: aşağıda HTTP durumuyla raporlanır
  }

  const status = parsed?.response?.status;
  const code = status?.code != null ? String(status.code) : null;
  if (code !== "200" || !parsed?.response) {
    throw new SmsProviderError(status?.message?.trim() || `HTTP ${res.status}`, code);
  }
  return parsed.response;
}

/**
 * Tek numaraya SMS gönderir. `to` herhangi bir TR cep yazımı olabilir; sağlayıcıya
 * 5XXXXXXXXX biçiminde gider. Başarıda İletimerkezi sipariş numarasını döner.
 */
export async function sendSms(to: string, text: string): Promise<{ orderId: string | null }> {
  const cfg = readConfig();
  if (!cfg) throw new SmsNotConfiguredError();

  const local = normalizeTrMobile(to)?.slice(3);
  if (!local) throw new SmsProviderError("Geçersiz cep telefonu numarası", null);

  const response = await call(cfg, "/v1/send-sms/json", {
    order: {
      sender: cfg.sender,
      iys: "0",
      message: { text, receipents: { number: [local] } },
    },
  });
  return { orderId: response.order?.id != null ? String(response.order.id) : null };
}

/** Hesap bakiyesi; kimlik bilgilerini SMS göndermeden doğrulamak için de kullanılır */
export async function getSmsBalance(): Promise<{ amount: string | null; sms: string | null }> {
  const cfg = readConfig();
  if (!cfg) throw new SmsNotConfiguredError();

  const response = await call(cfg, "/v1/get-balance/json", {});
  const b = response.balance;
  return {
    amount: b?.amount != null ? String(b.amount) : null,
    sms: b?.sms != null ? String(b.sms) : null,
  };
}
