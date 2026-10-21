# iPhone kabul listesi (gerçek cihaz)

Playwright iOS klavyesini, `visualViewport` davranışını ve kullanıcı jesti kurallarını simüle etmez (07 §6.4, R2/R3). Bu liste gerçek iPhone'da elle işaretlenir.

- **Slice 1:** Safari'de, Mac ile aynı Wi-Fi üzerinden (`npm run dev -- --host`, adres `http://<mac-ip>:5173/english-pwa-research/`).
- **Slice 5:** Ana ekrana eklenmiş (standalone) uygulamada tekrar.

Cihaz / iOS sürümü: ________ · Tarih: ________ · Mod: Safari / Standalone

## Klavye ve düzen (T1.11)
- [ ] Cevap alanına dokununca sayfa **yakınlaşmıyor** (font ≥ 16 px).
- [ ] Klavye açıkken "Kontrol et" butonu klavyenin hemen üstünde, tam genişlikte görünüyor.
- [ ] Klavye açıkken durum metni (Türkçe cümle) kaydırılarak okunabiliyor; düzen üst üste binmiyor.
- [ ] Klavye kapanınca (Enter ya da dışarı dokunma) buton tekrar ekranın altına iniyor; altta boşluk / kayma kalmıyor.
- [ ] Ana ekran göstergesi (home indicator) butonla çakışmıyor.
- [ ] Yanlış yazılan kelime **otomatik düzeltilmiyor**, kırmızı alt çizgi yok.
- [ ] İlk harf otomatik büyük harf oluyor (cümle başı).
- [ ] QuickType öneri çubuğu görünüyor mu? (not al: ______; web'den kapatılamıyor olabilir)
- [ ] Klavyedeki dönüş tuşu "Git/Go" yazıyor ve basınca cevap gönderiliyor (yeni satır eklenmiyor).
- [ ] Boşken "Kontrol et" pasif.

## Akış (T1.8–T1.10)
- [ ] Kanonik cevabı akıllı kesmeyle (`I’ll …`) yazınca "Doğru" çıkıyor.
- [ ] Eşleşmeyen cevapta: senin cevabın, doğrusu, "Kendine sor" listesi; "Sonraki" yok, üç buton var.
- [ ] Değerlendirme butonları rahat basılıyor (≥ 44 px, aralarında boşluk).
- [ ] "Sonraki"ye basınca yeni kartta klavye **kendiliğinden açılıyor** (focus jesti).
- [ ] Yazarken uygulamadan çık (ana ekran), geri dön: aynı kart ve aynı taslak.
- [ ] Sonuç ekranındayken sayfayı yenile: aynı sonuç ekranı.
- [ ] Açık / koyu mod sistem ayarını izliyor; ikisinde de metin okunaklı.

## Notlar
- 
