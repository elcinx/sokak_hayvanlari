# Sokak Hayvanları Besleme ve Takip – V1/V2

## Kurulum
1. Node 18+ ve MySQL hazır olmalı.
2. `model/data.js` içindeki veritabanı bilgilerini düzenle (host/user/password/db).
3. Bağımlılıklar:
   ```bash
   npm install
   ```
4. Sunucuyu başlat:
   ```bash
   npm start
   ```
   İlk çalıştırmada migrate tabloları oluşturur.

## .env Örneği
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=pass
DB_NAME=anouncment
SESSION_SECRET=supersecret
BASE_URL=http://localhost:3000
NODE_ENV=development
UPLOAD_DIR=public/uploads
STORAGE_DRIVER=local
CORS_ALLOWLIST=
# Seed (yalnızca development için, prod'da **kapalı** bırakın)
SEED_ENABLED=true
# Cloudinary (opsiyonel, STORAGE_DRIVER=cloudinary iken zorunlu)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

## Endpointler (V1)
- Sayfalar:
  - `/` ana sayfa (harita, sayaçlar, duyuru özet, mini galeri)
  - `/announcements` liste
  - `/announcements/:slug` duyuru detay
  - `/gallery` / `/gallery/:slug` galeri
  - `/admin` duyuru yönetimi (rol: admin/koordinator)
- API:
  - `GET /api/feeds` (son 30 gün feed logları; lat/lng, foto, kullanıcı)
  - `POST /api/feeds` (auth) form-data: `photo` (opsiyonel), `lat`, `lng`, `note`
  - `GET /api/gallery` (son 50 foto)
  - `GET /api/metrics/summary` (totalFeeds, activePoints, todayFeeds, online)
  - `GET /api/metrics/online`
  - `GET /sitemap.xml`

## Endpointler (V2 Sprint-1: Puanlama/Leaderboard/Rozet)
- Puanlama & rozet:
  - `POST /api/feeds` (auth) feed başına +10 puan, rozet kontrolü
  - `GET /api/me/points` (auth) toplam + son 20 hareket
  - `GET /api/me/badges` (auth)
  - `GET /admin/badges` (rozet listesi)
- Leaderboard:
  - `GET /api/leaderboard/weekly` (son 7 gün, top 10)
  - `GET /api/leaderboard/monthly` (içinde bulunulan ay, top 10)
- Ana sayfa küçük liste: haftalık top 5.

## Endpointler (V2 Sprint-2: Yorum/Beğeni)
- Yorum/like:
  - `POST /api/feeds/:id/comments` (auth) içerik 3-500 karakter
  - `GET /api/feeds/:id/comments` (public, limit/offset)
  - `POST /api/feeds/:id/like` (auth, toggle)
  - `GET /api/feeds/:id/likes` (public, count + likedByMe)
- Feed detay sayfası: `/feeds/:id` (foto, not, yorum listesi, yorum formu)
- Harita popup: yorum/beğeni sayıları + detay link

## Endpointler (V2 Sprint-3: Harita gelişmiş)
- Heatmap & özet:
  - `GET /api/feeds/heatmap?days=30` (lat,lng,count; 3 decimal gruplanmış)
  - `GET /api/feeds/points-summary?days=30` (status: critical/new/steady/normal)
- Favoriler:
  - `POST /api/favorites` (auth, lat/lng)
  - `DELETE /api/favorites` (auth, lat/lng)
  - `GET /api/favorites` (auth)
- Harita: status filtreleri, heatmap toggle, favori butonu.

## Admin Sayfaları (Dashboard & Moderasyon)
- `/admin/dashboard`: toplam/bugün besleme, aktif nokta, online; haftalık top5; son 10 feed listesi.
- `/admin/feeds`: feed listesi (sayfalı), detay ve silme linkleri.
- `/admin/comments`: son 50 yorum, soft delete.
- `/admin/badges`: rozetler, kullanıcı sayısı, son kazananlar.
- `/admin` (duyurular), `/admin/gallery` (galeri yönetimi).

## Test Yönergesi (kısa)
1. Sunucuyu başlat: `npm start`
2. Feed oluştur (auth gerekli): form-data `photo` (ops.), `lat`, `lng`, `note` ile `POST /api/feeds`
3. Yorum ekle: `POST /api/feeds/:id/comments` body `content`
4. Beğeni toggle: `POST /api/feeds/:id/like`
5. Leaderboard/puan/rozet: `GET /api/leaderboard/weekly`, `GET /api/me/points`, `GET /api/me/badges`
6. Harita: `/` sayfasını aç, marker popup’ında yorum/beğeni sayılarını, favori butonunu, heatmap toggle ve status filtrelerini kontrol et.
7. Feed detay: `/feeds/:id` yorum ekleme formunu dene.
8. Admin: `/admin/dashboard`, `/admin/feeds`, `/admin/comments`, `/admin/badges`’i aç ve tabloları kontrol et.
9. Smoke test: `npm run smoke` (public GET’ler için temel kontrol)

