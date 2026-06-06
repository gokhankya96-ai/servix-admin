PRODUCTION / DAĞITIM NOTLARI

Bu pakette yalnızca dağıtım ve güvenlik altyapısı eklendi. Mevcut UI, lisans, mail, kullanıcı ve veritabanı akışları değiştirilmedi.

Eklenenler:
1) Installer polish
   - electron-builder NSIS installer ayarları düzenlendi.
   - Çıktı adı: Teknik Servis-<version>-win-x64.exe formatına alındı.
   - Masaüstü ve Başlat menüsü kısayolu korunur.
   - App data uninstall sırasında silinmez; lisans/veritabanı kaybı yaşanmaz.

2) Code signing hazırlığı
   - Gerçek sertifika olmadan imzalama yapılamaz.
   - Sertifika alınca electron-builder ENV değişkenleriyle imzalanabilir:
     CSC_LINK=<sertifika.pfx yolu veya base64>
     CSC_KEY_PASSWORD=<sertifika şifresi>
   - Sonra: npm run dist

3) Auto updater release server hazırlığı
   - Generic provider korunur.
   - Ayarlar ekranındaki Update URL gerçek sunucu adresine girilmelidir.
   - npm run dist:publish komutu publish altyapısı için hazırdır.
   - Sunucuda latest.yml ve installer dosyası aynı klasörde olmalıdır.

4) Production hardening
   - contextIsolation açık.
   - nodeIntegration kapalı.
   - webSecurity açık.
   - harici pencere açma kapalı.
   - production modda devtools kapalı.
   - file:// dışı navigation engellenir.
   - tek instance kilidi eklendi.

5) Anti-tamper temel koruma
   - security-manifest.json ile kritik dosya SHA-256 kontrolü yapılır.
   - Production build içinde manifest bozulursa uygulama açılışta durur.
   - Yeni release almadan önce manifest güncellemek için:
     npm run security:manifest

6) Rate limit / abuse koruması
   - login/register/reset password işlemleri rate limit altına alındı.
   - SMTP test, test mail, lisans mail gönderimi rate limit altına alındı.

Build sırası:
1. npm install
2. npm run security:manifest
3. npm run dist

Development çalıştırma:
1. npm install
2. npm run rebuild
3. npm start
