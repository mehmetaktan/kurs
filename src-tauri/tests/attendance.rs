mod common;

use kurs_takip_lib::model::{Package, Session};
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::attendance::{AttendanceMarkInput, SaveAttendanceInput};

fn solo_session(conn: &rusqlite::Connection, student_id: i64, subject_id: i64, day: &str) -> i64 {
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: None,
            student_id: Some(student_id),
            subject_id,
            teacher_id: Some(1),
            starts_at: format!("{day} 13:00"),
            ends_at: format!("{day} 14:00"),
            session_date: None,
            kind: None,
            status: "planned".into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price: Some(30_000),
            attendance_taken_at: None,
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap()
}

#[test]
fn grup_listesi_seans_tarihindeki_katilim_araligini_kullanir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let joined_on_day = common::student(&conn, "Başlangıç Dahil");
    let left_on_day = common::student(&conn, "Bitiş Dahil");
    let left_before = common::student(&conn, "Önce Ayrıldı");
    let joins_after = common::student(&conn, "Sonra Katılacak");
    let never_joined = common::student(&conn, "Kayıtsız");

    common::enrollment(
        &conn,
        joined_on_day,
        Some(group_id),
        subject_id,
        "2026-03-15",
        None,
    )
    .unwrap();
    common::enrollment(
        &conn,
        left_on_day,
        Some(group_id),
        subject_id,
        "2026-03-01",
        Some("2026-03-15"),
    )
    .unwrap();
    common::enrollment(
        &conn,
        left_before,
        Some(group_id),
        subject_id,
        "2026-03-01",
        Some("2026-03-14"),
    )
    .unwrap();
    common::enrollment(
        &conn,
        joins_after,
        Some(group_id),
        subject_id,
        "2026-03-16",
        None,
    )
    .unwrap();

    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-15");
    let detail = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
    let ids: std::collections::HashSet<_> = detail.rows.iter().map(|row| row.student_id).collect();

    assert_eq!(ids.len(), 2);
    assert!(ids.contains(&joined_on_day));
    assert!(ids.contains(&left_on_day));
    assert!(!ids.contains(&left_before));
    assert!(!ids.contains(&joins_after));
    assert!(!ids.contains(&never_joined));
    assert!(detail.rows.iter().all(|row| row.status == "pending"));
}

#[test]
fn birebir_panel_yalnizca_seansin_ogrencisini_getirir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Fizik");
    let student_id = common::student(&conn, "İpek Şahin");
    let other_id = common::student(&conn, "Başka Öğrenci");
    let session_id = solo_session(&conn, student_id, subject_id, "2026-03-20");

    let detail = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();

    assert_eq!(detail.kind, "solo");
    assert_eq!(detail.rows.len(), 1);
    assert_eq!(detail.rows[0].student_id, student_id);
    assert_ne!(detail.rows[0].student_id, other_id);
    assert_eq!(detail.rows[0].effects.present.debt_kurus, 30_000);
}

#[test]
fn onizleme_politikayi_ayardan_ve_finans_turunu_tek_kaynaktan_okur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let group_id = common::group(&conn, "Grup B", subject_id);
    let packaged = common::student(&conn, "Paketli Öğrenci");
    let per_session = common::student(&conn, "Ders Başı Öğrenci");
    common::enrollment(
        &conn,
        packaged,
        Some(group_id),
        subject_id,
        "2026-03-01",
        None,
    )
    .unwrap();
    common::enrollment(
        &conn,
        per_session,
        Some(group_id),
        subject_id,
        "2026-03-01",
        None,
    )
    .unwrap();
    common::package(&conn, packaged);
    repo::setting::set(&conn, "absence_excused_consumes_lesson", "1").unwrap();
    repo::setting::set(&conn, "absence_unexcused_consumes_lesson", "0").unwrap();
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

    let detail = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
    assert!(detail.policy.excused_consumes_lesson);
    assert!(!detail.policy.unexcused_consumes_lesson);

    let package_row = detail
        .rows
        .iter()
        .find(|row| row.student_id == packaged)
        .unwrap();
    assert_eq!(package_row.effects.excused.lesson_credits, 1);
    assert_eq!(package_row.effects.unexcused.lesson_credits, 0);

    let charge_row = detail
        .rows
        .iter()
        .find(|row| row.student_id == per_session)
        .unwrap();
    assert_eq!(charge_row.effects.excused.debt_kurus, 25_000);
    assert_eq!(charge_row.effects.unexcused.debt_kurus, 0);
}

