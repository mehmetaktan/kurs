//! Para tarafı: `price_rule`, `package`, `package_usage`, `installment`,
//! `payment`, `payment_allocation`, `ledger_entry`.
//!
//! İki tablo bilerek eksik CRUD'a sahip — bu bir unutma değil, şemanın kuralı:
//!
//! - `ledger_entry` **append-only** (K5/ADR-014). `update_*` yok, `archive` yok.
//!   Düzeltme yalnızca `insert_reversal` ile yapılır. Şema da bunu iki tetikleyiciyle
//!   mühürlüyor; buradaki eksiklik o mührün Rust tarafındaki karşılığıdır.
//! - `payment` tutar/tarih/öğrenci bakımından mühürlü. Yalnızca `receipt_no`, `method`
//!   ve `note` düzeltilebilir — `update_payment_details` bunu yansıtır.

use rusqlite::{params, Connection, Row};

use crate::clock;
use crate::error::AppResult;
use crate::model::{
    Installment, LedgerEntry, Package, PackageUsage, Payment, PaymentAllocation, PriceRule,
};
use crate::repo::{last_id, Record};

// ---------------------------------------------------------------------------
// price_rule (§1.10)
// ---------------------------------------------------------------------------

impl Record for PriceRule {
    const TABLE: &'static str = "price_rule";
    const COLUMNS: &'static str = "id, name, pricing_model, subject_id, study_group_id, is_group, \
                                   unit_price, lesson_count, total_price, period_months, \
                                   default_installments, valid_from, valid_to, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(PriceRule {
            id: row.get(0)?,
            name: row.get(1)?,
            pricing_model: row.get(2)?,
            subject_id: row.get(3)?,
            study_group_id: row.get(4)?,
            is_group: row.get(5)?,
            unit_price: row.get(6)?,
            lesson_count: row.get(7)?,
            total_price: row.get(8)?,
            period_months: row.get(9)?,
            default_installments: row.get(10)?,
            valid_from: row.get(11)?,
            valid_to: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            deleted_at: row.get(15)?,
        })
    }
}

pub fn insert_price_rule(conn: &Connection, p: &PriceRule) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO price_rule (id, name, pricing_model, subject_id, study_group_id, is_group, \
                                 unit_price, lesson_count, total_price, period_months, \
                                 default_installments, valid_from, valid_to) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            p.id,
            p.name,
            p.pricing_model,
            p.subject_id,
            p.study_group_id,
            p.is_group,
            p.unit_price,
            p.lesson_count,
            p.total_price,
            p.period_months,
            p.default_installments,
            p.valid_from,
            p.valid_to,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_price_rule(conn: &Connection, id: i64, p: &PriceRule) -> AppResult<()> {
    conn.execute(
        "UPDATE price_rule SET name = ?2, pricing_model = ?3, subject_id = ?4, \
                               study_group_id = ?5, is_group = ?6, unit_price = ?7, \
                               lesson_count = ?8, total_price = ?9, period_months = ?10, \
                               default_installments = ?11, valid_from = ?12, valid_to = ?13, \
                               updated_at = ?14 \
         WHERE id = ?1",
        params![
            id,
            p.name,
            p.pricing_model,
            p.subject_id,
            p.study_group_id,
            p.is_group,
            p.unit_price,
            p.lesson_count,
            p.total_price,
            p.period_months,
            p.default_installments,
            p.valid_from,
            p.valid_to,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// package (§1.11)
// ---------------------------------------------------------------------------

impl Record for Package {
    const TABLE: &'static str = "package";
    const COLUMNS: &'static str = "id, student_id, enrollment_id, price_rule_id, lesson_count, \
                                   unit_price, total_price, sold_on, valid_until, status, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Package {
            id: row.get(0)?,
            student_id: row.get(1)?,
            enrollment_id: row.get(2)?,
            price_rule_id: row.get(3)?,
            lesson_count: row.get(4)?,
            unit_price: row.get(5)?,
            total_price: row.get(6)?,
            sold_on: row.get(7)?,
            valid_until: row.get(8)?,
            status: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            deleted_at: row.get(12)?,
        })
    }
}

