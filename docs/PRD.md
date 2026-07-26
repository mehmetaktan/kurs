# Ürün Gereksinimleri

Bu belge özellik listesi değil, **kurs sahibinin rutini** üzerine kurulu.
Her bölüm bir rutini alır ve şunu sorar: *hangi ekran çözüyor, kaç tıkla bitiyor,
hangi bilgi eksikse iş durur.*

---

## 0. Kim için, ne için

**Kullanıcı:** Küçük bir özel ders kursunun sahibi. Tek kişi, tek bilgisayar, Windows.
Teknik değil. Şu an muhtemelen defter ya da Excel kullanıyor.

**Uygulamanın cevaplaması gereken dört soru:**

1. Bugün kimin dersi var?
2. Kim geldi, kim gelmedi?
3. Kim ne kadar borçlu?
4. Kimin ders hakkı bitiyor?

**Bunlardan biri yanlış cevaplanırsa uygulama başarısızdır.** Geri kalan her şey bunlara
hizmet eder.

**Başarı ölçütü:** Kurs sahibi kâğıt defteri bıraksın. Bunun testi: bir ay boyunca hiçbir
soruyu "deftere bakayım" diye cevaplamak zorunda kalmasın.

**Kapsam dışı (MVP):** otomatik SMS/WhatsApp (ADR-009) · veli girişi · çoklu şube · fatura/KDV ·
**öğretmen hakedişi** · derslik yönetimi · bulut senkronizasyon (ADR-001) · mobil.

> Kurs **birden fazla öğretmenli** (ADR-037, 2026-07-26 — ADR-011'in "tek öğretmen"
> varsayımı sorulmamıştı ve yanlıştı). Öğretmen tanımlama, derse/gruba atama ve çakışma
> uyarısı kapsam **içi**; hakediş/maaş takibi ürün sahibinin kararıyla kapsam **dışı** kalır.

---

## 1. Her sabah — "Bugün kimin dersi var?"

**Ekran:** Bugün (açılış ekranı)
**Tık sayısı: 0.** Uygulama zaten burada açılıyor.

Kurs sahibi bilgisayarı açar, uygulamayı açar, günün programını görür: saat, ders, grup ya da
öğrenci, kaç kişi, yoklama durumu. Aynı ekranda borçlular ve paketi bitenler yan panelde.

### Gereksinimler

| # | Gereksinim |
|---|---|
| R1.1 | Bugünkü dersler saat sırasına göre; geçmiş ve gelecek arasında **"şimdi" çizgisi** |
| R1.2 | Yoklaması girilmemiş geçmiş ders **görsel olarak ayrışır** (amber zemin + sol şerit) ve başlıkta sayılır |
| R1.3 | Gecikmiş borcu olan öğrenciler tutar ve **gecikme gün sayısıyla** listelenir |
| R1.4 | Ders hakkı ≤ 2 kalan öğrenciler listelenir |
| R1.5 | Son yedekleme zamanı görünür; `backup_warn_days`'i aşarsa amber olur |
| R1.6 | Üç bölümün her biri **kendi boş durum metnini** gösterir |

### İş nerede durur

> **Haftalık program tanımlı değilse bu ekran boştur.**

Bu, uygulamanın en kritik bağımlılığı. İlk kurulumda kurs sahibi haftalık programı
girmeden hiçbir şey göremez. Bu yüzden:

- **R1.7** — Program yoksa Bugün ekranı boş liste değil, **yönlendirme** gösterir:
  "Haftalık ders programı henüz oluşturulmadı" + **Ders ekle**.
- **R1.8** — İlk açılışta bir kurulum sırası önerilir: branş → tarife → öğrenci → grup → program.

---

## 2. Her ders sonrası — yoklama

**Ekran:** Bugün → **Yoklama al** → yoklama paneli (`Drawer`)
**Tık sayısı: 3** (Yoklama al → "Hepsi geldi" → Kaydet). Devamsız varsa öğrenci başına +1.

### Gereksinimler

