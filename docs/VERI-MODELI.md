# Veri Modeli

SQLite şeması, gerekçeleri ve para mantığı. **Faz 1 çıktısı — onaylandı.**
Değişiklik yalnızca yeni bir migration dosyasıyla olur; bu dosya o zaman güncellenir.

İlgili kararlar: ADR-003 (kuruş), ADR-004 (defter), ADR-005 (soft delete),
ADR-006 (fiyat snapshot), ADR-011…ADR-016 (bu fazda alındı).

---

## 0. Yapısal kararlar

| # | Karar | Reddedilen alternatif | Neden |
|---|---|---|---|
| **K1** | Tek `session` tablosu; `student_id` / `study_group_id` **dışlayıcı** | Ayrı `solo_session` + `group_session` | Takvim, yoklama, defter ve telafi ikisini de aynı şekilde işliyor. Ayırmak her sorguyu `UNION ALL`'a, her indeksi ikiye, her komutu iki koda çevirirdi. |
| **K2** | `group_member` yok; **`enrollment`** hem üyelik aralığını hem tarifeyi taşır | `group_member` + ayrı `enrollment` | Tasarımın "Kayıtlar" sekmesi zaten bu tabloyu gösteriyor. Tarih aralığını iki tabloda tutmak, ikisinin çelişme ihtimalini yaratır. |
| **K3** | `bakiye = SUM(ledger_entry.amount)`; **negatif = borçlu** | Pozitif = borçlu | Tasarımın Öğrenciler ve Öğrenci detayı ekranları böyle (`balance:-1200` → kırmızı). |
| **K4** | Paket deftere **taksit taksit, vadesi geldikçe** yazılır | Satışta tek kalem tam tutar / ders başına tahakkuk | Gecikme hesabı vade tarihi ister; dönemlik paket alan öğrenciyi gün 1'de tüm tutar kadar borçlu göstermek kullanıcıyı yanıltır. Ayrıntı: §3. |
| **K5** | `ledger_entry` **append-only** — düzeltme = ters kayıt | UPDATE / soft delete | Defterin tek işi kendini açıklamak (ADR-004). Değişebilen satır bunu bozar. |
| **K6** | Tarih/saat **yerel duvar saati metni**, UTC yok | UTC + timezone dönüşümü | Tek makine, tek ülke. UTC'ye çevirirsek yaz saati değişiminde 16:00 dersi 15:00'e kayar. |
| **K7** | Borcun tek kaynağı **defter** (ADR-018) | Borçlu listesini `installment`'tan üretmek | İki rakip "borç" tanımı doğuyordu: ders başı ödeyen öğrenci hiç `installment` satırı üretmediği için borçlu listesinde hiç görünmüyordu. |
| **K8** | Türkçe metin kolonlarında **SQL'de `ORDER BY` yok** (ADR-020) | `COLLATE` ya da Rust'a kayıtlı özel collation | SQLite'ta `localeCompare('tr')` karşılığı yok. Özel collation `CREATE TABLE`'a yazılırsa `.db` başka araçla açılamaz — ADR-019 kurtarma riski. |
| **K9** | Aranabilir metin kolonlarında **Rust'ta üretilen `search_name`** | `lower()` ile sorgu anında normalleştirme | SQLite'ın `lower()`'ı ASCII-only: `'İ'` küçülmez, `'I'` → `'i'` olur (Türkçe'de `'ı'` olmalı). Davranış tutarsız: `Ilkbahar` bulunur, `İngilizce` bulunmaz. |

### Ortak sözleşme

Her tabloda (ADR-005):

```sql
created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
deleted_at TEXT                      -- NULL = canlı. Kullanıcıya "Arşivlendi" denir.
```

- Bütün para alanları `INTEGER`, **kuruş** (ADR-003). `1.234,56 ₺` → `123456`.
- Bütün tarihler `TEXT`: `'YYYY-MM-DD'` veya `'YYYY-MM-DD HH:MM'`. Sıralanabilir, karşılaştırılabilir.
- Bütün "canlı kayıt" indeksleri kısmi: `WHERE deleted_at IS NULL`.
- `PRAGMA foreign_keys = ON` her bağlantıda. `PRAGMA journal_mode = WAL`.

> ### ⚠️ `'now'` kuralı — SQL içinde çıplak `'now'` kullanılmaz
>
> SQLite'ın `datetime('now')` / `date('now')` / `julianday('now')` fonksiyonları **`TZ` ortam
> değişkeninden bağımsız olarak daima UTC** döner. Türkiye UTC+3 olduğu için gece 00:00–03:00
> arasında bunlar **bir önceki günü** verir. Doğrulandı:
>
> ```
> yerel duvar saati            : 2026-07-25 02:14 +03
> datetime('now')              : 2026-07-24 23:14      ← bir önceki gün
> datetime('now','localtime')  : 2026-07-25 02:14
> ```
>
> Bu K6'nın (ADR-017) tam tersidir. Kural:
>
> 1. **Kullanıcıya görünen hiçbir hesap SQLite saatini okumaz.** "Bugün" bir sorgu parametresidir,
>    Rust'ta `chrono::Local::now().date_naive()` ile üretilip **bind edilir**. Kalıp zaten kurulu:
>    `accrue_due_installments(today)`. Aynı kalıbı borçlu listesi ve gecikme gün sayısı da izler.
>    Yan fayda: testler CI makinesinin saat dilimine bağlı olmaktan çıkar.
> 2. `'now'` yalnızca **denetim sütunlarının `DEFAULT`'unda** ve daima `'localtime'` ile kullanılır.
>    `strftime` biçimi seçildi çünkü çıplak `datetime()` saniye de üretir ve yukarıdaki
>    "`'YYYY-MM-DD HH:MM'`" sözleşmesini bozardı.
> 3. `'localtime'` içeren bir ifade **indekslenemez** (SQLite bunu deterministik saymaz). İleride
>    `created_at` üzerine indeks gerekirse ham sütun üzerinden alınır.
>
> Bu kuralın asıl işi bugünkü iki hatayı düzeltmek değil, aynı hatanın Faz 7/8/9'da yeni
> sorgularda yeniden doğmasını engellemek.

---

## 1. Tablolar

21 tablo, 3 view. `⭐` tasarımdan çıkarılıp eklenen tabloları işaretler.

---

### 1.1 `schema_migration`

**Bu tablo neden var:** Elle DDL çalıştırmayı imkânsız kılmak için. Uygulama açılışta en
yüksek `version`'a bakar, eksik migration'ları sırayla uygular.

```sql
CREATE TABLE schema_migration (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  checksum    TEXT NOT NULL              -- migration dosyasının SHA-256'sı
);
```

`checksum`: uygulanmış bir migration dosyası sonradan değiştirilirse açılışta hata verir.
Teknik olmayan kullanıcıda sessiz veri bozulmasının en olası kaynağı budur.

---

### 1.2 `setting`

**Bu tablo neden var:** Çalışma saatleri, yoklama politikası, makbuz öneki gibi tek
satırlık kararların her biri için tablo açmamak. Takvimin 08:00–22:00 aralığı ve
`rahat/sıkı` satır yoğunluğu buradan gelir.

> **Kurum adı buradan GELMİYOR (ADR-024).** Kenar çubuğundaki kurum satırı derleme zamanı
> `config/kurum.json`'dan okunuyor. `institution_name` satırı tabloda duruyor ama kod onu
> sorgulamıyor — migration mühürlü olduğu için satır silinemedi.

```sql
CREATE TABLE setting (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
```

| key | varsayılan | nerede kullanılır |
|---|---|---|
| `institution_name` | `Aydın Özel Ders` | ⚠️ **OKUNMUYOR — ADR-024.** Kurum adı derleme zamanı `config/kurum.json`'dan geliyor. Satır migration mühürlü olduğu için yerinde duruyor; kod bu anahtarı sorgulamaz |
| `day_start` / `day_end` | `08:00` / `22:00` | takvim dikey aralığı |
| `slot_minutes` | `30` | takvimde sürükleme kilitlenmesi |
| `default_session_minutes` | `60` | branşta `default_min` yoksa ders süresi (PRD S4) |
| `session_horizon_weeks` | `16` | haftalık şablondan kaç hafta ileriye seans üretilir (§1.14) |
| `weekly_closed_days` | `7` | haftalık kapalı gün (1=Pzt … 7=Paz) |
| `row_density` | `comfortable` | listelerde satır yüksekliği |
| `absence_excused_consumes_lesson` | `0` | **ADR-016** — mazeretli hak düşürmez |
| `absence_unexcused_consumes_lesson` | `1` | **ADR-016** — mazeretsiz hak düşürür |
| `package_expiry_days` | *(boş)* | paket son kullanma; boşsa süresiz |
| `receipt_prefix` | `2026-` | makbuz numarası öneki |
| `receipt_next_no` | `1` | makbuz sayacı |
| `backup_warn_days` | `3` | Bugün ekranında yedekleme uyarısı eşiği |
| `last_backup_at` | *(boş)* | Bugün ekranı yedekleme şeridi |

---

### 1.3 ⭐ `teacher`

**Bu tablo neden var:** Tasarımın tamamı öğretmen kavramı üzerine kurulu — ders bloğunun meta
satırı, notun yazarı, çakışma kuralı ("aynı öğretmen aynı saatte") ve grubun sorumlusu.
MVP'de **tek satır** olacak (kurs sahibi, ADR-011) ama tablo olarak duruyor: ikinci öğretmen
çıktığında migration + veri taşıma gerekmesin.

```sql
CREATE TABLE teacher (
  id          INTEGER PRIMARY KEY,
  full_name   TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#5f8f6b',   -- takvim noktası
  phone       TEXT,
  email       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE INDEX ix_teacher_active ON teacher(is_active) WHERE deleted_at IS NULL;
```

> **MVP sadeleştirmesi (ADR-011).** Takvimdeki öğretmen filtresi ve Gün görünümünün
> öğretmen-başına-sütun düzeni arayüzde **kurulmaz**. Gün görünümü tek geniş sütundur.
> Şema değişmez; ikinci öğretmen eklenirse bu ekranlar açılır.

