//! faz-02 §5 — `§1.23` view zinciri (ADR-018).
//!
//! Bu testler Faz 8'i değil **Faz 2'yi** bağlar: borçlu listesi şemanın çıktısıdır,
//! ekranın değil. Faz 1 denetiminin en ağır bulgusu buradaydı — eski `v_student_overdue`
//! yalnızca `installment`'tan besleniyordu, ders başı ödeyen öğrencinin borcu ise
//! `ledger_entry`'de doğuyor. Aylardır ödemeyen öğrenci borçlu listesinde hiç
//! görünmüyordu; PRD'nin dört ana sorusundan biri yanlış cevaplanıyordu.

mod common;

use chrono::NaiveDate;
use common::*;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;

fn debt_of(conn: &rusqlite::Connection, student_id: i64) -> i64 {
    repo::views::student_debt(conn, student_id)
        .unwrap()
        .map(|d| d.debt_kurus)
        .unwrap_or(0)
}

#[test]
fn ders_basi_borclu_listede_cikar() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    // Hiç `installment` satırı yok — borç yalnızca defterde.
    ledger(&conn, id, "2026-03-02", "session_charge", -25000);
    ledger(&conn, id, "2026-03-09", "session_charge", -25000);

    assert_eq!(
        debt_of(&conn, id),
        50000,
        "ders başı borç listede çıkmalı (ADR-018)"
    );

    let debtors = repo::views::student_debts(&conn).unwrap();
    assert_eq!(debtors.len(), 1);
    assert_eq!(debtors[0].student_id, id);
    assert_eq!(debtors[0].oldest_due_on.as_deref(), Some("2026-03-02"));
}

#[test]
fn avansli_ogrenci_borclu_gorunmez() {
    let conn = conn();
    let id = student(&conn, "Ayşe Demir");
    ledger(&conn, id, "2026-03-02", "session_charge", -25000);
    ledger(&conn, id, "2026-03-03", "payment", 40000);

    // Mahsup edilmemiş fazla ödeme bakiyeyi pozitife çeker; view de borç göstermemeli.
    assert_eq!(debt_of(&conn, id), 0);
    assert_eq!(
        repo::views::student_balance(&conn, id)
            .unwrap()
            .unwrap()
            .balance_kurus,
        15000
    );
    assert!(repo::views::student_debts(&conn).unwrap().is_empty());
}

#[test]
fn ters_kaydedilmis_borc_cikmaz() {
    let conn = conn();
    let id = student(&conn, "Fatma Öztürk");
    let entry = ledger(&conn, id, "2026-03-02", "session_charge", -25000);
    repo::finance::insert_reversal(&conn, entry, "2026-03-03", Some("sehven işlenmiş")).unwrap();

    // v_ledger_effective hem orijinali hem ters kaydı eler.
    assert_eq!(debt_of(&conn, id), 0);
    assert_eq!(
        repo::views::student_balance(&conn, id)
            .unwrap()
            .unwrap()
            .balance_kurus,
        0,
        "ters kayıt bakiyeyi de sıfırlamalı"
    );
}

#[test]
fn arsivlenmis_borclu_listeden_kaybolmaz() {
    let conn = conn();
    let id = student(&conn, "Selin Aksoy");
    ledger(&conn, id, "2026-03-02", "session_charge", -60000);
    repo::archive::<Student>(&conn, id).unwrap();

    // ADR-005'in gerekçesi: borç arşivlemekle yok olmaz.
    assert_eq!(debt_of(&conn, id), 60000);
    let balance = repo::views::student_balance(&conn, id).unwrap().unwrap();
    assert!(!balance.is_live);
    assert_eq!(balance.balance_kurus, -60000);
}

#[test]
fn fifo_vade_en_eski_kapanmamis_borcun_gunudur() {
    let conn = conn();
    let id = student(&conn, "Mustafa Çelik");

    // 4 × 250 ₺ borç + 600 ₺ ödeme → borç 400 ₺, en eski vade 3. dersin günü.
    for day in ["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"] {
        ledger(&conn, id, day, "session_charge", -25000);
    }
    ledger(&conn, id, "2026-03-15", "payment", 60000);

    let debt = repo::views::student_debt(&conn, id).unwrap().unwrap();
    assert_eq!(debt.debt_kurus, 40000, "400 ₺ borç kalmalı");
    assert_eq!(
        debt.oldest_due_on.as_deref(),
        Some("2026-03-16"),
        "600 ₺ ilk iki dersi kapatır; en eski AÇIK borç 3. ders"
    );
}

