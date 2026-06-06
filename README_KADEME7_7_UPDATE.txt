Kademe 7.7 - Auto Update Sistemi

Eklenenler:
- electron-updater altyapısı
- Güncellemeler ekranında mevcut versiyon gösterimi
- Güncelleme kontrol et butonu
- Güncelleme varsa indir butonu
- İndirildikten sonra yeniden başlat ve kur butonu
- İndirme progress bar
- Update durum toast bildirimleri

Önemli:
- package.json içindeki build.publish.url şimdilik örnek adrestir.
- Gerçek update için bu URL kendi sunucuna veya release dosyalarını koyacağın alana çevrilmelidir.
- npm run dist sonrası oluşan setup.exe ve latest.yml aynı update adresine yüklenmelidir.
