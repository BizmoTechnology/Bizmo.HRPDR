// Bizmo Universal Theme v1.1.0 · tokens.json'dan üretildi (node scripts/build.mjs). Elle düzenlemeyin.
// Kullanım: val c = bizmoColors(); Text("Merhaba", color = c.text)
// Fontlar: Inter (gövde), Manrope (başlık) res/font altına eklenmelidir.
package com.bizmo.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Immutable
data class BizmoColors(
    val bg: Color,
    val bgSunken: Color,
    val surface: Color,
    val surface2: Color,
    val surface3: Color,
    val well: Color,
    val surfaceRaised: Color,
    val andonRun: Color,
    val andonRunInk: Color,
    val andonWarn: Color,
    val andonWarnInk: Color,
    val andonStop: Color,
    val andonStopInk: Color,
    val andonMaint: Color,
    val andonMaintInk: Color,
    val andonIdle: Color,
    val andonIdleInk: Color,
    val text: Color,
    val text2: Color,
    val text3: Color,
    val textInverse: Color,
    val divider: Color,
    val border: Color,
    val borderStrong: Color,
    val controlBorder: Color,
    val hover: Color,
    val press: Color,
    val field: Color,
    val fieldBorder: Color,
    val accent: Color,
    val accentStrong: Color,
    val accentContrast: Color,
    val accentInk: Color,
    val accentSoft: Color,
    val accentRing: Color,
    val focus: Color,
    val data: Color,
    val dataInk: Color,
    val dataSoft: Color,
    val dataSolid: Color,
    val dataSolidHover: Color,
    val dataContrast: Color,
    val success: Color,
    val successInk: Color,
    val successSoft: Color,
    val successTone: Color,
    val warning: Color,
    val warningInk: Color,
    val warningSoft: Color,
    val warningTone: Color,
    val danger: Color,
    val dangerInk: Color,
    val dangerSolid: Color,
    val dangerSoft: Color,
    val dangerTone: Color,
    val info: Color,
    val infoInk: Color,
    val infoSoft: Color,
    val infoTone: Color,
    val glassBg: Color,
    val glassStrong: Color,
    val glassBorder: Color,
    val scrim: Color,
    val sidebarBg: Color,
    val topbarBg: Color,
    val navActiveBg: Color,
    val gridHeaderBg: Color,
    val gridRowHover: Color,
    val gridRowSelected: Color,
    val gridRowZebra: Color,
    val chartSurface: Color,
    val chartGrid: Color,
    val chartAxis: Color,
    val chartMid: Color,
    val series1: Color,
    val series2: Color,
    val series3: Color,
    val series4: Color,
    val series5: Color,
    val series6: Color,
    val sceneBg: Color,
    val sceneFog: Color,
    val sceneNode: Color,
    val sceneNodeEdge: Color,
    val sceneAxon: Color,
    val sceneSignal: Color,
    val sceneGround: Color,
)

