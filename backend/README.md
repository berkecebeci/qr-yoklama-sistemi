# QR Yoklama - Backend Sunucusu

Bu dizin, projenin veritabanı işlemlerini, şifreleme algoritmalarını ve kullanıcı yetkilendirmelerini yöneten Node.js sunucusudur. 

## 🛠️ Kurulum ve Çalıştırma

1. Projeyi sisteminize indirdikten sonra, bağımlılıkları yüklemek için bu klasörde (`backend`) terminal açın:
```bash
npm install
```

2. Sunucuyu yerel bilgisayarınızda başlatın:
```bash
npm start
# veya
node server.js
```
*Sunucu varsayılan olarak `http://localhost:5000` portundan hizmet vermeye başlayacaktır.*

## Firebase Bağlantısı (Önemli)
Bu proje canlı veritabanı olarak Firebase (Cloud Firestore) kullanmaktadır. Projenin sizin bilgisayarınızda çalışması için Firebase projenize ait `serviceAccountKey.json` ve `.env` dosyalarının doğru yapılandırılmış olması gerekir. (Güvenlik gereği GitHub'da paylaşılmamıştır).
