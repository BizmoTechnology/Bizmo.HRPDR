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
const v = (name) => `var(--bz-${name})`;
/** Ortak parametreler: renkler CSS değişkeni olduğu için tek tema her iki modda da çalışır */
export const bizmoGridParams = {
    browserColorScheme: "inherit",
    fontFamily: v("font-sans"),
    fontSize: 13.5,
    headerFontFamily: v("font-sans"),
    headerFontSize: 12,
    headerFontWeight: 600,
    backgroundColor: v("surface"),
    foregroundColor: v("text"),
    textColor: v("text"),
    accentColor: v("accent"),
    borderColor: v("divider"),
    chromeBackgroundColor: v("grid-header-bg"),
    headerBackgroundColor: v("grid-header-bg"),
    headerTextColor: v("text-2"),
    oddRowBackgroundColor: "transparent",
    rowHoverColor: v("grid-row-hover"),
    selectedRowBackgroundColor: v("grid-row-selected"),
    rangeSelectionBorderColor: v("accent"),
    rangeSelectionBackgroundColor: v("accent-soft"),
    menuBackgroundColor: v("glass-strong"),
    panelBackgroundColor: v("surface"),
    tooltipBackgroundColor: v("text"),
    tooltipTextColor: v("bg"),
    modalOverlayBackgroundColor: v("scrim"),
    checkboxCheckedBackgroundColor: v("accent"),
    checkboxCheckedBorderColor: v("accent"),
    checkboxCheckedShapeColor: v("accent-contrast"),
    checkboxUncheckedBorderColor: v("control-border"),
    inputFocusBorder: { color: v("focus") },
    inputFocusShadow: { radius: 3, spread: 0, color: v("accent-soft") },
    wrapperBorder: { color: v("glass-border") },
    wrapperBorderRadius: 16,
    borderRadius: 10,
    rowBorder: { color: v("divider") },
    columnBorder: false,
    headerColumnBorder: false,
    headerRowBorder: { color: v("divider") },
    pinnedRowBorder: { color: v("border-strong") },
    menuShadow: v("shadow-3"),
    popupShadow: v("shadow-3"),
    cardShadow: v("shadow-1"),
    spacing: 6,
    rowHeight: v("row-regular"),
    headerHeight: 40,
    iconSize: 16,
    cellHorizontalPaddingScale: 1.15,
};
/** Hazır tema: theme={bizmoGridTheme(themeQuartz)} */
export function bizmoGridTheme(base) {
    return base.withParams(bizmoGridParams);
}
/**
 * Bizmo'nun varsayılan grid davranışları (props olarak yayın).
 * rowHeight burada VERİLMEZ: temadaki --bz-row-regular'dan gelir, böylece data-density="compact" canlı uygulanır.
 * Tek bir grid'i farklı yoğunlukta göstermek için: rowHeight={bizmoRowHeight.compact}
 */