val BizmoLightColors = BizmoColors(
    bg = Color(0xFFF3F6FA),
    bgSunken = Color(0xFFE9EEF4),
    surface = Color(0xFFFFFFFF),
    surface2 = Color(0xFFF8FAFD),
    surface3 = Color(0xFFEFF3F8),
    well = Color(0xFFE9EEF4),
    surfaceRaised = Color(0xFFFFFFFF),
    andonRun = Color(0xFF6DB92C),
    andonRunInk = Color(0xFF18232F),
    andonWarn = Color(0xFFF5A623),
    andonWarnInk = Color(0xFF18232F),
    andonStop = Color(0xFFC23A33),
    andonStopInk = Color(0xFFFFFFFF),
    andonMaint = Color(0xFF00739E),
    andonMaintInk = Color(0xFFFFFFFF),
    andonIdle = Color(0xFFDFE5EC),
    andonIdleInk = Color(0xFF4F5B67),
    text = Color(0xFF18232F),
    text2 = Color(0xFF4F5B67),
    text3 = Color(0xFF5F6A75),
    textInverse = Color(0xFFFFFFFF),
    divider = Color(0x1718232F),
    border = Color(0x1F18232F),
    borderStrong = Color(0x3318232F),
    controlBorder = Color(0xFF76818C),
    hover = Color(0x0B18232F),
    press = Color(0x1418232F),
    field = Color(0x0B18232F),
    fieldBorder = Color(0x1A18232F),
    accent = Color(0xFF6DB92C),
    accentStrong = Color(0xFF62A827),
    accentContrast = Color(0xFF18232F),
    accentInk = Color(0xFF3F7A14),
    accentSoft = Color(0x216DB92C),
    accentRing = Color(0x596DB92C),
    focus = Color(0xFF4E8C1E),
    data = Color(0xFF0094C9),
    dataInk = Color(0xFF00739E),
    dataSoft = Color(0x1F00A7E1),
    dataSolid = Color(0xFF00739E),
    dataSolidHover = Color(0xFF005F83),
    dataContrast = Color(0xFFFFFFFF),
    success = Color(0xFF3F8F1A),
    successInk = Color(0xFF2F7A12),
    successSoft = Color(0x246DB92C),
    successTone = Color(0xFF6DB92C),
    warning = Color(0xFFB86E00),
    warningInk = Color(0xFF935700),
    warningSoft = Color(0x29F5A623),
    warningTone = Color(0xFFF5A623),
    danger = Color(0xFFD6453D),
    dangerInk = Color(0xFFB8322B),
    dangerSolid = Color(0xFFC23A33),
    dangerSoft = Color(0x1CE5484D),
    dangerTone = Color(0xFFE5484D),
    info = Color(0xFF0094C9),
    infoInk = Color(0xFF00739E),
    infoSoft = Color(0x1F00A7E1),
    infoTone = Color(0xFF00A7E1),
    glassBg = Color(0xC2FFFFFF),
    glassStrong = Color(0xEBFFFFFF),
    glassBorder = Color(0x1418232F),
    scrim = Color(0x4718232F),
    sidebarBg = Color(0xE0F8FAFD),
    topbarBg = Color(0xCCFFFFFF),
    navActiveBg = Color(0xFFFFFFFF),
    gridHeaderBg = Color(0xFFF7F9FC),
    gridRowHover = Color(0x0918232F),
    gridRowSelected = Color(0x1A6DB92C),
    gridRowZebra = Color(0x0518232F),
    chartSurface = Color(0xFFFFFFFF),
    chartGrid = Color(0x1418232F),
    chartAxis = Color(0x3818232F),
    chartMid = Color(0xFFE4E9EF),
    series1 = Color(0xFF0A8FC4),
    series2 = Color(0xFFE8743B),
    series3 = Color(0xFF16A087),
    series4 = Color(0xFFD99A00),
    series5 = Color(0xFFD1508A),
    series6 = Color(0xFF7A6BE0),
    sceneBg = Color(0xFFEDF2F7),
    sceneFog = Color(0xFFF3F6FA),
    sceneNode = Color(0xFFFFFFFF),
    sceneNodeEdge = Color(0xFF18232F),
    sceneAxon = Color(0xFF7C8791),
    sceneSignal = Color(0xFF4E8C1E),
    sceneGround = Color(0xFFE6ECF2),
)