| # | Gereksinim |
|---|---|
| R2.1 | Dört durum: **Geldi · Mazeretli · Mazeretsiz · İptal** |
| R2.2 | "Hepsi geldi" tek tıkla toplu işaretleme — en sık durum en hızlı olmalı |
| R2.3 | Kaydetmeden önce **etki özeti**: *"5 ders hakkı düşecek, 1.250 TL borç yazılacak."* |
| R2.4 | Kaydettikten sonra bildirim; hata olursa **hiçbir şey kaydedilmez** (tek transaction) |
| R2.5 | Yoklaması alınmamış geçmiş ders kaybolmaz — Bugün ve takvimde işaretli kalır |
| R2.6 | Aynı yoklama iki kez işlenemez (`ux_ledger_attendance`, `ux_pkgusage_att`) |

### Devamsızlık politikası (ADR-016)

| Durum | Ders hakkı | Borç | Telafi |
|---|---|---|---|
| Geldi | düşer | yazılır | — |
| **Mazeretsiz** | **düşer** | **yazılır** | planlanabilir |
| **Mazeretli** | düşmez | yazılmaz | **hak doğar** |
| İptal | düşmez | yazılmaz | — |

Bu davranış `setting`'ten okunur; kod sabitlemez.

### Telafi

**Ekran:** yoklama panelinde "Mazeretli" işaretlenince satırda **Telafi planla** kısayolu.
**Tık sayısı: 2** (Telafi planla → tarih/saat seç → Oluştur).

| # | Gereksinim |
|---|---|
| R2.7 | Telafi seansı kaçırılan yoklamaya bağlanır (`makeup_for_attendance_id`) |
| R2.8 | Telafi seansı işlendiğinde **ikinci kez borç yazılmaz, ikinci kez hak düşmez** |
| R2.9 | Telafi takvimde **kesikli kenarlı** blok olarak görünür |
| R2.10 | Öğrenci detayının ders geçmişinde `Telafi · 18.07 ✓` olarak izlenir |

### İş nerede durur

> **Öğrenci gruba kayıtlı (`enrollment`) değilse yoklama listesinde görünmez.**

Bu bilinçli (§6, K-3). Ama kullanıcı için kafa karıştırıcı olabilir:
**R2.11** — Yoklama panelinde "Bu derse kayıtlı öğrenci yok" durumunda **Öğrenci ekle**
kısayolu bulunur.

---

## 3. Hafta içi — yeni öğrenci, program değişikliği, erteleme

### 3a. Yeni öğrenci kaydı

**Ekran:** Öğrenciler → **Yeni öğrenci** → form
**Tık sayısı: 3** + yazma.

| # | Gereksinim |
|---|---|
| R3.1 | Zorunlu alanlar yalnızca **ad soyad**. Geri kalan sonra doldurulabilir |
| R3.2 | Veli adı ve telefonu aynı formda girilir; ayrı ekran yok |
| R3.3 | Aynı isimde öğrenci varsa uyarı verir ama **engellemez** (kardeş/adaş olabilir) |
| R3.4 | Kaydetince öğrenci detayına gider ve **"Kayıt ekle"** öne çıkar |

### İş nerede durur

> **Tarife tanımlı değilse öğrenci kaydedilir ama ders alamaz.**

Bu ilk kurulumun en olası tökezleme noktası: kurs sahibi 20 öğrenci girer, sonra hiçbirini
derse yazamaz.

- **R3.5** — Kayıt (enrollment) ekranında tarife listesi boşsa: *"Önce bir tarife tanımlayın"*
  + **Tarife ekle** kısayolu. Kullanıcı akıştan çıkmaz.
- **R3.6** — İlk kurulumda üç örnek tarife hazır gelir (`Ders başı`, `Aylık paket`, `Dönemlik`),
  fiyatları sıfır — kullanıcı yalnızca rakamı değiştirir.

### 3b. Program değişikliği / ders erteleme

**Ekran:** Takvim → bloğu sürükle → kapsam seç
**Tık sayısı: 2** + sürükleme.