pub fn insert_package(conn: &Connection, p: &Package) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO package (id, student_id, enrollment_id, price_rule_id, lesson_count, \
                              unit_price, total_price, sold_on, valid_until, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            p.id,
            p.student_id,
            p.enrollment_id,
            p.price_rule_id,
            p.lesson_count,
            p.unit_price,
            p.total_price,
            p.sold_on,
            p.valid_until,
            p.status,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_package(conn: &Connection, id: i64, p: &Package) -> AppResult<()> {
    conn.execute(
        "UPDATE package SET valid_until = ?2, status = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, p.valid_until, p.status, clock::now_local()],
    )?;
    Ok(())
}

pub fn packages_of(conn: &Connection, student_id: i64) -> AppResult<Vec<Package>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM package \
         WHERE student_id = ?1 AND deleted_at IS NULL ORDER BY sold_on DESC",
        cols = Package::COLUMNS
    ))?;
    let rows = stmt.query_map([student_id], Package::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// package_usage (§1.12)
// ---------------------------------------------------------------------------

impl Record for PackageUsage {
    const TABLE: &'static str = "package_usage";
    const COLUMNS: &'static str = "id, package_id, attendance_id, used_on, delta, reason, \
                                   reverses_id, memo, created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(PackageUsage {
            id: row.get(0)?,
            package_id: row.get(1)?,
            attendance_id: row.get(2)?,
            used_on: row.get(3)?,
            delta: row.get(4)?,
            reason: row.get(5)?,
            reverses_id: row.get(6)?,
            memo: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            deleted_at: row.get(10)?,
        })
    }
}

/// Paket hakkı hareketi — **append-only** (ADR-036, `ledger_entry`'nin ikizi).
///
/// `update_*` ve `archive` fonksiyonu **yoktur** ve yazılmayacak: `003` migration'ı
/// `UPDATE`'in ve `DELETE`'in tamamını tetikleyiciyle kapattı. Yanlış yazılmış bir
/// satırın tek çıkışı `insert_package_usage_reversal` ile tersini yazmak.
///
/// `ux_pkgusage_head` aynı yoklamadan **iki kez** hak düşülmesini engeller — çift tık
/// dahil, zincirin her derinliğinde.
pub fn insert_package_usage(conn: &Connection, u: &PackageUsage) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO package_usage \
           (id, package_id, attendance_id, used_on, delta, reason, reverses_id, memo) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            u.id,
            u.package_id,
            u.attendance_id,
            u.used_on,
            u.delta,
            u.reason,
            u.reverses_id,
            u.memo
        ],
    )?;
    Ok(last_id(conn))
}

