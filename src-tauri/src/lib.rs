//! Kurs Takip — uygulama çekirdeği.
//!
//! Katmanlar (ADR-002):
//!   arayüz → `#[tauri::command]` (ince) → `repo` (iş mantığı) → SQLite
//!
//! Frontend SQL yazmaz. Para mantığı Rust'ta, saf ve test edilebilir fonksiyonlarda.

pub mod brand;
pub mod clock;
pub mod commands;
pub mod db;
pub mod error;
pub mod model;
pub mod money;
pub mod repo;
pub mod text;

#[cfg(feature = "seed")]
pub mod seed;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

use crate::error::{AppError, AppResult};

/// Uygulamanın paylaşılan durumu.
///
/// Bağlantı `Mutex` içinde: tek kullanıcı, tek makine — havuz gereksiz karmaşıklık olurdu.
/// Açılış başarısızsa bağlantı yerine **hata saklanır**; pencere yine açılır ve kullanıcı
/// ham çökme yerine Türkçe bir mesaj görür (CLAUDE.md > Arayüz).
pub struct AppState {
    pub db_path: PathBuf,
    pub applied_migrations: Vec<i64>,
    db: Mutex<AppResult<Connection>>,
}

impl AppState {
    /// Veritabanını açar ve bekleyen migration'ları uygular.
    pub fn open(db_path: PathBuf) -> Self {
        let mut applied_migrations = Vec::new();

        let db = match db::open(&db_path) {
            Ok(conn) => match db::migrate::run(&conn) {
                Ok(report) => {
                    applied_migrations = report.all_applied;
                    log_startup(&conn, &db_path, &report.applied_now);
                    Ok(conn)
                }
                Err(err) => {
                    eprintln!("[kurs] migration başarısız: {err}");
                    Err(err)
                }
            },
            Err(err) => {
                eprintln!("[kurs] veritabanı açılamadı ({}): {err}", db_path.display());
                Err(err)
            }
        };

        Self {
            db_path,
            applied_migrations,
            db: Mutex::new(db),
        }
    }

    /// Açılış hiç denenemedi (ör. veri klasörü bulunamadı).
    pub fn failed(err: AppError) -> Self {
        Self {
            db_path: PathBuf::new(),
            applied_migrations: Vec::new(),
            db: Mutex::new(Err(err)),
        }
    }

    /// Bağlantıyı ödünç verir. Açılış başarısızsa saklanan hatayı döndürür.
    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let guard = self
            .db
            .lock()
            .map_err(|err| AppError::internal("db_mutex_poisoned", err))?;
        match &*guard {
            Ok(conn) => f(conn),
            Err(err) => Err(err.clone()),
        }
    }
}

/// SQLite sürümü açılışta loglanır — sürüm sorunu sessizce geçmesin (faz-02 §2).
fn log_startup(conn: &Connection, db_path: &Path, applied_now: &[i64]) {
    let version = db::sqlite_version(conn).unwrap_or_else(|_| "bilinmiyor".into());
    let journal = db::journal_mode(conn).unwrap_or_else(|_| "bilinmiyor".into());
    println!("[kurs] veritabanı  : {}", db_path.display());
    println!("[kurs] sqlite      : {version} (journal_mode={journal})");
    if applied_now.is_empty() {
        println!("[kurs] migration   : güncel");
    } else {
        println!("[kurs] migration   : uygulandı {applied_now:?}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Yol string birleştirmeyle kurulmaz → Tauri path API (CLAUDE.md > Windows).
            // Veritabanı app_data_dir altında (%APPDATA%), proje klasöründe değil (ADR-008).
            let state = match app.path().app_data_dir() {
                Ok(dir) => AppState::open(db::db_file_in(&dir)),
                Err(err) => AppState::failed(AppError::internal("app_data_dir", err)),
            };
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_status,
            commands::list_settings,
            commands::list_students,
            commands::search_students,
            commands::student_balance,
            commands::student_debts,
            // Faz 4 — öğrenci ve veli
            commands::student_list,
            commands::student_detail,
            commands::save_student,
            commands::archive_student,
            commands::restore_student,
            commands::set_student_active,
            commands::search_guardians,
            commands::add_student_note,
            commands::archive_student_note,
            commands::list_subjects,
            commands::list_study_groups,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması başlatılamadı");
}
