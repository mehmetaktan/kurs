//! faz-02 §5 — şemanın mühürleri. **Her biri hata vermek zorunda.**
//!
//! Bu testler kodun değil ŞEMANIN sözleşmesini sınıyor: uygulama kodu yanlış yazılsa
//! bile veritabanı reddetmeli. Faz 1 denetiminde açık olan delik `deleted_at`'ti —
//! tek bir UPDATE muhasebe kaydını izsiz yok ediyor, üstelik `accrued_entry_id` dolu
//! kaldığı için taksit bir daha tahakkuk etmiyordu: borç kalıcı olarak kayboluyordu.

mod common;

use common::*;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;

/// Ham SQL çalıştırır ve hata metnini döndürür. Başarılı olursa test düşer.
fn must_fail(conn: &rusqlite::Connection, sql: &str, params: &[&dyn rusqlite::ToSql]) -> String {
    match conn.execute(sql, params) {
        Ok(_) => panic!("bu ifade REDDEDİLMELİYDİ: {sql}"),
        Err(err) => err.to_string(),
    }
}

// ---------------------------------------------------------------------------
// ledger_entry — değişmezlik (K5 / ADR-014)
// ---------------------------------------------------------------------------

#[test]
fn defter_satirinin_tutari_degistirilemez() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    let err = must_fail(
        &conn,
        "UPDATE ledger_entry SET amount = -1 WHERE id = ?1",
        &[&entry],
    );
    assert!(err.contains("ledger_entry_is_immutable"), "gelen: {err}");
}

#[test]
fn defter_satiri_soft_delete_ile_de_yok_edilemez() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    // Denetimde açık olan delik tam olarak buydu: sütun listeli trigger deleted_at'i
    // korumuyordu ve bütün view'lar `deleted_at IS NULL` süzdüğü için borç yok oluyordu.
    let err = must_fail(
        &conn,
        "UPDATE ledger_entry SET deleted_at = '2026-04-01' WHERE id = ?1",
        &[&entry],
    );
    assert!(err.contains("ledger_entry_is_immutable"), "gelen: {err}");

    // Repository katmanından da aynı kapı kapalı; hata Türkçeye çevrilerek gelir.
    let app_err = repo::archive::<LedgerEntry>(&conn, entry).unwrap_err();
    assert_eq!(app_err.code, "ledger_immutable");
    assert!(app_err.message.contains("ters kayıtla"));
}

#[test]
fn dogustan_silinmis_defter_satiri_yazilamaz() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");

    // Sütunsuz trigger tek başına yetmiyordu: "doğuştan silinmiş" satır geçiyordu.
    // Tablo tanımındaki CHECK (deleted_at IS NULL) bunu kapatır.
    let err = must_fail(
        &conn,
        "INSERT INTO ledger_entry (student_id, entry_date, kind, amount, deleted_at) \
         VALUES (?1, '2026-01-01', 'adjustment', -100, '2026-01-01')",
        &[&id],
    );
    assert!(err.contains("CHECK constraint failed"), "gelen: {err}");
}

#[test]
fn defter_satiri_silinemez() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    let err = must_fail(&conn, "DELETE FROM ledger_entry WHERE id = ?1", &[&entry]);
    assert!(err.contains("ledger_entry_is_immutable"), "gelen: {err}");
}

#[test]
fn ayni_satir_iki_kez_ters_kaydedilemez() {
    let conn = conn();
    let id = student(&conn, "Fatma Öztürk");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    repo::finance::insert_reversal(&conn, entry, "2026-03-03", Some("iptal"))
        .expect("ilk ters kayıt geçmeli");

    // ux_ledger_reverses: çift tıkla oluşan KARŞILIKSIZ ALACAĞI kapatır.
    let err = repo::finance::insert_reversal(&conn, entry, "2026-03-04", None).unwrap_err();
    assert_eq!(err.code, "already_reversed");
}

