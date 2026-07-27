# Kurs Takip — Windows Teslim Kontrolü

Bu liste v1 kurulum dosyasının gerçek bir Windows bilgisayarda tek elle sınanması için
teslim kapısıdır. Bütün maddeler yeşil olmadan sürüm müşteriye verilmez. Hata görülen
maddede ekran görüntüsü ve kısa not alınır; sorun düzeltildikten sonra listenin tamamı
yeniden yürütülür.

## Test kaydı

- Sürüm / etiket:
- `.msi` dosya adı:
- GitHub Actions yayın işi:
- Test tarihi ve saati:
- Test eden:
- Windows sürümü:
- Bilgisayar ve ekran çözünürlüğü:
- Sonuç: [ ] GEÇTİ  [ ] DURDU

Her maddede `[ ]` işareti ancak beklenen sonuç görüldüğünde `[x]` yapılır. Kanıt olarak
ekran görüntüsü, oluşturulan dosya veya kısa gözlem notu kaydedilir.

## A. Derleme öncesi kurum ve yayın kontrolü

- [ ] `config/kurum.json > institutionName` teslim edilecek kursun tam adı.
- [ ] `config/kurum.json > receipt.address` ve `receipt.phone` müşteriyle teyit edildi;
      istenmiyorsa bilerek boş bırakıldı.
- [ ] Makbuz başlığında kurum adının kullanılacağı müşteriyle teyit edildi.
- [ ] `src-tauri/icons/` altındaki ürün simgeleri ve logo görünümü teslim için doğru.
- [ ] `package.json`, `Cargo.toml` ve uygulamadaki sürüm aynı; etiket `v1.0.0` biçiminde.
- [ ] Yayın etiketi oluşturulmadan önce `npm run check` yeşil.
- [ ] Etiketli GitHub Actions işi yeşil ve Release sayfasında tek Windows `.msi` var.
- [ ] Kurulum dosyasının SHA-256 özeti kaydedildi:

Kanıt / not:

## B. Temiz ve çevrimdışı kurulum

Başlangıç: Windows 10 veya 11; Kurs Takip daha önce kurulmamış; WebView2 Runtime kurulu
değil; internet bağlantısı kapalı.

- [ ] `.msi` çift tıklanınca kurulum başlıyor.
- [ ] İmza olmadığı için SmartScreen uyarısı çıkarsa **Ek bilgi → Yine de çalıştır**
      yolu çalışıyor; uygulama adı **Kurs Takip**, yayıncı bilgisi beklenen biçimde.
- [ ] Kurulum internet bağlantısı istemeden tamamlanıyor.
- [ ] Paketle gelen WebView2 bileşeni kuruluyor ve uygulama beyaz/boş pencere olmadan
      açılıyor.
- [ ] Başlat menüsünde Kurs Takip kısayolu ve doğru ürün simgesi görünüyor.
- [ ] İlk pencere başlığı **Kurs Takip**; kenar çubuğunda doğru kurum adı görünüyor.
- [ ] İlk açılış akışı kurum bilgisi → ilk branş → yeni öğrenci formu sırasıyla
      tamamlanıyor.
- [ ] Program kapatılıp yeniden açıldığında karşılama akışı tekrar gelmiyor.

Kanıt / not:

## C. Windows görünümü

Test verisiyle Bugün, Öğrenciler, Takvim, Ödemeler, Raporlar ve Tanımlar ekranlarının
her biri açılır.

- [ ] `%100` DPI ve 1280×720 çözünürlükte düğme/metin taşması veya üst üste binme yok.
- [ ] `%150` DPI'da oturum kapatıp açtıktan sonra düğme/metin taşması veya kesilme yok.
- [ ] Segoe UI metrikleriyle tablo başlıkları, tarih/saat, para ve rozetler sığıyor.
- [ ] Uygulama sistem font stack'ini kullanıyor; beklenmeyen serif/bozuk font yok.
- [ ] Windows kaydırma çubuğu genişliği içerik veya son tablo sütununu kapatmıyor.
- [ ] Pencere küçültülüp büyütüldüğünde ana işlemler erişilebilir kalıyor.
- [ ] Klavye ile Tab sırası anlamlı; odak işareti görülebiliyor; Enter/Escape beklenen
      işlemi yapıyor.

Kanıt / not:

## D. Türkçe karakter, sıralama ve yerel saat

Test kayıtları: `Işık`, `Ismail`, `İpek`, `Irmak`, `ıhlamur`, `Şule`, `Çağrı`, `Özgür`.

- [ ] Öğrenci adları ve notlarda `ç ğ ı İ ö ş ü` giriliyor, kaydediliyor ve yeniden
      açıldığında değişmiyor.
- [ ] Arama, büyük/küçük harf ve Türkçe `İ`/`ı` davranışında beklenen kayıtları buluyor.
- [ ] Türkçe ad sıralaması Windows ICU ayarından etkilenmeden uygulamanın Türkçe
      sıralama kuralına uyuyor.
- [ ] Bilgisayar bölgesi veya görüntü dili değişse de uygulama metinleri Türkçe.
- [ ] Saat dilimi İstanbul iken Bugün ekranındaki tarih, ders saati ve kırmızı **Şimdi**
      çizgisi Windows saatine uyuyor.
- [ ] Gece yarısına yakın aç/kapat denemesinde gün ve tarih bir gün kaymıyor.

Kanıt / not:

## E. Temel iş akışı ve kalıcılık

- [ ] Öğrenci ve veli ekleniyor; Türkçe karakterli kayıt aramayla bulunuyor.
- [ ] Branş, öğretmen, tarife, grup ve haftalık ders planı kaydediliyor.
- [ ] Bugün ekranından yoklama alınıyor; çift tıklama ikinci finans/paket etkisi
      oluşturmuyor.
