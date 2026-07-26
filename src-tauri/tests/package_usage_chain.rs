//! ADR-036'nın **kanıt şartı** — `003_package_usage_reversal_chain.sql`.
//!
//! ADR bir cümleyi çivilemeyi şart koşuyor ve bu dosyanın tamamı o cümledir:
//!
//! > Her paket için `v_package_remaining.remaining` = `lesson_count` + canlı
//! > `package_usage` satırlarının `delta` toplamı, **düzeltme zincirinin
//! > uzunluğundan bağımsız olarak.**
//!
//! Şart koşucu: *"Bu diziler yeşil olmadan tüketim fonksiyonu yazılmaz. Değişmez
//! kurulamazsa karar (a)'ya döner ve ADR `Değiştirildi` olur — tartışmayla değil,
//! testle."*
//!
//! `v_package_remaining` **yeniden yazılmadı** ve bu bir tesadüf değil: defterin
//! aksine ders hakkında yalnızca toplam anlam taşıyor ve zincir `−1, +1, −1, …` diye
//! alternatiflendiği için toplam her uzunlukta doğru çıkıyor. Doğruluğun tümü
//! `trg_pkgusage_reversal_valid`'in taşıdığı değişmeze dayanıyor — o yüzden
//! aşağıdaki son üç test tetikleyicileri **doğrudan** sınıyor.

mod common;

use common::*;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;

