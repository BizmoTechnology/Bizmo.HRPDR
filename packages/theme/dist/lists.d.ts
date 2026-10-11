import { type MaskKind } from "./privacy.js";
export type FieldType = "text" | "number" | "money" | "date" | "enum" | "bool";
export interface ListField {
    key: string;
    label: string;
    type?: FieldType;
    /** enum: değer → görünen ad */
    options?: Record<string, string>;
    unit?: string;
    /** kişisel veri: süzgeçte kısıtlı, dışa aktarmada maskeli, içe aktarmada biçim denetimi (tckn, iban) */
    personal?: MaskKind;
    /** satırdan değer (varsayılan row[key]) */
    get?: (row: any) => unknown;
    required?: boolean;
    aliases?: string[];
    pattern?: RegExp;
    min?: number;
    max?: number;
    maxLength?: number;
    unique?: boolean;
}
export type Op = "contains" | "notContains" | "eq" | "neq" | "starts" | "gt" | "gte" | "lt" | "lte" | "between" | "on" | "before" | "after" | "last" | "period" | "in" | "notIn" | "isTrue" | "isFalse" | "empty" | "notEmpty";
export interface FilterRule {
    field: string;
    op: Op;
    value?: unknown;
    value2?: unknown;
}
export interface FilterGroup {
    join: "and" | "or";
    rules: (FilterRule | FilterGroup)[];
}
type Arity = 0 | 1 | 2 | "list" | "days" | "period";
export interface OpDef {
    op: Op;
    label: string;
    arity: Arity;
}
export declare const OPERATORS: Record<FieldType, OpDef[]>;
/** Tarih dönemleri (hafta pazartesi başlar): değer anahtarı süzgeçte saklanır, aralık her değerlendirmede bugüne göre hesaplanır */
export declare const DATE_PERIODS: Record<string, {
    label: string;
    range: (today: Date) => [Date | null, Date | null];
}>;
export declare const isGroup: (x: FilterRule | FilterGroup) => x is FilterGroup;
export declare const opsFor: (f: ListField) => OpDef[];
/** Kural eksiksiz mi (değeri girilmiş mi) — eksik kural özete ve süzmeye katılmaz */
export declare function ruleComplete(r: FilterRule, fields: ListField[]): boolean;
export declare function ruleCount(g: FilterGroup, fields?: ListField[]): number;
/** Okunur özet: "ve" / "veya", iç grup parantezli. Boş süzgeç → "" */
export declare function filterSummary(g: FilterGroup, fields: ListField[], nested?: boolean): string;
/** Üst düzey kurallar çip olarak (iç grup tek çip); i ile removeRule'a verilir */
export declare function filterChips(g: FilterGroup, fields: ListField[]): {
    i: number;
    text: string;
    group: boolean;
}[];
export declare const removeRule: (g: FilterGroup, i: number) => FilterGroup;
/** İstemci tarafında süzme (küçük listeler, önizleme). Büyük listede süzgeç sunucuya JSON olarak gider. */
export declare function matchFilter(row: any, g: FilterGroup, fields: ListField[], now?: number): boolean;
/**
 * Görsel süzgeç oluşturucu: alan · koşul · değer satırları, VE / VEYA grupları (maxDepth 2 = ana grup + bir iç grup).
 * Değer türüne göre giriş: metin, sayı (tr-TR ondalık virgül), tarih (temanın seçicisi), liste (çoklu seçim çipleri).
 */
export declare function bizmoFilterBuilder(host: HTMLElement, o: {
    fields: ListField[];
    value?: FilterGroup;
    onChange?: (g: FilterGroup) => void;
    maxDepth?: number;
    label?: string;
}): {
    get: () => FilterGroup;
    set: (g: FilterGroup) => void;
    destroy: () => void;
};
export interface QuickFilter {
    id: string;
    label: string;
    rules: FilterRule[];
}
/**
 * Pratik süzgeç çubuğu (Linear / Notion tarzı): her koşul bir hap — [Alan] [koşul] [değer] [×]; her parça tıklanınca küçük
 * pencere açar. "+ Süzgeç" alan arar (yaz-süz, ↑↓, Enter), seçilen alanda doğrudan değer penceresi açılır. Liste değeri onay
 * kutulu (aramalı), tarih için hazır dönemler (bugün, bu hafta, gecikmiş…) ve özel aralık, sayıda tek / iki alan.
 * Hızlı süzgeç çipleri tek dokunuşla ekler / kaldırır. İki ve daha çok koşulda "Tümü / Herhangi biri" birleşimi.
 * İç gruplar (gelişmiş) tek hap olarak görünür; tıklanınca onAdvanced çağrılır. Değer girilmemiş hap kesikli ve uygulanmaz.
 */
