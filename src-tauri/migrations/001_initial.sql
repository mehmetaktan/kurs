-- 001_initial.sql — Kurs Takip ilk şeması
--
-- Kaynak: docs/VERI-MODELI.md (Faz 1 çıktısı, Faz 1 denetiminden sonra düzeltilmiş hâli).
-- Tablo sırası VERI-MODELI.md §2'deki kuruluş sırasıdır.
--
-- ⚠️ BU DOSYA UYGULANDIKTAN SONRA DEĞİŞTİRİLEMEZ.
-- İçeriğinin SHA-256'sı schema_migration.checksum'a yazılır; tek bir karakter değişirse
-- uygulama açılışta durur. Şema değişikliği YENİ bir migration dosyasıyla yapılır.
-- Bu yüzden .gitattributes `*.sql text eol=lf` diyor: Windows checkout'unda CRLF'e
-- dönüşen dosya farklı bir checksum üretir ve hata macOS'ta hiç görünmez.
--
-- `schema_migration` tablosu bilerek bu dosyada DEĞİL, migration çalıştırıcısındadır
-- (src/db/migrate.rs). Hangi migration'ların uygulandığını okuyabilmek için o tablonun
-- ilk migration'dan ÖNCE var olması gerekir — yumurta-tavuk. DDL'i §1.1 ile aynıdır.
--
-- 'now' kuralı (§0): 'now' YALNIZCA denetim sütunlarının DEFAULT'unda ve DAİMA
-- 'localtime' ile kullanılır. Kullanıcıya görünen hiçbir hesap SQLite saatini okumaz;
-- "bugün" Rust'tan (chrono::Local) bind edilir.

------------------------------------------------------------------------------
-- §1.2 setting
------------------------------------------------------------------------------

CREATE TABLE setting (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);

------------------------------------------------------------------------------
-- §1.3 teacher
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.4 subject — branş
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.5 student — öğrenci
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.6 guardian — veli
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.7 student_guardian — öğrenci ↔ veli
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.8 study_group — grup
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.10 price_rule — tarife
-- (enrollment.price_rule_id bu tabloya baktığı için §1.9'dan önce yaratılır — §2)
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.9 enrollment — kayıt
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.11 package — ders paketi
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.13 installment — taksit
-- (package_usage.attendance_id ve installment.accrued_entry_id ileriye referans verir;
--  SQLite yabancı anahtarı YAZMA anında doğrular, yaratma anında değil — §2)
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.12 package_usage — paket kullanımı
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.14 session_series — haftalık ders şablonu
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.15 session — seans (birebir + grup, tek tablo)
------------------------------------------------------------------------------

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

-- §1.14: seans üretimi idempotent olmak zorunda — aynı seri + aynı başlangıç anı iki kez yazılamaz.
CREATE UNIQUE INDEX ux_session_series_slot ON session(series_id, starts_at)
  WHERE series_id IS NOT NULL AND deleted_at IS NULL;

------------------------------------------------------------------------------
-- §1.16 attendance — yoklama
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.17 payment — tahsilat
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.18 payment_allocation — tahsilatın taksite mahsubu
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.19 ledger_entry — cari hareket defteri
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.20 student_note — öğrenci notu
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.21 closed_day — tatil / kapalı gün
------------------------------------------------------------------------------

CREATE TABLE closed_day (
  id          INTEGER PRIMARY KEY,
  day         TEXT NOT NULL,           -- 'YYYY-MM-DD'
  label       TEXT NOT NULL,           -- 'Ramazan Bayramı'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  deleted_at  TEXT
);
CREATE UNIQUE INDEX ux_closed_day ON closed_day(day) WHERE deleted_at IS NULL;

------------------------------------------------------------------------------
-- §1.22 backup_log — yedekleme kaydı
------------------------------------------------------------------------------

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

------------------------------------------------------------------------------
-- §1.23 View'lar
-- Sıra bağlayıcı: v_ledger_effective → v_open_charge → v_student_debt
------------------------------------------------------------------------------

-- Öğrenci bakiyesi (negatif = borçlu).
-- ARŞİVLENMİŞ ÖĞRENCİ DE SAYILIR — filtre yok, bunun yerine is_live bayrağı var.
CREATE VIEW v_student_balance AS
SELECT s.id                   AS student_id,
       (s.deleted_at IS NULL) AS is_live,
       COALESCE(SUM(l.amount), 0) AS balance_kurus
FROM student s
LEFT JOIN ledger_entry l ON l.student_id = s.id AND l.deleted_at IS NULL
GROUP BY s.id;

-- Ters kayıtları netleyen taban görünüm: ters kaydın kendisi de, ters kaydedilmiş
-- orijinal satır da düşer. Geriye yalnızca "hâlâ geçerli" hareketler kalır.
CREATE VIEW v_ledger_effective AS
SELECT l.* FROM ledger_entry l
WHERE l.deleted_at IS NULL
  AND l.kind <> 'reversal'
  AND NOT EXISTS (SELECT 1 FROM ledger_entry r
                  WHERE r.reverses_id = l.id AND r.deleted_at IS NULL);

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

-- Paketlerin kalan ders hakkı. status'e GÜVENMEZ.
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

------------------------------------------------------------------------------
-- Trigger'lar — şemanın mühürleri
------------------------------------------------------------------------------

-- §1.16 Katılım aralığı garantisi: kod yanlış yazılsa bile veritabanı reddeder.
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

-- §1.19 Değişmezlik (K5).
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

-- Tahsilat da mühürlü: payment satırı defterdeki karşılığından koparılamaz.
-- receipt_no, method ve note düzeltilebilir kalır.
CREATE TRIGGER trg_payment_immutable
BEFORE UPDATE OF student_id, paid_on, amount, deleted_at ON payment
BEGIN SELECT RAISE(ABORT, 'payment_is_immutable'); END;

CREATE TRIGGER trg_payment_no_delete
BEFORE DELETE ON payment
BEGIN SELECT RAISE(ABORT, 'payment_is_immutable'); END;

------------------------------------------------------------------------------
-- Başlangıç verisi (§2 sonu) — SEED DEĞİL, üretimde de yazılır.
-- Seed yalnızca geliştirmede çalışır; bu satırlar oraya konursa kurs sahibinin
-- gerçek makinesinde teacher tablosu sonsuza kadar boş kalır (§1.3).
------------------------------------------------------------------------------

-- §1.2 varsayılanları
INSERT INTO setting (key, value) VALUES
  ('institution_name',                   'Aydın Özel Ders'),
  ('day_start',                          '08:00'),
  ('day_end',                            '22:00'),
  ('slot_minutes',                       '30'),
  ('default_session_minutes',            '60'),
  ('session_horizon_weeks',              '16'),
  ('weekly_closed_days',                 '7'),
  ('row_density',                        'comfortable'),
  ('absence_excused_consumes_lesson',    '0'),
  ('absence_unexcused_consumes_lesson',  '1'),
  ('package_expiry_days',                ''),
  ('receipt_prefix',                     '2026-'),
  ('receipt_next_no',                    '1'),
  ('backup_warn_days',                   '3'),
  ('last_backup_at',                     '');

-- §1.3 tek öğretmen satırı (ADR-011). Ad, Tanımlar → Genel ekranından değiştirilir.
INSERT INTO teacher (id, full_name, color) VALUES (1, 'Öğretmen', '#5f8f6b');
