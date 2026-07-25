//! Seed'in ürettiği veri, faz-02 §6'nın söz verdiği kenar durumları gerçekten içeriyor mu.
//!
//! Bu testler seed'i bir "demo verisi" olarak değil, **sonraki fazların fikstürü** olarak
//! sınıyor: Faz 6–9 bu senaryolarla çalışacak, o yüzden bozulduklarında burada görülmeli.
//!
//! `seed` özelliği kapalıyken bu dosya hiç derlenmez.

#![cfg(feature = "seed")]

mod common;

use chrono::NaiveDate;
use kurs_takip_lib::model::*;
use kurs_takip_lib::{db, repo, seed};

fn seeded() -> (rusqlite::Connection, NaiveDate) {
    let conn = db::open_in_memory_migrated().unwrap();
    let today = NaiveDate::parse_from_str(common::TODAY, "%Y-%m-%d").unwrap();
    seed::load(&conn, today).expect("seed yüklenmeli");
    (conn, today)
}

#[test]
fn seed_uygulanir_ve_beklenen_hacmi_uretir() {
    let (conn, _) = seeded();

    // 12 öğrenci — biri arşivli, dolayısıyla canlı 11.
    assert_eq!(repo::list_live::<Student>(&conn).unwrap().len(), 11);
    assert_eq!(repo::list_archived::<Student>(&conn).unwrap().len(), 1);
    assert_eq!(repo::list_all::<Student>(&conn).unwrap().len(), 12);

    assert_eq!(
        repo::list_live::<Subject>(&conn).unwrap().len(),
        3,
        "3 branş"
    );
    assert_eq!(
        repo::list_live::<StudyGroup>(&conn).unwrap().len(),
        2,
        "2 grup"
    );

    assert!(
        repo::count_live::<Session>(&conn).unwrap() > 20,
        "bir aylık geçmiş + iki haftalık gelecek seans üretilmeli"
    );
    assert!(repo::count_live::<LedgerEntry>(&conn).unwrap() > 0);
}

#[test]
fn seed_gecmis_ve_gelecek_seans_uretir() {
    let (conn, today) = seeded();
    let today_str = today.format("%Y-%m-%d").to_string();

    let past: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session WHERE session_date < ?1 AND deleted_at IS NULL",
            [&today_str],
            |r| r.get(0),
        )
        .unwrap();
    let future: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session WHERE session_date > ?1 AND deleted_at IS NULL",
            [&today_str],
            |r| r.get(0),
        )
        .unwrap();

    assert!(past > 0, "geçmiş seans olmalı");
    assert!(future > 0, "gelecek seans olmalı");

    // Geçmiş seansların yoklaması alınmış, gelecektekilerin alınmamış olmalı.
    let pending_past: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session \
             WHERE session_date < ?1 AND attendance_taken_at IS NULL AND deleted_at IS NULL",
            [&today_str],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        pending_past, 0,
        "geçmiş seansların yoklaması alınmış olmalı"
    );
}

#[test]
fn seed_kapali_gune_seans_uretmez() {
    let (conn, _) = seeded();
    let leaked: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session s \
             JOIN closed_day c ON c.day = s.session_date AND c.deleted_at IS NULL \
             WHERE s.deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(leaked, 0, "tatil gününe ders üretilmemeli");

    // Haftalık kapalı gün (Pazar) da boş olmalı.
    let sundays: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session \
             WHERE deleted_at IS NULL AND strftime('%w', session_date) = '0'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(sundays, 0, "Pazar günü ders üretilmemeli");
}

#[test]
fn seed_bir_borclu_ve_bir_alacakli_icerir() {
    let (conn, _) = seeded();

    // Mehmet Aslan (3): ders başı, hiç ödemeyen → borçlu listesinde ÇIKMALI (ADR-018).
    let debt = repo::views::student_debt(&conn, 3).unwrap();
    assert!(debt.is_some(), "ders başı ödeyen borçlu listede olmalı");
    assert!(debt.unwrap().debt_kurus > 0);

    // Ayşe Demir (6): avanslı → borçlu listesinde ÇIKMAMALI.
    assert!(
        repo::views::student_debt(&conn, 6).unwrap().is_none(),
        "avanslı öğrenci borçlu görünmemeli"
    );
    assert_eq!(
        repo::views::student_balance(&conn, 6)
            .unwrap()
            .unwrap()
            .balance_kurus,
        40000,
        "avans bakiyeyi pozitife çekmeli"
    );

    // Mustafa Çelik (7): taksidini YARIM ödedi → hâlâ borçlu, ama tamamı değil.
    // Mutlak kuruş beklenmiyor: seans üretimi gerçek tarihe bağlı, senaryo değil.
    let mustafa = repo::views::student_balance(&conn, 7)
        .unwrap()
        .unwrap()
        .balance_kurus;
    assert!(
        mustafa < 0,
        "kısmi ödeme sonrası borç kalmalı, bakiye: {mustafa}"
    );
    let odenen: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount),0) FROM ledger_entry WHERE student_id = 7 AND kind = 'payment'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(odenen > 0, "kısmi de olsa bir tahsilat olmalı");
    assert!(
        odenen < -mustafa + odenen,
        "tahsilat borcun TAMAMI olmamalı — senaryo 'kısmi ödeme'"
    );
}

