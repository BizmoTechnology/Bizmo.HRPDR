/**
 * Bizmo Universal Theme · tarih ve saat seçiciler (shadcn/ui tarzı, çerçeveden bağımsız)
 *
 * Tarayıcının yerel date/time alanı yerine: dış hatlı tetik düğmesi + açılır pencerede Bizmo takvimi / saat sütunları.
 * Görünüm components.css'teki .bz-picker, .bz-picker-pop, .bz-calendar, .bz-time sınıflarından gelir.
 *
 * Bildirimsel (Blazor, Razor, düz HTML):
 *   <button type="button" class="bz-picker" data-bz-datepicker data-name="start" data-placeholder="Tarih seçin"></button>
 *   <button type="button" class="bz-picker" data-bz-datepicker data-mode="range" data-name="period"></button>
 *   <button type="button" class="bz-picker" data-bz-timepicker data-name="time" data-step="15" data-value="09:00"></button>
 *   bizmoInitPickers(document)
 *
 * Programatik:
 *   const p = bizmoDatePicker(button, { onChange: (d) => … }); p.setValue(new Date());
 * Değer forma ISO biçiminde gizli alanla gider (YYYY-MM-DD, aralıkta "YYYY-MM-DD/YYYY-MM-DD", saatte HH:MM).
 */
type DateValue = Date | null;
type RangeValue = {
    start: Date | null;
    end: Date | null;
};
export type DatePickerOptions = {
    mode?: "single" | "range";
    value?: DateValue | RangeValue;
    min?: Date;
    max?: Date;
    locale?: string;
    placeholder?: string;
    /** Form için gizli alan adı */
    name?: string;
    /** Aralıkta yan yana iki ay (varsayılan: genişse evet) */
    months?: 1 | 2;
    onChange?: (value: DateValue | RangeValue) => void;
};
export type TimePickerOptions = {
    value?: string | null;
    step?: number;
    min?: string;
    max?: string;
    locale?: string;
    placeholder?: string;
    name?: string;
    onChange?: (value: string | null) => void;
};
/** Tarih seçici (tek tarih veya aralık) */
export declare function bizmoDatePicker(trigger: HTMLButtonElement, opts?: DatePickerOptions): {
    open: () => void;
    close: () => void;
    getValue: () => {
        start: Date | null;
        end: Date | null;
    } | DateValue;
    setValue(v: DateValue | RangeValue): void;
};
/** Saat seçici: saat ve dakika sütunları (adım 5/10/15/30), "Şimdi" kısayolu */
export declare function bizmoTimePicker(trigger: HTMLButtonElement, opts?: TimePickerOptions): {
    open: () => void;
    close: () => void;
    getValue: () => string | null;
    setValue(v: string | null): void;
};
/** data-bz-datepicker / data-bz-timepicker özniteliklerini taşıyan düğmeleri bir kez başlatır */
export declare function bizmoInitPickers(root?: ParentNode): void;
export {};
