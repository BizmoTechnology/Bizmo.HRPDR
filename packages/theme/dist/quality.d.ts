/** X̄-R sabitleri (n = alt grup büyüklüğü 2–10) */
export declare const SPC_CONST: Record<number, {
    A2: number;
    D3: number;
    D4: number;
    d2: number;
}>;
export interface SpcViolation {
    index: number;
    rule: number;
    text: string;
    points: number[];
}
export declare const NELSON_TEXT: Record<number, string>;
/**
 * Nelson kuralları (1–8). σ çizilen istatistiğin standart sapmasıdır (X̄ için (ÜKS − MÇ) / 3).
 * İhlal, deseni tamamlayan noktaya yazılır; points desenin tüm noktalarıdır. Varsayılan kurallar 1, 2, 3, 5, 6.
 */
export declare function nelsonRules(v: number[], cl: number, sigma: number, rules?: number[]): SpcViolation[];
export interface SpcSpec {
    lsl?: number;
    usl?: number;
    target?: number;
}
export interface SpcResult {
    n: number;
    xbar: number[];
    r: number[];
    cl: number;
    ucl: number;
    lcl: number;
    rbar: number;
    uclR: number;
    lclR: number;
    /** süreç içi σ (R̄ / d2) */
    sigma: number;
    /** tüm ölçümlerin örneklem σ'sı */
    sigmaTotal: number;
    cp: number | null;
    cpk: number | null;
    pp: number | null;
    ppk: number | null;
    violations: SpcViolation[];
    violationsR: SpcViolation[];
    spec: SpcSpec;
}
/**
 * X̄-R kontrol grafiği hesabı. limits verilirse (I. evrede belirlenmiş sınırlar) yeniden hesaplanmaz — II. evre izleme.
 * Alt grup büyüklüğü 2–10, tüm alt gruplar eşit büyüklükte olmalı.
 */
export declare function spcXbarR(subgroups: number[][], spec?: SpcSpec, o?: {
    limits?: {
        cl: number;
        rbar: number;
    };
    rules?: number[];
}): SpcResult;
/** Yeterlilik yorumu: Cpk ≥ 1,33 yeterli · 1,00–1,33 sınırda · < 1,00 yetersiz (otomotivde kritik karakteristik için ≥ 1,67 istenebilir) */
export declare function capability(cpk: number | null, required?: number): {
    state: "ok" | "warn" | "bad" | "na";
    text: string;
};
/** Tablo görünümü (grafiğin erişilebilir eşi): alt grup, ölçümler, X̄, R, ihlaller */
export declare function spcTableHtml(res: SpcResult, subgroups: number[][], labels?: string[], digits?: number): string;
/**
 * X̄ ve R kontrol grafikleri (SVG, iki ayrı grafik — tek eksen kuralı). MÇ düz, ÜKS / AKS kesikli, ÜTS / ATS noktalı ve
 * doğrudan etiketli; ölçüm çizgisi 2px, nokta 8px; ihlal elmas + kural numarası. Üzerine gelince dikey çizgi ve ayrıntı.
 */
export declare function bizmoSpcChart(host: HTMLElement, o: {
    result: SpcResult;
    subgroups: number[][];
    labels?: string[];
    unit?: string;
    digits?: number;
    title?: string;
}): {
    destroy(): void;
};
export interface QualityCheck {
    id: string;
    item: string;
    nominal?: number;
    lsl?: number;
    usl?: number;
    unit?: string;
    /** sayısal değil: "Çapak yok", "Renk RAL 7035" */
    criterion?: string;
    method?: string;
    freq?: string;
    /** kritik / özel karakteristik (◆) */
    critical?: boolean;
    digits?: number;
    /** açık uygunsuzluk numarası */
    ncr?: string;
}
/** "Ø120 ±0,05 mm" · "119,95 – 120,05 mm" · "≤ 0,8 µm" · ölçüsüz kriter */
export declare function toleranceText(c: QualityCheck): string;
/** Ölçüm sonucu: uygun mu, toleransa göre konum (0 = ATS, 1 = ÜTS), sınıra yakınlık (%10 içinde); label kısa (rozet), text tam (sapmayla) */
export declare function checkResult(c: QualityCheck, value: number | boolean | null | undefined): {
    state: "empty";
    ok: null;
    pos: null;
    label: string;
    text: string;
    deviation?: undefined;
} | {
    state: "bad" | "ok";
    ok: boolean;
    pos: null;
    label: string;
    text: string;
    deviation?: undefined;
} | {
    state: "bad" | "near" | "ok";
    ok: boolean;
    pos: number | null;
    deviation: number;
    label: string;
    text: string;
};
/** Ölçü göstergesi: tolerans bandı (ATS–ÜTS), nominal çizgisi, ölçülen değer işareti; dışarıdaysa uçta ok + kırmızı */
export declare function bizmoTolerance(c: QualityCheck, value: number | null | undefined): string;
/**
 * İş emri belgesinin kalite bölümü için (docs.ts WorkOrder.quality): tolerans metni, kritik karakteristik ◆ ve
 * açık uygunsuzluk numarası kalemin yanına yazılır.
 */
export declare function toDocQuality(checks: QualityCheck[]): {
    item: string;
    spec: string;
    method: string | undefined;
    freq: string | undefined;
    ncr: string | undefined;
}[];
export type NcrSeverity = "minor" | "major" | "critical";
export type Disposition = "sort" | "rework" | "scrap" | "use-as-is" | "return";
export declare const NCR_SEVERITY: Record<NcrSeverity, string>;
export declare const DISPOSITION: Record<Disposition, {
    label: string;
    hint: string;
}>;
export type EightDKey = "D0" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";
export declare const EIGHT_D: {
    d: EightDKey;
    title: string;
    hint: string;
}[];
export interface EightDStep {
    d: EightDKey;
    state: "todo" | "current" | "done" | "late";
    owner?: string;
    due?: string;
    done?: string;
    summary?: string;
}
export interface Ncr {
    no: string;
    title: string;
    source: "internal" | "supplier" | "customer";
    severity: NcrSeverity;
    status: "open" | "containment" | "analysis" | "action" | "verify" | "closed";
    check?: string;
    measured?: string;
    spec?: string;
    wo?: string;
    lot?: string;
    product?: string;
    qty: number;
    unit: string;
    disposition?: Disposition;
    steps: EightDStep[];
}
/**
 * Başarısız kontrol noktasından uygunsuzluk taslağı: başlık, ölçülen / tolerans, iş emri ve lot bağı, şiddet önerisi
 * (kritik karakteristik → kritik; sapma tolerans genişliğinin yarısından büyük → majör; değilse minör). 8D, D0'da başlar.
 */
export declare function ncrFromCheck(c: QualityCheck, value: number | boolean, ctx: {
    no: string;
    wo?: string;
    lot?: string;
    product?: string;
    qty: number;
    unit: string;
    owner?: string;
    due?: string;
}): Ncr;
export declare function eightDProgress(steps: EightDStep[]): {
    done: number;
    total: number;
    current: EightDKey | null;
    late: EightDKey[];
    pct: number;
};
/** 8D adımları (dikey akson): D numarası halkada, başlık, sorumlu (rol) · termin, özet; geciken adım kırmızı + "gecikti" */
export declare function bizmo8dHtml(steps: EightDStep[], o?: {
    open?: EightDKey;
}): string;
/** Ekran okuyucuya kalite olayı duyurusu (ör. "Ø120 çap: uygun değil") */
export declare const announceCheck: (c: QualityCheck, value: number | boolean) => void;
