------------------------------------------------------------------------------
-- 003 — package_usage ters kayıt zincirine geçer (ADR-036, ADR-022'nin ikizi)
--
-- SORUN. Ders hakkı düzeltmesi İKİ adımda tıkanıyordu. `ux_pkgusage_att` tekilliği
-- (attendance_id, delta) üzerindeydi, dolayısıyla
--   Geldi → package_usage(A, −1) · Mazeretli → package_usage(A, +1) · Tekrar Geldi → ✗
-- üçüncü adımın `delta = −1`'i birincisiyle çakışıyor ve YAZILAMIYORDU. Kullanıcının
-- yoklamayı ikinci kez değiştirmesi normal bir olay (`VERI-MODELI.md §4`); defter
-- tarafı bunu ADR-022 ile çözmüştü, ders hakkı tarafı açıktaydı.
--
-- KARAR (ADR-036, seçenek b). `cycle` sütunu eklemek (seçenek a) tıkanmayı açardı ama
-- projede İKİ FARKLI DÜZELTME DİLİ bırakırdı: defter "ters kaydın tersi", ders hakkı
-- "üçüncü tur". Aynı kullanıcı eylemi iki tabloda iki ayrı zihinsel modelle kaydedilir
-- ve her hata ayıklaması ikisini birden kurmak zorunda kalır. Aşağıdaki dört değişiklik
-- `ledger_entry`'nin dört mührünün birebir ikizidir.
--
-- PARİTE VIEW'I GEREKMİYOR — ve bu bir tesadüf değil. Defterde parite şart, çünkü
-- `v_open_charge`/`v_student_debt` hangi BAŞLIK satırının canlı olduğunu bilmek zorunda
-- (vade, tür). Ders hakkında yalnızca TOPLAM anlam taşıyor ve `delta` işareti kendi
-- içinde: zincir −1, +1, −1, … diye alternatiflendiği için canlı satırların toplamı her
-- uzunlukta doğru sonucu veriyor (−1+1−1 = −1). Bu yüzden `v_package_remaining` olduğu
-- gibi kalıyor. Doğruluğu tümüyle trg_pkgusage_reversal_valid'in taşıdığı değişmeze
-- dayanıyor: TERS KAYDIN delta'SI HEDEFİN TAM TERSİDİR.
--
-- IDEMPOTENCY ESKİSİNDEN GÜÇLÜ. Kaldırılan indeks yalnızca derinlik 1'de koruyordu.
-- Yerine gelen ikisi her zincir derinliğinde koruyor: bir yoklamanın en fazla BİR
-- başlık satırı olur (çift tık ikinci kez düşemez) ve bir satır en fazla BİR kez ters
-- kaydedilir (düzeltme de iki kez yazılamaz).
--
-- MEVCUT VERİ. `package_usage`'a bugüne kadar yalnızca `seed` yazdı ve seed hiç
-- `delta = +1` satırı üretmiyor; üretimde tablo boş, çünkü paket ekranları henüz yok.
-- Dolayısıyla geriye dönük eşleştirme (backfill) yazılmadı: çalıştırılamayacak,
-- dolayısıyla test edilemeyecek bir dal olurdu. Eski satırların hepsi `reverses_id`
-- NULL ile başlık sayılıyor ve tekil `attendance_id` taşıdıkları için yeni indeks
-- sorunsuz kuruluyor.
------------------------------------------------------------------------------

-- 1) Ters kayıt bağı. `ledger_entry.reverses_id`'nin ikizi.
--    Varsayılan NULL: SQLite ADD COLUMN'a yabancı anahtar yalnızca böyle izin verir.
ALTER TABLE package_usage ADD COLUMN reverses_id INTEGER REFERENCES package_usage(id);

-- 2) Tıkanmanın kaynağı olan indeks kalkıyor: (attendance_id, delta) tekilliği
--    üçüncü adımı imkânsız kılıyordu.
DROP INDEX ux_pkgusage_att;

-- 3) Bir yoklamanın en fazla BİR başlık satırı olur — `ux_ledger_attendance`'ın ikizi.
--    Çift tık ikinci kez hak düşüremez.
CREATE UNIQUE INDEX ux_pkgusage_head ON package_usage(attendance_id)
  WHERE attendance_id IS NOT NULL AND reverses_id IS NULL AND deleted_at IS NULL;

-- 4) Bir satır en fazla BİR kez ters kaydedilir — `ux_ledger_reverses`'in ikizi.
--    Zincir dallanamaz, dolayısıyla doğrusaldır.
CREATE UNIQUE INDEX ux_pkgusage_reverses ON package_usage(reverses_id)
  WHERE reverses_id IS NOT NULL AND deleted_at IS NULL;

-- 5) Append-only mühürleri — `trg_ledger_immutable` / `_no_delete`'in ikizi.
--
--    SÜTUN LİSTESİ YOK: UPDATE'in tamamı kapalı. Sütun listesi yazılsaydı listede
--    olmayan her sütun (özellikle `deleted_at`) açıkta kalır ve ileride eklenen bir
--    sütunla delik yeniden açılırdı — defterde tam olarak bu delik ölçülmüştü.
--
--    BEDELİ AÇIKÇA: `package_usage` satırı artık ARŞİVLENEMEZ. `deleted_at` sütunu
--    tabloda duruyor (proje kuralı: her tabloda `deleted_at`) ama hiç yazılmıyor.
--    `v_package_remaining`'in `deleted_at IS NULL` koşulu bu yüzden daima doğru;
--    koşul KALDIRILMIYOR, çünkü kaldırmak tetikleyiciye olan bağımlılığı görünmez kılar.
CREATE TRIGGER trg_pkgusage_immutable
BEFORE UPDATE ON package_usage
BEGIN SELECT RAISE(ABORT, 'package_usage_is_immutable'); END;

CREATE TRIGGER trg_pkgusage_no_delete
BEFORE DELETE ON package_usage
BEGIN SELECT RAISE(ABORT, 'package_usage_is_immutable'); END;

-- 6) Ters kaydın `delta`'sı hedefin tam tersi, paketi aynı — `trg_ledger_reversal_valid`
--    ikizi. `v_package_remaining`'in doğruluğu DOĞRUDAN bu satıra dayanıyor: toplam
--    ancak zincir alternatifliyse anlamlı.
--
--    '<>' değil 'IS NOT': hedef satır bulunamazsa karşılaştırma NULL üretip sessizce
--    geçmesin.
CREATE TRIGGER trg_pkgusage_reversal_valid
BEFORE INSERT ON package_usage
WHEN NEW.reverses_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'pkgusage_reversal_mismatch')
  WHERE NEW.delta IS NOT (SELECT -delta FROM package_usage WHERE id = NEW.reverses_id)
     OR NEW.package_id IS NOT (SELECT package_id FROM package_usage WHERE id = NEW.reverses_id);
END;