#[test]
fn eski_yoklamanin_onizlemesi_bugunku_paketle_finans_turunu_degistirmez() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let group_id = common::group(&conn, "Grup B", subject_id);
    let charged = common::student(&conn, "Sonradan Paket Alan");
    let exhausted = common::student(&conn, "Paketi Tükenen");
    for student_id in [charged, exhausted] {
        common::enrollment(
            &conn,
            student_id,
            Some(group_id),
            subject_id,
            "2026-03-01",
            None,
        )
        .unwrap();
    }
    let one_lesson_package = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: exhausted,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 1,
            unit_price: 25_000,
            total_price: 25_000,
            sold_on: "2026-03-01".into(),
            valid_until: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");
    repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![
                AttendanceMarkInput {
                    student_id: charged,
                    status: "present".into(),
                    note: None,
                },
                AttendanceMarkInput {
                    student_id: exhausted,
                    status: "present".into(),
                    note: None,
                },
            ],
        },
    )
    .unwrap();
    let rows = repo::academic::attendance_of_session(&conn, session_id).unwrap();
    let charged_attendance = rows
        .iter()
        .find(|row| row.student_id == charged)
        .and_then(|row| row.id)
        .unwrap();
    let exhausted_attendance = rows
        .iter()
        .find(|row| row.student_id == exhausted)
        .and_then(|row| row.id)
        .unwrap();
    repo::finance::charge_session(&conn, charged_attendance, common::TODAY).unwrap();
    repo::finance::consume_package_credit(&conn, exhausted_attendance, common::TODAY).unwrap();
    assert_eq!(common::remaining(&conn, one_lesson_package), 0);
    // Ders başı ücret yazıldıktan sonra alınan paket geçmiş sınıflandırmayı değiştiremez.
    common::package(&conn, charged);

    let detail = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
    let charged_row = detail
        .rows
        .iter()
        .find(|row| row.student_id == charged)
        .unwrap();
    assert_eq!(charged_row.effects.present.debt_kurus, 0);
    assert_eq!(charged_row.effects.excused.debt_kurus, -25_000);
    let exhausted_row = detail
        .rows
        .iter()
        .find(|row| row.student_id == exhausted)
        .unwrap();
    assert_eq!(exhausted_row.effects.present.lesson_credits, 0);
    assert_eq!(exhausted_row.effects.excused.lesson_credits, -1);

    // Geldi → Mazeretli yönündeki etkiler uygulanmış olsun. Aynı API artık ters yönü,
    // Mazeretli → Geldi için eklenecek hak/borç olarak göstermeli.
    repo::finance::reverse_session_charge(&conn, charged_attendance, common::TODAY).unwrap();
    repo::finance::restore_package_credit(&conn, exhausted_attendance).unwrap();
    let restored = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
    let charged_row = restored
        .rows
        .iter()
        .find(|row| row.student_id == charged)
        .unwrap();
    assert_eq!(charged_row.effects.present.debt_kurus, 25_000);
    assert_eq!(charged_row.effects.excused.debt_kurus, 0);
    let exhausted_row = restored
        .rows
        .iter()
        .find(|row| row.student_id == exhausted)
        .unwrap();
    assert_eq!(exhausted_row.effects.present.lesson_credits, 1);
    assert_eq!(exhausted_row.effects.excused.lesson_credits, 0);
}

