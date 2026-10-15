/**
 * Bizmo Universal Theme · grafik paleti ve kütüphane temaları
 *
 * Kategori paleti her `pnpm check` çalıştırmasında doğrulanır (scripts/check.mjs · OKLab ΔE ×100, Machado 2009 renk körlüğü):
 *   - yan yana seriler (çubuk, yığın, çizgi): renk körlüğü ΔE ≥ 9.7 açık / 9.1 koyu, normal görüş ΔE ≥ 19.7 / 18.8 (eşik 8 / 15)
 *   - dağılım / balon / harita (tüm ikililer): en çok 3 seri → SCATTER_SAFE (mavi, kehribar, macenta): ΔE ≥ 11.3 / 9.1
 *   - açık temada kehribar 3:1'in altında: o seriyi doğrudan etiketleyin veya tablo görünümü sunun
 * Yeşil ve kırmızı kategori paletinde YOKTUR: yeşil marka sinyali ve "olumlu" durumu, kırmızı "tehlike" durumudur.
 * Seri rengi varlığa bağlıdır, sıraya değil: filtre seri sayısını değiştirince kalan seriler yeniden boyanmaz.
 */
export type Mode = "light" | "dark";
export declare const SERIES: Record<Mode, readonly string[]>;
export declare const SERIES_NAMES: readonly ["mavi", "turuncu", "camgöbeği", "kehribar", "macenta", "mor"];
/** Dağılım/balon/harita gibi tüm renklerin birbirinden ayrılması gereken grafikler için (en çok 3 seri) */
export declare const SCATTER_SAFE: Record<Mode, readonly string[]>;
/** Sıralı (büyüklük) — tek ton mavi, açıktan koyuya. Sürekli ölçekte 100–700; sıralı adımlarda açıkta 300'den başlayın */
export declare const SEQUENTIAL: readonly ["#dff1fa", "#b4dff2", "#6fc0e8", "#2fa6db", "#0a8fc4", "#06709a", "#044f6d"];
export declare const ORDINAL: Record<Mode, readonly string[]>;
/** Iraksak (kutupluluk) — turuncu ↔ gri ↔ mavi; orta nokta nötr gri, asla renkli değil */
export declare const DIVERGING: Record<Mode, {
    negative: readonly string[];
    mid: string;
    positive: readonly string[];
}>;
/** Durum renkleri — kategori serisi olarak KULLANILMAZ; her zaman simge + etiketle birlikte */
export declare const STATUS: Record<Mode, {
    good: string;
    warning: string;
    critical: string;
    info: string;
}>;
export declare const CHROME: Record<Mode, {
    surface: string;
    text: string;
    text2: string;
    muted: string;
    grid: string;
    axis: string;
    font: string;
}>;
/** Sayfanın o anki modu (data-theme / .dark / işletim sistemi) */
export declare function currentMode(): Mode;
/** Bir varlığa sabit renk: aynı kimlik her grafikte aynı rengi alır (sıraya göre değil) */
export declare function colorFor(key: string, keys: readonly string[], mode?: Mode): string;
/** Apache ECharts teması: echarts.registerTheme("bizmo-light", echartsTheme("light")) */
export declare function echartsTheme(mode: Mode): {
    color: string[];
    backgroundColor: string;
    textStyle: {
        fontFamily: string;
        color: string;
    };
    title: {
        textStyle: {
            fontFamily: string;
            fontWeight: number;
            color: string;
            fontSize: number;
        };
    };
    legend: {
        textStyle: {
            color: string;
            fontSize: number;
        };
        icon: string;
        itemWidth: number;
        itemHeight: number;
    };
    tooltip: {
        backgroundColor: string;
        borderColor: string;
        textStyle: {
            color: string;
            fontSize: number;
        };
        extraCssText: string;
    };
    categoryAxis: {
        axisLine: {
            lineStyle: {
                color: string;
            };
        };
        axisTick: {
            show: boolean;
        };
        axisLabel: {
            color: string;
            fontSize: number;
        };
        splitLine: {
            lineStyle: {
                color: string;
            };
        };
    };
    valueAxis: {
        axisLine: {
            lineStyle: {
                color: string;
            };
        };
        axisTick: {
            show: boolean;
        };
        axisLabel: {
            color: string;
            fontSize: number;
        };
        splitLine: {
            lineStyle: {
                color: string;
            };
        };
    };
    timeAxis: {
        axisLine: {
            lineStyle: {
                color: string;
            };
        };
        axisTick: {
            show: boolean;
        };
        axisLabel: {
            color: string;
            fontSize: number;
        };
        splitLine: {
            lineStyle: {
                color: string;
            };
        };
    };
    line: {
        symbol: string;
        symbolSize: number;
        lineStyle: {
            width: number;
        };
        smooth: boolean;
    };
    bar: {
        itemStyle: {
            borderRadius: number[];
        };
        barMaxWidth: number;
    };
    pie: {
        itemStyle: {
            borderColor: string;
            borderWidth: number;
        };
    };
};
/** Chart.js varsayılanları: applyChartJsDefaults(Chart, "light") */
export declare function applyChartJsDefaults(Chart: any, mode?: Mode): readonly string[];
/** Recharts için ortak props */
export declare function rechartsProps(mode?: Mode): {
    colors: string[];
    grid: {
        stroke: string;
        vertical: boolean;
    };
    axis: {
        stroke: string;
        tick: {
            fill: string;
            fontSize: number;
        };
        tickLine: boolean;
    };
    tooltip: {
        contentStyle: {
            background: string;
            border: string;
            borderRadius: number;
            boxShadow: string;
            fontSize: number;
        };
        cursor: {
            fill: string;
        };
    };
    bar: {
        radius: [number, number, number, number];
        maxBarSize: number;
    };
    line: {
        strokeWidth: number;
        dot: boolean;
        activeDot: {
            r: number;
        };
    };
};
/**
 * Sparkline (küçük eğilim çizgisi): KPI ve kutucuklarda. Eksen, ızgara, etiket yoktur; son nokta vurgulanır.
 * SVG kapsayıcı genişliğine esner; çizgi ve nokta kalınlığı ölçeklenmez (vector-effect).
 *   el.innerHTML = sparkline([12, 14, 11, 18, 21], { tone: "data", label: "Son 7 gün ciro" });
 * Görünüm components.css'teki .bz-spark sınıflarından gelir (açık/koyu kendiliğinden).
 */
export declare function sparkPoints(values: readonly number[], width?: number, height?: number, pad?: number): {
    line: string;
    area: string;
    last: [number, number];
};
export declare function sparkline(values: readonly number[], opts?: {
    width?: number;
    height?: number;
    tone?: "data" | "accent" | "danger";
    area?: boolean;
    label?: string;
}): string;
