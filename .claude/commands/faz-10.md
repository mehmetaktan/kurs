---
description: Faz 10 — Yedekleme, hata dayanıklılığı, kurulum paketi ve teslim
---

# Faz 10 — Özet Ekranı, Yedekleme & Teslim

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/KARARLAR.md`,
`docs/KULLANILABILIRLIK.md`.

Bu faz "bitirme" değil **"güvene alma"** fazı. Kullanıcı teknik değil, tek başına ve
verisini kaybederse geri getirecek kimse yok. Ciddiye al.

> **Faz 9 buraya katıldı** (2026-07-26). Dashboard'un kırpılmış hâli §0'da; grafikler ve
> rapor ekranları kapsam dışı (`faz-09.md` neyin çıktığını yazıyor). **Bu son faz** —
> planda ondan sonrası yok.

---

## 0. Bugün ekranının özet şeridi (kırpılmış Faz 9)

Yeni sorgu yazma; hepsinin kaynağı hazır. Mevcut komutları ekrana bağla:

- Bu ay tahsil edilen tutar · **toplam alacak** (`views::total_receivable`) · borçlu öğrenci
  sayısı (`v_student_debt`)
- Bekleyen telafi sayısı (Faz 6) · bitmek üzere olan paketler (`v_package_remaining`)
- Her kart tıklanınca ilgili ekrana gitsin
- **Özet rakamın etiketi hangi kümeyi topladığını yazar** (ADR-026/ADR-025): "toplam
  alacak" ile "görünen listenin alacağı" aynı şey değil
- Boş durum: yeni kurulan programda hiç veri yok — her kart bunu ayrıca ele alır
- Kullanılabilirlik listesinde açık madde varsa (`docs/KULLANILABILIRLIK.md`) burada kapat

**E17 Raporlar sayfası da burada doluyor** (`EKRANLAR.md > E17`) — Faz 3'ten beri
placeholder duran 7. menü öğesi. Kapsam EKRANLAR'ın yazdığı kadarı: `StatCard` şeridi
(aylık tahsilat, işlenen ders, devam oranı, aktif öğrenci) + üç basit tablo (aylık
tahsilat, branş bazında ders, devamsızlık dökümü). **Grafik yok** — tasarımda hiç grafik
yok, sayı ve tablo dili hâkim; `dataviz` skill'i bu fazda gerekmiyor. ADR-025 rapor
tablolarında da bağlayıcı: arama/filtre Rust'ta, Türkçe sıralama ve sayfalama arayüzde,
özet rakamın etiketi hangi kümeyi topladığını yazar.

## 1. Otomatik yedekleme

> **ADR-019 kilitli: yedek `VACUUM INTO` ile alınır, veritabanı dosyası KOPYALANMAZ.**
> Şema WAL modunda; commit edilmiş veri checkpoint olana kadar `.db` dosyasında değil
> `.db-wal` dosyasındadır. "Şimdi yedekle" tanımı gereği uygulama açıkken basılır — sadece
> `.db` kopyalanırsa **yedek boş çıkar** ve `PRAGMA integrity_check` buna `ok` der.
> Bu senaryonun sonu tam veri kaybı.

- Her açılışta ve günde bir kez `VACUUM INTO` ile **tarihli tek dosya**
- Son 30 yedek saklanır, eskiler silinir
- Yedek alma sırasında uygulama kilitlenmez
- **Yedek doğrulaması "dosya bozuk mu" değildir** — boş yedek bozuk değildir, geçerlidir.
  Doğrulama: yedeği aç, beklenen tabloları ve makul satır sayılarını kontrol et
  (ör. `student` ve `ledger_entry` sayısı canlı veritabanınınkiyle tutuyor mu).
- Her yedek `backup_log`'a yazılır (Bugün ekranının yedekleme şeridi buradan okur)

## 2. Yedekleme ekranı (Ayarlar altında)

- Yedek klasörünü işletim sisteminde aç
- Elle yedek al
- **Yedekten geri yükle:** çift onaylı, ve geri yüklemeden önce mevcut veritabanını
  otomatik yedekle (yanlış yedeği seçerse kurtarılabilsin)
- ⚠️ **Geri yükleme `-wal` ve `-shm` dosyalarını da silmek zorunda.** Yalnızca `.db` üzerine
  yazılırsa SQLite yanındaki eski `-wal`'ı uygular ve kullanıcı yedeği geri yükler, **ekranda
  hiçbir şey değişmez** — üstelik hata da almaz. Kullanıcının tek kurtarma yolu budur;
  geri yüklemeyi gerçekten test et, varsayma.
- Yedeği USB / bulut klasörüne kopyalama — bilgisayar bozulursa veri gitmesin
- Yedek klasörü **kullanıcının bulabileceği bir yerde** olsun (Belgeler altı gibi),
  `%APPDATA%\Roaming` içinde değil — orası gizli klasör ve OneDrive kapsamı dışında kalabilir

## 3. Ayarlar ekranı — **`/faz-07 §0c`'ye taşındı**

`Tanımlar → Genel` (E18) bu fazdan çıktı ve **para fazının §0'ına** alındı (ADR-037):
kurs sahibi çalışma saatlerini ve devamsızlık politikasını değiştiremeden para mantığı
kurulamıyordu, üstelik ekranı yapılmamış bir tabloyu (`setting`) en sona bırakmak
ADR-039'un anlattığı hatanın ta kendisiydi.

Bu fazda geriye **tek bir ayar satırı** kalıyor ve yeri `Tanımlar → Yedekleme`'dir (§2):

- **Yedek klasörü** ve `backup_warn_days` — ikisi de yedekleme ekranında, ayrı bir
  Ayarlar sekmesi açılmadan.

> ⚠️ **Kurum adı, adres, logo ve makbuz başlığı hiçbir ayar ekranına KONMAZ** — ADR-024:
> kurum kimliği `config/kurum.json`'dan **derleme anında** gömülüyor ve
> `setting.institution_name` satırı şemada durup **okunmuyor**. Teslim öncesi müşteriye
> özel değerleri `kurum.json`'da düzenlemek `docs/KURULUM.md`'nin değil **senin** işin
> (§7'nin kontrol listesine yaz).

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