- [ ] Bekleyen telafi Bugün ekranında görünüyor ve telafi dersi planlanabiliyor.
- [ ] Tahsilat kaydediliyor; art arda çift tıklama ikinci tahsilat oluşturmuyor.
- [ ] Makbuz numarası benzersiz; iptal veya yarım kalan işlem nedeniyle numara atlarsa
      uygulama çalışmaya devam ediyor.
- [ ] Program görev çubuğundan kapatılıp tekrar açıldığında bütün kayıtlar korunuyor.
- [ ] Windows yeniden başlatıldıktan sonra aynı kayıtlar açılıyor.

Kanıt / not:

## F. PDF makbuz ve yazdırma

- [ ] Türkçe adlı öğrenci için tahsilat ve PDF makbuz oluşturuluyor.
- [ ] PDF'de kurum adı, adres/telefon tercihleri, makbuz numarası, tarih ve tutar doğru.
- [ ] PDF'de `ç ğ ı İ ö ş ü` karakterleri görünür; boş kare veya bozuk glif yok.
- [ ] PDF başka bir Windows PDF okuyucusunda da aynı görünüyor; gömülü font doğrulandı.
- [ ] **Makbuz yazdır** Windows yazdırma penceresini açıyor.
- [ ] Microsoft Print to PDF veya gerçek yazıcıyla çıktı alınıyor; A4 yerleşimi kesilmiyor.
- [ ] Tahsilat iptalinden sonra makbuz/ekstre iptal durumunu doğru gösteriyor.

Kanıt / not:

## G. Excel dışa aktarma

- [ ] Türkçe adlı ve notlu öğrencinin cari ekstresi dışa aktarılıyor.
- [ ] Dosya Microsoft Excel'de uyarısız açılıyor.
- [ ] Sütunlar ayrı hücrelerde; tarih ve kuruşlu tutarlar doğru.
- [ ] `ç ğ ı İ ö ş ü` karakterleri bozulmuyor; UTF-8 BOM davranışı doğrulandı.
- [ ] Virgül, noktalı virgül, çift tırnak ve satır sonu içeren notlar sütunları bozmuyor.

Kanıt / not:

## H. Yedekleme ve geri yükleme

- [ ] **Şimdi yedekle** başarılı bildirim veriyor.
- [ ] Yedek Belgeler → Kurs Takip → Yedekler altında oluşuyor ve listede görünüyor.
- [ ] **Yedek klasörünü aç** doğru Windows klasörünü açıyor.
- [ ] **Başka klasöre kopyala** ile USB belleğe kopya alınıyor; var olan dosya ezilmiyor.
- [ ] Yedekten sonra yeni, kolay ayırt edilen bir öğrenci ve tahsilat ekleniyor.
- [ ] **Yedekten geri yükle** iki ayrı onay istiyor.
- [ ] Geri yükleme sonunda yedekten sonraki deneme kayıtları yok, önceki kayıtlar var.
- [ ] Geri yüklemeden hemen önce alınan güvenlik yedeği listede duruyor.
- [ ] Program kapatılıp açıldığında geri yüklenen veri korunuyor.
- [ ] Yedek klasörü elle yeniden adlandırıldıktan sonra yeni yedekleme klasörü tekrar
      oluşturuyor ve anlaşılır Türkçe sonuç veriyor.

Kanıt / not:

## I. Hata dayanıklılığı

- [ ] Diskte çok az boş alan bırakıldığında işlem ham SQLite kodu göstermeden Türkçe,
      eylem öneren hata veriyor.
- [ ] Yedek hedefi yazılamaz olduğunda program kapanmıyor; ne yapılacağını söylüyor.
- [ ] Beklenmeyen hata penceresinde **Ayrıntıları kopyala** çalışıyor; ayrıntı ana
      mesajın içinde sürekli görünmüyor.
- [ ] Bozuk veritabanı denemesi yalnızca bir test kopyasında yapıldı; uygulama son
      yedekten dönmeyi öneriyor.

Kanıt / not:

## J. Güncelleme, ikinci kurulum ve veri korunması

- [ ] İlk sürümde ayırt edilebilir öğrenci, ders, tahsilat ve yedek oluşturuldu.
- [ ] Aynı `.msi` ikinci kez çalıştırıldığında onarım/yeniden kurulum tamamlanıyor.
- [ ] İkinci kurulumdan sonra mevcut öğrenci, ders, tahsilat ve yedekler korunuyor.
- [ ] Daha yeni sürüm mevcut sürümün üzerine kuruluyor; veritabanı açılıyor ve kayıtlar
      korunuyor.
- [ ] Güncelleme sonrası program kapatılıp tekrar açılıyor; sürüm bilgisi yeni değeri
      gösteriyor.
- [ ] Kaldırma işleminin kullanıcı verisine etkisi ayrıca kaydedildi; yeniden kurmadan
      önce dış yedek alındı.

Kanıt / not:

## K. Teslim kararı

- [ ] A–J bölümlerinde boş veya kırmızı madde yok.
- [ ] Kullanılan `.msi`, test edilen SHA-256 özetiyle aynı dosya.
- [ ] Son sağlam yedek USB bellek veya ikinci bilgisayarda açılabilir durumda.
- [ ] Kurulum ve kullanım kılavuzları teslim paketinde.
- [ ] SmartScreen uyarısı ve kod imzası alınmadığı müşteriye açıkça anlatıldı.
- [ ] Test kanıtlarının saklandığı klasör:
- [ ] Teslime onay veren:

Nihai karar: [ ] TESLİME UYGUN  [ ] TESLİM DURDU
