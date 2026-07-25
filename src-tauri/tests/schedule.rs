//! Faz 5A — seans üretimi, çakışma, kapsam silme, üyelik ve grup projeksiyonu.
//!
//! Bellek içi SQLite, **gerçek migration'lar uygulanarak** (ADR-002).
//! `today` her yerde sabit (`common::TODAY` = 2026-03-31, **Salı**) — §0 `'now'` kuralı:
//! hiçbir test SQLite saatini okumaz, yoksa CI makinesinin saat dilimine bağlı olurdu.
//!
//! Takvimin gerçek tarihleri elle yazılı: "17 seans üretildi" tek başına bir şey
//! kanıtlamaz, ilk ve son tarihin ne olduğu kanıtlar.

mod common;

use chrono::NaiveDate;
use common::TODAY;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::schedule::{
    self, GroupInput, GroupQuery, SessionScope, SubjectInput, WeeklySlot,
};
use rusqlite::Connection;

/// 2026-03-31, Salı. Ufuk 16 hafta → son gün 2026-07-21 (yine Salı).
fn today() -> NaiveDate {
    NaiveDate::parse_from_str(TODAY, "%Y-%m-%d").expect("sabit tarih ayrıştırılmalı")
}

/// 1 = Pazartesi … 7 = Pazar
const SALI: i64 = 2;
const PERSEMBE: i64 = 4;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

fn series(
    conn: &Connection,
    group_id: i64,
    subject_id: i64,
    weekday: i64,
    start_time: &str,
    starts_on: &str,
    ends_on: Option<&str>,
) -> i64 {
    repo::academic::insert_session_series(
        conn,
        &SessionSeries {
            id: None,
            study_group_id: Some(group_id),
            student_id: None,
            subject_id,
            teacher_id: Some(1),
            weekday,
            start_time: start_time.into(),
            duration_min: 60,
            starts_on: starts_on.into(),
            ends_on: ends_on.map(str::to_string),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("şablon eklenmeli")
}

/// Belirli saatte tek seferlik grup seansı — çakışma testlerinin kurulumu.
fn session_at(conn: &Connection, group_id: i64, subject_id: i64, from: &str, to: &str) -> i64 {
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: Some(group_id),
            student_id: None,
            subject_id,
            teacher_id: Some(1),
            starts_at: from.into(),
            ends_at: to.into(),
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
    .expect("seans eklenmeli")
}

fn sessions_of(conn: &Connection, series_id: i64) -> Vec<String> {
    let mut stmt = conn
        .prepare(
            "SELECT starts_at FROM session \
             WHERE series_id = ?1 AND deleted_at IS NULL ORDER BY starts_at",
        )
        .expect("sorgu hazırlanmalı");
    stmt.query_map([series_id], |row| row.get::<_, String>(0))
        .expect("sorgu çalışmalı")
        .collect::<rusqlite::Result<_>>()
        .expect("satırlar okunmalı")
}

fn set_weekly_closed(conn: &Connection, value: &str) {
    repo::setting::set(conn, "weekly_closed_days", value).expect("ayar yazılmalı");
}

fn closed_day(conn: &Connection, day: &str, label: &str) {
    repo::academic::insert_closed_day(
        conn,
        &ClosedDay {
            id: None,
            day: day.into(),
            label: label.into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("tatil eklenmeli");
}

/// "Salı 16:00" şablonu olan bir grup — üretim testlerinin ortak kurulumu.
fn tuesday_group(conn: &Connection) -> (i64, i64, i64) {
    let subject_id = common::subject(conn, "Matematik");
    let group_id = common::group(conn, "Grup A", subject_id);
    let series_id = series(conn, group_id, subject_id, SALI, "16:00", TODAY, None);
    (subject_id, group_id, series_id)
}

// ===========================================================================
// Seri üretimi — faz-05 §7 birinci madde
// ===========================================================================

#[test]
fn seri_ufka_kadar_uretir_ve_tarihleri_dogru() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);

    let report = schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    // 16 hafta ufuk, haftada bir gün: bugün dahil 17 slot.
    assert_eq!(report.created, 17, "16 haftalık ufukta 17 salı var");
    assert_eq!(report.existing, 0);

    let days = sessions_of(&conn, series_id);
    assert_eq!(days.len(), 17);
    assert_eq!(days.first().unwrap(), "2026-03-31 16:00", "bugünden başlar");
    assert_eq!(days.last().unwrap(), "2026-07-21 16:00", "ufkun son salısı");
    // Aradaki her adım tam bir hafta.
    assert_eq!(days[1], "2026-04-07 16:00");
    assert_eq!(days[2], "2026-04-14 16:00");
}

#[test]
fn birden_fazla_gun_secilebilir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let sali = series(&conn, group_id, subject_id, SALI, "16:00", TODAY, None);
    let persembe = series(&conn, group_id, subject_id, PERSEMBE, "18:00", TODAY, None);

    schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    // Salı bugün (31.03) başlar → 17; perşembe iki gün sonra (02.04) başlar → 16.
    assert_eq!(sessions_of(&conn, sali).len(), 17);
    let thursdays = sessions_of(&conn, persembe);
    assert_eq!(thursdays.len(), 16);
    assert_eq!(thursdays.first().unwrap(), "2026-04-02 18:00");
    assert_eq!(thursdays.last().unwrap(), "2026-07-16 18:00");
}

#[test]
fn tatil_gunune_seans_uretilmez() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    closed_day(&conn, "2026-04-07", "Bahar tatili");

    let report = schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    assert_eq!(report.created, 16, "bir salı tatile denk geldi");
    assert_eq!(report.closed, 1);
    let days = sessions_of(&conn, series_id);
    assert!(
        !days.iter().any(|d| d.starts_with("2026-04-07")),
        "tatil gününde seans olmamalı: {days:?}"
    );
}

