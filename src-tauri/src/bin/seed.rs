//! `npm run seed` — geliştirme demo verisini yükler.
//!
//! `seed` özelliği kapalıyken bu binary hiç derlenmez (`required-features`), dolayısıyla
//! `tauri build` ile üretilen kurulum paketinde yoktur (faz-02 §6).
//!
//! Kullanım:
//!   npm run seed                  → uygulamanın gerçek veritabanına yükler
//!   npm run seed -- --reset       → veritabanını silip sıfırdan kurar
//!   npm run seed -- --db yol.db   → başka bir dosyaya yükler (testler, denemeler)

use std::path::PathBuf;
use std::process::ExitCode;

use kurs_takip_lib::{clock, db, seed};

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("\n  ✗ {message}\n");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let reset = args.iter().any(|a| a == "--reset");

    let db_path = match args.iter().position(|a| a == "--db") {
        Some(i) => PathBuf::from(args.get(i + 1).ok_or("--db için dosya yolu verilmedi")?),
        None => {
            let dir = db::app_data_dir_without_tauri().map_err(|e| e.message)?;
            db::db_file_in(&dir)
        }
    };

    if reset {
        for suffix in ["", "-wal", "-shm"] {
            // WAL yan dosyaları da silinmeli; bırakılırsa SQLite eski veriyi geri uygular
            // ve "sıfırdan kurdum" diyen kullanıcı eski kayıtları görür (ADR-019).
            let mut path = db_path.clone().into_os_string();
            path.push(suffix);
            let _ = std::fs::remove_file(PathBuf::from(path));
        }
        println!("  veritabanı sıfırlandı");
    }

    let conn = db::open(&db_path).map_err(|e| e.message)?;
    let report = db::migrate::run(&conn).map_err(|e| e.message)?;

    let existing: i64 = conn
        .query_row("SELECT COUNT(*) FROM student", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if existing > 0 {
        return Err(format!(
            "Veritabanında zaten {existing} öğrenci var; seed üzerine yazmaz.\n    \
             Sıfırdan kurmak için: npm run seed -- --reset"
        ));
    }

    let today = clock::today_local();
    let summary = seed::load(&conn, today).map_err(|e| e.message)?;

    println!("\n  ✓ Demo verisi yüklendi");
    println!("    dosya       : {}", db_path.display());
    println!("    migration   : {:?}", report.all_applied);
    println!("    öğrenci     : {}", summary.students);
    println!("    veli        : {}", summary.guardians);
    println!(
        "    branş/grup  : {} / {}",
        summary.subjects, summary.groups
    );
    println!("    seans       : {}", summary.sessions);
    println!("    yoklama     : {}", summary.attendances);
    println!("    paket       : {}", summary.packages);
    println!("    tahsilat    : {}", summary.payments);
    println!("    defter      : {}\n", summary.ledger_entries);
    Ok(())
}
