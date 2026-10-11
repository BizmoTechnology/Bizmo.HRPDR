// Bizmo Universal Theme v1.1.0 · tokens.json'dan üretildi (node scripts/build.mjs). Elle düzenlemeyin.
// Kullanım: ThemeData(colorScheme: bizmoColorScheme(Brightness.light), extensions: const [BizmoColors.light])
//          final c = Theme.of(context).extension<BizmoColors>()!;  Text('Merhaba', style: TextStyle(color: c.text))
// Fontlar: Inter (gövde), Manrope (başlık) pubspec.yaml'a eklenmelidir.
import 'package:flutter/material.dart';

@immutable
class BizmoColors extends ThemeExtension<BizmoColors> {
  const BizmoColors({
    required this.bg,
    required this.bgSunken,
    required this.surface,
    required this.surface2,
    required this.surface3,
    required this.well,
    required this.surfaceRaised,
    required this.andonRun,
    required this.andonRunInk,
    required this.andonWarn,
    required this.andonWarnInk,
    required this.andonStop,
    required this.andonStopInk,
    required this.andonMaint,
    required this.andonMaintInk,
    required this.andonIdle,
    required this.andonIdleInk,
    required this.text,
    required this.text2,
    required this.text3,
    required this.textInverse,
    required this.divider,
    required this.border,
    required this.borderStrong,
    required this.controlBorder,
    required this.hover,
    required this.press,
    required this.field,
    required this.fieldBorder,
    required this.accent,
    required this.accentStrong,
    required this.accentContrast,
    required this.accentInk,
    required this.accentSoft,
    required this.accentRing,
    required this.focus,
    required this.data,
    required this.dataInk,
    required this.dataSoft,
    required this.dataSolid,
    required this.dataSolidHover,
    required this.dataContrast,
    required this.success,
    required this.successInk,
    required this.successSoft,
    required this.successTone,
    required this.warning,
    required this.warningInk,
    required this.warningSoft,
    required this.warningTone,
    required this.danger,
    required this.dangerInk,
    required this.dangerSolid,
    required this.dangerSoft,
    required this.dangerTone,
    required this.info,
    required this.infoInk,
    required this.infoSoft,
    required this.infoTone,
    required this.glassBg,
    required this.glassStrong,
    required this.glassBorder,
    required this.scrim,
    required this.sidebarBg,
    required this.topbarBg,
    required this.navActiveBg,
    required this.gridHeaderBg,
    required this.gridRowHover,
    required this.gridRowSelected,
    required this.gridRowZebra,
    required this.chartSurface,
    required this.chartGrid,
    required this.chartAxis,
    required this.chartMid,
    required this.series1,
    required this.series2,
    required this.series3,
    required this.series4,
    required this.series5,
    required this.series6,
    required this.sceneBg,
    required this.sceneFog,
    required this.sceneNode,
    required this.sceneNodeEdge,
    required this.sceneAxon,
    required this.sceneSignal,
    required this.sceneGround,
  });

