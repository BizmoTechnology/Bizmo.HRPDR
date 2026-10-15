# @bizmo/theme — Bizmo Universal Theme (v1.1)

Bizmo.OS tasarım dilinin tüm Bizmo yazılımlarında kullanılan teması: token'lar, `bz-*` bileşen sınıfları,
AG Grid teması (master / detail dahil), shadcn tarzı tarih ve saat seçiciler, mesajlaşma / görevler / Spotlight ekranları,
andon (üretim durum panosu, TV modu, sesli uyarı), depo dijital ikizi (palet ve Euro kasa deposu, gantry loader, A-3-D-2 göz adresi),
saha / el terminali (barkod okutma, GS1 çözümleme, eldiven yoğunluğu), baskı ve etiket (Code 128 / GS1-128 / QR, ZPL, A4 belge), güvenlik ve KVKK desenleri (SSO girişi, maskeli veri, oturum zaman aşımı), çevrimdışı çalışma (şifreli kuyruk, çakışma, tazelik), vurgu düzeni,
ERP ekran kalıpları: kayıt sayfası ve alan düzeyinde değişiklik geçmişi, liste ekranı (süzgeç oluşturucu, kayıtlı görünüm, sütun seçici, bağımlılıksız XLSX / CSV dışa ve içe aktarma sihirbazı), üretim planı Gantt'ı (bağlantı, yol izleme), tezgah bazlı kapasite planlama (sürükle-bırak, otomatik yerleştirme), çok seviyeli ürün ağacı, lot izlenebilirliği ve geri çağırma, SPC kontrol grafikleri, uygunsuzluk (NCR) ve 8D,
iOS tarzı dokunma ve haptik (bağlam menüsü, kaydırma eylemleri, alt sayfa), ayrıntıya inen 3B sahneler,
doğrulanmış grafik paleti, three.js sahne yapı taşları, glyph seti, kutucuk ızgarası ve iOS / Android / Flutter / SCSS token dosyaları.

**Kurallar ve bileşen ayrıntıları: [DESIGN.md](./DESIGN.md)** · Canlı vitrin: `preview.html`