#[test]
fn haftalik_kapali_gun_de_atlanir() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    // Salı haftalık kapalı gün ilan edilirse şablonun hiçbir slotu üretilmez.
    set_weekly_closed(&conn, "2");

    let report = schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    assert_eq!(report.created, 0);
    assert_eq!(report.closed, 17);
    assert!(sessions_of(&conn, series_id).is_empty());
}

#[test]
fn uretim_idempotent() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);

    schedule::generate_sessions(&conn, today()).expect("ilk üretim");
    let second = schedule::generate_sessions(&conn, today()).expect("ikinci üretim");

    assert_eq!(second.created, 0, "ikinci çağrı yeni satır yazmamalı");
    assert_eq!(second.existing, 17, "hepsi mevcut sayılmalı");
    assert_eq!(sessions_of(&conn, series_id).len(), 17);
}

#[test]
fn iptal_edilmis_seans_yeniden_uretilmez() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("ilk üretim");

    let victim: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 ORDER BY starts_at LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");
    schedule::cancel_session(&conn, victim, Some("Öğretmen hasta")).expect("iptal çalışmalı");

    let again = schedule::generate_sessions(&conn, today()).expect("ikinci üretim");

    assert_eq!(again.created, 0, "iptal edilmiş seans diriltilmemeli");
    let status: String = conn
        .query_row("SELECT status FROM session WHERE id = ?1", [victim], |r| {
            r.get(0)
        })
        .expect("durum okunmalı");
    assert_eq!(status, "cancelled");
}

#[test]
fn gecmise_seans_uretilmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    // Şablon ocakta başlamış; bugün 31 Mart.
    let series_id = series(
        &conn,
        group_id,
        subject_id,
        SALI,
        "16:00",
        "2026-01-06",
        None,
    );

    schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    let days = sessions_of(&conn, series_id);
    assert_eq!(
        days.first().unwrap(),
        "2026-03-31 16:00",
        "üretim bugünden başlar, olmamış dersi icat etmez"
    );
    assert_eq!(days.len(), 17);
}

#[test]
fn serinin_bitis_tarihi_ufku_kisaltir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let series_id = series(
        &conn,
        group_id,
        subject_id,
        SALI,
        "16:00",
        TODAY,
        Some("2026-04-14"),
    );

    schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    assert_eq!(
        sessions_of(&conn, series_id),
        vec![
            "2026-03-31 16:00".to_string(),
            "2026-04-07 16:00".to_string(),
            "2026-04-14 16:00".to_string(),
        ]
    );
}

#[test]
fn grup_seansinda_unit_price_bos_kalir() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    let price: Option<i64> = conn
        .query_row(
            "SELECT unit_price FROM session WHERE series_id = ?1 LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans okunmalı");

    // Grup seansının tek bir ücreti yok — her üyenin fiyatı kendi kaydında.
    // Buraya 0 yazmak "bu ders bedava" anlamına gelen sessiz bir yedek üretirdi (§5).
    assert_eq!(price, None);
}