/// Bir hareketi ters kaydeder (ADR-036). Tutar ve paket **hedeften okunur**, çağırandan
/// alınmaz: `delta`'yı çağırana bıraksaydık `trg_pkgusage_reversal_valid` yalnızca hata
/// mesajı üreten bir kapı olurdu; burada zaten doğrusu yazılıyor.
///
/// `attendance_id` de hedeften geliyor — zincirin tamamı aynı yoklamaya bağlı kalmalı,
/// yoksa "bu ders hakkı hangi yoklamadan düştü" sorusu zincirin ortasında cevapsız kalır.
/// Başlık indeksi (`ux_pkgusage_head`) yalnızca `reverses_id IS NULL` satırlarını
/// süzdüğü için bu tekrar çakışma üretmiyor.
pub fn insert_package_usage_reversal(
    conn: &Connection,
    target_id: i64,
    used_on: &str,
    reason: &str,
    memo: Option<&str>,
) -> AppResult<i64> {
    let target: PackageUsage = crate::repo::require(conn, target_id)?;
    insert_package_usage(
        conn,
        &PackageUsage {
            id: None,
            package_id: target.package_id,
            attendance_id: target.attendance_id,
            used_on: used_on.to_string(),
            delta: -target.delta,
            reason: reason.to_string(),
            reverses_id: Some(target_id),
            memo: memo.map(str::to_string),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
}

/// Bir yoklamanın ders hakkı zincirinin **canlı ucu** (ADR-036).
///
/// Zincir doğrusaldır (`ux_pkgusage_reverses` dallanmayı engelliyor), dolayısıyla
/// "ucu" tanımlamak tek sorgu: kendisini ters kaydeden bir satırı olmayan satır.
/// Zincirin tamamı aynı `attendance_id`'yi taşıyor, o yüzden filtre bu kadar basit.
fn usage_tail(conn: &Connection, attendance_id: i64) -> AppResult<Option<PackageUsage>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM package_usage u \
         WHERE u.attendance_id = ?1 AND u.deleted_at IS NULL \
           AND NOT EXISTS (SELECT 1 FROM package_usage r \
                           WHERE r.reverses_id = u.id AND r.deleted_at IS NULL)",
        cols = PackageUsage::COLUMNS
    ))?;
    let mut rows = stmt.query_map([attendance_id], PackageUsage::from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// **Ders hakkını düşer** — ADR-015'in iki sayacından ders hakkı tarafı.
///
/// Deftere hiçbir satır yazmaz: paketli öğrencide ders işlemek borç doğurmaz
/// (`VERI-MODELI.md §3`). Para tarafı satışta ve taksit vadesinde yazıldı.
///
/// **İdempotent ve yön belirtir.** Fonksiyon "bir satır ekle" demiyor, *"bu yoklamanın
/// hakkı DÜŞMÜŞ olsun"* diyor. Üç durum var ve üçü de doğru sonucu veriyor:
///
/// | Zincirin ucu | Yapılan |
/// |---|---|
/// | yok | başlık satırı (`delta = −1`) |
/// | `+1` (daha önce iade edilmiş) | ucun ters kaydı (`delta = −1`) — `Mazeretli → Geldi` |
/// | `−1` (zaten düşmüş) | **hiçbir şey** — çift tık ikinci kez düşüremez |
///
/// Bu sözleşme Faz 6'nın yoklama ekranı için sabitlendi: ekran yalnızca **çağırır**,
/// hangi satırın yazılacağını hesaplamaz. Çağıran kendi transaction'ını açar.
///
/// `today` **parametredir** — aktif paket sorgusu onu bind ediyor, SQLite saati
/// okunmuyor (`VERI-MODELI §0`). `used_on` ise **dersin günü**: hak o gün kullanıldı,
/// kaydın yazıldığı gün değil. İkisi ayrı, çünkü geçmiş bir yoklama bugün işlenebilir.
pub fn consume_package_credit(conn: &Connection, attendance_id: i64, today: &str) -> AppResult<()> {
    let (student_id, session_date) = attendance_context(conn, attendance_id)?;

    match usage_tail(conn, attendance_id)? {
        // Zaten düşmüş — ikinci çağrı ikinci ders düşürmez (idempotency).
        Some(tail) if tail.delta == -1 => Ok(()),
        // İade edilmişti, yeniden düşüyor: `Geldi → Mazeretli → Geldi`'nin 3. adımı.
        // Eski şemada bu satır YAZILAMIYORDU (`ux_pkgusage_att`) — ADR-036'nın sebebi.
        Some(tail) => {
            insert_package_usage_reversal(
                conn,
                tail.id.expect("okunan satırın id'si olur"),
                &session_date,
                "attendance",
                None,
            )?;
            Ok(())
        }
        None => {
            let package_id = oldest_active_package(conn, student_id, today)?;
            insert_package_usage(
                conn,
                &PackageUsage {
                    id: None,
                    package_id,
                    attendance_id: Some(attendance_id),
                    used_on: session_date,
                    delta: -1,
                    reason: "attendance".into(),
                    reverses_id: None,
                    memo: None,
                    created_at: None,
                    updated_at: None,
                    deleted_at: None,
                },
            )?;
            Ok(())
        }
    }
}

/// **Ders hakkını geri verir** — `consume_package_credit`'in tam tersi ve aynı
/// disiplinde: *"bu yoklamanın hakkı DÜŞMEMİŞ olsun."*
///
/// Seans iptali (`VERI-MODELI §4`) ve `Geldi → Mazeretli` düzeltmesi bunu çağırır.
/// Hiç düşülmemişse (paketsiz öğrenci, mazeretli işaretlenmiş ders) sessizce geçer:
/// "geri verilecek hak yok" bir hata değil, beklenen durum.
pub fn restore_package_credit(conn: &Connection, attendance_id: i64) -> AppResult<()> {
    let Some(tail) = usage_tail(conn, attendance_id)? else {
        return Ok(());
    };
    // Zaten iade edilmiş — iki kez iptal iki iade yapmaz.
    if tail.delta == 1 {
        return Ok(());
    }
    let (_, session_date) = attendance_context(conn, attendance_id)?;
    insert_package_usage_reversal(
        conn,
        tail.id.expect("okunan satırın id'si olur"),
        &session_date,
        "cancellation_restore",
        None,
    )?;
    Ok(())
}

/// Yoklamanın öğrencisi ve **dersin günü**.
fn attendance_context(conn: &Connection, attendance_id: i64) -> AppResult<(i64, String)> {
    conn.query_row(
        "SELECT a.student_id, s.session_date \
         FROM attendance a JOIN session s ON s.id = a.session_id \
         WHERE a.id = ?1 AND a.deleted_at IS NULL",
        params![attendance_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| {
        crate::error::AppError::new(
            "attendance_not_found",
            "Bu yoklama kaydı bulunamadı. Listeyi yenileyip yeniden deneyin.",
        )
    })
}

/// **En eski aktif paket** (R5.12) — `active_packages` `sold_on, id` sırasında
/// döndürüyor.
///
/// "Aktif paket" bir sorgudur, bir sütun değildir: `status`'a bakılmıyor. Bakılsaydı
/// ve status güncellenmeseydi kalan hak eksiye düşer, yeni satılan paket hiç
/// kullanılmaz ve o dersler için **borç da yazılmazdı** — öğrenci bedava ders alırdı
/// (`VERI-MODELI §1.23`).
///
/// Paket yoksa **hata**: sessizce geçmek, paketi bitmiş öğrencinin dersini bedavaya
/// getirirdi. Mesaj kullanıcıya ne yapacağını söylüyor (PRD §8).
fn oldest_active_package(conn: &Connection, student_id: i64, today: &str) -> AppResult<i64> {
    crate::repo::views::active_packages(conn, student_id, today)?
        .first()
        .map(|p| p.package_id)
        .ok_or_else(|| {
            crate::error::AppError::new(
                "no_active_package",
                "Bu öğrencinin kullanılabilir ders paketi yok. \
                 Yeni paket satın veya dersi ders başı ücretle işleyin.",
            )
        })
}

// ---------------------------------------------------------------------------
// installment (§1.13)
// ---------------------------------------------------------------------------

impl Record for Installment {
    const TABLE: &'static str = "installment";
    const COLUMNS: &'static str = "id, student_id, package_id, enrollment_id, seq, due_on, \
                                   amount, label, accrued_entry_id, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Installment {
            id: row.get(0)?,
            student_id: row.get(1)?,
            package_id: row.get(2)?,
            enrollment_id: row.get(3)?,
            seq: row.get(4)?,
            due_on: row.get(5)?,
            amount: row.get(6)?,
            label: row.get(7)?,
            accrued_entry_id: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            deleted_at: row.get(11)?,
        })
    }
}