#[test]
fn kaydetme_durum_ve_notu_atomik_yazar_finansa_ve_seansa_dokunmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let first = common::student(&conn, "Elif Yılmaz");
    let second = common::student(&conn, "Mert Kaya");
    for student_id in [first, second] {
        common::enrollment(
            &conn,
            student_id,
            Some(group_id),
            subject_id,
            "2026-03-01",
            None,
        )
        .unwrap();
    }
    common::package(&conn, first);
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

    let report = repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![
                AttendanceMarkInput {
                    student_id: first,
                    status: "present".into(),
                    note: Some("  Erken geldi  ".into()),
                },
                AttendanceMarkInput {
                    student_id: second,
                    status: "excused".into(),
                    note: Some("".into()),
                },
            ],
        },
    )
    .unwrap();

    assert_eq!(report.saved, 2);
    let rows = repo::academic::attendance_of_session(&conn, session_id).unwrap();
    assert_eq!(rows.len(), 2);
    let first_row = rows.iter().find(|row| row.student_id == first).unwrap();
    assert_eq!(first_row.status, "present");
    assert_eq!(first_row.note.as_deref(), Some("Erken geldi"));
    assert_eq!(first_row.marked_at.as_deref(), Some("2026-03-31 18:05"));
    let second_row = rows.iter().find(|row| row.student_id == second).unwrap();
    assert_eq!(second_row.status, "excused");
    assert_eq!(second_row.note, None);

    // Aynı panel tekrar kaydedildiğinde UNIQUE satıra çarpmaz; var olan yoklama
    // güncellenir. §2 bu aynı düzeltme yoluna ters finans halkalarını bağlayacak.
    repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:10".into(),
            marks: vec![
                AttendanceMarkInput {
                    student_id: first,
                    status: "excused".into(),
                    note: None,
                },
                AttendanceMarkInput {
                    student_id: second,
                    status: "unexcused".into(),
                    note: Some("Haber vermedi".into()),
                },
            ],
        },
    )
    .unwrap();
    let corrected = repo::academic::attendance_of_session(&conn, session_id).unwrap();
    assert_eq!(corrected.len(), 2);
    assert_eq!(
        corrected
            .iter()
            .find(|row| row.student_id == first)
            .unwrap()
            .status,
        "excused"
    );
    assert_eq!(
        corrected
            .iter()
            .find(|row| row.student_id == second)
            .unwrap()
            .note
            .as_deref(),
        Some("Haber vermedi")
    );

    let financial_rows: i64 = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM ledger_entry WHERE attendance_id IS NOT NULL) + \
                    (SELECT COUNT(*) FROM package_usage WHERE attendance_id IS NOT NULL)",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(financial_rows, 0, "§1 finans/tüketim satırı yazmamalı");
    let session_state: (String, Option<String>) = conn
        .query_row(
            "SELECT status, attendance_taken_at FROM session WHERE id = ?1",
            [session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(session_state, ("planned".into(), None));
}

#[test]
fn gecersiz_veya_eksik_liste_hicbir_yoklama_satiri_yazmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let first = common::student(&conn, "Elif Yılmaz");
    let second = common::student(&conn, "Mert Kaya");
    for student_id in [first, second] {
        common::enrollment(
            &conn,
            student_id,
            Some(group_id),
            subject_id,
            "2026-03-01",
            None,
        )
        .unwrap();
    }
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");
    let err = repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![AttendanceMarkInput {
                student_id: first,
                status: "present".into(),
                note: None,
            }],
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "attendance.participants");
    assert!(repo::academic::attendance_of_session(&conn, session_id)
        .unwrap()
        .is_empty());

    let err = repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![
                AttendanceMarkInput {
                    student_id: first,
                    status: "late".into(),
                    note: None,
                },
                AttendanceMarkInput {
                    student_id: second,
                    status: "present".into(),
                    note: None,
                },
            ],
        },
    )
    .unwrap_err();
    assert_eq!(err.code, "attendance.status");
    assert!(repo::academic::attendance_of_session(&conn, session_id)
        .unwrap()
        .is_empty());
}

#[test]
fn ikinci_db_yazimi_patlayinca_ilk_yoklama_da_geri_alinir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Matematik");
    let group_id = common::group(&conn, "Grup A", subject_id);
    let first = common::student(&conn, "İlk Öğrenci");
    let second = common::student(&conn, "İkinci Öğrenci");
    for student_id in [first, second] {
        common::enrollment(
            &conn,
            student_id,
            Some(group_id),
            subject_id,
            "2026-03-01",
            None,
        )
        .unwrap();
    }
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");
    // Yalnız test bağlantısında: ilk INSERT geçer, ikinci öğrencinin INSERT'i gerçek
    // SQLite hatasıyla transaction'ın ortasında durur.
    conn.execute_batch(&format!(
        "CREATE TEMP TRIGGER fail_second_attendance \
         BEFORE INSERT ON attendance WHEN NEW.student_id = {second} \
         BEGIN SELECT RAISE(ABORT, 'forced_second_attendance_failure'); END;"
    ))
    .unwrap();

    let err = repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![
                AttendanceMarkInput {
                    student_id: first,
                    status: "present".into(),
                    note: None,
                },
                AttendanceMarkInput {
                    student_id: second,
                    status: "present".into(),
                    note: None,
                },
            ],
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "sqlite");
    assert!(repo::academic::attendance_of_session(&conn, session_id)
        .unwrap()
        .is_empty());
}
