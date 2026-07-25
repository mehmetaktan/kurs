//! Veritabanı bağlantısı, pragma'lar ve dosya yolu.

pub mod migrate;

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

/// `tauri.conf.json` içindeki `identifier` ile AYNI olmak zorunda.
/// Tauri `app_data_dir()`'i `data_dir()/identifier` olarak hesaplar; seed binary'si
/// Tauri runtime'ı olmadan aynı klasörü bulmak için bu sabiti kullanır.
pub const APP_IDENTIFIER: &str = "com.aydinozelders.kurstakip";

pub const DB_FILE_NAME: &str = "kurs.db";

/// Şema `GENERATED ALWAYS AS ... STORED` kullanıyor — SQLite 3.31 ile geldi.
/// Ayrıca kısmi indeks (3.8.0) ve pencere fonksiyonu (3.25) var.
pub const MIN_SQLITE_VERSION: (u32, u32, u32) = (3, 31, 0);

/// Veritabanı dosyasının yolu. **String birleştirme yok** (CLAUDE.md > Windows).
pub fn db_file_in(dir: &Path) -> PathBuf {
    dir.join(DB_FILE_NAME)
}

/// Tauri runtime'ı olmadan `app_data_dir` karşılığı — yalnızca seed binary'si için.
/// Uygulamanın kendisi Tauri path API'sini kullanır (`lib.rs`).
#[cfg(feature = "seed")]
pub fn app_data_dir_without_tauri() -> AppResult<PathBuf> {
    dirs::data_dir()
        .map(|d| d.join(APP_IDENTIFIER))
        .ok_or_else(|| AppError::new("no_data_dir", "Uygulama veri klasörü bulunamadı."))
}

/// Dosya tabanlı bağlantı açar; klasör yoksa oluşturur, pragma'ları uygular.
pub fn open(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    apply_pragmas(&conn)?;
    ensure_supported_sqlite(&conn)?;
    Ok(conn)
}

/// Testler için bellek içi bağlantı (ADR-002). Migration'lar aynen uygulanır.
pub fn open_in_memory() -> AppResult<Connection> {
    let conn = Connection::open_in_memory()?;
    apply_pragmas(&conn)?;
    ensure_supported_sqlite(&conn)?;
    Ok(conn)
}

/// Migration'ları uygulanmış, kullanıma hazır bellek içi veritabanı.
pub fn open_in_memory_migrated() -> AppResult<Connection> {
    let conn = open_in_memory()?;
    migrate::run(&conn)?;
    Ok(conn)
}

fn apply_pragmas(conn: &Connection) -> AppResult<()> {
    // WAL: eşzamanlı okuma/yazma. Bedeli var — WAL'da commit edilmiş veri checkpoint'e
    // kadar .db dosyasında değil .db-wal'da durur, bu yüzden yedek `VACUUM INTO` ile
    // alınır, dosya kopyalanmaz (ADR-019). Faz 10 bunu uygular.
    // Bellek içi veritabanında WAL desteklenmez; dönen değer 'memory' olur, sorun değil.
    let _: String = conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get(0))?;

    conn.pragma_update(None, "foreign_keys", "ON")?;

    // ⚠️ Defter mührünün ayrılmaz parçası — süs değil.
    //
    // `INSERT OR REPLACE` (ve `REPLACE INTO`), çakışan satırı **örtük bir DELETE ile**
    // siler. SQLite'ta bu örtük DELETE, `recursive_triggers` KAPALIYKEN delete
    // tetikleyicilerini hiç çalıştırmaz. Sonuç: `trg_ledger_no_delete` ve
    // `trg_payment_no_delete` bu yolda ateşlenmez ve defter satırı **izsiz** yok edilir.
    //
    // İki biçimi de açıktı (denetimde çalıştırılarak doğrulandı):
    //   1. aynı `id` ile üzerine yazma,
    //   2. FARKLI bir id ile, yalnızca kısmi UNIQUE indeksi (`ux_ledger_attendance`,
    //      `ux_ledger_payment`) çakıştırarak — geliştirici "yeni satır ekliyorum"
    //      sanırken mevcut para kaydı siliniyor.
    //
    // Bu pragma açıkken her iki biçim de `ledger_entry_is_immutable` ile reddediliyor.
    // Şema dosyası checksum'la mühürlü olduğu için düzeltmenin doğru yeri burası;
    // pragma bağlantı başınadır ve `open` ile `open_in_memory` ikisi de buradan geçer.
    // Regresyon testleri: tests/seals.rs → *_or_replace_*.
    conn.pragma_update(None, "recursive_triggers", "ON")?;

    // Kısmi fsync: WAL ile birlikte tek kullanıcılı masaüstünde güvenli ve belirgin hızlı.
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    // Kilitli veritabanında hemen hata vermek yerine 5 sn bekle (PRD §8 "database is locked").
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}

/// SQLite sürümü şemanın gerektirdiğinden eskiyse **açılışta** dur.
/// Bu kontrol olmadan hata, `GENERATED ALWAYS` satırında anlaşılmaz bir sözdizimi
/// hatası olarak çıkardı — hem de kurs sahibinin makinesinde.
fn ensure_supported_sqlite(conn: &Connection) -> AppResult<()> {
    let version = sqlite_version(conn)?;
    let parsed = parse_version(&version);
    if parsed < Some(MIN_SQLITE_VERSION) {
        let (major, minor, patch) = MIN_SQLITE_VERSION;
        return Err(AppError::new(
            "sqlite_too_old",
            format!(
                "Bu bilgisayardaki veritabanı sürümü ({version}) programın \
                 gerektirdiğinden ({major}.{minor}.{patch}) eski. \
                 Programı yeniden kurun."
            ),
        ));
    }
    Ok(())
}

fn parse_version(text: &str) -> Option<(u32, u32, u32)> {
    let mut parts = text.split('.').map(str::parse::<u32>);
    match (parts.next(), parts.next(), parts.next()) {
        (Some(Ok(a)), Some(Ok(b)), Some(Ok(c))) => Some((a, b, c)),
        (Some(Ok(a)), Some(Ok(b)), None) => Some((a, b, 0)),
        _ => None,
    }
}

pub fn sqlite_version(conn: &Connection) -> AppResult<String> {
    Ok(conn.query_row("SELECT sqlite_version()", [], |row| row.get(0))?)
}

pub fn journal_mode(conn: &Connection) -> AppResult<String> {
    Ok(conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))?)
}

pub fn foreign_keys_enabled(conn: &Connection) -> AppResult<bool> {
    let value: i64 = conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;
    Ok(value == 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surum_ayristirma() {
        assert_eq!(parse_version("3.51.0"), Some((3, 51, 0)));
        assert_eq!(parse_version("3.31"), Some((3, 31, 0)));
        assert_eq!(parse_version("bozuk"), None);
    }

    #[test]
    fn bellek_ici_baglanti_pragmalari_uygular() {
        let conn = open_in_memory().unwrap();
        assert!(
            foreign_keys_enabled(&conn).unwrap(),
            "foreign_keys ON olmalı"
        );
        // Sürüm kontrolü açılışta geçmiş olmalı, yoksa buraya gelinmezdi.
        assert!(parse_version(&sqlite_version(&conn).unwrap()) >= Some(MIN_SQLITE_VERSION));
    }

    #[test]
    fn db_dosya_yolu_birlestirmeyle_kurulmaz() {
        let path = db_file_in(Path::new("/tmp/kurs"));
        assert_eq!(path.file_name().unwrap(), DB_FILE_NAME);
    }
}