export declare function bizmoFilterBar(host: HTMLElement, o: {
    fields: ListField[];
    value?: FilterGroup;
    onChange?: (g: FilterGroup) => void;
    quick?: QuickFilter[];
    onAdvanced?: () => void;
    label?: string;
    now?: number;
}): {
    get: () => FilterGroup;
    set(g: FilterGroup): void;
    /** Klavye kısayolu için: "+ Süzgeç" penceresini açar (ör. F tuşu) */
    open(): void;
    destroy(): void;
};
export interface ColumnState {
    key: string;
    label?: string;
    visible: boolean;
    pinned?: "left" | "right" | null;
    width?: number;
}
export interface ViewState {
    filter: FilterGroup;
    columns: ColumnState[];
    sort: {
        key: string;
        dir: "asc" | "desc";
    }[];
    group?: string | null;
    density?: "comfortable" | "compact";
    q?: string;
}
export interface ListView {
    id: string;
    name: string;
    scope: "mine" | "shared" | "system";
    owner?: string;
    isDefault?: boolean;
    state: ViewState;
}
/** Eksik kuralları ve boş grupları atar — sunucuya gidecek ve karşılaştırılacak süzgeç budur */
export declare function pruneFilter(g: FilterGroup, fields: ListField[]): FilterGroup;
/**
 * Kayıtlı görünümden ne değişti: süzgeç · sütunlar · sıralama · gruplama · yoğunluk · arama (sütun genişliği sayılmaz).
 * fields verilirse yarım kalmış (değeri girilmemiş) koşul değişiklik sayılmaz.
 */
export declare function viewChanges(saved: ViewState, cur: ViewState, fields?: ListField[]): string[];
export declare const viewDirty: (saved: ViewState, cur: ViewState, fields?: ListField[]) => boolean;
/** Süzgeçte kişisel veri değeri var mı — varsa görünüm paylaşılamaz (KVKK) */
export declare function viewHasPersonal(state: ViewState, fields: ListField[]): boolean;
/** "Benim görünümlerim" için tarayıcı deposu (cihaza özel). Paylaşılan ve sistem görünümleri sunucudan gelir. */
export declare function localViewStore(key: string): {
    list: () => ListView[];
    save(v: ListView): void;
    remove(id: string): void;
    getDefault: () => string | null;
    setDefault(id: string | null): void;
};
/** AG Grid: api.applyColumnState({ state: toAgColumnState(cols), applyOrder: true }) */
export declare const toAgColumnState: (cols: ColumnState[]) => {
    colId: string;
    hide: boolean;
    pinned: "left" | "right" | null;
    width?: number | undefined;
}[];
export declare const fromAgColumnState: (state: {
    colId: string;
    hide?: boolean | null;
    pinned?: "left" | "right" | boolean | null;
    width?: number;
}[], labels?: Record<string, string>) => ColumnState[];
/**
 * Sütun seçici: göster / gizle, sırala (sürükle, ↑↓ düğmeleri ya da Alt+↑↓), sola sabitle, ara, varsayılana dön.
 * Sabit sütunlar listenin başında toplanır. En az bir sütun görünür kalır.
 */
export declare function bizmoColumnChooser(host: HTMLElement, o: {
    columns: ColumnState[];
    defaults?: ColumnState[];
    onChange?: (cols: ColumnState[]) => void;
}): {
    get: () => ColumnState[];
    set: (c: ColumnState[]) => void;
    destroy: () => string;
};
export interface ExportColumn {
    key: string;
    label: string;
    type?: FieldType;
    options?: Record<string, string>;
    personal?: MaskKind;
    get?: (row: any) => unknown;
}
/**
 * CSV (Türkçe Excel uyumlu varsayılan: ";" ayraç, ondalık virgül, UTF-8 BOM, tarih GG.AA.YYYY).
 * Kişisel sütunlar varsayılan maskeli (mask: false yalnız yetkili ve kayıtlı aktarımda).
 */
