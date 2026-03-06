# QR Yoklama - Öğrenci Mobil Uygulaması

Bu klasör, öğrencilerin akıllı telefonlarına kuracakları ve amfiye girdiklerinde tahtadaki QR kodu tarayacakları Flutter tabanlı mobil uygulamadır.

## 🛡️ Güvenlik (Device ID)
Şartnameler gereğince; cihaz kimliği (`device_info_plus`) entegrasyonu yapılmıştır. Sisteme giren her telefonun donanım ID'si veritabanına kazınır ve başkasının yerine yoklama verilmesi engellenir.

## 🛠️ Kurulum ve Çalıştırma

ÖNEMLİ: Uygulamanın Firebase'e ve Backend API'sine (`localhost:5000` veya IP adresiniz) erişebilmesi gerekir.

1. Bağımlılıkları çekmek için terminalde:
```bash
flutter pub get
```

2. Emülatörünüzü veya fiziksel cihazınızı bağlayıp projeyi başlatın:
```bash
flutter run
```

Bu klasör içinde Firebase ayarları için kullanılan `google-services.json` (Android) veya `GoogleService-Info.plist` (iOS) dosyaları güvenlik gereği Git'e yüklenmemelidir. Kendi Firebase projenizi bağlayarak test edebilirsiniz.