val BizmoDarkColors = BizmoColors(
    bg = Color(0xFF0D151D),
    bgSunken = Color(0xFF0A1118),
    surface = Color(0xFF131F2A),
    surface2 = Color(0xFF18232F),
    surface3 = Color(0xFF1D2A37),
    well = Color(0xFF0F1922),
    surfaceRaised = Color(0xFF18232F),
    andonRun = Color(0xFF5FA828),
    andonRunInk = Color(0xFF0D151D),
    andonWarn = Color(0xFFE89A1C),
    andonWarnInk = Color(0xFF0D151D),
    andonStop = Color(0xFFC23A33),
    andonStopInk = Color(0xFFFFFFFF),
    andonMaint = Color(0xFF00739E),
    andonMaintInk = Color(0xFFFFFFFF),
    andonIdle = Color(0xFF233140),
    andonIdleInk = Color(0xFFB7C3CF),
    text = Color(0xFFEEF3F8),
    text2 = Color(0xFFA8B5C2),
    text3 = Color(0xFF8D9AA6),
    textInverse = Color(0xFF0D151D),
    divider = Color(0x14FFFFFF),
    border = Color(0x1CFFFFFF),
    borderStrong = Color(0x2EFFFFFF),
    controlBorder = Color(0xFF6B7B8A),
    hover = Color(0x0DFFFFFF),
    press = Color(0x17FFFFFF),
    field = Color(0x0AFFFFFF),
    fieldBorder = Color(0x1AFFFFFF),
    accent = Color(0xFF6DB92C),
    accentStrong = Color(0xFF7CC63C),
    accentContrast = Color(0xFF0D151D),
    accentInk = Color(0xFF8ED14F),
    accentSoft = Color(0x296DB92C),
    accentRing = Color(0x736DB92C),
    focus = Color(0xFF6DB92C),
    data = Color(0xFF33B9E8),
    dataInk = Color(0xFF5CC8EE),
    dataSoft = Color(0x2900A7E1),
    dataSolid = Color(0xFF33B9E8),
    dataSolidHover = Color(0xFF5CC8EE),
    dataContrast = Color(0xFF0B1520),
    success = Color(0xFF8ED14F),
    successInk = Color(0xFF8ED14F),
    successSoft = Color(0x248ED14F),
    successTone = Color(0xFF8ED14F),
    warning = Color(0xFFF0AC55),
    warningInk = Color(0xFFF0AC55),
    warningSoft = Color(0x24F0AC55),
    warningTone = Color(0xFFF0AC55),
    danger = Color(0xFFF0787C),
    dangerInk = Color(0xFFF0787C),
    dangerSolid = Color(0xFFC23A33),
    dangerSoft = Color(0x24F0787C),
    dangerTone = Color(0xFFF0787C),
    info = Color(0xFF33B9E8),
    infoInk = Color(0xFF5CC8EE),
    infoSoft = Color(0x2900A7E1),
    infoTone = Color(0xFF33B9E8),
    glassBg = Color(0xBD111C27),
    glassStrong = Color(0xF215212C),
    glassBorder = Color(0x14FFFFFF),
    scrim = Color(0x8C050A0F),
    sidebarBg = Color(0xD10F1922),
    topbarBg = Color(0xCC131F2A),
    navActiveBg = Color(0x12FFFFFF),
    gridHeaderBg = Color(0xFF16222D),
    gridRowHover = Color(0x09FFFFFF),
    gridRowSelected = Color(0x246DB92C),
    gridRowZebra = Color(0x05FFFFFF),
    chartSurface = Color(0xFF131F2A),
    chartGrid = Color(0x12FFFFFF),
    chartAxis = Color(0x33FFFFFF),
    chartMid = Color(0xFF2A3642),
    series1 = Color(0xFF1F97CC),
    series2 = Color(0xFFD9662C),
    series3 = Color(0xFF14937B),
    series4 = Color(0xFFB88000),
    series5 = Color(0xFFD55181),
    series6 = Color(0xFF8F84E8),
    sceneBg = Color(0xFF0B131B),
    sceneFog = Color(0xFF0D151D),
    sceneNode = Color(0xFF22313F),
    sceneNodeEdge = Color(0xFFA8B5C2),
    sceneAxon = Color(0xFF3A4B5C),
    sceneSignal = Color(0xFF6DB92C),
    sceneGround = Color(0xFF0F1A24),
)

@Composable
fun bizmoColors(dark: Boolean = isSystemInDarkTheme()): BizmoColors = if (dark) BizmoDarkColors else BizmoLightColors

/** Material 3 eşlemesi: primary = Bizmo yeşili, üstündeki yazı lacivert */
fun BizmoColors.toMaterialScheme(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = accent, onPrimary = accentContrast, primaryContainer = accentSoft, onPrimaryContainer = accentInk,
        secondary = data, onSecondary = dataContrast,
        background = bg, onBackground = text, surface = surface, onSurface = text, surfaceVariant = surface3, onSurfaceVariant = text2,
        outline = borderStrong, outlineVariant = divider, error = dangerSolid, onError = Color.White, scrim = scrim,
    )
}

object BizmoRadius {
    val xs = 6.dp
    val sm = 10.dp
    val md = 16.dp
    val lg = 26.dp
    val full = 999.dp
}

object BizmoSpace {
    val s0 = 0.dp
    val s1 = 4.dp
    val s2 = 8.dp
    val s3 = 12.dp
    val s4 = 16.dp
    val s5 = 20.dp
    val s6 = 24.dp
    val s8 = 32.dp
    val s10 = 40.dp
    val s12 = 48.dp
    val s16 = 64.dp
    val card = 20.dp
}

object BizmoFontSize {
    val display = 56.sp
    val h1 = 36.sp
    val h2 = 26.sp
    val h3 = 20.sp
    val h4 = 16.sp
    val bodyLg = 17.sp
    val body = 14.sp
    val sm = 13.sp
    val xs = 12.sp
    val kicker = 11.sp
}

object BizmoSize {
    val controlSm = 32.dp
    val controlMd = 38.dp
    val controlLg = 44.dp
    val fieldHeight = 42.dp
    val touchMin = 48.dp
    val rowRegular = 40.dp
}

object BizmoDuration {
    const val INSTANT = 80
    const val FAST = 120
    const val BASE = 180
    const val SLOW = 240
    const val SLOWER = 340
}
