mod common;

use kurs_takip_lib::model::{Attendance, Session, StudyGroup, Subject};
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::reports::AbsenceReportQuery;

fn session(
    conn: &rusqlite::Connection,
    student_id: Option<i64>,
    group_id: Option<i64>,
    subject_id: i64,
    day: &str,
    status: &str,
) -> i64 {
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: group_id,
            student_id,
            subject_id,
            teacher_id: Some(1),
            starts_at: format!("{day} 13:00"),
            ends_at: format!("{day} 14:00"),
            session_date: None,
            kind: None,
            status: status.into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: Some(25_000),
            attendance_taken_at: Some(format!("{day} 14:00")),
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap()
}

fn mark(conn: &rusqlite::Connection, session_id: i64, student_id: i64, status: &str) -> i64 {
    repo::academic::insert_attendance(
        conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: status.into(),
            marked_at: Some("2026-03-31 14:00".into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap()
}

fn query(from: &str, to: &str) -> AbsenceReportQuery {
    AbsenceReportQuery {
        from: from.into(),
        to: to.into(),
        search: String::new(),
        subject_id: None,
        group_id: None,
    }
}

#[test]
fn tarih_uclari_dahil_ve_yalnizca_iki_devamsizlik_durumu_sayilir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Deniz Kaya");

    for (day, attendance_status, session_status) in [
        ("2026-03-01", "excused", "done"),
        ("2026-03-31", "unexcused", "done"),
        ("2026-03-10", "present", "done"),
        ("2026-03-11", "pending", "done"),
        ("2026-03-12", "cancelled", "done"),
        ("2026-02-28", "unexcused", "done"),
        ("2026-04-01", "excused", "done"),
        // Eski/bozuk bir kayıtta yoklama devamsız kalsa bile iptal seans rapora girmez.
        ("2026-03-15", "unexcused", "cancelled"),
    ] {
        let session_id = session(
            &conn,
            Some(student_id),
            None,
            subject_id,
            day,
            session_status,
        );
        mark(&conn, session_id, student_id, attendance_status);
    }

    let rows = repo::reports::absence_rows(&conn, &query("2026-03-01", "2026-03-31")).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].student_id, student_id);
    assert_eq!(rows[0].excused_count, 1);
    assert_eq!(rows[0].unexcused_count, 1);
    assert_eq!(rows[0].total_count, 2);
}

#[test]
fn grup_katilim_araligi_filtreler_arama_ve_mukerrer_kayit_sayimi_dogru() {
    let conn = common::conn();
    let math_id = common::subject(&conn, "Matematik");
    let physics_id = common::subject(&conn, "Fizik");
    let group_a = common::group(&conn, "Grup A", math_id);
    let group_b = common::group(&conn, "Grup B", physics_id);
    let light_id = common::student(&conn, "IŞIK Yılmaz");
    let other_id = common::student(&conn, "Özge Demir");

    common::enrollment(
        &conn,
        light_id,
        Some(group_a),
        math_id,
        "2026-03-10",
        Some("2026-03-20"),
    )
    .unwrap();
    // Eski/bozuk veride aynı gün iki kayıt bulunsa bile attendance JOIN ile çoğalmamalı.
    conn.execute(
        "INSERT INTO enrollment \
         (student_id, study_group_id, subject_id, teacher_id, pricing_model, unit_price, \
          start_on, end_on, status, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'per_session', 25000, '2026-03-10', '2026-03-20', \
                 'active', '2026-03-01 09:00', '2026-03-01 09:00')",
        rusqlite::params![light_id, group_a, math_id],
    )
    .unwrap();
    common::enrollment(
        &conn,
        other_id,
        Some(group_b),
        physics_id,
        "2026-03-01",
        None,
    )
    .unwrap();

    // Rapor, şema tetiğinden bağımsız olarak da üyelik aralığını korumalı. Eski/onarılmış
    // bir veritabanından aralık dışı yoklama gelmiş gibi iki satır kuruyoruz.
    conn.execute("DROP TRIGGER trg_attendance_within_enrollment", [])
        .unwrap();
    for day in ["2026-03-09", "2026-03-21"] {
        let session_id = session(&conn, None, Some(group_a), math_id, day, "done");
        mark(&conn, session_id, light_id, "unexcused");
    }

    // Katılım ve ayrılma günleri iki uçta da dahildir.
    for day in ["2026-03-10", "2026-03-20"] {
        let session_id = session(&conn, None, Some(group_a), math_id, day, "done");
        mark(&conn, session_id, light_id, "unexcused");
    }
    let group_b_session = session(&conn, None, Some(group_b), physics_id, "2026-03-15", "done");
    mark(&conn, group_b_session, other_id, "excused");
    let solo_session = session(
        &conn,
        Some(light_id),
        None,
        physics_id,
        "2026-03-16",
        "done",
    );
    mark(&conn, solo_session, light_id, "excused");

    let all = repo::reports::absence_rows(&conn, &query("2026-03-01", "2026-03-31")).unwrap();
    let light = all.iter().find(|row| row.student_id == light_id).unwrap();
    assert_eq!(
        (
            light.excused_count,
            light.unexcused_count,
            light.total_count
        ),
        (1, 2, 3)
    );

    let mut group_query = query("2026-03-01", "2026-03-31");
    group_query.group_id = Some(group_a);
    let group_rows = repo::reports::absence_rows(&conn, &group_query).unwrap();
    assert_eq!(group_rows.len(), 1);
    assert_eq!(group_rows[0].student_id, light_id);
    assert_eq!(group_rows[0].total_count, 2);

    let mut subject_query = query("2026-03-01", "2026-03-31");
    subject_query.subject_id = Some(physics_id);
    let subject_rows = repo::reports::absence_rows(&conn, &subject_query).unwrap();
    assert_eq!(subject_rows.len(), 2);

    subject_query.search = "ışık".into();
    let searched = repo::reports::absence_rows(&conn, &subject_query).unwrap();
    assert_eq!(searched.len(), 1);
    assert_eq!(searched[0].student_id, light_id);
}

