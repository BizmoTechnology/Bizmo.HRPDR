import { type MenuItem } from "./gestures.js";
export type TaskStatus = "planned" | "released" | "running" | "done" | "hold" | "late";
export interface GanttBlock {
    from: number;
    to: number;
    kind: "maint" | "off";
    label?: string;
}
export interface GanttLane {
    id: string;
    label: string;
    sub?: string;
    blocks?: GanttBlock[];
}
export interface GanttTask {
    id: string;
    lane: string;
    start: number;
    end: number;
    label: string;
    sub?: string;
    status?: TaskStatus;
    /** 0–1, çalışan işte dolu kısım */
    progress?: number;
    /** hazırlık (setup) süresi, işin başında taralı */
    setupMin?: number;
    /** termin: bitiş terminden sonraysa "gecikecek" */
    due?: number;
    /** kilitli iş taşınmaz (başlamış, malzemesi ayrılmış) */
    locked?: boolean;
}
export declare const TASK_STATUS: Record<TaskStatus, string>;
/** İş → çakıştığı işler ve bakım blokları (aynı şeritte zaman kesişimi) */
export declare function ganttConflicts(tasks: GanttTask[], lanes?: GanttLane[]): Map<string, string[]>;
/** Kapasite: her şerit için dilim başına doluluk (0 = boş, 1 = tam, > 1 = aşırı yük); bakım / kapalı süre kapasiteden düşer */
export declare function laneLoad(tasks: GanttTask[], lanes: GanttLane[], from: number, to: number, bucketMs?: number): {
    lane: string;
    buckets: number[];
    total: number;
}[];
/** Önceki iş bitmeden sonraki başlayamaz (FS); lagMin: aradaki bekleme (kuruma, soğuma, taşıma) */
export interface GanttLink {
    from: string;
    to: string;
    lagMin?: number;
}
/** Sıra ihlalleri: sonraki iş, önceki bitmeden (+ bekleme) başlıyorsa "a>b" → açıklama */
export declare function ganttLinkIssues(tasks: GanttTask[], links: GanttLink[]): Map<string, string>;
/** İşin bağlı zinciri: öncekiler (yukarı akış) ve sonrakiler (aşağı akış) */
export declare function ganttChain(links: GanttLink[], id: string): {
    up: Set<string>;
    down: Set<string>;
};
/** from → to bağlantısı döngü oluşturur mu (to'dan from'a zaten yol varsa) */
export declare const ganttWouldCycle: (links: GanttLink[], from: string, to: string) => boolean;
/**
 * Bağlı işleri ileri kaydırır: taşınan işten sonra gelen her iş, önceki(ler)i bitmeden başlıyorsa en erken uygun zamana itilir
 * (süre korunur, kilitli işe dokunulmaz). Kaydırılan işlerin kimlikleri döner. Yalnız ileri iter, geri çekmez.
 */
export declare function ganttCascade(tasks: GanttTask[], links: GanttLink[], movedId: string, snapMin?: number): {
    tasks: GanttTask[];
    shifted: string[];
};
export interface GanttPath {
    id: string;
    up: string[];
    down: string[];
    ids: string[];
    start: number;
    end: number;
    late: string[];
    violations: number;
    text: string;
}
/** Yol izleme özeti: zincirdeki işler (başlangıca göre sıralı), ilk başlangıç, son bitiş, geciken ve sıra ihlali sayısı */
export declare function ganttPath(tasks: GanttTask[], links: GanttLink[], id: string): GanttPath | null;
/**
 * Üretim planı Gantt'ı. Şerit = makine / hat; iş çubuğu sürüklenerek zamanı ve şeridi değişir, sağ uçtan uzar / kısalır.
 * Bağlantı: çubuğun sağındaki noktadan başka işe sürükle ya da menüden "Bağla…"; ok önceki işin bitişinden sonrakinin başına,
 * 90° akson. Önceki bitmeden başlayan iş kırmızı kesikli okla (sıra ihlali); autoShift açıksa bağlı işler ileri itilir.
 * Yol izleme: işe tıklayınca öncekiler ve sonrakiler belirginleşir, gerisi soluklaşır (Esc bırakır); onTrace özet verir.
 * Sağ tık / basılı tut / Shift+F10: yolu izle, bağla, bağlantı kaldır, durum, kilit, en erken boşluğa çek, ayrıntı.
 * Klavye: ←/→ kaydır (snap, Shift ile 1 saat) · Alt+↑/↓ şerit · +/− süre · Boşluk yolu izle · L bağla · Enter ayrıntı · Esc bırak.
 * Haptik: sürükleme başı, her adım, bırakma (başarı / çakışma / ret) ve bağlantı. onChange / onLink false dönerse geri alınır.
 */
