/**
 * Bizmo Universal Theme · AG Grid
 *
 * AG Grid v33+ Theming API (themeQuartz.withParams). Değerler tokens.css değişkenlerine bağlıdır:
 * açık/koyu tema, yüksek karşıtlık ve "sıkı" yoğunluk sayfa temasıyla birlikte kendiliğinden değişir.
 *
 *   import { AgGridReact } from "ag-grid-react";
 *   import { themeQuartz } from "ag-grid-community";
 *   import { bizmoGridTheme, bizmoGridDefaults } from "@bizmo/theme/ag-grid";
 *   <AgGridReact theme={bizmoGridTheme(themeQuartz)} {...bizmoGridDefaults} rowData={rows} columnDefs={cols} />
 *
 * AG Grid ≤ v32 (CSS temaları): ag-grid.css dosyasını yükleyip kapsayıcıya class="ag-theme-quartz ag-theme-bizmo" verin.
 */
type ThemeLike = {
    withParams: (params: Record<string, unknown>, mode?: string) => ThemeLike;
};
/** Ortak parametreler: renkler CSS değişkeni olduğu için tek tema her iki modda da çalışır */
export declare const bizmoGridParams: {
    readonly browserColorScheme: "inherit";
    readonly fontFamily: string;
    readonly fontSize: 13.5;
    readonly headerFontFamily: string;
    readonly headerFontSize: 12;
    readonly headerFontWeight: 600;
    readonly backgroundColor: string;
    readonly foregroundColor: string;
    readonly textColor: string;
    readonly accentColor: string;
    readonly borderColor: string;
    readonly chromeBackgroundColor: string;
    readonly headerBackgroundColor: string;
    readonly headerTextColor: string;
    readonly oddRowBackgroundColor: "transparent";
    readonly rowHoverColor: string;
    readonly selectedRowBackgroundColor: string;
    readonly rangeSelectionBorderColor: string;
    readonly rangeSelectionBackgroundColor: string;
    readonly menuBackgroundColor: string;
    readonly panelBackgroundColor: string;
    readonly tooltipBackgroundColor: string;
    readonly tooltipTextColor: string;
    readonly modalOverlayBackgroundColor: string;
    readonly checkboxCheckedBackgroundColor: string;
    readonly checkboxCheckedBorderColor: string;
    readonly checkboxCheckedShapeColor: string;
    readonly checkboxUncheckedBorderColor: string;
    readonly inputFocusBorder: {
        readonly color: string;
    };
    readonly inputFocusShadow: {
        readonly radius: 3;
        readonly spread: 0;
        readonly color: string;
    };
    readonly wrapperBorder: {
        readonly color: string;
    };
    readonly wrapperBorderRadius: 16;
    readonly borderRadius: 10;
    readonly rowBorder: {
        readonly color: string;
    };
    readonly columnBorder: false;
    readonly headerColumnBorder: false;
    readonly headerRowBorder: {
        readonly color: string;
    };
    readonly pinnedRowBorder: {
        readonly color: string;
    };
    readonly menuShadow: string;
    readonly popupShadow: string;
    readonly cardShadow: string;
    readonly spacing: 6;
    readonly rowHeight: string;
    readonly headerHeight: 40;
    readonly iconSize: 16;
    readonly cellHorizontalPaddingScale: 1.15;
};
/** Hazır tema: theme={bizmoGridTheme(themeQuartz)} */
export declare function bizmoGridTheme<T extends ThemeLike>(base: T): T;
/**
 * Bizmo'nun varsayılan grid davranışları (props olarak yayın).
 * rowHeight burada VERİLMEZ: temadaki --bz-row-regular'dan gelir, böylece data-density="compact" canlı uygulanır.
 * Tek bir grid'i farklı yoğunlukta göstermek için: rowHeight={bizmoRowHeight.compact}
 */
export declare const bizmoGridDefaults: {
    readonly animateRows: true;
    readonly suppressCellFocus: false;
    readonly enableCellTextSelection: true;
    readonly ensureDomOrder: true;
    readonly pagination: false;
    readonly rowSelection: {
        readonly mode: "multiRow";
        readonly checkboxes: true;
        readonly headerCheckbox: true;
        readonly enableClickSelection: false;
    };
    readonly selectionColumnDef: {
        readonly pinned: "left";
        readonly width: 48;
        readonly minWidth: 48;
        readonly maxWidth: 48;
        readonly resizable: false;
        readonly suppressHeaderMenuButton: true;
    };
    readonly paginationPageSizeSelector: readonly [20, 50, 100];
    readonly defaultColDef: {
        readonly sortable: true;
        readonly resizable: true;
        readonly filter: true;
        readonly minWidth: 96;
        readonly flex: 1;
    };
    readonly overlayNoRowsTemplate: '<div class="bz-empty"><div class="bz-empty__title">Gösterilecek kayıt yok</div><div class="bz-empty__text">Filtreleri değiştirin veya yeni kayıt ekleyin.</div></div>';
    readonly overlayLoadingTemplate: '<span class="bz-spinner" aria-label="Yükleniyor"></span>';
};
/** Yoğunluğa göre satır yüksekliği: sıkı 32 · normal 40 · ferah 48 */
export declare const bizmoRowHeight: {
    readonly compact: 32;
    readonly regular: 40;
    readonly relaxed: 48;
};
/** Türkçe metinler (localeText). Diğer diller için AG Grid'in yerel paketleri kullanılabilir. */
export declare const bizmoGridLocaleTr: Record<string, string>;
/** Hücre biçimleyiciler: Türkçe sayı/para/tarih (Intl, sayfa diliyle) */
export declare const bizmoFormatters: {
    money: (value: unknown, currency?: string, locale?: string) => string;
    number: (value: unknown, locale?: string) => string;
    percent: (value: unknown, locale?: string) => string;
    date: (value: unknown, locale?: string) => string;
};
/**
 * Durum hücresi: çip + metin (renk asla tek başına anlam taşımaz).
 *   cellRenderer: bizmoStatusCell({ approved: ["Onaylandı", "success"], pending: ["Bekliyor", "warning"] })
 */