**Bu satırı kim yazıyor.** Tek öğretmen satırı `001_initial.sql` içinde, **migration'ın
başlangıç verisi** olarak yazılır — seed'de değil:

```sql
INSERT INTO teacher (id, full_name, color) VALUES (1, 'Öğretmen', '#5f8f6b');
```

Seed yalnızca geliştirmede çalışıyor (`faz-02.md §6`); orada bırakılırsa kurs sahibinin
gerçek makinesinde `teacher` tablosu **sonsuza kadar boş kalır** ve öğretmen alanı olan
5 tablo ile 4 ekran karşılıksız olur. Ad, Tanımlar → Genel ekranından değiştirilebilir.

Kurum adından türetilmez: o bir **kurum** adı ("Aydın Özel Ders"), kişi adı değil —
üstelik artık başka bir yerde yaşıyor (`config/kurum.json`, ADR-024).

---

### 1.4 `subject` — branş

**Bu tablo neden var:** "Matematik" serbest metin olursa raporda `Matematik` / `matematik` /
`Mat` üç ayrı satır olur.

```sql
CREATE TABLE subject (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  search_name   TEXT NOT NULL,     -- K9: Rust'ta üretilen Türkçe küçültme
  color         TEXT,
  default_min   INTEGER,           -- varsayılan ders süresi (dk); NULL = setting'teki genel varsayılan
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at    TEXT
);
-- Tekillik search_name üzerinde: "İngilizce" ve "ingilizce" aynı branştır.
CREATE UNIQUE INDEX ux_subject_name ON subject(search_name) WHERE deleted_at IS NULL;
```

`default_min` PRD S4'ün cevabının yeri (tasarımda hem 60 hem 90 dk ders var). Branşa özel
değer yoksa `setting.default_session_minutes` kullanılır.

---

### 1.5 `student` — öğrenci

**Bu tablo neden var:** Uygulamanın merkezi. Borç, ders hakkı, devam oranı buraya bağlanır.

```sql
CREATE TABLE student (
  id            INTEGER PRIMARY KEY,
  full_name     TEXT NOT NULL,
  search_name   TEXT NOT NULL,     -- Türkçe küçültülmüş ad — arama için
  school        TEXT,
  grade         TEXT,              -- '11. sınıf'
  birth_date    TEXT,
  phone         TEXT,
  phone_digits  TEXT,              -- yalnız rakam — arama için
  is_active     INTEGER NOT NULL DEFAULT 1,
  enrolled_on   TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at    TEXT
);
CREATE INDEX ix_student_search ON student(search_name) WHERE deleted_at IS NULL;
CREATE INDEX ix_student_active ON student(is_active)   WHERE deleted_at IS NULL;
```

