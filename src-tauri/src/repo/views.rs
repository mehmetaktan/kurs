//! View'lardan okuma (§1.23) — bakiye, borç, kalan ders hakkı, açık taksit.
//!
//! Bakiye SAKLANMAZ, defter toplamından hesaplanır (ADR-004).
//! Borçlu listesinin tek kaynağı `v_student_debt` zinciridir (ADR-018) —
//! `installment` tablosundan borç üretmek yasaktır: ders başı ödeyen öğrenci hiç
//! `installment` satırı üretmediği için o listede hiç görünmezdi.

use chrono::NaiveDate;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtQuery {
    pub search: Option<String>,
    pub filter: String,
    pub today: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtorRow {
    pub student_id: i64,
    pub full_name: String,
    pub guardian_phone: Option<String>,
    pub archived: bool,
    pub debt_kurus: i64,
    pub advance_kurus: i64,
    pub oldest_due_on: Option<String>,
    pub days_overdue: Option<i64>,
}

/// E14 birleşik satırı. Borç tutarı yalnızca `v_student_debt`'ten gelir (ADR-018);
/// `v_installment_open` sadece "bu ay" filtresinin üyeliğini belirler.
pub fn debtor_rows(conn: &Connection, query: &DebtQuery) -> AppResult<Vec<DebtorRow>> {
    let today = NaiveDate::parse_from_str(&query.today, "%Y-%m-%d").map_err(|_| {
        AppError::new(
            "debt.today",
            "Borçlu listesi tarihi okunamadı. Ekranı yenileyip yeniden deneyin.",
        )
    })?;
    if !matches!(
        query.filter.as_str(),
        "all" | "overdue" | "due_this_month" | "advance"
    ) {
        return Err(AppError::new(
            "debt.filter",
            "Borç filtresi tanınmadı. Filtreyi temizleyip yeniden deneyin.",
        ));
    }
    let raw_search = query.search.as_deref().unwrap_or("").trim();
    let search_name = crate::text::search_name(raw_search);
    let phone_digits = crate::text::phone_digits(raw_search);
    let mut stmt = conn.prepare(
        "SELECT s.id, s.full_name, \
                (SELECT g.phone FROM student_guardian sg \
                 JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
                 WHERE sg.student_id = s.id AND sg.deleted_at IS NULL \
                 ORDER BY sg.is_primary DESC, sg.id LIMIT 1), \
                s.deleted_at IS NOT NULL, COALESCE(d.debt_kurus, 0), \
                MAX(COALESCE(b.balance_kurus, 0), 0), d.oldest_due_on, \
                COALESCE((SELECT GROUP_CONCAT(g.full_name, ' ') FROM student_guardian sg \
                  JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
                  WHERE sg.student_id = s.id AND sg.deleted_at IS NULL), ''), \
                COALESCE((SELECT GROUP_CONCAT(g.phone_digits, ' ') FROM student_guardian sg \
                  JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
                  WHERE sg.student_id = s.id AND sg.deleted_at IS NULL), '') \
         FROM student s \
         LEFT JOIN v_student_debt d ON d.student_id = s.id \
         LEFT JOIN v_student_balance b ON b.student_id = s.id \
         WHERE ( \
           (?1 = 'all' AND COALESCE(d.debt_kurus, 0) > 0) OR \
           (?1 = 'overdue' AND COALESCE(d.debt_kurus, 0) > 0 AND d.oldest_due_on < ?2) OR \
           (?1 = 'due_this_month' AND COALESCE(d.debt_kurus, 0) > 0 AND EXISTS ( \
             SELECT 1 FROM v_installment_open io \
             WHERE io.student_id = s.id AND substr(io.due_on, 1, 7) = substr(?2, 1, 7) \
           )) OR \
           (?1 = 'advance' AND COALESCE(b.balance_kurus, 0) > 0) \
         )",
    )?;
    let rows = stmt.query_map(params![query.filter, query.today], |row| {
        let oldest_due_on: Option<String> = row.get(6)?;
        Ok((
            DebtorRow {
                student_id: row.get(0)?,
                full_name: row.get(1)?,
                guardian_phone: row.get(2)?,
                archived: row.get(3)?,
                debt_kurus: row.get(4)?,
                advance_kurus: row.get(5)?,
                days_overdue: days_overdue(today, oldest_due_on.as_deref()),
                oldest_due_on,
            },
            row.get::<_, String>(7)?,
            row.get::<_, String>(8)?,
        ))
    })?;
    let mut out = Vec::new();
    for row in rows {
        let (item, guardian_names, guardian_phones) = row?;
        if raw_search.is_empty()
            || crate::text::search_name(&item.full_name).contains(&search_name)
            || crate::text::search_name(&guardian_names).contains(&search_name)
            || (!phone_digits.is_empty() && guardian_phones.contains(&phone_digits))
        {
            out.push(item);
        }
    }
    Ok(out)
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
/// `sold_on <= :today AND remaining > 0 AND (valid_until IS NULL OR valid_until >= :today)`.
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
           AND p.sold_on <= ?2 \
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