#[test]
fn birebir_seansta_ucret_snapshotu_kayittan_gelir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Mehmet Aslan");
    common::enrollment(&conn, student_id, None, subject_id, "2026-01-01", None)
        .expect("kayıt açılmalı");

    let series_id = repo::academic::insert_session_series(
        &conn,
        &SessionSeries {
            id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            weekday: SALI,
            start_time: "16:00".into(),
            duration_min: 60,
            starts_on: TODAY.into(),
            ends_on: Some("2026-04-07".into()),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("şablon eklenmeli");

    schedule::generate_sessions(&conn, today()).expect("üretim çalışmalı");

    let price: Option<i64> = conn
        .query_row(
            "SELECT unit_price FROM session WHERE series_id = ?1 LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans okunmalı");
    assert_eq!(price, Some(25000), "ADR-006 snapshot'ı kayıttan kopyalanır");
}

#[test]
fn gece_yarisini_asan_ders_ertesi_gune_taser() {
    let day = NaiveDate::from_ymd_opt(2026, 3, 31).unwrap();
    let (start, end) = schedule::slot_bounds(day, "23:30", 60).expect("hesaplanmalı");

    assert_eq!(start, "2026-03-31 23:30");
    // Saat metnine dakika eklenseydi '00:30' çıkar ve CHECK (ends_at > starts_at)
    // metin karşılaştırması olduğu için şema satırı reddederdi.
    assert_eq!(end, "2026-04-01 00:30");
}

// ===========================================================================
// Çakışma — PRD K-1 / R3.11: uyar, engelleme
// ===========================================================================

#[test]
fn ayni_saatteki_ders_cakisma_verir_ve_adini_soyler() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    session_at(
        &conn,
        group_id,
        subject_id,
        "2026-04-01 16:00",
        "2026-04-01 17:00",
    );

    let hits = schedule::detect_conflicts(&conn, "2026-04-01 16:30", "2026-04-01 17:30", None)
        .expect("çakışma sorgusu çalışmalı");

    assert_eq!(hits.len(), 1, "kısmi örtüşme de çakışmadır");
    assert_eq!(hits[0].label, "Matematik · Grup A");
}

#[test]
fn bitisik_ders_cakisma_saymaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    session_at(
        &conn,
        group_id,
        subject_id,
        "2026-04-01 16:00",
        "2026-04-01 17:00",
    );

    let hits = schedule::detect_conflicts(&conn, "2026-04-01 17:00", "2026-04-01 18:00", None)
        .expect("çakışma sorgusu çalışmalı");

    assert!(
        hits.is_empty(),
        "arka arkaya iki ders çakışma değildir: {hits:?}"
    );
}

#[test]
fn iptal_edilmis_ders_cakisma_saymaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let id = session_at(
        &conn,
        group_id,
        subject_id,
        "2026-04-01 16:00",
        "2026-04-01 17:00",
    );
    schedule::cancel_session(&conn, id, None).expect("iptal çalışmalı");

    let hits = schedule::detect_conflicts(&conn, "2026-04-01 16:00", "2026-04-01 17:00", None)
        .expect("çakışma sorgusu çalışmalı");

    assert!(hits.is_empty(), "o saatte artık ders yok");
}

#[test]
fn tasinan_dersin_kendisi_cakisma_sayilmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let id = session_at(
        &conn,
        group_id,
        subject_id,
        "2026-04-01 16:00",
        "2026-04-01 17:00",
    );

    let hits = schedule::detect_conflicts(&conn, "2026-04-01 16:00", "2026-04-01 17:00", Some(id))
        .expect("çakışma sorgusu çalışmalı");

    assert!(hits.is_empty(), "ders kendisiyle çakışmaz");
}

#[test]
fn birebir_derste_cakisma_ogrencinin_adini_soyler() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Fizik");
    let student_id = common::student(&conn, "Mehmet Aslan");
    repo::academic::insert_session(
        &conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: "2026-04-01 16:00".into(),
            ends_at: "2026-04-01 17:00".into(),
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
    .expect("seans eklenmeli");

    let hits = schedule::detect_conflicts(&conn, "2026-04-01 16:00", "2026-04-01 17:00", None)
        .expect("çakışma sorgusu çalışmalı");

    assert_eq!(hits[0].label, "Fizik · Mehmet Aslan");
}

