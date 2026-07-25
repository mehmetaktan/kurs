//! View'lardan okuma (§1.23) — bakiye, borç, kalan ders hakkı, açık taksit.
//!
//! Bakiye SAKLANMAZ, defter toplamından hesaplanır (ADR-004).
//! Borçlu listesinin tek kaynağı `v_student_debt` zinciridir (ADR-018) —
//! `installment` tablosundan borç üretmek yasaktır: ders başı ödeyen öğrenci hiç
//! `installment` satırı üretmediği için o listede hiç görünmezdi.

use chrono::NaiveDate;
use rusqlite::Connection;

use crate::error::AppResult;
use crate::model::{InstallmentOpen, PackageRemaining, StudentBalance, StudentDebt};

/// Tek öğrencinin bakiyesi. **Negatif = borçlu** (K3).
/// Öğrenci arşivlenmiş olsa bile döner — borç arşivlemekle yok olmaz (§1.23).
pub fn student_balance(conn: &Connection, student_id: i64) -> AppResult<Option<StudentBalance>> {
    let mut stmt = conn.prepare(
        "SELECT student_id, is_live, balance_kurus FROM v_student_balance WHERE student_id = ?1",
    )?;
    let mut rows = stmt.query_map([student_id], balance_from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Bütün bakiyeler. Süzme kararı çağıranda: program ekranları `is_live` ister,
/// muhasebe listeleri istemez.
pub fn student_balances(conn: &Connection) -> AppResult<Vec<StudentBalance>> {
    let mut stmt =
        conn.prepare("SELECT student_id, is_live, balance_kurus FROM v_student_balance")?;
    let rows = stmt.query_map([], balance_from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Toplam alacak (kuruş): borçlu öğrencilerin borç toplamı.
/// Arşivlenmiş öğrenci **dahildir** — önceki sürüm onu düşürüyordu (§1.23).
pub fn total_receivable(conn: &Connection) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(debt_kurus), 0) FROM v_student_debt WHERE debt_kurus > 0",
        [],
        |row| row.get(0),
    )?)
}

