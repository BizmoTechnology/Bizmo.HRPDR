# Bizmo.ID ile Giriş

PotansiyelHaritası (Bizmo.HRPDR), şirketin ortak kimlik sistemi **Bizmo.ID**'ye (Keycloak 26, OIDC) bağlanabilir.
Genel sözleşme: `bizmo.identity/docs/INTEGRATION_GUIDE.md`; referans uygulama bizmo.mail.

Bizmo.ID yerel girişi kaldırmaz. Kullanıcı Bizmo.ID'de doğrulanır (şifre, OTP, passkey Bizmo.ID'de yapılır),
HRPDR kendi oturumunu (15 dk access token + httpOnly refresh çerezi) üretir. **Rol ve yetki HRPDR'de kalır.**

## Modlar

| `AUTH_MODE` | Yönetim paneli girişi |
|---|---|
| `local` (varsayılan) | Yalnız e-posta/şifre. Bizmo.ID uçları kapalı. |
| `hybrid` | "Bizmo.ID ile giriş" düğmesi + e-posta/şifre. |
| `central` | Yalnız Bizmo.ID. Şifreli giriş yalnız `SUPER_ADMIN` içindir ("Yönetici girişi (acil durum)"). Rol, şifre doğrulandıktan **sonra** denetlenir. |

Mod `hybrid`/`central` iken zorunlu değerlerden biri eksikse API açılır, log'a eksikler yazılır, giriş ekranı
**"Bizmo.ID bağlı değil"** gösterir ve şifreli giriş herkese açık kalır (kimse dışarıda kalmaz). Bizmo.ID'ye
ulaşılamıyorsa düğme pasif olur ve "Bizmo.ID'ye şu anda ulaşılamıyor" yazar.

Personel portalında Bizmo.ID girişi `BIZMO_ID_PORTAL=true` ile ayrıca açılır; sicil + şifre (ve SMS) girişi her
zaman yanında kalır. Portal girişinde Bizmo.ID **her seferinde şifre sorar** (`prompt=login`, `max_age=0`):
ortak cihazda (kiosk) önceki kişinin Bizmo.ID oturumuyla girilemez. Portaldan çıkışta Bizmo.ID oturumu da kapanır.

## Yapılandırma (`server/.env`)

```env
AUTH_MODE=hybrid
BIZMO_ID_ISSUER=https://id.bizmo.com.tr/realms/bizmo   # discovery'deki issuer ile birebir aynı
BIZMO_ID_CLIENT_ID=bizmo-hrpdr
BIZMO_ID_CLIENT_SECRET=...        # Bizmo.ID paneli → Uygulamalar → Sırları göster
BIZMO_ID_WEBHOOK_SECRET=whsec_... # aynı yerden
BIZMO_ID_SCIM_TOKEN=...           # rastgele üretin, panelde Veri ve SCIM'e de girin; boşsa SCIM kapalı
BIZMO_ID_ORG_SLUG=default         # Bizmo.ID kullanıcılarının bağlanacağı kurum (Organization.slug)
BIZMO_ID_PORTAL=false
API_PUBLIC_URL=https://hrpdr-api.example   # callback bu adresle kurulur
APP_URL=https://hrpdr.example
PORTAL_URL=https://portal.hrpdr.example
```

Sırlar yalnız `server/.env`'de durur (git'e girmez); hiçbir uç ve log sır yazmaz. `BIZMO_ID_ALLOW_HTTP=true`
yalnız yerel http Keycloak içindir, `NODE_ENV=production`'da yapılandırma hatası sayılır.

## Bizmo.ID paneline kayıt

Panel → **Uygulamalar → Uygulama ekle**:

