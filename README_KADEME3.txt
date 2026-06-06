KADEME 3 - Electron EXE Paketleme Sistemi

Bu kademede login ekranına veya mevcut giriş/kayıt akışına dokunulmadı.
Sadece masaüstü uygulama olarak paketleme altyapısı eklendi.

Eklenenler:
- electron-builder paketleme sistemi
- Windows x64 NSIS installer ayarı
- dist komutu
- pack komutu
- masaüstü kısayolu / başlat menüsü kısayolu ayarları

Kurulum:
1) Node.js kurulu olmalı.
2) Proje klasöründe terminal açın.
3) Paketleri yükleyin:
   npm install

Geliştirme için çalıştırma:
   npm start

Windows kurulum dosyası üretme:
   npm run dist

Kurulum dosyası dist klasörü içine oluşturulur.

Not:
- SQLite veritabanı uygulama kullanıcı verisi klasöründe oluşur.
- better-sqlite3 native modül olduğu için paketleme sonrası sorun olursa:
  npm run rebuild
  npm run dist

Kademe 4 önerisi:
- Lisans kodu üretme
- 7 günlük / 30 günlük / 365 günlük / süresiz lisans tipleri
- Lisans aktif/pasif kontrolü
