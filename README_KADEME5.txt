KADEME 5 - HWID CİHAZ KİLİDİ

Bu sürümde lisanslara cihaz kilidi eklendi.

Çalışma mantığı:
1. Kullanıcı başarılı giriş yapar.
2. Aktif lisans bulunur.
3. Lisans için daha önce cihaz kaydı yoksa mevcut bilgisayarın HWID bilgisi lisansa bağlanır.
4. Aynı lisans başka bilgisayarda açılırsa giriş engellenir.
5. Aynı bilgisayarda giriş yapılırsa last_seen_at güncellenir.

Eklenen tablo:
- device_hwid

Alanlar:
- license_id
- user_id
- hwid_hash
- device_name
- platform
- first_seen_at
- last_seen_at

Not:
HWID reset fonksiyonu altyapıya eklendi. Admin panel aşamasında buton olarak bağlanacak.

Çalıştırma:
npm install
npm start

EXE üretme:
npm run dist
