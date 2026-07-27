//! ADR-019 — WAL veritabanının güvenli yedeği.
//!
//! Ana `.db` dosyası hiçbir zaman kopyalanmaz. Yedek yalnızca SQLite'ın
//! `VACUUM INTO` komutuyla üretilir ve ayrı bir bağlantıda çalıştığı için arayüzün
//! paylaştığı bağlantı kilidini tutmaz.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};

use crate::error::{AppError, AppResult};
use crate::model::BackupLog;
use crate::{db, repo};

const BACKUP_DIRECTORY_NAME: &str = "Kurs Takip";
const BACKUP_SUBDIRECTORY_NAME: &str = "Yedekler";
const BACKUP_FILE_PREFIX: &str = "kurs-yedek-";
const BACKUP_FILE_SUFFIX: &str = ".db";
const BACKUP_RETENTION: usize = 30;

const EXPECTED_TABLES: &[&str] = &[
    "schema_migration",
    "student",
    "session",
    "ledger_entry",
    "backup_log",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct CriticalCounts {
    students: i64,
    ledger_entries: i64,
}

/// Tauri'nin verdiği Belgeler yolundan kullanıcıya görünür yedek klasörünü kurar.
pub fn default_backup_dir(documents_dir: &Path) -> PathBuf {
    documents_dir
        .join(BACKUP_DIRECTORY_NAME)
        .join(BACKUP_SUBDIRECTORY_NAME)
}

/// Açılışta arka plan iş parçacığından çağrılır. Aynı yerel günde başarılı bir
/// otomatik yedek varsa ikinci dosya üretmez.
pub fn run_automatic(db_path: &Path, backup_dir: &Path, now: &str) -> AppResult<Option<PathBuf>> {
    let conn = db::open(db_path)?;
    let day = local_day(now)?;
    if repo::ops::has_successful_backup_on(&conn, day)? {
        return Ok(None);
    }
    let target = backup_dir.join(format!("{BACKUP_FILE_PREFIX}{day}{BACKUP_FILE_SUFFIX}"));
    attempt_backup(&conn, backup_dir, &target, now, true, true).map(Some)
}

pub fn run_manual(db_path: &Path, backup_dir: &Path, now: &str) -> AppResult<PathBuf> {
    let conn = db::open(db_path)?;
    fs::create_dir_all(backup_dir).map_err(backup_directory_error)?;
    let stamp = file_stamp(now)?;
    let target = unique_target(
        backup_dir,
        &format!("{BACKUP_FILE_PREFIX}{stamp}"),
        BACKUP_FILE_SUFFIX,
    );
    attempt_backup(&conn, backup_dir, &target, now, false, false)
}

/// Geri yüklemeden hemen önce, hâlâ açık olan canlı bağlantıdan kurtarma noktası.
pub fn create_pre_restore_backup(
    conn: &Connection,
    backup_dir: &Path,
    now: &str,
) -> AppResult<PathBuf> {
    fs::create_dir_all(backup_dir).map_err(backup_directory_error)?;
    let target = unique_target(
        backup_dir,
        &format!("kurs-geri-yukleme-oncesi-{}", file_stamp(now)?),
        BACKUP_FILE_SUFFIX,
    );
    attempt_backup(conn, backup_dir, &target, now, true, false)
}

/// Belgeler yolu çözülemezse deneme yine `backup_log`'a başarısız olarak yazılır.
pub fn record_directory_failure(db_path: &Path, now: &str, error: &AppError) -> AppResult<()> {
    let conn = db::open(db_path)?;
    record_log(
        &conn,
        now,
        "",
        None,
        true,
        false,
        Some(error.message.clone()),
    )?;
    Ok(())
}

fn create_backup(
    conn: &Connection,
    backup_dir: &Path,
    target: &Path,
    now: &str,
    is_auto: bool,
    replace_existing: bool,
) -> AppResult<PathBuf> {
    fs::create_dir_all(backup_dir).map_err(backup_directory_error)?;
    let target_text = target.to_str().ok_or_else(|| {
        AppError::new(
            "backup.path",
            "Yedek klasörünün adı okunamadı. Klasörü Belgeler altında yeniden seçin.",
        )
    })?;

    // Önceki yarım kalmış aynı-gün dosyası `VACUUM INTO`'yu engellemesin.
    if replace_existing && target.exists() {
        fs::remove_file(target).map_err(|err| {
            eprintln!("[kurs] yarım kalmış yedek kaldırılamadı: {err}");
            AppError::new(
                "backup.replace",
                "Aynı güne ait eski yedek yenilenemedi. Dosyayı başka bir programa açık bırakmadığınızdan emin olun.",
            )
        })?;
    }

    let before = critical_counts(conn)?;
    let result = (|| {
        conn.execute("VACUUM INTO ?1", [target_text])?;
        let after = critical_counts(conn)?;
        validate_backup(target, before, after)?;
        let size = file_size_i64(target)?;
        record_log(conn, now, target_text, Some(size), is_auto, true, None)?;
        repo::setting::set(conn, "last_backup_at", now)?;
        prune_old_backups(conn, backup_dir, now)?;
        Ok(target.to_path_buf())
    })();

    if result.is_err() && target.exists() {
        let _ = fs::remove_file(target);
    }
    result
}

fn attempt_backup(
    conn: &Connection,
    backup_dir: &Path,
    target: &Path,
    now: &str,
    is_auto: bool,
    replace_existing: bool,
) -> AppResult<PathBuf> {
    match create_backup(conn, backup_dir, target, now, is_auto, replace_existing) {
        Ok(path) => Ok(path),
        Err(error) => {
            let size = target
                .metadata()
                .ok()
                .and_then(|metadata| i64::try_from(metadata.len()).ok());
            let _ = record_log(
                conn,
                now,
                &target.to_string_lossy(),
                size,
                is_auto,
                false,
                Some(error.message.clone()),
            );
            Err(error)
        }
    }
}

fn validate_backup(path: &Path, before: CriticalCounts, after: CriticalCounts) -> AppResult<()> {
    let backup = open_and_validate_schema(path)?;

    let copied = critical_counts(&backup)?;
    // Fiziksel öğrenci ve defter satırları hard-delete edilmez. Yedek sürerken yeni
    // kayıt gelirse sayı, işlem öncesi ve sonrası canlı değerlerin arasında kalabilir.
    if !count_in_window(copied.students, before.students, after.students)
        || !count_in_window(
            copied.ledger_entries,
            before.ledger_entries,
            after.ledger_entries,
        )
    {
        return Err(AppError::new(
            "backup.row_count",
            "Yedekteki öğrenci veya hesap hareketi sayısı doğrulanamadı. Programı kapatmadan yeniden yedek alın.",
        ));
    }
    Ok(())
}

/// Geri yükleme adayı canlı veritabanından eski olabilir; bu yüzden satır sayısı
/// eşitliği aranmaz. Şema, migration zinciri, bütünlük ve kritik tablolar okunur.
pub fn validate_restore_candidate(path: &Path) -> AppResult<()> {
    let backup = open_and_validate_schema(path)?;
    let integrity: String = backup
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|err| backup_invalid("Yedek bütünlüğü okunamadı.", err))?;
    if integrity != "ok" {
        return Err(AppError::new(
            "backup.integrity",
            "Seçilen yedek hasarlı. Başka bir yedek seçin.",
        ));
    }
    let migration_count: i64 = backup
        .query_row("SELECT COUNT(*) FROM schema_migration", [], |row| {
            row.get(0)
        })
        .map_err(|err| backup_invalid("Yedek sürümü okunamadı.", err))?;
    if migration_count != i64::try_from(db::migrate::MIGRATIONS.len()).unwrap_or(i64::MAX) {
        return Err(AppError::new(
            "backup.version",
            "Seçilen yedek bu program sürümüyle uyumlu değil. Aynı programdan alınmış başka bir yedek seçin.",
        ));
    }
    let _ = critical_counts(&backup)?;
    Ok(())
}

