/**
 * Bizmo Universal Theme · kayıt sayfası yardımcıları (çerçeveden bağımsız; fark hesabı DOM'suz, sunucuda / Node'da da çalışır)
 *
 *   diffRecord(önceki, sonraki, şema, { lines })   → FieldChange[]  alan düzeyinde; kalem eklendi / silindi / değişti
 *   diffWords(a, b)                              → [{ t, op }]     uzun metinde sözcük farkı
 *   formatFieldValue(v, tanım)                   → "₺12.500,00" · "11.10.2026" · "Evet" · "40 adet"
 *   filterChangeSets(kümeler, { field, actor, source, q })
 *   bizmoHistoryHtml(kümeler)                    → Geçmiş sekmesi: kim · ne zaman · nereden · gerekçe · alan · eski → yeni
 *   bizmoActivityHtml(olaylar)                   → etkinlik akışı: yorum, değişiklik, durum, belge, sistem olayı (gün başlıklı)
 *   bizmoCopy(düğme, değer)                      → kayıt numarasını kopyalar, "Kopyalandı" duyurur
 *   recordCardHtml(kayıt, { variant }) · bizmoRecordCards(kök)   sohbette / panelde kayıt durum kartı (.bz-record-card)
 *
 * Kurallar (DESIGN.md §41): şema beyaz listedir — şemada olmayan alan geçmişe girmez. Kişisel veri alanı (`mask`) geçmişte
 * maskeli tutulur, `audit: "meta"` alanda değer hiç yazılmaz, yalnız "değişti" — ham kişisel veri `FieldChange`'e girmez.
 * Kim bilgisi kullanıcı kimliği + rol; ad yalnız uygulama içinde, yetkili kişiye gösterilir. Tüm metin kaçırılır (XSS).
 */
import { type MaskKind } from "./privacy.js";
export type FieldKind = "text" | "longtext" | "number" | "money" | "percent" | "date" | "datetime" | "bool" | "enum" | "ref";
/** value: biçimli değer · masked: maskeli değer · meta: değer yok, yalnız "değişti" */
export type AuditMode = "value" | "masked" | "meta";
export interface FieldDef {
    label: string;
    kind?: FieldKind;
    /** enum: değer → görünen ad */
    options?: Record<string, string>;
    unit?: string;
    currency?: string;
    digits?: number;
    /** kişisel veri türü: geçmişte maskelenir (privacy.ts bizmoMask) */
    mask?: MaskKind;
    audit?: AuditMode;
}
export type RecordSchema = Record<string, FieldDef>;
export interface FieldChange {
    /** "dueDate" ya da kalemde "lines[L2].qty" */
    path: string;
    field: string;
    label: string;
    kind: FieldKind;
    op: "change" | "add" | "remove";
    audit: AuditMode;
    /** görünen metin: value → biçimli · masked → maskeli · meta → "" */
    from: string;
    to: string;
    /** yalnız audit "value" iken ham değer; maskeli / meta alanda hiç yok */
    raw?: {
        from: unknown;
        to: unknown;
    };
    /** kalem değişikliğinde: "Kalem 2 · FL-120" */
    scope?: string;
}
export interface LineSpec<T = any> {
    /** kayıttaki dizi alanı: "lines" */
    key: string;
    /** kalıcı kalem kimliği (sıra numarası değil — sıralama değişince yanlış fark çıkar) */
    id: (row: T) => string;
    label: (row: T, index: number) => string;
    schema: RecordSchema;
    /** eklenen / silinen kalemin özeti: "FL-120 Flanş Ø120 · 20 adet" */
    summary?: (row: T) => string;
}
export interface Actor {
    id: string;
    role?: string;
    name?: string;
}
export type ChangeSource = "ui" | "api" | "import" | "mobile" | "system" | "integration";
export interface ChangeSet {
    id: string;
    at: number | string | Date;
    actor: Actor;
    source?: ChangeSource;
    reason?: string;
    changes: FieldChange[];
}
export declare const SOURCE_LABEL: Record<ChangeSource, string>;
/** Alan değerini tr-TR biçiminde metne çevirir; boş değer "" döner (ekranda "boş" yazılır) */
export declare function formatFieldValue(v: unknown, def?: Pick<FieldDef, "kind" | "options" | "unit" | "currency" | "digits">): string;
/**
 * İki kayıt sürümü arasındaki alan düzeyindeki farklar. Yalnız şemadaki alanlar karşılaştırılır (beyaz liste);
 * kalemler kalıcı kimlikle eşlenir: eklendi / silindi / alanı değişti.
 */
