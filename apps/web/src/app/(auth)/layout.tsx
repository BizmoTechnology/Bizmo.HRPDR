// Giriş ekranları: aurora zemin (DESIGN.md §4.5) — bulut zemin üstünde solda yeşil, sağda mavi çok hafif ışıma; koyu temada da çalışır
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bz-aurora min-h-dvh w-full">{children}</div>;
}