pub fn copy_to_directory(source: &Path, destination_dir: &Path) -> AppResult<PathBuf> {
    if !source.is_file() {
        return Err(AppError::new(
            "backup.copy_source",
            "Kopyalanacak yedek bulunamadı. Listeden başka bir yedek seçin.",
        ));
    }
    fs::create_dir_all(destination_dir).map_err(|err| {
        eprintln!("[kurs] yedek hedef klasörü oluşturulamadı: {err}");
        AppError::new(
            "backup.copy_directory",
            "Seçilen klasöre erişilemedi. USB belleğin bağlı olduğunu ve klasör iznini kontrol edin.",
        )
    })?;
    let file_name = source
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            AppError::new(
                "backup.copy_name",
                "Yedek dosyasının adı okunamadı. Listeden başka bir yedek seçin.",
            )
        })?;
    let suffix = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("db");
    let dotted_suffix = format!(".{suffix}");
    let target = unique_target(destination_dir, file_name, &dotted_suffix);
    fs::copy(source, &target).map_err(|err| {
        eprintln!("[kurs] yedek dış klasöre kopyalanamadı: {err}");
        AppError::new(
            "backup.copy",
            "Yedek seçilen klasöre kopyalanamadı. Disk alanını ve yazma iznini kontrol edin.",
        )
    })?;
    Ok(target)
}

