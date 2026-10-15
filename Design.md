# PotansiyelHaritası — Tasarım (Bizmo Universal Theme)

Uygulamanın görsel dili **Bizmo Universal Theme**'dir (`@bizmo/theme`). Kurallar, token'lar ve bileşenlerin tek doğruluk kaynağı
temanın kendi dokümanıdır: **[packages/theme/DESIGN.md](./packages/theme/DESIGN.md)**. Bu dosya yalnız temanın bu projede
nasıl bağlandığını ve proje içi kuralları anlatır.

---

## 1. Tema paketi

| | |
|---|---|
| Kaynak | [BizmoTechnology/Bizmo.UniversalTheme](https://github.com/BizmoTechnology/Bizmo.UniversalTheme) (özel depo) |
| Bu depodaki kopya | `packages/theme/` — **elle düzenlenmez**; sürüm ve kaynak commit `packages/theme.version` içinde |
| Bağlantı | `apps/web`, `apps/portal`, `packages/ui` → `"@bizmo/theme": "file:../../packages/theme"` |
| Güncelleme | Tema deposu `../Bizmo.UniversalTheme` konumundayken `npm run theme:sync` (veya `node scripts/theme-sync.mjs <yol>`), ardından `npm install` |

Tema değişikliği her zaman tema deposunda yapılır; bu depoda yalnız kopya yenilenir. Görsel regresyon tabanları (`tests/`) kopyalanmaz.

## 2. Stil yükleme sırası

`apps/*/src/app/globals.css`:

```css
@import "./layers.css";                 /* @layer tw-base, bizmo;  — katman sırası ilk tanımda belirlenir */
@import "@bizmo/theme/tokens.css";      /* --bz-* değişkenleri, açık / koyu / yüksek karşıtlık modları */
@import "@bizmo/theme/components.css";  /* bz-* sınıfları, @layer bizmo içinde */

@layer tw-base { @tailwind base; }      /* Tailwind v3 preflight bz-* sınıflarının ALTINDA kalır */
@tailwind components;
@tailwind utilities;                    /* utility'ler her zaman bz-* sınıflarının ÜSTÜNDE */
```

Sonuç: `bz-*` sınıfları preflight tarafından ezilmez; aynı öğeye verilen Tailwind utility'si bz sınıfını geçersiz kılar.
Bir öğeye `bz-btn` gibi bir sınıf verildiğinde çakışan utility'ler (padding, yükseklik, köşe, zemin, yazı rengi) kaldırılır.

## 3. Tailwind adları → Bizmo token'ları

Ortak preset: `packages/ui/tailwind.preset.cjs` (her iki uygulamanın `tailwind.config.ts` dosyası yalnız bunu kullanır).
Tüm renkler `/opaklık` eklerini destekler (`bg-primary/10`).

| Sınıf | Token | Not |
|---|---|---|
| `bg-background` / `bg-page` | `--bz-bg` (bulut) | Sayfa zemini; saf beyaz değil |
| `bg-card` / `bg-surface` (`-2`, `-3`) | `--bz-surface` | Kart, tablo, form |
| `text-foreground` · `text-fg2` · `text-muted-foreground` (`text-fg3`) | `--bz-text` · `-text-2` · `-text-3` | Lacivert metin kademeleri |
| `bg-primary` + `text-primary-foreground` | `--bz-accent` + `--bz-accent-contrast` | Yeşil zemin üstünde **lacivert** yazı |
| `text-brand-ink` · `bg-brand-soft` · `bg-brand-strong` | `--bz-accent-ink` · `-soft` · `-strong` | Yeşil **metin** her zaman `-ink` |
| `hover:bg-accent` | `--bz-hover` | shadcn anlamı: üzerine gelme zemini |
| `bg-muted` · `bg-secondary` · `bg-field` | `--bz-field` | Alan zemini |
| `border-border` · `border-input` · `border-divider` · `border-glass-border` | `--bz-border` · `-field-border` · `-divider` · `-glass-border` | |
| `ring-ring` | `--bz-focus` | Odak halkası |
| `bg-destructive` + `text-destructive-foreground` | `--bz-danger-solid` + beyaz | Yalnız kalıcı silme |
| `success` · `warning` · `danger` · `info` · `data` (+ `-ink`, `-soft`) | durum ve veri renkleri | Metinde `-ink`, işarette ana ton |
| `series-1 … series-6` | grafik kategori paleti | Yeşil / kırmızı kategori yok |
| `rounded-sm` 6 · `md` 8 · `lg` 10 · `xl` 12 · `2xl` 16 · `3xl` 26 | `--bz-radius-*` | Düğme 10, alan 12, kart 16, pencere 26 |
| `shadow-1/2/3` · `shadow-green` | `--bz-shadow-*` | Yeşil gölge yalnız birincil düğmede |
| `font-sans` · `font-display` · `font-mono` | Inter · Manrope · JetBrains Mono | Manrope yalnız başlık ve büyük sayı |

Koyu tema: `<html data-theme="dark">` (Tailwind `dark:` varyantı da buna bağlıdır; `.dark` sınıfı eşitlenir).
Tercih `localStorage["bz-theme"]` (`light` · `dark` · `system`) içinde tutulur ve ilk boyamadan önce `themeInitScript`
(`@ph/ui`) ile uygulanır; bileşenlerde `useTheme()` kullanılır.

Yazı aileleri `next/font` ile derlemede indirilir ve uygulamanın kendi sunucusundan servis edilir (`--font-inter`, `--font-manrope`
değişkenleri `--bz-font-sans` / `--bz-font-display` içine bağlanır).

## 4. Kabuk ve ortak bileşenler

| Parça | Dosya | Bizmo karşılığı |
|---|---|---|
| Yönetim paneli kabuğu | `apps/web/src/components/layout/AppShell.tsx` | B kabuğu, içe gömülü (`bz-shell--inset`, DESIGN.md §8.1) |
| Kenar çubuğu | `…/layout/Sidebar.tsx` | `bz-sidebar` (264 / ray 72 / 900px altında çekmece), `Ctrl+\` |
| Üst bar | `…/layout/Topbar.tsx` | `bz-topbar`: iz, komut paleti hapı, tema, bildirim, avatar |
| Komut paleti | `…/layout/CommandPalette.tsx` | `bz-command`, `Ctrl+K` |
| Gezinme listesi | `…/layout/nav.ts` | Kenar çubuğu, iz ve palet aynı listeyi kullanır |
| Uygulama simgesi | `…/layout/AppMark.tsx` | `bz-app-icon`, `team` glifi ve tonu |
| AI asistan | `apps/web/src/components/ai-chat/*` | Çekmece (`bz-drawer` ölçüleri) + yüzen eylem düğmesi |
| Kart · KPI · skor | `packages/ui/src/components/*` | `bz-card` · `bz-stat` · durum tonlu yay |
| Düğme · rozet · tablo · sayfalama · tarih | `apps/web/src/components/ui/*` | `bz-btn` ölçüleri · `bz-chip` · `bz-table` · `bz-icon-btn` · `.bz-picker` |
| Boyut renkleri | `apps/web/src/lib/dimension-colors.ts` | Değerlendirme boyutu → sabit seri rengi |
| Grafik teması | `apps/web/src/lib/chart-theme.ts` | ApexCharts için `@bizmo/theme/charts` paleti |

## 5. Proje içi kurallar (özet)

- Ekranda **tek** yeşil birincil eylem (`bz-btn bz-btn--primary`); diğerleri ikincil (`bz-btn`), yumuşak, sakin veya hayalet.
- Yeşil zemin üstünde beyaz yazı yok; renkli metin her zaman `-ink` token'ıyla.
- Ham hex ve Tailwind'in hazır paleti (`purple-500`, `emerald-500` …) kullanılmaz; durum için `success/warning/danger/info`,
  veri için `data`, kategori için `series-*` / `dimensionColor()`.
- Durum her zaman metinle birlikte çip olarak gösterilir (`bz-chip`, `bz-status[data-status]`); renk tek başına anlam taşımaz.
- İçerik kartları opaktır; cam yalnız kabuk, menü, pencere ve çekmecede.
- Tarih ve saat için tarayıcının yerel alanları yerine `DateTimePicker` kullanılır.
- Başlık ve düğme metinleri cümle düzeninde ve Türkçe; sayılar `tabular-nums`.
- Yeni ekran eklerken DESIGN.md §45 kontrol listesini uygulayın.