export declare function bizmoGantt(host: HTMLElement, o: {
    lanes: GanttLane[];
    tasks: GanttTask[];
    links?: GanttLink[];
    from: number;
    to: number;
    snapMin?: number;
    hourWidth?: number;
    now?: number;
    readOnly?: boolean;
    /** bağlı işleri ileri kaydır (taşınan işten sonra gelenler) */
    autoShift?: boolean;
    loadBucketMin?: number;
    label?: string;
    onChange?: (task: GanttTask, prev: GanttTask) => boolean | void | Promise<boolean | void>;
    /** autoShift ile kaydırılan işler (sunucuya toplu gönderim için) */
    onCascade?: (shifted: GanttTask[]) => void;
    onLink?: (link: GanttLink, action: "add" | "remove") => boolean | void | Promise<boolean | void>;
    onTrace?: (path: GanttPath | null) => void;
    onOpen?: (task: GanttTask) => void;
    /** bağlam menüsüne eklenecek uygulama öğeleri */
    menu?: (task: GanttTask) => MenuItem[];
}): {
    get: () => {
        id: string;
        lane: string;
        start: number;
        end: number;
        label: string;
        sub?: string;
        status?: TaskStatus;
        /** 0–1, çalışan işte dolu kısım */
        progress?: number;
        /** hazırlık (setup) süresi, işin başında taralı */
        setupMin?: number;
        /** termin: bitiş terminden sonraysa "gecikecek" */
        due?: number;
        /** kilitli iş taşınmaz (başlamış, malzemesi ayrılmış) */
        locked?: boolean;
    }[];
    getLinks: () => {
        from: string;
        to: string;
        lagMin?: number;
    }[];
    set(next: GanttTask[], nextLinks?: GanttLink[]): void;
    /** Yol izleme: id ver ya da null ile bırak */
    trace: (id: string | null) => void;
    setAutoShift(on: boolean): void;
    /** Şimdi çizgisini görünür alana getirir */
    scrollToNow(): void;
    destroy: () => string;
};
export type MachineKind = "cnc" | "lathe" | "press" | "welding" | "assembly" | "laser" | "paint" | "generic";
export type MachineState = "run" | "warn" | "stop" | "maint" | "idle";
/**
 * Tezgah / iş merkezi. Günlük brüt saat: hours (sabit ya da güne göre) ya da vardiya × vardiya süresi (shifts × shiftHours,
 * varsayılan 8 sa). Verim: efficiency ya da OEE kırılımının çarpımı (kullanılabilirlik × performans × kalite).
 * Görsel: image (uygulamanın fotoğrafı) yoksa türe göre temanın çizimi (kind).
 */
export interface WorkCenter {
    id: string;
    label: string;
    sub?: string;
    skills: string[];
    hours?: number | number[];
    shifts?: number | number[];
    shiftHours?: number;
    efficiency?: number;
    oee?: {
        availability: number;
        performance: number;
        quality: number;
    };
    down?: {
        bucket: string;
        hours: number;
        label?: string;
    }[];
    image?: string;
    kind?: MachineKind;
    model?: string;
    state?: MachineState;
    /** vardiya başına operatör */
    crew?: number;
}
/** Planlama dilimi: gün (ya da vardiya); off → kapalı */
export interface CapBucket {
    id: string;
    label: string;
    sub?: string;
    date: string;
    off?: boolean;
}
/**
 * İş emri (operasyon): süre saat, gereken işlem; center + bucket boşsa havuzdadır.
 * part: günlere yayılmış işin parçası (of = asıl iş emri kimliği, n / total = sıra) — capacitySplit üretir, capacityMerge birleştirir.
 */