#[test]
fn gecersiz_ve_ters_tarih_araligi_eylem_oneren_hata_verir() {
    let conn = common::conn();

    let invalid =
        repo::reports::absence_rows(&conn, &query("31.03.2026", "2026-03-31")).unwrap_err();
    assert_eq!(invalid.code, "reports.absence.date");
    assert!(invalid.message.contains("seçin"));

    let reversed =
        repo::reports::absence_rows(&conn, &query("2026-04-01", "2026-03-31")).unwrap_err();
    assert_eq!(reversed.code, "reports.absence.range");
    assert!(reversed.message.contains("düzeltip yeniden deneyin"));
}

#[test]
fn filtre_secenekleri_canlilari_ve_gecmiste_kullanilan_arsivlileri_getirir() {
    let conn = common::conn();
    let live_subject = common::subject(&conn, "Canlı Branş");
    let historical_subject = common::subject(&conn, "Arşivli Branş");
    let unused_subject = common::subject(&conn, "Kullanılmamış Branş");
    let historical_group = common::group(&conn, "Arşivli Grup", historical_subject);
    let unused_group = common::group(&conn, "Kullanılmamış Grup", unused_subject);
    let student_id = common::student(&conn, "Tarih Öğrencisi");
    common::enrollment(
        &conn,
        student_id,
        Some(historical_group),
        historical_subject,
        "2026-03-01",
        None,
    )
    .unwrap();
    let session_id = session(
        &conn,
        None,
        Some(historical_group),
        historical_subject,
        "2026-03-15",
        "done",
    );
    mark(&conn, session_id, student_id, "excused");

    repo::archive::<StudyGroup>(&conn, historical_group).unwrap();
    repo::archive::<Subject>(&conn, historical_subject).unwrap();
    repo::archive::<StudyGroup>(&conn, unused_group).unwrap();
    repo::archive::<Subject>(&conn, unused_subject).unwrap();

    let options = repo::reports::absence_filter_options(&conn).unwrap();
    assert!(options
        .subjects
        .iter()
        .any(|option| option.id == live_subject && !option.archived));
    assert!(options
        .subjects
        .iter()
        .any(|option| option.id == historical_subject && option.archived));
    assert!(!options
        .subjects
        .iter()
        .any(|option| option.id == unused_subject));
    assert!(options.groups.iter().any(|option| {
        option.id == historical_group && option.subject_id == historical_subject && option.archived
    }));
    assert!(!options
        .groups
        .iter()
        .any(|option| option.id == unused_group));

    let mut historical_query = query("2026-03-01", "2026-03-31");
    historical_query.subject_id = Some(historical_subject);
    historical_query.group_id = Some(historical_group);
    let historical_rows = repo::reports::absence_rows(&conn, &historical_query).unwrap();
    assert_eq!(historical_rows.len(), 1);
    assert_eq!(historical_rows[0].student_id, student_id);
    assert_eq!(historical_rows[0].excused_count, 1);
}