pub fn register_existing_success(
    conn: &Connection,
    path: &Path,
    now: &str,
    is_auto: bool,
) -> AppResult<()> {
    let path_text = path.to_str().ok_or_else(|| {
        AppError::new(
            "backup.path",
            "Kurtarma yedeğinin yolu okunamadı. Yedek klasörünü açıp dosyanın adını kontrol edin.",
        )
    })?;
    record_log(
        conn,
        now,
        path_text,
        Some(file_size_i64(path)?),
        is_auto,
        true,
        None,
    )?;
    repo::setting::set(conn, "last_backup_at", now)
}

pub(crate) fn remove_sqlite_sidecars(db_path: &Path) -> AppResult<()> {
    for suffix in ["-wal", "-shm"] {
        let path = sidecar_path(db_path, suffix);
        if path.exists() {
            fs::remove_file(&path).map_err(|err| {
                eprintln!("[kurs] SQLite yan dosyası kaldırılamadı ({}): {err}", path.display());
                AppError::new(
                    "backup.restore_sidecar",
                    "Eski veritabanı yan dosyaları temizlenemedi. Programı kapatıp yeniden deneyin.",
                )
            })?;
        }
    }
    Ok(())
}

fn sidecar_path(db_path: &Path, suffix: &str) -> PathBuf {
    let mut name = db_path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

fn open_and_validate_schema(path: &Path) -> AppResult<Connection> {
    let backup = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|err| backup_invalid("Yedek dosyası yeniden açılamadı.", err))?;

    for table in EXPECTED_TABLES {
        let exists: bool = backup
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?1)",
                [table],
                |row| row.get(0),
            )
            .map_err(|err| backup_invalid("Yedek tablosu doğrulanamadı.", err))?;
        if !exists {
            return Err(AppError::new(
                "backup.missing_table",
                "Yedek eksik oluşturuldu. Başka bir yedek seçin veya yeniden yedek alın.",
            ));
        }
    }
    Ok(backup)
}

fn critical_counts(conn: &Connection) -> AppResult<CriticalCounts> {
    conn.query_row(
        "SELECT (SELECT COUNT(*) FROM student), (SELECT COUNT(*) FROM ledger_entry)",
        [],
        |row| {
            Ok(CriticalCounts {
                students: row.get(0)?,
                ledger_entries: row.get(1)?,
            })
        },
    )
    .map_err(Into::into)
}

fn count_in_window(value: i64, first: i64, second: i64) -> bool {
    value >= first.min(second) && value <= first.max(second)
}

fn prune_old_backups(conn: &Connection, backup_dir: &Path, now: &str) -> AppResult<()> {
    let mut backups = fs::read_dir(backup_dir)
        .map_err(|err| backup_io("Yedek klasörü okunamadı.", err))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with(BACKUP_FILE_PREFIX) && name.ends_with(BACKUP_FILE_SUFFIX)
                })
        })
        .collect::<Vec<_>>();
    backups.sort();

    let remove_count = backups.len().saturating_sub(BACKUP_RETENTION);
    for path in backups.into_iter().take(remove_count) {
        fs::remove_file(&path).map_err(|err| {
            backup_io(
                "Eski yedek silinemedi. Dosyanın başka bir programda açık olmadığını kontrol edin.",
                err,
            )
        })?;
        if let Some(text) = path.to_str() {
            repo::ops::mark_backup_pruned(conn, text, now)?;
        }
    }
    Ok(())
}

fn record_log(
    conn: &Connection,
    taken_at: &str,
    file_path: &str,
    size_bytes: Option<i64>,
    is_auto: bool,
    ok: bool,
    error: Option<String>,
) -> AppResult<i64> {
    repo::ops::insert_backup_log(
        conn,
        &BackupLog {
            id: None,
            taken_at: taken_at.into(),
            file_path: file_path.into(),
            size_bytes,
            is_auto,
            ok,
            error,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
}

fn local_day(now: &str) -> AppResult<&str> {
    let day = now.get(..10).ok_or_else(|| {
        AppError::new(
            "backup.date",
            "Yedek tarihi okunamadı. Programı kapatıp yeniden açın.",
        )
    })?;
    chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d").map_err(|_| {
        AppError::new(
            "backup.date",
            "Yedek tarihi okunamadı. Programı kapatıp yeniden açın.",
        )
    })?;
    Ok(day)
}

