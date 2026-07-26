# Ekranlar

`design-ref/` altındaki 4 tasarlanmış ekranın envanteri + MVP'de gereken ekranların listesi.
Komponent adları `docs/TASARIM-SISTEMI.md` §6'daki envanterle aynıdır.

> **Bu dosya bir referanstır, plan kaynağı değildir — ADR-039.** Bir ekran yapılırken
> içeriği buradan okunur; **hangi ekranın ne zaman yapılacağı** buradan çıkarılmaz.
> Envanterde her ekran bir satır, oysa sahibinin işinde biri "programı kullanamıyorum",
> diğeri "daha güzel görünüyor" demek. Sıralamanın kaynağı `docs/YOL-HARITASI.md` ve
> `docs/KULLANILABILIRLIK.md`.

---

## Gezinme

Tasarımdaki kenar çubuğu 6 öğe taşıyor:

| # | Menü | Ekran | Durum |
|---|---|---|---|
| 1 | **Bugün** | Açılış ekranı | ✅ tasarlandı |
| 2 | **Takvim** | Hafta / gün görünümü | ✅ tasarlandı |
| 3 | **Öğrenciler** | Liste + detay | ✅ tasarlandı |
| 4 | **Gruplar** | — | ⬜ tasarlanacak |
| 5 | **Ödemeler** | — (menüde borçlu sayısı rozeti var) | ⬜ tasarlanacak |
| 6 | **Tanımlar** | — | ⬜ tasarlanacak |
| 7 | **Raporlar** | — | ✅ **menüye eklendi (Faz 3)** — tasarımda yoktu |

Alt bilgi: kurum adı ve `Sürüm X.Y · Yerel`.
"Yerel" ibaresi kasıtlı: kullanıcıya verinin buluta gitmediğini söylüyor.

> Kenar çubuğunun üst iki satırı iki ayrı kimliktir (**ADR-024**): 1. satır ürün adı
> (`Kurs Takip`, sabit, Aktansoft'un), 2. satır kurum adı (`config/kurum.json`'dan).
> Sürüm numarası elle yazılmaz, `package.json`/`tauri.conf` üzerinden gelir.

> **Karar verildi (2026-07-25, PRD S8): (a) — 7. menü öğesi.** Yol haritasında Faz 9
> "Dashboard ve raporlar" var, tasarımın menüsünde Raporlar yoktu. Menüde yer vardı ve
> görsel dil değişmedi. Faz 3'te kenar çubuğuna eklendi (`src/shell/routes.ts`),
> sayfa placeholder olarak duruyor; **içeriği artık `/faz-10 §0`'da geliyor** — Faz 9 ayrı
> faz olmaktan çıkarıldı (2026-07-26). Menü öğesi kalıyor: E17'nin istediği şey grafik
> değil, `StatCard` şeridi ve üç basit tablo — teslim edilebilir bir kapsam.

---

# Bölüm 1 — Tasarlanmış ekranlar

## 1. Bugün — açılış ekranı

**Kurs sahibi bunu ne zaman açar:** Her sabah, uygulamayı açtığında ilk gördüğü ekran.
Günün üç sorusunu tek bakışta cevaplar: *bugün kimin dersi var, kim yoklama bekliyor, kim
borçlu.*

**Düzen:** İki kolon — `1.7fr` (dersler) / `minmax(322px, 0.9fr)` (yan panel), max 1320px.

### Bölümler

| Bölüm | İçerik |
|---|---|
| Başlık | "Bugün" + `24.07.2026 · Cuma` |
| Arama | `Öğrenci, grup veya ders ara` + `Ctrl K` ipucu |
| Birincil eylem | **Yeni ders** |
| **Bugünkü dersler** | Saat sıralı liste; geçmiş → **şimdi çizgisi** → gelecek |
| **Borcu olan öğrenciler** | Ad + tutar + gecikme gün sayısı |
| **Paketi bitmek üzere** | Ad + kalan ders |
| Yedekleme şeridi | "Son yedekleme: … · otomatik" + **Şimdi yedekle** |

### Gösterdiği veri

**Ders satırı** (`54px / 1fr / 128px / 84px / 190px`):