| # | Gereksinim |
|---|---|
| R3.7 | Sürükleme 30 dk'ya kilitlenir; 5px altındaki hareket tıklama sayılır |
| R3.8 | Tekrar eden derste kapsam sorulur: **"Sadece bu ders"** / **"Bu ve sonraki dersler"** |
| R3.9 | "Bu ve sonraki dersler" **geçmişi bozmaz** — eski seans kayıtları yerinde kalır |
| R3.10 | Tatil/kapalı güne bırakılamaz; hedef göstergesi bile çıkmaz |
| R3.11 | Çakışma oluşursa kaydetmeden önce onay istenir |
| R3.12 | Taşıma sonrası bildirim çıkar ve **geri alınabilir** |
| R3.13 | Yoklaması alınmış geçmiş ders taşınamaz |

---

## 4. Ay sonu — borç, tahsilat, makbuz

### 4a. Kim ne kadar borçlu

**Ekran:** Ödemeler (menüde borçlu sayısı rozetiyle)
**Tık sayısı: 1.**

| # | Gereksinim |
|---|---|
| R4.1 | Borçlu listesi: öğrenci · veli telefonu · borç · en eski vade · **gecikme gün sayısı** |
| R4.2 | Filtreler: Gecikmiş · Bu ay vadesi gelen · Avansı olan |
| R4.3 | Alt çubukta **toplam alacak** |
| R4.4 | Borcu olmayan öğrenci listeye girmez; liste boşsa bu **iyi haber** olarak gösterilir |

### 4b. Tahsilat alma

**Ekran:** Ödemeler / Öğrenciler / Öğrenci detayı → **Tahsilat al** (üç yerden de erişilir)
**Tık sayısı: 3** (Tahsilat al → tutar → Kaydet).

| # | Gereksinim |
|---|---|
| R4.5 | Ödeme yöntemi: **Nakit · Kart · Havale** |
| R4.6 | Açık taksitler listelenir; mahsup **otomatik önerilir** (en eski vadeden başlayarak), elle değiştirilebilir |
| R4.7 | Artan tutar avans olarak kalır ve bu açıkça yazılır: *"420 TL avans olarak kalacak."* |
| R4.8 | Mahsup toplamı ödeme tutarını aşamaz |
| R4.9 | Kaydedince makbuz numarası otomatik verilir |
| R4.10 | Tahsilat **silinemez** — iptal = ters kayıt + makbuzun iptal işaretlenmesi |

### 4c. Makbuz

**Ekran:** Tahsilat sonrası → **Makbuz yazdır**
**Tık sayısı: 1.**

| # | Gereksinim |
|---|---|
| R4.11 | PDF: kurum adı · makbuz no · tarih · öğrenci ve veli · tutar (rakam + yazı) · yöntem. **Kurum adı `config/kurum.json`'dan** (ADR-024), `setting` tablosundan değil |
| R4.12 | **Gömülü font zorunlu** — ğ/ş/İ/ı varsayılan PDF fontlarında yok |
| R4.13 | PDF `app_data_dir` altına kaydedilir ve klasör açılabilir |

### 4d. "Bu öğrenci neden bu kadar borçlu?"

**Ekran:** Öğrenci detayı → Cari ekstre
| # | Gereksinim |
|---|---|
| R4.14 | Tarih · açıklama · borç · alacak · **yürüyen bakiye** dökümü (ADR-004) |
| R4.15 | CSV çıktısı **BOM'lu UTF-8** — Excel Türkçe karakterleri bozmasın |

### İş nerede durur

> **Taksit vadeleri tanımlı değilse "gecikmiş" hesaplanamaz.**

Ders başı ödeyen öğrencide borç ders işlendiği gün doğar — vade o gündür. Pakette vade
taksit planından gelir. Peşin ödemede tek taksit, vadesi satış günü.
**R4.16** — Paket satarken taksit planı **zorunlu adımdır**, atlanamaz (peşin de bir plandır).

