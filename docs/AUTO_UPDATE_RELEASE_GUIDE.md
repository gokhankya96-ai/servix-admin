# Servix Auto Update Yayın Hazırlığı

Bu dosya yalnızca yayın süreci içindir; uygulama modüllerini değiştirmez.

## GitHub Release Ayarı

`package.json` içinde şu alanları gerçek repo bilgilerinle değiştir:

```json
"publish": [
  {
    "provider": "github",
    "owner": "CHANGE_ME_GITHUB_OWNER",
    "repo": "servix-releases",
    "releaseType": "release"
  }
]
```

## Token

Windows PowerShell:

```powershell
setx GH_TOKEN "github_token_buraya"
```

Yeni terminal açtıktan sonra kontrol:

```powershell
echo $env:GH_TOKEN
```

## Stable build

```bash
npm run release:stable
```

## Beta build

```bash
npm run release:beta
```

## latest.yml

`electron-builder` publish sırasında `latest.yml` dosyasını üretir ve GitHub Release içine yükler.
Müşteri uygulaması güncelleme kontrolünde bu dosyayı kullanır.

## Dikkat

- `dist` klasörünü elle düzenleme.
- Her yayından önce `package.json` version artır.
- Beta test bitmeden stable release yayınlama.
