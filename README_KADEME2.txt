KADEME 2 - SQLite veritabanı altyapısı

Bu kademede login tasarımı değiştirilmedi. Sadece masaüstü uygulama altyapısı eklendi.

Eklenen dosyalar:
- package.json      : Electron + SQLite bağımlılıkları
- main.js           : Electron ana pencere ve IPC bağlantıları
- preload.js        : Güvenli frontend-backend köprüsü
- database.js       : SQLite users tablosu, kayıt, giriş, şifre değiştirme

Veritabanı:
- Uygulama çalışınca teknik-servis.db dosyası otomatik oluşturulur.
- Konum: Electron app.getPath('userData') klasörü.
- Şifreler düz metin saklanmaz; crypto.scrypt ile hashlenir.

Çalıştırma:
1) Node.js kurulu olmalı.
2) Bu klasörde terminal açın.
3) npm install
4) npm start

Not:
Tarayıcıda index.html açılırsa eski uyumluluk için localStorage modu çalışır.
Electron ile açılırsa gerçek SQLite modu devreye girer.
