// tokens.json → platform dosyaları: TypeScript, SCSS, SwiftUI, Jetpack Compose, Flutter
// build.mjs tarafından çağrılır. Çıktılar üretilen dosyalardır; elle düzenlemeyin.
import fs from "node:fs";
import path from "node:path";

const isToken = (v) => v && typeof v === "object" && "$value" in v;

/** {primitive.x} referanslarını çözer */
function resolve(src, value) {
  if (typeof value !== "string") return value;
  const m = value.match(/^\{primitive\.([\w-]+)\}$/);
  return m ? src.primitive[m[1]].$value : value;
}

/** "#rrggbb" veya "rgb(r g b / a)" → { r, g, b, a } (0-255, a 0-1) */
export function parseColor(value) {
  const v = String(value).trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{6})$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`Renk çözülemedi: ${value}`);
}

const hex2 = (n) => n.toString(16).padStart(2, "0").toUpperCase();
const rgbHex = (c) => `${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const argbHex = (c) => `${hex2(Math.round(c.a * 255))}${rgbHex(c)}`;
const camel = (k) => k.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
const px = (v) => parseFloat(String(v));
const ms = (v) => parseFloat(String(v));

/** Açık/koyu renk çiftleri (yalnız renk türü) */
function colorPairs(src) {
  return Object.keys(src.light)
    .filter((k) => isToken(src.light[k]) && src.light[k].$type === "color" && isToken(src.dark[k]))
    .map((k) => ({ key: k, light: parseColor(resolve(src, src.light[k].$value)), dark: parseColor(resolve(src, src.dark[k].$value)) }));
}

function scaleOf(src, prefix) {
  return Object.entries(src.scale)
    .filter(([k, t]) => isToken(t) && k.startsWith(prefix))
    .map(([k, t]) => ({ key: k.slice(prefix.length), value: t.$value, type: t.$type }));
}

const header = (version, comment = "//") =>
  `${comment} Bizmo Universal Theme v${version} · tokens.json'dan üretildi (node scripts/build.mjs). Elle düzenlemeyin.\n`;

// ───────────────────────── TypeScript ─────────────────────────
function typescript(src) {
  const version = src.$extensions.bizmo.version;
  const pairs = colorPairs(src);
  const obj = (mode) =>
    pairs.map((p) => `    "${p.key}": "${src[mode][p.key].$value.startsWith("{") ? resolve(src, src[mode][p.key].$value) : src[mode][p.key].$value}",`).join("\n");
  const scale = Object.entries(src.scale)
    .filter(([, t]) => isToken(t))
    .map(([k, t]) => `    "${k}": ${JSON.stringify(t.$value)},`)
    .join("\n");
  const prim = Object.entries(src.primitive)
    .filter(([, t]) => isToken(t))
    .map(([k, t]) => `    "${k}": "${t.$value}",`)
    .join("\n");
  return `${header(version)}/* eslint-disable */
/** Ham değerler: CSS değişkeni kullanamayan yerler için (canvas, WebGL, e-posta, PDF, sunucu tarafı görsel) */
export const bizmoTokens = {
  version: "${version}",
  primitive: {
${prim}
  },
  light: {
${obj("light")}
  },
  dark: {
${obj("dark")}
  },
  scale: {
${scale}
  },
} as const;

export type BizmoMode = "light" | "dark";
export type BizmoColorToken = keyof typeof bizmoTokens.light;
export type BizmoScaleToken = keyof typeof bizmoTokens.scale;

/** Temaya duyarlı CSS değişkeni: style={{ color: bzVar("text-2") }} */
export const bzVar = (name: BizmoColorToken | BizmoScaleToken | keyof typeof bizmoTokens.primitive) => \`var(--bz-\${name})\`;

/** Belirli bir modun ham rengi: bzColor("accent-ink", "dark") */
export const bzColor = (name: BizmoColorToken, mode: BizmoMode = "light") => bizmoTokens[mode][name];
`;
}