| Kolon | Kaynak |
|---|---|
| Saat | `session.starts_at` |
| Ders | `subject.name · study_group.name` veya `· öğrenci adı`; altında `Grup` / `Birebir` |
| Öğretmen | `teacher.full_name` — ~~ADR-011'de kaldırılmıştı~~; **ADR-037 ile geri geliyor** (birden fazla öğretmen var) |
| Öğrenci | `n öğrenci` — grupta üye sayısı, birebirde `1 öğrenci` |
| Yoklama | üç durum: `✓ 6/6 katıldı` · **Yoklama al** düğmesi + "girilmedi" · "Bekleniyor" |

**Borç satırı:** ad · `1.200 TL` (kırmızı, kalın) · `12 gün gecikti`
→ **`v_student_debt`** view'inden (ADR-018 — defter tabanlı; eski `v_student_overdue` ders başı
ödeyen öğrencileri hiç göstermiyordu). Gecikme gün sayısı Rust'ta hesaplanır, `today` bind
edilir. Başlıkta özet: `3 öğrenci · 2.450 TL`.

Bu listede **yalnızca canlı öğrenciler** görünür (`is_live = 1`); arşivlenmiş borçlu Ödemeler
ekranındaki borçlu listesinde ve toplam alacakta sayılır ama Bugün ekranında görünmez.

**Paket satırı:** ad · `1` (amber) `ders kaldı` → `v_package_remaining`, eşik `≤ 2`.
Arşivlenmiş öğrencinin paketi bu listeye girmez.

### Yapılabilenler

- Yoklaması girilmemiş dersin **Yoklama al** düğmesine basmak → yoklama paneli
- Ders satırına tıklamak → ders kartı / yoklama
- Yeni ders eklemek · arama · şimdi yedekleme

### Boş durum

| Bölüm | Metin |
|---|---|
| Dersler | "Bugün planlanmış ders yok." |
| Borçlular | "Gecikmiş ödemesi olan öğrenci yok." |
| Paketler | "Paketi bitmek üzere olan öğrenci yok." |

Üçü aynı anda boş olabilir — ekran boş kalmaz, **her bölüm kendi mesajını gösterir.**

### Dikkat çeken davranışlar

- Yoklaması eksik satır **amber zemin + sol turuncu şerit** taşır; sıradan bir satır değil.
- **"Şimdi" çizgisi** yalnızca hem geçmiş hem gelecek ders varsa çıkar.
- Yedekleme gecikince metin gri yerine amber olur.
- Menüdeki **Ödemeler** rozeti borçlu öğrenci sayısını gösterir.

---

## 2. Takvim

**Kurs sahibi bunu ne zaman açar:** Haftalık programı görmek, ders taşımak, yeni ders
yerleştirmek, "bu saat boş mu?" sorusunu cevaplamak için. Hafta içi en çok kullanılan ikinci
ekran.

### Bölümler

| Bölüm | İçerik |
|---|---|
| Üst çubuk | `‹ Bugün ›` · tarih aralığı · öğretmen filtresi · `Hafta \| Gün` · **＋ Ders ekle** |
| Izgara | 56px saat cetveli + 7 gün sütunu (Hafta) / tek sütun (Gün) |
| Açıklama şeridi | 7 blok türü + iki "küçük boyut" örneği |

### Izgara mekaniği

- Dikey aralık **08:00–22:00**, 30 dk = 30px (rahat) / 22px (sıkı)
- Çakışan dersler **şerit (lane) algoritmasıyla** yan yana bölünür
- Geçmiş saatler hafif gölgeli; bugünün sütun başlığı koyu ve `700` ağırlıkta
- **Şimdi çizgisi**: 1.5px `#d59029` + sol nokta + "şimdi" etiketi

### Blok varyantları

| Görünüm | Anlam |
|---|---|
| Gri dolgu (`#e8e3db`) | Grup dersi |
| Beyaz dolgu | Birebir |
| Kesikli kenar | Telafi / tek seferlik |
| Amber + sol şerit + "Yoklama" etiketi | Yoklama girilmedi |
| `opacity: .5` | Geçmiş, yoklaması alınmış |
| Turuncu kontur + `!` | Çakışma |
| Taralı sütun | Tatil / kapalı — **bırakılamaz** |

Blok içeriği: saat aralığı · `Matematik · Grup C` · öğretmen noktası + `Ayşe Demir · 4/6`.
Dar sütunda meta satırı gizlenir.

### Yapılabilenler