export interface CapOrder {
    id: string;
    label: string;
    sub?: string;
    hours: number;
    skill: string;
    due?: string;
    priority?: "normal" | "high" | "urgent";
    center?: string | null;
    bucket?: string | null;
    locked?: boolean;
    part?: {
        of: string;
        n: number;
        total: number;
    };
    product?: string;
    qty?: number;
    unit?: string;
    /** rota adımı: "Op 20 · CNC frezeleme" */
    operation?: string;
    /** hours içindeki hazırlık süresi */
    setupHours?: number;
    status?: "planned" | "released" | "running" | "hold" | "done";
    /** 0–1 */
    progress?: number;
    material?: "ok" | "partial" | "missing";
    materialNote?: string;
    /** satış siparişi no */
    order?: string;
    customer?: string;
    note?: string;
    /** operasyon sırası (rota) */
    routing?: {
        op: string;
        center?: string;
        state?: "done" | "current" | "todo";
    }[];
}
export type CapState = "free" | "ok" | "high" | "over" | "off";
export interface CapCell {
    cap: number;
    load: number;
    free: number;
    pct: number;
    state: CapState;
    orders: CapOrder[];
    down: {
        hours: number;
        label?: string;
    }[];
}
export declare const canRun: (o: CapOrder, c: WorkCenter) => boolean;
export declare const capLate: (o: CapOrder, b: CapBucket) => boolean;
/** Parçalı işte görünen ad: "İE-0437 · 1/3" */
export declare const capLabel: (o: CapOrder) => string;
/** Gündeki vardiya sayısı (hours verilmiş ve shifts yoksa saat / vardiya süresinden) */
export declare const shiftsOf: (c: WorkCenter, bi: number) => number;
/** Günlük brüt saat (verimden ve duruştan önce) */
export declare function grossHours(c: WorkCenter, bi: number): number;
/** Verim (0–1): efficiency ya da OEE = kullanılabilirlik × performans × kalite; ikisi de yoksa 1 */
export declare const efficiencyOf: (c: WorkCenter) => number;
/** Hücre kapasitesi: brüt saat × verim − duruş; kapalı gün 0 */
export declare function cellCapacity(c: WorkCenter, b: CapBucket, bi: number): number;
/** Tezgahın dönem özeti: gün gün vardiya / brüt / duruş / net / planlı / boş ve toplamlar */
export declare function centerStats(c: WorkCenter, buckets: CapBucket[], orders: CapOrder[]): {
    days: {
        bucket: CapBucket;
        shifts: number;
        gross: number;
        down: number;
        net: number;
        load: number;
        free: number;
    }[];
    gross: number;
    down: number;
    net: number;
    load: number;
    free: number;
    pct: number;
    efficiency: number;
    shifts: string;
    shiftNote: string;
    shiftHours: number;
    workDays: number;
};
/**
 * Tezgah çizimi (görsel yoksa): türe göre sade çizgi çizim, temanın renkleriyle; ışık durum renginde
 * (çalışıyor yeşil · uyarı amber · arızalı kırmızı · bakımda mavi · boşta gri).
 */
export declare function machineArt(kind?: MachineKind, state?: MachineState, label?: string): string;
export declare const MACHINE_STATE: Record<MachineState, string>;
/**
 * Tezgah kartı (ayrıntı): görsel, ad, model, durum, işlemler; vardiya, brüt / net kapasite, verim ve OEE kırılımı, yük;
 * gün gün tablo. Kapasite tahtasında tezgah adına tıklayınca açılır; tezgah listesi, andon gibi başka ekranlarda da kullanılır.
 */
export declare function machineCardHtml(c: WorkCenter, buckets: CapBucket[], orders?: CapOrder[]): string;
/** Yük tablosu: hücre (kapasite, yük, boş), tezgah ve gün toplamları; aşırı yüklü hücre, gecikecek iş, havuz özeti */
export declare function capacityGrid(orders: CapOrder[], centers: WorkCenter[], buckets: CapBucket[]): {
    cells: Map<string, CapCell>;
    centers: Map<string, {
        cap: number;
        load: number;
        pct: number;
    }>;
    buckets: Map<string, {
        cap: number;
        load: number;
        pct: number;
    }>;
    total: {
        cap: number;
        load: number;
        pct: number;
        over: number;
        late: number;
        pool: number;
        poolHours: number;
    };
};
/**
 * Bırakma denetimi: yapamaz / kapalı / geçmiş gün → engel; aşırı yük ya da termin sonrası → uyarı (bırakılabilir, işaretlenir).
 * free: iş eklenmeden önce hücrede kalan boş saat; fits: iş tamamen sığıyor mu.
 */