export const bizmoGridDefaults = {
    animateRows: true,
    suppressCellFocus: false,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    pagination: false,
    rowSelection: { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false },
    // Seçim sütunu her zaman en solda ve sabit (v32.2+)
    selectionColumnDef: { pinned: "left", width: 48, minWidth: 48, maxWidth: 48, resizable: false, suppressHeaderMenuButton: true },
    paginationPageSizeSelector: [20, 50, 100],
    defaultColDef: { sortable: true, resizable: true, filter: true, minWidth: 96, flex: 1 },
    overlayNoRowsTemplate: '<div class="bz-empty"><div class="bz-empty__title">Gösterilecek kayıt yok</div><div class="bz-empty__text">Filtreleri değiştirin veya yeni kayıt ekleyin.</div></div>',
    overlayLoadingTemplate: '<span class="bz-spinner" aria-label="Yükleniyor"></span>',
};
/** Yoğunluğa göre satır yüksekliği: sıkı 32 · normal 40 · ferah 48 */
export const bizmoRowHeight = { compact: 32, regular: 40, relaxed: 48 };
/** Türkçe metinler (localeText). Diğer diller için AG Grid'in yerel paketleri kullanılabilir. */
export const bizmoGridLocaleTr = {
    noRowsToShow: "Gösterilecek kayıt yok",
    loadingOoo: "Yükleniyor…",
    page: "Sayfa",
    of: "/",
    to: "–",
    more: "daha fazla",
    next: "Sonraki",
    last: "Son",
    first: "İlk",
    previous: "Önceki",
    pageSizeSelectorLabel: "Sayfa boyutu:",
    ariaPageSizeSelectorLabel: "Sayfa boyutu",
    pageLastRowUnknown: "?",
    footerTotal: "Toplam",
    loadingError: "Hata",
    searchOoo: "Ara…",
    selectAll: "Tümünü seç",
    selectAllSearchResults: "Tüm sonuçları seç",
    blanks: "(Boş)",
    noMatches: "Eşleşme yok",
    filterOoo: "Filtrele…",
    equals: "Eşittir",
    notEqual: "Eşit değil",
    contains: "İçerir",
    notContains: "İçermez",
    startsWith: "İle başlar",
    endsWith: "İle biter",
    lessThan: "Küçüktür",
    greaterThan: "Büyüktür",
    inRange: "Aralıkta",
    lessThanOrEqual: "Küçük veya eşit",
    greaterThanOrEqual: "Büyük veya eşit",
    before: "Önce",
    after: "Sonra",
    blank: "Boş",
    notBlank: "Boş değil",
    dateFormatOoo: "gg.aa.yyyy",
    andCondition: "VE",
    orCondition: "VEYA",
    applyFilter: "Uygula",
    resetFilter: "Sıfırla",
    clearFilter: "Temizle",
    cancelFilter: "Vazgeç",
    columns: "Sütunlar",
    filters: "Filtreler",
    pinColumn: "Sütunu sabitle",
    pinLeft: "Sola sabitle",
    pinRight: "Sağa sabitle",
    noPin: "Sabitleme yok",
    autosizeThisColumn: "Bu sütunu sığdır",
    autosizeAllColumns: "Tüm sütunları sığdır",
    resetColumns: "Sütunları sıfırla",
    copy: "Kopyala",
    copyWithHeaders: "Başlıklarla kopyala",
    export: "Dışa aktar",
    csvExport: "CSV olarak",
    excelExport: "Excel olarak",
    sortAscending: "Artan sırala",
    sortDescending: "Azalan sırala",
    sortUnSort: "Sıralamayı kaldır",
    group: "Grup",
    rowGroupColumnsEmptyMessage: "Gruplamak için sütunu buraya sürükleyin",
    sum: "Toplam",
    min: "En küçük",
    max: "En büyük",
    count: "Adet",
    avg: "Ortalama",
    totalRows: "Toplam satır",
    selectedRows: "Seçili",
    filteredRows: "Filtrelenen",
};
/** Hücre biçimleyiciler: Türkçe sayı/para/tarih (Intl, sayfa diliyle) */
export const bizmoFormatters = {
    money: (value, currency = "TRY", locale = "tr-TR") => typeof value === "number" ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value) : "",
    number: (value, locale = "tr-TR") => (typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : ""),
    percent: (value, locale = "tr-TR") => typeof value === "number" ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100) : "",
    date: (value, locale = "tr-TR") => (value ? new Date(String(value)).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : ""),
};
/**
 * Durum hücresi: çip + metin (renk asla tek başına anlam taşımaz).
 *   cellRenderer: bizmoStatusCell({ approved: ["Onaylandı", "success"], pending: ["Bekliyor", "warning"] })
 */
export function bizmoStatusCell(map) {
    return (p) => {
        if (p.value === null || p.value === undefined || p.value === "")
            return ""; // toplam/sabit satırda boş çip çizme
        const [label, tone] = map[String(p.value)] ?? [String(p.value), "neutral"];
        const span = document.createElement("span");
        span.className = `bz-chip${tone === "neutral" ? "" : ` bz-chip--${tone}`}`;
        span.textContent = label;
        return span;
    };
}
// ───────────────────────── Master / detail ─────────────────────────
/**
 * Detay içindeki iç içe grid teması: daha sıkı (satır 32, başlık 34), daha küçük köşe, ana grid ile aynı renkler.
 *   detailGridOptions: { theme: bizmoDetailGridTheme(themeQuartz), ...bizmoDetailGridDefaults }
 */
export function bizmoDetailGridTheme(base) {
    return base.withParams({
        ...bizmoGridParams,
        wrapperBorderRadius: 12,
        headerHeight: 34,
        rowHeight: 32,
        fontSize: 13,
        headerFontSize: 11.5,
        headerBackgroundColor: v("surface-2"),
        chromeBackgroundColor: v("surface-2"),
    });
}
export const bizmoDetailGridDefaults = {
    animateRows: false,
    suppressCellFocus: false,
    enableCellTextSelection: true,
    domLayout: "normal",
    defaultColDef: { sortable: true, resizable: true, filter: false, minWidth: 80, flex: 1 },
    overlayNoRowsTemplate: '<div class="bz-empty"><div class="bz-empty__title">Kalem yok</div></div>',
};
/**
 * AG Grid Enterprise (masterDetail) ayarları — lisansınız varsa bunu kullanın:
 *   <AgGridReact masterDetail {...bizmoEnterpriseMasterDetail(themeQuartz, { getDetailRowData: (p) => p.successCallback(p.data.lines), columnDefs: lineCols })} />
 * Detay satırı Bizmo yüzeyinde (surface-2), iç grid sıkı temada açılır.
 */
