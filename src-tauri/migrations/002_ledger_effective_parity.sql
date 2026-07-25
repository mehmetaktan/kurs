------------------------------------------------------------------------------
-- 002 — v_ledger_effective: ters kayıt zinciri paritesi (ADR-022)
--
-- 001'deki tanım zincirin en fazla İKİ halkalı olacağını varsayıyordu (borç + tersi).
-- VERI-MODELI.md §4'ün yoklama düzeltme akışı ise üç halkalı zincir üretiyor:
--   Geldi → session_charge(−250) · Mazeretli → reversal(+250) · Tekrar Geldi → reversal(−250)
-- Eski tanım üç satırın üçünü de eliyordu: bakiye −250 ₺ borç gösterirken borçlu
-- listesi öğrenciyi hiç göstermiyordu. Denetimde ters yönde ikinci bir arıza da çıktı:
-- iptal edilmiş bir tahsilatın iptalini geri almak, borcu olmayan öğrenciyi borçlu
-- listesine sokuyordu.
--
-- Yeni tanım zincirin UZUNLUĞUNA bakar: her zincir ters kaydı olmayan bir başlık
-- satırından (kind <> 'reversal') başlar; zincir tek uzunluktaysa (depth çift) başlık
-- satırı geçerlidir, çift uzunluktaysa (depth tek) zincir tümüyle düşer.
--
-- Getirdiği ve testle çivilenen değişmez (VERI-MODELI.md §6):
--   her öğrenci için SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus
--
-- Zincirler doğrusaldır: ux_ledger_reverses bir satırın en fazla bir kez ters
-- kaydedilmesini garanti eder (dallanma imkânsız), reverses_id var olan bir satırı
-- işaret etmek zorundadır (yabancı anahtar) ve trg_ledger_immutable her UPDATE'i
-- reddeder (K5) — dolayısıyla zincir daima geriye gider, döngü kurulamaz.
--
-- v_open_charge ve v_student_debt YENİDEN YAZILMAZ: SQLite view referanslarını sorgu
-- anında çözer, ikisi de bu tanımı kendiliğinden görür. 001_initial.sql'e de
-- dokunulmaz — checksum mührü tam bunun için var.
------------------------------------------------------------------------------

DROP VIEW v_ledger_effective;

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