---

## 5. Dönem başı — tarife, grup, paket

**Sıra önemli:** branş → tarife → grup → program → öğrenci kaydı → paket satışı.

### 5a. Tarife güncelleme

**Ekran:** Tanımlar → Tarifeler
**Tık sayısı: 3.**

| # | Gereksinim |
|---|---|
| R5.1 | Üç tarife biçimi: **Ders başı · Paket (n ders) · Dönemlik** |
| R5.2 | Fiyat değişimi **geçmişi bozmaz** (ADR-006) ve bu ekranda yazılı olarak söylenir |
| R5.3 | Kullanımdaki tarife silinemez, arşivlenir |

### 5b. Grup oluşturma

**Ekran:** Gruplar → **Yeni grup**
**Tık sayısı: 3** + haftalık program tanımı.

| # | Gereksinim |
|---|---|
| R5.4 | Grup: ad · branş · **kapasite** · dönem başlangıç/bitiş |
| R5.5 | Haftalık program grup oluştururken tanımlanır (gün + saat + süre) ve seanslar üretilir |
| R5.6 | Öğrenci ekleme kapasiteyi aşarsa **onay istenir**, engellenmez |
| R5.7 | Öğrencinin gruba **katılım tarihi** kaydedilir; öncesindeki seanslardan sorumlu olmaz |
| R5.8 | Gruptan ayrılan öğrencinin kaydı silinmez, **bitiş tarihi** yazılır |

### 5c. Paket satışı

**Ekran:** Öğrenci detayı → Kayıtlar → **Kayıt ekle** / **Paket sat**
**Tık sayısı: 4.**

| # | Gereksinim |
|---|---|
| R5.9 | Paket: ders sayısı · birim ücret · toplam · indirim · taksit planı |
| R5.10 | Satış özeti kaydetmeden önce gösterilir: *"8 ders · 2.000 TL · 2 taksit — ilk vade 01.03."* |
| R5.11 | Ders hakkı ve bakiye **iki ayrı sayaç** olarak gösterilir; karıştırılmaz |
| R5.12 | Paket bitmeden yenisi satılabilir; haklar **en eski paketten** tüketilir |

---

## 6. Kullanıcının yapmaması gerekeni engelleyen kurallar

Üç seviye: **Engelle** (yazılamaz) · **Onay iste** (yazılabilir, sorulur) · **Uyar** (yazılır, işaretlenir).

