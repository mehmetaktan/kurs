//! İşletim tarafı: **açılışta çalışan bakım işleri** ve `backup_log` (§1.22).
//!
//! Yedekleme durumu Faz 10'a ait bir detay değil, **Bugün ekranının verisi**:
//! *"Son yedekleme: Bugün 08:14 · otomatik"* ve gecikince turuncu *"3 gün önce · gecikti"*.
//! Yedek alma mekanizmasının kendisi (`VACUUM INTO`, ADR-019) Faz 10'da yazılır.

use chrono::NaiveDate;
use rusqlite::{params, Connection, Row};

use crate::clock;
use crate::error::AppResult;
use crate::model::BackupLog;
use crate::repo::{self, last_id, Record};

// ---------------------------------------------------------------------------
// Açılış bakımı
// ---------------------------------------------------------------------------

/// Uygulama her açılışta çağırır: zamanın geçmesiyle **kendiliğinden** doğması gereken
/// kayıtları yazar.
///
/// Eksik seanslar üretilir (§1.14), vadesi gelen taksitler deftere yansıtılır
/// (ADR-015). İki iş de idempotenttir.
///
/// **`today` parametredir** (§0 `'now'` kuralı): SQLite saati UTC döner ve gece
/// 00:00–03:00 arasında bir önceki günü verirdi. Çağıran `chrono::Local`'dan üretir.
///
pub fn on_startup(conn: &Connection, today: NaiveDate) -> AppResult<StartupReport> {
    let sessions = repo::schedule::generate_sessions(conn, today)?;
    let installments_accrued =
        repo::finance::accrue_due_installments(conn, &clock::date_string(today))?;
    Ok(StartupReport {
        sessions,
        installments_accrued,
    })
}

#[derive(Debug, Clone, Default)]
pub struct StartupReport {
    pub sessions: repo::schedule::GenerateReport,
    pub installments_accrued: i64,
}

impl Record for BackupLog {
    const TABLE: &'static str = "backup_log";
    const COLUMNS: &'static str = "id, taken_at, file_path, size_bytes, is_auto, ok, error, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(BackupLog {
            id: row.get(0)?,
            taken_at: row.get(1)?,
            file_path: row.get(2)?,
            size_bytes: row.get(3)?,
            is_auto: row.get(4)?,
            ok: row.get(5)?,
            error: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
            deleted_at: row.get(9)?,
        })
    }
}

pub fn insert_backup_log(conn: &Connection, b: &BackupLog) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO backup_log (id, taken_at, file_path, size_bytes, is_auto, ok, error) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            b.id,
            b.taken_at,
            b.file_path,
            b.size_bytes,
            b.is_auto,
            b.ok,
            b.error
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_backup_log(conn: &Connection, id: i64, b: &BackupLog) -> AppResult<()> {
    conn.execute(
        "UPDATE backup_log SET size_bytes = ?2, ok = ?3, error = ?4, updated_at = ?5 \
         WHERE id = ?1",
        params![id, b.size_bytes, b.ok, b.error, clock::now_local()],
    )?;
    Ok(())
}

/// En son **başarılı** yedek. Bugün ekranındaki yedekleme şeridi bunu okur.
pub fn last_successful_backup(conn: &Connection) -> AppResult<Option<BackupLog>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM backup_log \
         WHERE ok = 1 AND deleted_at IS NULL ORDER BY taken_at DESC LIMIT 1",
        cols = BackupLog::COLUMNS
    ))?;
    let mut rows = stmt.query_map([], BackupLog::from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn has_successful_backup_on(conn: &Connection, day: &str) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM backup_log \
         WHERE ok = 1 AND is_auto = 1 AND deleted_at IS NULL \
           AND substr(taken_at, 1, 10) = ?1)",
        [day],
        |row| row.get(0),
    )?)
}

/// Saklama politikası dosyayı kaldırdığında geçmiş satır hard-delete edilmez.
pub fn mark_backup_pruned(conn: &Connection, file_path: &str, now: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE backup_log SET deleted_at = ?2, updated_at = ?2 \
         WHERE file_path = ?1 AND deleted_at IS NULL",
        params![file_path, now],
    )?;
    Ok(())
}

pub fn recent_backup_logs(conn: &Connection) -> AppResult<Vec<BackupLog>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM backup_log \
         WHERE deleted_at IS NULL ORDER BY taken_at DESC, id DESC LIMIT 30",
        cols = BackupLog::COLUMNS
    ))?;
    let rows = stmt.query_map([], BackupLog::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn is_successful_backup_path(conn: &Connection, file_path: &str) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM backup_log \
         WHERE file_path = ?1 AND ok = 1 AND deleted_at IS NULL)",
        [file_path],
        |row| row.get(0),
    )?)
}
