mod common;

use kurs_takip_lib::model::{Attendance, PriceRule, Session};
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::finance::{
    InstallmentInput, PackageCloseMode, PackageSaleInput, PriceRuleInput,
};

fn rule_input(subject_id: i64, unit_price: i64, valid_from: &str) -> PriceRuleInput {
    PriceRuleInput {
        replaces_id: None,
        name: "Matematik birebir".into(),
        pricing_model: "per_session".into(),
        subject_id: Some(subject_id),
        is_group: Some(false),
        unit_price,
        lesson_count: None,
        total_price: None,
        period_months: None,
        default_installments: 1,
        valid_from: valid_from.into(),
    }
}

fn sale_input(student_id: i64) -> PackageSaleInput {
    PackageSaleInput {
        student_id,
        enrollment_id: None,
        price_rule_id: None,
        lesson_count: 8,
        unit_price: 25_000,
        total_price: 200_000,
        sold_on: "2026-03-01".into(),
        installments: vec![
            InstallmentInput {
                due_on: "2026-03-01".into(),
                amount: 100_000,
                label: Some("1. taksit".into()),
            },
            InstallmentInput {
                due_on: "2026-04-01".into(),
                amount: 100_000,
                label: Some("2. taksit".into()),
            },
        ],
    }
}

fn balance(conn: &rusqlite::Connection, student_id: i64) -> i64 {
    repo::views::student_balance(conn, student_id)
        .unwrap()
        .unwrap()
        .balance_kurus
}

fn solo_attendance(
    conn: &rusqlite::Connection,
    student_id: i64,
    subject_id: i64,
    day: &str,
    status: &str,
    unit_price: Option<i64>,
    is_makeup: bool,
) -> (i64, i64) {
    let session_id = repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: format!("{day} 16:00"),
            ends_at: format!("{day} 17:00"),
            session_date: None,
            kind: None,
            status: "done".into(),
            is_makeup,
            makeup_for_attendance_id: None,
            unit_price,
            attendance_taken_at: Some(format!("{day} 17:01")),
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let attendance_id = repo::academic::insert_attendance(
        conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: status.into(),
            marked_at: Some(format!("{day} 17:01")),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    (session_id, attendance_id)
}

#[test]
fn fiyat_degisimi_eski_satiri_kapatir_gecmis_fiyati_degistirmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let first =
        repo::finance::save_price_rule(&conn, &rule_input(subject_id, 25_000, "2026-01-01"))
            .unwrap();

    let mut changed = rule_input(subject_id, 30_000, "2026-08-01");
    changed.replaces_id = Some(first);
    let second = repo::finance::save_price_rule(&conn, &changed).unwrap();

    let old: PriceRule = repo::require(&conn, first).unwrap();
    let new: PriceRule = repo::require(&conn, second).unwrap();
    assert_eq!(old.valid_to.as_deref(), Some("2026-07-31"));
    assert_eq!(new.valid_to, None);
    assert_eq!(
        repo::finance::resolve_tariff_unit_price(&conn, subject_id, false, "2026-07-15").unwrap(),
        25_000
    );
    assert_eq!(
        repo::finance::resolve_tariff_unit_price(&conn, subject_id, false, "2026-08-15").unwrap(),
        30_000
    );
}

#[test]
fn fiyat_cozumu_brans_ve_ders_turu_ozel_satiri_secer() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Fizik");
    let mut general = rule_input(subject_id, 10_000, "2026-01-01");
    general.subject_id = None;
    general.is_group = None;
    repo::finance::save_price_rule(&conn, &general).unwrap();

    let mut group = rule_input(subject_id, 15_000, "2026-01-01");
    group.is_group = Some(true);
    repo::finance::save_price_rule(&conn, &group).unwrap();

    assert_eq!(
        repo::finance::resolve_tariff_unit_price(&conn, subject_id, true, "2026-03-01").unwrap(),
        15_000
    );
    assert_eq!(
        repo::finance::resolve_tariff_unit_price(&conn, subject_id, false, "2026-03-01").unwrap(),
        10_000
    );
}