- **Sürükle-bırak** ile ders taşımak (30 dk'ya kilitli, 5px eşik)
- Taşıma sonrası kapsam seçmek: **"Sadece bu ders"** / **"Bu ve sonraki dersler"**
- Boş bloğa tıklamak → ders kartı · geçmiş bloğa tıklamak → yoklama paneli
- Hafta/gün değiştirmek, `←` `→` ile gezinmek, ders eklemek

### Boş durumlar — dördü ayrı

| Durum | Başlık | Eylem |
|---|---|---|
| İlk kullanım | "Bu hafta için program tanımlı değil" | **Ders ekle** + **Şablondan oluştur** |
| Hafta tamamen tatil | "Bu hafta tamamen tatil" | — |
| Filtre sonuçsuz | "*X* için ders yok" | **Filtreyi temizle** |
| Gün boş | "Bu gün için ders yok" / "Bu gün kapalı" | **Ders ekle** / — |

### MVP sadeleştirmeleri (~~ADR-011~~ → **ADR-037 / ADR-038**, 2026-07-26)

ADR-011 düştü: kursta **birden fazla öğretmen var.** Güncel hâl:

- **Öğretmen filtresi geri geliyor** — `pages/takvim/filters.ts`'e ikinci eksen olarak
  (ADR-038'in izin verdiği dar istisna). Ders bloğunun meta satırında öğretmen adı görünür.
- **Gün görünümü tek sütun kalıyor.** Öğretmen-başına-sütun düzeni kurulmaz — ızgara
  geometrisini yeniden açmak dondurulmuş takvimin dışında (ADR-034).
- **Çakışma uyarısı gerçekten çalışıyor:** aynı **öğretmen** aynı saatte iki derste
  olamaz. Engellenmez, kaydetmeden önce **onay diyaloğu** çıkar. Bugüne kadar
  `teacher_id` kontrole girmediği için ölü doğuyordu (`DENETIM-FAZ1 > C5`);
  `/faz-07 §0b`'de kapanıyor.

---

## 3. Öğrenciler — liste

**Kurs sahibi bunu ne zaman açar:** Bir öğrenciyi aramak, borçluları görmek, hızlı tahsilat
almak, yeni öğrenci eklemek için.

### Bölümler

| Bölüm | İçerik |
|---|---|
| Başlık | "Öğrenciler" + "Tüm kayıtlı öğrenciler ve durumları" |
| Arama | `Öğrenci adı veya veli telefonu ara`, **otomatik odaklı**, `↵ aç` ipucu |
| Filtre çipleri | Tümü · Aktif · Pasif · Borçlu · Paketi bitiyor — her birinde sayı |
| Tablo | 8 kolon, yapışkan başlık |
| Alt çubuk | "*n* öğrenci gösteriliyor · *m* kayıt" + **Toplam alacak** |
| Sağ çekmece | Satıra tıklayınca açılan hızlı özet |

### Kolonlar

`minmax(160px,1.6fr) 150px 96px 120px 96px 118px 108px 108px`

| Kolon | Kaynak | Biçim |
|---|---|---|
| Ad Soyad | `student.full_name` | taşarsa `…` |
| Veli telefonu | birincil `guardian.phone` | tabular |
| Ders | işlenmiş toplam ders | sağa hizalı |
| **Bakiye** | `v_student_balance` | borçluysa **kırmızı kalın**, değilse nötr |
| **Kalan ders** | `v_package_remaining` | `≤ 2` ise **amber kalın** |
| Son ders | son `session.session_date` | `22.07.2026` |
| Durum | `student.is_active` | dolu yeşil nokta / içi boş halka |
| — | | **Tahsilat al** düğmesi |

### Yapılabilenler

- Ad veya **veli telefonu** ile arama (Türkçe küçültme + rakam normalizasyonu)
- `Enter` → ilk sonucun çekmecesini açar
- Filtre çipleriyle daraltma · satıra tıklayıp çekmece açma · doğrudan tahsilat · yeni öğrenci

### Çekmece (396px)

Avatar + ad + aktiflik · İletişim (veli, telefon) · 2×2 kutu: **Bakiye · Kalan ders ·
Toplam ders · Son ders** · altta **Tahsilat al** + **Düzenle**.

### Boş durumlar — üçü ayrı

| Durum | Metin |
|---|---|
| Hiç öğrenci yok | "Henüz öğrenci kaydı yok" + açıklama + **Yeni öğrenci ekle** |
| Arama sonuçsuz | "*X* için sonuç bulunamadı" + "Ad ya da telefonun bir bölümünü yazmayı deneyin." |
| Filtre sonuçsuz | "Bu filtrede öğrenci yok" + **Tümünü göster** bağlantısı |

---

## 4. Öğrenci detayı

**Kurs sahibi bunu ne zaman açar:** Veli aradığında. "Ne kadar borcu var, kaç dersi kaldı,
en son ne zaman geldi, hangi dersleri kaçırdı" sorularının hepsi burada.

### Bölümler

1. **Geri bağlantısı** — `← Öğrenciler` + `Esc listeye dön`
2. **Kimlik** — avatar · ad · aktiflik rozeti · `Veli … · telefon` · **Düzenle** · **Pasifleştir/Aktifleştir**
3. **Özet şerit** — 4 kart (kolon oranları bağlayıcı, bkz. TASARIM-SISTEMI §8)
4. **Sekmeler** — Kayıtlar · Ders geçmişi · Ödemeler · Notlar (her birinde sayı)

### Özet şerit

| Kart | İçerik | Boş hâli |
|---|---|---|
| **Bakiye** | 30px tutar (borçluysa kırmızı) + "12 gün gecikmiş" + **Tahsilat al** | "Tarife henüz tanımlı değil" |
| **Devam oranı** | `%92` + "↑ son 8 haftada +6 puan" | `—` + "Henüz ders işlenmedi" |
| **Kalan ders** | `2` (≤2 ise amber) + "≈ 31 Temmuz'da biter" | `—` + "Aktif kayıt yok" |
| **Sıradaki ders** | "Yarın · 16:00" + ders adı + öğretmen | "Planlı ders yok" |

### Sekme içerikleri

**Kayıtlar** — `enrollment` tablosu.
Kolonlar: Kurs/grup · Tarife · Başlangıç · Taksit durumu.
Taksit durumu renklidir: `4/4 ödendi` yeşil · `2/4 ödendi` nötr · `1/3 gecikmiş` kırmızı ·
`Kapandı` gri.
Boş: "Henüz kayıt yok" + **Kayıt ekle**.

**Ders geçmişi** — `attendance` + `session`.
Kolonlar: Tarih · Ders · Durum · Telafi.
Durum: Geldi (yeşil) · Mazeretli (amber) · Mazeretsiz (kırmızı) · İptal (içi boş halka).
Telafi kolonu üç hâlli: **Telafi planla** düğmesi · `Telafi · 18.07 ✓` · `—`.
Boş: "Henüz işlenmiş ders yok."

**Ödemeler** — `payment` + `payment_allocation`.
Kolonlar: Tarih · Tutar · Ödeme tipi (Nakit/Kart/Havale) · **Mahsup edildiği taksit**.
Altta sağa hizalı **Toplam tahsilat**.
Boş: "Henüz tahsilat kaydı yok."

**Notlar** — `student_note`. Üstte yazma kutusu ("Girişler tarihiyle kaydedilir" +
**Not ekle**), altında yazar + tarih + gövde listesi. Yazar öğretmen ya da "Ofis" olabilir.
Boş: "Henüz not eklenmemiş. İlk notu yukarıdan ekleyin."

### Yapılabilenler

Düzenle · pasifleştir/aktifleştir · tahsilat al · kayıt ekle · telafi planla · not ekle ·
sekmeler arası `←` `→` · `Esc` ile listeye dönüş.

### Dört senaryo tasarımda hazır

`normal` (borçlu, dolu) · `sıfır bakiye` · `yeni öğrenci` (her şey boş) · `pasif`
(kayıt kapatılmış). Faz 4'te dördü de test edilecek.

---

# Bölüm 2 — Tasarlanacak ekranlar

Tasarımda 4 ekran var; MVP'de aşağıdakiler gerekiyor. Hepsi **mevcut komponentlerle**
kurulacak — yeni görsel dil icat edilmeyecek.

## Faz 4 — Öğrenci ve veli

### E1. Yeni öğrenci / Düzenle
`Drawer` (396px) · `SearchInput` deseninde girdiler · alt eylem çubuğu (`Kaydet` primary +
`Vazgeç` ghost). Veli bölümü: ad, telefon, yakınlık, "birincil veli" işareti.
Boş yok — form. Doğrulama hataları girdi altında Türkçe ve **eylem öneren** metinle.

### E2. Arşiv görünümü
`Öğrenciler` ekranının aynısı + çipe **Arşivlenmiş** eklenir. Satır sonundaki düğme
"Tahsilat al" yerine **Geri al**. Boş: "Arşivlenmiş öğrenci yok."

## Faz 5 — Ders, grup, takvim

### E3. Ders ekle / düzenle
`Modal` (384px). Alanlar: tür (birebir/grup) `SegmentedControl` · branş `Select` ·
grup veya öğrenci `Select` · tarih · saat · süre · **tekrar** (tek seferlik / haftalık).
Çakışma varsa kaydetmeden önce `Modal` içinde uyarı + "Yine de ekle".
Tatil gününe denk gelirse kaydetme engellenir.

### E4. Gruplar — liste
`DataTable`. Kolonlar: Grup adı · Branş · Öğretmen · Doluluk (`4/6`) · Haftalık ders ·
Durum · eylem. Çipler: Tümü · Aktif · Dolu · Boş kontenjan.
Boş: `EmptyState` "Henüz grup yok" + **Yeni grup**.

### E5. Grup detayı
**Özet şerit kolonları Öğrenci detayı ile aynı olacak** — tasarım dosyasındaki HTML yorumu
bunu açıkça şart koşuyor. Kartlar: Doluluk · Haftalık program · Devam oranı · Sıradaki ders.
Sekmeler: Öğrenciler (katılım/ayrılış tarihleriyle) · Seans geçmişi · Notlar.
Öğrenci ekleme kapasiteyi aşarsa onay diyaloğu.

### E6. Şablondan oluştur
`Modal`. Kaynak hafta seçimi + önizleme listesi + "Şu tarihten itibaren uygula".

### E7. Tanımlar → Branşlar
Basit `DataTable` + satır içi düzenleme. Renk seçimi kategori paletinden (5 renk).

### E8. Tanımlar → Tatil / kapalı günler
`DataTable` (tarih · açıklama) + haftalık kapalı gün seçimi. Takvim buradan besleniyor.

## Para fazı §0 — kurs sahibinin kendi programını tanımlaması

> Bu iki ekran tasarımda ayrı çizilmemişti ve plan onları en sona atmıştı; **ADR-039**
> bunun neden bir yönetim hatası olduğunu anlatıyor. Yapıldıkları yer `/faz-07 §0`.

### E21. Tanımlar → Öğretmenler — **ADR-037**
`DataTable` + ekle/düzenle. Kolonlar: ad · renk · telefon · e-posta · durum · eylem.
Renk kategori paletinden. Arşivleme `deleted_at` ile, kullanıcıya "Arşivle".
Boş durum pratikte görünmez — migration tek satır yazıyor — ama yine de yazılır.

### E18. Tanımlar → Genel *(Faz 10'dan alındı)*
Çalışma saatleri · slot ve varsayılan ders süresi · seans ufku · haftalık kapalı gün ·
satır yoğunluğu · **devamsızlık politikası (2 satır — para politikası)** · paket geçerlilik
gün sayısı · makbuz numarası öneki · yedek uyarı eşiği. Hepsi `setting` tablosuna yazar.

> **Kurum adı bu ekranda YOK (ADR-024).** Derleme zamanı `config/kurum.json`'dan geliyor;
> kurs sahibi değiştiremez, değişiklik yeniden derleme gerektirir. `receipt_next_no` ve
> `last_backup_at` da yok — onları program yazar, kullanıcı değil.

## Faz 6 — Yoklama ve telafi

### E9. Yoklama paneli
`Drawer` (396px). Başlıkta ders adı, tarih, saat. Öğrenci listesi; her satırda 4 durumlu
`SegmentedControl`: **Geldi · Mazeretli · Mazeretsiz · İptal**. Üstte "Hepsi geldi" kısayolu.
Altta **Kaydet** ve etkilerinin özeti: *"3 ders hakkı düşecek, 750 TL borç yazılacak."*
Bu özet kritik — kullanıcı ne olacağını kaydetmeden önce görmeli.
Boş: gruba kayıtlı öğrenci yoksa "Bu derse kayıtlı öğrenci yok."

### E10. Telafi planla
`Modal`. Kaçırılan ders bilgisi + tarih/saat seçimi + çakışma kontrolü.
Oluşan seans takvimde **kesikli kenarlı** blok olarak görünür.

## Faz 7 — Tarife ve paket

### E11. Tanımlar → Tarifeler
`DataTable`. Kolonlar: Ad · Tip (Ders başı / Paket / Dönemlik) · Birim ücret · Ders sayısı ·
Geçerlilik. Fiyat değiştirmenin **geçmişi bozmadığı** ekranda yazılı olacak (ADR-006).
Boş: "Henüz tarife tanımlanmadı" + **Yeni tarife**.

### E12. Paket sat
`Modal`. Öğrenci · tarife · ders sayısı · toplam tutar · indirim · **taksit planı**
(sayı + ilk vade → otomatik satır üretimi, elle düzeltilebilir).
Altta özet: *"8 ders · 2.000 TL · 2 taksit — ilk vade 01.03.2026."*

## Faz 8 — Tahsilat

### E13. Tahsilat al
`Modal`. Tutar · tarih · yöntem (`SegmentedControl`: Nakit/Kart/Havale) · **açık taksitler
listesi** (otomatik mahsup önerisi, elle değiştirilebilir) · makbuz numarası.
Artan tutar için: *"420 TL avans olarak kalacak."*

### E14. Ödemeler — borçlu listesi
`DataTable`. Kolonlar: Öğrenci · Veli telefonu · Borç · En eski vade · Gecikme · eylem.
Çipler: Tümü · Gecikmiş · Bu ay vadesi gelen · Avansı olan.
Alt çubukta toplam alacak. Menüdeki rozet bu ekranın sayısını gösteriyor.
Boş: "Borcu olan öğrenci yok." — **iyi haber olarak gösterilmeli**, boş liste gibi değil.

### E15. Cari ekstre
Tek öğrencinin `ledger_entry` dökümü: tarih · açıklama · borç · alacak · **yürüyen bakiye**.
`DataTable`, tabular sayılar. "Bu öğrenci neden bu kadar borçlu" sorusunun cevabı (ADR-004).
Dışa aktarım: CSV (**BOM'lu UTF-8**) ve PDF.

### E16. Makbuz (PDF)
Ekran değil, çıktı. Kurum adı · makbuz no · tarih · öğrenci/veli · tutar (rakam ve yazı) ·
ödeme yöntemi. **Gömülü font zorunlu** — ğ/ş/İ/ı için.

## ~~Faz 9~~ → Faz 10 §0 — Raporlar

> Faz 9 ayrı faz olmaktan çıkarıldı (2026-07-26); E17 olduğu gibi `/faz-10 §0`'a taşındı.
> Aşağıdaki kapsam **değişmedi** — zaten grafik istemiyordu.

### E17. Raporlar
Yeni 7. menü öğesi. `StatCard` şeridi (aylık tahsilat, işlenen ders, devam oranı, aktif
öğrenci) + basit tablolar: aylık tahsilat, branş bazında ders, devamsızlık dökümü.
Grafik **gerekli değil** — tasarımda hiç grafik yok, sayı ve tablo dili hâkim.
Boş: "Bu dönem için veri yok."

## Faz 10 — Yedekleme

> **E18 buradan alındı** (2026-07-26): işletme ayarları para fazının §0'ına taşındı,
> gerekçesi **ADR-037**. Tanım yukarıda, "Para fazı §0" başlığı altında.

### E19. Tanımlar → Yedekleme
Son yedeklemeler listesi (`backup_log`) · **Şimdi yedekle** · **Geri yükle** (çift onaylı,
yıkıcı) · yedek klasörünü aç. Bugün ekranındaki şerit buraya bağlanır.

## Faz 3 — Kabuk

### E20. Global arama (`Ctrl K`)
`Modal` içinde `SearchInput` + gruplanmış sonuç listesi (Öğrenci / Grup / Ders).
Tasarımda iki ekranda ipucu var ama paneli çizilmemiş.

---

## Özet

| | adet |
|---|---|
| Tasarlanmış | **4** |
| Tasarlanacak | **20** |
| Yeni komponent gerektiren | **0** — hepsi §6 envanterinden kuruluyor |

Tek yeni desen: **E9 yoklama panelindeki "ne olacak" özeti**. Mevcut komponentlerle
kuruluyor ama tasarımda karşılığı yok; para etkisi olan tek toplu işlem olduğu için
kaydetmeden önce sonucu göstermek gerekiyor.