export function bizmoEnterpriseMasterDetail(base, opts) {
    return {
        masterDetail: true,
        detailRowHeight: opts.detailRowHeight ?? 320,
        detailCellRendererParams: {
            detailGridOptions: { theme: bizmoDetailGridTheme(base), ...bizmoDetailGridDefaults, columnDefs: opts.columnDefs },
            getDetailRowData: opts.getDetailRowData,
        },
    };
}
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
export function bizmoMasterDetail(opts) {
    const DETAIL = "__bzDetail";
    const MASTER = "__bzMaster";
    const expanded = new Set();
    const isDetail = (d) => !!d && d[DETAIL] === true;
    const masterOf = (d) => (isDetail(d) ? d[MASTER] : d);
    const detailId = (id) => `${id}::detail`;
    const height = (row) => (typeof opts.detailHeight === "function" ? opts.detailHeight(row) : opts.detailHeight ?? 320);
    class DetailRenderer {
        gui;
        cleanup;
        init(p) {
            const row = masterOf(p.data);
            this.gui = document.createElement("div");
            this.gui.className = "bz-detail-host";
            const panel = document.createElement("div");
            panel.className = "bz-detail";
            panel.setAttribute("role", "region");
            panel.setAttribute("aria-label", opts.label ? opts.label(row) : `${opts.getId(row)} ayrıntıları`);
            // Detay içindeki tıklama/tuşlar ana grid'e (seçim, gezinme) taşmasın
            for (const ev of ["click", "dblclick", "keydown", "mousedown"])
                panel.addEventListener(ev, (e) => e.stopPropagation());
            this.gui.appendChild(panel);
            const r = opts.renderDetail(row, panel);
            this.cleanup = typeof r === "function" ? r : undefined;
        }
        getGui() {
            return this.gui;
        }
        refresh() {
            return false;
        }
        destroy() {
            this.cleanup?.();
        }
    }
    function toggle(api, row, open) {
        const id = opts.getId(row);
        const willOpen = open ?? !expanded.has(id);
        const touched = [];
        if (willOpen && opts.single)
            for (const other of [...expanded])
                if (other !== id) {
                    expanded.delete(other);
                    const d = api.getRowNode(detailId(other));
                    if (d)
                        api.applyTransaction({ remove: [d.data] });
                    const m = api.getRowNode(other);
                    if (m)
                        touched.push(m);
                }
        if (willOpen && !expanded.has(id)) {
            expanded.add(id);
            const master = api.getRowNode(id);
            api.applyTransaction({ add: [{ ...row, [DETAIL]: true, [MASTER]: row }], addIndex: master ? master.sourceRowIndex + 1 : undefined });
        }
        else if (!willOpen && expanded.has(id)) {
            expanded.delete(id);
            const d = api.getRowNode(detailId(id));
            if (d)
                api.applyTransaction({ remove: [d.data] });
        }
        const m = api.getRowNode(id);
        if (m)
            touched.push(m);
        api.redrawRows({ rowNodes: touched });
    }
    function collapseAll(api) {
        const rows = [...expanded].map((id) => api.getRowNode(detailId(id))?.data).filter(Boolean);
        expanded.clear();
        if (rows.length)
            api.applyTransaction({ remove: rows });
        api.redrawRows();
    }
    /** Genişletme düğmeli hücre: { field: "code", cellRenderer: md.expanderRenderer } */
    function expanderRenderer(p) {
        if (!p.data || p.node.rowPinned)
            return p.valueFormatted ?? p.value ?? "";
        const row = p.data;
        const id = opts.getId(row);
        const wrap = document.createElement("span");
        wrap.className = "bz-expander";
        const btn = document.createElement("button");
        btn.type = "button";
        const open = expanded.has(id);
        btn.setAttribute("aria-expanded", String(open));
        btn.setAttribute("aria-label", `${id} ayrıntılarını ${open ? "gizle" : "göster"}`);
        btn.title = open ? "Ayrıntıları gizle" : "Ayrıntıları göster";
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggle(p.api, row);
        });
        const text = document.createElement("span");
        text.textContent = String(p.valueFormatted ?? p.value ?? "");
        wrap.append(btn, text);
        return wrap;
    }
    const gridOptions = {
        getRowId: (p) => (isDetail(p.data) ? detailId(opts.getId(p.data[MASTER])) : opts.getId(p.data)),
        isFullWidthRow: (p) => isDetail(p.rowNode.data),
        fullWidthCellRenderer: DetailRenderer,
        getRowHeight: (p) => (isDetail(p.data) ? height(p.data[MASTER]) : undefined),
        rowClassRules: { "bz-row-expanded": (p) => !!p.data && !isDetail(p.data) && expanded.has(opts.getId(p.data)) },
        // Sıralamadan sonra her detay ana satırının hemen altına taşınır
        postSortRows: (p) => {
            const nodes = p.nodes;
            const details = new Map();
            for (let i = nodes.length - 1; i >= 0; i--)
                if (isDetail(nodes[i].data))
                    details.set(opts.getId(nodes[i].data[MASTER]), nodes.splice(i, 1)[0]);
            for (let i = 0; i < nodes.length && details.size; i++) {
                const d = details.get(opts.getId(nodes[i].data));
                if (d) {
                    nodes.splice(i + 1, 0, d);
                    details.delete(opts.getId(nodes[i].data));
                    i++;
                }
            }
        },
    };
    /** Seçim ayarına detay satırı istisnasını ekler (AG Grid v32.2+: rowSelection.isRowSelectable) */
    function rowSelection(base) {
        const prev = base.isRowSelectable;
        return { ...base, isRowSelectable: (n) => !isDetail(n.data) && (prev ? prev(n) : true) };
    }
    return { gridOptions, rowSelection, expanderRenderer, toggle, collapseAll, isDetail, masterOf, expanded };
}