export declare function diffRecord<T extends Record<string, any>>(prev: T | null | undefined, next: T, schema: RecordSchema, opts?: {
    lines?: LineSpec[];
}): FieldChange[];
export type WordOp = {
    t: string;
    op: "eq" | "del" | "ins";
};
/** Sözcük düzeyinde fark (LCS). Çok uzun metinde (≈ 600 × 600 sözcük üstü) tümü sil + tümü ekle olarak döner. */
export declare function diffWords(a: string, b: string): WordOp[];
/** Geçmiş süzgeci: alan (path ya da alan adı), kullanıcı, kaynak, serbest metin (alan adı ve değerlerde) */
export declare function filterChangeSets(sets: ChangeSet[], f?: {
    field?: string;
    actor?: string;
    source?: ChangeSource;
    q?: string;
}): ChangeSet[];
/** "eski → yeni" gösterimi; maskeli alanda maskeli metin, meta alanda yalnız not */
export declare function changeValuesHtml(c: FieldChange): string;
/** Geçmiş sekmesi: her kayıt işlemi bir küme (aynı anda kaydedilen alanlar birlikte); en yeni üstte */
export declare function bizmoHistoryHtml(sets: ChangeSet[], opts?: {
    empty?: string;
}): string;
export type StatusKey = "draft" | "pending" | "progress" | "approved" | "done" | "rejected" | "cancelled" | "blocked";
export type ActivityItem = {
    kind: "comment";
    id: string;
    at: ChangeSet["at"];
    actor: Actor;
    text: string;
    own?: boolean;
} | {
    kind: "change";
    id: string;
    at: ChangeSet["at"];
    actor: Actor;
    changes: FieldChange[];
    source?: ChangeSource;
} | {
    kind: "status";
    id: string;
    at: ChangeSet["at"];
    actor: Actor;
    from: {
        status: StatusKey;
        label: string;
    };
    to: {
        status: StatusKey;
        label: string;
    };
    note?: string;
} | {
    kind: "file";
    id: string;
    at: ChangeSet["at"];
    actor: Actor;
    name: string;
    meta?: string;
} | {
    kind: "system";
    id: string;
    at: ChangeSet["at"];
    text: string;
    ref?: string;
};
/** Etkinlik akışı: en yeni üstte, gün başlıklı. filter: yalnız belirli türler (ör. ["comment"]) */
export declare function bizmoActivityHtml(items: ActivityItem[], opts?: {
    now?: Date;
    filter?: ActivityItem["kind"][];
}): string;
/** Ekran okuyucuya kısa duyuru (tek, gizli canlı bölge) */
export declare function bizmoAnnounce(text: string): void;
/** Kayıt numarası / IBAN / kod kopyalama düğmesi: tıklayınca panoya yazar, 1,6 sn onay işareti gösterir ve duyurur */
export declare function bizmoCopy(btn: HTMLElement, value?: string | (() => string)): () => void;
export type RecordTone = "success" | "warning" | "danger" | "info" | "neutral";
export interface RecordCardStep {
    label: string;
    note?: string;
    state: "done" | "active" | "todo" | "blocked";
}
export interface RecordCardData {
    /** "Satış siparişi", "İş emri", "İzin talebi" */
    kind: string;
    /** "SO-2026-0157 · Demir Metal" */
    title: string;
    /** durum çipi metni: "Üretimde" (renk tek başına anlam taşımaz) */
    status: string;
    tone?: RecordTone;
    /** 0–100 */
    progress?: number;
    steps?: RecordCardStep[];
    fields?: [string, string][];
    /** "Güncellendi 14:40" */
    updated?: string;
    href?: string;
    openLabel?: string;
    /** güvenilir SVG / ikon işaretlemesi (uygulamanın kendi ikonu); verilmezse belge simgesi */
    icon?: string;
}
/**
 * Kayıt kartı işaretlemesi (tüm metin kaçırılır). Kart içeriği iletiye gömülmez: ileti yalnız kaydın kodunu taşır,
 * her görüntüleyen kartı kendi yetkisiyle sunucudan çözer; erişimi olmayana kart hiç çizilmez ("Erişim yok" kartı da yok).
 */
export declare function recordCardHtml(r: RecordCardData, o?: {
    variant?: "inline" | "panel";
    open?: boolean;
    id?: string;
}): string;
/**
 * Kayıt kartlarını aç / kapa (olay devri: sonradan eklenen kartlar da çalışır). Üst satır bir düğmedir; Enter / Space yerleşik.
 * onRefresh verilirse "Yenile" düğmesi kartı ve kodu bildirir. Döndürülen işlev dinleyiciyi kaldırır.
 */
export declare function bizmoRecordCards(root?: HTMLElement | Document, o?: {
    onRefresh?: (card: HTMLElement) => void;
    onToggle?: (card: HTMLElement, open: boolean) => void;
}): () => void;
