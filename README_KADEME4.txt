KADEME 4 - LISANS SISTEMI ALTYAPISI

Bu kademede mevcut login tasarimina dokunulmadan lisans altyapisi eklendi.

Eklenenler:
- licenses tablosu
- 7 gunluk deneme lisansi
- 30 gunluk lisans
- 365 gunluk lisans
- suresiz lisans
- kisa lisans kodu uretme altyapisi
- kullaniciya lisans baglama altyapisi
- login sirasinda aktif lisans kontrolu
- suresi dolan lisansi expired durumuna alma mantigi

Lisans tipleri:
- trial_7      : 7 gunluk deneme
- monthly_30   : 30 gunluk lisans
- yearly_365   : 365 gunluk lisans
- lifetime     : suresiz lisans

Notlar:
- Yeni kayit olan kullaniciya otomatik 7 gunluk deneme lisansi atanir.
- Login sirasinda aktif lisans kontrol edilir.
- Admin panel henuz eklenmedi; lisans olusturma fonksiyonu altyapida hazirdir.
- HWID kilidi bir sonraki kademede eklenecek sekilde tasarlanmistir.

Calistirma:
npm install
npm start

EXE alma:
npm run dist