/// Zincirin bağlanacağı gerçek bir `attendance` satırı — `ux_pkgusage_head` yalnızca
/// `attendance_id IS NOT NULL` satırlarını süzüyor, dolayısıyla dizilerin tamamı bir
/// yoklamaya bağlı olmak zorunda.
fn attendance_of(conn: &rusqlite::Connection, student_id: i64, day: &str) -> i64 {
    let subject_id = subject(conn, "Matematik");
    let group_id = group(conn, "Grup A", subject_id);
    enrollment(
        conn,
        student_id,
        Some(group_id),
        subject_id,
        "2026-01-01",
        None,
    )
    .unwrap();
    let session_id = group_session(conn, group_id, subject_id, day);
    repo::academic::insert_attendance(
        conn,
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
    .expect("yoklama eklenmeli")
}

/// Her senaryonun ortak kurulumu: bir öğrenci, 8 derslik paket, bir yoklama.
fn setup() -> (rusqlite::Connection, i64, i64) {
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let package_id = package(&conn, student_id);
    let attendance_id = attendance_of(&conn, student_id, "2026-03-02");
    (conn, package_id, attendance_id)
}

/// Değişmezin kendisi: view ile ham toplam ayrışamaz.
fn assert_remaining_invariant(conn: &rusqlite::Connection, package_id: i64) {
    let (lesson_count, sum): (i64, i64) = conn
        .query_row(
            "SELECT p.lesson_count, \
                    COALESCE((SELECT SUM(u.delta) FROM package_usage u \
                              WHERE u.package_id = p.id AND u.deleted_at IS NULL), 0) \
             FROM package p WHERE p.id = ?1",
            [package_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("ham toplam okunmalı");

    assert_eq!(
        remaining(conn, package_id),
        lesson_count + sum,
        "v_package_remaining ham toplamdan ayrıştı — ADR-036'nın değişmezi kırık"
    );
}

// ===========================================================================
// Yedi dizi — ADR-036'nın listesi, sırasıyla
// ===========================================================================

#[test]
fn dizi_1_geldi() {
    let (conn, package_id, attendance_id) = setup();
    consume(&conn, package_id, Some(attendance_id), "2026-03-02");

    assert_eq!(remaining(&conn, package_id), 7);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_2_geldi_mazeretli() {
    let (conn, package_id, attendance_id) = setup();
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");
    repo::finance::insert_package_usage_reversal(
        &conn,
        head,
        "2026-03-03",
        "cancellation_restore",
        None,
    )
    .expect("düzeltme yazılmalı");

    // Hak geri geldi. Satır SİLİNMEDİ — sayaç geriye dönük silinmiyor (§1.12).
    assert_eq!(remaining(&conn, package_id), 8);
    assert_eq!(rows_of(&conn, package_id), 2);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_3_geldi_mazeretli_geldi() {
    // ESKİ ŞEMANIN TIKANDIĞI YER: `ux_pkgusage_att` (attendance_id, delta) tekil
    // olduğu için üçüncü adımın `delta = −1`'i birincisiyle çakışıyor ve
    // YAZILAMIYORDU. ADR-036'nın varlık sebebi bu satır.
    let (conn, package_id, attendance_id) = setup();
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");
    let undo = repo::finance::insert_package_usage_reversal(
        &conn,
        head,
        "2026-03-03",
        "cancellation_restore",
        None,
    )
    .expect("düzeltme yazılmalı");
    repo::finance::insert_package_usage_reversal(&conn, undo, "2026-03-04", "attendance", None)
        .expect("düzeltmenin tersi yazılmalı");

    assert_eq!(remaining(&conn, package_id), 7, "−1 +1 −1 = −1");
    assert_eq!(rows_of(&conn, package_id), 3);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_4_geldi_mazeretli_geldi_mazeretli() {
    let (conn, package_id, attendance_id) = setup();
    let mut last = consume(&conn, package_id, Some(attendance_id), "2026-03-02");
    for (day, reason) in [
        ("2026-03-03", "cancellation_restore"),
        ("2026-03-04", "attendance"),
        ("2026-03-05", "cancellation_restore"),
    ] {
        last = repo::finance::insert_package_usage_reversal(&conn, last, day, reason, None)
            .expect("zincir uzayabilmeli");
    }

    assert_eq!(remaining(&conn, package_id), 8, "−1 +1 −1 +1 = 0");
    assert_eq!(rows_of(&conn, package_id), 4);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_5_cift_tikla_iki_kez_geldi_reddedilir() {
    let (conn, package_id, attendance_id) = setup();
    consume(&conn, package_id, Some(attendance_id), "2026-03-02");

    // `ux_pkgusage_head`: bir yoklamanın en fazla BİR başlık satırı olur.
    let err = repo::finance::insert_package_usage(
        &conn,
        &PackageUsage {
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
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "lesson_already_consumed");
    assert_eq!(
        remaining(&conn, package_id),
        7,
        "çift tık iki ders düşüremez"
    );
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_6_ayni_satiri_iki_kez_ters_kaydetme_reddedilir() {
    let (conn, package_id, attendance_id) = setup();
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");
    repo::finance::insert_package_usage_reversal(
        &conn,
        head,
        "2026-03-03",
        "cancellation_restore",
        None,
    )
    .expect("ilk düzeltme geçmeli");

    // `ux_pkgusage_reverses`: zincir DALLANAMAZ. Dallanabilseydi aynı hak iki kez
    // iade edilir ve toplam anlamsızlaşırdı.
    let err = repo::finance::insert_package_usage_reversal(
        &conn,
        head,
        "2026-03-04",
        "cancellation_restore",
        None,
    )
    .unwrap_err();

    assert_eq!(err.code, "already_reversed");
    assert_eq!(remaining(&conn, package_id), 8);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn dizi_7_update_reddedilir() {
    let (conn, package_id, attendance_id) = setup();
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");

    // Sütun listesi YOK: UPDATE'in tamamı kapalı. `delta` da, `memo` da, `deleted_at` de.
    for sql in [
        "UPDATE package_usage SET delta = 1 WHERE id = ?1",
        "UPDATE package_usage SET memo = 'düzeltildi' WHERE id = ?1",
        "UPDATE package_usage SET deleted_at = '2026-05-01' WHERE id = ?1",
    ] {
        let err = conn.execute(sql, [head]).unwrap_err().to_string();
        assert!(
            err.contains("package_usage_is_immutable"),
            "UPDATE geçti: {sql}"
        );
    }

    // DELETE de kapalı — arşivleme de yok (ADR-036'nın açıkça yazdığı bedel).
    let err = conn
        .execute("DELETE FROM package_usage WHERE id = ?1", [head])
        .unwrap_err()
        .to_string();
    assert!(err.contains("package_usage_is_immutable"), "DELETE geçti");

    assert_eq!(remaining(&conn, package_id), 7);
    assert_remaining_invariant(&conn, package_id);
}

// ===========================================================================
// Tetikleyicinin taşıdığı değişmez — parite view'ı OLMADIĞI için burası kritik
// ===========================================================================

#[test]
fn ters_kaydin_delta_si_hedefin_tam_tersi_olmak_zorunda() {
    let (conn, package_id, attendance_id) = setup();
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");

    // −1'in tersi +1'dir. Aynı işaretle yazılan bir "düzeltme" toplamı −2 yapar ve
    // `v_package_remaining` sessizce yanlış cevap verirdi: paritenin view'da değil
    // tetikleyicide durmasının bedeli tam olarak bu satırın var olması.
    let err = repo::finance::insert_package_usage(
        &conn,
        &PackageUsage {
            id: None,
            package_id,
            attendance_id: Some(attendance_id),
            used_on: "2026-03-03".into(),
            delta: -1,
            reason: "attendance".into(),
            reverses_id: Some(head),
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "pkgusage_reversal_mismatch");
    assert_eq!(remaining(&conn, package_id), 7);
}

#[test]
fn ters_kayit_baska_paketin_satirina_baglanamaz() {
    let (conn, package_id, attendance_id) = setup();
    let student_id = student(&conn, "Elif Yılmaz");
    let other_package = package(&conn, student_id);
    let head = consume(&conn, package_id, Some(attendance_id), "2026-03-02");

    // Paketler arası bir "düzeltme" bir paketten düşüp diğerine iade ederdi.
    let err = repo::finance::insert_package_usage(
        &conn,
        &PackageUsage {
            id: None,
            package_id: other_package,
            attendance_id: None,
            used_on: "2026-03-03".into(),
            delta: 1,
            reason: "cancellation_restore".into(),
            reverses_id: Some(head),
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "pkgusage_reversal_mismatch");
    assert_eq!(remaining(&conn, package_id), 7);
    assert_eq!(remaining(&conn, other_package), 8);
}

#[test]
fn yoklamasiz_hareketler_bas_indeksine_takilmaz() {
    // `manual` düzeltmeler ve paket kapatma (ADR-035) `attendance_id` taşımaz;
    // `ux_pkgusage_head` yalnızca `attendance_id IS NOT NULL` satırlarını süzdüğü için
    // bunlardan istenildiği kadar yazılabilir.
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let package_id = package(&conn, student_id);

    for day in ["2026-03-02", "2026-03-03", "2026-03-04"] {
        consume(&conn, package_id, None, day);
    }

    assert_eq!(remaining(&conn, package_id), 5);
    assert_remaining_invariant(&conn, package_id);
}

/// Paketin canlı hareket sayısı — satırın silinmediğinin kanıtı.
fn rows_of(conn: &rusqlite::Connection, package_id: i64) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM package_usage WHERE package_id = ?1 AND deleted_at IS NULL",
        [package_id],
        |row| row.get(0),
    )
    .expect("satır sayısı okunmalı")
}

// ===========================================================================
// `consume_package_credit` / `restore_package_credit` — Faz 6 yalnızca ÇAĞIRACAK
//
// Sözleşme "bir satır ekle" değil, "hakkı düşmüş / düşmemiş olsun". İki fonksiyon
// da idempotent; hangi satırın yazılacağını ekran değil bu katman hesaplıyor.
// ===========================================================================

#[test]
fn tuketim_hakki_duser_ve_ikinci_cagri_ikinci_ders_dusurmez() {
    let (conn, package_id, attendance_id) = setup();

    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();
    assert_eq!(remaining(&conn, package_id), 7);

    // Çift tık ya da yoklamanın iki kez kaydedilmesi — ikinci ders düşmez.
    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();
    assert_eq!(remaining(&conn, package_id), 7);
    assert_eq!(rows_of(&conn, package_id), 1, "ikinci satır bile yazılmadı");
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn iptal_hakki_geri_verir_ve_ikinci_iptal_ikinci_iade_yapmaz() {
    let (conn, package_id, attendance_id) = setup();
    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();

    repo::finance::restore_package_credit(&conn, attendance_id).unwrap();
    assert_eq!(remaining(&conn, package_id), 8);

    repo::finance::restore_package_credit(&conn, attendance_id).unwrap();
    assert_eq!(
        remaining(&conn, package_id),
        8,
        "iki kez iptal iki iade yapmaz"
    );
    assert_eq!(rows_of(&conn, package_id), 2);
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn geldi_mazeretli_geldi_dizisi_fonksiyonlarla_da_yurur() {
    // `VERI-MODELI §4`'ün gerçek akışı: kullanıcı yanlışlıkla "Geldi" işaretler,
    // düzeltir, veli itiraz eder ve geri alınır. Faz 6 bunu üç çağrıyla yapacak.
    let (conn, package_id, attendance_id) = setup();

    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();
    repo::finance::restore_package_credit(&conn, attendance_id).unwrap();
    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();

    assert_eq!(remaining(&conn, package_id), 7);
    assert_eq!(
        rows_of(&conn, package_id),
        3,
        "zincir uzadı, satır silinmedi"
    );
    assert_remaining_invariant(&conn, package_id);
}

#[test]
fn hic_dusulmemis_hakki_iptal_etmek_sessizce_gecer() {
    // Paketsiz öğrenci ya da mazeretli işaretlenmiş ders: geri verilecek hak yok.
    // Bu bir hata değil, beklenen durum — Faz 6 her iptalde koşulsuz çağırabilsin.
    let (conn, package_id, attendance_id) = setup();

    repo::finance::restore_package_credit(&conn, attendance_id).unwrap();

    assert_eq!(remaining(&conn, package_id), 8);
    assert_eq!(rows_of(&conn, package_id), 0);
}

#[test]
fn en_eski_aktif_paketten_duser() {
    // R5.12 — aynı öğrencide birden fazla aktif paket olabilir.
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let eski = package(&conn, student_id);
    let yeni = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 4,
            unit_price: 30000,
            total_price: 120000,
            sold_on: "2026-03-15".into(),
            valid_until: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let attendance_id = attendance_of(&conn, student_id, "2026-03-20");

    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();

    assert_eq!(remaining(&conn, eski), 7, "en eski paketten düşmeli");
    assert_eq!(remaining(&conn, yeni), 4, "yeni pakete dokunulmamalı");
}

#[test]
fn tukenmis_paket_secilmez() {
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let biten = package(&conn, student_id);
    // Sekiz hakkın hepsi tüketildi — `status` GÜNCELLENMİYOR, bilerek: "aktif paket"
    // bir sorgudur, bir sütun değildir (§1.23).
    for i in 0..8 {
        consume(&conn, biten, None, &format!("2026-03-{:02}", i + 2));
    }
    assert_eq!(remaining(&conn, biten), 0);

    let yeni = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 4,
            unit_price: 30000,
            total_price: 120000,
            sold_on: "2026-03-15".into(),
            valid_until: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let attendance_id = attendance_of(&conn, student_id, "2026-03-20");

    repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap();

    assert_eq!(
        remaining(&conn, biten),
        0,
        "tükenmiş paket eksiye düşmemeli"
    );
    assert_eq!(remaining(&conn, yeni), 3);
}

#[test]
fn paketi_olmayan_ogrencide_hata_verir_sessizce_gecmez() {
    // Sessizce geçmek, paketi bitmiş öğrencinin dersini BEDAVAYA getirirdi:
    // ne hak düşer ne borç yazılır.
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let attendance_id = attendance_of(&conn, student_id, "2026-03-02");

    let err = repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap_err();

    assert_eq!(err.code, "no_active_package");
    // Mesaj kullanıcıya EYLEM öneriyor (PRD §8).
    assert!(err.message.contains("ders başı"), "{}", err.message);
}

#[test]
fn iptal_edilmis_paket_secilmez() {
    let conn = conn();
    let student_id = student(&conn, "Ahmet Şahin");
    let iptal = package(&conn, student_id);
    conn.execute(
        "UPDATE package SET status = 'cancelled' WHERE id = ?1",
        [iptal],
    )
    .unwrap();
    let attendance_id = attendance_of(&conn, student_id, "2026-03-02");

    // `status` yalnızca 'cancelled' için bağlayıcıdır (§1.23) — satış iptali bir olay,
    // türetilemez.
    let err = repo::finance::consume_package_credit(&conn, attendance_id, TODAY).unwrap_err();
    assert_eq!(err.code, "no_active_package");
}
