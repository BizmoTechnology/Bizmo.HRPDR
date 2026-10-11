import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { themeInitScript } from "@ph/ui";
import "./globals.css";
import { Providers } from "./providers";

// Bizmo yazı aileleri: Inter (arayüz) + Manrope (başlık ve büyük sayı) — derlemede indirilip kendi sunucumuzdan servis edilir
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "PotansiyelHaritası — Yönetim Paneli",
  description: "AI Destekli Personel Değerlendirme Platformu",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F6FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0D151D" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bz-root min-h-screen w-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