// ===========================================================================
// Silme kapsamları — faz-05 §5
// ===========================================================================

#[test]
fn sadece_bu_ders_iptal_edilir_ve_geri_gelmez() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim");
    let victim: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 ORDER BY starts_at LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");

    let report =
        schedule::delete_sessions(&conn, victim, SessionScope::Only).expect("silme çalışmalı");

    assert_eq!(report.cancelled, 1);
    assert_eq!(report.removed, 0, "şablona bağlı seans arşivlenmez");
    assert!(!report.series_closed, "seri kapanmamalı");

    // Kritik: arşivlenseydi slot boşalır ve üretim dersi ertesi sabah geri yazardı.
    let again = schedule::generate_sessions(&conn, today()).expect("üretim");
    assert_eq!(again.created, 0);
    assert_eq!(
        sessions_of(&conn, series_id).len(),
        17,
        "satır yerinde kalır"
    );
}

#[test]
fn bu_ve_sonraki_dersler_seriyi_kapatir_gecmisi_bozmaz() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim");

    // 3. ders: 2026-04-14.
    let pivot: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 AND starts_at = '2026-04-14 16:00'",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");

    let report =
        schedule::delete_sessions(&conn, pivot, SessionScope::Following).expect("silme çalışmalı");

    assert!(report.series_closed);
    assert_eq!(report.removed, 15, "14 Nisan dahil sonraki her ders düşer");

    let kalan = sessions_of(&conn, series_id);
    assert_eq!(
        kalan,
        vec![
            "2026-03-31 16:00".to_string(),
            "2026-04-07 16:00".to_string(),
        ],
        "geçmiş dersler yerinde kalır (R3.9)"
    );

    let ends_on: Option<String> = conn
        .query_row(
            "SELECT ends_on FROM session_series WHERE id = ?1",
            [series_id],
            |row| row.get(0),
        )
        .expect("şablon okunmalı");
    assert_eq!(
        ends_on.as_deref(),
        Some("2026-04-13"),
        "pivotun bir günü öncesi"
    );

    // Seri kapandığı için üretim silinen dersleri geri getirmez.
    let again = schedule::generate_sessions(&conn, today()).expect("üretim");
    assert_eq!(again.created, 0);
    assert_eq!(sessions_of(&conn, series_id).len(), 2);
}

#[test]
fn tum_seri_silinince_sablon_arsivlenir() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim");
    let any: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 ORDER BY starts_at LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");

    let report = schedule::delete_sessions(&conn, any, SessionScope::All).expect("silme çalışmalı");

    assert!(report.series_closed);
    assert_eq!(report.removed, 17);
    assert!(sessions_of(&conn, series_id).is_empty());

    let again = schedule::generate_sessions(&conn, today()).expect("üretim");
    assert_eq!(again.created, 0, "arşivlenmiş şablon üretmez");
}

#[test]
fn islenmis_ders_hicbir_kapsamda_silinmez() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim");

    // İlk ders işlenmiş sayılsın.
    conn.execute(
        "UPDATE session SET attendance_taken_at = '2026-03-31 17:05' \
         WHERE series_id = ?1 AND starts_at = '2026-03-31 16:00'",
        [series_id],
    )
    .expect("yoklama damgası yazılmalı");

    let any: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 ORDER BY starts_at LIMIT 1",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");
    schedule::delete_sessions(&conn, any, SessionScope::All).expect("silme çalışmalı");

    assert_eq!(
        sessions_of(&conn, series_id),
        vec!["2026-03-31 16:00".to_string()],
        "yoklaması alınmış ders yerinde kalır"
    );
}

#[test]
fn yoklamasi_alinmis_ders_tasinamaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let id = session_at(
        &conn,
        group_id,
        subject_id,
        "2026-03-24 16:00",
        "2026-03-24 17:00",
    );
    conn.execute(
        "UPDATE session SET attendance_taken_at = '2026-03-24 17:05' WHERE id = ?1",
        [id],
    )
    .expect("yoklama damgası yazılmalı");

    let err = schedule::reschedule_session(&conn, id, "2026-04-01 18:00", 60)
        .expect_err("R3.13: taşınmamalı");

    assert_eq!(err.code, "session_locked");
}

