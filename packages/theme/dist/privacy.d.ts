/**
 * Bizmo Universal Theme · güvenlik ve KVKK arayüz yardımcıları (çerçeveden bağımsız)
 *
 *   bizmoMask("10000000146", "tckn")                     → "100••••••46"
 *   bizmoMaskedField(el, { kind: "iban", masked, fetch, onReveal })   süreli "Göster" (varsayılan 15 sn), kendiliğinden kapanır
 *   isValidTckn(v) · isValidIban(v) · formatIban(v)
 *   bizmoSessionTimeout({ idleMs, warnMs, onWarn, onTick, onActive, onExpire, keepAlive })   boşta kalma + sekmeler arası eşitleme
 *   bizmoOtpInput(el, { length: 6, onComplete })          tek kullanımlık kod (yeniden doğrulama)
 *   bizmoWatermark(el, "TR-07 · 11.10.2026 14:20")        ekran filigranı (sızıntı caydırma)
 *
 * Kurallar (DESIGN.md §39): tam değer tarayıcıya yalnız "Göster" ile, sunucudan (BFF) ve sunucu tarafında denetim
 * kaydıyla gelir; sayfa maskeli hali taşır. Token ve oturum çerezi tarayıcı kodunda tutulmaz (httpOnly çerez BFF'de) —
 * bu modül yalnız arayüz durumunu yönetir. Denetim olayı içerik değil metadata taşır (kim, ne zaman, alan türü, nesne).
 */
export type MaskKind = "tckn" | "vkn" | "iban" | "phone" | "email" | "card" | "name" | "text";
/** Maskeleme kuralları: kimlik doğrulamaya yetecek kadar (baş / son haneler) görünür, gerisi gizli */
export declare function bizmoMask(value: string, kind?: MaskKind): string;
/** TC kimlik numarası algoritma denetimi (11 hane, ilk hane 0 değil, 10. ve 11. hane kontrolü) — gerçekliği değil biçimi doğrular */
export declare function isValidTckn(value: string): boolean;
/** IBAN mod 97 denetimi; TR IBAN 26 karakter */
export declare function isValidIban(value: string): boolean;
export declare const formatIban: (v: string) => string;
export type RevealMeta = {
    kind: MaskKind;
    field?: string;
    objectType?: string;
    objectId?: string;
    at: string;
};
/**
 * Maskeli alan: `.bz-masked` öğesine değer + göz düğmesi + süre çubuğu kurar. "Göster"de değer fetch() ile sunucudan
 * istenir (sunucu yetkiyi denetler ve kaydı yazar), onReveal ile istemci tarafında yalnız metadata olayı gönderilir.
 * Süre dolunca, sekme gizlenince ya da yeniden basınca maskelenir; değer bellekte tutulmaz.
 */
export declare function bizmoMaskedField(el: HTMLElement, o: {
    kind: MaskKind;
    masked?: string;
    value?: string;
    fetch?: () => Promise<string>;
    onReveal?: (m: RevealMeta) => void;
    revealMs?: number;
    label?: string;
    field?: string;
    objectType?: string;
    objectId?: string;
}): {
    hide: () => void;
    reveal: () => Promise<void>;
    destroy(): void;
};
/**
 * Oturum zaman aşımı: kullanıcı etkinliği (dokunma, tuş, kaydırma) yoksa idleMs sonunda onExpire; warnMs önce onWarn
 * ve her saniye onTick(kalan sn). Uyarı açıkken pasif hareket süreyi uzatmaz — kullanıcı "Devam et" (extend) demelidir.
 * Aynı uygulamanın sekmeleri BroadcastChannel ile eşitlenir: bir sekmedeki etkinlik diğerlerini canlı tutar, çıkış hepsini kapatır.
 * keepAlive: BFF oturumunu yeniler (çerez sunucuda); false dönerse oturum sunucuda bitmiş sayılır.
 */
export declare function bizmoSessionTimeout(o: {
    idleMs: number;
    warnMs?: number;
    onWarn?: (secondsLeft: number) => void;
    onTick?: (secondsLeft: number) => void;
    onActive?: () => void;
    onExpire: () => void;
    keepAlive?: () => Promise<boolean | void> | boolean | void;
    channel?: string;
}): {
    /** "Devam et": süreyi baştan başlatır, sunucu oturumunu yeniler, diğer sekmelere bildirir */
    extend(): Promise<void>;
    /** "Çıkış yap": tüm sekmelerde oturumu kapatır */
    logout(): void;
    stop(): void;
    readonly secondsLeft: number;
};
/** Tek kullanımlık kod: hane başına kutu, otomatik ilerleme, yapıştırma dağıtımı, geri silme; tamamlanınca onComplete */
export declare function bizmoOtpInput(el: HTMLElement, o?: {
    length?: number;
    onComplete?: (code: string) => void;
    label?: string;
}): {
    readonly value: string;
    clear(): void;
    /** Hatalı kod: kutular kırmızı, temizlenir, ilk kutuya döner */
    error(): void;
    focus(): void;
};
/** Ekran filigranı: görenin oturum kimliği + zaman çapraz tekrarlanır (ekran görüntüsü sızıntısını caydırır) */
export declare function bizmoWatermark(el: HTMLElement, text: string): void;
