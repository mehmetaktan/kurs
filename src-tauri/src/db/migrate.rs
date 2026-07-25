//! Migration çalıştırıcısı.
//!
//! Şema **yalnızca** sıralı `.sql` dosyalarıyla değişir; elle DDL çalıştırılmaz
//! (CLAUDE.md > Veri). Uygulama açılışta bekleyen migration'ları uygular.
//!
//! Dosyalar `include_str!` ile derlemeye gömülür: çalışma anında dosya sistemine
//! bakılmaz, dolayısıyla kurulum paketinden `migrations/` klasörü çıkarmak
//! ya da yanlış çalışma dizininde açılmak diye bir arıza sınıfı yok.

use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};

pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

/// Sıra bağlayıcı: yalnızca sona ekleme yapılır, aradaki dosya değiştirilmez.
pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "001_initial",
    sql: include_str!("../../migrations/001_initial.sql"),
}];

/// `schema_migration` tablosu ilk migration'dan ÖNCE var olmak zorunda — hangi
/// migration'ların uygulandığını okumak için gerekiyor (yumurta-tavuk). Bu yüzden
/// bilerek `001_initial.sql` içinde değil, burada. DDL'i VERI-MODELI.md §1.1 ile aynı.
const BOOTSTRAP_SQL: &str = "\
CREATE TABLE IF NOT EXISTS schema_migration (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M','now','localtime')),
  checksum    TEXT NOT NULL
);";

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Report {
    /// Bu açılışta uygulananlar (boş = veritabanı zaten günceldi).
    pub applied_now: Vec<i64>,
    /// Uygulanmış tüm sürümler.
    pub all_applied: Vec<i64>,
}

/// Migration dosyasının SHA-256'sı.
///
/// Satır sonu buraya doğrudan girer: dosya Windows'ta CRLF'e çevrilirse checksum
/// değişir ve uygulama açılışta durur. `.gitattributes` `*.sql text eol=lf` diyor.
pub fn checksum(sql: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(sql.as_bytes());
    // Hex'i elle yazıyoruz: `{:x}` biçimlendirmesi sha2'nin sürümleri arasında
    // çıktı tipiyle birlikte değişti, bu döngü her sürümde aynı sonucu verir.
    hasher
        .finalize()
        .iter()
        .fold(String::with_capacity(64), |mut acc, byte| {
            use std::fmt::Write;
            let _ = write!(acc, "{byte:02x}");
            acc
        })
}

