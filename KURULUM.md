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
cp .env.example server/.env
```

> Prisma CLI ve API `server/.env` dosyasını okur (API ek olarak kökteki `.env` dosyasına da bakar).

`server/.env` dosyasını açıp şu alanları doldurun:
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

Migrasyon geçmişi `server/prisma/migrations` altında tam olarak tutulur (başlangıç şeması `20250101000000_init`).

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

**Daha önce `prisma db push` ile oluşturulmuş bir veritabanınız varsa** mevcut şemayı yeniden oluşturmaya çalışmaması için eski migrasyonları uygulanmış olarak işaretleyin, ardından yenileri uygulayın:

```bash
npx prisma migrate resolve --applied 20250101000000_init
npx prisma migrate resolve --applied 20250420120000_ai_chat_conversations
npx prisma migrate resolve --applied 20260219120000_assessment_session_optional_columns
npx prisma migrate deploy
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

> `npm install` ve `npm run dev` paylaşılan `@ph/shared` paketini otomatik derler.

## Temel Akış

1. **Personel** oluştururken "Portal Şifresi" belirleyin (veya personel detayında *Portal Şifresi Belirle*). Şifresi olmayan personel portala giremez.
2. **Değerlendirme** oluşturun, *Aktifleştir* ve personele *ata*. Portal yalnızca **aktif** ve tarih aralığındaki değerlendirmeleri gösterir.
3. Personel portalda KVKK onayıyla testi başlatır; cevaplar her soruda sunucuya kaydedilir, yarıda kalan test kaldığı yerden devam eder.
4. Test tamamlanınca skala sorularından boyut skorları hesaplanır; aktif bir AI yapılandırması ve personelin AI rızası varsa HR PDR analizi arka planda çalışır ve boyut skorları güncellenir.
5. Oturum detayında İK analizi **onaylar**, ardından **Rapor oluştur** ile rapor üretilir (Raporlar sayfasından yazdırma/PDF ve Excel indirme).

## Roller

| İşlem | SUPER_ADMIN | ADMIN | HR_MANAGER | ANALYST | VIEWER |
|---|:-:|:-:|:-:|:-:|:-:|
| Personel / soru / soru seti / değerlendirme yazma | ✓ | ✓ | ✓ | ✗ | ✗ |
| AI analizi, İK onayı, rapor | ✓ | ✓ | ✓ | ✓ | ✗ |
| AI yapılandırması | ✓ | ✓ | ✗ | ✗ | ✗ |

## Klasör Yapısı

```
potansiyel-haritasi/
├── apps/
│   ├── web/        → Admin Paneli (port 3000)
│   └── portal/     → Personel Test Portalı (port 3002)
├── packages/
│   ├── shared/     → Paylaşımlı tipler + Zod şemaları
│   └── ui/         → Paylaşımlı UI bileşenleri (Design.md)
├── server/         → Fastify API (port 3001)
│   └── prisma/     → Schema + migrations + seed
├── docker-compose.yml
└── .env.example
```

## Tasarım Sistemi

- Renk paleti: Design.md'de tanımlı HSL token sistemi
- Glassmorphism: `glass-surface` ve `glass-surface-static` sınıfları
- Birincil renk: Zümrüt yeşili `hsl(153 60% 43%)`
- Font: Inter (Google Fonts)
- Dark mode: `classList.toggle("dark")`
