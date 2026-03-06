# QR Yoklama - Akademisyen ve Yönetici Paneli

Bu dizin, Akademisyenlerin (Öğretmen) canlı yoklama başlattıkları ve Adminlerin kullanıcı/ders işlemlerini yönettikleri React.js (Vite) tabanlı arayüzdür.

## 🛠️ Kurulum ve Çalıştırma

ÖNEMLİ: Bu panelin düzgün çalışabilmesi için öncelikle `backend` klasöründeki Node.js sunucusunun (`localhost:5000`) açık olması gerekmektedir.

1. Bağımlılıkları yüklemek için bu klasörde (`web-panel`) terminal açın:
```bash
npm install
```

2. Geliştirici sunucusunu başlatın:
```bash
npm run dev
```

Terminal size arayüze erişebileceğiniz bir adres verecektir (Genellikle `http://localhost:5173`). O linke tıklayarak panele giriş yapabilirsiniz.

## Özellikler
- Firebase Authentication ile güvenli giriş.
- `react-qr-code` ile 5 saniyede bir şifrelenerek yenilenen dinamik Akademisyen QR ekranı.
- Firestore ile %100 senkronize Canlı Katılımcı Tablosu.
- Firebase Cloud Messaging (FCM) altyapısı ile anlık duyuru gönderme.
- `.xlsx` formatında Excel geçmiş yoklama raporları alabilme.
