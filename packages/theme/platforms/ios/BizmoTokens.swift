// Bizmo Universal Theme v1.1.0 · tokens.json'dan üretildi (node scripts/build.mjs). Elle düzenlemeyin.
// iOS 15+ / macOS 12+ · Kullanım: Text("Merhaba").foregroundStyle(BizmoTokens.Colors.text)
// Renkler sistem görünümüne (açık/koyu) kendiliğinden uyar. Fontlar: Inter (gövde), Manrope (başlık) uygulamaya eklenmelidir.
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

public enum BizmoTokens {
    public enum Colors {
        public static let bg = dynamic(light: (0.9529, 0.9647, 0.9804, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let bgSunken = dynamic(light: (0.9137, 0.9333, 0.9569, 1.000), dark: (0.0392, 0.0667, 0.0941, 1.000))
        public static let surface = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.0745, 0.1216, 0.1647, 1.000))
        public static let surface2 = dynamic(light: (0.9725, 0.9804, 0.9922, 1.000), dark: (0.0941, 0.1373, 0.1843, 1.000))
        public static let surface3 = dynamic(light: (0.9373, 0.9529, 0.9725, 1.000), dark: (0.1137, 0.1647, 0.2157, 1.000))
        public static let well = dynamic(light: (0.9137, 0.9333, 0.9569, 1.000), dark: (0.0588, 0.0980, 0.1333, 1.000))
        public static let surfaceRaised = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.0941, 0.1373, 0.1843, 1.000))
        public static let andonRun = dynamic(light: (0.4275, 0.7255, 0.1725, 1.000), dark: (0.3725, 0.6588, 0.1569, 1.000))
        public static let andonRunInk = dynamic(light: (0.0941, 0.1373, 0.1843, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let andonWarn = dynamic(light: (0.9608, 0.6510, 0.1373, 1.000), dark: (0.9098, 0.6039, 0.1098, 1.000))
        public static let andonWarnInk = dynamic(light: (0.0941, 0.1373, 0.1843, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let andonStop = dynamic(light: (0.7608, 0.2275, 0.2000, 1.000), dark: (0.7608, 0.2275, 0.2000, 1.000))
        public static let andonStopInk = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (1.0000, 1.0000, 1.0000, 1.000))
        public static let andonMaint = dynamic(light: (0.0000, 0.4510, 0.6196, 1.000), dark: (0.0000, 0.4510, 0.6196, 1.000))
        public static let andonMaintInk = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (1.0000, 1.0000, 1.0000, 1.000))
        public static let andonIdle = dynamic(light: (0.8745, 0.8980, 0.9255, 1.000), dark: (0.1373, 0.1922, 0.2510, 1.000))
        public static let andonIdleInk = dynamic(light: (0.3098, 0.3569, 0.4039, 1.000), dark: (0.7176, 0.7647, 0.8118, 1.000))
        public static let text = dynamic(light: (0.0941, 0.1373, 0.1843, 1.000), dark: (0.9333, 0.9529, 0.9725, 1.000))
        public static let text2 = dynamic(light: (0.3098, 0.3569, 0.4039, 1.000), dark: (0.6588, 0.7098, 0.7608, 1.000))
        public static let text3 = dynamic(light: (0.3725, 0.4157, 0.4588, 1.000), dark: (0.5529, 0.6039, 0.6510, 1.000))
        public static let textInverse = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let divider = dynamic(light: (0.0941, 0.1373, 0.1843, 0.090), dark: (1.0000, 1.0000, 1.0000, 0.080))
        public static let border = dynamic(light: (0.0941, 0.1373, 0.1843, 0.120), dark: (1.0000, 1.0000, 1.0000, 0.110))
        public static let borderStrong = dynamic(light: (0.0941, 0.1373, 0.1843, 0.200), dark: (1.0000, 1.0000, 1.0000, 0.180))
        public static let controlBorder = dynamic(light: (0.4627, 0.5059, 0.5490, 1.000), dark: (0.4196, 0.4824, 0.5412, 1.000))
        public static let hover = dynamic(light: (0.0941, 0.1373, 0.1843, 0.045), dark: (1.0000, 1.0000, 1.0000, 0.050))
        public static let press = dynamic(light: (0.0941, 0.1373, 0.1843, 0.080), dark: (1.0000, 1.0000, 1.0000, 0.090))
        public static let field = dynamic(light: (0.0941, 0.1373, 0.1843, 0.045), dark: (1.0000, 1.0000, 1.0000, 0.040))
        public static let fieldBorder = dynamic(light: (0.0941, 0.1373, 0.1843, 0.100), dark: (1.0000, 1.0000, 1.0000, 0.100))
        public static let accent = dynamic(light: (0.4275, 0.7255, 0.1725, 1.000), dark: (0.4275, 0.7255, 0.1725, 1.000))
        public static let accentStrong = dynamic(light: (0.3843, 0.6588, 0.1529, 1.000), dark: (0.4863, 0.7765, 0.2353, 1.000))
        public static let accentContrast = dynamic(light: (0.0941, 0.1373, 0.1843, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let accentInk = dynamic(light: (0.2471, 0.4784, 0.0784, 1.000), dark: (0.5569, 0.8196, 0.3098, 1.000))
        public static let accentSoft = dynamic(light: (0.4275, 0.7255, 0.1725, 0.130), dark: (0.4275, 0.7255, 0.1725, 0.160))
        public static let accentRing = dynamic(light: (0.4275, 0.7255, 0.1725, 0.350), dark: (0.4275, 0.7255, 0.1725, 0.450))
        public static let focus = dynamic(light: (0.3059, 0.5490, 0.1176, 1.000), dark: (0.4275, 0.7255, 0.1725, 1.000))
        public static let data = dynamic(light: (0.0000, 0.5804, 0.7882, 1.000), dark: (0.2000, 0.7255, 0.9098, 1.000))
        public static let dataInk = dynamic(light: (0.0000, 0.4510, 0.6196, 1.000), dark: (0.3608, 0.7843, 0.9333, 1.000))
        public static let dataSoft = dynamic(light: (0.0000, 0.6549, 0.8824, 0.120), dark: (0.0000, 0.6549, 0.8824, 0.160))
        public static let dataSolid = dynamic(light: (0.0000, 0.4510, 0.6196, 1.000), dark: (0.2000, 0.7255, 0.9098, 1.000))
        public static let dataSolidHover = dynamic(light: (0.0000, 0.3725, 0.5137, 1.000), dark: (0.3608, 0.7843, 0.9333, 1.000))
        public static let dataContrast = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.0431, 0.0824, 0.1255, 1.000))
        public static let success = dynamic(light: (0.2471, 0.5608, 0.1020, 1.000), dark: (0.5569, 0.8196, 0.3098, 1.000))
        public static let successInk = dynamic(light: (0.1843, 0.4784, 0.0706, 1.000), dark: (0.5569, 0.8196, 0.3098, 1.000))
        public static let successSoft = dynamic(light: (0.4275, 0.7255, 0.1725, 0.140), dark: (0.5569, 0.8196, 0.3098, 0.140))
        public static let successTone = dynamic(light: (0.4275, 0.7255, 0.1725, 1.000), dark: (0.5569, 0.8196, 0.3098, 1.000))
        public static let warning = dynamic(light: (0.7216, 0.4314, 0.0000, 1.000), dark: (0.9412, 0.6745, 0.3333, 1.000))
        public static let warningInk = dynamic(light: (0.5765, 0.3412, 0.0000, 1.000), dark: (0.9412, 0.6745, 0.3333, 1.000))
        public static let warningSoft = dynamic(light: (0.9608, 0.6510, 0.1373, 0.160), dark: (0.9412, 0.6745, 0.3333, 0.140))
        public static let warningTone = dynamic(light: (0.9608, 0.6510, 0.1373, 1.000), dark: (0.9412, 0.6745, 0.3333, 1.000))
        public static let danger = dynamic(light: (0.8392, 0.2706, 0.2392, 1.000), dark: (0.9412, 0.4706, 0.4863, 1.000))
        public static let dangerInk = dynamic(light: (0.7216, 0.1961, 0.1686, 1.000), dark: (0.9412, 0.4706, 0.4863, 1.000))
        public static let dangerSolid = dynamic(light: (0.7608, 0.2275, 0.2000, 1.000), dark: (0.7608, 0.2275, 0.2000, 1.000))
        public static let dangerSoft = dynamic(light: (0.8980, 0.2824, 0.3020, 0.110), dark: (0.9412, 0.4706, 0.4863, 0.140))
        public static let dangerTone = dynamic(light: (0.8980, 0.2824, 0.3020, 1.000), dark: (0.9412, 0.4706, 0.4863, 1.000))
        public static let info = dynamic(light: (0.0000, 0.5804, 0.7882, 1.000), dark: (0.2000, 0.7255, 0.9098, 1.000))
        public static let infoInk = dynamic(light: (0.0000, 0.4510, 0.6196, 1.000), dark: (0.3608, 0.7843, 0.9333, 1.000))
        public static let infoSoft = dynamic(light: (0.0000, 0.6549, 0.8824, 0.120), dark: (0.0000, 0.6549, 0.8824, 0.160))
        public static let infoTone = dynamic(light: (0.0000, 0.6549, 0.8824, 1.000), dark: (0.2000, 0.7255, 0.9098, 1.000))
        public static let glassBg = dynamic(light: (1.0000, 1.0000, 1.0000, 0.760), dark: (0.0667, 0.1098, 0.1529, 0.740))
        public static let glassStrong = dynamic(light: (1.0000, 1.0000, 1.0000, 0.920), dark: (0.0824, 0.1294, 0.1725, 0.950))
        public static let glassBorder = dynamic(light: (0.0941, 0.1373, 0.1843, 0.080), dark: (1.0000, 1.0000, 1.0000, 0.080))
        public static let scrim = dynamic(light: (0.0941, 0.1373, 0.1843, 0.280), dark: (0.0196, 0.0392, 0.0588, 0.550))
        public static let sidebarBg = dynamic(light: (0.9725, 0.9804, 0.9922, 0.880), dark: (0.0588, 0.0980, 0.1333, 0.820))
        public static let topbarBg = dynamic(light: (1.0000, 1.0000, 1.0000, 0.800), dark: (0.0745, 0.1216, 0.1647, 0.800))
        public static let navActiveBg = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (1.0000, 1.0000, 1.0000, 0.070))
        public static let gridHeaderBg = dynamic(light: (0.9686, 0.9765, 0.9882, 1.000), dark: (0.0863, 0.1333, 0.1765, 1.000))
        public static let gridRowHover = dynamic(light: (0.0941, 0.1373, 0.1843, 0.035), dark: (1.0000, 1.0000, 1.0000, 0.035))
        public static let gridRowSelected = dynamic(light: (0.4275, 0.7255, 0.1725, 0.100), dark: (0.4275, 0.7255, 0.1725, 0.140))
        public static let gridRowZebra = dynamic(light: (0.0941, 0.1373, 0.1843, 0.018), dark: (1.0000, 1.0000, 1.0000, 0.020))
        public static let chartSurface = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.0745, 0.1216, 0.1647, 1.000))
        public static let chartGrid = dynamic(light: (0.0941, 0.1373, 0.1843, 0.080), dark: (1.0000, 1.0000, 1.0000, 0.070))
        public static let chartAxis = dynamic(light: (0.0941, 0.1373, 0.1843, 0.220), dark: (1.0000, 1.0000, 1.0000, 0.200))
        public static let chartMid = dynamic(light: (0.8941, 0.9137, 0.9373, 1.000), dark: (0.1647, 0.2118, 0.2588, 1.000))
        public static let series1 = dynamic(light: (0.0392, 0.5608, 0.7686, 1.000), dark: (0.1216, 0.5922, 0.8000, 1.000))
        public static let series2 = dynamic(light: (0.9098, 0.4549, 0.2314, 1.000), dark: (0.8510, 0.4000, 0.1725, 1.000))
        public static let series3 = dynamic(light: (0.0863, 0.6275, 0.5294, 1.000), dark: (0.0784, 0.5765, 0.4824, 1.000))
        public static let series4 = dynamic(light: (0.8510, 0.6039, 0.0000, 1.000), dark: (0.7216, 0.5020, 0.0000, 1.000))
        public static let series5 = dynamic(light: (0.8196, 0.3137, 0.5412, 1.000), dark: (0.8353, 0.3176, 0.5059, 1.000))
        public static let series6 = dynamic(light: (0.4784, 0.4196, 0.8784, 1.000), dark: (0.5608, 0.5176, 0.9098, 1.000))
        public static let sceneBg = dynamic(light: (0.9294, 0.9490, 0.9686, 1.000), dark: (0.0431, 0.0745, 0.1059, 1.000))
        public static let sceneFog = dynamic(light: (0.9529, 0.9647, 0.9804, 1.000), dark: (0.0510, 0.0824, 0.1137, 1.000))
        public static let sceneNode = dynamic(light: (1.0000, 1.0000, 1.0000, 1.000), dark: (0.1333, 0.1922, 0.2471, 1.000))
        public static let sceneNodeEdge = dynamic(light: (0.0941, 0.1373, 0.1843, 1.000), dark: (0.6588, 0.7098, 0.7608, 1.000))
        public static let sceneAxon = dynamic(light: (0.4863, 0.5294, 0.5686, 1.000), dark: (0.2275, 0.2941, 0.3608, 1.000))
        public static let sceneSignal = dynamic(light: (0.3059, 0.5490, 0.1176, 1.000), dark: (0.4275, 0.7255, 0.1725, 1.000))
        public static let sceneGround = dynamic(light: (0.9020, 0.9255, 0.9490, 1.000), dark: (0.0588, 0.1020, 0.1412, 1.000))
    }

    public enum Radius {
        public static let xs: CGFloat = 6
        public static let sm: CGFloat = 10
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 26
        public static let full: CGFloat = 999
    }

    public enum Space {
        public static let s0: CGFloat = 0
        public static let s1: CGFloat = 4
        public static let s2: CGFloat = 8
        public static let s3: CGFloat = 12
        public static let s4: CGFloat = 16
        public static let s5: CGFloat = 20
        public static let s6: CGFloat = 24
        public static let s8: CGFloat = 32
        public static let s10: CGFloat = 40
        public static let s12: CGFloat = 48
        public static let s16: CGFloat = 64
        public static let card: CGFloat = 20
    }

    public enum FontSize {
        public static let display: CGFloat = 56
        public static let h1: CGFloat = 36
        public static let h2: CGFloat = 26
        public static let h3: CGFloat = 20
        public static let h4: CGFloat = 16
        public static let bodyLg: CGFloat = 17
        public static let body: CGFloat = 14
        public static let sm: CGFloat = 13
        public static let xs: CGFloat = 12
        public static let kicker: CGFloat = 11
    }

    public enum Size {
        public static let controlSm: CGFloat = 32
        public static let controlMd: CGFloat = 38
        public static let controlLg: CGFloat = 44
        public static let fieldHeight: CGFloat = 42
        public static let touchMin: CGFloat = 44
        public static let rowCompact: CGFloat = 32
        public static let rowRegular: CGFloat = 40
        public static let rowRelaxed: CGFloat = 48
    }

    public enum Duration {
        public static let instant: Double = 0.080
        public static let fast: Double = 0.120
        public static let base: Double = 0.180
        public static let slow: Double = 0.240
        public static let slower: Double = 0.340
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
