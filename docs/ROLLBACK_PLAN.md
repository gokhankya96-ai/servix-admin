# Servix Rollback Planı

## Amaç

Hatalı güncelleme yayınlanırsa müşterileri güvenli şekilde eski/stabil sürüme döndürmek.

## Adımlar

1. GitHub Releases içinde problemli release'i `draft` yap veya kaldır.
2. Son stabil release'i yeniden `latest` olarak yayınla.
3. Gerekirse `package.json` version değerini bir patch artır:
   - sorunlu: `1.0.2`
   - rollback build: `1.0.3`
4. `npm run release:stable` ile tekrar yayınla.
5. Müşterilere uygulamayı yeniden başlatmalarını söyle.

## Notlar

- Aynı version numarasıyla tekrar yayın yapma.
- Her rollback bir üst patch version olmalı.
- Database migration içeren sürümlerde rollback öncesi backup zorunlu.
