//! Tek hata tipi ve Türkçe mesaj eşlemesi.
//!
//! CLAUDE.md > Arayüz: *"Kullanıcı teknik değil: hata mesajları Türkçe ve **eylem önerir**.
//! Ham hata kodu gösterme."* Bu yüzden hata iki parçalıdır:
//!
//! - `message` — kullanıcıya gösterilen Türkçe cümle, ne yapması gerektiğini söyler
//! - `code`    — makine-okur etiket; log, test ve arayüz dallanması için, EKRANDA GÖSTERİLMEZ
//!
//! Mesaj metinleri PRD §8 tablosuyla birebir.

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    /// Sebebi bilinmeyen / beklenmeyen hata. Ham metin yalnızca log'a gider.
    pub fn internal(code: impl Into<String>, detail: impl std::fmt::Display) -> Self {
        let code = code.into();
        eprintln!("[kurs] iç hata ({code}): {detail}");
        Self::new(
            code,
            "Beklenmeyen bir sorun oluştu. Programı kapatıp yeniden açın; \
             sorun sürerse en son yedeği geri yükleyin.",
        )
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
            if text.contains("package_usage.attendance_id") {
                return AppError::new(
                    "lesson_already_consumed",
                    "Bu ders için paket hakkı zaten düşülmüş. Listeyi yenileyin.",
                );
            }
            if text.contains("subject.search_name") || text.contains("study_group") {
                return AppError::new(
                    "duplicate_name",
                    "Bu ad zaten kullanılıyor. Farklı bir ad yazın.",
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
        if text.contains("database is locked") || text.contains("SQLITE_BUSY") {
            return AppError::new(
                "db_locked",
                "Kayıt şu anda tamamlanamadı. Birkaç saniye sonra tekrar deneyin.",
            );
        }
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            return AppError::new(
                "not_found",
                "Kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir; listeyi yenileyin.",
            );
        }

        AppError::internal("sqlite", err)
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::internal("io", err)
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        AppError::internal("tauri", err)
    }
}
