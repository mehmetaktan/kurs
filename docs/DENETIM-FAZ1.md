# Faz 1 Denetimi

**Tarih:** 2026-07-25 · **Durum:** bulgular onaylandı, düzeltmeler dağıtıldı

> **Bu dosya bir arşivdir, takip listesi değildir — ADR-039.** Kapanmamış bir bulgunun
> yaşadığı yer `docs/DURUM.md`'nin borç tablosudur. `C5` tam olarak buraya yazılıp
> oraya yazılmadığı için Faz 5A/5B/5C boyunca kayboldu.
>
> **Tarama (2026-07-26, yönetici):** **C bölümünün tamamı** kod üzerinde doğrulandı —
> C1, C3, C4, C6, C7, C8, C10 kapandı; C2 ve C9 faz komutlarında yazılı; **C5 açıktı ve
> `/faz-07 §0b`'ye taşındı** (ADR-037). **A ve B bölümleri bu oturumda taranmadı** —
> düzeltmelerinin çoğu Faz 2'de uygulanmış görünüyor ama satır satır doğrulanmadı.

Faz 1 çıktısı (21 tablo, 3 view, 4 trigger, PRD, ekran envanteri, 17 ADR) Faz 2 başlamadan
önce denetlendi. Gerekçe: şema şu an **belge**; Faz 2'de gerçek SQL'e dönüşecek. Bugün
düzeltmek bedava, sonra migration + veri taşıma demek.

**Yöntem.** 6 bağımsız denetçi (DDL çalışabilirliği · para/defter mantığı · ADR uyumu ·
tasarım-şema kapsamı · faz planı · Windows teslim riski), ardından her bulgu için ayrı bir
**çürütücü** — görevi iddiayı yanlışlamak. SQL iddiaları tahmin edilmedi, `sqlite3 3.51` ile
gerçek veritabanında **çalıştırıldı**. 37 ajan, 680 araç çağrısı.

**Sonuç.** 30 bulgunun 30'u ayakta kaldı; birkaçının şiddeti doğrulamada düşürüldü
(en dikkat çekeni: UTC bulgusu `blocker` → `orta`). Tekrarlar ayıklanınca **25 ayrı sorun**.

| Şiddet | Adet | Ne demek |
|---|---|---|
| Yüksek | 8 | Para yanlış hesaplanıyor, veri kaybediliyor ya da bir gereksinim imkânsız |
| Orta | 7 | Kullanıcı yanlış bilgi görüyor ya da bir akış tıkanıyor |
| Düşük | 10 | Eksik ama tek satırlık; erken düzeltilirse ucuz |

---

## A. Yüksek

### A1 — Borçlu listesi ders başı ödeyen öğrencileri hiç görmüyor

*Bulgu: 3 ayrı denetçi bağımsız buldu (para, adr, ekran).*

**Nerede.** `VERI-MODELI.md §1.23 v_student_overdue` ↔ `EKRANLAR.md §1` + `E14` ↔ `PRD R1.3, R4.1`

**Sorun.** `v_student_overdue` yalnızca `installment` tablosundan besleniyor. Ders başı
(`per_session`) ödeyen öğrencinin borcu ise `ledger_entry(session_charge)` olarak doğuyor ve
**hiç `installment` satırı üretmiyor**. Sonuç: aylardır ödemeyen ders başı öğrenci Bugün
ekranının "Borcu olan öğrenciler" bölümünde ve Ödemeler rozetinde **hiç görünmüyor** — ama
Öğrenciler ekranında kırmızı `−1.000 TL` olarak duruyor. Aynı öğrenci iki ekranda iki farklı
borç gösteriyor. `adjustment` (geçmişten devir borç) da aynı şekilde görünmez.

PRD §0: *"Kim ne kadar borçlu? — bunlardan biri yanlış cevaplanırsa uygulama başarısızdır."*

