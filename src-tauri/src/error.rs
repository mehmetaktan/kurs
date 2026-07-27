//! Tek hata tipi ve Türkçe mesaj eşlemesi.
//!
//! CLAUDE.md > Arayüz: *"Kullanıcı teknik değil: hata mesajları Türkçe ve **eylem önerir**.
//! Ham hata kodu gösterme."* Bu yüzden hata iki parçalıdır:
//!
//! - `message` — kullanıcıya gösterilen Türkçe cümle, ne yapması gerektiğini söyler
//! - `code`    — makine-okur etiket; log, test ve arayüz dallanması için, EKRANDA GÖSTERİLMEZ
//!
//! Mesaj metinleri PRD §8 tablosuyla birebir.

use rusqlite::ffi::ErrorCode;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    /// Sebebi bilinmeyen / beklenmeyen hata. Ham metin yalnızca log'a gider.
    pub fn internal(code: impl Into<String>, detail: impl std::fmt::Display) -> Self {
        let code = code.into();
        let details = format!("{code}: {detail}");
        eprintln!("[kurs] iç hata ({details})");
        let mut error = Self::new(
            code,
            "Beklenmeyen bir sorun oluştu. Programı kapatıp yeniden açın; \
             sorun sürerse en son yedeği geri yükleyin.",
        );
        error.details = Some(details);
        error
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

/// SQLite hatalarını kullanıcıya gösterilebilir Türkçe mesaja çevirir.
///
/// Eşleşme metin üzerinden yapılıyor çünkü şemanın mühürleri `RAISE(ABORT, '…')`
/// ile kendi etiketlerini üretiyor (`ledger_entry_is_immutable` gibi) ve rusqlite
/// bunları `SQLITE_CONSTRAINT_TRIGGER` altında düz metin olarak taşıyor.
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        let text = err.to_string();

        // --- şemanın mühürleri (VERI-MODELI §1.16, §1.19) ---
        if text.contains("ledger_entry_is_immutable") {
            return AppError::new(
                "ledger_immutable",
                "Defter kaydı değiştirilemez ve silinemez. Yanlış bir kayıt varsa \
                 düzeltmesi ters kayıtla yapılır — ilgili işlemi iptal edin.",
            );
        }
        if text.contains("attendance_outside_enrollment") {
            return AppError::new(
                "attendance_outside_enrollment",
                "Bu öğrenci bu tarihte gruba kayıtlı değil. \
                 Katılım tarihini düzeltmek ister misiniz?",
            );
        }
        if text.contains("reversal_amount_mismatch") {
            return AppError::new(
                "reversal_amount_mismatch",
                "İptal kaydı asıl kayıtla uyuşmuyor. İşlemi kapatıp yeniden deneyin; \
                 sorun sürerse en son yedeği geri yükleyin.",
            );
        }
        if text.contains("payment_is_immutable") {
            return AppError::new(
                "payment_immutable",
                "Tahsilat kaydı silinemez ve tutarı değiştirilemez. \
                 Yanlışsa tahsilatı iptal edin; makbuz \"İPTAL\" damgalanır.",
            );
        }
        // ADR-036 — `ledger_entry`'nin iki mührünün ders hakkı tarafındaki ikizi.
        if text.contains("package_usage_is_immutable") {
            return AppError::new(
                "package_usage_immutable",
                "Ders hakkı kaydı değiştirilemez ve silinemez. Yanlışsa yoklamayı \
                 düzeltin — hak otomatik olarak geri verilir.",
            );
        }
        if text.contains("pkgusage_reversal_mismatch") {
            return AppError::new(
                "pkgusage_reversal_mismatch",
                "Ders hakkı düzeltmesi asıl kayıtla uyuşmuyor. İşlemi kapatıp yeniden \
                 deneyin; sorun sürerse en son yedeği geri yükleyin.",
            );
        }

        // --- tekillik ihlalleri ---
        if text.contains("UNIQUE constraint failed") {
            if text.contains("payment.receipt_no") {
                return AppError::new(
                    "receipt_no_taken",
                    "Bu makbuz numarası zaten kullanılmış. \
                     Numarayı değiştirin ya da mevcut makbuzu açın.",
                );
            }
            if text.contains("ledger_entry.attendance_id") {
                return AppError::new(
                    "session_already_charged",
                    "Bu dersin ücreti zaten işlenmiş. Yoklamayı düzeltmek istiyorsanız \
                     ders geçmişinden durumu değiştirin.",
                );
            }
            if text.contains("ledger_entry.installment_id") {
                return AppError::new(
                    "installment_already_accrued",
                    "Bu taksit zaten deftere yazılmış. Listeyi yenileyin.",
                );
            }
            if text.contains("ledger_entry.payment_id") {
                return AppError::new(
                    "payment_already_posted",
                    "Bu tahsilat zaten deftere işlenmiş. Listeyi yenileyin.",
                );
            }
            if text.contains("ledger_entry.reverses_id") {
                return AppError::new(
                    "already_reversed",
                    "Bu kayıt daha önce iptal edilmiş. Listeyi yenileyin.",
                );
            }
            // `ux_pkgusage_head` (ADR-036) — bir yoklamanın en fazla BİR başlık satırı
            // olur. Çift tık ikinci kez hak düşüremez; düzeltme zinciri bu indeksin
            // dışında kalıyor (`reverses_id IS NULL` süzgeci).
            if text.contains("package_usage.attendance_id") {
                return AppError::new(
                    "lesson_already_consumed",
                    "Bu ders için paket hakkı zaten düşülmüş. Listeyi yenileyin.",
                );
            }
            if text.contains("package_usage.reverses_id") {
                return AppError::new(
                    "already_reversed",
                    "Bu ders hakkı hareketi daha önce düzeltilmiş. Listeyi yenileyin.",
                );
            }
            // Tekillik `search_name` üzerinde (K9): `Matematik` ile `matematik` aynı
            // branştır. Mesaj bunu SÖYLEMEK zorunda, yoksa kullanıcı ekranda farklı
            // yazılmış iki adı görüp neden reddedildiğini anlamıyor.
            if text.contains("subject.search_name") {
                return AppError::new(
                    "duplicate_name",
                    "Bu branş zaten kayıtlı. Büyük/küçük harf farkı yeni bir branş \
                     oluşturmaz — listeden mevcut branşı açın.",
                );
            }
            if text.contains("study_group") {
                return AppError::new(
                    "duplicate_name",
                    "Bu branşta aynı adlı bir grup zaten var. \
                     Gruba farklı bir ad verin (örnek: Grup B).",
                );
            }
            if text.contains("closed_day.day") {
                return AppError::new(
                    "duplicate_closed_day",
                    "Bu tarih zaten kapalı gün olarak kayıtlı. \
                     Açıklamasını değiştirmek için listeden açın.",
                );
            }
            if text.contains("session.series_id") {
                return AppError::new(
                    "session_slot_taken",
                    "Bu saatte bu programın dersi zaten var. Listeyi yenileyin.",
                );
            }
            return AppError::new(
                "duplicate",
                "Bu kayıt zaten var. Mevcut kaydı açın ya da bilgileri değiştirin.",
            );
        }

        // --- diğer kısıtlar ---
        if text.contains("FOREIGN KEY constraint failed") {
            return AppError::new(
                "missing_relation",
                "İlişkili bir kayıt bulunamadı. Sayfayı yenileyip tekrar deneyin.",
            );
        }
        if text.contains("CHECK constraint failed") {
            return AppError::new(
                "invalid_value",
                "Girilen bilgi kurallara uymuyor. Alanları kontrol edip tekrar deneyin.",
            );
        }
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            return AppError::new(
                "not_found",
                "Kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir; listeyi yenileyin.",
            );
        }

        match err.sqlite_error_code() {
            Some(ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked) => {
                return AppError::new(
                    "db_locked",
                    "Program başka bir pencerede açık olabilir. Diğer pencereyi kapatıp tekrar deneyin.",
                );
            }
            Some(ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) => {
                return AppError::new(
                    "db_corrupt",
                    "Veritabanı açılamadı. Son yedekten geri yüklemek ister misiniz?",
                );
            }
            Some(ErrorCode::DiskFull) => {
                return AppError::new(
                    "disk_full",
                    "Diskte boş alan kalmadı. Gereksiz dosyaları silip tekrar deneyin.",
                );
            }
            Some(ErrorCode::ReadOnly | ErrorCode::PermissionDenied) => {
                return AppError::new(
                    "write_denied",
                    "Dosyaya yazılamadı. Klasör iznini kontrol edip tekrar deneyin.",
                );
            }
            Some(ErrorCode::CannotOpen) => {
                return AppError::new(
                    "db_open",
                    "Veritabanı dosyası açılamadı. Klasörün erişilebilir olduğunu kontrol edip programı yeniden açın.",
                );
            }
            _ => {}
        }

        AppError::internal("sqlite", err)
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::PermissionDenied => AppError::new(
                "write_denied",
                "Dosyaya yazılamadı. Klasör iznini kontrol edip tekrar deneyin.",
            ),
            std::io::ErrorKind::StorageFull => AppError::new(
                "disk_full",
                "Diskte boş alan kalmadı. Gereksiz dosyaları silip tekrar deneyin.",
            ),
            _ => AppError::internal("io", err),
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::internal("tauri", err)
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use rusqlite::{Connection, OpenFlags};

    struct TestDirectory(std::path::PathBuf);

    impl TestDirectory {
        fn new(label: &str) -> Self {
            let unique = format!(
                "kurs-error-{label}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("sistem saati")
                    .as_nanos()
            );
            let path = std::env::temp_dir().join(unique);
            std::fs::create_dir_all(&path).expect("test klasörü");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn gercek_sqlite_kilidi_eylem_oneren_mesaja_donusur() {
        let dir = TestDirectory::new("locked");
        let path = dir.0.join("locked.db");
        let first = Connection::open(&path).unwrap();
        first
            .execute_batch("CREATE TABLE item (id INTEGER); BEGIN EXCLUSIVE;")
            .unwrap();
        let second = Connection::open(&path).unwrap();
        second.busy_timeout(Duration::ZERO).unwrap();

        let error = second
            .execute("INSERT INTO item VALUES (1)", [])
            .unwrap_err();
        let mapped = AppError::from(error);

        assert_eq!(mapped.code, "db_locked");
        assert_eq!(
            mapped.message,
            "Program başka bir pencerede açık olabilir. Diğer pencereyi kapatıp tekrar deneyin."
        );
    }

    #[test]
    fn gercek_bozuk_dosya_yedekten_geri_yuklemeyi_onerir() {
        let dir = TestDirectory::new("corrupt");
        let path = dir.0.join("corrupt.db");
        std::fs::write(&path, b"bu bir sqlite veritabani degil").unwrap();
        let conn = Connection::open(&path).unwrap();

        let error = conn
            .query_row("PRAGMA schema_version", [], |_| Ok(()))
            .unwrap_err();
        let mapped = AppError::from(error);

        assert_eq!(mapped.code, "db_corrupt");
        assert_eq!(
            mapped.message,
            "Veritabanı açılamadı. Son yedekten geri yüklemek ister misiniz?"
        );
    }

    #[test]
    fn gercek_salt_okunur_baglanti_yazma_izni_mesajina_donusur() {
        let dir = TestDirectory::new("readonly");
        let path = dir.0.join("readonly.db");
        Connection::open(&path)
            .unwrap()
            .execute("CREATE TABLE item (id INTEGER)", [])
            .unwrap();
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();

        let error = conn.execute("INSERT INTO item VALUES (1)", []).unwrap_err();
        let mapped = AppError::from(error);

        assert_eq!(mapped.code, "write_denied");
    }

    #[test]
    fn gercek_sqlite_siniri_disk_dolu_mesajina_donusur() {
        let dir = TestDirectory::new("full");
        let path = dir.0.join("full.db");
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "PRAGMA page_size = 512;
             PRAGMA max_page_count = 3;
             CREATE TABLE item (payload BLOB);",
        )
        .unwrap();

        let payload = vec![0_u8; 8_192];
        let error = conn
            .execute("INSERT INTO item VALUES (?1)", [&payload])
            .unwrap_err();
        let mapped = AppError::from(error);

        assert_eq!(mapped.code, "disk_full");
    }

    #[test]
    fn beklenmeyen_hata_ayrintiyi_mesajdan_ayri_tasir() {
        let error = AppError::internal("ornek", "ham teknik ayrıntı");

        assert!(!error.message.contains("ham teknik"));
        assert_eq!(error.details.as_deref(), Some("ornek: ham teknik ayrıntı"));
    }
}