Bağımsız proje: [github.com/BizmoTechnology/Bizmo.UniversalTheme](https://github.com/BizmoTechnology/Bizmo.UniversalTheme) (özel depo). Bizmo.OS, Bizmo.Loop ve diğer Bizmo yazılımları temayı buradan alır; tema hiçbir uygulamanın içinde düzenlenmez.

## Kurulum (bu depoda geliştirme)

```bash
git clone https://github.com/BizmoTechnology/Bizmo.UniversalTheme.git
cd Bizmo.UniversalTheme
pnpm install
pnpm preview
```

## Projelerde kullanım

| Yol | `package.json` | Ne zaman |
|---|---|---|
| Yerel bağlantı | `"@bizmo/theme": "link:../Bizmo.UniversalTheme"` | Aynı makinede tema ile uygulama birlikte geliştirilirken (değişiklik anında yansır) |
| Git bağımlılığı | `"@bizmo/theme": "github:BizmoTechnology/Bizmo.UniversalTheme#<sürüm etiketi ya da commit>"` | CI ve dağıtım: sabit sürüm; depoya okuma yetkisi gerekir |
| Kopya (vendor) | `packages/theme` içine `rsync -a --delete --exclude node_modules --exclude .git ../Bizmo.UniversalTheme/ packages/theme/` | Uygulama deposu tek başına derlenmeli ise (Bizmo.Loop); sapmayı `theme-drift` betiği denetler, kopya elle düzenlenmez |

`dist/` depoda derlenmiş hâliyle bulunur; kullanan projenin TypeScript derleyicisine gerek yoktur.

```css
@import "@bizmo/theme/tokens.css";      /* her zaman ilk */
@import "@bizmo/theme/components.css";  /* bz-* sınıfları (veya tailwind.css / shadcn.css) */
```

```ts
import { bizmoGridTheme, bizmoGridDefaults, bizmoGridLocaleTr, bizmoMasterDetail } from "@bizmo/theme/ag-grid";
import { bizmoInitPickers } from "@bizmo/theme/pickers";
import { bizmoAlertSound, bizmoSpeech, bizmoDesktopNotify } from "@bizmo/theme/alerts";
import { bizmoLocationScheme } from "@bizmo/theme/location";
import { bizmoScanInput, bizmoParseScan } from "@bizmo/theme/scan";
import { bizmoCode128Svg, bizmoQrSvg, gs1Data, bizmoZpl, bizmoPrint } from "@bizmo/theme/labels";
import { bizmoWorkOrderDoc, bizmoStockCardDoc, bizmoPickListDoc } from "@bizmo/theme/docs";
import { bizmoMaskedField, bizmoSessionTimeout, bizmoOtpInput, isValidTckn } from "@bizmo/theme/privacy";
import { bizmoConnection, bizmoQueue, bizmoFreshness } from "@bizmo/theme/offline";
import { diffRecord, bizmoHistoryHtml, bizmoActivityHtml, filterChangeSets, bizmoCopy } from "@bizmo/theme/records";
import { bizmoFilterBar, bizmoFilterBuilder, filterSummary, bizmoColumnChooser, toXlsx, toCsv, readXlsx, parseCsv, autoMap, validateImport } from "@bizmo/theme/lists";
import { bizmoGantt, ganttPath, ganttCascade, bizmoCapacityBoard, capacityAutoSchedule, machineCardHtml, capOrderDetailHtml, bomExplode, bizmoBomTable, bizmoTrace, recallScope } from "@bizmo/theme/planning";
import { spcXbarR, bizmoSpcChart, capability, checkResult, bizmoTolerance, ncrFromCheck, bizmo8dHtml } from "@bizmo/theme/quality";
import { bizmoHaptic, bizmoFlash, bizmoContextMenuDelegate, bizmoSwipeActions, bizmoSheet, bizmoUndoToast } from "@bizmo/theme/gestures";
import { SERIES, echartsTheme, sparkline } from "@bizmo/theme/charts";
import { bizmoScene, bizmoFloor, bizmoAxonTube, axonPath, bizmoOrbit } from "@bizmo/theme/three";
import { glyphSvg, APP_HUES } from "@bizmo/theme/icons";
import { bindTileGrid } from "@bizmo/theme/layout";
import { bizmoTokens, bzVar } from "@bizmo/theme/tokens";
```

| Komut | Ne yapar |
|---|---|
| `pnpm preview` | Derler ve vitrini `http://127.0.0.1:4390/preview.html` adresinde açar (yalnız yerel, statik) |
| `pnpm build` | `tokens.json` → `tokens.css`, `tokens.ts`, `platforms/*`, `dist/*.js` + `.d.ts` |
| `pnpm check` | Kalite kontrolü: güncellik, WCAG karşıtlığı, renk körlüğü paleti, doküman ↔ kod tutarlılığı |
| `pnpm typecheck` | TypeScript yardımcılarını denetler |
| `pnpm test:unit` | Birim testleri: kayıt farkı, süzgeç, CSV / XLSX, içe aktarma, Gantt / ürün ağacı / izleme, SPC ve NCR (Node yerleşik test, `dist/` üzerinde) |
| `pnpm test:visual` | Görsel regresyon + erişilebilirlik: vitrin bölümleri açık / koyu × masaüstü / telefon, taşma, konsol hatası, adsız öğe (yerel Chrome, bağımlılıksız) |
| `pnpm test:visual:update` | Bilinçli görsel değişiklikten sonra tabanları yeniler |

Değer değiştirirken yalnız `tokens.json`'u düzenleyin; `tokens.css`, `tokens.ts`, `platforms/` ve `dist/` üretilen dosyalardır.