  final Color bg;
  final Color bgSunken;
  final Color surface;
  final Color surface2;
  final Color surface3;
  final Color well;
  final Color surfaceRaised;
  final Color andonRun;
  final Color andonRunInk;
  final Color andonWarn;
  final Color andonWarnInk;
  final Color andonStop;
  final Color andonStopInk;
  final Color andonMaint;
  final Color andonMaintInk;
  final Color andonIdle;
  final Color andonIdleInk;
  final Color text;
  final Color text2;
  final Color text3;
  final Color textInverse;
  final Color divider;
  final Color border;
  final Color borderStrong;
  final Color controlBorder;
  final Color hover;
  final Color press;
  final Color field;
  final Color fieldBorder;
  final Color accent;
  final Color accentStrong;
  final Color accentContrast;
  final Color accentInk;
  final Color accentSoft;
  final Color accentRing;
  final Color focus;
  final Color data;
  final Color dataInk;
  final Color dataSoft;
  final Color dataSolid;
  final Color dataSolidHover;
  final Color dataContrast;
  final Color success;
  final Color successInk;
  final Color successSoft;
  final Color successTone;
  final Color warning;
  final Color warningInk;
  final Color warningSoft;
  final Color warningTone;
  final Color danger;
  final Color dangerInk;
  final Color dangerSolid;
  final Color dangerSoft;
  final Color dangerTone;
  final Color info;
  final Color infoInk;
  final Color infoSoft;
  final Color infoTone;
  final Color glassBg;
  final Color glassStrong;
  final Color glassBorder;
  final Color scrim;
  final Color sidebarBg;
  final Color topbarBg;
  final Color navActiveBg;
  final Color gridHeaderBg;
  final Color gridRowHover;
  final Color gridRowSelected;
  final Color gridRowZebra;
  final Color chartSurface;
  final Color chartGrid;
  final Color chartAxis;
  final Color chartMid;
  final Color series1;
  final Color series2;
  final Color series3;
  final Color series4;
  final Color series5;
  final Color series6;
  final Color sceneBg;
  final Color sceneFog;
  final Color sceneNode;
  final Color sceneNodeEdge;
  final Color sceneAxon;
  final Color sceneSignal;
  final Color sceneGround;