export declare function capacityCheck(o: CapOrder, c: WorkCenter, b: CapBucket, bi: number, orders: CapOrder[], today?: string): {
    level: "ok" | "warn" | "bad";
    reasons: string[];
    pctAfter: number;
    free: number;
    fits: boolean;
};
/**
 * Günlere yay: işi tezgahta fromIndex gününden başlayarak her günün boş kapasitesini doldurarak parçalara böler
 * (kapalı / geçmiş gün atlanır). Dönem bitince kalan saat havuzda bir parça olarak kalır. Parça kimlikleri kalıcıdır
 * ("asıl~1", "asıl~2"…), sıra numaraları (n / total) güne göre yeniden verilir. Bölünecek yer yoksa değişiklik olmaz.
 */
export declare function capacitySplit(orders: CapOrder[], id: string, center: WorkCenter, buckets: CapBucket[], fromIndex?: number, o?: {
    today?: string;
    minChunk?: number;
}): {
    orders: CapOrder[];
    parts: string[];
    rest: number;
};
/** Parçaları birleştir: aynı işin bütün parçaları tek iş emri olarak havuza döner (saatler toplanır) */
export declare function capacityMerge(orders: CapOrder[], root: string): CapOrder[];
export declare const CAP_STATUS: Record<NonNullable<CapOrder["status"]>, {
    label: string;
    badge: string;
}>;
/**
 * İş emri ayrıntısı (kapasite tahtasında karta tıklayınca; başka ekranlarda da kullanılır): kimlik ve rozetler (durum, öncelik,
 * termin, malzeme), planlandığı yer ve o günün doluluğu, süre (hazırlık + işleme), miktar, işlem, sipariş / müşteri,
 * işi yapabilen tezgahlar, ilerleme, rota, parçalar, not. Tüm metin kaçırılır.
 */
export declare function capOrderDetailHtml(w: CapOrder, ctx: {
    centers: WorkCenter[];
    buckets: CapBucket[];
    orders: CapOrder[];
    today?: string;
}): string;
/**
 * Otomatik yerleştirme (sonlu kapasite, ileri): önce öncelik, sonra termin, sonra uzun iş. Her iş en erken günde işlemi
 * yapabilen ve **sığan** tezgaha (eşitlikte en boş olana) yerleşir. Hiçbir güne tek parça sığmıyorsa ve split açıksa
 * günlere yayılır (en erken bitireceği tezgahta). Sığmayan havuzda kalır. Planlı ve kilitli işlere dokunulmaz;
 * fromDate'ten önceki günler kullanılmaz. only verilirse yalnız o işler yerleştirilir.
 */
export declare function capacityAutoSchedule(orders: CapOrder[], centers: WorkCenter[], buckets: CapBucket[], o?: {
    fromDate?: string;
    split?: boolean;
    only?: Set<string>;
}): {
    orders: {
        id: string;
        label: string;
        sub?: string;
        hours: number;
        skill: string;
        due?: string;
        priority?: "normal" | "high" | "urgent";
        center?: string | null;
        bucket?: string | null;
        locked?: boolean;
        part?: {
            of: string;
            n: number;
            total: number;
        };
        product?: string;
        qty?: number;
        unit?: string;
        /** rota adımı: "Op 20 · CNC frezeleme" */
        operation?: string;
        /** hours içindeki hazırlık süresi */
        setupHours?: number;
        status?: "planned" | "released" | "running" | "hold" | "done";
        /** 0–1 */
        progress?: number;
        material?: "ok" | "partial" | "missing";
        materialNote?: string;
        /** satış siparişi no */
        order?: string;
        customer?: string;
        note?: string;
        /** operasyon sırası (rota) */
        routing?: {
            op: string;
            center?: string;
            state?: "done" | "current" | "todo";
        }[];
    }[];
    placed: string[];
    late: string[];
    unplaced: string[];
    split: string[];
};
/**
 * Dengele: aşırı yüklü her hücreden taşmayı bitirecek kadar iş çıkarır (kilitliye dokunmaz; önce termini en geç olan,
 * eşitlikte küçük olan) ve bunları otomatik yerleştirmeyle **bütün olarak** başka gün / tezgaha koyar (bölmez). Başka yere
 * sığmayan iş eski yerinde kalır (aşırı yük sürer, söylenir; gerekirse kullanıcı "Günlere yay" der).
 */