fn file_stamp(now: &str) -> AppResult<String> {
    local_day(now)?;
    let time = now.get(11..16).ok_or_else(|| {
        AppError::new(
            "backup.date",
            "Yedek saati okunamadı. Programı kapatıp yeniden açın.",
        )
    })?;
    if !time.chars().enumerate().all(|(index, ch)| {
        if index == 2 {
            ch == ':'
        } else {
            ch.is_ascii_digit()
        }
    }) {
        return Err(AppError::new(
            "backup.date",
            "Yedek saati okunamadı. Programı kapatıp yeniden açın.",
        ));
    }
    Ok(format!("{}-{}", &now[..10], time.replace(':', "")))
}

fn unique_target(directory: &Path, stem: &str, suffix: &str) -> PathBuf {
    let first = directory.join(format!("{stem}{suffix}"));
    if !first.exists() {
        return first;
    }
    for number in 2..=10_000 {
        let candidate = directory.join(format!("{stem}-{number}{suffix}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    directory.join(format!("{stem}-son{suffix}"))
}

fn file_size_i64(path: &Path) -> AppResult<i64> {
    let bytes = path
        .metadata()
        .map_err(|err| backup_io("Yedek dosyasının boyutu okunamadı.", err))?
        .len();
    i64::try_from(bytes).map_err(|_| {
        AppError::new(
            "backup.size",
            "Yedek dosyası beklenenden büyük. Disk alanını kontrol edin.",
        )
    })
}

fn backup_invalid(context: &str, detail: impl std::fmt::Display) -> AppError {
    eprintln!("[kurs] {context} {detail}");
    AppError::new(
        "backup.invalid",
        "Yedek doğrulanamadı. Disk alanını kontrol edip yeniden deneyin.",
    )
}

fn backup_io(message: &str, detail: impl std::fmt::Display) -> AppError {
    eprintln!("[kurs] yedek dosya hatası: {detail}");
    AppError::new("backup.io", message)
}

fn backup_directory_error(err: std::io::Error) -> AppError {
    eprintln!("[kurs] yedek klasörü oluşturulamadı: {err}");
    AppError::new(
        "backup.directory",
        "Yedek klasörü oluşturulamadı. Belgeler klasörünün yazma iznini ve disk alanını kontrol edin.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yedek_yolu_path_join_ile_belgeler_altinda_kurulur() {
        let path = default_backup_dir(Path::new("Belgeler"));
        assert_eq!(
            path,
            Path::new("Belgeler").join("Kurs Takip").join("Yedekler")
        );
    }

    #[test]
    fn wal_ve_shm_yollari_string_birlestirmeden_kurulur() {
        let db_path = Path::new("veri").join("kurs.db");
        assert_eq!(
            sidecar_path(&db_path, "-wal"),
            Path::new("veri").join("kurs.db-wal")
        );
        assert_eq!(
            sidecar_path(&db_path, "-shm"),
            Path::new("veri").join("kurs.db-shm")
        );
    }

    #[test]
    fn eszamanli_ekleme_sayisi_dogrulama_araliginda_kalabilir() {
        assert!(count_in_window(4, 4, 4));
        assert!(count_in_window(5, 4, 6));
        assert!(!count_in_window(3, 4, 6));
        assert!(!count_in_window(7, 4, 6));
    }

    #[test]
    fn saklama_politikasi_en_yeni_otuz_dosyayi_birakir() {
        let unique = format!(
            "kurs-backup-retention-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let directory = std::env::temp_dir().join(unique);
        fs::create_dir_all(&directory).unwrap();
        for day in 1..=31 {
            fs::write(
                directory.join(format!("kurs-yedek-2026-07-{day:02}.db")),
                b"test",
            )
            .unwrap();
        }
        fs::write(directory.join("baska-dosya.txt"), b"kalir").unwrap();
        let conn = db::open_in_memory_migrated().unwrap();

        prune_old_backups(&conn, &directory, "2026-07-31 09:00").unwrap();

        let backup_count = fs::read_dir(&directory)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.ends_with(".db"))
            })
            .count();
        assert_eq!(backup_count, 30);
        assert!(!directory.join("kurs-yedek-2026-07-01.db").exists());
        assert!(directory.join("kurs-yedek-2026-07-31.db").exists());
        assert!(directory.join("baska-dosya.txt").exists());

        let _ = fs::remove_dir_all(directory);
    }
}
