---
description: Faz 10 — Yedekleme, hata dayanıklılığı, kurulum paketi ve teslim
---

# Faz 10 — Yedekleme & Teslim

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/KARARLAR.md`.

Bu faz "bitirme" değil **"güvene alma"** fazı. Kullanıcı teknik değil, tek başına ve
verisini kaybederse geri getirecek kimse yok. Ciddiye al.

---

## 1. Otomatik yedekleme

- Her açılışta ve günde bir kez veritabanının **tarihli kopyası**
- Son 30 yedek saklanır, eskiler silinir
- Yedek alma sırasında uygulama kilitlenmez
- Yedek dosyası bozuk mu diye açılışta doğrulanır

## 2. Yedekleme ekranı (Ayarlar altında)

- Yedek klasörünü işletim sisteminde aç
- Elle yedek al
- **Yedekten geri yükle:** çift onaylı, ve geri yüklemeden önce mevcut veritabanını
  otomatik yedekle (yanlış yedeği seçerse kurtarılabilsin)
- Yedeği USB / bulut klasörüne kopyalama — bilgisayar bozulursa veri gitmesin

## 3. Ayarlar ekranı

Kurs adı, logo, adres, telefon, makbuz başlığı, varsayılan tarife, yedek klasörü.

## 4. Hata dayanıklılığı

Kullanıcı asla ham hata görmeyecek:
- `SQLITE_BUSY` → "Program başka bir pencerede açık olabilir. Diğer pencereyi kapatıp tekrar deneyin."
- Bozuk veritabanı → "Veritabanı açılamadı. Son yedekten geri yüklemek ister misiniz?"
- Disk dolu, yazma izni yok, yedek klasörü silinmiş senaryoları
- Beklenmeyen hatada: Türkçe mesaj + "Ayrıntıları kopyala" düğmesi (bana gönderebilsin)

Hata durumlarını gerçekten tetikleyerek test et, varsayma.

## 5. Uygulama içi yardım

Her ana ekranda kısa "bu ekran ne işe yarar" ipucu. İlk açılışta karşılama akışı:
kurs bilgileri → ilk branş → ilk öğrenci.

## 6. Sürüm ve derleme

- Sürüm numarası tek yerden yönetilsin, uygulama içinde görünsün
- GitHub Actions'ta etiketli sürüm → Windows `.msi` release olarak yayınlansın
- WebView2 bağımlılığı: kullanıcının makinesinde yoksa ne olacak, kurulum paketi
  bunu hallediyor mu — **doğrula ve yaz**

## 7. Teslim belgeleri

**`docs/KURULUM.md`** — kurs sahibi için. Hiç teknik terim yok, ekran görüntülü:
- Dosya nereden indirilir, nasıl kurulur
- SmartScreen uyarısı çıkarsa ne yapılır (ekran görüntüsüyle)
- İlk açılışta ne yapılır
- Yedek nasıl alınır, nereye kopyalanır

**`docs/KULLANIM-KILAVUZU.md`** — günlük, haftalık, aylık rutinler.
`docs/PRD.md`'deki rutinlerle aynı sırada olsun.

## 8. Teslim öncesi kontrol listesi

Windows'ta test edilmesi gereken her şeyi maddele ve bana ver:
kurulum, Türkçe karakterler, PDF çıktısı, Excel dışa aktarma, yedek al/geri yükle,
tarih-saat, yazdırma, program kapatıp açma, ikinci kez kurulum (veri korunuyor mu).

---

Bitince `/kapat`. Bu son fazdan sonra `docs/DURUM.md` "v1 teslim edildi" durumuna geçsin
ve v2 fikirleri (WhatsApp hatırlatma — ADR-009) ayrı bir başlıkta listelensin.