// ───────────────────────── SCSS ─────────────────────────
function scss(src) {
  const version = src.$extensions.bizmo.version;
  const pairs = colorPairs(src);
  const map = (mode) => pairs.map((p) => `  "${p.key}": ${src[mode][p.key].$value.startsWith("{") ? resolve(src, src[mode][p.key].$value) : src[mode][p.key].$value},`).join("\n");
  const vars = pairs.map((p) => `$bz-${p.key}: var(--bz-${p.key});`).join("\n");
  const scaleVars = Object.entries(src.scale)
    .filter(([, t]) => isToken(t) && ["dimension", "duration", "number"].includes(t.$type))
    .map(([k, t]) => `$bz-${k}: ${t.$value};`)
    .join("\n");
  return `${header(version)}// Kullanım: @use "@bizmo/theme/platforms/scss/bizmo-tokens" as bz;  color: bz.$bz-text;
// Önerilen: temaya duyarlı değişkenler (tokens.css de yüklenmeli). Ham haritalar yalnız derleme anında renk gereken yerler için.

// Temaya duyarlı (CSS değişkeni)
${vars}

// Ölçek
${scaleVars}

// Ham renk haritaları
$bz-light: (
${map("light")}
);
$bz-dark: (
${map("dark")}
);
`;
}

// ───────────────────────── SwiftUI ─────────────────────────
function swift(src) {
  const version = src.$extensions.bizmo.version;
  const pairs = colorPairs(src);
  const comp = (c) => `${(c.r / 255).toFixed(4)}, ${(c.g / 255).toFixed(4)}, ${(c.b / 255).toFixed(4)}, ${c.a.toFixed(3)}`;
  const colors = pairs
    .map((p) => `        public static let ${camel(p.key)} = dynamic(light: (${comp(p.light)}), dark: (${comp(p.dark)}))`)
    .join("\n");
  const cg = (prefix, name) =>
    scaleOf(src, prefix)
      .filter((s) => s.type === "dimension")
      .map((s) => `        public static let ${/^\d/.test(s.key) ? "s" + s.key : camel(s.key)}: CGFloat = ${px(s.value)}`)
      .join("\n");
  const durations = scaleOf(src, "duration-")
    .map((s) => `        public static let ${camel(s.key)}: Double = ${(ms(s.value) / 1000).toFixed(3)}`)
    .join("\n");
  return `${header(version)}// iOS 15+ / macOS 12+ · Kullanım: Text("Merhaba").foregroundStyle(BizmoTokens.Colors.text)
// Renkler sistem görünümüne (açık/koyu) kendiliğinden uyar. Fontlar: Inter (gövde), Manrope (başlık) uygulamaya eklenmelidir.
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

public enum BizmoTokens {
    public enum Colors {
${colors}
    }

    public enum Radius {
${cg("radius-")}
    }

    public enum Space {
${cg("space-")}
    }

    public enum FontSize {
${cg("text-")}
    }

    public enum Size {
        public static let controlSm: CGFloat = ${px(src.scale["control-sm"].$value)}
        public static let controlMd: CGFloat = ${px(src.scale["control-md"].$value)}
        public static let controlLg: CGFloat = ${px(src.scale["control-lg"].$value)}
        public static let fieldHeight: CGFloat = ${px(src.scale["field-h"].$value)}
        public static let touchMin: CGFloat = 44
        public static let rowCompact: CGFloat = ${px(src.scale["row-compact"].$value)}
        public static let rowRegular: CGFloat = ${px(src.scale["row-regular"].$value)}
        public static let rowRelaxed: CGFloat = ${px(src.scale["row-relaxed"].$value)}
    }

    public enum Duration {
${durations}
    }

    public enum FontFamily {
        public static let sans = "Inter"
        public static let display = "Manrope"
    }

    private typealias RGBA = (Double, Double, Double, Double)

    private static func dynamic(light: RGBA, dark: RGBA) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: c.3)
        })
        #elseif canImport(AppKit)
        return Color(NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            let c = isDark ? dark : light
            return NSColor(srgbRed: c.0, green: c.1, blue: c.2, alpha: c.3)
        })
        #else
        return Color(.sRGB, red: light.0, green: light.1, blue: light.2, opacity: light.3)
        #endif
    }
}
`;
}

