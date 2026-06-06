# Servix Release Checklist

## Yayın öncesi

- [ ] `npm install`
- [ ] `npx electron-rebuild -f -w better-sqlite3`
- [ ] `npm run release:check`
- [ ] Admin login testi
- [ ] Lisans oluşturma testi
- [ ] Lisans ata/taşı testi
- [ ] Mail gönderme testi
- [ ] Backup alma testi
- [ ] Update ekranı testi
- [ ] Demo verileri production build'de yok
- [ ] `package.json` version artırıldı
- [ ] GitHub owner/repo gerçek değerlerle değiştirildi
- [ ] GH_TOKEN hazır

## Yayın

Stable:

```bash
npm run release:stable
```

Beta:

```bash
npm run release:beta
```

## Yayın sonrası

- [ ] GitHub Release içinde `.exe`, `.blockmap`, `latest.yml` var
- [ ] Temiz makinede installer çalışıyor
- [ ] Update kontrolü yeni sürümü görüyor
- [ ] Eski sürümden yeni sürüme geçiş testi tamamlandı
