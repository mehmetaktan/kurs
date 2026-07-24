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

### Ortak sözleşme

Her tabloda (ADR-005):

```sql
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now')),
deleted_at TEXT                      -- NULL = canlı. Kullanıcıya "Arşivlendi" denir.
```

- Bütün para alanları `INTEGER`, **kuruş** (ADR-003). `1.234,56 ₺` → `123456`.
- Bütün tarihler `TEXT`: `'YYYY-MM-DD'` veya `'YYYY-MM-DD HH:MM'`. Sıralanabilir, karşılaştırılabilir.
- Bütün "canlı kayıt" indeksleri kısmi: `WHERE deleted_at IS NULL`.
- `PRAGMA foreign_keys = ON` her bağlantıda. `PRAGMA journal_mode = WAL`.

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
  applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
  checksum    TEXT NOT NULL              -- migration dosyasının SHA-256'sı
);
```

`checksum`: uygulanmış bir migration dosyası sonradan değiştirilirse açılışta hata verir.
Teknik olmayan kullanıcıda sessiz veri bozulmasının en olası kaynağı budur.

---

### 1.2 `setting`

**Bu tablo neden var:** Kurum adı, çalışma saatleri, yoklama politikası gibi tek satırlık
kararların her biri için tablo açmamak. Kenar çubuğundaki "Aydın Özel Ders", takvimin
08:00–22:00 aralığı ve `rahat/sıkı` satır yoğunluğu buradan gelir.

```sql
CREATE TABLE setting (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
```

| key | varsayılan | nerede kullanılır |
|---|---|---|
| `institution_name` | `Aydın Özel Ders` | kenar çubuğu başlığı, makbuz başlığı |
| `day_start` / `day_end` | `08:00` / `22:00` | takvim dikey aralığı |
| `slot_minutes` | `30` | takvimde sürükleme kilitlenmesi |
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE INDEX ix_teacher_active ON teacher(is_active) WHERE deleted_at IS NULL;
```

> **MVP sadeleştirmesi (ADR-011).** Takvimdeki öğretmen filtresi ve Gün görünümünün
> öğretmen-başına-sütun düzeni arayüzde **kurulmaz**. Gün görünümü tek geniş sütundur.
> Şema değişmez; ikinci öğretmen eklenirse bu ekranlar açılır.

---

### 1.4 `subject` — branş

**Bu tablo neden var:** "Matematik" serbest metin olursa raporda `Matematik` / `matematik` /
`Mat` üç ayrı satır olur.

```sql
CREATE TABLE subject (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_subject_name ON subject(name) WHERE deleted_at IS NULL;
```

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
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
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
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,                    -- 'Grup A'
  subject_id  INTEGER NOT NULL REFERENCES subject(id),
  teacher_id  INTEGER REFERENCES teacher(id),
  capacity    INTEGER NOT NULL DEFAULT 6 CHECK (capacity > 0),
  starts_on   TEXT,
  ends_on     TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_group_name ON study_group(subject_id, name) WHERE deleted_at IS NULL;
```

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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT,
  CHECK (end_on IS NULL OR end_on >= start_on)
);
CREATE INDEX ix_enr_student ON enrollment(student_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_enr_group   ON enrollment(study_group_id, start_on, end_on)
  WHERE deleted_at IS NULL;
```

`unit_price` ADR-006 gereği kayıt anındaki tarifenin kopyasıdır. Eylül'de zam yapılınca
Mart'ın raporu değişmez.

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
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);
CREATE INDEX ix_ledger_student ON ledger_entry(student_id, entry_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ledger_attendance ON ledger_entry(attendance_id)
  WHERE attendance_id IS NOT NULL AND kind = 'session_charge' AND deleted_at IS NULL;
CREATE UNIQUE INDEX ux_ledger_installment ON ledger_entry(installment_id)
  WHERE installment_id IS NOT NULL AND kind = 'installment_charge' AND deleted_at IS NULL;
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
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE OF student_id, entry_date, kind, amount ON ledger_entry
BEGIN SELECT RAISE(ABORT, 'ledger_entry_is_immutable'); END;

CREATE TRIGGER trg_ledger_no_delete
BEFORE DELETE ON ledger_entry
BEGIN SELECT RAISE(ABORT, 'ledger_entry_is_immutable'); END;
```

`deleted_at` sütunu şema tekdüzeliği için var ama **her zaman NULL kalır**.

İki kısmi `UNIQUE` indeks çifte tahakkuku imkânsız kılar: aynı yoklamadan iki kez borç,
aynı taksitten iki kez borç yazılamaz.

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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);
CREATE INDEX ix_backup_taken ON backup_log(taken_at) WHERE deleted_at IS NULL;
```

---

### 1.23 View'lar

```sql
-- Öğrenci bakiyesi (negatif = borçlu)
CREATE VIEW v_student_balance AS
SELECT s.id AS student_id,
       COALESCE(SUM(l.amount), 0) AS balance_kurus
FROM student s
LEFT JOIN ledger_entry l ON l.student_id = s.id AND l.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id;

-- Aktif paketlerin kalan ders hakkı
CREATE VIEW v_package_remaining AS
SELECT p.id AS package_id, p.student_id,
       p.lesson_count + COALESCE(SUM(u.delta), 0) AS remaining
FROM package p
LEFT JOIN package_usage u ON u.package_id = p.id AND u.deleted_at IS NULL
WHERE p.deleted_at IS NULL AND p.status = 'active'
GROUP BY p.id;

-- Vadesi geçmiş borç ve en eski gecikme (Bugün ekranı)
CREATE VIEW v_student_overdue AS
SELECT i.student_id,
       MIN(i.due_on)                              AS oldest_due_on,
       SUM(i.amount - COALESCE(a.paid, 0))        AS overdue_kurus
FROM installment i
LEFT JOIN (
  SELECT installment_id, SUM(amount) AS paid
  FROM payment_allocation WHERE deleted_at IS NULL
  GROUP BY installment_id
) a ON a.installment_id = i.id
WHERE i.deleted_at IS NULL
  AND i.due_on <= date('now')
  AND i.amount > COALESCE(a.paid, 0)
GROUP BY i.student_id;
```

`v_student_overdue` doğrudan Bugün ekranındaki
*"Mehmet Aslan — 1.200 TL — 12 gün gecikti"* satırını üretir
(`julianday('now') - julianday(oldest_due_on)`).

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
view'lar → trigger'lar
```

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

---

## 5. Üç senaryo, SQL ile

### Senaryo 1 — Birebir, ders başı ödeyen öğrenci: bir ay sonra bakiyesi

Kurulum: `enrollment(pricing_model='per_session', unit_price=25000)` → 250 ₺/ders.
Mart'ta 4 ders işlendi (hepsi `present`), 15.03'te 600 ₺ tahsilat alındı.

```sql
-- Ders işlenince tek transaction içinde yazılan borç satırı:
INSERT INTO ledger_entry (student_id, entry_date, kind, amount, attendance_id, memo)
SELECT a.student_id, s.session_date, 'session_charge', -e.unit_price, a.id,
       sub.name || ' · Birebir'
FROM attendance a
JOIN session     s ON s.id  = a.session_id
JOIN subject   sub ON sub.id = s.subject_id
JOIN enrollment  e ON e.student_id     = a.student_id
                  AND e.study_group_id IS NULL
                  AND e.subject_id     = s.subject_id
                  AND e.pricing_model  = 'per_session'
                  AND e.deleted_at IS NULL
                  AND e.start_on <= s.session_date
                  AND (e.end_on IS NULL OR s.session_date <= e.end_on)
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
| `student_balance(student_id)` | boş defter = 0; işaret yönü; arşivlenmiş satır sayılmaz |
| `charge_session(attendance_id)` | ikinci çağrı `UNIQUE` ihlali verir; `excused` borç yazmaz; telafi seansı atlanır |
| `accrue_due_installments(today)` | idempotent; vadesi gelmemiş taksit yazılmaz |
| `record_payment(...)` | mahsup toplamı ödemeyi aşamaz; artan avans olarak kalır |
| `cancel_session(session_id)` | ders başında ters kayıt; pakette hak iadesi; iki kez iptal iki iade yapmaz |
| `package_remaining(package_id)` | negatife düşmez; iade sonrası doğru |
| `consume_package(attendance_id)` | paket yoksa hata; birden fazla aktif pakette en eskisini kullanır |
| `format_kurus(i64)` / `parse_kurus(&str)` | `123456` ↔ `"1.234,56"`; negatifte U+2212 |

Testler in-memory SQLite üzerinde, gerçek migration'lar uygulanarak çalışır (ADR-002).

---

## 7. Bu şemanın bilinçli olarak yapmadıkları

| yapılmadı | gerekirse ne olur |
|---|---|
| Çoklu şube / kurum | Şu an tek kurum varsayılıyor; `setting.institution_name` yeterli. |
| Öğretmen hakedişi / maaş | ADR-011: tek öğretmen. Gerekirse `teacher_payout` tablosu eklenir. |
| KDV / fatura | Kurs sahibi makbuz veriyor, fatura kesmiyor. Gerekirse `payment`'a alan eklenir. |
| Derslik / oda çakışması | Tasarımda oda kavramı yok. |
| Çoklu para birimi | ₺ sabit. |
| Öğrenci portalı / veli girişi | ADR-001: sunucu, hesap, giriş yok. |
