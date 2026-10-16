# PotansiyelHaritası — Kurulum Kılavuzu

## Gereksinimler
- Node.js 20 LTS
- Docker Desktop (veya kendi PostgreSQL 16 sunucunuz)
- npm 10+

## Hızlı Başlangıç (tek komut)

Docker Desktop açıkken proje kökünde:

```bash
npm install
npm run local
```

`npm run local` önce `npm run setup` adımlarını çalıştırır, ardından üç uygulamayı başlatır:

1. `server/.env` yoksa `.env.example`'dan oluşturur ve JWT/şifreleme anahtarlarını rastgele üretir.
2. `DATABASE_URL`'deki PostgreSQL'e bağlanamazsa Docker ile başlatır (`localhost:4455`).
3. Migrasyonları uygular (veritabanı yoksa oluşturulur).
4. Veritabanında kullanıcı yoksa örnek verileri yükler.
5. 3000/3001/3002 portları doluysa uyarır.

Ardından tarayıcıda http://localhost:3000 (yönetim) ve http://localhost:3002 (portal) adreslerini açın.
Sonraki seferlerde `npm run dev` yeterlidir. Örnek verileri yeniden yüklemek için: `npm run setup -- --seed`.

Aşağıdaki adımlar, kurulumu elle yapmak isteyenler içindir.

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

SMS ile personel girişi (isteğe bağlı): `ILETIMERKEZI_API_KEY`, `ILETIMERKEZI_API_HASH`, `ILETIMERKEZI_SENDER` (İletimerkezi panelinde onaylı gönderici başlığı). Boş bırakılırsa SMS girişi kapalıdır; portal "SMS entegrasyonu bağlı değil" der, şifreyle giriş çalışmaya devam eder.

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

## Sorun Giderme: "Bağlanamıyorum"

| Belirti | Neden / Çözüm |
|---|---|
| Tarayıcı `localhost:3000` için "bağlantı reddedildi" diyor | Uygulamalar çalışmıyor. Proje kökünde `npm run dev` (ilk kez ise `npm run local`) çalıştırıp terminalde `Ready` ve `API sunucusu ... çalışıyor` satırlarını bekleyin. Uygulamalar yalnızca komutun çalıştığı bilgisayarda `localhost` üzerinden açılır. |
| Giriş ekranı açılıyor ama "Sunucuya ulaşılamıyor" / giriş olmuyor | API (3001) çalışmıyor veya çöktü. Terminalde `[api]` satırlarındaki hatayı kontrol edin; http://localhost:3001/health `ok` dönmeli. |
| `[api]` loglarında `Can't reach database server` (P1001) | PostgreSQL kapalı. Docker Desktop'ı açıp `npm run setup` çalıştırın. |
| `Authentication failed` (P1000) | `DATABASE_URL` şifresi yanlış (`*` → `%2A`). Docker volume eski şifreyle oluşturulduysa `docker compose down -v` (veriler silinir) ve `npm run setup`. |
| `EADDRINUSE` / port kullanımda uyarısı | 3000, 3001 veya 3002'yi başka bir program kullanıyor; kapatıp tekrar başlatın. |
| Başka bir bilgisayardan / telefondan erişim | `localhost` yalnızca o makineyi gösterir. Makinenin IP adresini kullanın ve `apps/web/.env.local` + `apps/portal/.env.local` içinde `NEXT_PUBLIC_API_URL=http://<IP>:3001`, `server/.env` içinde `CORS_ORIGINS`'e `http://<IP>:3000,http://<IP>:3002` ekleyin. |

## Temel Akış

1. **Personel** oluştururken cep telefonunu girin: SMS bağlıysa aktif değerlendirmeye atanan personel portala sicil numarası + SMS'le gelen 6 haneli kodla şifresiz girer (kod 5 dk geçerli, tek kullanımlık). İsterseniz "Portal Şifresi" de belirleyin (veya personel detayında *Portal Şifresi Belirle*); şifreyle giriş ikinci yöntem olarak durur. Ne telefonu ne şifresi olan personel portala giremez. SMS bağlantı durumu: *Ayarlar → SMS ile personel girişi*.
2. **Değerlendirme** oluşturun, *Aktifleştir* ve personele *ata*. Portal yalnızca **aktif** ve tarih aralığındaki değerlendirmeleri gösterir.
3. Personel portalda KVKK onayıyla testi başlatır; cevaplar her soruda sunucuya kaydedilir, yarıda kalan test kaldığı yerden devam eder.
4. Test tamamlanınca skala sorularından boyut skorları hesaplanır; aktif bir AI yapılandırması ve personelin AI rızası varsa HR PDR analizi arka planda çalışır. AI'ın önerdiği boyut skorları **yalnızca İK analizi onayladığında** skorlara yansır (reddedilirse veya analiz yeniden çalıştırılırsa skala skorlarına dönülür).
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