pub fn insert_installment(conn: &Connection, i: &Installment) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO installment (id, student_id, package_id, enrollment_id, seq, due_on, \
                                  amount, label, accrued_entry_id) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            i.id,
            i.student_id,
            i.package_id,
            i.enrollment_id,
            i.seq,
            i.due_on,
            i.amount,
            i.label,
            i.accrued_entry_id,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_installment(conn: &Connection, id: i64, i: &Installment) -> AppResult<()> {
    conn.execute(
        "UPDATE installment SET due_on = ?2, amount = ?3, label = ?4, updated_at = ?5 \
         WHERE id = ?1",
        params![id, i.due_on, i.amount, i.label, clock::now_local()],
    )?;
    Ok(())
}

/// Taksit deftere yazıldı — `accrued_entry_id`'yi bağla (ADR-015).
pub fn mark_installment_accrued(conn: &Connection, id: i64, entry_id: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE installment SET accrued_entry_id = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, entry_id, clock::now_local()],
    )?;
    Ok(())
}

/// Vadesi gelmiş ve henüz deftere yazılmamış taksitler.
/// `today` **parametredir** — `date('now')` kullanılmaz (§0 `'now'` kuralı).
pub fn due_unaccrued_installments(conn: &Connection, today: &str) -> AppResult<Vec<Installment>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM installment \
         WHERE deleted_at IS NULL AND accrued_entry_id IS NULL AND due_on <= ?1 \
         ORDER BY due_on, id",
        cols = Installment::COLUMNS
    ))?;
    let rows = stmt.query_map([today], Installment::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// payment (§1.17)
// ---------------------------------------------------------------------------

impl Record for Payment {
    const TABLE: &'static str = "payment";
    const COLUMNS: &'static str = "id, student_id, paid_on, amount, method, receipt_no, note, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Payment {
            id: row.get(0)?,
            student_id: row.get(1)?,
            paid_on: row.get(2)?,
            amount: row.get(3)?,
            method: row.get(4)?,
            receipt_no: row.get(5)?,
            note: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
            deleted_at: row.get(9)?,
        })
    }
}