#[test]
fn yanlis_tutarli_ters_kayit_reddedilir() {
    let conn = conn();
    let id = student(&conn, "Fatma Öztürk");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    // Ters kaydın tutarı orijinalin TAM tersi olmak zorunda.
    let err = must_fail(
        &conn,
        "INSERT INTO ledger_entry (student_id, entry_date, kind, amount, reverses_id) \
         VALUES (?1, '2026-03-03', 'reversal', 999, ?2)",
        &[&id, &entry],
    );
    assert!(err.contains("reversal_amount_mismatch"), "gelen: {err}");
}

#[test]
fn baska_ogrencinin_ters_kaydi_reddedilir() {
    let conn = conn();
    let a = student(&conn, "Fatma Öztürk");
    let b = student(&conn, "Mehmet Aslan");
    let entry = ledger(&conn, a, "2026-03-02", "session_charge", -25000);

    let err = must_fail(
        &conn,
        "INSERT INTO ledger_entry (student_id, entry_date, kind, amount, reverses_id) \
         VALUES (?1, '2026-03-03', 'reversal', 25000, ?2)",
        &[&b, &entry],
    );
    assert!(err.contains("reversal_amount_mismatch"), "gelen: {err}");
}

#[test]
fn hedefsiz_reversal_ve_hedefli_adjustment_reddedilir() {
    let conn = conn();
    let id = student(&conn, "Fatma Öztürk");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    // CHECK ((kind = 'reversal') = (reverses_id IS NOT NULL)) — çift yönlü.
    // Hedefsiz reversal'ı BEFORE INSERT trigger'ı CHECK'ten önce yakalar; ikisi de reddeder.
    let err = must_fail(
        &conn,
        "INSERT INTO ledger_entry (student_id, entry_date, kind, amount) \
         VALUES (?1, '2026-03-03', 'reversal', 25000)",
        &[&id],
    );
    assert!(
        err.contains("reversal_amount_mismatch") || err.contains("CHECK constraint failed"),
        "gelen: {err}"
    );

    // 'adjustment' reverses_id taşıyamaz.
    let err = must_fail(
        &conn,
        "INSERT INTO ledger_entry (student_id, entry_date, kind, amount, reverses_id) \
         VALUES (?1, '2026-03-03', 'adjustment', 25000, ?2)",
        &[&id, &entry],
    );
    assert!(err.contains("CHECK constraint failed"), "gelen: {err}");
}