// ───────────────────────── Jetpack Compose ─────────────────────────
function kotlin(src) {
  const version = src.$extensions.bizmo.version;
  const pairs = colorPairs(src);
  const fields = pairs.map((p) => `    val ${camel(p.key)}: Color,`).join("\n");
  const inst = (mode) => pairs.map((p) => `    ${camel(p.key)} = Color(0x${argbHex(p[mode])}),`).join("\n");
  const dp = (prefix) =>
    scaleOf(src, prefix)
      .filter((s) => s.type === "dimension")
      .map((s) => `    val ${/^\d/.test(s.key) ? "s" + s.key : camel(s.key)} = ${px(s.value)}.dp`)
      .join("\n");
  const sp = scaleOf(src, "text-")
    .map((s) => `    val ${camel(s.key)} = ${px(s.value)}.sp`)
    .join("\n");
  return `${header(version)}// Kullanım: val c = bizmoColors(); Text("Merhaba", color = c.text)
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
${fields}
)

val BizmoLightColors = BizmoColors(
${inst("light")}
)

val BizmoDarkColors = BizmoColors(
${inst("dark")}
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
${dp("radius-")}
}

object BizmoSpace {
${dp("space-")}
}

object BizmoFontSize {
${sp}
}

object BizmoSize {
    val controlSm = ${px(src.scale["control-sm"].$value)}.dp
    val controlMd = ${px(src.scale["control-md"].$value)}.dp
    val controlLg = ${px(src.scale["control-lg"].$value)}.dp
    val fieldHeight = ${px(src.scale["field-h"].$value)}.dp
    val touchMin = 48.dp
    val rowRegular = ${px(src.scale["row-regular"].$value)}.dp
}

object BizmoDuration {
${scaleOf(src, "duration-").map((s) => `    const val ${camel(s.key).toUpperCase()} = ${ms(s.value)}`).join("\n")}
}
`;
}

// ───────────────────────── Flutter ─────────────────────────
function dart(src) {
  const version = src.$extensions.bizmo.version;
  const pairs = colorPairs(src);
  const fields = pairs.map((p) => `  final Color ${camel(p.key)};`).join("\n");
  const params = pairs.map((p) => `    required this.${camel(p.key)},`).join("\n");
  const inst = (mode) => pairs.map((p) => `    ${camel(p.key)}: Color(0x${argbHex(p[mode])}),`).join("\n");
  const lerp = pairs.map((p) => `      ${camel(p.key)}: Color.lerp(${camel(p.key)}, other.${camel(p.key)}, t)!,`).join("\n");
  const copyParams = pairs.map((p) => `Color? ${camel(p.key)}`).join(", ");
  const copyBody = pairs.map((p) => `      ${camel(p.key)}: ${camel(p.key)} ?? this.${camel(p.key)},`).join("\n");
  const dbl = (prefix) =>
    scaleOf(src, prefix)
      .filter((s) => s.type === "dimension")
      .map((s) => `  static const double ${/^\d/.test(s.key) ? "s" + s.key : camel(s.key)} = ${px(s.value)};`)
      .join("\n");
  return `${header(version)}// Kullanım: ThemeData(colorScheme: bizmoColorScheme(Brightness.light), extensions: const [BizmoColors.light])
//          final c = Theme.of(context).extension<BizmoColors>()!;  Text('Merhaba', style: TextStyle(color: c.text))
// Fontlar: Inter (gövde), Manrope (başlık) pubspec.yaml'a eklenmelidir.
import 'package:flutter/material.dart';

@immutable
class BizmoColors extends ThemeExtension<BizmoColors> {
  const BizmoColors({
${params}
  });

${fields}

  static const light = BizmoColors(
${inst("light")}
  );

  static const dark = BizmoColors(
${inst("dark")}
  );

  @override
  BizmoColors copyWith({${copyParams}}) {
    return BizmoColors(
${copyBody}
    );
  }

  @override
  BizmoColors lerp(ThemeExtension<BizmoColors>? other, double t) {
    if (other is! BizmoColors) return this;
    return BizmoColors(
${lerp}
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
${dbl("radius-")}
}

abstract final class BizmoSpace {
${dbl("space-")}
}

abstract final class BizmoFontSize {
${dbl("text-")}
}

abstract final class BizmoSize {
  static const double controlSm = ${px(src.scale["control-sm"].$value)};
  static const double controlMd = ${px(src.scale["control-md"].$value)};
  static const double controlLg = ${px(src.scale["control-lg"].$value)};
  static const double fieldHeight = ${px(src.scale["field-h"].$value)};
  static const double touchMin = 48;
  static const double rowRegular = ${px(src.scale["row-regular"].$value)};
}

abstract final class BizmoDuration {
${scaleOf(src, "duration-").map((s) => `  static const ${camel(s.key)} = Duration(milliseconds: ${ms(s.value)});`).join("\n")}
}
`;
}

export function writePlatforms(src, root) {
  const files = {
    "tokens.ts": typescript(src),
    "platforms/scss/_bizmo-tokens.scss": scss(src),
    "platforms/ios/BizmoTokens.swift": swift(src),
    "platforms/android/BizmoTokens.kt": kotlin(src),
    "platforms/flutter/bizmo_tokens.dart": dart(src),
  };
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return Object.keys(files);
}
