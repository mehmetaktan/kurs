mod common;

use std::path::{Path, PathBuf};

use kurs_takip_lib::{backup, db, repo, AppState};
use rusqlite::Connection;

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new(label: &str) -> Self {
        let unique = format!(
            "kurs-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("sistem saati")
                .as_nanos()
        );
        let path = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(&path).expect("test klasörü oluşturulmalı");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn vacuum_into_wal_verisini_alir_dogrular_loglar_ve_gunde_bir_kez_calisir() {
    let root = TestDirectory::new("backup");
    let db_path = root.path().join("canli").join("kurs.db");
    let backup_dir = root
        .path()
        .join("Belgeler")
        .join("Kurs Takip")
        .join("Yedekler");
    let live = db::open(&db_path).unwrap();
    db::migrate::run(&live).unwrap();
    let student_id = common::student(&live, "İpek Şahin");
    common::ledger(&live, student_id, "2026-07-27", "adjustment", -125_000);

    let path = backup::run_automatic(&db_path, &backup_dir, "2026-07-27 08:14")
        .unwrap()
        .expect("ilk açılış yedek almalı");
    assert_eq!(path.file_name().unwrap(), "kurs-yedek-2026-07-27.db");
    assert!(path.starts_with(&backup_dir));

    let copied = Connection::open(&path).unwrap();
    let counts: (i64, i64) = copied
        .query_row(
            "SELECT (SELECT COUNT(*) FROM student), \
                    (SELECT COUNT(*) FROM ledger_entry)",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(counts, (1, 1), "WAL'daki canlı veri yedeğe girmeli");

    let log = repo::ops::last_successful_backup(&live)
        .unwrap()
        .expect("başarı loglanmalı");
    assert_eq!(log.file_path, path.to_string_lossy());
    assert!(log.is_auto);
    assert!(log.ok);
    assert!(log.size_bytes.is_some_and(|size| size > 0));
    assert_eq!(
        repo::setting::value(&live, "last_backup_at").unwrap(),
        Some("2026-07-27 08:14".into())
    );

    let second = backup::run_automatic(&db_path, &backup_dir, "2026-07-27 18:30").unwrap();
    assert_eq!(second, None, "aynı yerel günde ikinci dosya oluşmamalı");
    let log_count: i64 = live
        .query_row(
            "SELECT COUNT(*) FROM backup_log WHERE ok = 1 AND deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(log_count, 1);
}

#[test]
fn yazilamayan_yedek_turkce_eylemle_hata_verir_ve_basarisizligi_loglar() {
    let root = TestDirectory::new("backup-failure");
    let db_path = root.path().join("canli").join("kurs.db");
    let live = db::open(&db_path).unwrap();
    db::migrate::run(&live).unwrap();
    let blocked = root.path().join("klasor-degil");
    std::fs::write(&blocked, b"dosya").unwrap();

    let error = backup::run_automatic(&db_path, &blocked, "2026-07-27 09:00").unwrap_err();
    assert_eq!(error.code, "backup.directory");
    assert!(error.message.contains("kontrol edin"));

    let failed: (i64, String) = live
        .query_row(
            "SELECT COUNT(*), MAX(error) FROM backup_log WHERE ok = 0",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(failed.0, 1);
    assert!(failed.1.contains("kontrol edin"));
}

#[test]
fn silinmis_yedek_klasoru_yeniden_olusturulur() {
    let root = TestDirectory::new("backup-deleted-directory");
    let db_path = root.path().join("canli").join("kurs.db");
    let backup_dir = root
        .path()
        .join("Belgeler")
        .join("Kurs Takip")
        .join("Yedekler");
    let live = db::open(&db_path).unwrap();
    db::migrate::run(&live).unwrap();
    common::student(&live, "Ayşe Işık");
    std::fs::create_dir_all(&backup_dir).unwrap();
    std::fs::remove_dir_all(&backup_dir).unwrap();

    let backup = backup::run_manual(&db_path, &backup_dir, "2026-07-27 09:15").unwrap();

    assert!(backup.is_file());
    assert!(backup.starts_with(&backup_dir));
}

#[test]
fn geri_yukleme_eski_wal_verisini_temizler_ve_once_canliyi_vacuum_ile_yedekler() {
    let root = TestDirectory::new("restore");
    let db_path = root.path().join("canli").join("kurs.db");
    let backup_dir = root
        .path()
        .join("Belgeler")
        .join("Kurs Takip")
        .join("Yedekler");
    {
        let live = db::open(&db_path).unwrap();
        db::migrate::run(&live).unwrap();
        common::student(&live, "Yedekteki Öğrenci");
    }
    let source = backup::run_manual(&db_path, &backup_dir, "2026-07-26 08:00").unwrap();
    let state = AppState::open(db_path.clone(), Ok(backup_dir.clone()));
    state
        .with_conn(|conn| {
            common::student(conn, "Sonradan Eklenen");
            Ok(())
        })
        .unwrap();

    let safety = state
        .restore_from_backup(&source, "2026-07-27 10:30")
        .unwrap();

    let names = state
        .with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT full_name FROM student")?;
            let rows = stmt
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })
        .unwrap();
    assert_eq!(names, vec!["Yedekteki Öğrenci"]);
    assert!(safety
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("kurs-geri-yukleme-oncesi-"));
    let safety_db = Connection::open(&safety).unwrap();
    let safety_count: i64 = safety_db
        .query_row("SELECT COUNT(*) FROM student", [], |row| row.get(0))
        .unwrap();
    assert_eq!(
        safety_count, 2,
        "geri yükleme öncesi canlı veri kurtarılabilmeli"
    );
    let safety_logged = state
        .with_conn(|conn| repo::ops::is_successful_backup_path(conn, &safety.to_string_lossy()))
        .unwrap();
    assert!(safety_logged);
}

#[test]
fn eksik_tablolu_dosya_geri_yukleme_adayi_olamaz() {
    let root = TestDirectory::new("invalid-restore");
    let invalid = root.path().join("bos.db");
    Connection::open(&invalid).unwrap();

    let error = backup::validate_restore_candidate(&invalid).unwrap_err();
    assert_eq!(error.code, "backup.missing_table");
    assert!(error.message.contains("Başka bir yedek seçin"));
}

#[test]
fn dogrulanmis_yedek_dis_klasore_ayni_adi_ezmeden_kopyalanir() {
    let root = TestDirectory::new("copy-backup");
    let source = root.path().join("kurs-yedek-2026-07-27.db");
    let destination = root.path().join("USB");
    std::fs::write(&source, b"yedek").unwrap();
    std::fs::create_dir_all(&destination).unwrap();
    std::fs::write(destination.join("kurs-yedek-2026-07-27.db"), b"eski").unwrap();

    let copied = backup::copy_to_directory(&source, &destination).unwrap();
    assert_eq!(copied.file_name().unwrap(), "kurs-yedek-2026-07-27-2.db");
    assert_eq!(std::fs::read(copied).unwrap(), b"yedek");
}