#[test]
fn tarife_bulunamazsa_sifir_yazmak_yerine_eylem_onerir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let error = repo::finance::resolve_tariff_unit_price(&conn, subject_id, false, "2026-03-01")
        .unwrap_err();
    assert_eq!(error.code, "price_rule_not_found");
    assert!(error.message.contains("Tarifeler"));
}

#[test]
fn gecersiz_para_ve_paket_tarifesi_reddedilir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Türkçe");
    let negative = rule_input(subject_id, -1, "2026-01-01");
    assert_eq!(
        repo::finance::save_price_rule(&conn, &negative)
            .unwrap_err()
            .code,
        "priceRule.unitPrice"
    );

    let mut package = rule_input(subject_id, 20_000, "2026-01-01");
    package.pricing_model = "package".into();
    assert_eq!(
        repo::finance::save_price_rule(&conn, &package)
            .unwrap_err()
            .code,
        "priceRule.package"
    );
}

#[test]
fn paket_satisi_paket_ve_zorunlu_taksitleri_yazar_deftere_yazmaz() {
    let conn = common::conn();
    let student_id = common::student(&conn, "Paket Öğrencisi");
    let package_id = repo::finance::sell_package(&conn, &sale_input(student_id)).unwrap();

    let package: kurs_takip_lib::model::Package = repo::require(&conn, package_id).unwrap();
    assert_eq!(package.valid_until, None);
    assert_eq!(package.unit_price, 25_000);
    assert_eq!(
        repo::count_live::<kurs_takip_lib::model::Installment>(&conn).unwrap(),
        2
    );
    assert_eq!(
        repo::count_live::<kurs_takip_lib::model::LedgerEntry>(&conn).unwrap(),
        0
    );
}

#[test]
fn taksit_plani_yoksa_veya_toplami_pakete_esit_degilse_satis_geri_alinir() {
    let conn = common::conn();
    let student_id = common::student(&conn, "Plansız Öğrenci");
    let mut input = sale_input(student_id);
    input.installments.clear();
    assert_eq!(
        repo::finance::sell_package(&conn, &input).unwrap_err().code,
        "package.installments"
    );
    assert_eq!(
        repo::count_live::<kurs_takip_lib::model::Package>(&conn).unwrap(),
        0
    );

    let mut input = sale_input(student_id);
    input.installments[1].amount = 99_999;
    assert_eq!(
        repo::finance::sell_package(&conn, &input).unwrap_err().code,
        "package.installmentTotal"
    );
    assert_eq!(
        repo::count_live::<kurs_takip_lib::model::Package>(&conn).unwrap(),
        0
    );
}

#[test]
fn paket_kapatma_avansi_unit_price_snapshotundan_yazar_ve_hakki_sifirlar() {
    let conn = common::conn();
    let student_id = common::student(&conn, "Avans Öğrencisi");
    let package_id = repo::finance::sell_package(&conn, &sale_input(student_id)).unwrap();
    for _ in 0..3 {
        common::consume(&conn, package_id, None, "2026-03-10");
    }

    let report = repo::finance::close_package(
        &conn,
        package_id,
        "2026-03-20",
        PackageCloseMode::LeaveCredit,
    )
    .unwrap();
    assert_eq!(report.remaining_lessons, 5);
    assert_eq!(report.unused_kurus, 125_000);
    assert!(report.credit_entry_id.is_some());
    assert_eq!(report.refund_entry_id, None);
    assert_eq!(balance(&conn, student_id), 125_000);

    let usage_sum: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(delta), 0) FROM package_usage WHERE package_id = ?1",
            [package_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(8 + usage_sum, 0);
    let package: kurs_takip_lib::model::Package = repo::require(&conn, package_id).unwrap();
    assert_eq!(package.status, "cancelled");
    assert_eq!(
        repo::count_live::<kurs_takip_lib::model::Installment>(&conn).unwrap(),
        0
    );
}

