/**
 * Bizmo Universal Theme · barkod, etiket ve baskı (bağımlılıksız; çerçeveden bağımsız)
 *
 *   bizmoCode128Svg("A-3-D-2", { height: 60 })            Code 128 (B/C kod setleri otomatik) → SVG metni
 *   bizmoCode128Svg("01…10…\x1d17…", { gs1: true })        GS1-128 (FNC1 ile; \x1d = değişken alan sonu)
 *   bizmoQrSvg("IE-2026-0418", { ecc: "M" })                QR (bayt kipi, sürüm 1–10, hata düzeltme L/M/Q/H)
 *   gs1Hri({ "01": gtin, "17": "270331", "10": "L26-114" })  insan okunur satır: "(01)… (17)… (10)…"
 *   bizmoZpl({ widthMm: 100, heightMm: 50 }, [...])          Zebra termal yazıcı için ZPL II
 *   bizmoPrint(el, { title })                               yalnız bu öğeyi yazdırır (gizli çerçevede, sayfa stilleriyle)
 *
 * Etiket ölçüleri mm ile; ekranda ve baskıda aynı boyut (DESIGN.md §38). Barkodlar her zaman siyah / beyaz,
 * sessiz bölgeli (Code 128: 10 modül, QR: 4 modül) çizilir; ölçeklenirken modül oranı korunur.
 */
/**
 * Metni Code 128 sembol değerlerine çevirir (kontrol karakteri dahil). Sayı dizilerinde C setine geçer (iki hane = bir sembol).
 * gs1: başa FNC1 eklenir, \x1d (GS) FNC1 olur. Code 128 dışı karakter (ör. ğ, ş) varsa hata fırlatır.
 */
export declare function code128Values(text: string, opts?: {
    gs1?: boolean;
}): number[];
/** Code 128 modül dizisi (1 = çubuk) — sessiz bölge hariç */
export declare function code128Modules(text: string, opts?: {
    gs1?: boolean;
}): number[];
/**
 * Code 128 / GS1-128 SVG. Genişlik modül sayısı × module (px ya da viewBox birimi); height çubuk yüksekliği.
 * CSS ile genişlik / yükseklik verilince eksenler ayrı ölçeklenir (preserveAspectRatio="none"): tüm modüller aynı oranda
 * genişlediği için okunurluk bozulmaz; modül genişliği baskıda ≥ 0,25 mm kalmalıdır.
 */
export declare function bizmoCode128Svg(text: string, opts?: {
    gs1?: boolean;
    height?: number;
    module?: number;
    quiet?: number;
    color?: string;
    label?: string;
}): string;
/** GS1 uygulama tanımlayıcılarından barkod verisi (değişken uzunluklu alanlardan sonra GS) ve insan okunur satır */
export declare function gs1Data(ai: Record<string, string | number>): {
    data: string;
    hri: string;
};
/** "(01)… (17)… (10)…" — etiketin altına yazılan satır */
export declare const gs1Hri: (ai: Record<string, string | number>) => string;
type Ecc = "L" | "M" | "Q" | "H";
/** QR modül matrisi (true = koyu). Bayt kipi (UTF-8), en küçük uygun sürüm (1–10); sığmazsa hata */
export declare function bizmoQr(text: string, opts?: {
    ecc?: Ecc;
    minVersion?: number;
}): {
    size: number;
    version: number;
    ecc: Ecc;
    modules: boolean[][];
};
/** QR SVG (sessiz bölge 4 modül). size: piksel / viewBox kenarı */
export declare function bizmoQrSvg(text: string, opts?: {
    ecc?: Ecc;
    size?: number;
    color?: string;
    label?: string;
}): string;
export type ZplItem = {
    type: "text";
    x: number;
    y: number;
    h: number;
    text: string;
    w?: number;
    block?: {
        width: number;
        lines?: number;
        align?: "L" | "C" | "R";
    };
}
/** gs1: data "(01)…(17)…(10)…" biçiminde (gs1Data(ai).hri) */
 | {
    type: "code128";
    x: number;
    y: number;
    h: number;
    data: string;
    gs1?: boolean;
    module?: number;
    hri?: boolean;
} | {
    type: "qr";
    x: number;
    y: number;
    data: string;
    mag?: number;
    ecc?: Ecc;
} | {
    type: "box";
    x: number;
    y: number;
    w: number;
    h: number;
    t?: number;
    fill?: boolean;
};
/**
 * ZPL II etiketi: konum ve ölçüler mm ile (dpi'ye göre noktaya çevrilir: 203 dpi = 8 nokta/mm, 300 = 12, 600 = 24).
 * Türkçe metin için ^CI28 (UTF-8) kullanılır; yazıcıda Türkçe karakter içeren bir yazı tipi olmalıdır (ör. yüklü TrueType),
 * ilk kurulumda deneme etiketi basın. Alan verisindeki ^ ve ~ ^FH ile kaçırılır.
 */
export declare function bizmoZpl(o: {
    widthMm: number;
    heightMm: number;
    dpi?: 203 | 300 | 600;
    copies?: number;
}, items: ZplItem[]): string;
/**
 * Yalnız verilen öğeyi yazdırır: gizli bir çerçeveye sayfanın stil sayfalarıyla kopyalar, yazı tipleri yüklenince
 * yazdırma penceresini açar, sonra çerçeveyi kaldırır. Etiketlerde sayfa boyutu `.bz-label` ölçüsünden gelir (@page).
 */
export declare function bizmoPrint(target: Element | string, opts?: {
    title?: string;
    theme?: "light";
}): Promise<void>;
export {};