#[test]
fn seed_arsivli_ama_borclu_ogrenci_icerir() {
    let (conn, _) = seeded();

    // Selin Aksoy (12): arşivli, borcu duruyor.
    let balance = repo::views::student_balance(&conn, 12).unwrap().unwrap();
    assert!(!balance.is_live, "arşivli olmalı");
    assert!(
        balance.balance_kurus < 0,
        "arşivlense de borçlu kalmalı, bakiye: {}",
        balance.balance_kurus
    );

    let debt = repo::views::student_debt(&conn, 12).unwrap();
    assert!(debt.is_some(), "arşivli borçlu listeden kaybolmamalı");
    // Borç, bakiyenin negatif kısmının tam karşılığı olmalı — iki view çelişmemeli.
    assert_eq!(debt.unwrap().debt_kurus, -balance.balance_kurus);
}

#[test]
fn seed_ters_kaydedilmis_bir_ders_icerir() {
    let (conn, _) = seeded();

    let reversals: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ledger_entry WHERE kind = 'reversal'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(reversals, 1, "tam olarak bir ters kayıt olmalı");

    // Ters kaydedilmiş satır da, ters kaydın kendisi de v_ledger_effective'te olmamalı.
    let effective_reversals: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM v_ledger_effective WHERE kind = 'reversal'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(effective_reversals, 0);
}

#[test]
fn seed_iki_aktif_paketi_olan_ogrenci_icerir() {
    let (conn, _) = seeded();

    // Zeynep Kaya (4): iki aktif paket → consume_package en eskisini seçmeli (Faz 7).
    let active = repo::views::active_packages(&conn, 4, common::TODAY).unwrap();
    assert_eq!(active.len(), 2, "iki aktif paket olmalı");

    // Sıralama satış tarihine göre: en eski önce.
    let first: Package = repo::require(&conn, active[0].package_id).unwrap();
    let second: Package = repo::require(&conn, active[1].package_id).unwrap();
    assert!(
        first.sold_on <= second.sold_on,
        "en eski paket önce gelmeli"
    );
}

#[test]
fn seed_kardes_ve_cift_velili_ogrenci_icerir() {
    let (conn, _) = seeded();

    // Elif (1) ve Emre (2) kardeş — velileri ortak.
    let elif = repo::people::guardians_of(&conn, 1).unwrap();
    let emre = repo::people::guardians_of(&conn, 2).unwrap();
    assert_eq!(elif.len(), 2, "Elif'in iki velisi olmalı");
    assert_eq!(emre.len(), 1);
    assert_eq!(
        elif[0].id, emre[0].id,
        "kardeşlerin birincil velisi aynı kişi olmalı"
    );
}

#[test]
fn seed_paketli_ogrencide_deftere_ders_borcu_yazmaz() {
    let (conn, _) = seeded();

    // ADR-015: paketli öğrencide ders işlemek deftere HİÇBİR satır yazmaz.
    // Ahmet Şahin (5) paketli — session_charge satırı olmamalı.
    let charges: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ledger_entry WHERE student_id = 5 AND kind = 'session_charge'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(charges, 0, "paketli öğrenciye ders başı borç yazılmamalı");

    // Buna karşılık paket hakkı düşmüş olmalı.
    let used: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM package_usage u \
             JOIN package p ON p.id = u.package_id \
             WHERE p.student_id = 5 AND u.delta = -1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(used > 0, "paket hakkı düşmüş olmalı");
}

#[test]
fn seed_mazeretli_devamsizlikta_borc_yazmaz() {
    let (conn, _) = seeded();

    // ADR-016: mazeretli → hak düşmez, borç yazılmaz.
    let excused_charges: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ledger_entry l \
             JOIN attendance a ON a.id = l.attendance_id \
             WHERE a.status = 'excused'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(excused_charges, 0);

    let excused_usage: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM package_usage u \
             JOIN attendance a ON a.id = u.attendance_id \
             WHERE a.status = 'excused'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(excused_usage, 0);

    // Ama mazeretli yoklama gerçekten üretilmiş olmalı, yoksa test boşa geçer.
    let excused: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM attendance WHERE status = 'excused'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(excused > 0, "seed mazeretli yoklama da üretmeli");
}

#[test]
fn seed_yalnizca_vadesi_gelen_taksidi_deftere_yazar() {
    let (conn, _) = seeded();

    // Burak Çınar (11): 4 taksit, yalnızca ilkinin vadesi geçmiş (ADR-015).
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM installment WHERE student_id = 11",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total, 4);

    let accrued: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM installment WHERE student_id = 11 AND accrued_entry_id IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(accrued, 1, "yalnızca vadesi gelen taksit deftere yazılmalı");
}

#[test]
fn seed_iki_kez_calistirilmaz() {
    let (conn, today) = seeded();
    // Aynı id'lerle ikinci yükleme tekillik ihlaline çarpar ve transaction geri alınır.
    assert!(seed::load(&conn, today).is_err());
    // Geri alma çalıştıysa öğrenci sayısı değişmemiş olmalı.
    assert_eq!(repo::list_all::<Student>(&conn).unwrap().len(), 12);
}
