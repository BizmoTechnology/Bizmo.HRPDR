export type DocControl = {
    form: string;
    rev: string;
    date: string;
};
export type DocOrg = {
    name: string;
    unit?: string;
    glyph?: string;
};
type Day = Date | string;
/** Belgede durum etiketi (çerçeveli); öncelik ve stok için temanın rozetleri — baskıda kendiliğinden çerçeveli olur */
export declare const docTag: (text: string, tone?: "danger" | "warning" | "success" | "info") => string;
export type WorkOrder = {
    no: string;
    org: DocOrg;
    product: {
        code: string;
        name: string;
        drawing?: string;
        revision?: string;
    };
    quantity: number;
    unit: string;
    date?: Day;
    due: Day;
    priority?: "normal" | "acil" | "kritik";
    line?: string;
    shift?: string;
    ref?: string;
    operations: {
        seq: string | number;
        name: string;
        station: string;
        setupMin?: number;
        runMin?: number;
        note?: string;
    }[];
    materials: {
        code: string;
        name: string;
        location?: string;
        lot?: string;
        qty: number;
        unit: string;
    }[];
    /** ncr: açık uygunsuzluk numarası (quality.ts toDocQuality) — kalemin yanında kırmızı etiket */
    quality?: {
        item: string;
        spec: string;
        method?: string;
        freq?: string;
        ncr?: string;
    }[];
    notes?: string;
    roles?: string[];
    control?: DocControl;
    qr?: string;
};
/**
 * İş emri: ürün + miktar büyük, operasyonlar (hazırlık / işleme süresi, başlangıç-bitiş, iyi / hurda, paraf), malzeme (göz, lot),
 * kalite kontrol noktaları. size "a5": makinede poşette duran iş takip kartı — operasyon, kalite ve imza; malzeme toplama
 * listesiyle (bizmoPickListDoc) ayrı basılır.
 */
export declare function bizmoWorkOrderDoc(d: WorkOrder, opts?: {
    size?: "a4" | "a5";
}): string;
export type StockCard = {
    code: string;
    name: string;
    org: DocOrg;
    category?: string;
    unit: string;
    gtin?: string;
    abc?: "A" | "B" | "C";
    supplier?: string;
    leadDays?: number;
    onHand: number;
    reserved?: number;
    min?: number;
    reorder?: number;
    max?: number;
    locations: {
        code: string;
        lot?: string;
        expiry?: Day;
        qty: number;
    }[];
    movements: {
        date: Day;
        doc: string;
        type: "giris" | "cikis" | "sayim" | "transfer";
        qty: number;
        balance?: number;
    }[];
    notes?: string;
    control?: DocControl;
};
/** Stok kartı: kimlik + barkod, büyük stok rakamları ve seviye çubuğu (min · yeniden sipariş · max), göz dağılımı, hareket defteri (bakiye) */
export declare function bizmoStockCardDoc(d: StockCard): string;
export type PickList = {
    no: string;
    org: DocOrg;
    for: string;
    date?: Day;
    due?: Day;
    zone?: string;
    lines: {
        location: string;
        code: string;
        name: string;
        lot?: string;
        qty: number;
        unit: string;
    }[];
    control?: DocControl;
};
/** Toplama listesi: göz sırasıyla (rota), her satırda göz kodu barkodlu — el terminali olmadan da okutulabilir; toplanan / eksik yazılır */
export declare function bizmoPickListDoc(d: PickList): string;
export {};
