# Production Final Checklist

Bu dosya sadece dağıtım kontrolü içindir. Uygulama akışını değiştirmez.

## 1. Kurulum Kontrolü

```bash
npm install
npm run rebuild
npm run preflight
npm start
```

## 2. Test Edilecek Modüller

- Login
- Admin dashboard
- Kullanıcı düzenleme
- Lisans oluşturma
- Lisans atama/taşıma
- Lisans mail gönderimi
- SMTP test
- Backup / restore
- Dark / white tema
- Güncelleme kontrol ekranı

## 3. Production Build

```bash
npm run dist
```

Çıktı klasörü:

```text
dist/
```

## 4. Auto Update Yayını

Release klasörüne şunlar yüklenmeli:

- `.exe` installer
- `latest.yml`
- varsa blockmap dosyaları

`package.json > build.publish.url` production update adresiyle değiştirilmelidir.

## 5. Code Signing

Gerçek Windows code signing için sertifika gerekir. Sertifika yoksa SmartScreen uyarısı görülebilir.

## 6. Backup Kontrolü

- Manuel backup al
- Backup listede görünüyor mu kontrol et
- Test ortamında restore dene

## 7. Mail Kontrolü

- SMTP bağlantı testi
- Test mail gönder
- Lisans mail gönder

## 8. Son Not

Production build almadan önce sürüm numarasını artır:

```json
"version": "1.0.1"
```