  static const light = BizmoColors(
    bg: Color(0xFFF3F6FA),
    bgSunken: Color(0xFFE9EEF4),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFF8FAFD),
    surface3: Color(0xFFEFF3F8),
    well: Color(0xFFE9EEF4),
    surfaceRaised: Color(0xFFFFFFFF),
    andonRun: Color(0xFF6DB92C),
    andonRunInk: Color(0xFF18232F),
    andonWarn: Color(0xFFF5A623),
    andonWarnInk: Color(0xFF18232F),
    andonStop: Color(0xFFC23A33),
    andonStopInk: Color(0xFFFFFFFF),
    andonMaint: Color(0xFF00739E),
    andonMaintInk: Color(0xFFFFFFFF),
    andonIdle: Color(0xFFDFE5EC),
    andonIdleInk: Color(0xFF4F5B67),
    text: Color(0xFF18232F),
    text2: Color(0xFF4F5B67),
    text3: Color(0xFF5F6A75),
    textInverse: Color(0xFFFFFFFF),
    divider: Color(0x1718232F),
    border: Color(0x1F18232F),
    borderStrong: Color(0x3318232F),
    controlBorder: Color(0xFF76818C),
    hover: Color(0x0B18232F),
    press: Color(0x1418232F),
    field: Color(0x0B18232F),
    fieldBorder: Color(0x1A18232F),
    accent: Color(0xFF6DB92C),
    accentStrong: Color(0xFF62A827),
    accentContrast: Color(0xFF18232F),
    accentInk: Color(0xFF3F7A14),
    accentSoft: Color(0x216DB92C),
    accentRing: Color(0x596DB92C),
    focus: Color(0xFF4E8C1E),
    data: Color(0xFF0094C9),
    dataInk: Color(0xFF00739E),
    dataSoft: Color(0x1F00A7E1),
    dataSolid: Color(0xFF00739E),
    dataSolidHover: Color(0xFF005F83),
    dataContrast: Color(0xFFFFFFFF),
    success: Color(0xFF3F8F1A),
    successInk: Color(0xFF2F7A12),
    successSoft: Color(0x246DB92C),
    successTone: Color(0xFF6DB92C),
    warning: Color(0xFFB86E00),
    warningInk: Color(0xFF935700),
    warningSoft: Color(0x29F5A623),
    warningTone: Color(0xFFF5A623),
    danger: Color(0xFFD6453D),
    dangerInk: Color(0xFFB8322B),
    dangerSolid: Color(0xFFC23A33),
    dangerSoft: Color(0x1CE5484D),
    dangerTone: Color(0xFFE5484D),
    info: Color(0xFF0094C9),
    infoInk: Color(0xFF00739E),
    infoSoft: Color(0x1F00A7E1),
    infoTone: Color(0xFF00A7E1),
    glassBg: Color(0xC2FFFFFF),
    glassStrong: Color(0xEBFFFFFF),
    glassBorder: Color(0x1418232F),
    scrim: Color(0x4718232F),
    sidebarBg: Color(0xE0F8FAFD),
    topbarBg: Color(0xCCFFFFFF),
    navActiveBg: Color(0xFFFFFFFF),
    gridHeaderBg: Color(0xFFF7F9FC),
    gridRowHover: Color(0x0918232F),
    gridRowSelected: Color(0x1A6DB92C),
    gridRowZebra: Color(0x0518232F),
    chartSurface: Color(0xFFFFFFFF),
    chartGrid: Color(0x1418232F),
    chartAxis: Color(0x3818232F),
    chartMid: Color(0xFFE4E9EF),
    series1: Color(0xFF0A8FC4),
    series2: Color(0xFFE8743B),
    series3: Color(0xFF16A087),
    series4: Color(0xFFD99A00),
    series5: Color(0xFFD1508A),
    series6: Color(0xFF7A6BE0),
    sceneBg: Color(0xFFEDF2F7),
    sceneFog: Color(0xFFF3F6FA),
    sceneNode: Color(0xFFFFFFFF),
    sceneNodeEdge: Color(0xFF18232F),
    sceneAxon: Color(0xFF7C8791),
    sceneSignal: Color(0xFF4E8C1E),
    sceneGround: Color(0xFFE6ECF2),
  );

  static const dark = BizmoColors(
    bg: Color(0xFF0D151D),
    bgSunken: Color(0xFF0A1118),
    surface: Color(0xFF131F2A),
    surface2: Color(0xFF18232F),
    surface3: Color(0xFF1D2A37),
    well: Color(0xFF0F1922),
    surfaceRaised: Color(0xFF18232F),
    andonRun: Color(0xFF5FA828),
    andonRunInk: Color(0xFF0D151D),
    andonWarn: Color(0xFFE89A1C),
    andonWarnInk: Color(0xFF0D151D),
    andonStop: Color(0xFFC23A33),
    andonStopInk: Color(0xFFFFFFFF),
    andonMaint: Color(0xFF00739E),
    andonMaintInk: Color(0xFFFFFFFF),
    andonIdle: Color(0xFF233140),
    andonIdleInk: Color(0xFFB7C3CF),
    text: Color(0xFFEEF3F8),
    text2: Color(0xFFA8B5C2),
    text3: Color(0xFF8D9AA6),
    textInverse: Color(0xFF0D151D),
    divider: Color(0x14FFFFFF),
    border: Color(0x1CFFFFFF),
    borderStrong: Color(0x2EFFFFFF),
    controlBorder: Color(0xFF6B7B8A),
    hover: Color(0x0DFFFFFF),
    press: Color(0x17FFFFFF),
    field: Color(0x0AFFFFFF),
    fieldBorder: Color(0x1AFFFFFF),
    accent: Color(0xFF6DB92C),
    accentStrong: Color(0xFF7CC63C),
    accentContrast: Color(0xFF0D151D),
    accentInk: Color(0xFF8ED14F),
    accentSoft: Color(0x296DB92C),
    accentRing: Color(0x736DB92C),
    focus: Color(0xFF6DB92C),
    data: Color(0xFF33B9E8),
    dataInk: Color(0xFF5CC8EE),
    dataSoft: Color(0x2900A7E1),
    dataSolid: Color(0xFF33B9E8),
    dataSolidHover: Color(0xFF5CC8EE),
    dataContrast: Color(0xFF0B1520),
    success: Color(0xFF8ED14F),
    successInk: Color(0xFF8ED14F),
    successSoft: Color(0x248ED14F),
    successTone: Color(0xFF8ED14F),
    warning: Color(0xFFF0AC55),
    warningInk: Color(0xFFF0AC55),
    warningSoft: Color(0x24F0AC55),
    warningTone: Color(0xFFF0AC55),
    danger: Color(0xFFF0787C),
    dangerInk: Color(0xFFF0787C),
    dangerSolid: Color(0xFFC23A33),
    dangerSoft: Color(0x24F0787C),
    dangerTone: Color(0xFFF0787C),
    info: Color(0xFF33B9E8),
    infoInk: Color(0xFF5CC8EE),
    infoSoft: Color(0x2900A7E1),
    infoTone: Color(0xFF33B9E8),
    glassBg: Color(0xBD111C27),
    glassStrong: Color(0xF215212C),
    glassBorder: Color(0x14FFFFFF),
    scrim: Color(0x8C050A0F),
    sidebarBg: Color(0xD10F1922),
    topbarBg: Color(0xCC131F2A),
    navActiveBg: Color(0x12FFFFFF),
    gridHeaderBg: Color(0xFF16222D),
    gridRowHover: Color(0x09FFFFFF),
    gridRowSelected: Color(0x246DB92C),
    gridRowZebra: Color(0x05FFFFFF),
    chartSurface: Color(0xFF131F2A),
    chartGrid: Color(0x12FFFFFF),
    chartAxis: Color(0x33FFFFFF),
    chartMid: Color(0xFF2A3642),
    series1: Color(0xFF1F97CC),
    series2: Color(0xFFD9662C),
    series3: Color(0xFF14937B),
    series4: Color(0xFFB88000),
    series5: Color(0xFFD55181),
    series6: Color(0xFF8F84E8),
    sceneBg: Color(0xFF0B131B),
    sceneFog: Color(0xFF0D151D),
    sceneNode: Color(0xFF22313F),
    sceneNodeEdge: Color(0xFFA8B5C2),
    sceneAxon: Color(0xFF3A4B5C),
    sceneSignal: Color(0xFF6DB92C),
    sceneGround: Color(0xFF0F1A24),
  );

  @override
  BizmoColors copyWith({Color? bg, Color? bgSunken, Color? surface, Color? surface2, Color? surface3, Color? well, Color? surfaceRaised, Color? andonRun, Color? andonRunInk, Color? andonWarn, Color? andonWarnInk, Color? andonStop, Color? andonStopInk, Color? andonMaint, Color? andonMaintInk, Color? andonIdle, Color? andonIdleInk, Color? text, Color? text2, Color? text3, Color? textInverse, Color? divider, Color? border, Color? borderStrong, Color? controlBorder, Color? hover, Color? press, Color? field, Color? fieldBorder, Color? accent, Color? accentStrong, Color? accentContrast, Color? accentInk, Color? accentSoft, Color? accentRing, Color? focus, Color? data, Color? dataInk, Color? dataSoft, Color? dataSolid, Color? dataSolidHover, Color? dataContrast, Color? success, Color? successInk, Color? successSoft, Color? successTone, Color? warning, Color? warningInk, Color? warningSoft, Color? warningTone, Color? danger, Color? dangerInk, Color? dangerSolid, Color? dangerSoft, Color? dangerTone, Color? info, Color? infoInk, Color? infoSoft, Color? infoTone, Color? glassBg, Color? glassStrong, Color? glassBorder, Color? scrim, Color? sidebarBg, Color? topbarBg, Color? navActiveBg, Color? gridHeaderBg, Color? gridRowHover, Color? gridRowSelected, Color? gridRowZebra, Color? chartSurface, Color? chartGrid, Color? chartAxis, Color? chartMid, Color? series1, Color? series2, Color? series3, Color? series4, Color? series5, Color? series6, Color? sceneBg, Color? sceneFog, Color? sceneNode, Color? sceneNodeEdge, Color? sceneAxon, Color? sceneSignal, Color? sceneGround}) {
    return BizmoColors(
      bg: bg ?? this.bg,
      bgSunken: bgSunken ?? this.bgSunken,
      surface: surface ?? this.surface,
      surface2: surface2 ?? this.surface2,
      surface3: surface3 ?? this.surface3,
      well: well ?? this.well,
      surfaceRaised: surfaceRaised ?? this.surfaceRaised,
      andonRun: andonRun ?? this.andonRun,
      andonRunInk: andonRunInk ?? this.andonRunInk,
      andonWarn: andonWarn ?? this.andonWarn,
      andonWarnInk: andonWarnInk ?? this.andonWarnInk,
      andonStop: andonStop ?? this.andonStop,
      andonStopInk: andonStopInk ?? this.andonStopInk,
      andonMaint: andonMaint ?? this.andonMaint,
      andonMaintInk: andonMaintInk ?? this.andonMaintInk,
      andonIdle: andonIdle ?? this.andonIdle,
      andonIdleInk: andonIdleInk ?? this.andonIdleInk,
      text: text ?? this.text,
      text2: text2 ?? this.text2,
      text3: text3 ?? this.text3,
      textInverse: textInverse ?? this.textInverse,
      divider: divider ?? this.divider,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      controlBorder: controlBorder ?? this.controlBorder,
      hover: hover ?? this.hover,
      press: press ?? this.press,
      field: field ?? this.field,
      fieldBorder: fieldBorder ?? this.fieldBorder,
      accent: accent ?? this.accent,
      accentStrong: accentStrong ?? this.accentStrong,
      accentContrast: accentContrast ?? this.accentContrast,
      accentInk: accentInk ?? this.accentInk,
      accentSoft: accentSoft ?? this.accentSoft,
      accentRing: accentRing ?? this.accentRing,
      focus: focus ?? this.focus,
      data: data ?? this.data,
      dataInk: dataInk ?? this.dataInk,
      dataSoft: dataSoft ?? this.dataSoft,
      dataSolid: dataSolid ?? this.dataSolid,
      dataSolidHover: dataSolidHover ?? this.dataSolidHover,
      dataContrast: dataContrast ?? this.dataContrast,
      success: success ?? this.success,
      successInk: successInk ?? this.successInk,
      successSoft: successSoft ?? this.successSoft,
      successTone: successTone ?? this.successTone,
      warning: warning ?? this.warning,
      warningInk: warningInk ?? this.warningInk,
      warningSoft: warningSoft ?? this.warningSoft,
      warningTone: warningTone ?? this.warningTone,
      danger: danger ?? this.danger,
      dangerInk: dangerInk ?? this.dangerInk,
      dangerSolid: dangerSolid ?? this.dangerSolid,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      dangerTone: dangerTone ?? this.dangerTone,
      info: info ?? this.info,
      infoInk: infoInk ?? this.infoInk,
      infoSoft: infoSoft ?? this.infoSoft,
      infoTone: infoTone ?? this.infoTone,
      glassBg: glassBg ?? this.glassBg,
      glassStrong: glassStrong ?? this.glassStrong,
      glassBorder: glassBorder ?? this.glassBorder,
      scrim: scrim ?? this.scrim,
      sidebarBg: sidebarBg ?? this.sidebarBg,
      topbarBg: topbarBg ?? this.topbarBg,
      navActiveBg: navActiveBg ?? this.navActiveBg,
      gridHeaderBg: gridHeaderBg ?? this.gridHeaderBg,
      gridRowHover: gridRowHover ?? this.gridRowHover,
      gridRowSelected: gridRowSelected ?? this.gridRowSelected,
      gridRowZebra: gridRowZebra ?? this.gridRowZebra,
      chartSurface: chartSurface ?? this.chartSurface,
      chartGrid: chartGrid ?? this.chartGrid,
      chartAxis: chartAxis ?? this.chartAxis,
      chartMid: chartMid ?? this.chartMid,
      series1: series1 ?? this.series1,
      series2: series2 ?? this.series2,
      series3: series3 ?? this.series3,
      series4: series4 ?? this.series4,
      series5: series5 ?? this.series5,
      series6: series6 ?? this.series6,
      sceneBg: sceneBg ?? this.sceneBg,
      sceneFog: sceneFog ?? this.sceneFog,
      sceneNode: sceneNode ?? this.sceneNode,
      sceneNodeEdge: sceneNodeEdge ?? this.sceneNodeEdge,
      sceneAxon: sceneAxon ?? this.sceneAxon,
      sceneSignal: sceneSignal ?? this.sceneSignal,
      sceneGround: sceneGround ?? this.sceneGround,
    );
  }

  @override
  BizmoColors lerp(ThemeExtension<BizmoColors>? other, double t) {
    if (other is! BizmoColors) return this;
    return BizmoColors(
      bg: Color.lerp(bg, other.bg, t)!,
      bgSunken: Color.lerp(bgSunken, other.bgSunken, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surface3: Color.lerp(surface3, other.surface3, t)!,
      well: Color.lerp(well, other.well, t)!,
      surfaceRaised: Color.lerp(surfaceRaised, other.surfaceRaised, t)!,
      andonRun: Color.lerp(andonRun, other.andonRun, t)!,
      andonRunInk: Color.lerp(andonRunInk, other.andonRunInk, t)!,
      andonWarn: Color.lerp(andonWarn, other.andonWarn, t)!,
      andonWarnInk: Color.lerp(andonWarnInk, other.andonWarnInk, t)!,
      andonStop: Color.lerp(andonStop, other.andonStop, t)!,
      andonStopInk: Color.lerp(andonStopInk, other.andonStopInk, t)!,
      andonMaint: Color.lerp(andonMaint, other.andonMaint, t)!,
      andonMaintInk: Color.lerp(andonMaintInk, other.andonMaintInk, t)!,
      andonIdle: Color.lerp(andonIdle, other.andonIdle, t)!,
      andonIdleInk: Color.lerp(andonIdleInk, other.andonIdleInk, t)!,
      text: Color.lerp(text, other.text, t)!,
      text2: Color.lerp(text2, other.text2, t)!,
      text3: Color.lerp(text3, other.text3, t)!,
      textInverse: Color.lerp(textInverse, other.textInverse, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      border: Color.lerp(border, other.border, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      controlBorder: Color.lerp(controlBorder, other.controlBorder, t)!,
      hover: Color.lerp(hover, other.hover, t)!,
      press: Color.lerp(press, other.press, t)!,
      field: Color.lerp(field, other.field, t)!,
      fieldBorder: Color.lerp(fieldBorder, other.fieldBorder, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentStrong: Color.lerp(accentStrong, other.accentStrong, t)!,
      accentContrast: Color.lerp(accentContrast, other.accentContrast, t)!,
      accentInk: Color.lerp(accentInk, other.accentInk, t)!,
      accentSoft: Color.lerp(accentSoft, other.accentSoft, t)!,
      accentRing: Color.lerp(accentRing, other.accentRing, t)!,
      focus: Color.lerp(focus, other.focus, t)!,
      data: Color.lerp(data, other.data, t)!,
      dataInk: Color.lerp(dataInk, other.dataInk, t)!,
      dataSoft: Color.lerp(dataSoft, other.dataSoft, t)!,
      dataSolid: Color.lerp(dataSolid, other.dataSolid, t)!,
      dataSolidHover: Color.lerp(dataSolidHover, other.dataSolidHover, t)!,
      dataContrast: Color.lerp(dataContrast, other.dataContrast, t)!,
      success: Color.lerp(success, other.success, t)!,
      successInk: Color.lerp(successInk, other.successInk, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      successTone: Color.lerp(successTone, other.successTone, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningInk: Color.lerp(warningInk, other.warningInk, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      warningTone: Color.lerp(warningTone, other.warningTone, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerInk: Color.lerp(dangerInk, other.dangerInk, t)!,
      dangerSolid: Color.lerp(dangerSolid, other.dangerSolid, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      dangerTone: Color.lerp(dangerTone, other.dangerTone, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoInk: Color.lerp(infoInk, other.infoInk, t)!,
      infoSoft: Color.lerp(infoSoft, other.infoSoft, t)!,
      infoTone: Color.lerp(infoTone, other.infoTone, t)!,
      glassBg: Color.lerp(glassBg, other.glassBg, t)!,
      glassStrong: Color.lerp(glassStrong, other.glassStrong, t)!,
      glassBorder: Color.lerp(glassBorder, other.glassBorder, t)!,
      scrim: Color.lerp(scrim, other.scrim, t)!,
      sidebarBg: Color.lerp(sidebarBg, other.sidebarBg, t)!,
      topbarBg: Color.lerp(topbarBg, other.topbarBg, t)!,
      navActiveBg: Color.lerp(navActiveBg, other.navActiveBg, t)!,
      gridHeaderBg: Color.lerp(gridHeaderBg, other.gridHeaderBg, t)!,
      gridRowHover: Color.lerp(gridRowHover, other.gridRowHover, t)!,
      gridRowSelected: Color.lerp(gridRowSelected, other.gridRowSelected, t)!,
      gridRowZebra: Color.lerp(gridRowZebra, other.gridRowZebra, t)!,
      chartSurface: Color.lerp(chartSurface, other.chartSurface, t)!,
      chartGrid: Color.lerp(chartGrid, other.chartGrid, t)!,
      chartAxis: Color.lerp(chartAxis, other.chartAxis, t)!,
      chartMid: Color.lerp(chartMid, other.chartMid, t)!,
      series1: Color.lerp(series1, other.series1, t)!,
      series2: Color.lerp(series2, other.series2, t)!,
      series3: Color.lerp(series3, other.series3, t)!,
      series4: Color.lerp(series4, other.series4, t)!,
      series5: Color.lerp(series5, other.series5, t)!,
      series6: Color.lerp(series6, other.series6, t)!,
      sceneBg: Color.lerp(sceneBg, other.sceneBg, t)!,
      sceneFog: Color.lerp(sceneFog, other.sceneFog, t)!,
      sceneNode: Color.lerp(sceneNode, other.sceneNode, t)!,
      sceneNodeEdge: Color.lerp(sceneNodeEdge, other.sceneNodeEdge, t)!,
      sceneAxon: Color.lerp(sceneAxon, other.sceneAxon, t)!,
      sceneSignal: Color.lerp(sceneSignal, other.sceneSignal, t)!,
      sceneGround: Color.lerp(sceneGround, other.sceneGround, t)!,
    );
  }
}

/// Material 3 eşlemesi: primary = Bizmo yeşili, üstündeki yazı lacivert
ColorScheme bizmoColorScheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? BizmoColors.dark : BizmoColors.light;
  return ColorScheme(
    brightness: brightness,
    primary: c.accent,
    onPrimary: c.accentContrast,
    primaryContainer: c.accentSoft,
    onPrimaryContainer: c.accentInk,
    secondary: c.data,
    onSecondary: c.dataContrast,
    error: c.dangerSolid,
    onError: const Color(0xFFFFFFFF),
    surface: c.surface,
    onSurface: c.text,
    onSurfaceVariant: c.text2,
    outline: c.borderStrong,
    outlineVariant: c.divider,
    scrim: c.scrim,
  );
}

abstract final class BizmoRadius {
  static const double xs = 6;
  static const double sm = 10;
  static const double md = 16;
  static const double lg = 26;
  static const double full = 999;
}

abstract final class BizmoSpace {
  static const double s0 = 0;
  static const double s1 = 4;
  static const double s2 = 8;
  static const double s3 = 12;
  static const double s4 = 16;
  static const double s5 = 20;
  static const double s6 = 24;
  static const double s8 = 32;
  static const double s10 = 40;
  static const double s12 = 48;
  static const double s16 = 64;
  static const double card = 20;
}

abstract final class BizmoFontSize {
  static const double display = 56;
  static const double h1 = 36;
  static const double h2 = 26;
  static const double h3 = 20;
  static const double h4 = 16;
  static const double bodyLg = 17;
  static const double body = 14;
  static const double sm = 13;
  static const double xs = 12;
  static const double kicker = 11;
}

abstract final class BizmoSize {
  static const double controlSm = 32;
  static const double controlMd = 38;
  static const double controlLg = 44;
  static const double fieldHeight = 42;
  static const double touchMin = 48;
  static const double rowRegular = 40;
}

abstract final class BizmoDuration {
  static const instant = Duration(milliseconds: 80);
  static const fast = Duration(milliseconds: 120);
  static const base = Duration(milliseconds: 180);
  static const slow = Duration(milliseconds: 240);
  static const slower = Duration(milliseconds: 340);
}