/// Bekleyen migration'ları sırayla uygular. Zaten uygulanmışların checksum'ını doğrular.
pub fn run(conn: &Connection) -> AppResult<Report> {
    conn.execute_batch(BOOTSTRAP_SQL)?;

    let mut report = Report::default();

    for migration in MIGRATIONS {
        let expected = checksum(migration.sql);
        let recorded: Option<String> = conn
            .query_row(
                "SELECT checksum FROM schema_migration WHERE version = ?1",
                [migration.version],
                |row| row.get(0),
            )
            .ok();

        match recorded {
            Some(actual) if actual == expected => {
                report.all_applied.push(migration.version);
            }
            Some(_) => {
                // Uygulanmış bir migration dosyası sonradan değişmiş. Teknik olmayan
                // kullanıcıda sessiz veri bozulmasının en olası kaynağı budur —
                // devam etmek yerine dur.
                return Err(AppError::new(
                    "migration_checksum_mismatch",
                    format!(
                        "Program dosyaları ile veritabanı uyuşmuyor ({}). \
                         Programı en son çalışan sürümüne döndürün ya da \
                         en son yedeği geri yükleyin.",
                        migration.name
                    ),
                ));
            }
            None => {
                // Tek transaction: yarım uygulanmış şema kalmaz.
                conn.execute_batch("BEGIN")?;
                let applied = conn
                    .execute_batch(migration.sql)
                    .and_then(|()| {
                        conn.execute(
                            "INSERT INTO schema_migration (version, name, checksum) \
                             VALUES (?1, ?2, ?3)",
                            rusqlite::params![migration.version, migration.name, expected],
                        )
                        .map(|_| ())
                    })
                    .and_then(|()| conn.execute_batch("COMMIT"));

                if let Err(err) = applied {
                    let _ = conn.execute_batch("ROLLBACK");
                    return Err(AppError::from(err));
                }

                report.applied_now.push(migration.version);
                report.all_applied.push(migration.version);
            }
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn checksum_kararli_ve_iceriğe_duyarli() {
        assert_eq!(checksum("SELECT 1;"), checksum("SELECT 1;"));
        assert_ne!(checksum("SELECT 1;"), checksum("SELECT 2;"));
        // 64 hex karakter
        assert_eq!(checksum("x").len(), 64);
    }

    #[test]
    fn crlf_farkli_checksum_uretir() {
        // .gitattributes'ın varlık sebebi. Bu iddia yanlışsa kural gereksiz demektir.
        assert_ne!(checksum("A\nB\n"), checksum("A\r\nB\r\n"));
    }

    #[test]
    fn migration_dosyasi_gomulu_ve_bos_degil() {
        assert_eq!(MIGRATIONS.len(), 1);
        assert!(MIGRATIONS[0].sql.contains("CREATE TABLE ledger_entry"));
    }

    #[test]
    fn migration_dosyasi_lf_ile_gomulu() {
        // Derleme anında CRLF'e dönmüş bir dosya, çalıştığı makinede farklı checksum
        // üretip açılışta "migration değiştirilmiş" hatası verirdi.
        assert!(
            !MIGRATIONS[0].sql.contains('\r'),
            "001_initial.sql CRLF içeriyor — .gitattributes çalışmamış"
        );
    }

    #[test]
    fn ikinci_calistirma_idempotent() {
        let conn = db::open_in_memory().unwrap();

        let first = run(&conn).unwrap();
        assert_eq!(first.applied_now, vec![1]);

        let second = run(&conn).unwrap();
        assert!(
            second.applied_now.is_empty(),
            "ikinci çalıştırma yeniden uygulamamalı"
        );
        assert_eq!(second.all_applied, vec![1]);
    }

    #[test]
    fn degistirilmis_migration_acilista_durdurur() {
        let conn = db::open_in_memory().unwrap();
        run(&conn).unwrap();

        // Dosya sonradan değişmiş gibi checksum'ı boz.
        conn.execute(
            "UPDATE schema_migration SET checksum = 'bozuk' WHERE version = 1",
            [],
        )
        .unwrap();

        let err = run(&conn).unwrap_err();
        assert_eq!(err.code, "migration_checksum_mismatch");
        // Kullanıcı ham hata değil, eylem öneren Türkçe cümle görür.
        assert!(err.message.contains("yedeği geri yükleyin"));
    }

    #[test]
    fn baslangic_verisi_migrationla_gelir() {
        let conn = db::open_in_memory_migrated().unwrap();

        // §1.2 varsayılanları — seed'de değil, migration'da.
        let settings: i64 = conn
            .query_row("SELECT COUNT(*) FROM setting", [], |r| r.get(0))
            .unwrap();
        assert_eq!(settings, 15);

        // §1.3 tek öğretmen satırı (ADR-011). Seed'e konsaydı üretimde boş kalırdı.
        let teacher: String = conn
            .query_row("SELECT full_name FROM teacher WHERE id = 1", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(teacher, "Öğretmen");
    }

    #[test]
    fn sema_beklenen_nesneleri_kurar() {
        let conn = db::open_in_memory_migrated().unwrap();

        let count = |kind: &str| -> i64 {
            conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = ?1 AND name NOT LIKE 'sqlite_%'",
                [kind],
                |r| r.get(0),
            )
            .unwrap()
        };

        // 21 alan tablosu + schema_migration
        assert_eq!(count("table"), 22, "tablo sayısı");
        assert_eq!(count("view"), 6, "view sayısı");
        assert_eq!(count("trigger"), 6, "trigger sayısı");
    }
}