#[test]
fn ertelenen_ders_sablona_bagli_kalir() {
    let conn = common::conn();
    let (_, _, series_id) = tuesday_group(&conn);
    schedule::generate_sessions(&conn, today()).expect("üretim");
    let id: i64 = conn
        .query_row(
            "SELECT id FROM session WHERE series_id = ?1 AND starts_at = '2026-04-07 16:00'",
            [series_id],
            |row| row.get(0),
        )
        .expect("seans bulunmalı");

    schedule::reschedule_session(&conn, id, "2026-04-08 18:00", 90).expect("erteleme çalışmalı");

    let (starts, ends, series): (String, String, Option<i64>) = conn
        .query_row(
            "SELECT starts_at, ends_at, series_id FROM session WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("seans okunmalı");

    assert_eq!(starts, "2026-04-08 18:00");
    assert_eq!(ends, "2026-04-08 19:30", "90 dakika");
    assert_eq!(series, Some(series_id), "şablon bağı kopmaz");

    // Boşalan slot yeniden üretilir: şablon o saati hâlâ istiyor. Bu doğru davranış —
    // "dersi taşıdım" ile "o hafta ders yok" farklı iki şey (tasarımın kapsam sorusu).
    let again = schedule::generate_sessions(&conn, today()).expect("üretim");
    assert_eq!(again.created, 1);
}

// ===========================================================================
// Üyelik — R5.6 / R5.7 / R5.8, PRD K-8 ve K-22
// ===========================================================================

#[test]
fn gruba_sonradan_katilan_ogrenci_onceki_seanslarda_gorunmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let erken = common::student(&conn, "Elif Yılmaz");
    let gec = common::student(&conn, "Burak Kaya");

    schedule::add_group_member(&conn, group_id, erken, "2026-02-01").expect("üye eklenmeli");
    schedule::add_group_member(&conn, group_id, gec, "2026-03-15").expect("üye eklenmeli");

    let subat =
        repo::academic::group_members_on(&conn, group_id, "2026-02-10").expect("üyeler okunmalı");
    let mart =
        repo::academic::group_members_on(&conn, group_id, "2026-03-20").expect("üyeler okunmalı");

    assert_eq!(subat, vec![erken], "15 Mart'tan önce sadece Elif kayıtlı");
    assert_eq!(mart.len(), 2);

    // Şema seviyesinde de mühürlü: aralık dışına yoklama yazılamaz (§1.16).
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-02-10");
    let err = repo::academic::insert_attendance(
        &conn,
        &Attendance {
            id: None,
            session_id,
            student_id: gec,
            status: "present".into(),
            marked_at: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect_err("tetikleyici reddetmeli");
    assert_eq!(err.code, "attendance_outside_enrollment");
}

#[test]
fn gruptan_ayrilan_ogrencinin_kaydi_silinmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let student_id = common::student(&conn, "Elif Yılmaz");
    let enrollment_id =
        schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").expect("üye");

    schedule::end_group_membership(&conn, enrollment_id, "2026-05-20").expect("ayrılış");

    let (end_on, status, deleted): (Option<String>, String, Option<String>) = conn
        .query_row(
            "SELECT end_on, status, deleted_at FROM enrollment WHERE id = ?1",
            [enrollment_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("kayıt okunmalı");

    assert_eq!(end_on.as_deref(), Some("2026-05-20"));
    assert_eq!(status, "closed");
    assert_eq!(deleted, None, "kayıt silinmez, bitiş tarihi yazılır (R5.8)");

    // 21 Mayıs'tan sonra seanslarda görünmez, öncekilerde görünür.
    let before = repo::academic::group_members_on(&conn, group_id, "2026-05-10").unwrap();
    let after = repo::academic::group_members_on(&conn, group_id, "2026-05-21").unwrap();
    assert_eq!(before, vec![student_id]);
    assert!(after.is_empty());
}

#[test]
fn ayrilis_tarihi_katilimdan_once_olamaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let student_id = common::student(&conn, "Elif Yılmaz");
    let enrollment_id =
        schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").expect("üye");

    let err = schedule::end_group_membership(&conn, enrollment_id, "2026-01-01")
        .expect_err("reddedilmeli");

    assert_eq!(err.code, "enrollment.endOn");
}

#[test]
fn kapasite_asimi_engellenmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    conn.execute(
        "UPDATE study_group SET capacity = 2 WHERE id = ?1",
        [group_id],
    )
    .expect("kapasite yazılmalı");

    for name in ["Elif Yılmaz", "Burak Kaya", "Işıl Demir"] {
        let student_id = common::student(&conn, name);
        // PRD S2 / K-8: kapasite bir HEDEFTİR, kısıt değil. Şemada CHECK/trigger yok,
        // repository de engellemiyor; uyarı arayüzün onay diyaloğu.
        schedule::add_group_member(&conn, group_id, student_id, TODAY)
            .unwrap_or_else(|err| panic!("{name} eklenebilmeliydi: {err}"));
    }

    let capacity = schedule::group_capacity(&conn, group_id, TODAY).expect("doluluk");
    assert_eq!(capacity.member_count, 3);
    assert_eq!(capacity.capacity, 2, "aşım görünür kalır, engellenmez");
}

#[test]
fn ayni_brans_icin_ikinci_acik_kayit_reddedilir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let student_id = common::student(&conn, "Elif Yılmaz");

    schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").expect("ilk kayıt");
    let err = schedule::add_group_member(&conn, group_id, student_id, "2026-03-01")
        .expect_err("K-22: çakışan açık kayıt engellenir");

    assert_eq!(err.code, "enrollment_overlap");
}