**Düzeltme.** Borçlu listesinin tek kaynağı **defter** olsun (ADR-004'ün zaten söylediği).
Kilit gözlem: defterdeki her negatif satır tanımı gereği vadesi gelmiş borçtur —
`session_charge` işlendiği gün yazılır, `installment_charge` ADR-015 gereği yalnızca vadesi
gelince yazılır. Tutar `−bakiye`; eksik olan tek parça **vade tarihi**, o da defter üzerinde
FIFO yaşlandırmayla bulunur:

> **Sonraki not (Faz 2 denetimi → ADR-022).** Aşağıdaki `v_ledger_effective` tanımı bu
> denetimde yazıldığı hâliyle duruyor ve **artık geçerli değil**: ters kayıt zincirinin en
> fazla iki halkalı olacağını varsayıyor, üç halkalı zincirde borcu görünmez kılıyor.
> Yürürlükteki tanım `VERI-MODELI.md §1.23`'te (zincir paritesi). Bu bölüm tarihsel kayıt
> olarak değiştirilmedi.

```sql
-- Ters kayıtları netleyen yardımcı görünüm (ESKİ — ADR-022 ile değişti)
CREATE VIEW v_ledger_effective AS
SELECT l.* FROM ledger_entry l
WHERE l.deleted_at IS NULL
  AND l.kind <> 'reversal'
  AND NOT EXISTS (SELECT 1 FROM ledger_entry r
                  WHERE r.reverses_id = l.id AND r.deleted_at IS NULL);

-- Her borç satırı kendi vadesiyle: taksitte due_on, ders başında ders günü
CREATE VIEW v_open_charge AS
SELECT l.student_id,
       COALESCE(i.due_on, l.entry_date) AS due_on,
       -l.amount                        AS charge_kurus
FROM v_ledger_effective l
LEFT JOIN installment i ON i.id = l.installment_id AND i.deleted_at IS NULL
WHERE l.amount < 0;
```

`v_student_overdue` **kaldırılmaz**, görevi daraltılır: yalnızca taksit/vade ekranları
(E14 "Bu ay vadesi gelen" çipi, paket detayındaki `2/4 ödendi`) için kullanılır.
Borçlu listesi ondan üretilmez.

**Faz.** View DDL'i Faz 2 · sonuçları Faz 8/9'da görünür. **ADR gerektirir.**

---

### A2 — Defterin değişmezlik mührü delik: `deleted_at` serbest

*Bulgu: 2 denetçi (ddl, adr). `sqlite3` ile çalıştırılarak doğrulandı.*

**Nerede.** `VERI-MODELI.md §1.19 trg_ledger_immutable`

**Sorun.** Tetikleyici yalnızca `BEFORE UPDATE OF student_id, entry_date, kind, amount`
üzerinde. `deleted_at`, `memo`, `attendance_id`, `installment_id`, `payment_id`,
`reverses_id` **korumasız**. Bütün view'lar `deleted_at IS NULL` süzdüğü için tek bir UPDATE
muhasebe kaydını yok eder — ters kayıt yazmadan, iz bırakmadan. ADR-005'in "hard delete yok"
kuralı burada soft delete kılığında hard delete'e dönüşüyor.

Daha kötüsü: `installment.accrued_entry_id` dolu kaldığı için tahakkuk fonksiyonu o taksidi
bir daha yazmaz — **borç kalıcı olarak kaybolur**. Ayrıca kısmi UNIQUE indeksler de
`deleted_at IS NULL` filtreli olduğu için mühür kalkar ve ikinci kez borç yazılabilir hale gelir.

`§1.19` "deleted_at her zaman NULL kalır" diyor ama bunu **hiçbir şey zorlamıyor**.

**Düzeltme.** İkisi birlikte gerekli — çürütücü test etti, tek başına hiçbiri yetmiyor:

```sql
-- 1) Tablo tanımında: "doğuştan silinmiş" satırı INSERT anında reddeder
deleted_at  TEXT CHECK (deleted_at IS NULL)   -- ADR-014: şema tekdüzeliği için var

-- 2) Sütun listesi kaldırılır: UPDATE'in tamamı kapanır ve
--    ileride tabloya sütun eklenirse delik yeniden açılmaz
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE ON ledger_entry
BEGIN SELECT RAISE(ABORT, 'ledger_entry_is_immutable'); END;
```

**Faz.** Faz 2 (`001_initial.sql`).

---

### A3 — Ters kayıt mühürsüz: iki kez iptal iki kez alacak yazıyor

*Bulgu: 2 denetçi (ddl, para).*

**Nerede.** `VERI-MODELI.md §1.19 reverses_id`, `§4` iptal tablosu, `§6` test listesi

**Sorun.** `reverses_id` sıradan bir nullable FK. Şemada ne (a) bir satırın en fazla bir kez
ters kaydedilmesini, ne (b) ters kaydın tutarının orijinalin tam tersi olmasını, ne (c)
`kind='reversal'` iken `reverses_id`'nin dolu olmasını sağlayan bir kısıt var. `§6` "iki kez
iptal iki iade yapmaz" diyor ama bunu **yalnızca Rust koduna** bırakıyor.

Paket tarafında aynı kural `ux_pkgusage_att` ile mühürlenmiş; defter tarafında mühürsüz —
asimetri. Çift tık, retry ya da transaction yeniden denemesi öğrenciye **karşılıksız alacak**
yazar ve K5 gereği bu satır silinemez.

**Düzeltme.**

```sql
-- ledger_entry TABLO TANIMINA (SQLite'ta sonradan ADD CONSTRAINT yok):
CHECK ((kind = 'reversal') = (reverses_id IS NOT NULL))

-- Bir satır en fazla BİR kez ters kaydedilir
CREATE UNIQUE INDEX ux_ledger_reverses ON ledger_entry(reverses_id)
  WHERE reverses_id IS NOT NULL AND deleted_at IS NULL;
```

> Çürütücü notu: ilk önerilen `kind` filtresiz indeks **fazla genişti** — aynı `payment`
> satırına bağlı iki kısmi iade (`adjustment`) satırını da bloke ediyordu (test: exit=19).
> Yukarıdaki hâli `CHECK` ile birlikte doğru davranıyor.

**Faz.** Faz 2.

---

### A4 — Birebir derste tahakkuk sessizce başarısız oluyor

**Nerede.** `VERI-MODELI.md §5 Senaryo 1` (`INSERT INTO ledger_entry ... JOIN enrollment`) + `§1.15 session.unit_price`

**Sorun.** Üç ayrı arıza tek yerde:

1. Tahakkuk `INSERT ... SELECT` ile `enrollment`'a JOIN ediyor. **Eşleşme yoksa sorgu 0 satır
   yazar ve hata vermez** — ders işlenmiş, öğrenci borçlanmamıştır. Kullanıcı bunu asla öğrenmez.
   (Tek seferlik deneme dersi, ya da kayıt tarihi seansı kapsamıyorsa.)
2. Fiyat zammı için ikinci `enrollment` açılıp eskisi kapatılmayı unutulursa JOIN **iki satır**
   üretir, `ux_ledger_attendance` UNIQUE hatası verir ve PRD R2.4 gereği **tüm yoklama
   transaction'ı düşer**. Şemada aynı öğrenci+branş için çakışmayan aralık zorunlu kılan hiçbir
   kısıt yok — oysa ADR-013 "çakışmayan iki enrollment satırı" varsayıyor.
3. ADR-013 gereği birebir kayıtta `study_group_id` NULL olduğu için
   `trg_attendance_within_enrollment` **çalışmıyor**; birebir dersin kayıt aralığı içinde
   olduğunu hiçbir şey garanti etmiyor.
4. `session.unit_price` sütunu ("tek seferlik ders için snapshot") belgedeki **hiçbir sorguda
   kullanılmıyor** — CLAUDE.md'nin "seans kaydına ücret snapshot'ı yazılır" kuralı fiilen
   uygulanmıyor.

> Çürütücünün elediği yanlış çözümler: *"tahakkuk `−s.unit_price` kullansın"* grup dersinde
> çöker (tek `session` satırı N öğrenciye hizmet ediyor, her birinin snapshot'ı farklı olabilir);
> *"trigger'ın `WHEN`'ini kaldır, birebiri de zorunlu kıl"* tek seferlik dersi ve deneme dersini
> fiziksel olarak imkânsız hâle getirir (EKRANLAR E3 "tekrar: tek seferlik").

**Düzeltme yönü.** Tahakkuk `INSERT...SELECT` olmaktan çıkıp Rust'ta iki adım olmalı:
önce fiyat kaynağı **açıkça çözülür** (enrollment → yoksa `session.unit_price` → yoksa **hata**),
sonra tek satır yazılır. "Fiyat bulunamadı" sessiz geçilmez, kullanıcıya PRD §8 dilinde sorulur:
*"Bu ders için tarife bulunamadı. Ders başı ücret yazılsın mı?"* Ayrıca aynı öğrenci + branş +
birebir için çakışmayan `enrollment` aralığı bir kısıtla zorlanmalı.

**Faz.** Şema kısmı Faz 2 · fonksiyon sözleşmesi Faz 6/7.

---

### A5 — Taksit sistemi sahipsiz: hiçbir faz komutunda geçmiyor

**Nerede.** `.claude/commands/faz-07.md`, `faz-08.md` (tamamı)

**Sorun.** Faz 1 iki yeni tablo üretti (`installment`, `payment_allocation`) ve bir açılış işi
tanımladı (`accrue_due_installments`). **"taksit", "installment", "mahsup", "allocation"
kelimeleri 9 faz komutunun hiçbirinde geçmiyor.** faz-07 §2 paket satışını "öğrenci, branş,
ders adedi, toplam tutar, geçerlilik bitişi" diye tarif ediyor — taksit planı yok; faz-08 §1
tahsilatı tarif ediyor — açık taksitlere mahsup yok.

Sonuç: tasarımın `2/4 ödendi`, `1/3 gecikmiş`, "Mahsup edildiği taksit" kolonu ve Bugün
ekranındaki "12 gün gecikti" satırı **üretilemez**.

**Faz.** Faz komutu düzeltmesi — yönetici işi.

---

### A6 — WAL modunda alınan yedek boş çıkar, doğrulama bunu "sağlam" der

**Nerede.** `VERI-MODELI.md §0` (`PRAGMA journal_mode = WAL`) + `§1.22 backup_log` + `faz-10.md §1–2`

**Sorun.** WAL'da commit edilmiş veri, checkpoint olana kadar ana `.db` dosyasında **değil**,
`.db-wal` dosyasında durur. Belge yedeklemeyi "veritabanının tarihli kopyası" olarak
tanımlıyor ve hiçbir yerde `VACUUM INTO` ya da `sqlite3_backup` API'sini şart koşmuyor.
"Şimdi yedekle" düğmesi tanımı gereği uygulama **açıkken** basılır → sadece `.db` kopyalanırsa
yedek kullanılamaz.

Daha kötüsü: faz-10.md'nin "yedek dosyası bozuk mu diye açılışta doğrulanır" kontrolü bu yedeği
**geçirir** — dosya bozuk değil, geçerli ve boş. `integrity_check` `ok` der.

Teknik olmayan, tek başına çalışan, verisini kurtaracak kimsesi olmayan kullanıcı için bu
senaryonun sonu **tam veri kaybı**.

**Düzeltme.** Yedek = `VACUUM INTO 'hedef.db'` (tek dosya, WAL'ı içine katlar, açık bağlantıyla
güvenli). Kopyalama yasak. **ADR gerektirir** — ADR-001 "yedekleme dosyayı kopyalamaya iner"
diyor, bu cümle düzeltilmeli.

**Faz.** Karar Faz 2'de alınmalı, uygulama Faz 10.

---

### A7 — "Yedekten geri yükle" bayat `-wal` dosyası yüzünden sessizce hiçbir şey yapmıyor

**Nerede.** `faz-10.md §2` ("Yedekten geri yükle: çift onaylı")

**Sorun.** A6'nın ikizi, ters yönde. Geri yükleme sırasında yalnızca `.db` dosyası
üzerine yazılırsa, yanındaki eski `-wal` ve `-shm` dosyaları yerinde kalır ve SQLite açılışta
onları uygular — kullanıcı yedeği geri yükler, ekranda **hiçbir şey değişmez**. Kullanıcının
tek kurtarma yolu çalışmıyor ve başarısız olduğunu söylemiyor.

**Düzeltme.** Geri yükleme, `-wal`/`-shm` dosyalarını da silen tek bir işlem olmalı ve
işlem öncesi mevcut veritabanının otomatik kopyası alınmalı.

**Faz.** Faz 10 · karar Faz 2.

---

### A8 — Borçlu öğrenciyi arşivlemek borcu bütün ekranlardan siliyor

**Nerede.** `VERI-MODELI.md §1.23` — `v_student_balance` (`WHERE s.deleted_at IS NULL`) ve
`v_package_remaining` (öğrenciye hiç bakmıyor)

**Sorun.** PRD K-14 borcu olan öğrenciyi arşivlemeyi "Onay iste" seviyesinde tutuyor — yani
**arşivlenebilir**. Arşivlenince `v_student_balance` o öğrenciyi tamamen düşürüyor: borcu
"Toplam alacak" tutarından da, borçlu listesinden de siliniyor. ADR-005'in gerekçesi tam
tersini söylüyordu: *"silinen öğrencinin geçmiş tahsilatları muhasebe kaydı olarak durmak
zorunda."*

Aynı anda `v_package_remaining` öğrencinin `deleted_at`'ine **hiç bakmıyor** — arşivlenen
öğrencinin paketi Bugün ekranının "Paketi bitmek üzere" listesinde görünmeye devam ediyor.
İki view aynı öğrenci hakkında zıt davranıyor.

**Faz.** Faz 2 (view DDL) · etkisi Faz 4 ve Faz 8/9.

---

### A9 — Tükenmiş paket sonsuza kadar `active` kalıyor

**Nerede.** `VERI-MODELI.md §1.11 package.status` + `§1.23 v_package_remaining` + `§6 consume_package`

**Sorun.** `package.status`'u `'exhausted'` / `'expired'` yapan **hiçbir mekanizma tanımlı
değil**. `v_package_remaining` yalnızca `status='active'` paketleri sayıyor. Status hiç
güncellenmezse: kalan hak **eksiye düşer**, yeni satılan paket hiç kullanılmaz (en eskisinden
düşüldüğü için), ve o dersler için **borç da yazılmaz** — öğrenci bedava ders alır.
PRD R5.12 ve K-7 bu davranışa dayanıyor.

Ayrıca `status` türetilebilir bir değerin saklanması — ADR-004'ün "türetilmiş değeri saklama"
ilkesiyle gerilimde.

**Faz.** Faz 7 · view/tetikleyici kararı Faz 2.

---

## B. Orta

### B1 — `datetime('now')` UTC döndürüyor; ADR-017 "yerel duvar saati" diyor

*3 denetçi buldu. Doğrulamada `blocker` → `orta` düşürüldü.*

`§0 K6` "yerel duvar saati metni, UTC yok" diyor; aynı belgenin iki satır aşağısı her tabloya
`DEFAULT (datetime('now'))` koyuyor. SQLite'ta `'now'` **`TZ` ortam değişkeninden bağımsız
olarak daima UTC**. Çalıştırılarak doğrulandı (makine saati 02:14 İstanbul):

```
yerel duvar saati                     : 2026-07-25 02:14:08 +03
datetime('now')                       : 2026-07-24 23:14:08     ← bir önceki gün
datetime('now','localtime')           : 2026-07-25 02:14:08
```

Kullanıcıya dokunan iki yer:
- `v_student_overdue`'daki `due_on <= date('now')` → 00:00–03:00 arasında **bugün vadesi gelen
  taksitler gecikmiş listesine hiç girmiyor** (test: 1 yerine 0 satır).
- Satır 831'deki `julianday('now') - julianday(oldest_due_on)` → "12 gün gecikti" yerine
  **"11 gün gecikti"** yazıyor.

Neden `blocker` değil: `created_at`/`updated_at` hiçbir ekranda gösterilmiyor (EKRANLAR.md ve
PRD.md'de `created_at` geçmiyor), kullanıcıya görünen tüm tarihler ayrı iş sütunlarında ve
Rust yazıyor. Para hesabı yanlış çıkmıyor; günün 3 saatinde borçlu listesi eksik gösteriyor.

**Düzeltme.** View'a "bugün"ü hiç gömme — `accrue_due_installments(today)` zaten `today`'i
parametre alıyor, aynı kalıp: aggregate Rust sorgusuna taşınır, tarih bind edilir (böylece
test CI'ın saat dilimine bağlı olmaz). `DEFAULT`'lar `datetime('now','localtime')` olur.
`§0`'a tek satırlık kural eklenir:

> SQL içinde `'now'` çıplak kullanılmaz. Kullanıcıya görünen hiçbir hesap SQLite saatini
> okumaz; tarih Rust'tan bind edilir. Kalan yerlerde `'localtime'` zorunludur.

Bu kural asıl kazanç — aynı hatanın Faz 7/8/9'da yeni sorgularda tekrar doğmasını engeller.
Uyarı: `'localtime'` içeren ifade **indekslenemez**.

### B2 — Yoklama düzeltmesi ikinci kez yapılamıyor, uygulama tıkanıyor

`ux_ledger_attendance` ve `ux_pkgusage_att` bir yoklama için ömür boyu tek `session_charge` ve
tek `(attendance_id,−1)` satırına izin veriyor. Gerçek akış: yanlışlıkla "Geldi" → düzeltilir
"Mazeretli" → veli itiraz eder, tekrar "Geldi" → **UNIQUE ihlali**. Kullanıcı o yoklamayı bir
daha asla doğru duruma getiremez ve gösterilecek anlamlı bir mesaj bile yok. PRD §7 "Yoklama
düzeltme ✅ geri alınabilir" diyor.

**Düzeltme.** İndeksler **değişmez** (K-4 korunur). Düzeltme ikinci bir `session_charge` ile
değil, **ters kaydın tersiyle** yazılır — ADR-014'ün zaten öngördüğü mekanizma, ek DDL
gerektirmiyor. `§4`'e bu iki satırlık örnek eklenmeli ki Faz 6'da kimse ikinci charge yazmaya
kalkmasın. `package_usage` tarafında `ux_pkgusage_att` (`attendance_id, delta`) benzer şekilde
gözden geçirilmeli.

### B3 — İptal edilen tahsilat borçlu listesinden öğrenciyi kaybediyor

Ters kayıt yalnızca `ledger_entry`'ye yazılıyor; `payment_allocation` satırları yerinde
kalıyor. `v_student_overdue` mahsubu allocation'dan okuduğu için taksit hâlâ "ödenmiş"
sayılıyor. Sonuç: **bakiye −1.000 TL, gecikmiş 0 TL** — para geri alınmış, öğrenci gerçekten
borçlu, ama borçlu listesinde yok.

**Düzeltme.** Şema değişikliği gerekmiyor. `§4`'ün eşdeğeri bir bölüm yazılmalı: *"Tahsilat
iptal edilirse defterde ve mahsupta ne olur"* — ters kayıt + o tahsilatın tüm
`payment_allocation` satırlarının arşivlenmesi, tek transaction. **`payment.deleted_at` asla
doldurulmaz** (kural olarak yazılmalı): `ux_receipt` kısmi indeksi yüzünden arşivlenen
tahsilatın makbuz numarası yeniden kullanılabilir hâle geliyor — PRD §7 ihlali (test: MKB-003
iki kez yazıldı).

### B4 — Grup ve branş adı Türkçe harfle aranamıyor

`student.search_name` çözümü `subject` ve `study_group`'a uygulanmamış. Bugün ekranının arama
kutusu "Öğrenci, **grup veya ders** ara" diyor. Kullanıcı "ingilizce" yazınca "İngilizce"
bulunmuyor. Davranış üstelik **tutarsız**: ASCII `I` ile başlayan "Ilkbahar Grubu" *bulunuyor*.

**Düzeltme.** `subject` ve `study_group`'a `search_name` eklenir ve UNIQUE indeksler
`name`'den `search_name`'e **taşınır** (asıl kazanç bu: mükerrer branş kaydı da engellenir).
Ek arama indeksi gerekmiyor — 15 satırlık tabloda kazanç yok.

### B5 — Türkçe sıralama hiçbir yerde çözülmemiş

CLAUDE.md "Türkçe sıralama ve arama: `İ/ı` sorunu çözülmüş olmalı" diyor. VERI-MODELI arama
tarafını çözmüş, **sıralama tarafına hiç değinmemiş**. SQLite'ta `localeCompare('tr')`
karşılığı yok (`COLLATE NOCASE` ASCII-only). `ORDER BY full_name` yazılırsa Ç/Ö/Ş/Ü/İ ile
başlayan her öğrenci listenin **en altına, Z'den sonraya** düşer. İlk açılışta gözle görülür.

**Düzeltme (yazılmamış karar, `§0`'a K7 olarak kilitlensin).** Türkçe metin kolonlarında SQL'de
`ORDER BY` **yazılmaz**; sıralama tek yerde, `src/lib/sortTr.ts` içindeki tek bir
`Intl.Collator('tr')` ile yapılır. Repository bu listeleri sırasız döndürür. ~100 öğrenci için
maliyet ölçülemez. **Yasak yalnızca Türkçe metin kolonları için** — tarih, tutar, sayı ve
`sort_order` kolonlarında `ORDER BY` serbest ve gerekli.

> Rust'a kayıtlı özel bir collation `CREATE TABLE`/`INDEX`'e yazılırsa `.db` dosyası başka bir
> araçla açılamaz hale gelir — Faz 10 yedek/onarım riski. Bu yüzden collation değil, uygulama
> katmanı.

### B6 — `faz-07.md` ADR-015'i tam tersine uyguluyor

faz-07.md §3 aynen şunu istiyor: *"Paketli öğrenci: **paket satışında borç**, tahsilatta
alacak."* ADR-015 bunun **elenen alternatif (a)** olduğunu söylüyor. Komut olduğu gibi
uygulanırsa Faz 1'in bilerek reddettiği model kodlanır.

### B7 — `faz-06.md`'nin yoklama durumları şemada yok

faz-06.md dört durum istiyor: "Geldi / Gelmedi / Mazeretli / **Geç geldi**". Şemadaki CHECK:
`('pending','present','excused','unexcused','cancelled')`. "Geç geldi" karşılığı yok —
kodlanırsa INSERT **veritabanı tarafından reddedilir** ve Faz 6 ortasında migration gerekir.
EKRANLAR E9'un istediği "İptal" durumu ise faz-06.md'de hiç yok.

### B8 — Haftalık şablondan seans üretiminin ufku tanımsız

`session_series.ends_on` "NULL = süresiz" diyor ama seansları kimin, ne kadar ileriye üreteceği
hiçbir yerde yazmıyor. Birkaç ay sonra takvim **sessizce boşalır** ve Bugün ekranı "Haftalık
ders programı henüz oluşturulmadı" (R1.7) yanlış boş-durum metnini gösterir — oysa program var,
seans üretilmemiş. Bir `setting` anahtarı (üretim ufku) ve aynı seri+slot için mükerrer seans
üretimini engelleyen bir indeks gerekiyor.

---

## C. Düşük

| # | Bulgu | Faz |
|---|---|---|
| C1 | ~~`ledger_entry.payment_id` üzerinde tekillik mührü yok — aynı tahsilat iki kez deftere yazılabilir. `ux_ledger_payment` eklenmeli. **Asıl risk başka yerde:** çift tıklama iki ayrı `payment` **satırı** üretir, hiçbir ledger indeksi bunu yakalamaz — koruma modal tarafında (submit kilidi + makbuz numarasının modal açılırken rezerve edilmesi) olmalı~~ → **KAPANDI/KOMUTTA (denetlendi 2026-07-26).** `ux_ledger_payment` migration'da var; çift tık koruması `/faz-07 §5`'te K-19 olarak yazılı | ~~Faz 2 + Faz 8~~ |
| C2 | Avans varken `v_student_balance` ile `v_student_overdue` çelişiyor. Düzeltme view'da değil veride: otomatik mahsup **bütün açık taksitleri** kapsamalı (vadesi gelmiş + gelmemiş, `due_on` artan) → **KOMUTTA (denetlendi 2026-07-26):** `/faz-07 §5` *"otomatik mahsup bütün açık taksitleri kapsar — vadesi gelmiş ve gelmemiş"* | ~~Faz 8~~ → `/faz-07 §5` |
| C3 | ~~`payment` tablosu mühürsüz — `amount` serbestçe UPDATE edilip defterdeki karşılığından koparılabiliyor. `trg_payment_immutable` + `trg_payment_no_delete` eklenmeli. (Ayrı `voided_at` sütunu **eklenmemeli** — iptal durumu ters kayıttan türetiliyor, iki yerde tutmak ADR-004'e aykırı)~~ → **KAPANDI (denetlendi 2026-07-26).** `trg_payment_immutable` ve `trg_payment_no_delete` migration'da var | ~~Faz 2~~ |
| C4 | ~~`teacher` satırını **hiçbir faz komutu oluşturmuyor**. Üretim kurulumunda tablo sonsuza kadar boş kalır (seed yalnızca geliştirmede çalışıyor) → `001_initial.sql` şemadan sonra **başlangıç verisi** de yazmalı: 12 `setting` varsayılanı + tek satır `teacher`~~ → **KAPANDI (Faz 2).** `001_initial.sql:623` 15 `setting` + `:641` `teacher` satırı. **Ama satırın adı `'Öğretmen'` kaldı ve düzenleme ekranı yoktu** — o kısım C5'in kardeşi, `/faz-07 §0a`'da (ADR-037) | ~~Faz 2~~ |
| C5 | `teacher_id`'yi **yazan hiçbir ekran yok** → K-1/R3.11 çakışma uyarısı hiçbir zaman tetiklenmiyor (`b.teacher_id = a.teacher_id` daima NULL). ADR-011'in "çakışma uyarısı önem kazanır" dediği tek koruma ölü doğuyor. **Faz 5A/5B/5C boyunca kapanmadı ve takip listesine hiç girmedi** — form alanı yazıldı, çakışma kontrolü `teacher_id`'ye bakmadı. `/faz-07 §0b`'ye taşındı (ADR-037); kaybolma mekanizması **ADR-039**'da | ~~Faz 5~~ → Para fazı §0b |
| C6 | ~~E5 Grup detayı "Notlar" sekmesinin arkasında tablo yok. Şema değişikliği **gerekmiyor** — sekme, grup üyelerinin `student_note` akışının birleşimi olarak tanımlanmalı~~ → **KAPANDI (Faz 5A).** `GroupDetailPage.tsx:188` `notes` sekmesi çalışıyor | ~~Faz 5~~ |
| C7 | ~~`faz-02.md`'de `rusqlite`'ın `bundled` özelliği ve `rust-toolchain.toml` **adıyla yazılmamış**. Şemanın SQLite tabanı **3.31.0** (`GENERATED ALWAYS ... STORED`). Açılışta `sqlite_version()` loglanmalı~~ → **KAPANDI (Faz 2).** `bundled`, `rust-toolchain.toml` ve `sqlite_version` loglaması yerinde | ~~Faz 2~~ |
| C8 | ~~`.gitattributes` yok → Windows CI checkout'unda migration dosyaları CRLF olur ve `schema_migration.checksum` (SHA-256) tutmaz; uygulama açılışta "migration değiştirilmiş" hatası verir~~ → **KAPANDI (Faz 2).** `.gitattributes` var; CI dört işte yeşil | ~~Faz 2~~ |
| C9 | Veritabanı ve kullanıcı çıktıları `%APPDATA%` (Roaming, **gizli klasör**) altında. Kullanıcı makbuz PDF'ini (R4.13) kendi başına bulamaz; yedek dosyası da oraya yazılırsa OneDrive kapsamı dışında kalır → **AÇIK, komutta:** `/faz-10 §2` *"yedek klasörü Belgeler altı gibi bulunabilir bir yerde"* | ~~Faz 2~~ / Faz 10 |
| C10 | ~~`faz-05.md` branş CRUD'unda "varsayılan süre" istiyor ama ne `subject`'te ne `setting`'de böyle bir alan var — PRD S4'ün cevabının saklanacağı yer yok~~ → **KAPANDI (Faz 2).** `subject.default_min` (`001_initial.sql:59`) ve `setting.default_session_minutes = '60'` (satır 628) eklendi. **S4 2026-07-25'te cevaplandı ve cevap tam da bu değer** — Faz 5 bu iş için migration **eklemez** | ~~Faz 5~~ |

---

## D. Denetlendi, sorun çıkmadı

Bunlar **çalıştırılarak** doğrulandı, olduğu gibi bırakılabilir:

- Tüm DDL `sqlite3 3.51`'de hatasız kuruluyor; `§2`'deki kuruluş sırası doğru
- `GENERATED ALWAYS AS ... STORED` sütunları (`session_date`, `kind`) doğru doluyor,
  `WHERE`'de ve indekste kullanılabiliyor
- `trg_attendance_within_enrollment` çalışıyor: aralık dışı `INSERT` **gerçekten reddediliyor**,
  aralık içi geçiyor. `WHEN` içindeki alt sorgu sorun çıkarmıyor
- Dışlayıcı `CHECK ((student_id IS NOT NULL) <> (study_group_id IS NOT NULL))` ikisi de NULL ve
  ikisi de dolu durumlarını doğru reddediyor
- Kısmi UNIQUE indeksler (`ux_pkgusage_att`, `ux_sg_primary`, `ux_ledger_installment`) çifte
  kaydı gerçekten engelliyor
- `installment.accrued_entry_id` → `ledger_entry` ileri referansı sorun çıkarmıyor
  (SQLite FK'leri yazma anında doğruluyor)
- ADR-011…017 birbiriyle çelişmiyor; para alanlarının tamamı `INTEGER` kuruş, float sızıntısı yok;
  `ON DELETE CASCADE` hiçbir yerde kullanılmamış (ADR-005 korunuyor)

---

## E. Ne yapılacak

| Nereye | Ne |
|---|---|
| `docs/VERI-MODELI.md` | A1–A4, A8, A9, B1–B3, C1, C3 → DDL ve `§0` kural düzeltmeleri |
| `docs/KARARLAR.md` | Yeni ADR: borçlu listesinin kaynağı (A1) · yedekleme yöntemi (A6/A7) · Türkçe sıralama (B5) |
| `docs/PRD.md` | K-19 (çifte tahsilat kaydı) · tahsilat iptali akışı (B3) |
| `.claude/commands/faz-02.md` | C4, C7, C8 + başlangıç verisi maddesi |
| `.claude/commands/faz-05.md` | B8, C5, C6, C10 + ADR-017 zaten alındı (§8 kaldırılmalı) |
| `.claude/commands/faz-06.md` | B7, B2 |
| `.claude/commands/faz-07.md` | B6 (ADR-015 çelişkisi), A5, A9 |
| `.claude/commands/faz-08.md` | A5, B3, C1, C2 + ADR-014 zaten alındı (§1 kaldırılmalı) |
| `.claude/commands/faz-10.md` | A6, A7 |

**Sıra.** Şema ve ADR düzeltmeleri Faz 2'den **önce** (yönetici oturumu, kod yazılmadan).
Faz komutu düzeltmeleri aynı oturumda. Faz 2 düzeltilmiş `VERI-MODELI.md`'den başlar.