pub fn insert_payment(conn: &Connection, p: &Payment) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO payment (id, student_id, paid_on, amount, method, receipt_no, note) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            p.id,
            p.student_id,
            p.paid_on,
            p.amount,
            p.method,
            p.receipt_no,
            p.note
        ],
    )?;
    Ok(last_id(conn))
}

/// Tahsilatta yalnızca **belge bilgileri** düzeltilebilir.
/// Tutar, tarih, öğrenci ve arşiv durumu `trg_payment_immutable` ile mühürlü —
/// bunları güncellemeye çalışan bir sorgu veritabanı seviyesinde reddedilir.
pub fn update_payment_details(conn: &Connection, id: i64, p: &Payment) -> AppResult<()> {
    conn.execute(
        "UPDATE payment SET receipt_no = ?2, method = ?3, note = ?4, updated_at = ?5 \
         WHERE id = ?1",
        params![id, p.receipt_no, p.method, p.note, clock::now_local()],
    )?;
    Ok(())
}

pub fn payments_of(conn: &Connection, student_id: i64) -> AppResult<Vec<Payment>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM payment \
         WHERE student_id = ?1 AND deleted_at IS NULL ORDER BY paid_on DESC, id DESC",
        cols = Payment::COLUMNS
    ))?;
    let rows = stmt.query_map([student_id], Payment::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// payment_allocation (§1.18)
// ---------------------------------------------------------------------------

impl Record for PaymentAllocation {
    const TABLE: &'static str = "payment_allocation";
    const COLUMNS: &'static str = "id, payment_id, installment_id, amount, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(PaymentAllocation {
            id: row.get(0)?,
            payment_id: row.get(1)?,
            installment_id: row.get(2)?,
            amount: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
        })
    }
}

pub fn insert_payment_allocation(conn: &Connection, a: &PaymentAllocation) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO payment_allocation (id, payment_id, installment_id, amount) \
         VALUES (?1, ?2, ?3, ?4)",
        params![a.id, a.payment_id, a.installment_id, a.amount],
    )?;
    Ok(last_id(conn))
}

