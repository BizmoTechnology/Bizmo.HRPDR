/**
 * Güvenlik başlıkları: başka sitede iframe ile gömülme (clickjacking), MIME
 * tahmini ve sıfırlama token'ını taşıyan URL'nin Referer ile sızması engellenir.
 * Tam CSP (inline tema betiği için nonce gerektirir) ayrı iş olarak bırakıldı.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // next/image kullanılmıyor: görsel optimizasyon uç noktası (bilinen DoS/RCE açıkları) kapalı
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  transpilePackages: ["@ph/ui", "@ph/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
