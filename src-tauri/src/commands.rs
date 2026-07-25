//! Frontend'e açılan komutlar.
//!
//! Bu katman **ince** olmak zorunda (ADR-002): argümanı alır, repository'yi çağırır,
//! sonucu döndürür. İş mantığı burada değil `repo` altında — orada in-memory SQLite ile
//! test edilebiliyor, burada edilemez.
//!
//! Faz 2'de yalnızca iskeletin çalıştığını gösteren komutlar var; modül komutları
//! kendi fazlarında eklenir.

use serde::Serialize;
use tauri::State;

use crate::error::AppResult;
use crate::model::{Setting, Student, StudentBalance, StudentDebt};
use crate::{db, repo, AppState};

/// Faz 2 durum ekranının verisi — veritabanı bağlantısının çalıştığının kanıtı.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub db_path: String,
    pub sqlite_version: String,
    pub journal_mode: String,
    pub foreign_keys: bool,
    pub applied_migrations: Vec<i64>,
    pub institution_name: String,
    pub teacher_name: String,
    pub student_count: i64,
    pub session_count: i64,
    pub ledger_count: i64,
}

#[tauri::command]
pub fn app_status(state: State<'_, AppState>) -> AppResult<AppStatus> {
    let db_path = state.db_path.display().to_string();
    let applied_migrations = state.applied_migrations.clone();

    state.with_conn(|conn| {
        Ok(AppStatus {
            db_path,
            sqlite_version: db::sqlite_version(conn)?,
            journal_mode: db::journal_mode(conn)?,
            foreign_keys: db::foreign_keys_enabled(conn)?,
            applied_migrations,
            institution_name: repo::setting::value_or(conn, "institution_name", "Kurs")?,
            teacher_name: teacher_name(conn)?,
            student_count: repo::count_live::<Student>(conn)?,
            session_count: repo::count_live::<crate::model::Session>(conn)?,
            ledger_count: repo::count_live::<crate::model::LedgerEntry>(conn)?,
        })
    })
}

#[tauri::command]
pub fn list_settings(state: State<'_, AppState>) -> AppResult<Vec<Setting>> {
    state.with_conn(repo::setting::list)
}

/// Sonuç **sırasızdır** — Türkçe sıralama `src/lib/sortTr.ts` içinde yapılır (ADR-020).
#[tauri::command]
pub fn list_students(state: State<'_, AppState>) -> AppResult<Vec<Student>> {
    state.with_conn(repo::list_live::<Student>)
}

#[tauri::command]
pub fn search_students(state: State<'_, AppState>, query: String) -> AppResult<Vec<Student>> {
    state.with_conn(|conn| repo::people::search_students(conn, &query))
}

#[tauri::command]
pub fn student_balance(
    state: State<'_, AppState>,
    student_id: i64,
) -> AppResult<Option<StudentBalance>> {
    state.with_conn(|conn| repo::views::student_balance(conn, student_id))
}

/// Borçlu listesi — tek kaynak defter (ADR-018).
#[tauri::command]
pub fn student_debts(state: State<'_, AppState>) -> AppResult<Vec<StudentDebt>> {
    state.with_conn(repo::views::student_debts)
}

fn teacher_name(conn: &rusqlite::Connection) -> AppResult<String> {
    Ok(conn
        .query_row(
            "SELECT full_name FROM teacher WHERE deleted_at IS NULL ORDER BY id LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "—".to_string()))
}