| # | Kural | Seviye | Nasıl uygulanır |
|---|---|---|---|
| K-1 | **Aynı öğretmene** aynı saatte iki ders | **Onay iste** | Kaydetmeden önce diyalog; takvimde `!` rozeti kalır. ADR-037: kontrol `teacher_id`'ye göre daralır — o güne kadar `teacher_id` hiç karşılaştırılmadığı için kural **ölü doğmuştu** (`DENETIM-FAZ1 > C5`), `/faz-07 §0b`'de kapanıyor |
| K-2 | Tatil / kapalı güne ders | **Engelle** | Sürüklemede hedef çıkmaz; formda kaydettirmez |
| K-3 | Katılım aralığı dışında yoklama | **Engelle** | `trg_attendance_within_enrollment` tetikleyicisi |
| K-4 | Aynı yoklamadan iki kez borç | **Engelle** | `ux_ledger_attendance` kısmi UNIQUE indeksi |
| K-5 | Aynı yoklamadan iki kez ders hakkı düşümü | **Engelle** | `ux_pkgusage_att` kısmi UNIQUE indeksi |
| K-6 | Aynı taksitten iki kez borç | **Engelle** | `ux_ledger_installment` indeksi |
| K-7 | Olmayan paketten ders düşme | **Engelle** | Aktif paket yoksa hata; kullanıcıya *"Aktif paketi yok — ders başı ücret yazılsın mı?"* sorulur |
| K-8 | Grup kapasitesi aşımı | **Onay iste** | Tasarım çakışmayı da engellemiyor; aynı dil |
| K-9 | Mahsup, ödeme tutarını aşmak | **Engelle** | Rust katmanında doğrulama + test |
| K-10 | Negatif veya sıfır tahsilat | **Engelle** | `CHECK (amount > 0)` |
| K-11 | Aynı makbuz numarası | **Engelle** | `ux_receipt` UNIQUE indeksi |
| K-12 | Bitişi başlangıçtan önce olan ders | **Engelle** | `CHECK (ends_at > starts_at)` |
| K-13 | Bir öğrenciye iki birincil veli | **Engelle** | `ux_sg_primary` kısmi UNIQUE indeksi |
| K-14 | Borcu olan öğrenciyi arşivleme | **Onay iste** | *"Bu öğrencinin 1.200 TL borcu var. Arşivlensin mi?"* |
| K-15 | Yoklaması alınmış geçmiş dersi taşıma | **Engelle** | Önce yoklamayı geri al |
| K-16 | Kullanımdaki tarifeyi/branşı silme | **Engelle** | Arşivleme önerilir |
| K-17 | Defter satırını değiştirme veya silme | **Engelle** | `trg_ledger_immutable` / `trg_ledger_no_delete` |
| K-18 | Şablon değişikliğinin geçmişi bozması | **Engelle** | Yeni `session_series`; eski seanslar dokunulmaz |
| K-19 | Aynı tahsilattan iki kez defter kaydı | **Engelle** | `ux_ledger_payment` kısmi UNIQUE indeksi. **Asıl koruma arayüzde:** Kaydet düğmesi ilk tıklamada kilitlenir ve makbuz numarası modal açılırken rezerve edilir — çift tık iki ayrı `payment` **satırı** üretir, hiçbir defter indeksi bunu yakalayamaz |
| K-20 | Aynı defter satırını iki kez ters kaydetme | **Engelle** | `ux_ledger_reverses` + `trg_ledger_reversal_valid` (tutar ve öğrenci doğrulanır) |
| K-21 | Defter satırını arşivleme (soft delete kılığında silme) | **Engelle** | `CHECK (deleted_at IS NULL)` + sütunsuz `trg_ledger_immutable` |
| K-22 | Aynı öğrenci + branş için çakışan iki açık kayıt | **Engelle** | Repository doğrulaması; tahakkuku belirsiz hâle getirir |
| K-23 | Tarife bulunamayan dersi sessizce ücretsiz işleme | **Engelle** | `resolve_unit_price` hata döner; kullanıcıya K-7 diliyle sorulur |

**Genel ilke:** Para ve geçmişle ilgili her şey **engellenir**; program ve kapasiteyle ilgili
her şey **sorulur**. Kurs sahibi kendi programını bilir; muhasebesini bilmek zorunda değil.

---

## 7. Hangi hatalar geri alınabilir olmalı

| İşlem | Geri alınabilir mi | Nasıl |
|---|---|---|
| Ders taşıma | ✅ | Bildirimde **Geri al** (oturum içinde) |
| Öğrenci arşivleme | ✅ | Arşiv görünümünden **Geri al** (ADR-005) |
| Grup/tarife/branş arşivleme | ✅ | Aynı şekilde |
| Ders iptali | ✅ | Yeniden planlandı işaretlemesi; defterde ters kayıt |
| Yoklama düzeltme | ✅ | Kayıt düzeltilir, defter etkisi ters kayıtla dengelenir |
| Paket satışı iptali | ⚠️ **koşullu** | Hiç ders kullanılmadıysa iptal edilir; kullanıldıysa yalnızca kalan hak iptal edilir |
| Tahsilat | ⚠️ **silinemez** | İptal = ters kayıt + makbuz "İPTAL" damgası |
| Defter satırı | ❌ | Hiçbir zaman. Düzeltme yalnızca ters kayıtla |
| Makbuz numarası | ❌ | Bir kez verilen numara yeniden kullanılmaz |

**Kural:** Geri alma **hiçbir zaman satır silmez.** Her geri alma yeni bir satır yazar.
Kurs sahibi "yanlışlıkla sildim" diyemez, çünkü hiçbir şey silinmiyor.