**`search_name` ve `phone_digits` neden ayrı sütun.** SQLite'ın `lower()` fonksiyonu
ASCII-only: `'İ'` küçülmez, `'I'` → `'i'` olur (Türkçe'de `'ı'` olmalı). Bu iki alan
**Rust tarafında yazılırken üretilir** (`to_lowercase` + Türkçe eşlemeler), böylece sorgu
tarafı basit `LIKE` ile deterministik çalışır. `deleted_at IS NULL` filtreli indeks aramayı
öğrenci sayısından bağımsız kılar.

`is_active` = "Aktif / Pasif" (tasarımdaki yeşil nokta / içi boş halka).
`deleted_at` = "Arşivlendi". **Bunlar iki farklı şey** — pasif öğrenci listede görünür.

---

### 1.6 `guardian` — veli

**Bu tablo neden var:** Telefon öğrencinin değil velinin. Tasarımın arama kutusu
"Öğrenci adı **veya veli telefonu** ara" diyor; borç konuşulan kişi de veli.

```sql
CREATE TABLE guardian (
  id                INTEGER PRIMARY KEY,
  full_name         TEXT NOT NULL,
  phone             TEXT,          -- ADR-009: v2 hatırlatma için hazır bekliyor
  phone_digits      TEXT,
  email             TEXT,
  last_reminded_at  TEXT,          -- ADR-009: MVP'de hiç yazılmaz
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at        TEXT
);
CREATE INDEX ix_guardian_phone ON guardian(phone_digits) WHERE deleted_at IS NULL;
```

---

### 1.7 `student_guardian` — öğrenci ↔ veli

**Bu tablo neden var:** Kardeşlerin velisi aynı kişi; bir öğrencinin iki velisi olabilir.
`is_primary`, listede gösterilecek **tek** telefonu belirler.

```sql
CREATE TABLE student_guardian (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES student(id),
  guardian_id  INTEGER NOT NULL REFERENCES guardian(id),
  relation     TEXT,                       -- 'Anne' | 'Baba' | 'Diğer'
  is_primary   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ux_sg         ON student_guardian(student_id, guardian_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_sg_primary ON student_guardian(student_id)
  WHERE is_primary = 1 AND deleted_at IS NULL;   -- öğrenci başına tek birincil veli
```

İkinci indeks bir iş kuralını şemaya gömer: iki birincil veli yazılamaz.

---

### 1.8 `study_group` — grup

**Bu tablo neden var:** "Matematik · Grup A" bir isim değil; kapasitesi, dönemi ve üyeleri
olan bir varlık. Tasarım ders bloğunda `4/6` (dolu/kapasite) gösteriyor.

```sql
CREATE TABLE study_group (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,                    -- 'Grup A'
  search_name  TEXT NOT NULL,                    -- K9
  subject_id   INTEGER NOT NULL REFERENCES subject(id),
  teacher_id   INTEGER REFERENCES teacher(id),
  capacity     INTEGER NOT NULL DEFAULT 6 CHECK (capacity > 0),
  starts_on    TEXT,
  ends_on      TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at   TEXT
);
CREATE UNIQUE INDEX ux_group_name ON study_group(subject_id, search_name) WHERE deleted_at IS NULL;
```

> **`search_name` neden `subject` ve `study_group`'ta da var (K9).** Bugün ekranının arama
> kutusu *"Öğrenci, **grup veya ders** ara"* diyor ve E20 sonuçları üç grup hâlinde listeliyor.
> Bu sütunlar olmadan kullanıcı `ingilizce` yazınca `İngilizce` branşını **bulamıyor**, ama
> ASCII `I` ile başlayan `Ilkbahar Grubu`'nu **buluyor** — aynı harfle iki farklı davranış.
> Tekillik indeksleri de `name`'den `search_name`'e taşındı: asıl kazanç bu, mükerrer branş
> kaydı (`Matematik` / `matematik`) artık şema seviyesinde engelleniyor.
>
> Ek arama indeksi (`ix_subject_search` vb.) **eklenmedi**: 15 satırlık bir tabloda kazanç yok,
> her yazmaya maliyet ekler. `student` farklıdır — orada `ix_student_search` yerinde kalır.

---

### 1.9 ⭐ `enrollment` — kayıt

**Bu tablo neden var:** Tasarımdaki "Kayıtlar" sekmesinin tam karşılığı — kurs/grup, tarife,
başlangıç, taksit durumu. Aynı zamanda **gruba katılım aralığını** taşır; `group_member`
yerine geçer (K2). Bir öğrencinin gruptan ayrılıp geri dönmesi = iki ayrı satır, çakışmayan
aralıklarla.

```sql
CREATE TABLE enrollment (
  id              INTEGER PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES student(id),
  study_group_id  INTEGER REFERENCES study_group(id),    -- NULL = birebir kaydı
  subject_id      INTEGER NOT NULL REFERENCES subject(id),
  teacher_id      INTEGER REFERENCES teacher(id),
  price_rule_id   INTEGER REFERENCES price_rule(id),
  pricing_model   TEXT NOT NULL
                  CHECK (pricing_model IN ('per_session','package','period')),
  unit_price      INTEGER NOT NULL CHECK (unit_price >= 0),   -- ADR-006 snapshot
  start_on        TEXT NOT NULL,
  end_on          TEXT,                                       -- NULL = devam ediyor
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','closed')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at      TEXT,
  CHECK (end_on IS NULL OR end_on >= start_on)
);
CREATE INDEX ix_enr_student ON enrollment(student_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_enr_group   ON enrollment(study_group_id, start_on, end_on)
  WHERE deleted_at IS NULL;
```

`unit_price` ADR-006 gereği kayıt anındaki tarifenin kopyasıdır. Eylül'de zam yapılınca
Mart'ın raporu değişmez.

> **Çakışan kayıt aralığı yasaktır.** ADR-013 "çakışmayan iki `enrollment` satırı" varsayıyor
> ama şemada bunu zorlayan hiçbir şey yoktu. Aynı öğrenci + aynı branş + aynı grup (ya da
> ikisi de birebir) için tarih aralıkları çakışan iki canlı kayıt, birebir tahakkukta
> `AmbiguousEnrollment` hatasına ve yoklama transaction'ının düşmesine yol açar.
>
> SQLite'ta aralık çakışmasını kısıtla ifade etmek mümkün değil (`EXCLUDE` yok). Kural
> repository katmanında, **kayıt yazılmadan önce** doğrulanır ve `§6`'da testi vardır.
> Kullanıcıya gösterilen hata: *"Bu öğrencinin bu branşta zaten açık bir kaydı var.
> Önce onu kapatmak ister misiniz?"*

---

### 1.10 `price_rule` — tarife

**Bu tablo neden var:** Güncel fiyat listesi. Tasarımda üç biçim görünüyor:
`Ders başı · 250 TL`, `Aylık paket · 8 ders/ay`, `Dönemlik · 32 ders`.
ADR-006 gereği bu tablo geçmişi **değiştirmez** — kayıt ve paket kendi tutarını taşır.

```sql
CREATE TABLE price_rule (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT NOT NULL,               -- 'Aylık paket · 8 ders/ay'
  pricing_model         TEXT NOT NULL
                        CHECK (pricing_model IN ('per_session','package','period')),
  subject_id            INTEGER REFERENCES subject(id),      -- NULL = tüm branşlar
  study_group_id        INTEGER REFERENCES study_group(id),  -- NULL = tüm gruplar
  is_group              INTEGER,      -- 1 grup, 0 birebir, NULL fark etmez
  unit_price            INTEGER NOT NULL CHECK (unit_price >= 0),
  lesson_count          INTEGER CHECK (lesson_count IS NULL OR lesson_count > 0),
  total_price           INTEGER CHECK (total_price IS NULL OR total_price >= 0),
  period_months         INTEGER,
  default_installments  INTEGER NOT NULL DEFAULT 1 CHECK (default_installments >= 1),
  valid_from            TEXT NOT NULL,
  valid_to              TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at            TEXT,
  CHECK (pricing_model <> 'package'
         OR (lesson_count IS NOT NULL AND total_price IS NOT NULL))
);
CREATE INDEX ix_price_lookup ON price_rule(pricing_model, subject_id, valid_from)
  WHERE deleted_at IS NULL;
```

---

### 1.11 `package` — ders paketi

**Bu tablo neden var:** "8 derslik paket aldı, 3 ders işledi, 5 hakkı kaldı" sorusunun
kaynağı. Bugün ekranındaki "Paketi bitmek üzere" ve öğrenci detayındaki "Kalan ders" kutusu
buradan okur.

```sql
CREATE TABLE package (
  id             INTEGER PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES student(id),
  enrollment_id  INTEGER REFERENCES enrollment(id),
  price_rule_id  INTEGER REFERENCES price_rule(id),
  lesson_count   INTEGER NOT NULL CHECK (lesson_count > 0),
  unit_price     INTEGER NOT NULL CHECK (unit_price >= 0),    -- ADR-006 snapshot
  total_price    INTEGER NOT NULL CHECK (total_price >= 0),   -- indirim sonrası
  sold_on        TEXT NOT NULL,
  valid_until    TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','exhausted','expired','cancelled')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at     TEXT
);
CREATE INDEX ix_pkg_student ON package(student_id, status) WHERE deleted_at IS NULL;
```

`unit_price × lesson_count ≠ total_price` olabilir — indirim. `unit_price` iade
hesaplarında kullanılır.

---

### 1.12 `package_usage` — paket kullanımı

**Bu tablo neden var:** Kalan hak bir sütunda tutulmuyor — defter mantığının (ADR-004) ders
hakkındaki karşılığı. Satır **silinmez**; iade `delta = +1` satırıyla yazılır.

```sql
CREATE TABLE package_usage (
  id             INTEGER PRIMARY KEY,
  package_id     INTEGER NOT NULL REFERENCES package(id),
  attendance_id  INTEGER REFERENCES attendance(id),
  used_on        TEXT NOT NULL,
  delta          INTEGER NOT NULL CHECK (delta IN (-1, 1)),
  reason         TEXT NOT NULL
                 CHECK (reason IN ('attendance','cancellation_restore','manual')),
  memo           TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at     TEXT
);
CREATE UNIQUE INDEX ux_pkgusage_att ON package_usage(attendance_id, delta)
  WHERE attendance_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_pkgusage_pkg ON package_usage(package_id) WHERE deleted_at IS NULL;
```

`ux_pkgusage_att`: aynı yoklamadan **iki kez** hak düşülemez. Yoklama sehven iki kez
işlenirse ikinci `INSERT` hata verir — sessizce iki ders düşmez.

**Kalan hak:** `package.lesson_count + COALESCE(SUM(delta), 0)`

---

### 1.13 ⭐ `installment` — taksit

**Bu tablo neden var:** Tasarım `2/4 ödendi`, `1/3 gecikmiş`, `Peşin` gösteriyor; Bugün
ekranı `12 gün gecikti` diyor. Gecikme hesabı **vade tarihi** ister. Peşin ödeme = tek
taksit, vadesi satış günü.

```sql
CREATE TABLE installment (
  id                INTEGER PRIMARY KEY,
  student_id        INTEGER NOT NULL REFERENCES student(id),
  package_id        INTEGER REFERENCES package(id),
  enrollment_id     INTEGER REFERENCES enrollment(id),
  seq               INTEGER NOT NULL CHECK (seq >= 1),
  due_on            TEXT NOT NULL,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  label             TEXT,                     -- 'Temmuz taksiti'
  accrued_entry_id  INTEGER REFERENCES ledger_entry(id),   -- deftere yazılınca dolar
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at        TEXT,
  CHECK (package_id IS NOT NULL OR enrollment_id IS NOT NULL)
);
CREATE UNIQUE INDEX ux_inst_pkg ON installment(package_id, seq)
  WHERE package_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_inst_due ON installment(due_on) WHERE deleted_at IS NULL;
```

`label` tasarımdaki "Mahsup edildiği taksit" kolonunun metnidir.

**Vade tahakkuku.** Uygulama her açılışta `accrue_due_installments(today)` çalıştırır:
`due_on <= today AND accrued_entry_id IS NULL` olan her taksit için bir
`ledger_entry(installment_charge, −amount)` yazar ve `accrued_entry_id`'yi doldurur.
Fonksiyon **idempotent** — iki kez çalışması iki borç yazmaz (`ux_ledger_installment`
indeksi zaten buna izin vermez).

---

### 1.14 ⭐ `session_series` — haftalık ders şablonu

**Bu tablo neden var:** Tasarımın "Dersi taşı" penceresi *"Bu ders haftalık şablonda tekrar
ediyor"* diyor ve **"Sadece bu ders" / "Bu ve sonraki dersler"** seçtiriyor; boş takvim
"Şablondan oluştur" öneriyor. Bu iki davranış düz bir seans listesiyle kurulamaz — tekrar
kuralı ayrı bir varlık olmak zorunda.

```sql
CREATE TABLE session_series (
  id              INTEGER PRIMARY KEY,
  study_group_id  INTEGER REFERENCES study_group(id),
  student_id      INTEGER REFERENCES student(id),
  subject_id      INTEGER NOT NULL REFERENCES subject(id),
  teacher_id      INTEGER REFERENCES teacher(id),
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),  -- 1 = Pazartesi
  start_time      TEXT NOT NULL,                        -- '16:00'
  duration_min    INTEGER NOT NULL CHECK (duration_min > 0),
  starts_on       TEXT NOT NULL,
  ends_on         TEXT,                                 -- NULL = süresiz
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at      TEXT,
  CHECK ((student_id IS NOT NULL) <> (study_group_id IS NOT NULL))
);
CREATE INDEX ix_series_active ON session_series(weekday, starts_on, ends_on)
  WHERE deleted_at IS NULL;
```

**"Bu ve sonraki dersler" nasıl çalışır.** Mevcut seri `ends_on = değişiklik günü − 1` ile
kapatılır, yeni bir `session_series` açılır, gelecekteki **henüz işlenmemiş** seanslar
yeniden üretilir. Geçmiş seanslar eski `series_id`'ye bağlı kalır ve hiç dokunulmaz —
tasarımın *"Şablon güncellenir, geçmiş dersler korunur"* vaadinin şemadaki karşılığı budur.

**"Sadece bu ders"** ise seriye dokunmaz, yalnızca ilgili `session` satırının
`starts_at`/`ends_at`'ini günceller.

#### Seanslar ne kadar ileriye üretilir

`ends_on = NULL` "süresiz" demek, ama seanslar sonsuza kadar üretilemez. Ufuk tanımlı olmazsa
takvim birkaç ay sonra **sessizce boşalır** ve Bugün ekranı *"Haftalık ders programı henüz
oluşturulmadı"* (R1.7) yanlış boş-durum metnini gösterir — oysa program var, seans üretilmemiştir.

- Ufuk `setting.session_horizon_weeks` (varsayılan `16`) ile tanımlanır.
- Uygulama her açılışta, `accrue_due_installments` ile aynı yerde, eksik seansları üretir:
  her canlı seri için ufuk sonuna kadar olan boşluklar doldurulur.
- Üretim **idempotent** olmak zorunda; aynı seri + aynı başlangıç anı iki kez yazılamaz:

```sql
CREATE UNIQUE INDEX ux_session_series_slot ON session(series_id, starts_at)
  WHERE series_id IS NOT NULL AND deleted_at IS NULL;
```

- Kapalı günlere (`closed_day`, `setting.weekly_closed_days`) düşen slotlar üretilmez.
- Elle taşınmış ya da iptal edilmiş bir seans **yeniden üretilmez** — indeks bunu zaten
  engeller, çünkü satır hâlâ orada (`status='cancelled'`, `deleted_at` NULL).

---

### 1.15 `session` — seans (birebir + grup, tek tablo)

**Bu tablo neden var:** Takvimin, yoklamanın ve borç tahakkukunun ortak çıpası.

```sql
CREATE TABLE session (
  id                        INTEGER PRIMARY KEY,
  series_id                 INTEGER REFERENCES session_series(id),
  study_group_id            INTEGER REFERENCES study_group(id),
  student_id                INTEGER REFERENCES student(id),
  subject_id                INTEGER NOT NULL REFERENCES subject(id),
  teacher_id                INTEGER REFERENCES teacher(id),
  starts_at                 TEXT NOT NULL,        -- 'YYYY-MM-DD HH:MM'
  ends_at                   TEXT NOT NULL,
  session_date              TEXT GENERATED ALWAYS AS (substr(starts_at, 1, 10)) STORED,
  kind                      TEXT GENERATED ALWAYS AS
                              (CASE WHEN study_group_id IS NULL THEN 'solo' ELSE 'group' END)
                            STORED,
  status                    TEXT NOT NULL DEFAULT 'planned'
                            CHECK (status IN ('planned','done','cancelled')),
  is_makeup                 INTEGER NOT NULL DEFAULT 0,
  makeup_for_attendance_id  INTEGER REFERENCES attendance(id),
  unit_price                INTEGER,              -- tek seferlik ders için snapshot
  attendance_taken_at       TEXT,                 -- NULL = "yoklama girilmedi"
  cancel_reason             TEXT,
  note                      TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at                TEXT,
  CHECK ((student_id IS NOT NULL) <> (study_group_id IS NOT NULL)),
  CHECK (ends_at > starts_at)
);
CREATE INDEX ix_session_date    ON session(session_date)                 WHERE deleted_at IS NULL;
CREATE INDEX ix_session_teacher ON session(teacher_id, starts_at)        WHERE deleted_at IS NULL;
CREATE INDEX ix_session_group   ON session(study_group_id, session_date) WHERE deleted_at IS NULL;
CREATE INDEX ix_session_solo    ON session(student_id, session_date)     WHERE deleted_at IS NULL;
CREATE INDEX ix_session_pending ON session(session_date)
  WHERE attendance_taken_at IS NULL AND status = 'planned' AND deleted_at IS NULL;
```

#### Birebir / grup ayrımı nasıl kuruldu

Bir `type` sütunu yerine **dışlayıcı yabancı anahtar** (exclusive arc) kullanıldı:
`student_id` ve `study_group_id`'den **tam olarak biri** dolu olmak zorunda.

```sql
CHECK ((student_id IS NOT NULL) <> (study_group_id IS NOT NULL))
```

Bunun `type TEXT` sütunundan farkı: "tipi grup ama grubu boş" ya da "tipi birebir ama hem
öğrencisi hem grubu dolu" kaydı **fiziksel olarak yazılamaz**. `kind` sütunu bu ikisinden
`GENERATED ALWAYS AS ... STORED` ile **türetilir** — elle yazılmadığı için çelişme ihtimali
sıfır, ama sorgularda `WHERE kind = 'group'` yazılabiliyor ve indekslenebiliyor.

#### Neden tek tablo

Takvim, Bugün listesi, yoklama, telafi ve defter tahakkuku her iki tipi de **aynı şekilde**
işliyor. Tasarımdaki takvim birebir ve grup bloklarını aynı grid'e, aynı çakışma hesabına ve
aynı sürükle-bırak mantığına sokuyor; Bugün ekranı ikisini tek listede sıralıyor.

Ayrı tablo şu maliyeti getirirdi: her takvim sorgusu `UNION ALL`, her indeks iki kopya, her
`#[tauri::command]` iki kod yolu, `attendance` ve `ledger_entry`'de iki nullable FK
(`solo_session_id` + `group_session_id`) ve aynı dışlayıcı CHECK'in orada tekrarı.

Tek tablonun maliyeti: iki nullable FK ve bir CHECK — hepsi bir yerde. Takas net kârlı.

---

### 1.16 `attendance` — yoklama

**Bu tablo neden var:** Bir seansta **her öğrenci için ayrı** bir sonuç var. Borç ve paket
düşümü seansa değil bu satıra bağlanır.

```sql
CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES session(id),
  student_id  INTEGER NOT NULL REFERENCES student(id),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','present','excused','unexcused','cancelled')),
  marked_at   TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_att         ON attendance(session_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX        ix_att_student ON attendance(student_id, status)     WHERE deleted_at IS NULL;
```

Durumlar tasarımdaki `durMap`'in birebir karşılığı:

| şema | arayüz | nokta |
|---|---|---|
| `present` | Geldi | dolu yeşil |
| `excused` | Mazeretli | dolu turuncu |
| `unexcused` | Mazeretsiz | dolu kırmızı |
| `cancelled` | İptal | içi boş gri halka |
| `pending` | *(girilmedi)* | — |

#### Katılım aralığı garantisi

> *Gruba sonradan katılan veya ayrılan öğrenci, katılım aralığı dışındaki seansların
> yoklamasında görünmemeli.*

**İki katmanlı.** (1) Yoklama satırları hiçbir zaman elle değil, `enrollment` aralığını
süzen tek bir repository fonksiyonuyla üretilir. (2) Ve şema bunu bir tetikleyiciyle
**mühürler** — kod yanlış yazılsa bile veritabanı reddeder:

```sql
CREATE TRIGGER trg_attendance_within_enrollment
BEFORE INSERT ON attendance
FOR EACH ROW
WHEN (SELECT study_group_id FROM session WHERE id = NEW.session_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'attendance_outside_enrollment')
  WHERE NOT EXISTS (
    SELECT 1
    FROM session s
    JOIN enrollment e
      ON e.study_group_id = s.study_group_id
     AND e.student_id     = NEW.student_id
     AND e.deleted_at IS NULL
     AND e.start_on <= s.session_date
     AND (e.end_on IS NULL OR s.session_date <= e.end_on)
    WHERE s.id = NEW.session_id
  );
END;
```

Yani **"kaç dersten sorumlu" bir alan değil, bir aralık sorgusudur.** Öğrenci gruptan
ayrıldığında satır silinmez, `enrollment.end_on` doldurulur; geçmiş yoklamaları ve borçları
yerinde kalır, sonraki seanslarda görünmez.

Birebir seanslarda tetikleyici çalışmaz (`WHEN ... IS NOT NULL` koşulu) — orada seansın
kendisi zaten öğrenciye bağlı.

---

### 1.17 `payment` — tahsilat

**Bu tablo neden var:** Alınan para fiziksel bir olay: tarihi, tutarı, yöntemi ve makbuz
numarası var. Deftere yansıması ayrı (`ledger_entry`), belgesi bu.

```sql
CREATE TABLE payment (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES student(id),
  paid_on     TEXT NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL CHECK (method IN ('cash','card','transfer')),
  receipt_no  TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_receipt ON payment(receipt_no)
  WHERE receipt_no IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_payment_student ON payment(student_id, paid_on) WHERE deleted_at IS NULL;
```

`method` değerleri tasarımdaki **Nakit / Kart / Havale** ile birebir.

---

### 1.18 ⭐ `payment_allocation` — tahsilatın taksite mahsubu

**Bu tablo neden var:** Tasarımın Ödemeler sekmesinde **"Mahsup edildiği taksit"** kolonu var
("Temmuz taksiti", "Fizik · peşinat"). Bu kolon ancak ödeme→taksit eşlemesi saklanırsa doğru
çıkar. Bir ödeme birden fazla taksidi kapatabilir; bir taksit birkaç ödemeyle kapanabilir.

```sql
CREATE TABLE payment_allocation (
  id              INTEGER PRIMARY KEY,
  payment_id      INTEGER NOT NULL REFERENCES payment(id),
  installment_id  INTEGER NOT NULL REFERENCES installment(id),
  amount          INTEGER NOT NULL CHECK (amount > 0),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at      TEXT
);
CREATE UNIQUE INDEX ux_alloc ON payment_allocation(payment_id, installment_id)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_alloc_inst ON payment_allocation(installment_id) WHERE deleted_at IS NULL;
```

**Kural (Rust'ta, testli):** `SUM(allocation.amount) <= payment.amount` ve taksit başına
`SUM(allocation.amount) <= installment.amount`. Artan kısım **avans**tır: bakiyeyi pozitife
çeker, hiçbir taksite bağlanmaz, sonraki taksitte kullanılır.

---

### 1.19 `ledger_entry` — cari hareket defteri

**Bu tablo neden var:** ADR-004. Bakiye burada *hesaplanır*, saklanmaz.
*"Bu öğrenci neden 1.500 TL borçlu?"* sorusunun cevabı bu tablonun satırlarıdır.

```sql
CREATE TABLE ledger_entry (
  id              INTEGER PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES student(id),
  entry_date      TEXT NOT NULL,                        -- 'YYYY-MM-DD'
  kind            TEXT NOT NULL CHECK (kind IN (
                    'session_charge',      -- (−) ders başı öğrencide ders işlendi
                    'installment_charge',  -- (−) taksidin vadesi geldi
                    'payment',             -- (+) tahsilat alındı
                    'reversal',            -- (±) bir kaydın tersi
                    'adjustment'           -- (±) elle düzeltme / indirim
                  )),
  amount          INTEGER NOT NULL CHECK (amount <> 0), -- kuruş, İŞARETLİ
  attendance_id   INTEGER REFERENCES attendance(id),
  installment_id  INTEGER REFERENCES installment(id),
  payment_id      INTEGER REFERENCES payment(id),
  reverses_id     INTEGER REFERENCES ledger_entry(id),
  memo            TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at      TEXT CHECK (deleted_at IS NULL),   -- şema tekdüzeliği için var, DAİMA NULL
  -- kind='reversal' ⟺ reverses_id dolu. Çift yönlü: 'adjustment' reverses_id taşıyamaz,
  -- 'reversal' de hedefsiz olamaz.
  CHECK ((kind = 'reversal') = (reverses_id IS NOT NULL))
);
CREATE INDEX ix_ledger_student ON ledger_entry(student_id, entry_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ledger_attendance ON ledger_entry(attendance_id)
  WHERE attendance_id IS NOT NULL AND kind = 'session_charge' AND deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ledger_installment ON ledger_entry(installment_id)
  WHERE installment_id IS NOT NULL AND kind = 'installment_charge' AND deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ledger_payment ON ledger_entry(payment_id)
  WHERE payment_id IS NOT NULL AND kind = 'payment' AND deleted_at IS NULL;
-- Bir satır en fazla BİR kez ters kaydedilir
CREATE UNIQUE INDEX ux_ledger_reverses ON ledger_entry(reverses_id)
  WHERE reverses_id IS NOT NULL AND deleted_at IS NULL;
```

#### İşaret kuralı (K3)

`amount` işaretlidir: **(+) öğrencinin lehine** (tahsilat, iade),
**(−) aleyhine** (ders/taksit borcu).

```
bakiye = SUM(amount)        →   negatif = BORÇLU,  pozitif = ALACAKLI (avans)
```

Tasarım da böyle gösteriyor: `balance: -1200` → `−1.200 TL`, kırmızı.
Arayüzde eksi işareti **U+2212 (`−`)**, tire değil.

> ⚠️ Tasarımın Bugün ekranındaki borç listesi aynı borcu pozitif tutuyor
> (`{ name:'Mehmet Aslan', amount:1200 }`). Bu tasarımın kendi içindeki tutarsızlığı;
> tek konvansiyon yukarıdaki. Bugün ekranı `ABS(bakiye)` gösterir.

#### Değişmezlik (K5)

Yazılan satır güncellenmez, silinmez. Yanlışsa `reversal` yazılır. Şema bunu da mühürler:

```sql
-- Sütun listesi YOK: UPDATE'in tamamı kapalı. Sütun listesi yazılırsa listede olmayan
-- her sütun (özellikle deleted_at) açıkta kalır ve ileride eklenen sütunla delik yeniden açılır.
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE ON ledger_entry
BEGIN SELECT RAISE(ABORT, 'ledger_entry_is_immutable'); END;

CREATE TRIGGER trg_ledger_no_delete
BEFORE DELETE ON ledger_entry
BEGIN SELECT RAISE(ABORT, 'ledger_entry_is_immutable'); END;

-- Ters kaydın tutarı orijinalin tam tersi ve aynı öğrenciye ait olmalı.
-- '<>' değil 'IS NOT': hedef satır bulunamazsa NULL üretip sessizce geçmesin.
CREATE TRIGGER trg_ledger_reversal_valid
BEFORE INSERT ON ledger_entry
WHEN NEW.kind = 'reversal'
BEGIN
  SELECT RAISE(ABORT, 'reversal_amount_mismatch')
  WHERE NEW.amount IS NOT (SELECT -amount FROM ledger_entry WHERE id = NEW.reverses_id)
     OR NEW.student_id IS NOT (SELECT student_id FROM ledger_entry WHERE id = NEW.reverses_id);
END;
```

`deleted_at` sütunu şema tekdüzeliği için var ve **her zaman NULL kalır** — bunu artık bir
vaat değil, tablo tanımındaki `CHECK (deleted_at IS NULL)` zorluyor.

> **Neden ikisi birden gerekli (denetimde çalıştırılarak doğrulandı).** Sütunsuz tetikleyici
> tek başına yetmez: `INSERT ... (deleted_at) VALUES ('2026-05-01')` — yani "doğuştan silinmiş"
> satır — hâlâ geçiyordu. `CHECK` tek başına da yetmez: `memo`, `installment_id`, `reverses_id`
> değişimini durdurmuyordu. Sütun **kaldırılamaz**: ADR-005 ve `§0` "her tabloda `deleted_at`"
> diyor, ayrıca `deleted_at IS NULL` süzen 6+ sorgu ve kısmi indeks kırılırdı.
>
> Kapatılan delik şuydu: bütün view'lar `deleted_at IS NULL` süzdüğü için **tek bir UPDATE**
> muhasebe kaydını yok ediyordu — ters kayıt yazmadan, iz bırakmadan. Üstelik
> `installment.accrued_entry_id` dolu kaldığı için tahakkuk fonksiyonu o taksidi bir daha
> yazmıyordu: borç **kalıcı olarak** kayboluyordu. ADR-005'in "hard delete yok" kuralı burada
> soft delete kılığında hard delete'e dönüşüyordu.

**Dört kısmi `UNIQUE` indeks** çifte kaydı imkânsız kılar: aynı yoklamadan iki kez borç, aynı
taksitten iki kez borç, aynı tahsilattan iki kez alacak, aynı satırdan iki kez ters kayıt
yazılamaz. Dördüncüsü (`ux_ledger_reverses`) çift tıkla oluşan **karşılıksız alacağı** kapatır;
paket tarafında aynı kural `ux_pkgusage_att` ile zaten mühürlüydü, defter tarafı açıktaydı.

> `ux_ledger_reverses`'e bilerek `kind` filtresi konmadı — ama `kind` filtreli bir sürüm de
> denendi ve **fazla dar** olduğu için elendi: aynı `payment` satırına bağlı iki kısmi iadeyi
> bloke ediyordu. Yukarıdaki hâli `CHECK ((kind = 'reversal') = (reverses_id IS NOT NULL))`
> ile birlikte doğru davranıyor: `reverses_id` yalnızca ters kayıtlarda dolu olabildiği için
> filtreye gerek kalmıyor.

**Tahsilat da mühürlü.** `payment` satırı defterdeki karşılığından koparılamamalı:

```sql
CREATE TRIGGER trg_payment_immutable
BEFORE UPDATE OF student_id, paid_on, amount, deleted_at ON payment
BEGIN SELECT RAISE(ABORT, 'payment_is_immutable'); END;

CREATE TRIGGER trg_payment_no_delete
BEFORE DELETE ON payment
BEGIN SELECT RAISE(ABORT, 'payment_is_immutable'); END;
```

`receipt_no`, `method` ve `note` düzeltilebilir kalır — tutar, tarih, öğrenci ve arşiv durumu
kalmaz. Ayrı bir `voided_at` sütunu **eklenmedi**: iptal durumu ters kayıttan türetiliyor,
aynı olguyu iki yerde tutmak ADR-004'ün "tek doğruluk kaynağı defter" ilkesine aykırı olurdu.

---

### 1.20 ⭐ `student_note` — öğrenci notu

**Bu tablo neden var:** Tasarımda öğrenci detayının 4. sekmesi. Yazar alanı var
("Ayşe Demir", "Ofis") → not bir öğretmene ait olabilir ya da ofise.

```sql
CREATE TABLE student_note (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES student(id),
  teacher_id  INTEGER REFERENCES teacher(id),   -- NULL = 'Ofis'
  body        TEXT NOT NULL,
  noted_on    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE INDEX ix_note_student ON student_note(student_id, noted_on) WHERE deleted_at IS NULL;
```

---

### 1.21 ⭐ `closed_day` — tatil / kapalı gün

**Bu tablo neden var:** Takvimde taralı sütunlar ve *"Tatil · ders bırakılamaz"* etiketi var;
sürükle-bırak bu sütunlara **düşürmeyi reddediyor**. Haftalık kapalı gün (Pazar)
`setting.weekly_closed_days`'te, tek seferlik tatiller burada.

```sql
CREATE TABLE closed_day (
  id          INTEGER PRIMARY KEY,
  day         TEXT NOT NULL,           -- 'YYYY-MM-DD'
  label       TEXT NOT NULL,           -- 'Ramazan Bayramı'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_closed_day ON closed_day(day) WHERE deleted_at IS NULL;
```

---

### 1.22 ⭐ `backup_log` — yedekleme kaydı

**Bu tablo neden var:** Bugün ekranı *"Son yedekleme: Bugün 08:14 · otomatik"* ve gecikince
turuncu *"3 gün önce · gecikti"* gösteriyor. Yani yedekleme durumu Faz 10'a ait bir detay
değil, **açılış ekranının verisi.**

```sql
CREATE TABLE backup_log (
  id          INTEGER PRIMARY KEY,
  taken_at    TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  size_bytes  INTEGER,
  is_auto     INTEGER NOT NULL DEFAULT 1,
  ok          INTEGER NOT NULL DEFAULT 1,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE INDEX ix_backup_taken ON backup_log(taken_at) WHERE deleted_at IS NULL;
```

---

### 1.23 View'lar

Beş view iki zincir oluşturuyor: **bakiye/borç** (defter tabanlı, ADR-018) ve **ders hakkı**.

```sql
-- Öğrenci bakiyesi (negatif = borçlu).
-- ARŞİVLENMİŞ ÖĞRENCİ DE SAYILIR — filtre yok, bunun yerine is_live bayrağı var.
CREATE VIEW v_student_balance AS
SELECT s.id                   AS student_id,
       (s.deleted_at IS NULL) AS is_live,
       COALESCE(SUM(l.amount), 0) AS balance_kurus
FROM student s
LEFT JOIN ledger_entry l ON l.student_id = s.id AND l.deleted_at IS NULL
GROUP BY s.id;

-- Ters kayıt zincirini uçtan uca netleyen taban görünüm (ADR-022).
-- Her zincir bir BAŞLIK satırından başlar (kind <> 'reversal'). Zincir TEK
-- uzunluktaysa başlık satırı geçerlidir, ÇİFT uzunluktaysa zincir tümüyle düşer.
-- Değişmez: SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus
CREATE VIEW v_ledger_effective AS
WITH RECURSIVE chain(head_id, cur_id, depth) AS (
  SELECT l.id, l.id, 0 FROM ledger_entry l
  WHERE l.deleted_at IS NULL AND l.kind <> 'reversal'
  UNION ALL
  SELECT c.head_id, r.id, c.depth + 1
  FROM chain c
  JOIN ledger_entry r ON r.reverses_id = c.cur_id AND r.deleted_at IS NULL
),
depth_of AS (SELECT head_id, MAX(depth) AS n FROM chain GROUP BY head_id)
SELECT l.* FROM ledger_entry l
JOIN depth_of d ON d.head_id = l.id
WHERE d.n % 2 = 0;

-- Deftere yazılmış her borç satırı, KENDİ vadesiyle.
-- Taksit borcunda vade = installment.due_on (tahakkuk günü değil — uygulama geç
-- açılırsa entry_date kayar). Ders başı borçta vade = ders günü (PRD §4).
CREATE VIEW v_open_charge AS
SELECT l.id         AS entry_id,
       l.student_id,
       COALESCE(i.due_on, l.entry_date) AS due_on,
       -l.amount    AS charge_kurus
FROM v_ledger_effective l
LEFT JOIN installment i ON i.id = l.installment_id AND i.deleted_at IS NULL
WHERE l.amount < 0;

-- BORÇLU LİSTESİNİN TEK KAYNAĞI (ADR-018).
-- Tutar defterden; vade, ödemelerin en eskiden başlayarak mahsup edildiği
-- varsayımıyla (FIFO) ilk kapanmamış borcun vadesidir.
CREATE VIEW v_student_debt AS
WITH credit AS (
  SELECT student_id, SUM(amount) AS credit_kurus
  FROM v_ledger_effective WHERE amount > 0 GROUP BY student_id
),
charge AS (
  SELECT student_id, due_on, charge_kurus,
         SUM(charge_kurus) OVER (PARTITION BY student_id
                                 ORDER BY due_on, entry_id) AS running_kurus
  FROM v_open_charge
)
SELECT c.student_id,
       MAX(0, SUM(c.charge_kurus) - COALESCE(MAX(cr.credit_kurus), 0)) AS debt_kurus,
       MIN(CASE WHEN c.running_kurus > COALESCE(cr.credit_kurus, 0)
                THEN c.due_on END)                                     AS oldest_due_on
FROM charge c
LEFT JOIN credit cr ON cr.student_id = c.student_id
GROUP BY c.student_id;

-- Paketlerin kalan ders hakkı. status'e GÜVENMEZ (aşağıya bak).
CREATE VIEW v_package_remaining AS
SELECT p.id AS package_id, p.student_id, p.valid_until, p.status,
       p.lesson_count + COALESCE(SUM(u.delta), 0) AS remaining
FROM package p
LEFT JOIN package_usage u ON u.package_id = p.id AND u.deleted_at IS NULL
WHERE p.deleted_at IS NULL AND p.status <> 'cancelled'
GROUP BY p.id;

-- Taksit/vade ekranları için (E14 "Bu ay vadesi gelen" çipi, paket detayı "2/4 ödendi").
-- BORÇLU LİSTESİ BUNDAN ÜRETİLMEZ — ADR-018. Vade filtresi yok: "bugün" Rust'tan bind edilir.
CREATE VIEW v_installment_open AS
SELECT i.id, i.student_id, i.package_id, i.seq, i.due_on, i.label,
       i.amount - COALESCE(a.paid, 0) AS open_kurus
FROM installment i
LEFT JOIN (
  SELECT installment_id, SUM(amount) AS paid
  FROM payment_allocation WHERE deleted_at IS NULL
  GROUP BY installment_id
) a ON a.installment_id = i.id
WHERE i.deleted_at IS NULL
  AND i.amount > COALESCE(a.paid, 0);
```

#### Ters kayıt zinciri neden pariteyle netleniyor (ADR-022)

İlk tanım şuydu: *"ters kaydı olan satırı at, ters kayıtların kendisini de at."* Bu, zincirin
en fazla **iki** halkalı olacağını varsayıyor. Oysa §4'ün yoklama düzeltme akışı üç halkalı
bir zincir üretiyor ve şema buna izin veriyor — sonuç, aynı öğrencinin iki ekranda iki farklı
borcu. Faz 2 denetiminde `sqlite3` ile sekiz senaryo çalıştırıldı:

| Senaryo | Zincir | Bakiye | Eski tanım | Parite (ADR-022) |
|---|---|---|---|---|
| Sade ders borcu | 1 | −250 ₺ | 250 ₺ ✅ | 250 ₺ ✅ |
| Ders işlendi, sonra iptal | 2 | 0 | 0 ✅ | 0 ✅ |
| **Geldi → Mazeretli → Geldi** | 3 | −250 ₺ | **0** ❌ | 250 ₺ ✅ |
| Mazeretli'ye geri dönüldü | 4 | 0 | 0 ✅ | 0 ✅ |
| Tahsilat iptal edildi | 2 | −250 ₺ | 250 ₺ ✅ | 250 ₺ ✅ |
| **Tahsilat iptali geri alındı** | 3 | 0 | **250 ₺** ❌ | 0 ✅ |
| Taksit borcu + kısmi tahsilat | 1 | −300 ₺ | 300 ₺ ✅ | 300 ₺ ✅ |
| Arşivli borçlu | 1 | −250 ₺ | 250 ₺ ✅ | 250 ₺ ✅ |

İkinci kırmızı satır o güne kadar hiç görülmemişti: iptal edilmiş bir tahsilatın iptalini geri
almak, **borcu olmayan öğrenciyi borçlu listesine sokuyordu.** Aynı kök sebep, ters yönde.

Parite tanımı doğruluğu tek bir cümleye indirger ve bu cümle test edilebilir:
`SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus` — her öğrenci için, her
zaman. Bakiye ve borçlu listesi artık aynı deftere **yapı gereği** bakıyor.

Zincirler doğrusaldır (`ux_ledger_reverses` dallanmayı engeller) ve döngü kuramaz:
`reverses_id` var olan bir satırı işaret etmek zorunda (yabancı anahtar) ve `trg_ledger_immutable`
her `UPDATE`'i reddediyor (K5) — zincir daima geriye doğru gider, `WITH RECURSIVE` daima biter.

#### Neden borçlu listesi defterden okuyor (ADR-018)

Eski `v_student_overdue` yalnızca `installment` tablosundan besleniyordu. Ders başı
(`per_session`) ödeyen öğrencinin borcu ise `ledger_entry(session_charge)` olarak doğuyor ve
**hiç `installment` satırı üretmiyor**. Sonuç: aylardır ödemeyen ders başı öğrenci Bugün
ekranında ve Ödemeler rozetinde hiç görünmüyor, ama Öğrenciler ekranında kırmızı `−1.000 TL`
olarak duruyordu — aynı öğrenci, iki ekran, iki farklı borç.

Kilit gözlem: **defterdeki her negatif satır tanımı gereği vadesi gelmiş borçtur.**
`session_charge` işlendiği gün yazılır; `installment_charge` ADR-015 gereği yalnızca vadesi
geldiğinde yazılır. Dolayısıyla tutar için `installment` tablosuna hiç gerek yok — tek eksik
parça vade tarihiydi, o da `v_open_charge` ile her borç satırına iliştirildi.

`julianday('now')` ile hesaplanan gecikme gün sayısı da kaldırıldı (`§0` `'now'` kuralı):

```
gecikme_gun = (today - oldest_due_on).num_days()    // Rust, saf tarih farkı, saat yok
```

#### Arşivlenmiş öğrenci hangi listede sayılır

| Liste | Arşivlenmiş öğrenci | Neden |
|---|---|---|
| Borçlu listesi, toplam alacak, cari ekstre | **sayılır** | ADR-005'in gerekçesi: *"silinen öğrencinin geçmiş tahsilatları muhasebe kaydı olarak durmak zorunda."* Borç arşivlemekle yok olmaz; PRD K-14 zaten borçlu öğrenciyi arşivlerken onay istiyor. |
| Bugün ekranı, takvim, yoklama, "Paketi bitmek üzere" | sayılmaz | Program ekranları yalnızca canlı kayıtla ilgilenir. |

Bu yüzden `v_student_balance` **filtre uygulamaz**, `is_live` bayrağı döndürür; süzme kararı
repository katmanında, listeye göre verilir. Önceki sürüm `WHERE s.deleted_at IS NULL` ile
arşivlenen borçluyu toplam alacaktan da düşürüyordu.

#### `package.status` neden hesaba katılmıyor

`status` alanını `'exhausted'` / `'expired'` yapan bir mekanizma tanımlı değildi;
`v_package_remaining` ise yalnızca `status = 'active'` paketleri sayıyordu. Status hiç
güncellenmezse kalan hak eksiye düşer, yeni satılan paket hiç kullanılmaz ve o dersler için
**borç da yazılmaz** — öğrenci bedava ders alır.

Çözüm, ADR-004'ün ilkesiyle aynı: **türetilebilir değere iş mantığı bağlanmaz.**

- **"Aktif paket" bir sorgudur, bir sütun değildir:**
  `remaining > 0 AND (valid_until IS NULL OR valid_until >= :today)`
- `status` yalnızca `'cancelled'` için bağlayıcıdır (satış iptali — bu bir olay, türetilemez).
  `'exhausted'` / `'expired'` **yalnızca rapor etiketidir**; `consume_package` bunları
  günceller ama hiçbir hesap onlara dayanmaz. Güncellenmese de kimse yanlış sonuç almaz.

---

## 2. Şema kuruluş sırası

Migration `0001_initial.sql` içinde bu sırayla:

```
schema_migration → setting
teacher → subject
student → guardian → student_guardian
study_group → price_rule → enrollment
package → installment → package_usage
session_series → session → attendance
payment → payment_allocation → ledger_entry
student_note → closed_day → backup_log
view'lar → trigger'lar → başlangıç verisi
```

View'lar birbirine dayandığı için sıra bağlayıcı:

```
v_student_balance
v_ledger_effective → v_open_charge → v_student_debt
v_package_remaining
v_installment_open
```

**Başlangıç verisi** (seed değil — üretimde de yazılır, `001_initial.sql`'in sonunda):
`§1.2`'deki 14 `setting` varsayılanı ve `§1.3`'teki tek `teacher` satırı.

`session.makeup_for_attendance_id` ile `attendance.session_id` arasında döngüsel bağımlılık
var. SQLite yabancı anahtarları tablo yaratma anında değil **yazma anında** doğruladığı için
bu sorun değil; `session` önce yaratılır.

---

## 3. Paket satışı deftere nasıl yansır — adım adım

> Peşin alınan para ile henüz verilmemiş ders arasındaki ilişki.

Senaryo: **8 derslik paket, 2.000 TL, 2 taksit** (satışta 1.000 + bir ay sonra 1.000).

| # | Olay | Yazılan satırlar | Bakiye | Kalan ders |
|---|---|---|---|---|
| 1 | **Paket satılır** (01.03) | `package(lesson_count=8, unit_price=25000, total_price=200000)`<br>`installment(seq=1, due_on='2026-03-01', amount=100000)`<br>`installment(seq=2, due_on='2026-04-01', amount=100000)` | 0 | 8 |
| 2 | 1. taksidin **vadesi gelir** (01.03) | `ledger_entry(installment_charge, −100000, installment_id=1)` | **−1.000 ₺** | 8 |
| 3 | Veli 1.000 ₺ öder | `payment(100000, 'cash')`<br>`payment_allocation(→ taksit 1, 100000)`<br>`ledger_entry(payment, +100000)` | **0** | 8 |
| 4 | 1. ders işlenir | `attendance(status='present')`<br>`package_usage(delta=−1, reason='attendance')` | **0** | **7** |
| 5 | 2. ve 3. ders işlenir | 2 × `attendance` + 2 × `package_usage(delta=−1)` | **0** | **5** |
| 6 | 2. taksidin vadesi gelir (01.04) | `ledger_entry(installment_charge, −100000, installment_id=2)` | **−1.000 ₺** | 5 |

### Kilit nokta

**Paketli öğrencide ders işlemek deftere hiçbir satır yazmaz.** Para ve ders hakkı iki ayrı
sayaçtır:

| soru | kaynak |
|---|---|
| "Borçlu mu, ne kadar?" | `SUM(ledger_entry.amount)` |
| "Kaç dersi kaldı?" | `lesson_count + SUM(package_usage.delta)` |

Tasarımdaki öğrenci detayında **Bakiye** ve **Kalan ders** kutularının ayrı olmasının sebebi
budur. Bir öğrenci aynı anda "borcu yok" ve "1 ders kaldı" olabilir — tasarımın örnek
verisindeki Ahmet Şahin tam olarak bu durumda.

### Neden ders başına tahakkuk seçilmedi

Alternatif: paketi satışta deftere yazmayıp peşin parayı alacak (`+`) olarak girmek, her ders
işlendiğinde `−250` yazmak. Muhasebe açısından daha doğru (hasılat teslimde tanınır), ama:

- Paketi alıp hiç ödemeyen öğrenci **bakiye 0** görünür → "Borçlu öğrenciler" listesi yalan söyler.
- Taksit ve gecikme kavramı kurulamaz; "12 gün gecikti" hesaplanamaz.
- Kullanıcı muhasebeci değil. Onun zihnindeki model: *"8 derslik paket aldı, 2.000 TL borçlandı."*

Bu seçim **veri kaybettirmiyor.** İhtiyaç olursa "ertelenmiş gelir" raporu aynı şemadan
üretilebilir: `SUM(kalan ders × package.unit_price)`.

---

## 4. Seans iptal edilirse defterde ve paket hakkında ne olur

| Durum | Defter | Paket | Yoklama | Seans |
|---|---|---|---|---|
| Yoklama **alınmamış** seans iptal | hiçbir şey (kayıt zaten yok) | dokunulmaz | `cancelled` | `status='cancelled'` |
| **Ders başı**, işlenmiş seans iptal | `ledger_entry(reversal, +unit_price, reverses_id=<orijinal>)` — orijinal **silinmez** | — | `cancelled` | `status='cancelled'` |
| **Paketli**, işlenmiş seans iptal | değişiklik yok | `package_usage(delta=+1, reason='cancellation_restore')` | `cancelled` | `status='cancelled'` |
| Grup seansı komple iptal | her öğrenci için yukarıdaki kural ayrı ayrı | aynı | hepsi `cancelled` | `status='cancelled'` |

`session.status = 'cancelled'` olur; **`deleted_at` dolmaz.** İptal edilen ders takvimde ve
ders geçmişinde görünmeye devam eder (tasarımda içi boş gri nokta + "İptal").

### Devamsızlık politikası (ADR-016)

| Yoklama | Ders hakkı düşer | Borç yazılır | Telafi hakkı |
|---|---|---|---|
| `present` — Geldi | ✅ | ✅ | — |
| `unexcused` — Mazeretsiz | ✅ | ✅ | tasarımda "Telafi planla" düğmesi var |
| `excused` — Mazeretli | ❌ | ❌ | ✅ |
| `cancelled` — İptal | ❌ | ❌ | — |

Bu davranış `setting.absence_*_consumes_lesson` anahtarlarından okunur; kod sabitlenmez.

**Telafi dersi** `session.is_makeup = 1` + `makeup_for_attendance_id` ile kurulur. Telafi
seansı işlendiğinde **ikinci kez borç yazılmaz ve ikinci kez hak düşmez** — asıl dersin
hakkı zaten mazeretli olduğu için hiç düşmemişti. Telafi seansı kendisi normal bir ders gibi
işlenir; ama `is_makeup = 1` olduğu için tahakkuk fonksiyonu onu atlar.

### Yoklama düzeltilirse ne yazılır

> PRD §7 "Yoklama düzeltme ✅ geri alınabilir" diyor. Bunun **nasıl** yazıldığı tanımlı değildi
> ve akla gelen ilk yol (ikinci bir `session_charge`) `ux_ledger_attendance` indeksine çarpıyor.

Gerçek akış: kullanıcı yanlışlıkla "Geldi" işaretler → düzeltir "Mazeretli" yapar → veli itiraz
eder, tekrar "Geldi" yapılır. Üçüncü adımda ikinci bir `session_charge` yazılamaz.

**Kısmi UNIQUE indeksler değişmez** (PRD K-4/K-5 korunur). Düzeltme, ADR-014'ün zaten öngördüğü
mekanizmayla — **ters kaydın tersiyle** — yazılır:

| Adım | Defter | Paket |
|---|---|---|
| 1. "Geldi" | `session_charge(−250, attendance_id=A)` | `package_usage(A, delta=−1)` |
| 2. "Mazeretli"ye düzeltilir | `reversal(+250, reverses_id=1)` | `package_usage(A, delta=+1, reason='cancellation_restore')` |
| 3. Tekrar "Geldi" | `reversal(−250, reverses_id=2)` | ⚠ aşağıya bak |

Defter tarafı ek DDL gerektirmiyor: `ux_ledger_attendance` yalnızca `kind='session_charge'`
satırlarını süzüyor, ters kayıtlar serbest. `ux_ledger_reverses` her satırın en fazla bir kez
ters kaydedilmesini sağladığı için zincir dallanamaz — 2. adım iki kez yazılamaz.

> **Faz 2 denetimi (kapandı — ADR-022).** Yazma tarafı sorunsuz çalışıyordu ama `§1.23`'teki
> `v_ledger_effective` üç halkalı zinciri okuyamıyor, 3. adımdan sonra borcu **görünmez**
> kılıyordu: Öğrenci detayı −250 ₺ borçlu, borçlu listesi borçsuz. Düzeltme, zincir
> paritesiyle tanımlanan yeni view — akış ve indeksler aynen korunuyor.

> ⚠️ **Faz 6'ya devredilen açık nokta.** `ux_pkgusage_att` `(attendance_id, delta)` üzerinde
> tekil olduğu için 3. adımda ikinci bir `delta=−1` satırı yazılamaz. Ders hakkı tarafında
> düzeltme zinciri şu an **iki adımda tıkanıyor.** İki seçenek var — kararı Faz 6 verecek:
> (a) indekse bir `cycle` sütunu eklemek, (b) `package_usage`'ı da ters-kayıt zinciri modeline
> geçirmek. Faz 2'de DDL **olduğu gibi** yazılır; bu satır Faz 6'nın girdisidir.

### Tahsilat iptal edilirse defterde ve mahsupta ne olur

> PRD R4.10: *"Tahsilat silinemez — iptal = ters kayıt + makbuzun iptal işaretlenmesi."*
> Ters kaydın `payment_allocation` tarafında ne olacağı tanımlı değildi ve bu, iptal edilen
> tahsilatın öğrenciyi **borçlu listesinden düşürmesine** yol açıyordu.

Tek transaction içinde:

1. `ledger_entry(kind='reversal', amount = −payment.amount, payment_id=<p>, reverses_id=<orijinal payment satırı>)`
   — orijinal satır silinmez (K5).
2. O tahsilatın **tüm `payment_allocation` satırları arşivlenir** (`deleted_at` yazılır).
   `v_installment_open` zaten `deleted_at IS NULL` süzdüğü için taksit kendiliğinden yeniden
   açık hâle gelir.
3. **`payment.deleted_at` asla doldurulmaz.** `ux_receipt` kısmi indeksi `deleted_at IS NULL`
   filtreli olduğu için arşivlenen bir tahsilatın makbuz numarası yeniden kullanılabilir hâle
   gelir ve PRD §7'nin *"bir kez verilen numara yeniden kullanılmaz"* kuralı kırılır
   (denetimde doğrulandı: aynı numara iki kez yazılabildi). `trg_payment_immutable` bunu
   şema seviyesinde de engeller.
4. Makbuzdaki "İPTAL" damgası saklanan bir alandan değil, **ters kaydın varlığından** türetilir.

`v_student_debt` defterden okuduğu için 1. adım tek başına borcu geri getirir; 2. adım
taksit/vade ekranlarının doğru kalması içindir.

---

## 5. Üç senaryo, SQL ile

### Senaryo 1 — Birebir, ders başı ödeyen öğrenci: bir ay sonra bakiyesi

Kurulum: `enrollment(pricing_model='per_session', unit_price=25000)` → 250 ₺/ders.
Mart'ta 4 ders işlendi (hepsi `present`), 15.03'te 600 ₺ tahsilat alındı.

> ⚠️ **Bu tahakkuk tek bir `INSERT ... SELECT` olarak yazılamaz.** İlk taslak öyleydi ve
> denetimde iki ayrı sessiz arıza ürettiği görüldü:
>
> 1. **JOIN eşleşmezse sorgu 0 satır yazar ve hata vermez.** Ders işlenmiş, öğrenci
>    borçlanmamıştır — kullanıcı bunu asla öğrenmez. Tek seferlik deneme dersinde ya da
>    kayıt tarihi seansı kapsamadığında tam olarak bu olur.
> 2. **İki `enrollment` eşleşirse** (fiyat zammı için ikincisi açılıp eskisi kapatılmayı
>    unutulmuşsa) sorgu iki satır üretir, `ux_ledger_attendance` hata verir ve PRD R2.4 gereği
>    **tüm yoklama transaction'ı düşer** — kullanıcı 5 kişilik grubun yoklamasını kaydedemez.

Doğrusu: fiyat kaynağı **önce açıkça çözülür**, sonra tek satır yazılır. Rust'ta, `§6`
sözleşmesinde:

```
fn resolve_unit_price(attendance_id) -> Result<i64, PriceNotFound>
  1. Eşleşen canlı `enrollment` (birebir, aynı branş, aralık içi, per_session) → unit_price
     Birden fazla eşleşme → Err(AmbiguousEnrollment)   // sessizce ilkini seçme
  2. Yoksa: session.unit_price (tek seferlik ders / deneme dersi snapshot'ı)
  3. Yoksa: Err(PriceNotFound) — sessiz geçilmez
```

`PriceNotFound` kullanıcıya PRD §8 dilinde sorulur:
*"Bu ders için tarife bulunamadı. Ders başı ücret yazılsın mı?"* — yani K-7 ile aynı dil.

Fiyat çözüldükten sonra yazılan satır:

```sql
-- Ders işlenince tek transaction içinde yazılan borç satırı.
-- :unit_price yukarıdaki fonksiyondan gelir; sorgu artık enrollment'a JOIN ETMEZ.
INSERT INTO ledger_entry (student_id, entry_date, kind, amount, attendance_id, memo)
SELECT a.student_id, s.session_date, 'session_charge', -:unit_price, a.id,
       sub.name || ' · Birebir'
FROM attendance a
JOIN session     s ON s.id   = a.session_id
JOIN subject   sub ON sub.id = s.subject_id
WHERE a.id = :attendance_id
  AND a.status IN ('present', 'unexcused')      -- ADR-016
  AND s.is_makeup = 0;

-- Ay sonu bakiyesi:
SELECT printf('%.2f', SUM(amount) / 100.0) AS bakiye_tl
FROM ledger_entry
WHERE student_id = :id
  AND deleted_at IS NULL
  AND entry_date <= '2026-03-31';
```

| hareket | kuruş |
|---|---|
| 4 × `session_charge` | −100.000 |
| 1 × `payment` | +60.000 |
| **Bakiye** | **−40.000 = −400,00 ₺ → 400 ₺ borçlu** |

---

### Senaryo 2 — 8 derslik paket alan, 3 ders işleyen öğrenci

```sql
-- Kalan hak
SELECT p.id,
       p.lesson_count                              AS hak,
       -COALESCE(SUM(u.delta), 0)                  AS kullanilan,
       p.lesson_count + COALESCE(SUM(u.delta), 0)  AS kalan
FROM package p
LEFT JOIN package_usage u ON u.package_id = p.id AND u.deleted_at IS NULL
WHERE p.student_id = :id AND p.status = 'active' AND p.deleted_at IS NULL
GROUP BY p.id;
-- → hak 8, kullanılan 3, kalan 5

-- Bakiye
SELECT COALESCE(SUM(amount), 0) AS bakiye_kurus
FROM ledger_entry
WHERE student_id = :id AND deleted_at IS NULL;
```

| durum | kalan ders | bakiye |
|---|---|---|
| Paket peşin ödendi | **5** | **0** (`−200.000` + `+200.000`) |
| 2 taksitli, 1. ödendi, 2. vadesi geldi | **5** | **−100.000 = −1.000 ₺** |
| 2 taksitli, 1. ödendi, 2. vadesi gelmedi | **5** | **0** |

Üç satır da aynı ders hakkını, farklı bakiyeyi gösteriyor — iki sayacın bağımsızlığı.

---

### Senaryo 3 — Grup dersine dönem ortasında katılan öğrenci

Kurulum: "Matematik · Grup A", dönem 01.02 – 30.06, haftada 2 ders.
Öğrenci **15.03**'te katıldı → `enrollment(study_group_id=…, start_on='2026-03-15')`.

```sql
-- Kaç dersten sorumlu?
SELECT COUNT(*) AS sorumlu_ders
FROM session s
JOIN enrollment e
  ON e.study_group_id = s.study_group_id
 AND e.student_id     = :id
 AND e.deleted_at IS NULL
WHERE s.study_group_id = :group_id
  AND s.deleted_at IS NULL
  AND s.status <> 'cancelled'
  AND s.session_date >= e.start_on
  AND (e.end_on IS NULL OR s.session_date <= e.end_on);

-- 15.03 öncesindeki seanslarda yoklaması var mı?
SELECT COUNT(*) FROM attendance a
JOIN session s ON s.id = a.session_id
WHERE a.student_id = :id
  AND s.study_group_id = :group_id
  AND s.session_date < '2026-03-15';
-- → 0. Sadece boş değil: trg_attendance_within_enrollment yüzünden
--   böyle bir satırı INSERT etmek de mümkün değil.
```

01.02–14.03 arasındaki ~12 ders bu öğrenciyi **hiçbir yerde** ilgilendirmez: yoklama
ekranında görünmez, devam oranına girmez, deftere borç yazmaz, ekstrede yer almaz.

Öğrenci 20.05'te ayrılırsa `end_on = '2026-05-20'` yazılır. Geçmiş yoklamaları ve borçları
aynen kalır; 21.05'ten sonraki seanslarda görünmez. Eylül'de geri dönerse **ikinci bir
`enrollment` satırı** açılır — aralıklar çakışmadığı sürece geçmiş bozulmaz.

---

## 6. Rust tarafında test edilmesi zorunlu fonksiyonlar

CLAUDE.md: *"Para ile ilgili her fonksiyonun testi olur. Bu pazarlık konusu değil."*

| fonksiyon | test etmesi gereken |
|---|---|
| `student_balance(student_id)` | boş defter = 0; işaret yönü; **arşivlenmiş öğrencinin bakiyesi kaybolmaz** (`is_live=0` ile döner) |
| `student_debt(today)` | **ders başı öğrenci listede çıkar** (ADR-018); avanslı öğrenci çıkmaz; ters kaydedilmiş borç çıkmaz; FIFO vade doğru — 4×250 borç + 600 ödeme → borç 400, en eski vade 3. dersin günü |
| `resolve_unit_price(attendance_id)` | eşleşen kayıt yoksa **hata döner, 0 yazmaz**; iki eşleşmede `AmbiguousEnrollment`; `session.unit_price` yedeği çalışır |
| `charge_session(attendance_id)` | ikinci çağrı `UNIQUE` ihlali verir; `excused` borç yazmaz; telafi seansı atlanır |
| `correct_attendance(attendance_id, yeni_durum)` | düzeltme zinciri ters kayıtla yazılır, ikinci `session_charge` denenmez; üç adımlık zincir (Geldi → Mazeretli → Geldi) defterde doğru bakiye bırakır |
| `accrue_due_installments(today)` | idempotent; vadesi gelmemiş taksit yazılmaz; `today` **parametredir**, `date('now')` kullanılmaz |
| `record_payment(...)` | mahsup toplamı ödemeyi aşamaz; otomatik mahsup **bütün açık taksitleri** kapsar (vadesi gelmiş + gelmemiş, `due_on` artan); artan avans olarak kalır ve `v_student_debt` ile `v_student_balance` çelişmez |
| `void_payment(payment_id)` | ters kayıt yazılır; `payment_allocation` satırları arşivlenir; taksit yeniden açılır; **öğrenci borçlu listesine geri döner**; `payment.deleted_at` dolmaz |
| `cancel_session(session_id)` | ders başında ters kayıt; pakette hak iadesi; iki kez iptal iki iade yapmaz (`ux_ledger_reverses`) |
| `package_remaining(package_id)` | negatife düşmez; iade sonrası doğru; **`status` güncellenmemiş olsa da doğru** |
| `consume_package(attendance_id)` | paket yoksa hata; birden fazla aktif pakette en eskisini kullanır; tükenmiş paket seçilmez |
| `generate_sessions(today)` | ufka kadar üretir; idempotent (`ux_session_series_slot`); kapalı güne üretmez; iptal edilmiş seansı diriltmez |
| `assert_no_enrollment_overlap(...)` | aynı öğrenci + branş için çakışan aralık reddedilir |
| `backup_now()` / `restore(path)` | `VACUUM INTO` ile alınan yedek **açık bağlantıyla dolu çıkar** (ADR-019); geri yükleme `-wal`/`-shm` bırakmaz |
| `format_kurus(i64)` / `parse_kurus(&str)` | `123456` ↔ `"1.234,56"`; negatifte U+2212 |
| `sort_tr(&[&str])` | `Çınar < Demir`, `İnce < Kaya`, `ışık < iyi` (ADR-020) |

Testler in-memory SQLite üzerinde, gerçek migration'lar uygulanarak çalışır (ADR-002).

**Şema değişmezi (ADR-022).** Fonksiyon testlerinden bağımsız olarak, her senaryo kurulumunun
sonunda şu eşitlik sınanır — bakiye ile borçlu listesinin ayrışmasını yakalayan tek satır:

```sql
-- her öğrenci için sıfır satır dönmeli
SELECT b.student_id FROM v_student_balance b
LEFT JOIN (SELECT student_id, SUM(amount) AS eff FROM v_ledger_effective GROUP BY student_id) e
       ON e.student_id = b.student_id
WHERE COALESCE(e.eff, 0) <> b.balance_kurus;
```

**Hiçbir testte tarih SQLite'tan okunmaz** (`§0` `'now'` kuralı). `today` her zaman
parametredir; aksi hâlde testler CI makinesinin saat dilimine bağlı olur ve macOS'ta geçip
Windows CI'da düşer.

---

## 7. Bu şemanın bilinçli olarak yapmadıkları

| yapılmadı | gerekirse ne olur |
|---|---|
| Çoklu şube / kurum | Şu an tek kurum varsayılıyor; kurum adı derleme zamanı sabiti (ADR-024). Çoklu şube gerekirse önce o karar geri alınır: kurum kimliği veriye döner. |
| Öğretmen hakedişi / maaş | ADR-011: tek öğretmen. Gerekirse `teacher_payout` tablosu eklenir. |
| KDV / fatura | Kurs sahibi makbuz veriyor, fatura kesmiyor. Gerekirse `payment`'a alan eklenir. |
| Derslik / oda çakışması | Tasarımda oda kavramı yok. |
| Çoklu para birimi | ₺ sabit. |
| Öğrenci portalı / veli girişi | ADR-001: sunucu, hesap, giriş yok. |
