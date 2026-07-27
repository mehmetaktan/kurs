//! Faz 6 §4 — öğrenci detayı ders geçmişi projeksiyonu.
//!
//! Saat her testte `local_now` biçiminde sabittir; SQLite saati okunmaz (ADR-029).

mod common;

use kurs_takip_lib::model::{Attendance, Session};
use kurs_takip_lib::repo;

const NOW: &str = "2026-03-31 12:00";

fn solo_session(
    conn: &rusqlite::Connection,
    student_id: i64,
    subject_id: i64,
    starts_at: &str,
    status: &str,
) -> i64 {
    let day = &starts_at[..10];
    let hour: i64 = starts_at[11..13].parse().expect("saat");
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: starts_at.into(),
            ends_at: format!("{day} {:02}:00", hour + 1),
            session_date: None,
            kind: None,
            status: status.into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: None,
            attendance_taken_at: (status == "done").then(|| starts_at.to_string()),
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("birebir seans yazılmalı")
}

fn solo_session_between(
    conn: &rusqlite::Connection,
    student_id: i64,
    subject_id: i64,
    starts_at: &str,
    ends_at: &str,
    status: &str,
) -> i64 {
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: starts_at.into(),
            ends_at: ends_at.into(),
            session_date: None,
            kind: None,
            status: status.into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: None,
            attendance_taken_at: (status == "done").then(|| starts_at.to_string()),
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("zaman aralıklı birebir seans yazılmalı")
}

fn mark(conn: &rusqlite::Connection, session_id: i64, student_id: i64, status: &str) -> i64 {
    repo::academic::insert_attendance(
        conn,
        &Attendance {
            id: None,
            session_id,
            student_id,
            status: status.into(),
            marked_at: Some("2026-03-31 12:00".into()),
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("yoklama yazılmalı")
}

fn makeup_session(
    conn: &rusqlite::Connection,
    student_id: i64,
    subject_id: i64,
    attendance_id: i64,
    starts_at: &str,
    status: &str,
) -> i64 {
    let day = &starts_at[..10];
    let hour: i64 = starts_at[11..13].parse().expect("saat");
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: starts_at.into(),
            ends_at: format!("{day} {:02}:00", hour + 1),
            session_date: None,
            kind: None,
            status: status.into(),
            is_makeup: true,
            makeup_for_attendance_id: Some(attendance_id),
            unit_price: None,
            attendance_taken_at: (status == "done").then(|| starts_at.to_string()),
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("telafi seansı yazılmalı")
}

#[test]
fn devam_yuzdesi_pending_ve_iptali_paydaya_almaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Elif Yılmaz");

    let pending = solo_session(&conn, student_id, subject_id, "2026-03-30 10:00", "planned");
    let cancelled = solo_session(
        &conn,
        student_id,
        subject_id,
        "2026-03-29 10:00",
        "cancelled",
    );

    let empty =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(empty.attendance_percentage, None);
    assert_eq!(empty.attendance_eligible_count, 0);
    assert_eq!(empty.present_count, 0);
    assert_eq!(
        empty
            .lessons
            .iter()
            .map(|row| (row.session_id, row.status.as_str()))
            .collect::<Vec<_>>(),
        vec![(pending, "pending"), (cancelled, "cancelled")]
    );

    for (stamp, status) in [
        ("2026-03-28 10:00", "present"),
        ("2026-03-27 10:00", "excused"),
        ("2026-03-26 10:00", "unexcused"),
    ] {
        let session_id = solo_session(&conn, student_id, subject_id, stamp, "done");
        mark(&conn, session_id, student_id, status);
    }

    let overview =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(overview.attendance_eligible_count, 3);
    assert_eq!(overview.present_count, 1);
    assert_eq!(
        overview.attendance_percentage,
        Some(33),
        "pay yalnızca Geldi; Mazeretli ve Mazeretsiz paydaya girer"
    );
}

#[test]
fn uc_aylik_pencere_local_tarihten_hesaplanir_ve_uclari_kapsar() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Elif Yılmaz");

    for (stamp, status) in [
        ("2025-12-30 10:00", "unexcused"), // sınırın bir gün öncesi
        ("2025-12-31 10:00", "excused"),   // üç takvim ayı sınırı, dahil
        ("2026-03-31 11:00", "unexcused"), // local_now'dan önce, dahil
    ] {
        let session_id = solo_session(&conn, student_id, subject_id, stamp, "done");
        mark(&conn, session_id, student_id, status);
    }
    // Aynı gün ama local_now'dan sonra: geçmiş listesine ve dağılıma giremez.
    solo_session(&conn, student_id, subject_id, "2026-03-31 13:00", "planned");

    let overview =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(overview.absence_window_start, "2025-12-31");
    assert_eq!(overview.excused_absences, 1);
    assert_eq!(overview.unexcused_absences, 1);
    assert_eq!(overview.lessons.len(), 3);
    assert_eq!(overview.lessons[0].starts_at, "2026-03-31 11:00");
}