#[test]
fn ayrildiktan_sonra_gruba_geri_donebilir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let student_id = common::student(&conn, "Elif Yılmaz");

    let first = schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").unwrap();
    schedule::end_group_membership(&conn, first, "2026-05-20").unwrap();

    // Aralıklar çakışmadığı sürece ikinci kayıt serbest (§1.9).
    schedule::add_group_member(&conn, group_id, student_id, "2026-09-01")
        .expect("dönüş kaydı açılmalı");
}

// ===========================================================================
// Grup projeksiyonu — E4 / E5
// ===========================================================================

#[test]
fn grup_satiri_doluluk_ve_haftalik_programi_tasir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    series(&conn, group_id, subject_id, SALI, "16:00", TODAY, None);
    series(&conn, group_id, subject_id, PERSEMBE, "18:00", TODAY, None);
    let student_id = common::student(&conn, "Elif Yılmaz");
    schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").unwrap();
    schedule::generate_sessions(&conn, today()).unwrap();

    let rows = schedule::group_rows(
        &conn,
        &GroupQuery {
            today: Some(TODAY.into()),
            ..GroupQuery::default()
        },
    )
    .expect("liste okunmalı");

    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(row.name, "Grup A");
    assert_eq!(row.subject_name, "Matematik");
    assert_eq!(row.member_count, 1);
    assert_eq!(row.capacity, 6);
    assert_eq!(row.weekly.len(), 2);
    assert_eq!(row.next_session_at.as_deref(), Some("2026-03-31 16:00"));
    assert!(!row.archived);
}

#[test]
fn ayrilmis_uye_dolulukta_sayilmaz_listede_kalir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let kalan = common::student(&conn, "Elif Yılmaz");
    let ayrilan = common::student(&conn, "Burak Kaya");
    schedule::add_group_member(&conn, group_id, kalan, "2026-02-01").unwrap();
    let bitmis = schedule::add_group_member(&conn, group_id, ayrilan, "2026-02-01").unwrap();
    schedule::end_group_membership(&conn, bitmis, "2026-03-01").unwrap();

    let detail = schedule::group_detail(&conn, group_id, Some(TODAY.into())).expect("detay");

    assert_eq!(detail.group.member_count, 1, "doluluk bugünü sayar");
    assert_eq!(detail.members.len(), 2, "geçmiş üyelik listede kalır");
    let ayrilmis = detail
        .members
        .iter()
        .find(|m| m.student_id == ayrilan)
        .expect("ayrılan üye bulunmalı");
    assert!(!ayrilmis.is_current);
    assert_eq!(ayrilmis.end_on.as_deref(), Some("2026-03-01"));
}

#[test]
fn arsivlenmis_ogrenci_dolulukta_sayilmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let student_id = common::student(&conn, "Elif Yılmaz");
    schedule::add_group_member(&conn, group_id, student_id, "2026-02-01").unwrap();
    repo::archive::<Student>(&conn, student_id).unwrap();

    let capacity = schedule::group_capacity(&conn, group_id, TODAY).unwrap();

    // §1.23: program ekranları arşivliyi saymaz (muhasebe listeleri sayar, onlar
    // bu dosyayı kullanmaz).
    assert_eq!(capacity.member_count, 0);
}