export declare function bizmoStatusCell(map: Record<string, [label: string, tone: "success" | "warning" | "danger" | "info" | "neutral"]>): (p: {
    value: unknown;
}) => HTMLElement | string;
/**
 * Detay içindeki iç içe grid teması: daha sıkı (satır 32, başlık 34), daha küçük köşe, ana grid ile aynı renkler.
 *   detailGridOptions: { theme: bizmoDetailGridTheme(themeQuartz), ...bizmoDetailGridDefaults }
 */
export declare function bizmoDetailGridTheme<T extends ThemeLike>(base: T): T;
export declare const bizmoDetailGridDefaults: {
    readonly animateRows: false;
    readonly suppressCellFocus: false;
    readonly enableCellTextSelection: true;
    readonly domLayout: "normal";
    readonly defaultColDef: {
        readonly sortable: true;
        readonly resizable: true;
        readonly filter: false;
        readonly minWidth: 80;
        readonly flex: 1;
    };
    readonly overlayNoRowsTemplate: '<div class="bz-empty"><div class="bz-empty__title">Kalem yok</div></div>';
};
/**
 * AG Grid Enterprise (masterDetail) ayarları — lisansınız varsa bunu kullanın:
 *   <AgGridReact masterDetail {...bizmoEnterpriseMasterDetail(themeQuartz, { getDetailRowData: (p) => p.successCallback(p.data.lines), columnDefs: lineCols })} />
 * Detay satırı Bizmo yüzeyinde (surface-2), iç grid sıkı temada açılır.
 */
export declare function bizmoEnterpriseMasterDetail<T extends ThemeLike>(base: T, opts: {
    columnDefs: unknown[];
    getDetailRowData: (p: any) => void;
    detailRowHeight?: number;
}): {
    masterDetail: boolean;
    detailRowHeight: number;
    detailCellRendererParams: {
        detailGridOptions: {
            animateRows: false;
            suppressCellFocus: false;
            enableCellTextSelection: true;
            domLayout: "normal";
            defaultColDef: {
                readonly sortable: true;
                readonly resizable: true;
                readonly filter: false;
                readonly minWidth: 80;
                readonly flex: 1;
            };
            overlayNoRowsTemplate: '<div class="bz-empty"><div class="bz-empty__title">Kalem yok</div></div>';
            theme: T;
            columnDefs: unknown[];
        };
        getDetailRowData: (p: any) => void;
    };
};
type MasterDetailOptions<T> = {
    /** Ana satırın kalıcı kimliği (getRowId ile aynı) */
    getId: (row: T) => string;
    /** Detay yüksekliği (px). Sabit veya satıra göre */
    detailHeight?: number | ((row: T) => number);
    /** Detay içeriğini host içine çizer; temizleme fonksiyonu döndürebilir (iç grid'i destroy etmek için) */
    renderDetail: (row: T, host: HTMLElement) => void | (() => void);
    /** Aynı anda tek detay açık kalsın mı (varsayılan: hayır) */
    single?: boolean;
    /** Erişilebilir ad: "SAT-2026-0412 ayrıntıları" */
    label?: (row: T) => string;
};
/**
 * Community sürümünde master / detail: tam genişlik detay satırı (Enterprise gerekmez).
 * Sıralama, filtre ve hızlı arama detayı ana satırının hemen altında tutar; detay satırı seçilemez.
 *
 *   const md = bizmoMasterDetail<Order>({ getId: (o) => o.code, detailHeight: 300, renderDetail: (o, host) => { … } });
 *   createGrid(el, { ...bizmoGridDefaults, ...md.gridOptions, rowSelection: md.rowSelection(bizmoGridDefaults.rowSelection), columnDefs: [
 *     { field: "code", cellRenderer: md.expanderRenderer }, …
 *   ], isExternalFilterPresent, doesExternalFilterPass: (n) => myFilter(md.masterOf(n.data)) });
 *
 * Kendi rowClassRules'unuzu md.gridOptions.rowClassRules ile birleştirin; satır kurallarınızda md.isDetail(p.data) olanları atlayın.
 */
export declare function bizmoMasterDetail<T extends Record<string, any>>(opts: MasterDetailOptions<T>): {
    gridOptions: {
        getRowId: (p: any) => string;
        isFullWidthRow: (p: any) => boolean;
        fullWidthCellRenderer: {
            new (): {
                gui: HTMLElement;
                cleanup?: () => void;
                init(p: any): void;
                getGui(): HTMLElement;
                refresh(): boolean;
                destroy(): void;
            };
        };
        getRowHeight: (p: any) => number | undefined;
        rowClassRules: {
            "bz-row-expanded": (p: any) => boolean;
        };
        postSortRows: (p: any) => void;
    };
    rowSelection: <S extends Record<string, unknown>>(base: S) => S & {
        isRowSelectable: (n: any) => boolean;
    };
    expanderRenderer: (p: any) => HTMLElement | string;
    toggle: (api: any, row: T, open?: boolean) => void;
    collapseAll: (api: any) => void;
    isDetail: (d: any) => boolean;
    masterOf: (d: any) => T;
    expanded: Set<string>;
};
export {};