#[test]
fn paket_kapatma_iade_dalinda_avansi_nakit_cikisiyla_kapatir() {
    let conn = common::conn();
    let student_id = common::student(&conn, "İade Öğrencisi");
    let package_id = repo::finance::sell_package(&conn, &sale_input(student_id)).unwrap();
    for _ in 0..3 {
        common::consume(&conn, package_id, None, "2026-03-10");
    }

    let report =
        repo::finance::close_package(&conn, package_id, "2026-03-20", PackageCloseMode::Refund)
            .unwrap();
    assert_eq!(report.unused_kurus, 125_000);
    assert!(report.credit_entry_id.is_some());
    assert!(report.refund_entry_id.is_some());
    assert_eq!(balance(&conn, student_id), 0);

    let memos: Vec<String> = repo::finance::ledger_of(&conn, student_id)
        .unwrap()
        .into_iter()
        .filter_map(|entry| entry.memo)
        .collect();
    assert_eq!(memos, vec!["Kullanılmayan paket hakkı", "İade"]);
}

#[test]
fn vadesi_gelen_taksit_bir_kez_tahakkuk_eder_gelecek_vade_bekler() {
    let conn = common::conn();
    let student_id = common::student(&conn, "Taksit Öğrencisi");
    repo::finance::sell_package(&conn, &sale_input(student_id)).unwrap();

    assert_eq!(
        repo::finance::accrue_due_installments(&conn, "2026-03-31").unwrap(),
        1
    );
    assert_eq!(balance(&conn, student_id), -100_000);
    assert_eq!(
        repo::finance::accrue_due_installments(&conn, "2026-03-31").unwrap(),
        0,
        "ikinci açılış aynı taksidi yeniden yazmamalı"
    );
    let future: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM installment WHERE accrued_entry_id IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(future, 1);
    common::assert_ledger_invariant(&conn);
}

#[test]
fn yoklama_fiyati_once_kayit_snapshotundan_sonra_seanstan_cozulur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Geometri");
    let enrolled = common::student(&conn, "Kayıtlı Öğrenci");
    common::enrollment(&conn, enrolled, None, subject_id, "2026-01-01", None).unwrap();
    let (_, enrolled_attendance) = solo_attendance(
        &conn,
        enrolled,
        subject_id,
        "2026-03-10",
        "present",
        Some(40_000),
        false,
    );
    assert_eq!(
        repo::finance::resolve_unit_price(&conn, enrolled_attendance).unwrap(),
        25_000
    );

    let one_off = common::student(&conn, "Tek Sefer Öğrencisi");
    let (_, one_off_attendance) = solo_attendance(
        &conn,
        one_off,
        subject_id,
        "2026-03-11",
        "present",
        Some(40_000),
        false,
    );
    assert_eq!(
        repo::finance::resolve_unit_price(&conn, one_off_attendance).unwrap(),
        40_000
    );

    let missing = common::student(&conn, "Tarifesiz Öğrenci");
    let (_, missing_attendance) = solo_attendance(
        &conn,
        missing,
        subject_id,
        "2026-03-12",
        "present",
        None,
        false,
    );
    assert_eq!(
        repo::finance::resolve_unit_price(&conn, missing_attendance)
            .unwrap_err()
            .code,
        "price_not_found"
    );
}

#[test]
fn birden_fazla_gecerli_kayit_fiyat_cozumunu_durdurur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Fizik");
    let student_id = common::student(&conn, "Çakışan Kayıt");
    common::enrollment(&conn, student_id, None, subject_id, "2026-01-01", None).unwrap();
    conn.execute(
        "INSERT INTO enrollment \
         (student_id, subject_id, teacher_id, pricing_model, unit_price, start_on, status) \
         VALUES (?1, ?2, 1, 'per_session', 30000, '2026-02-01', 'active')",
        [student_id, subject_id],
    )
    .unwrap();
    let (_, attendance_id) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-10",
        "present",
        None,
        false,
    );

    assert_eq!(
        repo::finance::resolve_unit_price(&conn, attendance_id)
            .unwrap_err()
            .code,
        "ambiguous_enrollment"
    );
}