#[test]
fn arama_grup_ve_brans_adina_birden_bakar() {
    let conn = common::conn();
    let mat = common::subject(&conn, "Matematik");
    let ing = common::subject(&conn, "İngilizce");
    common::group(&conn, "Grup A", mat);
    common::group(&conn, "Grup B", ing);

    let by_group = schedule::group_rows(
        &conn,
        &GroupQuery {
            search: "grup a".into(),
            today: Some(TODAY.into()),
            ..GroupQuery::default()
        },
    )
    .unwrap();
    // Türkçe küçültme: ASCII `lower()` 'İ'yi küçültmediği için bu arama K9 olmadan
    // hiç eşleşmezdi.
    let by_subject = schedule::group_rows(
        &conn,
        &GroupQuery {
            search: "ingilizce".into(),
            today: Some(TODAY.into()),
            ..GroupQuery::default()
        },
    )
    .unwrap();

    assert_eq!(by_group.len(), 1);
    assert_eq!(by_group[0].name, "Grup A");
    assert_eq!(by_subject.len(), 1);
    assert_eq!(by_subject[0].name, "Grup B");
}

#[test]
fn grup_notlari_uyelerin_notlarindan_derlenir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let uye = common::student(&conn, "Elif Yılmaz");
    let yabanci = common::student(&conn, "Mehmet Aslan");
    schedule::add_group_member(&conn, group_id, uye, "2026-02-01").unwrap();

    repo::roster::add_note(
        &conn,
        uye,
        "Deneme sınavına hazırlanıyor",
        Some(TODAY.into()),
    )
    .unwrap();
    repo::roster::add_note(&conn, yabanci, "Bu not gruba ait değil", Some(TODAY.into())).unwrap();

    let detail = schedule::group_detail(&conn, group_id, Some(TODAY.into())).unwrap();

    assert_eq!(detail.notes.len(), 1, "ayrı bir grup notu tablosu yok");
    assert_eq!(detail.notes[0].student_name, "Elif Yılmaz");
}

// ===========================================================================
// Grup ve branş yazma
// ===========================================================================

#[test]
fn grup_kaydi_sablonu_yazar_ve_seanslari_uretir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");

    let group_id = schedule::save_group(
        &conn,
        &GroupInput {
            name: "Grup A".into(),
            subject_id,
            teacher_id: Some(1),
            capacity: 6,
            starts_on: Some(TODAY.into()),
            is_active: true,
            weekly: vec![WeeklySlot {
                id: None,
                weekday: SALI,
                start_time: "16:00".into(),
                duration_min: 60,
            }],
            ..GroupInput::default()
        },
        today(),
    )
    .expect("grup kaydedilmeli");

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session WHERE study_group_id = ?1 AND deleted_at IS NULL",
            [group_id],
            |row| row.get(0),
        )
        .unwrap();

    // R5.5: haftalık program grup oluştururken tanımlanır ve seanslar üretilir.
    assert_eq!(count, 17);
}

#[test]
fn sablon_satiri_silinince_gelecek_seanslar_duser() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = schedule::save_group(
        &conn,
        &GroupInput {
            name: "Grup A".into(),
            subject_id,
            capacity: 6,
            starts_on: Some(TODAY.into()),
            is_active: true,
            weekly: vec![
                WeeklySlot {
                    id: None,
                    weekday: SALI,
                    start_time: "16:00".into(),
                    duration_min: 60,
                },
                WeeklySlot {
                    id: None,
                    weekday: PERSEMBE,
                    start_time: "18:00".into(),
                    duration_min: 60,
                },
            ],
            ..GroupInput::default()
        },
        today(),
    )
    .unwrap();

    let detail = schedule::group_detail(&conn, group_id, Some(TODAY.into())).unwrap();
    assert_eq!(detail.group.weekly.len(), 2);
    let kalan = detail
        .group
        .weekly
        .iter()
        .find(|s| s.weekday == SALI)
        .cloned()
        .unwrap();

    schedule::save_group(
        &conn,
        &GroupInput {
            id: Some(group_id),
            name: "Grup A".into(),
            subject_id,
            capacity: 6,
            starts_on: Some(TODAY.into()),
            is_active: true,
            weekly: vec![kalan],
            ..GroupInput::default()
        },
        today(),
    )
    .unwrap();

    let after = schedule::group_detail(&conn, group_id, Some(TODAY.into())).unwrap();
    assert_eq!(after.group.weekly.len(), 1);
    assert_eq!(
        after.sessions.len(),
        17,
        "perşembe dersleri düştü, salı dersleri kaldı"
    );
}