/// Tahsilat iptalinde mahsuplar arşivlenir; `v_installment_open` zaten
/// `deleted_at IS NULL` süzdüğü için taksit kendiliğinden yeniden açılır (§4).
pub fn archive_allocations_of_payment(conn: &Connection, payment_id: i64) -> AppResult<usize> {
    Ok(conn.execute(
        "UPDATE payment_allocation SET deleted_at = ?2, updated_at = ?2 \
         WHERE payment_id = ?1 AND deleted_at IS NULL",
        params![payment_id, clock::now_local()],
    )?)
}

pub fn allocations_of_payment(
    conn: &Connection,
    payment_id: i64,
) -> AppResult<Vec<PaymentAllocation>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM payment_allocation \
         WHERE payment_id = ?1 AND deleted_at IS NULL",
        cols = PaymentAllocation::COLUMNS
    ))?;
    let rows = stmt.query_map([payment_id], PaymentAllocation::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// ledger_entry (§1.19) — APPEND-ONLY
// ---------------------------------------------------------------------------

impl Record for LedgerEntry {
    const TABLE: &'static str = "ledger_entry";
    const COLUMNS: &'static str = "id, student_id, entry_date, kind, amount, attendance_id, \
                                   installment_id, payment_id, reverses_id, memo, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(LedgerEntry {
            id: row.get(0)?,
            student_id: row.get(1)?,
            entry_date: row.get(2)?,
            kind: row.get(3)?,
            amount: row.get(4)?,
            attendance_id: row.get(5)?,
            installment_id: row.get(6)?,
            payment_id: row.get(7)?,
            reverses_id: row.get(8)?,
            memo: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            deleted_at: row.get(12)?,
        })
    }
}

/// Deftere satır yazar. **Tek yazma yolu budur** — güncelleme ve silme yok (K5).
pub fn insert_ledger_entry(conn: &Connection, e: &LedgerEntry) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO ledger_entry (id, student_id, entry_date, kind, amount, attendance_id, \
                                   installment_id, payment_id, reverses_id, memo) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            e.id,
            e.student_id,
            e.entry_date,
            e.kind,
            e.amount,
            e.attendance_id,
            e.installment_id,
            e.payment_id,
            e.reverses_id,
            e.memo,
        ],
    )?;
    Ok(last_id(conn))
}

/// Bir defter satırının tersini yazar — düzeltmenin TEK yolu (ADR-014).
///
/// Tutar ve öğrenci orijinalden okunur; elle verilmez. `trg_ledger_reversal_valid`
/// yine de doğrular, `ux_ledger_reverses` aynı satırın ikinci kez ters kaydedilmesini
/// engeller (çift tıkla oluşan karşılıksız alacak).
pub fn insert_reversal(
    conn: &Connection,
    reverses_id: i64,
    entry_date: &str,
    memo: Option<&str>,
) -> AppResult<i64> {
    let original: LedgerEntry = crate::repo::require(conn, reverses_id)?;
    let reversal = LedgerEntry {
        id: None,
        student_id: original.student_id,
        entry_date: entry_date.to_string(),
        kind: "reversal".to_string(),
        amount: -original.amount,
        attendance_id: None,
        installment_id: None,
        // Tahsilat iptalinde makbuz ters kayıttan bulunabilsin.
        payment_id: original.payment_id,
        reverses_id: Some(reverses_id),
        memo: memo.map(str::to_string),
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };
    insert_ledger_entry(conn, &reversal)
}

/// Bir öğrencinin cari ekstresi, tarih sırasıyla.
pub fn ledger_of(conn: &Connection, student_id: i64) -> AppResult<Vec<LedgerEntry>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM ledger_entry \
         WHERE student_id = ?1 AND deleted_at IS NULL ORDER BY entry_date, id",
        cols = LedgerEntry::COLUMNS
    ))?;
    let rows = stmt.query_map([student_id], LedgerEntry::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}