### Stabilizasyon Kontrolleri
- Rate limit: `/api/feeds` (kullanıcı başına 1 dakikada max 3), `/api/feeds/:id/comments` (1 dakikada 5), `/api/feeds/:id/like` (10 sn’de 10). Aşıldığında 429 dönmeli.
- Validation: lat -90..90, lng -180..180; note <=300, comment 3-500; upload 5MB ve image mime.
- Dosya temizliği: `/admin/feeds/delete/:id` çağrıldığında varsa upload dosyası silinir.
- Log formatı: `[ISO] [context] user=<id> route=<url> error=<msg>`

## Features (kısa)
- Harita (Leaflet) + heatmap + nokta statü filtreleri, favorilere ekleme
- Besleme kayıtları (foto, konum, not), yorum/beğeni, galeri
- Puanlama, rozetler, leaderboard (haftalık/aylık)
- Admin panel: duyuru, feed, yorum moderasyonu, rozet görünümü, dashboard
- Güvenlik: CSRF (formlar), rate limit, role-based auth, helmet + CORS

## Architecture Overview
- Express + EJS + MySQL (mysql2)
- Katmanlar: controller / router / middleware / services (storage, badges, points)
- Storage sürücü: local veya Cloudinary (feature flag)
- Realtime: Socket.IO (online kullanıcı sayısı)
- Migrate + dev seed: `model/migrate.js`, `seed/devSeed.js` (yalnızca development)

## Deploy (Render/Railway örnekleri)
- Ortam değişkenleri:
  - `PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `SESSION_SECRET`, `BASE_URL`, `NODE_ENV`, `UPLOAD_DIR`, (ops: `CORS_ALLOWLIST`)
  - `STORAGE_DRIVER=local|cloudinary`, cloudinary için `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- MySQL provisioning: Render/Railway üzerinde MySQL instance oluştur, connection bilgilerini env’e yaz.
- Uploads: Lokal dosya sistemi kalıcı olmayabilir; prod için S3/Cloudinary önerilir. `UPLOAD_DIR` kalıcı bir mount değilse dosyalar silinebilir.
- BASE_URL: dış URL’nizi girin; cookie secure ayarı için `NODE_ENV=production` yapıldığında session cookie `secure` olur.
- CORS: prod’da allowlist kullanın (`CORS_ALLOWLIST=https://senin-domainin.com`), dev’de serbesttir.
- Cloudinary: `STORAGE_DRIVER=cloudinary` ve Cloudinary env’lerini set ederek prod’da kalıcı medya kullanın. Yerelde `STORAGE_DRIVER=local` kalsın.
- Uploads kalıcılığı: Lokal filesystem ephemeral olabilir; kalıcı için S3/Cloudinary önerilir.

## Deploy checklist
- [ ] .env dolduruldu (PORT, DB_*, SESSION_SECRET, BASE_URL, NODE_ENV, UPLOAD_DIR, CORS_ALLOWLIST)
- [ ] STORAGE_DRIVER seçildi; cloudinary kullanılacaksa CLOUDINARY_* set edildi
- [ ] MySQL bağlantısı test edildi (/health OK)
- [ ] Upload dizini kalıcı depolama veya bulut hizmetine yönlendirildi
- [ ] `npm run smoke` lokal/staging’de yeşil
- [ ] Admin sayfaları açılıyor (dashboard/feeds/comments/badges)

## Demo (development)
- Girişler: `admin@test.com / 123456`, `koord@test.com / 123456`
- Dev ortamında `/demo` sayfası hızlı tur linkleri gösterir. Prod’da kapalıdır.

## Release ready checklist
- **Prod'da seed kapalı olmalı (SEED_ENABLED=false).**
- [ ] Production .env tamam (BASE_URL prod domaini, NODE_ENV=production, cookie secure aktif)
- [ ] STORAGE_DRIVER seçildi; prod medya stratejisi net (Cloudinary/S3)
- [ ] DB migration/seed prod’da çalıştırılmadı (seed sadece development)
- [ ] Healthcheck (/health) ve smoke test geçti
- [ ] Admin kullanıcıları ve rolleri doğrulandı
- [ ] Log toplama/izleme (stdout) ve rate limit yanıtları kontrol edildi

## V1 Done Checklist
- [x] Auth + rol (admin/koordinator/kullanici) ve CSRF korumaları
- [x] Duyuru modülü (slug, kategori, publish_at, aktif/pasif) + admin paneli
- [x] Feed log API (foto yükleme, koordinat, note, puan)
- [x] Harita (Leaflet) üzerinde feed marker’ları, popup’ta foto/ kullanıcı/ tarih/ not
- [x] Galeri (feed fotoğraflarından) ve duyuru sayfaları
- [x] Sayaçlar: toplam/bugün besleme, aktif nokta, online kullanıcı
- [x] Dinamik sitemap (duyuru slug’ları + statik sayfalar)
