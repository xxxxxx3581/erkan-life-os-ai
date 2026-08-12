# ERKAN LIFE OS — İnternete çıkarma

Bu paket iki kullanım içindir:

## A) Bilgisayarda test

1. Node.js 22 veya daha yeni bir sürüm kur.
2. Terminalde proje klasörüne gir.
3. `npm install`
4. `.env.example` dosyasını `.env` olarak kopyala.
5. `.env` içindeki `OPENAI_API_KEY` değerini kendi anahtarınla değiştir.
6. `npm start`
7. `http://localhost:3000` adresini aç.

## B) İnternette yayınlama

Paket içinde `render.yaml` hazır.

1. Bir Node.js hosting hesabında yeni servis oluştur.
2. Bu projeyi GitHub'a yükle veya ZIP'i açıp repository oluştur.
3. Servis olarak bu repository'yi seç.
4. Build: `npm install`
5. Start: `npm start`
6. Environment Variables bölümüne:
   - `OPENAI_API_KEY` = kendi API anahtarın
   - `OPENAI_MODEL` = `gpt-5`
7. Deploy.

Hosting sağlayıcısının verdiği HTTPS adresinden telefondan açabilirsin.

## Güvenlik

API anahtarını:
- HTML'e,
- JavaScript'e,
- GitHub repository'sine,
- ZIP'in içine

koyma.

Anahtar yalnızca hosting ortamındaki Environment Variables/Secret alanında tutulmalı.

Üretim aşamasında ayrıca kullanıcı hesabı, rate limit, kullanım/maliyet limiti, veri tabanı ve erişim kontrolü eklenmelidir.

## Ses

Metin → ses: `/api/speech`
Ses → metin: `/api/transcribe`

Tarayıcıdan mikrofon izni gerekir.

## Bir sonraki profesyonel aşama

- kullanıcı hesabı
- PostgreSQL/Supabase veritabanı
- kalıcı görev ve fikir hafızası
- gerçek zamanlı sesli konuşma
- web arama
- dosya/PDF analizi
- bildirimler
- PWA/Android paketleme