export declare function capacityBalance(orders: CapOrder[], centers: WorkCenter[], buckets: CapBucket[], o?: {
    fromDate?: string;
}): {
    orders: CapOrder[];
    moved: string[];
    kept: string[];
};
/**
 * Tezgah bazlı kapasite planlama tahtası. Solda planlanmamış iş emirleri havuzu (ara, işleme göre süz, termin / öncelik /
 * süreye göre sırala); sağda tezgah × gün ızgarası, başlık yapışkan, bugün vurgulu, geçmiş günler kilitli. Hücrede boş saat
 * ("1,2 sa boş" · "+2,8 sa aşırı") ve doluluk çubuğu.
 *
 * Taşıma: iş emri sürüklenince (fare, dokunma) ya da klavyeyle alınınca bütün ızgara **önizleme** moduna geçer: uygun
 * hücreler yeşil (sığar) ya da amber (sığmaz / gecikir), yapamayan tezgah, kapalı ve geçmiş gün soluk-taralı; termin
 * günü başlıkta bayrakla, sonrası amber. Sığmayan yere Shift ile bırakmak işi o tezgahta **günlere yayar**.
 * İş emri ayrıntısı: karta tıkla / Enter / sağ tık → pencere (durum, ilerleme, süre, miktar, malzeme, rota, gün yükü, parçalar)
 * ve hızlı eylemler. Klavye: Boşluk al → oklar → Enter bırak (Shift+Enter yay), Esc vazgeç; Alt+←/→ bir gün kaydır; Sil havuza al; ⌘Z geri al.
 * Sağ tık / basılı tut: en erken uygun güne planla, bir gün ileri / geri, günlere yay, parçaları birleştir, başka tezgaha
 * taşı, havuza al, kilitle, ayrıntı. Araç çubuğu: dönem (önceki / bugün / sonraki), Otomatik yerleştir (uzun işi böler),
 * Dengele (aşırı yükü dağıt), Geri al, Sıkı / Rahat görünüm, Tümünü havuza al. onChange / onBatch false dönerse geri alınır.
 */
export declare function bizmoCapacityBoard(host: HTMLElement, o: {
    centers: WorkCenter[];
    buckets: CapBucket[];
    orders: CapOrder[];
    label?: string;
    /** bugünün tarihi (YYYY-AA-GG): önceki günler geçmiş sayılır, bırakılmaz ve otomatik yerleştirmede kullanılmaz */
    today?: string;
    readOnly?: boolean;
    /** "compact" (varsayılan): hücrede tek satır kart · "comfortable": ürün, işlem, termin de görünür */
    density?: "compact" | "comfortable";
    /** dönem gezinmesi (uygulama yeni günleri / işleri set() ile verir) */
    period?: {
        label: string;
        onPrev?: () => void;
        onNext?: () => void;
        onToday?: () => void;
    };
    onChange?: (order: CapOrder, prev: CapOrder) => boolean | void | Promise<boolean | void>;
    /** otomatik yerleştirme, dengeleme, bölme, birleştirme, geri alma, toplu havuza alma */
    onBatch?: (changed: CapOrder[], removed: string[]) => boolean | void | Promise<boolean | void>;
    onOpen?: (order: CapOrder) => void;
}): {
    get: () => {
        id: string;
        label: string;
        sub?: string;
        hours: number;
        skill: string;
        due?: string;
        priority?: "normal" | "high" | "urgent";
        center?: string | null;
        bucket?: string | null;
        locked?: boolean;
        part?: {
            of: string;
            n: number;
            total: number;
        };
        product?: string;
        qty?: number;
        unit?: string;
        /** rota adımı: "Op 20 · CNC frezeleme" */
        operation?: string;
        /** hours içindeki hazırlık süresi */
        setupHours?: number;
        status?: "planned" | "released" | "running" | "hold" | "done";
        /** 0–1 */
        progress?: number;
        material?: "ok" | "partial" | "missing";
        materialNote?: string;
        /** satış siparişi no */
        order?: string;
        customer?: string;
        note?: string;
        /** operasyon sırası (rota) */
        routing?: {
            op: string;
            center?: string;
            state?: "done" | "current" | "todo";
        }[];
    }[];
    /** dönem değişince yeni günler ve işler; geri alma geçmişi temizlenir */
    set(next: CapOrder[], nextBuckets?: CapBucket[], period?: {
        label: string;
        onPrev?: () => void;
        onNext?: () => void;
        onToday?: () => void;
    }): void;
    autoSchedule: () => void | undefined;
    balance: () => void | undefined;
    undo: () => Promise<void>;
    destroy(): void;
};
export type BomType = "product" | "semi" | "raw" | "pack";
export interface BomItem {
    code: string;
    name: string;
    type: BomType;
    unit: string;
    source?: "make" | "buy";
    stock?: number;
    leadDays?: number;
    children?: {
        code: string;
        qty: number;
        scrap?: number;
    }[];
}
export interface BomRow {
    key: string;
    level: number;
    code: string;
    name: string;
    type: BomType;
    unit: string;
    source: "make" | "buy";
    qtyPer: number;
    qtyTotal: number;
    stock?: number;
    leadDays?: number;
    hasChildren: boolean;
    parent: string | null;
}
export declare const BOM_TYPE: Record<BomType, string>;
/** Çok seviyeli patlatma (derinlik öncelikli). Toplam ihtiyaç = üst toplam × birim miktar × (1 + fire). Döngü hata verir. */
export declare function bomExplode(code: string, list: BomItem[] | Record<string, BomItem>, qty?: number): BomRow[];
/** Nerede kullanılıyor: kalemden yukarı, onu içeren yarı mamul ve mamullere (her satırda üst kalemdeki birim miktar) */
export declare function bomWhereUsed(code: string, list: BomItem[] | Record<string, BomItem>): BomRow[];
/** Aynı kalem birden çok dalda geçebilir: koda göre toplam ihtiyaç, stok ve eksik (yalnız satın alınan / yaprak kalemler) */
export declare function bomRequirements(rows: BomRow[]): {
    code: string;
    name: string;
    unit: string;
    need: number;
    stock: number;
    short: number;
    leadDays?: number;
}[];
/**
 * Ürün ağacı tablosu (role="treegrid"): girinti kılavuzları 90° akson, aç / kapa, satırda ↑↓ gezinme, → aç / alta in, ← kapa / üste çık.
 * mode "where" ise başlıklar "Üst kalem" düzenine geçer.
 */