| Alan | Değer |
|---|---|
| Client ID | `bizmo-hrpdr` |
| Uygulama adresi | `APP_URL` |
| Callback | `API_PUBLIC_URL/api/auth/bizmo-id/callback` |
| Webhook | `API_PUBLIC_URL/api/auth/bizmo-id/webhook` |
| Back-channel logout | `API_PUBLIC_URL/api/auth/bizmo-id/backchannel-logout` |
| Valid post logout redirect URIs | `APP_URL/login` ve (portal açıksa) `PORTAL_URL/login` |
| Veri kapsamları | `profile`, `email`; portal sicil eşlemesi için `bizmo.org`. `bizmo.groups` **açılmamalı** (Groups desteklenmez). |
| SCIM | Taban adres `API_PUBLIC_URL/scim/v2`, Bearer token = `BIZMO_ID_SCIM_TOKEN` |

Erişim: kişiye veya gruba `bizmo-hrpdr` istemcisinin `access` rolü verilir. Erişimi olmayan kişi Bizmo.ID'de
durdurulur; HRPDR ayrıca `resource_access.bizmo-hrpdr.roles` içinde `access`'i denetler.

## Uçlar

| Uç | Açıklama |
|---|---|
| `GET /api/auth/mode` | `{ mode, localLogin, bizmoId: { enabled, configured, available, portal } }` — giriş ekranları okur |
| `GET /api/auth/bizmo-id/login?app=admin\|portal&returnTo=&rememberMe=` | State, nonce, PKCE (S256) üretir; Bizmo.ID'ye yönlendirir |
| `GET /api/auth/bizmo-id/callback` | Kod → token (client_secret_basic + code_verifier) → id_token doğrulama → eşleme → uygulamaya devir |
| `POST /api/auth/bizmo-id/exchange` | Devir kodu → HRPDR oturumu (yönetici: refresh çerezi + access token; portal: token çifti) |
| `POST /api/auth/bizmo-id/logout` | Bizmo.ID çıkış adresi (`end_session_endpoint`, `id_token_hint` ile) |
| `POST /api/auth/bizmo-id/webhook` | HMAC imzalı Bizmo.ID olayları |
| `POST /api/auth/bizmo-id/backchannel-logout` | Keycloak `logout_token` → kişinin tüm HRPDR oturumları kapanır |
| `/scim/v2/Users` | SCIM 2.0 (GET, POST, PUT, PATCH, DELETE; `attr eq "değer"` filtresi) |

## Güvenlik

- **PKCE S256 + state + nonce.** State, tarayıcı bağlama değeri ve devir kodu veritabanında yalnız SHA-256
  özetiyle (`SsoLoginFlow`) tutulur. State 10 dk, devir kodu 60 sn geçerli ve tek kullanımlıktır.