#[test]
fn grup_adi_bos_birakilamaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");

    let err = schedule::save_group(
        &conn,
        &GroupInput {
            name: "   ".into(),
            subject_id,
            capacity: 6,
            ..GroupInput::default()
        },
        today(),
    )
    .expect_err("boş ad reddedilmeli");

    assert_eq!(err.code, "group.name");
}

#[test]
fn ayni_brans_iki_kez_kaydedilemez() {
    let conn = common::conn();
    schedule::save_subject(
        &conn,
        &SubjectInput {
            name: "Matematik".into(),
            ..SubjectInput::default()
        },
    )
    .expect("ilk branş");

    // K9: tekillik `search_name` üzerinde — `Matematik` ile `matematik` aynı branş.
    let err = schedule::save_subject(
        &conn,
        &SubjectInput {
            name: "matematik".into(),
            ..SubjectInput::default()
        },
    )
    .expect_err("mükerrer branş reddedilmeli");

    assert_eq!(err.code, "duplicate_name");
}

#[test]
fn varsayilan_sure_once_branstan_sonra_ayardan_okunur() {
    let conn = common::conn();
    let ozel = schedule::save_subject(
        &conn,
        &SubjectInput {
            name: "Matematik".into(),
            default_min: Some(90),
            ..SubjectInput::default()
        },
    )
    .unwrap();
    let bos = schedule::save_subject(
        &conn,
        &SubjectInput {
            name: "Fizik".into(),
            ..SubjectInput::default()
        },
    )
    .unwrap();

    // PRD S4: varsayılan 60 dk, branşa özel değer onu geçersiz kılar.
    assert_eq!(schedule::default_minutes(&conn, Some(ozel)).unwrap(), 90);
    assert_eq!(schedule::default_minutes(&conn, Some(bos)).unwrap(), 60);
    assert_eq!(schedule::default_minutes(&conn, None).unwrap(), 60);
}

#[test]
fn kapali_gun_aciklamasiz_kaydedilemez() {
    let conn = common::conn();

    let err = schedule::save_closed_day(
        &conn,
        &kurs_takip_lib::repo::schedule::ClosedDayInput {
            id: None,
            day: "2026-04-23".into(),
            label: "  ".into(),
        },
    )
    .expect_err("açıklamasız tatil reddedilmeli");

    assert_eq!(err.code, "closedDay.label");
}

#[test]
fn haftalik_kapali_gun_ayari_okunup_yazilabilir() {
    let conn = common::conn();

    // Migration'ın başlangıç değeri: Pazar.
    let days = schedule::weekly_closed_days(&conn).unwrap();
    assert_eq!(days.iter().copied().collect::<Vec<_>>(), vec![7]);

    set_weekly_closed(&conn, &schedule::format_weekdays(&[7, 1, 7]));
    let mut after: Vec<i64> = schedule::weekly_closed_days(&conn)
        .unwrap()
        .into_iter()
        .collect();
    after.sort_unstable();

    assert_eq!(after, vec![1, 7], "yinelenen gün tekilleşir");
}

#[test]
fn kapali_gun_hem_tatilden_hem_haftalik_ayardan_gelir() {
    let conn = common::conn();
    closed_day(&conn, "2026-04-23", "23 Nisan");

    let tatil = NaiveDate::from_ymd_opt(2026, 4, 23).unwrap();
    let pazar = NaiveDate::from_ymd_opt(2026, 4, 5).unwrap();
    let sali = NaiveDate::from_ymd_opt(2026, 4, 7).unwrap();

    assert!(
        schedule::is_closed_day(&conn, tatil).unwrap(),
        "tek seferlik tatil"
    );
    assert!(
        schedule::is_closed_day(&conn, pazar).unwrap(),
        "haftalık kapalı gün"
    );
    assert!(!schedule::is_closed_day(&conn, sali).unwrap());
}