export declare function bizmoBomTable(host: HTMLElement, rows: BomRow[], o?: {
    mode?: "explode" | "where";
    label?: string;
    collapsedLevel?: number;
}): {
    expandAll(): void;
    collapseTo(level: number): void;
    destroy: () => string;
};
export type TraceKind = "supplier" | "rawLot" | "order" | "lot" | "shipment" | "customer";
export interface TraceNode {
    id: string;
    kind: TraceKind;
    label: string;
    sub?: string;
    qty?: string;
    state?: "ok" | "hold" | "recall";
}
export interface TraceEdge {
    from: string;
    to: string;
    qty?: string;
}
export declare const TRACE_KIND: Record<TraceKind, string>;
/** Odak düğümden geriye (kaynağa) ve ileriye (müşteriye) erişilen düğümler */
export declare function traceGraph(nodes: TraceNode[], edges: TraceEdge[], focus: string): {
    back: Set<string>;
    forward: Set<string>;
    related: Set<string>;
};
/** Geri çağırma kapsamı: lottan ileriye ulaşılan mamul lotları, sevkiyatlar ve müşteriler */
export declare function recallScope(nodes: TraceNode[], edges: TraceEdge[], lotId: string): {
    lots: TraceNode[];
    orders: TraceNode[];
    shipments: TraceNode[];
    customers: TraceNode[];
    affected: Set<string>;
};
/**
 * İzlenebilirlik grafiği: sütunlar Tedarikçi → Hammadde lotu → Üretim emri → Mamul lotu → Sevkiyat → Müşteri.
 * Odak lot vurgulu; geriye (kaynak, mavi) ve ileriye (müşteri, yeşil) yol belirgin, ilgisiz düğümler soluk.
 * recall: true iken odaktan ileriye her şey kırmızı (etkilenen) ve sayılar özetlenir. Bağlar 90° akson (SVG).
 */
export declare function bizmoTrace(host: HTMLElement, o: {
    nodes: TraceNode[];
    edges: TraceEdge[];
    focus: string;
    recall?: boolean;
    label?: string;
    onSelect?: (n: TraceNode) => void;
}): {
    setFocus(id: string): void;
    setRecall(on: boolean): void;
    scope: () => {
        lots: TraceNode[];
        orders: TraceNode[];
        shipments: TraceNode[];
        customers: TraceNode[];
        affected: Set<string>;
    };
    destroy(): void;
};