export declare function toCsv(rows: any[], cols: ExportColumn[], o?: {
    sep?: ";" | "," | "\t";
    bom?: boolean;
    mask?: boolean;
    decimal?: "," | ".";
}): string;
/**
 * XLSX (Office Open XML) — bağımlılıksız: kalın ve sabit başlık satırı, otomatik süzgeç, sütun genişliği,
 * sayı / tutar sayı hücresi (#,##0.00), tarih gerçek tarih hücresi (GG.AA.YYYY). Kişisel sütunlar varsayılan maskeli.
 */
export declare function toXlsx(rows: any[], cols: ExportColumn[], o?: {
    sheet?: string;
    mask?: boolean;
}): Uint8Array;
/** Tarayıcıda dosya indirir (bağlantı tıklaması, URL hemen bırakılır) */
export declare function bizmoDownload(data: string | Uint8Array | Blob, filename: string, type?: string): void;
/** "siparisler-2026-10-11.xlsx": Türkçe karakterler sadeleşir, tarih eklenir */
export declare function exportFileName(base: string, ext: "csv" | "xlsx", at?: Date): string;
/** Dışa aktarma denetim olayı — yalnız metadata: kim ve ne zaman sunucuda eklenir; değer, satır içeriği, IP yok */
export declare function exportAudit(o: {
    list: string;
    format: "csv" | "xlsx";
    rows: number;
    columns: ExportColumn[];
    filter?: string;
    scope: "selected" | "filtered" | "all";
    masked: boolean;
    classification?: string;
}): {
    action: "export";
    list: string;
    format: "csv" | "xlsx";
    scope: "all" | "filtered" | "selected";
    rows: number;
    columns: number;
    personalColumns: string[];
    masked: boolean;
    filter: string;
    classification: string;
    at: string;
};
/** Dosya baytlarını metne çevirir: UTF-8 (BOM'lu / BOM'suz); geçersizse Türkçe Excel'in varsayılanı Windows-1254 */
export declare function decodeText(bytes: ArrayBuffer | Uint8Array): string;
/** RFC 4180 CSV: tırnaklı alan, kaçırılmış tırnak, satır içi satır sonu, BOM; ayraç (; , sekme) ilk satırdan sezilir */
export declare function parseCsv(text: string, o?: {
    sep?: string;
}): {
    sep: string;
    headers: string[];
    rows: string[][];
};
/** "1.234,56" · "1234,56" · "1,234.56" · "₺ 12.500" · "%12,5" → sayı; anlaşılmazsa NaN */
export declare function parseNumberTr(input: string): number;
/** "31.12.2026" · "31/12/2026" · "31-12-2026" · "2026-12-31" · "31.12.26" → "2026-12-31"; geçersiz (30.02) → null */
export declare function parseDateTr(input: string): string | null;
/** XLSX'in ilk sayfasını okur: başlık satırı + satırlar (metin). Tarih biçimli hücre "YYYY-AA-GG" döner. */
export declare function readXlsx(data: ArrayBuffer | Uint8Array): Promise<{
    sheet: string;
    headers: string[];
    rows: string[][];
}>;
/** Dosya sütunlarını alanlarla eşler: önce ad / anahtar / takma ad tam eşleşmesi (Türkçe karakter ve boşluk duyarsız), sonra tek anlamlı kısmi eşleşme */
export declare function autoMap(headers: string[], fields: ListField[]): (string | null)[];
export interface ImportIssue {
    row: number;
    field?: string;
    level: "error" | "warning";
    message: string;
}
export interface ImportRow {
    row: number;
    values: Record<string, unknown>;
    issues: ImportIssue[];
    action: "create" | "update" | "skip";
}
export interface ImportResult {
    rows: ImportRow[];
    missing: string[];
    summary: {
        total: number;
        create: number;
        update: number;
        error: number;
        warning: number;
    };
}
/**
 * Satırları doğrular ve türe çevirir (deneme çalıştırması: hiçbir şey yazılmaz). Satır numarası dosyadaki numaradır
 * (başlık 1. satır). key verilirse o alan var olan kayıtla eşleşince "güncelle", yoksa "yeni"; hatalı satır "atla".
 */
export declare function validateImport(rows: string[][], mapping: (string | null)[], fields: ListField[], o?: {
    key?: string;
    exists?: (key: string) => boolean;
}): ImportResult;
export {};
