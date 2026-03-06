# QR ile Öğrenci Yoklama Sistemi (QR-Yoklama)

Bu proje, "Gereksinimler Şartnamesi ve Ön Analiz Belgesi" ile "Ön Tasarım Belgesi" standartları temel alınarak geliştirilmiş kapsamlı ve hile korumalı bir yoklama sistemidir.

Proje mimarisi tamamen **gerçek zamanlı (real-time)** çalışacak şekilde Firebase Cloud Firestore altyapısı ile tasarlanmıştır.

## 📌 Sistem Bileşenleri

Sistem bağımsız olarak çalışan 3 ana klasörden oluşmaktadır:

1. **`backend/` (Node.js & Express API):** Uygulamanın kalbi. Firebase ile iletişim kurarak kullanıcı doğrulama (Auth), ders açma, oturum yönetme ve cihaz kimliği (Device ID) eşleştirme gibi tüm güvenli arka uç işlemlerini yürütür.
2. **`web-panel/` (React.js & Vite):** Yönetici ve Akademisyen Paneli. Akademisyenler bu panelden canlı, her 5 saniyede bir şifrelenerek yenilenen QR kodlu yoklama oturumları başlatabilir. Ayrıca anlık bildirim (FCM) göderebilirler.
3. **`mobile-app/` (Flutter):** Öğrenci mobil uygulaması. Cihazın kimliğini (Device_ID) okuyarak sahteciliği önler, kamerasıyla tahtadaki dinamik QR kodu tarayıp anında yoklamayı sisteme işler.

## Sistemi Çalıştırmak İçin Adımlar

Projeyi test etmek için bu 3 bileşenin kendi içinde çalıştırılması gerekir.

### 1. Arka Uç (Backend) API'si
Bu klasör, uygulamanın çalışması için **zorunludur**. Sistemin şifreleme, doğrulama, Device ID ve oturum mantığı buradadır.
```bash
cd backend
npm install
node server.js
```
*API Varsayılan olarak `http://localhost:5000` portunda çalışacaktır.*

### 2. Akademisyen Web Paneli
Firebase ile yetkilendirmesi sağlanmış React tabanlı kullanıcı arayüzü:
```bash
cd web-panel
npm install
npm run dev
```
*Tarayıcınız size genelde `http://localhost:5173` adresi üzerinden bir çıktı verecektir.*
**Giriş:** Firebase Console'unuzdan (`Authentication`) açtığınız bir e-mail ve parola ile akademisyen olarak panele girebilirsiniz.

### 3. Öğrenci Mobil Uygulaması (Flutter)
Öğrenci uygulamasını, bir Android Emulator, iOS Simulator ya da direk kendi fiziksel cihazınıza kablo bağlayarak kurabilirsiniz.
```bash
cd mobile-app
flutter pub get
flutter run
```
> **Not:** Emülatör üzerinde çalışırken localhost yönlendirmeleri için `/lib/main.dart` içerisindeki istek URL'leri `http://10.0.2.2:5000` (Android emulator standart makine ip'si) kullanacak şekilde ayarlanmıştır. Fiziki cihazdan WiFi üzerinden test yapmak isterseniz, `localhost` yerine masaüstü bilgisayarınızın `IPv4` adresini yazmanız gerekir (örn: `192.168.1.150:5000`).

## Güvenlik Altyapısı (Gerçeklenenler)
- **Device ID Bağlantısı:** API içerisinde `register_device` rotası mevcuttur ve `/scan` rotası üzerinde öğrenci cihaz doğrulaması arar (başkasının yerine yoklama verme problemini çözer).
- **QR Kriptografik Şifreleme/Zaman Kısıtlaması:** Yoklama başlatıldığında QR kod sabit değildir. API ve Web-Panel 5 saniyede bir konuşarak QR içindeki Hash'i (UUID) yeniler. Uzaktan fotoğraf yollayarak sisteme girilmesinin önü kapanır.