---

## 8. Hata mesajları

CLAUDE.md kuralı: Türkçe ve **eylem öneren**. Ham hata kodu gösterilmez.

| Yerine | Bu |
|---|---|
| `UNIQUE constraint failed: payment.receipt_no` | "Bu makbuz numarası zaten kullanılmış. Numarayı değiştirin ya da mevcut makbuzu açın." |
| `attendance_outside_enrollment` | "Bu öğrenci bu tarihte gruba kayıtlı değil. Katılım tarihini düzeltmek ister misiniz?" |
| `database is locked` | "Kayıt şu anda tamamlanamadı. Birkaç saniye sonra tekrar deneyin." |
| `no active package` | "Bu öğrencinin aktif paketi yok. Ders başı ücret yazılsın mı, yoksa paket mi satacaksınız?" |

Her yıkıcı işlemde onay diyaloğu; her başarılı işlemde bildirim (2200 ms toast).

---

## 9. Sana sormam gereken açık sorular

Cevaplanmadan ilgili faz **tamamlanamaz**.

| # | Soru | Hangi faz | Cevap gelmezse varsayım |
|---|---|---|---|
| ~~**S1**~~ | ~~Şu an Excel/defter kullanıyor musun?~~ → **CEVAPLANDI (2026-07-25): hayır, sıfırdan başlıyor.** İçe aktarma yazılmaz, Faz 4 planlandığı gibi kalır. Bkz. **ADR-021**. | ~~Faz 4~~ | — |
| ~~**S2**~~ | ~~Grup kapasitesi aşımı engellensin mi, uyarı mı yeter?~~ → **CEVAPLANDI (2026-07-25): onay istenir, engellenmez.** Varsayımın onayı; `R5.6`, `K-8` ve `EKRANLAR.md §309` zaten bunu yazıyordu, üçü de değişmiyor. Kapasite `group.capacity`'de duruyor ve **şema seviyesinde zorlanmaz** — üyelik sayısında CHECK/trigger yok, kural arayüzün onay diyaloğudur. | ~~Faz 5~~ | — |
| ~~**S3**~~ | ~~Paketlerin son kullanma tarihi var mı?~~ → **CEVAPLANDI (2026-07-26): süresiz.** Varsayımın onayı. 8 ders alındıysa 8 ders hakkı bitene kadar geçerli; `package.valid_until` sütunu şemada **duruyor ama yazılmıyor** (`NULL`), "süresi geçmiş paket" durumu, uyarısı ve rapor satırı hiç doğmuyor. Aktif paket sorgusundaki `valid_until` koşulu (`/faz-07`) yerinde kalır — ileride tarih girilirse tek yerden açılır. | ~~Faz 7~~ | — |
| ~~**S4**~~ | ~~Standart ders süresi kaç dakika? Tasarımda 60 ve 90 var.~~ → **CEVAPLANDI (2026-07-25): varsayılan 60 dk, değiştirilebilir.** Varsayımın onayı, migration'da hazır: `setting.default_session_minutes = '60'`, branşa özel değer `subject.default_min` (NULL = genel varsayılan). **Şema değişmiyor, migration eklenmiyor.** Takvim ızgarası 60 dakikalık dilime oturur; 90 dakikalık ders serbest, tek tek girilir. | ~~Faz 5~~ | — |
| ~~**S5**~~ | ~~Makbuz numarası otomatik mi artsın, elle mi girilsin?~~ → **CEVAPLANDI (2026-07-26): otomatik artar, elle düzeltilebilir.** Varsayımın onayı. Numara modal **açılırken** rezerve edilir (K-19 çift tık koruması), alan düzenlenebilir, **aynı numara iki kez yazılamaz** — tekillik şemada zorlanır. Matbu koçana geçildiğinde elle uyumlanabilir. | ~~Faz 8~~ | — |
| ~~**S6**~~ | ~~Öğrenci dönem ortasında ayrılırsa kalan paket parası iade mi edilir, alacak mı kalır?~~ → **CEVAPLANDI (2026-07-26): ikisi de, kullanıcı seçer.** Varsayımdan **sapıyor** — paketi kapatma akışı "Avans bırak / İade et" seçimi sunar, ikisi de deftere append-only satır yazar. Gerekçesi ve kalan tutarın snapshot'tan hesabı **ADR-035**'te. | ~~Faz 7~~ | — |
| **S7** | "Devam oranı" hangi pencerede hesaplansın? Tasarım "son 8 hafta" trendi gösteriyor. → **Kapsam kırpıldı (2026-07-26): Faz 9 ayrı faz olmaktan çıktı**, trend grafiği kapsam dışı. Faz 4'ün varsayımı **kalıcı**: devam oranı tüm işlenen dersler üzerinden, kartın altında "Tüm işlenen dersler" yazılı. Soru sorulmuş kalıyor ama artık kimseyi bekletmiyor. | ~~Faz 9~~ → Faz 10 §0 | Tüm işlenen dersler |
| ~~**S8**~~ | ~~Raporlar 7. menü öğesi mi olsun, Bugün ekranının altında mı?~~ → **CEVAPLANDI (2026-07-25): 7. menü öğesi.** `EKRANLAR.md`'nin (a) seçeneği; menüde yer vardı, görsel dil değişmedi. Faz 3'te kenar çubuğuna eklendi, içeriği Faz 9'da gelecek. | ~~Faz 9~~ | — |
| **S11** | **Makbuz numarası atlayabilir mi?** Tahsilat penceresi açılıp vazgeçilirse rezerve edilen numara serbest kalmıyor — sıra `2026-7`'den `2026-9`'a atlıyor. Çift tık koruması (K-19) numarayı pencere **açılırken** rezerve etmeyi gerektiriyor, §8 ise "atlamasın" diyordu; ikisi birden olmuyor. Bu muhasebe kararı: makbuz koçanında boşluk kabul edilebilir mi? Bulgu: `DENETIM-PARA > P2` | Faz 10 | **Mevcut davranış kalır** — atlama serbest, çift tık koruması korunur (aynı makbuz iki kez basılamaz) |
| **S9** | Bilgisayarındaki Windows sürümü ne? (SmartScreen ve WebView2 için) | Faz 10 | Windows 10/11, WebView2 kurulu değil varsayılır |
| **S10** | Kod imzalama sertifikası alınacak mı? | Faz 10 | Alınmaz; kullanıcıya yönerge verilir |

