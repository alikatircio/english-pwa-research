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

## Ana ekrana ekleme ve ilk açılış (T5.5, T5.8)
Canlı adres (GitHub Pages) üzerinden, verisi olmayan temiz bir Safari ile.
- [ ] Safari'de açınca Ana Sayfa'da "Safari → Paylaş → Ana Ekrana Ekle. Ana ekrana eklemezsen iOS verilerini silebilir." satırı görünüyor; "Kapat" ile kapanıyor ve yenileyince geri gelmiyor.
- [ ] Safari → Paylaş → Ana Ekrana Ekle: ikon ve kısa ad ("Üretim") doğru, arka plan rengi sakin (beyaz flaş yok).
- [ ] Ana ekrandaki ikondan açınca adres çubuğu yok (standalone); kurulum ipucu **hiç** görünmüyor.
- [ ] İlk açılışta kısa karşılama metni, "Başla · bugün N" ve "Yedekten geri yükle" var; başka sayı yok.
- [ ] İlk "Başla"ya dokununca kart açılıyor, klavye geliyor; Ayarlar'da "Kalıcı depolama: açık" ya da "kapalı" yazıyor (not al: ______).
- [ ] "Kapalı" ise Ayarlar → "Kalıcı depolamayı iste" dokunulabiliyor, uygulama donmuyor; satır sonucu gösteriyor.
- [ ] Uygulamayı kapatıp yeniden açınca karşılama metni tekrar çıkmıyor.

## Uçak modunda açılış (T5.6, T5.8)
- [ ] Uygulamayı en az bir kez internetliyken aç, Ana Sayfa'ya kadar bekle, sonra uygulamayı tamamen kapat (uygulama değiştiriciden yukarı kaydır).
- [ ] Uçak modunu aç (Wi-Fi da kapalı), ana ekrandan uygulamayı aç: Ana Sayfa geliyor, "Safari sayfayı açamıyor" hatası yok.
- [ ] Uçak modunda "Başla" → bir kartı cevapla → "Doğru" ya da öz-değerlendirme kaydediliyor.
- [ ] Uçak modunda deftere bir ifade ekle; "Deftere kaydedildi." görünüyor.
- [ ] Uçak modunda uygulamayı kapatıp yeniden aç: aynı tur "Devam et" ile sürüyor, cevap kaybolmamış.
- [ ] Uçak modunu kapat; yeni sürüm varsa yalnızca Ana Sayfa'da (açık tur yokken) yenileniyor, kart ortasında değil.

## Klavye (standalone) (T1.11 tekrarı, T5.8)
- [ ] Standalone'da cevap alanına dokununca yakınlaşma yok; "Kontrol et" klavyenin hemen üstünde.
- [ ] Klavye kapanınca altta boşluk ya da kayma kalmıyor; ana ekran göstergesi butonla çakışmıyor.
- [ ] "Sonraki"den sonra yeni kartta klavye kendiliğinden açılıyor.
- [ ] Ayarlar'da dosya seçme ve paylaşım sayfası kapanınca düzen bozulmuyor.

## Dosyalar'a yedek ve geri yükleme (T5.4, T5.8)
- [ ] Ayarlar'da "Son yedek: hiç" yazıyor.
- [ ] "Yedeği dışa aktar" → paylaşım sayfası açılıyor (dokunuştan hemen sonra, ikinci dokunuş gerekmeden) → "Dosyalar'a Kaydet" → iCloud Drive ya da "iPhone'umda" bir klasöre kaydediliyor.
- [ ] Dosya adı `english-pwa-backup-YYYY-MM-DD.json`; Dosyalar uygulamasında açınca JSON içeriği görünüyor.
- [ ] Paylaşım sayfası "Vazgeç" ile kapanınca "Son yedek" değişmiyor; kaydedince bugünün tarihi yazıyor.
- [ ] "Yedekten geri yükle" → Dosyalar'dan az önceki dosya seçiliyor → "Birleştir" / "Tümünü değiştir" seçimi geliyor.
- [ ] "Birleştir" → "Yedek yüklendi."; Ana Sayfa'daki sayı mantıklı, kartlar kaybolmamış.
- [ ] "Tümünü değiştir" ikinci bir onay soruyor; "Vazgeç" hiçbir şeyi değiştirmiyor; "Evet, tümünü değiştir" yedekteki duruma dönüyor.
- [ ] Bozuk ya da başka bir dosya (ör. defter dışa aktarımı) seçince Türkçe hata çıkıyor, veriler değişmiyor.
- [ ] Yedek 7 günden eskiyse Ana Sayfa'da yalnızca "Yedeğin 1 haftadan eski" satırı var; "Kapat" sonrası bir hafta görünmüyor (saat ayarıyla denenebilir).
- [ ] Silip yeniden kurulumda (ana ekrandan sil → tekrar ekle) karşılama ekranındaki "Yedekten geri yükle" ile tüm ilerleme geri geliyor.

## VoiceOver turu (T5.8)
Ayarlar → Erişilebilirlik → VoiceOver açık; sağa/sola kaydırarak sırayla gez.
- [ ] Ana Sayfa: başlık (bugünkü kart sayısı) ilk okunan öğe; karşılama / kurulum ipucu / yedek hatırlatması metinleri ve "Kapat" butonları okunuyor, "Kapat" hangi satıra ait olduğunu söylüyor.
- [ ] Gizli dosya alanları okunmuyor; yalnızca "Yedekten geri yükle" ve "Item dosyası seç" butonları var.
- [ ] Kart: Türkçe durum ve "Bunu İngilizce yaz" alanı birlikte okunuyor; cevap sonrası "Doğru" / "Birebir eşleşmedi" duyuruluyor.
- [ ] Değerlendirme butonları (Yanlış / Kısmen / Doğru) grup adıyla ("Nasıldı?") okunuyor.
- [ ] Ayarlar: bölüm başlıkları (Defter, Yedek, Depolama…) başlık olarak geziliyor; "Son yedek" ve "Kalıcı depolama" satırları okunuyor.
- [ ] Geri yükleme seçimi ve "Tümünü değiştir" onayı açılınca okunuyor; hata mesajları kendiliğinden duyuruluyor.
- [ ] Tur sonu ve "Bugün bitti" ekranında odak kaybolmuyor (sayfanın en üstüne zıplamıyor).

## Notlar
- 