#[test]
fn taksit_borcunda_vade_tahakkuk_gununden_degil_due_on_dan_gelir() {
    let conn = conn();
    let id = student(&conn, "Burak Çınar");

    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
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

    let installment_id = repo::finance::insert_installment(
        &conn,
        &Installment {
            id: None,
            student_id: id,
            package_id: Some(package_id),
            enrollment_id: None,
            seq: 1,
            due_on: "2026-03-01".into(),
            amount: 100000,
            label: Some("1. taksit".into()),
            accrued_entry_id: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    // Uygulama 5 gün geç açıldı: entry_date 03-06, ama vade 03-01.
    let entry_id = repo::finance::insert_ledger_entry(
        &conn,
        &LedgerEntry {
            id: None,
            student_id: id,
            entry_date: "2026-03-06".into(),
            kind: "installment_charge".into(),
            amount: -100000,
            attendance_id: None,
            installment_id: Some(installment_id),
            payment_id: None,
            reverses_id: None,
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    repo::finance::mark_installment_accrued(&conn, installment_id, entry_id).unwrap();

    let debt = repo::views::student_debt(&conn, id).unwrap().unwrap();
    assert_eq!(debt.debt_kurus, 100000);
    assert_eq!(
        debt.oldest_due_on.as_deref(),
        Some("2026-03-01"),
        "vade installment.due_on'dan gelmeli — geç açılış vadeyi kaydırmamalı"
    );

    // Aynı taksit iki kez tahakkuk edemez (idempotentliğin şema tarafındaki dayanağı).
    let err = repo::finance::insert_ledger_entry(
        &conn,
        &LedgerEntry {
            id: None,
            student_id: id,
            entry_date: "2026-04-01".into(),
            kind: "installment_charge".into(),
            amount: -100000,
            attendance_id: None,
            installment_id: Some(installment_id),
            payment_id: None,
            reverses_id: None,
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap_err();
    assert_eq!(err.code, "installment_already_accrued");
}

#[test]
fn vadesi_gelmemis_taksit_tahakkuk_listesine_girmez() {
    let conn = conn();
    let id = student(&conn, "Burak Çınar");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
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

    for (seq, due) in [(1, "2026-03-01"), (2, "2026-04-01"), (3, "2026-05-01")] {
        repo::finance::insert_installment(
            &conn,
            &Installment {
                id: None,
                student_id: id,
                package_id: Some(package_id),
                enrollment_id: None,
                seq,
                due_on: due.into(),
                amount: 100000,
                label: None,
                accrued_entry_id: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )
        .unwrap();
    }

    // `today` PARAMETREDİR — date('now') kullanılmaz (§0).
    let due = repo::finance::due_unaccrued_installments(&conn, TODAY).unwrap();
    assert_eq!(
        due.len(),
        1,
        "31 Mart'ta yalnızca 1 Mart vadeli taksit gelmiş olmalı"
    );
    assert_eq!(due[0].due_on, "2026-03-01");
}

#[test]
fn kalan_ders_hakki_status_guncellenmese_de_dogru() {
    let conn = conn();
    let id = student(&conn, "Zeynep Kaya");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 8,
            unit_price: 25000,
            total_price: 200000,
            sold_on: "2026-03-01".into(),
            valid_until: None,
            // 'exhausted'/'expired' YALNIZCA rapor etiketidir; hesap buna dayanmaz (§1.23).
            status: "exhausted".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    for i in 0..3 {
        repo::finance::insert_package_usage(
            &conn,
            &PackageUsage {
                id: None,
                package_id,
                attendance_id: None,
                used_on: format!("2026-03-{:02}", i + 2),
                delta: -1,
                reason: "attendance".into(),
                memo: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )
        .unwrap();
    }

    let remaining = repo::views::package_remaining(&conn, package_id)
        .unwrap()
        .unwrap();
    assert_eq!(
        remaining.remaining, 5,
        "8 − 3 = 5; status 'exhausted' olsa bile"
    );

    // "Aktif paket" bir sorgudur, bir sütun değildir.
    let active = repo::views::active_packages(&conn, id, TODAY).unwrap();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0].package_id, package_id);
}

#[test]
fn iptal_edilen_paket_kalan_hak_hesabina_girmez() {
    let conn = conn();
    let id = student(&conn, "Zeynep Kaya");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 8,
            unit_price: 25000,
            total_price: 200000,
            sold_on: "2026-03-01".into(),
            valid_until: None,
            // 'cancelled' TEK bağlayıcı status — satış iptali bir olaydır, türetilemez.
            status: "cancelled".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    assert!(repo::views::package_remaining(&conn, package_id)
        .unwrap()
        .is_none());
    assert!(repo::views::active_packages(&conn, id, TODAY)
        .unwrap()
        .is_empty());
}

#[test]
fn paket_hakki_iadesi_delta_arti_bir_ile_yazilir() {
    let conn = conn();
    let id = student(&conn, "Ahmet Şahin");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
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

    let usage = |delta: i64, reason: &str, day: &str| PackageUsage {
        id: None,
        package_id,
        attendance_id: None,
        used_on: day.into(),
        delta,
        reason: reason.into(),
        memo: None,
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };

    repo::finance::insert_package_usage(&conn, &usage(-1, "attendance", "2026-03-02")).unwrap();
    // Seans iptal edildi: satır SİLİNMEZ, iade satırı yazılır (§1.12 / §4).
    repo::finance::insert_package_usage(&conn, &usage(1, "cancellation_restore", "2026-03-03"))
        .unwrap();

    assert_eq!(
        repo::views::package_remaining(&conn, package_id)
            .unwrap()
            .unwrap()
            .remaining,
        8
    );
}

#[test]
fn tahsilat_iptalinde_taksit_yeniden_acilir() {
    let conn = conn();
    let id = student(&conn, "Mustafa Çelik");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: id,
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
    let installment_id = repo::finance::insert_installment(
        &conn,
        &Installment {
            id: None,
            student_id: id,
            package_id: Some(package_id),
            enrollment_id: None,
            seq: 1,
            due_on: "2026-03-01".into(),
            amount: 100000,
            label: Some("1. taksit".into()),
            accrued_entry_id: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    let payment_id = repo::finance::insert_payment(
        &conn,
        &Payment {
            id: None,
            student_id: id,
            paid_on: "2026-03-05".into(),
            amount: 100000,
            method: "cash".into(),
            receipt_no: Some("2026-7".into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    repo::finance::insert_payment_allocation(
        &conn,
        &PaymentAllocation {
            id: None,
            payment_id,
            installment_id,
            amount: 100000,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    // Taksit kapandı.
    assert!(repo::views::open_installments(&conn, id)
        .unwrap()
        .is_empty());

    // İptal: mahsuplar arşivlenir, payment.deleted_at DOLMAZ (§4).
    repo::finance::archive_allocations_of_payment(&conn, payment_id).unwrap();

    let open = repo::views::open_installments(&conn, id).unwrap();
    assert_eq!(open.len(), 1, "taksit kendiliğinden yeniden açılmalı");
    assert_eq!(open[0].open_kurus, 100000);

    let payment: Payment = repo::require(&conn, payment_id).unwrap();
    assert!(
        payment.deleted_at.is_none(),
        "makbuz numarası serbest kalmamalı"
    );
}

#[test]
fn gecikme_gun_sayisi_bugunden_hesaplanir() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");
    ledger(&conn, id, "2026-03-08", "session_charge", -25000);

    let debt = repo::views::student_debt(&conn, id).unwrap().unwrap();
    let today = NaiveDate::parse_from_str(TODAY, "%Y-%m-%d").unwrap();
    // Saf tarih farkı — julianday('now') değil (§0).
    assert_eq!(
        repo::views::days_overdue(today, debt.oldest_due_on.as_deref()),
        Some(23)
    );
}

/// ⚠️ AÇIK KARAR — bu test mevcut (çelişkili) davranışı ÇİVİLER, doğrulamaz.
///
/// `VERI-MODELI.md §4` yoklama düzeltmesini "ters kaydın tersi" ile tarif ediyor:
///   1. "Geldi"      → session_charge(−250)
///   2. "Mazeretli"  → reversal(+250, reverses=1)
///   3. Tekrar "Geldi" → reversal(−250, reverses=2)
///
/// Üçüncü adım yazıldığında bakiye doğru (−250: öğrenci borçlu), ama `v_ledger_effective`
/// `kind <> 'reversal'` süzdüğü için 2. ve 3. satırları eler, 1. satırı da "ters kaydedilmiş"
/// sayıp eler — geriye hiçbir borç kalmaz. Sonuç: **Öğrenci detayı −250 ₺ borç gösterirken
/// borçlu listesi o öğrenciyi hiç göstermez.** ADR-018'in ortadan kaldırmak için yazıldığı
/// "aynı öğrenci, iki ekran, iki farklı borç" durumunun aynısı.
///
/// Bu Faz 2 kodunun değil, kilitli şema tasarımının sorunu; düzeltmesi ya `v_ledger_effective`
/// değişikliği (yeni migration) ya da düzeltme zincirinin başka bir mekanizmayla yazılması.
/// Faz 1 zaten bu zincirin `package_usage` yarısını Faz 6'ya devretmişti (`faz-06.md §3b`);
/// defter yarısı da oraya ait. Karar verilince bu test GÜNCELLENMELİ.
///
/// Ayrıntı ve seçenekler: `docs/DURUM.md` → "Faz 2'den çıkan açık karar".
#[test]
fn bilinen_acik_karar_ters_kaydin_tersi_bakiye_ile_borcu_ayristirir() {
    let conn = conn();
    let id = student(&conn, "Fatma Öztürk");

    let charge = ledger(&conn, id, "2026-03-02", "session_charge", -25000);
    let iptal = repo::finance::insert_reversal(&conn, charge, "2026-03-03", Some("Mazeretli"))
        .expect("2. adım: düzeltme");
    repo::finance::insert_reversal(&conn, iptal, "2026-03-04", Some("Tekrar Geldi"))
        .expect("3. adım: düzeltmenin düzeltmesi — §4 bunu öngörüyor");

    // Bakiye DOĞRU: öğrenci gerçekten 250 ₺ borçlu.
    assert_eq!(
        repo::views::student_balance(&conn, id)
            .unwrap()
            .unwrap()
            .balance_kurus,
        -25000,
        "defter toplamı doğru"
    );

    // Borçlu listesi ise onu HİÇ göstermiyor — çelişki burada.
    assert_eq!(
        debt_of(&conn, id),
        0,
        "AÇIK KARAR: borçlu listesi bu borcu görmüyor. Karar verilip düzeltilince \
         bu beklenti 25000 olacak ve bu testin adı/yorumu silinecek."
    );
}