---

## 10. Faz sırasının bu rutinlere göre gerekçesi

| Faz | Hangi rutini açar |
|---|---|
| 2–3 | (altyapı — kullanıcıya görünmez) |
| **4** | Yeni öğrenci kaydı (§3a) |
| **5** | Program kurulumu → **Bugün ekranı ilk kez dolar** (§1) |
| **7 (+8)** | Dönem başı tarife ve paket (§5) **ve** ay sonu tahsilat/makbuz (§4) — 2026-07-26'da birleştirildi |
| **6** | Ders sonrası yoklama ve telafi (§2) — paket tüketimini bağlar |
| **10 (+9)** | Özet ekranı, yedekleme ve teslim — Faz 9 kırpılıp buraya katıldı |

> **Sıra 2026-07-26'da değişti** (ürün sahibinin kararı): para fazı yoklamanın **önüne**
> geçti. Gerekçe — uygulamanın adı "ders ve **tahsilat** takip" ve tahsilat hiç yok;
> yoklama ise bir tek yerde paraya değiyor (paket tüketimi, ADR-015) ve o bağ Faz 6'da
> kurulacak şekilde ayrıldı. Ayrıntı `docs/YOL-HARITASI.md`.

**Faz 5 sonunda uygulama ilk kez "gerçek" olur** — Bugün ekranı doluyor. Bu yüzden ADR-008
ilk gerçek Windows testini oraya koydu.
