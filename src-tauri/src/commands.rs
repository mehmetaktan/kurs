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
use crate::model::{Guardian, Setting, Student, StudentBalance, StudentDebt, StudyGroup, Subject};
use crate::repo::roster::{StudentDetail, StudentInput, StudentQuery, StudentRow};
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
            // ADR-024: kurum adı `setting` tablosundan DEĞİL, derleme anında gömülen
            // `config/kurum.json`'dan geliyor. `setting.institution_name` satırı
            // migration mühürlü olduğu için duruyor ama okunmuyor.
            institution_name: crate::brand::institution_name().to_string(),
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

// ---------------------------------------------------------------------------
// Faz 4 — öğrenci ve veli
// ---------------------------------------------------------------------------

/// Öğrenciler ekranının tablosu. **Sırasız** döner (ADR-020): Türkçe sıralama ve
/// sayfalama `src/lib/sortTr.ts` + `usePagedRows` içinde, arayüz tarafında.
///
/// Arşivlenmiş öğrenciler de gelir, `archived` alanıyla işaretli — hangi çipin kimi
/// göstereceğine ekran karar veriyor (§1.23).
#[tauri::command]
pub fn student_list(state: State<'_, AppState>, query: StudentQuery) -> AppResult<Vec<StudentRow>> {
    state.with_conn(|conn| repo::roster::student_rows(conn, &query))
}

/// Öğrenci detayının tamamı tek çağrıda — dört ayrı komut dört ayrı yükleniyor/hata
/// durumu demekti ve ekranın hepsine aynı anda ihtiyacı var.
#[tauri::command]
pub fn student_detail(
    state: State<'_, AppState>,
    student_id: i64,
    today: Option<String>,
) -> AppResult<StudentDetail> {
    state.with_conn(|conn| repo::roster::student_detail(conn, student_id, today.clone()))
}

/// Öğrenci + velileri, tek transaction. `input.id` doluysa güncelleme.
#[tauri::command]
pub fn save_student(state: State<'_, AppState>, input: StudentInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::roster::save_student(conn, &input))
}

/// "Sil" değil **"Arşivle"** (ADR-005). Geçmiş kayıtlar bozulmaz.
#[tauri::command]
pub fn archive_student(state: State<'_, AppState>, student_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::archive_student(conn, student_id))
}

/// Arşivden geri alma — onay diyaloğunun ardından gelen "Geri al".
#[tauri::command]
pub fn restore_student(state: State<'_, AppState>, student_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::restore_student(conn, student_id))
}

/// Aktif / Pasif. Arşivleme DEĞİL — pasif öğrenci listede görünmeye devam eder (§1.5).
#[tauri::command]
pub fn set_student_active(
    state: State<'_, AppState>,
    student_id: i64,
    is_active: bool,
) -> AppResult<()> {
    state.with_conn(|conn| repo::roster::set_student_active(conn, student_id, is_active))
}

/// "Mevcut veliyi bul ve bağla" akışı — kardeşler aynı veliyi paylaşır (§1.7).
#[tauri::command]
pub fn search_guardians(state: State<'_, AppState>, query: String) -> AppResult<Vec<Guardian>> {
    state.with_conn(|conn| repo::roster::search_guardians(conn, &query))
}

/// Not ekler. `notedOn` verilmezse yerel bugün — SQLite saati okunmaz (§0).
#[tauri::command]
pub fn add_student_note(
    state: State<'_, AppState>,
    student_id: i64,
    body: String,
    noted_on: Option<String>,
) -> AppResult<i64> {
    state.with_conn(|conn| repo::roster::add_note(conn, student_id, &body, noted_on.clone()))
}

#[tauri::command]
pub fn archive_student_note(state: State<'_, AppState>, note_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::archive_note(conn, note_id))
}

/// Branş filtresinin kaynağı. Sırasız (ADR-020).
#[tauri::command]
pub fn list_subjects(state: State<'_, AppState>) -> AppResult<Vec<Subject>> {
    state.with_conn(repo::list_live::<Subject>)
}

/// Grup filtresinin kaynağı. Sırasız (ADR-020).
#[tauri::command]
pub fn list_study_groups(state: State<'_, AppState>) -> AppResult<Vec<StudyGroup>> {
    state.with_conn(repo::list_live::<StudyGroup>)
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