#[test]
fn gecmis_yalnizca_local_now_aninda_bitmis_dersleri_kapsar() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Elif Yılmaz");

    let completed = solo_session_between(
        &conn,
        student_id,
        subject_id,
        "2026-03-31 10:00",
        "2026-03-31 11:00",
        "done",
    );
    mark(&conn, completed, student_id, "present");

    // Başladı ama local_now anında bitmedi: geçmişe ve ondan türeyen hiçbir sayaca girmez.
    let in_progress = solo_session_between(
        &conn,
        student_id,
        subject_id,
        "2026-03-31 11:30",
        "2026-03-31 12:30",
        "done",
    );
    mark(&conn, in_progress, student_id, "excused");

    let future = solo_session_between(
        &conn,
        student_id,
        subject_id,
        "2026-03-31 13:00",
        "2026-03-31 14:00",
        "done",
    );
    mark(&conn, future, student_id, "unexcused");

    let overview =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(
        overview
            .lessons
            .iter()
            .map(|row| row.session_id)
            .collect::<Vec<_>>(),
        vec![completed]
    );
    assert_eq!(overview.attendance_eligible_count, 1);
    assert_eq!(overview.present_count, 1);
    assert_eq!(overview.attendance_percentage, Some(100));
    assert_eq!(overview.excused_absences, 0);
    assert_eq!(overview.unexcused_absences, 0);
}

#[test]
fn grup_gecmisi_katilim_araligini_ve_tarih_sirasini_korur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "İngilizce");
    let group_id = common::group(&conn, "İleri Grup", subject_id);
    let student_id = common::student(&conn, "İpek Şahin");
    common::enrollment(
        &conn,
        student_id,
        Some(group_id),
        subject_id,
        "2026-03-01",
        Some("2026-03-15"),
    )
    .unwrap();

    common::group_session(&conn, group_id, subject_id, "2026-02-28");
    let included = common::group_session(&conn, group_id, subject_id, "2026-03-10");
    common::group_session(&conn, group_id, subject_id, "2026-03-20");
    let solo = solo_session(
        &conn,
        student_id,
        subject_id,
        "2026-03-12 10:00",
        "cancelled",
    );

    let overview =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(
        overview
            .lessons
            .iter()
            .map(|row| (
                row.session_id,
                row.status.as_str(),
                row.group_name.as_deref()
            ))
            .collect::<Vec<_>>(),
        vec![
            (solo, "cancelled", None),
            (included, "pending", Some("İleri Grup")),
        ]
    );
}

#[test]
fn bekleyen_telafi_kaynak_yoklama_basina_bir_satirdir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let student_id = common::student(&conn, "Elif Yılmaz");

    let source = |stamp: &str| {
        let session_id = solo_session(&conn, student_id, subject_id, stamp, "done");
        mark(&conn, session_id, student_id, "excused")
    };

    let unplanned = source("2026-03-01 10:00");
    let planned = source("2026-03-02 10:00");
    let closed = source("2026-03-03 10:00");
    let cancelled = source("2026-03-04 10:00");

    let planned_session = makeup_session(
        &conn,
        student_id,
        subject_id,
        planned,
        "2026-04-05 10:00",
        "planned",
    );
    makeup_session(
        &conn,
        student_id,
        subject_id,
        closed,
        "2026-03-20 10:00",
        "done",
    );
    makeup_session(
        &conn,
        student_id,
        subject_id,
        cancelled,
        "2026-04-06 10:00",
        "cancelled",
    );

    let overview =
        repo::attendance::student_lesson_overview(&conn, student_id, NOW).expect("özet okunmalı");
    assert_eq!(overview.pending_makeups.len(), 3);
    assert_eq!(
        overview
            .pending_makeups
            .iter()
            .map(|row| row.attendance_id)
            .collect::<Vec<_>>(),
        vec![cancelled, planned, unplanned]
    );
    let planned_row = overview
        .pending_makeups
        .iter()
        .find(|row| row.attendance_id == planned)
        .expect("planlı telafi listede");
    assert_eq!(planned_row.makeup_session_id, Some(planned_session));
    assert_eq!(
        planned_row.makeup_starts_at.as_deref(),
        Some("2026-04-05 10:00")
    );
    let cancelled_row = overview
        .pending_makeups
        .iter()
        .find(|row| row.attendance_id == cancelled)
        .expect("iptal edilen telafinin kaynağı yeniden bekler");
    assert_eq!(cancelled_row.makeup_session_id, None);
}
