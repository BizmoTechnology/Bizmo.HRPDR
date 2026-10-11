/**
 * Bizmo Universal Theme · barkod okutma (el terminali, hat başı, masaüstü okuyucu; çerçeveden bağımsız)
 *
 *   const s = bizmoScanInput(input, { onScan: (code, source) => … });   alan: okuyucu ile elle yazımı ayırır
 *   const g = bizmoScanner({ onScan });                                  sayfa: odak bir alanda değilken okutmayı yakalar
 *   bizmoParseScan(code, { location: loc })                              → { kind, valid, error?, gtin?, lot?, expiry?, location? … }
 *   gs1CheckDigit("020000000123")                                         GTIN / SSCC / GLN kontrol hanesi (mod 10)
 *   s.feed("A-3-D-2")                                                    okuyucu taklidi (test, vitrin)
 *
 * Klavye kaması okuyucular karakterleri ~5–30 ms arayla gönderir ve Enter (bazen Tab) ile bitirir; insan yazımı
 * genellikle ≥ 60 ms'dir. AIM sembol önekleri (]C1 GS1-128, ]E0 EAN-13, ]d2 GS1 DataMatrix, ]Q3 GS1 QR) ve
 * FNC1 / GS (\x1d) ayırıcısı desteklenir; GS gönderemeyen okuyucular için yerine geçen karakter (gsChar) verilebilir.
 * Okutulan değer cihaz dışına gönderilmez; denetim kaydına içerik değil yalnız tür + sonuç yazılır (KVKK) — DESIGN.md §37.
 */
import type { LocationParts, LocationScheme } from "./location";
export type ScanSource = "scanner" | "manual";
export type ScanKind = "location" | "gs1" | "ean" | "sscc" | "text";
export type ScanResult = {
    /** Önekleri temizlenmiş değer (GS ayırıcısı \x1d olarak korunur) */
    code: string;
    kind: ScanKind;
    valid: boolean;
    /** Geçersizse kullanıcıya gösterilecek neden (Türkçe) */
    error?: string;
    /** AIM önekinden okunan sembol türü: "GS1-128", "EAN-13", "QR"… */
    symbology?: string;
    location?: LocationParts & {
        code: string;
    };
    /** 14 haneli GTIN (EAN-8/12/13 sola sıfırla tamamlanır) */
    gtin?: string;
    sscc?: string;
    lot?: string;
    serial?: string;
    /** Son kullanma (AI 17) veya tavsiye edilen tüketim (AI 15) tarihi, ISO yyyy-mm-dd */
    expiry?: string;
    productionDate?: string;
    count?: number;
    netKg?: number;
    /** Tüm GS1 uygulama tanımlayıcıları (AI → değer) */
    ai?: Record<string, string>;
};
/** GS1 mod 10 kontrol hanesi: GTIN-8/12/13/14, SSCC, GLN gövdesi için (kontrol hanesi hariç) */
export declare function gs1CheckDigit(body: string): string;
/** GS1 öğe dizisini çözer: "(01)…(10)…" ya da ham "01…10…<GS>17…". Tanınmayan AI'da null */
export declare function parseGs1(input: string): Record<string, string> | null;
/** GS1 tarihi YYMMDD → ISO; GS1 kayan yüzyıl kuralı, gün 00 = ayın son günü. Geçersizse null */
export declare function gs1Date(yymmdd: string, now?: Date): string | null;
/**
 * Okutulan değeri sınıflandırır ve doğrular. Sıra: AIM öneki → GS1 öğe dizisi → göz kodu (şema verilirse) →
 * GTIN / SSCC (yalnız rakam) → serbest metin.
 */
export declare function bizmoParseScan(raw: string, opts?: {
    location?: LocationScheme;
    gsChar?: string;
    now?: Date;
}): ScanResult;
type WedgeOpts = {
    /** Okuyucu kabul edilecek en büyük ortanca tuş aralığı (ms, varsayılan 35) */
    maxGap?: number;
    /** Okuyucu kabul edilecek en kısa değer (varsayılan 4) */
    minLength?: number;
    /** Bitiş tuşları (varsayılan Enter ve Tab) */
    suffix?: string[];
};
/**
 * Bir alana okuyucu desteği: Enter / Tab'da değeri gönderir, tuş aralıklarından kaynağı (okuyucu / elle) belirler,
 * formun gönderilmesini ve odağın kaçmasını engeller, alanı temizler.
 */
export declare function bizmoScanInput(input: HTMLInputElement, opts: WedgeOpts & {
    onScan: (code: string, source: ScanSource) => void;
    clear?: boolean;
}): {
    /** Okuyucu taklidi: aynı yoldan "scanner" kaynağıyla gönderir (test ve vitrin) */
    feed(code: string): void;
    destroy(): void;
};
/**
 * Sayfa düzeyinde okutma: odak düzenlenebilir bir alanda değilken hızlı tuş dizisini yakalar (el terminalinde
 * ekrana dokunmadan okutma). Elle basılan tek tuşlar ve kısayollar etkilenmez.
 */
export declare function bizmoScanner(opts: WedgeOpts & {
    onScan: (code: string, source: ScanSource) => void;
    target?: Document | HTMLElement;
}): {
    feed(code: string): void;
    destroy(): void;
};
export {};