/// Borçlu listesi (ADR-018). Yalnızca gerçekten borcu olanlar.
pub fn student_debts(conn: &Connection) -> AppResult<Vec<StudentDebt>> {
    let mut stmt = conn.prepare(
        "SELECT student_id, debt_kurus, oldest_due_on FROM v_student_debt WHERE debt_kurus > 0",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(StudentDebt {
            student_id: row.get(0)?,
            debt_kurus: row.get(1)?,
            oldest_due_on: row.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn student_debt(conn: &Connection, student_id: i64) -> AppResult<Option<StudentDebt>> {
    let mut stmt = conn.prepare(
        "SELECT student_id, debt_kurus, oldest_due_on FROM v_student_debt \
         WHERE student_id = ?1 AND debt_kurus > 0",
    )?;
    let mut rows = stmt.query_map([student_id], |row| {
        Ok(StudentDebt {
            student_id: row.get(0)?,
            debt_kurus: row.get(1)?,
            oldest_due_on: row.get(2)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Öğrencinin defterinde hiç hareket var mı.
///
/// Para hesabı DEĞİL, bir varlık sorusu — ve tam da bu yüzden ham `ledger_entry`'ye
/// bakıyor. Bakiye kartının altyazısı "henüz hareket yok" ile "borcu kapalı"yı ayırmak
/// zorunda; ikisi de bakiyeyi `0` gösteriyor, dolayısıyla ayrımı tutar veremez.
///
/// Ters kaydı olan satırlar da sayılır: bakiyeye etkileri sıfırlanmış olsa bile
/// defterde duruyorlar ve cari ekstrede (Faz 8) görünecekler.
pub fn has_ledger_entries(conn: &Connection, student_id: i64) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS( SELECT 1 FROM ledger_entry \
                        WHERE student_id = ?1 AND deleted_at IS NULL )",
        [student_id],
        |row| row.get(0),
    )?)
}

/// Gecikme gün sayısı. Saf tarih farkı — `julianday('now')` KULLANILMAZ (§0).
/// `today` parametredir; testler CI makinesinin saat dilimine bağlı olmaz.
pub fn days_overdue(today: NaiveDate, oldest_due_on: Option<&str>) -> Option<i64> {
    let due = NaiveDate::parse_from_str(oldest_due_on?, "%Y-%m-%d").ok()?;
    let days = (today - due).num_days();
    if days > 0 {
        Some(days)
    } else {
        None
    }
}

/// Kalan ders hakkı. `package.status`'e GÜVENMEZ — 'exhausted'/'expired' yalnızca
/// rapor etiketidir, hiçbir hesap onlara dayanmaz (§1.23).
pub fn package_remaining(
    conn: &Connection,
    package_id: i64,
) -> AppResult<Option<PackageRemaining>> {
    let mut stmt = conn.prepare(
        "SELECT package_id, student_id, valid_until, status, remaining \
         FROM v_package_remaining WHERE package_id = ?1",
    )?;
    let mut rows = stmt.query_map([package_id], remaining_from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Bir öğrencinin **aktif** paketleri. "Aktif paket" bir sorgudur, bir sütun değildir:
/// `remaining > 0 AND (valid_until IS NULL OR valid_until >= :today)`.
/// En eski satış önce — tükenmeye yakın paket önce kullanılır.
pub fn active_packages(
    conn: &Connection,
    student_id: i64,
    today: &str,
) -> AppResult<Vec<PackageRemaining>> {
    let mut stmt = conn.prepare(
        "SELECT r.package_id, r.student_id, r.valid_until, r.status, r.remaining \
         FROM v_package_remaining r \
         JOIN package p ON p.id = r.package_id \
         WHERE r.student_id = ?1 \
           AND r.remaining > 0 \
           AND (r.valid_until IS NULL OR r.valid_until >= ?2) \
         ORDER BY p.sold_on, p.id",
    )?;
    let rows = stmt.query_map(rusqlite::params![student_id, today], remaining_from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Açık taksitler. Vade filtresi yok — "bugün" çağıranda süzülür (ADR-018).
pub fn open_installments(conn: &Connection, student_id: i64) -> AppResult<Vec<InstallmentOpen>> {
    let mut stmt = conn.prepare(
        "SELECT id, student_id, package_id, seq, due_on, label, open_kurus \
         FROM v_installment_open WHERE student_id = ?1 ORDER BY due_on, seq",
    )?;
    let rows = stmt.query_map([student_id], |row| {
        Ok(InstallmentOpen {
            id: row.get(0)?,
            student_id: row.get(1)?,
            package_id: row.get(2)?,
            seq: row.get(3)?,
            due_on: row.get(4)?,
            label: row.get(5)?,
            open_kurus: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn balance_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StudentBalance> {
    Ok(StudentBalance {
        student_id: row.get(0)?,
        is_live: row.get(1)?,
        balance_kurus: row.get(2)?,
    })
}

fn remaining_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PackageRemaining> {
    Ok(PackageRemaining {
        package_id: row.get(0)?,
        student_id: row.get(1)?,
        valid_until: row.get(2)?,
        status: row.get(3)?,
        remaining: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gecikme_gun_sayisi_saf_tarih_farki() {
        let today = NaiveDate::from_ymd_opt(2026, 3, 20).unwrap();
        assert_eq!(days_overdue(today, Some("2026-03-08")), Some(12));
        // Vadesi bugün ya da gelecekte olan borç "gecikmiş" değil.
        assert_eq!(days_overdue(today, Some("2026-03-20")), None);
        assert_eq!(days_overdue(today, Some("2026-04-01")), None);
        assert_eq!(days_overdue(today, None), None);
        assert_eq!(days_overdue(today, Some("bozuk")), None);
    }
}