#[test]
fn ders_ucreti_idempotenttir_ve_duzeltme_ters_kayit_zinciriyle_yurur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Ders Başı Öğrenci");
    common::enrollment(&conn, student_id, None, subject_id, "2026-01-01", None).unwrap();
    let (_, attendance_id) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-10",
        "present",
        None,
        false,
    );

    repo::finance::charge_session(&conn, attendance_id).unwrap();
    repo::finance::charge_session(&conn, attendance_id).unwrap();
    assert_eq!(balance(&conn, student_id), -25_000);
    repo::finance::reverse_session_charge(&conn, attendance_id, "2026-03-11").unwrap();
    assert_eq!(balance(&conn, student_id), 0);
    repo::finance::charge_session(&conn, attendance_id).unwrap();
    assert_eq!(balance(&conn, student_id), -25_000);
    let rows: i64 = conn
        .query_row("SELECT COUNT(*) FROM ledger_entry", [], |row| row.get(0))
        .unwrap();
    assert_eq!(rows, 3);
    common::assert_ledger_invariant(&conn);
}

#[test]
fn mazeretli_ve_telafi_dersi_ikinci_borc_yazmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let student_id = common::student(&conn, "Mazeretli Öğrenci");
    let (_, excused) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-10",
        "excused",
        Some(20_000),
        false,
    );
    let (_, makeup) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-11",
        "present",
        Some(20_000),
        true,
    );

    assert_eq!(repo::finance::charge_session(&conn, excused).unwrap(), None);
    assert_eq!(repo::finance::charge_session(&conn, makeup).unwrap(), None);
    let rows: i64 = conn
        .query_row("SELECT COUNT(*) FROM ledger_entry", [], |row| row.get(0))
        .unwrap();
    assert_eq!(rows, 0);
}

#[test]
fn seans_iptali_ders_ucretini_ve_yoklamayi_bir_kez_tersine_cevirir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Türkçe");
    let student_id = common::student(&conn, "İptal Öğrencisi");
    common::enrollment(&conn, student_id, None, subject_id, "2026-01-01", None).unwrap();
    let (session_id, attendance_id) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-10",
        "present",
        None,
        false,
    );
    repo::finance::charge_session(&conn, attendance_id).unwrap();

    repo::schedule::cancel_session(&conn, session_id, Some("Kurs iptali")).unwrap();
    repo::schedule::cancel_session(&conn, session_id, Some("Kurs iptali")).unwrap();
    assert_eq!(balance(&conn, student_id), 0);
    let (status, rows): (String, i64) = conn
        .query_row(
            "SELECT a.status, (SELECT COUNT(*) FROM ledger_entry) \
             FROM attendance a WHERE a.id = ?1",
            [attendance_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(status, "cancelled");
    assert_eq!(rows, 2);
    common::assert_ledger_invariant(&conn);
}

#[test]
fn seans_iptali_paket_hakkini_bir_kez_geri_verir_deftere_dokunmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Biyoloji");
    let student_id = common::student(&conn, "Paket İptal Öğrencisi");
    let package_id = common::package(&conn, student_id);
    let (session_id, attendance_id) = solo_attendance(
        &conn,
        student_id,
        subject_id,
        "2026-03-10",
        "present",
        None,
        false,
    );
    repo::finance::consume_package_credit(&conn, attendance_id, common::TODAY).unwrap();
    assert_eq!(common::remaining(&conn, package_id), 7);

    repo::schedule::cancel_session(&conn, session_id, None).unwrap();
    repo::schedule::cancel_session(&conn, session_id, None).unwrap();
    assert_eq!(common::remaining(&conn, package_id), 8);
    let ledger_rows: i64 = conn
        .query_row("SELECT COUNT(*) FROM ledger_entry", [], |row| row.get(0))
        .unwrap();
    assert_eq!(ledger_rows, 0);
}
