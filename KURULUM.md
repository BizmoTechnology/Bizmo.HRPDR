# PotansiyelHaritası — Kurulum Kılavuzu

## Gereksinimler
- Node.js 20 LTS
- Docker Desktop
- npm 10+

## 1. Bağımlılıkları Kur

```bash
# Kök dizinde
npm install
```

## 2. Ortam Değişkenlerini Hazırla

```bash
cp .env.example .env
```

`.env` dosyasını açıp şu alanları doldurun:
- `JWT_SECRET` ve `JWT_REFRESH_SECRET` → en az 64 karakter
- `ENCRYPTION_KEY` → tam 64 hex karakter (32 byte)

Geliştirme için hızlı değer üretme:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. PostgreSQL (varsayılan: Docker, port 4455)

Yerel Docker ile gelen varsayılan bağlantı:

`postgresql://postgres:Bizmo.2025%2A@localhost:4455/Bizmo.HRPDR`

*(Şifredeki `*` karakteri URL içinde `%2A` olarak yazılır.)*

```bash
npm run docker:dev
```

İlk kez kendi PostgreSQL sunucunuzda veritabanı oluşturuyorsanız (sunucu zaten çalışıyorsa):

```powershell
$env:PGPASSWORD = 'Bizmo.2025*'
psql -h localhost -p 4455 -U postgres -d postgres -c 'CREATE DATABASE "Bizmo.HRPDR";'
```

## 4. Prisma şemasını veritabanına uygula

İlk kurulumda migrasyon klasörü yoksa `db push` kullanın; sonra `migrate dev` ile kalıcı migrasyon üretebilirsiniz.

```bash
cd server
npx prisma generate
npx prisma db push
```

## 5. Örnek Verileri Ekle (Seed)

```bash
npx prisma db seed
```

Demo hesaplar:
| Tür | Kullanıcı | Şifre |
|-----|-----------|-------|
| Admin | admin@example.com | Admin1234! |
| İK Yöneticisi | hr@example.com | Hr1234567! |
| Personel (P001–P005) | Sicil: P001 | Portal123! |

## 6. Tüm Uygulamaları Başlat

```bash
# Kök dizinde
npm run dev
```

- API:    http://localhost:3001
- Admin:  http://localhost:3000
- Portal: http://localhost:3002
- API Docs: http://localhost:3001/api/docs

## Klasör Yapısı

```
potansiyel-haritasi/
├── apps/
│   ├── web/        → Admin Paneli (port 3000)
│   └── portal/     → Personel Test Portalı (port 3002)
├── packages/
│   ├── shared/     → Paylaşımlı tipler + Zod şemaları
│   ├── theme/      → @bizmo/theme kopyası (Bizmo Universal Theme — elle düzenlenmez)
│   └── ui/         → Paylaşımlı UI bileşenleri + Tailwind preset (Design.md)
├── server/         → Fastify API (port 3001)
│   └── prisma/     → Schema + migrations + seed
├── docker-compose.yml
└── .env.example
```

## Tasarım Sistemi

Arayüz **Bizmo Universal Theme** (`@bizmo/theme`) ile çizilir; ayrıntılar için [Design.md](./Design.md) ve
[packages/theme/DESIGN.md](./packages/theme/DESIGN.md).

- Token'lar ve `bz-*` bileşen sınıfları: `packages/theme` (kopya; tema deposundan `npm run theme:sync` ile yenilenir)
- Tailwind adları Bizmo token'larına eşlenir: `packages/ui/tailwind.preset.cjs`
- Birincil renk: Bizmo yeşili `#6DB92C` (üstünde lacivert yazı), veri mavisi `#00A7E1`, sayfa zemini bulut `#F3F6FA`
- Yazı aileleri: Inter (arayüz) + Manrope (başlık), `next/font` ile kendi sunucumuzdan
- Koyu tema: `<html data-theme="dark">`, tercih `localStorage["bz-theme"]`
