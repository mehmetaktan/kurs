//! Tablo satır tipleri — VERI-MODELI.md §1 ile birebir.
//!
//! Sözleşme (§0):
//! - `id: Option<i64>` — `None` ekleme öncesi (SQLite atar), okumada daima `Some`.
//!   `Some(n)` ile ekleme de yapılabilir; seed ve başlangıç verisi bunu kullanır.
//! - `created_at` / `updated_at` — ekleme öncesi `None`; şemadaki `DEFAULT` doldurur.
//! - `deleted_at` — `None` = canlı. Kullanıcıya "Arşivlendi" denir (ADR-005).
//! - Bütün para alanları `i64`, **kuruş** (ADR-003).
//!
//! Arayüze `camelCase` gider; veritabanı ve Rust tarafı `snake_case` kalır.

use serde::{Deserialize, Serialize};

/// Her satır tipinin ortak alanlarını tekrar yazmamak için kısa yol.
macro_rules! row {
    (
        $(#[$meta:meta])*
        $name:ident { $( $(#[$fmeta:meta])* pub $field:ident : $ty:ty ),* $(,)? }
    ) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
        #[serde(rename_all = "camelCase")]
        pub struct $name {
            #[serde(default)]
            pub id: Option<i64>,
            $( $(#[$fmeta])* pub $field : $ty, )*
            #[serde(default)]
            pub created_at: Option<String>,
            #[serde(default)]
            pub updated_at: Option<String>,
            #[serde(default)]
            pub deleted_at: Option<String>,
        }
    };
}

// §1.2 — anahtar/değer; `id` yok, PK `key`. Bu yüzden `row!` kullanmıyor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setting {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

row!(
    /// §1.3 — MVP'de tek satır (ADR-011); tablo ikinci öğretmen için hazır duruyor.
    Teacher {
        pub full_name: String,
        pub color: String,
        pub phone: Option<String>,
        pub email: Option<String>,
        pub is_active: bool,
        pub sort_order: i64,
    }
);

row!(
    /// §1.4 — branş. Tekillik `search_name` üzerinde (K9).
    Subject {
        pub name: String,
        /// `text::search_name` ile üretilir, elle yazılmaz.
        pub search_name: String,
        pub color: Option<String>,
        /// Varsayılan ders süresi (dk); `None` → `setting.default_session_minutes`.
        pub default_min: Option<i64>,
        pub sort_order: i64,
    }
);

row!(
    /// §1.5 — öğrenci. `is_active` (Aktif/Pasif) ile `deleted_at` (Arşiv) FARKLI şeyler.
    Student {
        pub full_name: String,
        pub search_name: String,
        pub school: Option<String>,
        pub grade: Option<String>,
        pub birth_date: Option<String>,
        pub phone: Option<String>,
        pub phone_digits: Option<String>,
        pub is_active: bool,
        pub enrolled_on: Option<String>,
        pub note: Option<String>,
    }
);

row!(
    /// §1.6 — veli. Telefon öğrencinin değil velinin.
    Guardian {
        pub full_name: String,
        pub phone: Option<String>,
        pub phone_digits: Option<String>,
        pub email: Option<String>,
        /// ADR-009: MVP'de hiç yazılmaz, v2 hatırlatma için hazır bekliyor.
        pub last_reminded_at: Option<String>,
    }
);

row!(
    /// §1.7 — öğrenci ↔ veli. Öğrenci başına tek birincil veli (`ux_sg_primary`).
    StudentGuardian {
        pub student_id: i64,
        pub guardian_id: i64,
        /// 'Anne' | 'Baba' | 'Diğer'
        pub relation: Option<String>,
        pub is_primary: bool,
    }
);

row!(
    /// §1.8 — grup.
    StudyGroup {
        pub name: String,
        pub search_name: String,
        pub subject_id: i64,
        pub teacher_id: Option<i64>,
        pub capacity: i64,
        pub starts_on: Option<String>,
        pub ends_on: Option<String>,
        pub is_active: bool,
    }
);

row!(
    /// §1.10 — tarife. ADR-006 gereği geçmişi DEĞİŞTİRMEZ.
    PriceRule {
        pub name: String,
        /// 'per_session' | 'package' | 'period'
        pub pricing_model: String,
        pub subject_id: Option<i64>,
        pub study_group_id: Option<i64>,
        pub is_group: Option<bool>,
        pub unit_price: i64,
        pub lesson_count: Option<i64>,
        pub total_price: Option<i64>,
        pub period_months: Option<i64>,
        pub default_installments: i64,
        pub valid_from: String,
        pub valid_to: Option<String>,
    }
);

row!(
    /// §1.9 — kayıt. `group_member` yerine geçer (K2/ADR-013): hem katılım aralığını
    /// hem tarifeyi taşır. `study_group_id` `None` → birebir kaydı.
    Enrollment {
        pub student_id: i64,
        pub study_group_id: Option<i64>,
        pub subject_id: i64,
        pub teacher_id: Option<i64>,
        pub price_rule_id: Option<i64>,
        pub pricing_model: String,
        /// ADR-006 snapshot: kayıt anındaki tarifenin kopyası.
        pub unit_price: i64,
        pub start_on: String,
        pub end_on: Option<String>,
        /// 'active' | 'paused' | 'closed'
        pub status: String,
    }
);

row!(
    /// §1.11 — ders paketi. Kalan hak burada DEĞİL, `package_usage` toplamında.
    Package {
        pub student_id: i64,
        pub enrollment_id: Option<i64>,
        pub price_rule_id: Option<i64>,
        pub lesson_count: i64,
        pub unit_price: i64,
        /// İndirim sonrası; `unit_price × lesson_count`'a eşit olmak zorunda değil.
        pub total_price: i64,
        pub sold_on: String,
        pub valid_until: Option<String>,
        /// 'active' | 'exhausted' | 'expired' | 'cancelled'.
        /// Yalnızca 'cancelled' bağlayıcıdır; kalan hak hesabı buna GÜVENMEZ (§1.23).
        pub status: String,
    }
);

row!(
    /// §1.13 — taksit. Peşin ödeme = tek taksit, vadesi satış günü.
    Installment {
        pub student_id: i64,
        pub package_id: Option<i64>,
        pub enrollment_id: Option<i64>,
        pub seq: i64,
        pub due_on: String,
        pub amount: i64,
        /// 'Temmuz taksiti' — tasarımdaki "Mahsup edildiği taksit" kolonunun metni.
        pub label: Option<String>,
        /// Vadesi gelip deftere yazılınca dolar (ADR-015).
        pub accrued_entry_id: Option<i64>,
    }
);

row!(
    /// §1.12 — paket kullanımı. Satır SİLİNMEZ; iade `delta = +1` ile yazılır.
    PackageUsage {
        pub package_id: i64,
        pub attendance_id: Option<i64>,
        pub used_on: String,
        /// -1 (hak düştü) veya +1 (iade).
        pub delta: i64,
        /// 'attendance' | 'cancellation_restore' | 'manual'
        pub reason: String,
        pub memo: Option<String>,
    }
);

row!(
    /// §1.14 — haftalık ders şablonu. "Bu ve sonraki dersler" bu tablo olmadan kurulamaz.
    SessionSeries {
        pub study_group_id: Option<i64>,
        pub student_id: Option<i64>,
        pub subject_id: i64,
        pub teacher_id: Option<i64>,
        /// 1 = Pazartesi … 7 = Pazar
        pub weekday: i64,
        /// '16:00'
        pub start_time: String,
        pub duration_min: i64,
        pub starts_on: String,
        pub ends_on: Option<String>,
    }
);

row!(
    /// §1.15 — seans (birebir + grup, tek tablo — ADR-012).
    /// `student_id` ve `study_group_id` DIŞLAYICI: tam olarak biri dolu.
    Session {
        pub series_id: Option<i64>,
        pub study_group_id: Option<i64>,
        pub student_id: Option<i64>,
        pub subject_id: i64,
        pub teacher_id: Option<i64>,
        /// 'YYYY-MM-DD HH:MM' — yerel duvar saati (ADR-017).
        pub starts_at: String,
        pub ends_at: String,
        /// GENERATED — okunur, yazılmaz.
        #[serde(default)]
        pub session_date: Option<String>,
        /// GENERATED — 'solo' | 'group'. Okunur, yazılmaz.
        #[serde(default)]
        pub kind: Option<String>,
        /// 'planned' | 'done' | 'cancelled'
        pub status: String,
        pub is_makeup: bool,
        pub makeup_for_attendance_id: Option<i64>,
        /// Tek seferlik ders için ücret snapshot'ı.
        pub unit_price: Option<i64>,
        /// `None` = "yoklama girilmedi".
        pub attendance_taken_at: Option<String>,
        pub cancel_reason: Option<String>,
        pub note: Option<String>,
    }
);

row!(
    /// §1.16 — yoklama. Borç ve paket düşümü seansa değil BU satıra bağlanır.
    Attendance {
        pub session_id: i64,
        pub student_id: i64,
        /// 'pending' | 'present' | 'excused' | 'unexcused' | 'cancelled'
        pub status: String,
        pub marked_at: Option<String>,
        pub note: Option<String>,
    }
);

row!(
    /// §1.17 — tahsilat. Mühürlü: tutar/tarih/öğrenci değişmez, satır silinmez.
    Payment {
        pub student_id: i64,
        pub paid_on: String,
        pub amount: i64,
        /// 'cash' | 'card' | 'transfer' — Nakit / Kart / Havale
        pub method: String,
        pub receipt_no: Option<String>,
        pub note: Option<String>,
    }
);

row!(
    /// §1.18 — tahsilatın taksite mahsubu. Artan kısım avanstır, hiçbir taksite bağlanmaz.
    PaymentAllocation {
        pub payment_id: i64,
        pub installment_id: i64,
        pub amount: i64,
    }
);

row!(
    /// §1.19 — cari hareket defteri (ADR-004). **Append-only** (K5).
    ///
    /// `amount` işaretlidir: (+) öğrencinin lehine, (−) aleyhine.
    /// `bakiye = SUM(amount)` → negatif = BORÇLU.
    ///
    /// `deleted_at` şema tekdüzeliği için var ve DAİMA `None` — `CHECK` bunu zorluyor.
    LedgerEntry {
        pub student_id: i64,
        /// 'YYYY-MM-DD'
        pub entry_date: String,
        /// 'session_charge' | 'installment_charge' | 'payment' | 'reversal' | 'adjustment'
        pub kind: String,
        /// Kuruş, İŞARETLİ. Sıfır olamaz.
        pub amount: i64,
        pub attendance_id: Option<i64>,
        pub installment_id: Option<i64>,
        pub payment_id: Option<i64>,
        /// `kind='reversal'` ⟺ bu alan dolu.
        pub reverses_id: Option<i64>,
        pub memo: Option<String>,
    }
);

row!(
    /// §1.20 — öğrenci notu. `teacher_id` `None` = 'Ofis'.
    StudentNote {
        pub student_id: i64,
        pub teacher_id: Option<i64>,
        pub body: String,
        pub noted_on: String,
    }
);

row!(
    /// §1.21 — tatil / kapalı gün. Haftalık kapalı gün `setting.weekly_closed_days`'te.
    ClosedDay {
        pub day: String,
        pub label: String,
    }
);

row!(
    /// §1.22 — yedekleme kaydı. Bugün ekranının verisi, Faz 10 detayı değil.
    BackupLog {
        pub taken_at: String,
        pub file_path: String,
        pub size_bytes: Option<i64>,
        pub is_auto: bool,
        pub ok: bool,
        pub error: Option<String>,
    }
);

// ---------------------------------------------------------------------------
// View satırları (§1.23) — salt okunur.
// ---------------------------------------------------------------------------

/// `v_student_balance` — negatif = borçlu.
/// Arşivlenmiş öğrenci de sayılır; süzme kararı çağıran tarafta (`is_live`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentBalance {
    pub student_id: i64,
    pub is_live: bool,
    pub balance_kurus: i64,
}

/// `v_student_debt` — borçlu listesinin TEK kaynağı (ADR-018).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentDebt {
    pub student_id: i64,
    pub debt_kurus: i64,
    /// FIFO ile ilk kapanmamış borcun vadesi. Borç yoksa `None`.
    pub oldest_due_on: Option<String>,
}

/// `v_package_remaining` — kalan ders hakkı. `package.status`'e güvenmez.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageRemaining {
    pub package_id: i64,
    pub student_id: i64,
    pub valid_until: Option<String>,
    pub status: String,
    pub remaining: i64,
}

/// `v_installment_open` — taksit/vade ekranları için. Borçlu listesi BUNDAN üretilmez.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallmentOpen {
    pub id: i64,
    pub student_id: i64,
    pub package_id: Option<i64>,
    pub seq: i64,
    pub due_on: String,
    pub label: Option<String>,
    pub open_kurus: i64,
}