#[test]
fn ayni_yoklamadan_iki_kez_borc_yazilamaz() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let student_id = student(&conn, "Mehmet Aslan");
    let session_id = repo::academic::insert_session(
        &conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: "2026-03-02 15:00".into(),
            ends_at: "2026-03-02 16:00".into(),
            session_date: None,
            kind: None,
            status: "planned".into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: Some(25000),
            attendance_taken_at: None,
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    let attendance_id = repo::academic::insert_attendance(
        &conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: "present".into(),
            marked_at: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    let charge = |amount: i64| LedgerEntry {
        id: None,
        student_id,
        entry_date: "2026-03-02".into(),
        kind: "session_charge".into(),
        amount,
        attendance_id: Some(attendance_id),
        installment_id: None,
        payment_id: None,
        reverses_id: None,
        memo: None,
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };

    repo::finance::insert_ledger_entry(&conn, &charge(-25000)).expect("ilk borç geçmeli");

    // ux_ledger_attendance: yoklama sehven iki kez işlenirse ikinci borç yazılmaz.
    let err = repo::finance::insert_ledger_entry(&conn, &charge(-25000)).unwrap_err();
    assert_eq!(err.code, "session_already_charged");
    assert!(!err.message.is_empty());
}

// ---------------------------------------------------------------------------
// payment — mühürler (§1.19)
// ---------------------------------------------------------------------------

fn a_payment(conn: &rusqlite::Connection, student_id: i64, receipt: &str) -> i64 {
    repo::finance::insert_payment(
        conn,
        &Payment {
            id: None,
            student_id,
            paid_on: "2026-03-15".into(),
            amount: 60000,
            method: "cash".into(),
            receipt_no: Some(receipt.into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("tahsilat eklenmeli")
}

#[test]
fn tahsilat_tutari_tarihi_ve_arsiv_durumu_muhurlu() {
    let conn = conn();
    let id = student(&conn, "Ayşe Demir");
    let payment = a_payment(&conn, id, "2026-1");

    for sql in [
        "UPDATE payment SET amount = 1 WHERE id = ?1",
        "UPDATE payment SET paid_on = '2026-01-01' WHERE id = ?1",
        "UPDATE payment SET deleted_at = '2026-04-01' WHERE id = ?1",
        "DELETE FROM payment WHERE id = ?1",
    ] {
        let err = must_fail(&conn, sql, &[&payment]);
        assert!(err.contains("payment_is_immutable"), "{sql} → {err}");
    }
}

#[test]
fn tahsilatin_belge_bilgileri_duzeltilebilir() {
    let conn = conn();
    let id = student(&conn, "Ayşe Demir");
    let payment_id = a_payment(&conn, id, "2026-1");

    let mut p: Payment = repo::require(&conn, payment_id).unwrap();
    p.method = "transfer".into();
    p.receipt_no = Some("2026-99".into());
    p.note = Some("Havale dekontu eklendi".into());

    // receipt_no, method ve note mühürlü DEĞİL — düzeltilebilir kalmalı.
    repo::finance::update_payment_details(&conn, payment_id, &p)
        .expect("belge bilgisi düzeltilebilmeli");

    let read: Payment = repo::require(&conn, payment_id).unwrap();
    assert_eq!(read.method, "transfer");
    assert_eq!(read.receipt_no.as_deref(), Some("2026-99"));
    assert_eq!(read.amount, 60000, "tutar değişmemeli");
}

#[test]
fn makbuz_numarasi_iki_kez_kullanilamaz() {
    let conn = conn();
    let a = student(&conn, "Ayşe Demir");
    let b = student(&conn, "Mehmet Aslan");
    a_payment(&conn, a, "2026-1");

    let err = repo::finance::insert_payment(
        &conn,
        &Payment {
            id: None,
            student_id: b,
            paid_on: "2026-03-16".into(),
            amount: 100,
            method: "cash".into(),
            receipt_no: Some("2026-1".into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap_err();

    // PRD §8: ham SQLite metni yerine eylem öneren Türkçe cümle.
    assert_eq!(err.code, "receipt_no_taken");
    assert!(err.message.contains("Numarayı değiştirin"));
}

// ---------------------------------------------------------------------------
// attendance — katılım aralığı (§1.16)
// ---------------------------------------------------------------------------

#[test]
fn kayit_araligi_disinda_yoklama_yazilamaz() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let group_id = group(&conn, "Grup A", subject_id);
    let inside = student(&conn, "Elif Yılmaz");
    let outside = student(&conn, "Mehmet Aslan");
    let late = student(&conn, "Zeynep Kaya");

    let session_id = group_session(&conn, group_id, subject_id, "2026-03-05");

    enrollment(
        &conn,
        inside,
        Some(group_id),
        subject_id,
        "2026-03-01",
        None,
    )
    .unwrap();
    // Nisan'da katılıyor — Mart'taki seansta görünmemeli.
    enrollment(&conn, late, Some(group_id), subject_id, "2026-04-01", None).unwrap();

    let mark = |student_id: i64| {
        repo::academic::insert_attendance(
            &conn,
            &Attendance {
                id: None,
                session_id,
                student_id,
                status: "present".into(),
                marked_at: None,
                note: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )
    };

    mark(inside).expect("kayıtlı öğrencinin yoklaması geçmeli");

    for (student_id, label) in [
        (outside, "hiç kaydı yok"),
        (late, "kayıt sonradan başlıyor"),
    ] {
        let err = mark(student_id).unwrap_err();
        assert_eq!(err.code, "attendance_outside_enrollment", "{label}");
        assert!(err.message.contains("gruba kayıtlı değil"), "{label}");
    }
}

#[test]
fn birebir_seansta_katilim_tetikleyicisi_calismaz() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let student_id = student(&conn, "Mehmet Aslan");

    // Birebir seansta seansın kendisi zaten öğrenciye bağlı — enrollment aranmaz.
    let session_id = repo::academic::insert_session(
        &conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: "2026-03-02 15:00".into(),
            ends_at: "2026-03-02 16:00".into(),
            session_date: None,
            kind: None,
            status: "planned".into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: Some(25000),
            attendance_taken_at: None,
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    repo::academic::insert_attendance(
        &conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: "present".into(),
            marked_at: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("birebir seansta kayıt aranmamalı");
}

#[test]
fn seans_tipi_dislayici_ve_kind_turetilir() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let group_id = group(&conn, "Grup A", subject_id);
    let student_id = student(&conn, "Elif Yılmaz");

    let group_sid = group_session(&conn, group_id, subject_id, "2026-03-05");
    let read: Session = repo::require(&conn, group_sid).unwrap();
    // GENERATED ALWAYS AS ... STORED — elle yazılmadığı için çelişme ihtimali sıfır.
    assert_eq!(read.kind.as_deref(), Some("group"));
    assert_eq!(read.session_date.as_deref(), Some("2026-03-05"));

    // "Tipi grup ama hem öğrencisi hem grubu dolu" kaydı FİZİKSEL OLARAK yazılamaz.
    let err = must_fail(
        &conn,
        "INSERT INTO session (study_group_id, student_id, subject_id, starts_at, ends_at) \
         VALUES (?1, ?2, ?3, '2026-03-06 16:00', '2026-03-06 17:00')",
        &[&group_id, &student_id, &subject_id],
    );
    assert!(err.contains("CHECK constraint failed"), "gelen: {err}");

    // İkisi de boş olan da yazılamaz.
    let err = must_fail(
        &conn,
        "INSERT INTO session (subject_id, starts_at, ends_at) \
         VALUES (?1, '2026-03-06 16:00', '2026-03-06 17:00')",
        &[&subject_id],
    );
    assert!(err.contains("CHECK constraint failed"), "gelen: {err}");
}

#[test]
fn ayni_yoklamadan_iki_kez_paket_hakki_dusulemez() {
    let conn = conn();
    let student_id = student(&conn, "Mustafa Çelik");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 8,
            unit_price: 25000,
            total_price: 200000,
            sold_on: "2026-03-01".into(),
            valid_until: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    let subject_id = subject(&conn, "Matematik");
    let session_id = repo::academic::insert_session(
        &conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: "2026-03-02 18:00".into(),
            ends_at: "2026-03-02 19:00".into(),
            session_date: None,
            kind: None,
            status: "planned".into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: None,
            attendance_taken_at: None,
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let attendance_id = repo::academic::insert_attendance(
        &conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: "present".into(),
            marked_at: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    let usage = || PackageUsage {
        id: None,
        package_id,
        attendance_id: Some(attendance_id),
        used_on: "2026-03-02".into(),
        delta: -1,
        reason: "attendance".into(),
        reverses_id: None,
        memo: None,
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };

    repo::finance::insert_package_usage(&conn, &usage()).expect("ilk düşüm geçmeli");

    // `ux_pkgusage_head` (ADR-036, eskiden `ux_pkgusage_att`): sessizce iki ders
    // düşmez. Yeni indeks eskisinden GENİŞ koruyor — düzeltme zincirinin her
    // derinliğinde, yalnızca derinlik 1'de değil (`tests/package_usage_chain.rs`).
    let err = repo::finance::insert_package_usage(&conn, &usage()).unwrap_err();
    assert_eq!(err.code, "lesson_already_consumed");

    assert_eq!(
        repo::views::package_remaining(&conn, package_id)
            .unwrap()
            .unwrap()
            .remaining,
        7
    );
}

// ---------------------------------------------------------------------------
// INSERT OR REPLACE — mührün en sinsi kaçış yolu
//
// `REPLACE`, çakışan satırı ÖRTÜK bir DELETE ile siler. `recursive_triggers`
// kapalıyken bu örtük DELETE, delete tetikleyicilerini hiç çalıştırmaz; yani
// trg_ledger_no_delete / trg_payment_no_delete bu yolda ateşlenmez ve para kaydı
// izsiz yok olur. db::apply_pragmas bu yüzden `PRAGMA recursive_triggers = ON`
// uyguluyor. Aşağıdaki üç test o pragma'nın regresyon korumasıdır — pragma
// kaldırılırsa üçü birden düşer.
// ---------------------------------------------------------------------------

#[test]
fn pragma_recursive_triggers_acik() {
    let conn = conn();
    let value: i64 = conn
        .query_row("PRAGMA recursive_triggers", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        value, 1,
        "recursive_triggers KAPALI — defter mührü REPLACE ile aşılabilir"
    );
}

#[test]
fn insert_or_replace_defter_satirini_ayni_id_ile_ezemez() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);

    let err = must_fail(
        &conn,
        "INSERT OR REPLACE INTO ledger_entry (id, student_id, entry_date, kind, amount, memo) \
         VALUES (?1, ?2, '2026-03-02', 'adjustment', -1, 'SAHTE')",
        &[&entry, &id],
    );
    assert!(err.contains("ledger_entry_is_immutable"), "gelen: {err}");

    // Satır olduğu gibi durmalı.
    let row: LedgerEntry = repo::require(&conn, entry).unwrap();
    assert_eq!(row.amount, -25000);
    assert_eq!(row.kind, "session_charge");
}

#[test]
fn insert_or_replace_kismi_indeks_uzerinden_para_kaydini_silemez() {
    let conn = conn();
    let id = student(&conn, "Ayşe Demir");

    // Gerçek bir tahsilat ve onun defter karşılığı.
    let payment_id = repo::finance::insert_payment(
        &conn,
        &Payment {
            id: None,
            student_id: id,
            paid_on: "2026-03-15".into(),
            amount: 60000,
            method: "cash".into(),
            receipt_no: Some("2026-1".into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let entry = repo::finance::insert_ledger_entry(
        &conn,
        &LedgerEntry {
            id: None,
            student_id: id,
            entry_date: "2026-03-15".into(),
            kind: "payment".into(),
            amount: 60000,
            attendance_id: None,
            installment_id: None,
            payment_id: Some(payment_id),
            reverses_id: None,
            memo: Some("gerçek".into()),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    // Sinsi olan bu: FARKLI bir id, ama ux_ledger_payment çakışıyor. Geliştirici
    // "yeni satır ekliyorum" sanır; REPLACE mevcut 600 ₺'yi sessizce silerdi.
    let err = must_fail(
        &conn,
        "INSERT OR REPLACE INTO ledger_entry \
             (student_id, entry_date, kind, amount, payment_id, memo) \
         VALUES (?1, '2026-03-15', 'payment', 1, ?2, 'yerine geçen')",
        &[&id, &payment_id],
    );
    assert!(err.contains("ledger_entry_is_immutable"), "gelen: {err}");

    let row: LedgerEntry = repo::require(&conn, entry).unwrap();
    assert_eq!(row.amount, 60000, "600 ₺ yerinde durmalı");
    assert_eq!(
        repo::views::student_balance(&conn, id)
            .unwrap()
            .unwrap()
            .balance_kurus,
        60000
    );
}

#[test]
fn insert_or_replace_tahsilati_ezemez() {
    let conn = conn();
    let a = student(&conn, "Ayşe Demir");
    let b = student(&conn, "Mehmet Aslan");
    let payment_id = a_payment(&conn, a, "2026-1");

    // trg_payment_immutable'ın mühürlediği üç alanın üçünü birden değiştirme denemesi.
    let err = must_fail(
        &conn,
        "INSERT OR REPLACE INTO payment (id, student_id, paid_on, amount, method, receipt_no) \
         VALUES (?1, ?2, '2020-01-01', 1, 'cash', 'R-1')",
        &[&payment_id, &b],
    );
    assert!(err.contains("payment_is_immutable"), "gelen: {err}");

    let row: Payment = repo::require(&conn, payment_id).unwrap();
    assert_eq!(row.student_id, a);
    assert_eq!(row.amount, 60000);
    assert_eq!(row.paid_on, "2026-03-15");
}
