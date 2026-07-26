mod common;

use kurs_takip_lib::model::PriceRule;
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::finance::PriceRuleInput;

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
        repo::finance::resolve_unit_price(&conn, subject_id, false, "2026-07-15").unwrap(),
        25_000
    );
    assert_eq!(
        repo::finance::resolve_unit_price(&conn, subject_id, false, "2026-08-15").unwrap(),
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
        repo::finance::resolve_unit_price(&conn, subject_id, true, "2026-03-01").unwrap(),
        15_000
    );
    assert_eq!(
        repo::finance::resolve_unit_price(&conn, subject_id, false, "2026-03-01").unwrap(),
        10_000
    );
}

#[test]
fn tarife_bulunamazsa_sifir_yazmak_yerine_eylem_onerir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let error =
        repo::finance::resolve_unit_price(&conn, subject_id, false, "2026-03-01").unwrap_err();
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
