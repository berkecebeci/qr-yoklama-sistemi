# QR ile Öğrenci Yoklama Sistemi (QR-Yoklama)

Bu proje, "Gereksinimler Şartnamesi ve Ön Analiz Belgesi" ile "Ön Tasarım Belgesi" standartları temel alınarak geliştirilmiş kapsamlı ve hile korumalı bir yoklama sistemidir.

Proje mimarisi tamamen **gerçek zamanlı (real-time)** çalışacak şekilde Firebase Cloud Firestore altyapısı ile tasarlanmıştır.

## 📌 Sistem Bileşenleri

Sistem bağımsız olarak çalışan 3 ana klasörden oluşmaktadır:

1. **`backend/` (Node.js & Express API):** Uygulamanın kalbi. Firebase ile iletişim kurarak kullanıcı doğrulama (Auth), ders açma, oturum yönetme ve cihaz kimliği (Device ID) eşleştirme gibi tüm güvenli arka uç işlemlerini yürütür.
2. **`web-panel/` (React.js & Vite):** Yönetici ve Akademisyen Paneli. Akademisyenler bu panelden canlı, her 5 saniyede bir şifrelenerek yenilenen QR kodlu yoklama oturumları başlatabilir. Ayrıca anlık bildirim (FCM) göderebilirler.
3. **`mobile-app/` (Flutter):** Öğrenci mobil uygulaması. Cihazın kimliğini (Device_ID) okuyarak sahteciliği önler, kamerasıyla tahtadaki dinamik QR kodu tarayıp anında yoklamayı sisteme işler.

## 🚀 Arkadaşlar / Katılımcılar İçin Hızlı Kurulum Rehberi

Projeyi GitHub'dan klonlayan bir arkadaşınızın projeyi çalıştırabilmesi için kendi Firebase projesini oluşturması ve gerekli anahtarları yerleştirmesi gerekmektedir. Güvenlik nedeniyle bu anahtarlar repoda paylaşılmaz.

### 1. Firebase Projesi Oluşturma
- [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun.
- **Authentication:** E-posta/Şifre giriş yöntemini aktif edin.
- **Firestore Database:** Veritabanını "Test modunda" başlatın.

### 2. Gerekli Dosyaların Yerleştirilmesi

#### A. Arka Uç (Backend)
- `backend/` klasörü içinde yeni bir dosya oluşturun ve adını `serviceAccountKey.json` yapın.
- Firebase Console -> Proje Ayarları -> Hizmet Hesapları -> **Yeni Özel Anahtar Oluştur** diyerek indirdiğiniz JSON içeriğini bu dosyaya yapıştırın.
- `.env.example` dosyasını `.env` olarak kopyalayın.

#### B. Akademisyen Web Paneli
- `web-panel/src/firebase.js` dosyasını açın.
- Firebase Console -> Proje Ayarları -> Uygulamalarınız -> **Web Uygulaması** (</>) ekleyerek aldığınız `firebaseConfig` bilgilerini bu dosyadakiyle değiştirin.

#### C. Öğrenci Mobil Uygulaması (Flutter)
- **Android:** Firebase Console -> Uygulama Ekle -> **Android** yolunu izleyin. `google-services.json` dosyasını indirin ve `mobile-app/android/app/` klasörüne yapıştırın.
- **iOS:** Firebase Console -> Uygulama Ekle -> **iOS** yolunu izleyin. `GoogleService-Info.plist` dosyasını indirin ve `mobile-app/ios/Runner/` klasörüne yapıştırın.

### 3. Veritabanını Doldurma (Seeding)
Projenin çalışması için veritabanında kullanıcı ve ders verilerinin olması gerekir. Bunun için `backend/` klasörü içinde şu komutları sırasıyla çalıştırın:
```bash
node seed.js
node create_auth_users.js
```
*Bu komutlar Firebase'e test kullanıcılarını ve derslerini ekleyecektir.*

### 4. Bağlantı Sorunları ve Portlar
- **Mobil Bağlantı:** Eğer mobil uygulamayı emülatör yerine gerçek bir cihazda test edecekseniz, `mobile-app/lib/main.dart` içindeki `localhost` veya `10.0.2.2` adreslerini bilgisayarınızın yerel IP adresiyle (örn: `192.168.1.50`) değiştirmeniz gerekir.
- **Backend Erişimi:** Sunucu varsayılan olarak `127.0.0.1` üzerinde çalışır. Emülatör bağlantı sorunları yaşarsa bunu `0.0.0.0` yapabilirsiniz.

## Güvenlik Altyapısı (Gerçeklenenler)
- **Device ID Bağlantısı:** API içerisinde `register_device` rotası mevcuttur ve `/scan` rotası üzerinde öğrenci cihaz doğrulaması arar (başkasının yerine yoklama verme problemini çözer).
- **QR Kriptografik Şifreleme/Zaman Kısıtlaması:** Yoklama başlatıldığında QR kod sabit değildir. API ve Web-Panel 5 saniyede bir konuşarak QR içindeki Hash'i (UUID) yeniler. Uzaktan fotoğraf yollayarak sisteme girilmesinin önü kapanır.
