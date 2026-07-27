# Durum

**Son güncelleme:** 2026-07-27 · **Faz 10 kodu ve belgeleri tamamlandı**
**Mevcut durum:** v1.0.0 teslim adayı; gerçek Windows teslim kapısı bekliyor
**Sıradaki ilk iş:** `docs/WINDOWS-TESLIM-KONTROLU.md` listesini WebView2 kurulu olmayan
bir Windows 10/11 bilgisayarda, yayınlanan `.msi` ile baştan sona yürütmek

> Bu dosya son durumu tutar. Geçmiş ayrıntıları `git log`, gerekçeleri
> `docs/KARARLAR.md` tutar.

---

## Nerede duruyoruz

`npm run check` yeşil: **404 web + 293 Rust testi + 1 doc-test**, typecheck, ESLint,
clippy, rustfmt ve üretim paket denetimi. Üretim bağımlılıklarında bilinen açık yok
(`npm audit --omit=dev`: 0).

Faz 6 tamamlandı; Faz 10'un kod ve belge işleri hazır:

- Bugün ekranında beş tıklanabilir özet ve paket/telafi panelleri var.
- Raporlar ekranında mevcut devamsızlık raporu korunarak özet, aylık tahsilat ve branş
  tabloları eklendi.
- Günlük otomatik ve elle yedek `VACUUM INTO` ile alınıyor; son 30 yedek tutuluyor.
- Yedek doğrulanıyor, dış klasöre kopyalanıyor ve çift onayla geri yükleniyor; geri
  yüklemede eski `-wal`/`-shm` temizleniyor.
- SQLite kilidi, bozuk dosya, disk dolu ve yazma izni hataları gerçek senaryolarla testli;
  kullanıcı Türkçe eylem mesajı, destek için ayrı teknik ayrıntı alıyor.
- Yedi ana ekranda bağlamsal yardım ve ilk kullanım akışı var.
- Sürüm tek kaynaktan `1.0.0`; etiketli GitHub Actions işi Windows `.msi` yayımlıyor.
  Kurulum WebView2 `offlineInstaller` içeriyor; kod imzası yok.
- Kurulum ve kullanım kılavuzları ile tek-elle Windows teslim listesi hazır.
- Migration yazılmadı; `src/pages/takvim/**` dondurulmuş hâliyle korundu.

Faz 10 commitleri: `8f93852..7d972d8`.

## Teslimi bekleten tek kapı

`docs/WINDOWS-TESLIM-KONTROLU.md` henüz gerçek Windows bilgisayarda yürütülmedi. Liste;
temiz/çevrimdışı kurulum, WebView2, SmartScreen, Türkçe karakter ve sıralama, Segoe UI,
DPI, scrollbar, sistem fontu, PDF/yazdırma, Excel, tarih-saat, yedek/geri yükleme,
kapat-aç ve ikinci kurulumda veri korunmasını kapsıyor.

Bu kanıt gelmeden **“v1 teslim edildi” denmez**, sürüm etiketi müşteriye nihai paket
olarak verilmez. Yeşil sonuçtan sonra:

1. Listedeki test kaydı ve SHA-256 doldurulur.
2. `docs/YOL-HARITASI.md` teslim kapısı ✅ yapılır.
3. Bu dosyanın durumu **v1 teslim edildi** olarak güncellenir.

## Bilinçli ertelenenler

| Ne | Neden / nereye bağlı |
|---|---|
| Gerçek Windows elle testi | Windows 10/11 + WebView2'siz makine ve yayımlanmış `.msi` gerekiyor; `WINDOWS-TESLIM-KONTROLU.md` |
| Geliştirme zincirinde 12 yüksek `npm audit` bulgusu | Üretim paketinde bağımlılık yok; önerilen toplu çözüm ESLint 10 kırıcı geçişi. v1 teslim testini bekletmiyor, araç zinciri bakımında ele alınacak |
| Gün değişince açık ekranın kendiliğinden tazelenmemesi | ADR-029'da kabul edilen sınır |
| Takvim jest/kenar kaydırma geliştirmeleri | ADR-034 ile v2 |

## Açık soru

Windows teslim listesini hangi Windows 10/11 bilgisayarda ve kim yürütecek? Test sonucu
ve `.msi` SHA-256 kaydı kapanış için gerekli.

## Sahiplik kontrolü — ADR-039

Kurs sahibi artık öğrenciyi ve veliyi kaydedip ders/grup planlayabiliyor; yoklama ve
telafi yönetebiliyor; tarife/paket/taksit/tahsilat işleyebiliyor; borç, ekstre, makbuz ve
rapor alabiliyor; günlük özeti görebiliyor; yedek alıp başka ortama kopyalayabiliyor ve
çift onayla geri yükleyebiliyor.

Yapamadığı ürün işi kalmadı. Kalan, geliştiricinin gerçek Windows'ta kurulum paketini
kanıtlaması ve teslim etmesi; bu iş teslim kapısında açıkça sahipli.

## Bir sonraki oturumun en büyük riski

Windows testi yapılmadan etiketi “hazır” saymak. Özellikle S9 nedeniyle çevrimdışı
WebView2 kurulumu ile imzasız paketin SmartScreen/kurum politikası davranışı yalnızca
gerçek hedef makinede kanıtlanabilir.

## v2 fikirleri

- WhatsApp/SMS hatırlatma (ADR-009)
- Takvim jestleri, kenarda kendiliğinden kaydırma ve şerit genişlemesi (ADR-034)
- Çoklu kullanıcı ve yetkilendirme
- Bulut senkronizasyonu ve mobil erişim
- Muhasebe/e-fatura entegrasyonu