- **Tarayıcı bağlama.** Akış başlarken httpOnly `ph_sso_bind` çerezi (SameSite=Lax) verilir; callback ve devir
  yalnız aynı tarayıcıda tamamlanır (giriş CSRF'si, sızan callback adresi).
- **Token doğrulama.** id_token JWKS ile doğrulanır: yalnız asimetrik algoritmalar (discovery HS256 de listeler,
  kabul edilmez), `iss` = issuer, `aud` = client ID, çoklu aud'da `azp`, `nonce`, süre. Discovery'deki issuer
  yapılandırmayla birebir aynı, uç noktalar issuer ile aynı kökte olmalı. Callback'te `iss` parametresi gelirse
  (RFC 9207) issuer ile karşılaştırılır.
- **Açık yönlendirme yok.** `returnTo` yalnız uygulama içi mutlak yol olabilir; giriş sonrası adresler
  `APP_URL`/`PORTAL_URL`'den kurulur. Devir kodu adres parçasında (`#code=`) taşınır: sunucu loglarına ve
  Referer'a düşmez.
- **Çıkış.** `POST` + JSON (başka siteden tetiklenemez). id_token yalnız httpOnly, SameSite=Strict çerezde durur.
- Bizmo.ID ile girişte HRPDR'nin kendi MFA'sı sorulmaz; `acr`/`amr` giriş log'una yazılır.

## Kullanıcı eşleme

**Yönetim paneli (`User`):**
1. `externalId = sub` olan kullanıcı varsa odur (pasif/silinmişse `ACCOUNT_DISABLED`; başka kurumdaysa `ACCOUNT_CONFLICT`).
2. Yoksa `BIZMO_ID_ORG_SLUG` kurumunda aynı e-posta; yalnız `email_verified === true` iken bağlanır
   (`externalId`, `externalProvider = "bizmo-id"`). Başka bir sub'a bağlı hesap devralınmaz.
3. Hesap yoksa `NO_ACCOUNT` (otomatik hesap açılmaz; hesabı ve rolü HRPDR yöneticisi açar).

Her girişte bağlı hesabın adı (ve kurumda çakışmıyorsa e-postası) Bizmo.ID'deki değerle güncellenir.

**Personel portalı (`Personnel`):** `externalId` → yoksa `org.employee_number` (bizmo.org kapsamı) = sicil
ve/veya doğrulanmış e-posta. İkisi farklı personeli gösterirse reddedilir. Personelin İK verisi (ad, durum,
işten ayrılış) Bizmo.ID'den yazılmaz.

## Olaylar (webhook ve SCIM)

| Olay | Etki |
|---|---|
| `user.disabled`, `user.deleted`, `person.terminated` | Bağlı (ya da henüz bağlanmamış aynı e-postalı) yönetici hesabı pasiflenir, oturumları kapanır; bağlı personelin portal oturumları kapanır |
| `access.revoked` | Bağlı yönetici hesabı pasiflenir, oturumlar kapanır |
| `person.leave_started` | Hesap korunur, tüm oturumlar kapanır |
| `user.enabled`, `access.granted`, `person.leave_ended` | **Yalnız Bizmo.ID'nin pasiflediği** (`externalDisabledAt`) bağlı hesap yeniden açılır; HRPDR'de elle pasiflenen hesaba dokunulmaz, e-postayla eşleme yapılmaz |
| `user.updated` | Bağlı yöneticinin adı ve (çakışmıyorsa) e-postası güncellenir |
| `roles.changed`, `person.moved`, `group.*`, `orgunit.*`, `policy.*`, bilinmeyen tipler | 200 + `ignored` (rol HRPDR'de yönetilir) |

İmza: `X-Bizmo-Signature: sha256=hex(HMAC_SHA256(secret, "<timestamp>.<ham gövde>"))`, zaman damgası ±300 sn.
İmza hatası 401; işlenen ya da yok sayılan olay 200. İşleyiciler idempotenttir.

**SCIM:** Bizmo.ID'nin gönderdiği kişiler `BizmoIdIdentity` tablosunda tutulur (HRPDR hesap açmaz). Kişi
kurumdaki aynı e-postalı yöneticiye ve aynı sicil/e-postalı personele bağlanır; `active: false` ve `DELETE`
bağlı yönetici hesabını pasifler ve oturumları kapatır, `active: true` Bizmo.ID'nin pasiflediği hesabı açar.

## Sınırlamalar ve sonraki adımlar

- Back-channel logout ve olaylar refresh token'ları siler; mevcut access token en çok 15 dk daha geçerlidir
  (her istekte hesabın etkin olduğu ayrıca denetlenir, pasiflenen hesap anında düşer).
- Oturum politikası (Bizmo.ID'den ekran kilidi / boşta kalma süresi, INTEGRATION_GUIDE §6.5) henüz uygulanmadı.
- Rol manifesti (`bizmo-roles.json`) ve Bizmo.ID'den rol ataması (§6.6) bilinçli olarak yok: roller HRPDR'de.
- Bizmo.ID'ye bağlı hesapta şifreli giriş (hybrid modda) açık kalır; hesabın yerel şifresi ayrı bir kimlik
  bilgisidir.

## Test

```bash
npm test -w server          # OIDC doğrulama, webhook imzası, SCIM, açık yönlendirme
```

Webhook'u Bizmo.ID paneli → Uygulamalar → Bizmo.HRPDR → **Webhook testi** ile deneyin (API'nin Bizmo.ID
sunucusundan erişilebilir olması gerekir; localhost'a webhook gelmez).
