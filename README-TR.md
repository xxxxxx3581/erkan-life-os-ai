# ERKAN LIFE OS V2 — Gerçek AI

Bu paket, ERKAN LIFE OS'un güvenli mimariye sahip AI prototipidir.

## İçindekiler

- `public/index.html` — mobil arayüz
- `server.mjs` — güvenli backend
- `.env.example` — API anahtarı şablonu
- `package.json` — gerekli paketler

## Önemli

API anahtarını `index.html` içine yazma. Anahtar yalnızca sunucudaki `.env` dosyasında bulunmalı.

## Bilgisayarda çalıştırma

1. Node.js kur.
2. Bu klasörü aç.
3. Terminalde:
   `npm install`
4. `.env.example` dosyasının kopyasını `.env` adıyla oluştur.
5. `.env` içine kendi OpenAI API anahtarını yaz:
   `OPENAI_API_KEY=...`
6. Terminal:
   `npm start`
7. Tarayıcıdan:
   `http://localhost:3000`

## Telefonda

Acode tek başına backend çalıştırmaz. Telefon üzerinden geliştirme yapmak mümkün, fakat gerçek AI bağlantısı için bu Node sunucusunun internete açık bir sunucuda çalışması gerekir. Örneğin bir Node.js hosting/VPS üzerinde deploy edilebilir. Sonra `public/index.html` içindeki API adresleri o sunucunun adresine yönlendirilir.

## Ses

- Mikrofon: `/api/transcribe`
- AI sesi: `/api/speech`
- Metin AI: `/api/chat`

Ses özellikleri için tarayıcının mikrofon izni gerekir.

## Güvenlik

Üretimde mutlaka HTTPS, kimlik doğrulama, rate limit, kullanıcı bazlı veri izolasyonu ve maliyet limitleri eklenmelidir.
