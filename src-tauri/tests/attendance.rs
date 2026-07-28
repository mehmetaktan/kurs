mod common;

use kurs_takip_lib::model::{Enrollment, Package, Session};
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::attendance::{AttendanceMarkInput, SaveAttendanceInput};
use kurs_takip_lib::repo::schedule::MakeupSessionInput;

fn solo_session(conn: &rusqlite::Connection, student_id: i64, subject_id: i64, day: &str) -> i64 {
    solo_session_with(conn, student_id, subject_id, day, Some(30_000), false)
}

fn solo_session_with(
    conn: &rusqlite::Connection,
    student_id: i64,
    subject_id: i64,
    day: &str,
    unit_price: Option<i64>,
    is_makeup: bool,
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
            starts_at: format!("{day} 13:00"),
            ends_at: format!("{day} 14:00"),
            session_date: None,
            kind: None,
            status: "planned".into(),
            is_makeup,
            makeup_for_attendance_id: None,
            unit_price,
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

fn attendance_id(conn: &rusqlite::Connection, session_id: i64, student_id: i64) -> i64 {
    conn.query_row(
        "SELECT id FROM attendance WHERE session_id = ?1 AND student_id = ?2",
        rusqlite::params![session_id, student_id],
        |row| row.get(0),
    )
    .unwrap()
}

fn balance(conn: &rusqlite::Connection, student_id: i64) -> i64 {
    conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM ledger_entry \
         WHERE student_id = ?1 AND deleted_at IS NULL",
        [student_id],
        |row| row.get(0),
    )
    .unwrap()
}

fn financial_row_counts(conn: &rusqlite::Connection, attendance_id: i64) -> (i64, i64) {
    conn.query_row(
        "WITH RECURSIVE charge_chain(id) AS ( \
           SELECT id FROM ledger_entry \
           WHERE attendance_id = ?1 AND kind = 'session_charge' \
           UNION ALL \
           SELECT entry.id FROM ledger_entry entry \
           JOIN charge_chain previous ON entry.reverses_id = previous.id \
         ) \
         SELECT (SELECT COUNT(*) FROM package_usage WHERE attendance_id = ?1), \
                (SELECT COUNT(*) FROM charge_chain)",
        [attendance_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .unwrap()
}

fn assert_session_charge_chain(
    conn: &rusqlite::Connection,
    attendance_id: i64,
    student_id: i64,
    expected_len: usize,
    expected_balance: i64,
) {
    let rows: Vec<(i64, String, i64, Option<i64>)> = conn
        .prepare(
            "WITH RECURSIVE chain(id, kind, amount, reverses_id) AS ( \
               SELECT id, kind, amount, reverses_id FROM ledger_entry \
               WHERE attendance_id = ?1 AND kind = 'session_charge' \
                 AND deleted_at IS NULL \
               UNION ALL \
               SELECT entry.id, entry.kind, entry.amount, entry.reverses_id \
               FROM ledger_entry entry JOIN chain previous \
                 ON entry.reverses_id = previous.id \
               WHERE entry.deleted_at IS NULL \
             ) \
             SELECT id, kind, amount, reverses_id FROM chain ORDER BY id",
        )
        .unwrap()
        .query_map([attendance_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();

    assert_eq!(rows.len(), expected_len);
    assert_eq!(rows[0].1, "session_charge");
    assert_eq!(rows[0].2, -25_000);
    assert_eq!(rows[0].3, None);
    for pair in rows.windows(2) {
        let previous = &pair[0];
        let current = &pair[1];
        assert_eq!(current.1, "reversal");
        assert_eq!(current.2, -previous.2);
        assert_eq!(current.3, Some(previous.0));
    }

    let head_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ledger_entry \
             WHERE attendance_id = ?1 AND kind = 'session_charge' \
               AND reverses_id IS NULL AND deleted_at IS NULL",
            [attendance_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        head_count, 1,
        "düzeltme ikinci session_charge başlığı açmamalı"
    );

    let (view_balance, effective_sum): (i64, i64) = conn
        .query_row(
            "SELECT b.balance_kurus, \
                    COALESCE((SELECT SUM(e.amount) FROM v_ledger_effective e \
                              WHERE e.student_id = b.student_id), 0) \
             FROM v_student_balance b WHERE b.student_id = ?1",
            [student_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(balance(conn, student_id), expected_balance);
    assert_eq!(view_balance, expected_balance);
    assert_eq!(effective_sum, expected_balance);
    common::assert_ledger_invariant(conn);
}

fn assert_package_usage_chain(
    conn: &rusqlite::Connection,
    attendance_id: i64,
    package_id: i64,
    expected_len: usize,
    expected_remaining: i64,
) {
    let rows: Vec<(i64, i64, i64, Option<i64>)> = conn
        .prepare(
            "SELECT id, package_id, delta, reverses_id FROM package_usage \
             WHERE attendance_id = ?1 AND deleted_at IS NULL ORDER BY id",
        )
        .unwrap()
        .query_map([attendance_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();

    assert_eq!(rows.len(), expected_len);
    assert_eq!(rows[0], (rows[0].0, package_id, -1, None));
    for pair in rows.windows(2) {
        let previous = &pair[0];
        let current = &pair[1];
        assert_eq!(current.1, package_id);
        assert_eq!(current.2, -previous.2);
        assert_eq!(current.3, Some(previous.0));
    }

    let (lesson_count, usage_sum, remaining): (i64, i64, i64) = conn
        .query_row(
            "SELECT p.lesson_count, \
                    COALESCE((SELECT SUM(u.delta) FROM package_usage u \
                              WHERE u.package_id = p.id AND u.deleted_at IS NULL), 0), \
                    r.remaining \
             FROM package p JOIN v_package_remaining r ON r.package_id = p.id \
             WHERE p.id = ?1",
            [package_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(remaining, lesson_count + usage_sum);
    assert_eq!(remaining, expected_remaining);
    assert_eq!(common::remaining(conn, package_id), expected_remaining);
}

fn save_one(
    conn: &rusqlite::Connection,
    session_id: i64,
    student_id: i64,
    status: &str,
    marked_at: &str,
) {
    repo::attendance::save_attendance(
        conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: marked_at.into(),
            marks: vec![AttendanceMarkInput {
                student_id,
                status: status.into(),
                note: None,
            }],
        },
    )
    .unwrap();
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
fn kaydetme_paketliyi_yalniz_haktan_paketsizi_yalniz_defterden_isler_ve_seansi_bitirir() {
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
    let package_id = common::package(&conn, first);
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

    let input = SaveAttendanceInput {
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
                status: "present".into(),
                note: Some("".into()),
            },
        ],
    };
    let report = repo::attendance::save_attendance(&conn, &input).unwrap();

    assert_eq!(report.saved, 2);
    let rows = repo::academic::attendance_of_session(&conn, session_id).unwrap();
    assert_eq!(rows.len(), 2);
    let first_row = rows.iter().find(|row| row.student_id == first).unwrap();
    assert_eq!(first_row.status, "present");
    assert_eq!(first_row.note.as_deref(), Some("Erken geldi"));
    assert_eq!(first_row.marked_at.as_deref(), Some("2026-03-31 18:05"));
    let second_row = rows.iter().find(|row| row.student_id == second).unwrap();
    assert_eq!(second_row.status, "present");
    assert_eq!(second_row.note, None);

    let first_attendance = first_row.id.unwrap();
    let second_attendance = second_row.id.unwrap();
    assert_eq!(financial_row_counts(&conn, first_attendance), (1, 0));
    assert_eq!(financial_row_counts(&conn, second_attendance), (0, 1));
    assert_eq!(common::remaining(&conn, package_id), 7);
    assert_eq!(balance(&conn, second), -25_000);

    let session_state: (String, Option<String>) = conn
        .query_row(
            "SELECT status, attendance_taken_at FROM session WHERE id = ?1",
            [session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        session_state,
        ("done".into(), Some("2026-03-31 18:05".into()))
    );

    // Aynı panelin aynı hedefle tekrar kaydı, ne ikinci hak ne ikinci borç yazar.
    repo::attendance::save_attendance(&conn, &input).unwrap();
    assert_eq!(financial_row_counts(&conn, first_attendance), (1, 0));
    assert_eq!(financial_row_counts(&conn, second_attendance), (0, 1));
    assert_eq!(common::remaining(&conn, package_id), 7);
    assert_eq!(balance(&conn, second), -25_000);
    common::assert_ledger_invariant(&conn);
}

#[test]
fn aktif_paket_gunu_dogrulanmis_local_now_degerinden_gelir() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Kimya");
    let student_id = common::student(&conn, "Paketi Bugün Dolmuş");
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 1,
            unit_price: 30_000,
            total_price: 30_000,
            sold_on: "2026-03-01".into(),
            // Ders gününde aktiftir; `local_now` gününde artık aktif değildir.
            valid_until: Some("2026-03-20".into()),
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let session_id = solo_session(&conn, student_id, subject_id, "2026-03-20");

    save_one(&conn, session_id, student_id, "present", "2026-03-31 00:05");

    let attendance_id = attendance_id(&conn, session_id, student_id);
    assert_eq!(financial_row_counts(&conn, attendance_id), (0, 1));
    assert_eq!(common::remaining(&conn, package_id), 1);
    assert_eq!(balance(&conn, student_id), -30_000);
    let timestamp: String = conn
        .query_row(
            "SELECT attendance_taken_at FROM session WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(timestamp, "2026-03-31 00:05");
}

#[test]
fn mazeret_ayarlari_iki_degerde_de_para_ve_hak_yonunu_belirler() {
    for (status, setting_key, setting_value, consumes) in [
        ("excused", "absence_excused_consumes_lesson", "0", false),
        ("excused", "absence_excused_consumes_lesson", "1", true),
        ("unexcused", "absence_unexcused_consumes_lesson", "0", false),
        ("unexcused", "absence_unexcused_consumes_lesson", "1", true),
    ] {
        let conn = common::conn();
        let subject_id = common::subject(&conn, "Politika");
        let group_id = common::group(&conn, "Politika Grubu", subject_id);
        let packaged = common::student(&conn, "Paketli");
        let per_session = common::student(&conn, "Ders Başı");
        for student_id in [packaged, per_session] {
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
        let package_id = common::package(&conn, packaged);
        repo::setting::set(&conn, setting_key, setting_value).unwrap();
        let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

        repo::attendance::save_attendance(
            &conn,
            &SaveAttendanceInput {
                session_id,
                marked_at: "2026-03-31 18:05".into(),
                marks: [packaged, per_session]
                    .into_iter()
                    .map(|student_id| AttendanceMarkInput {
                        student_id,
                        status: status.into(),
                        note: None,
                    })
                    .collect(),
            },
        )
        .unwrap();

        let package_attendance = attendance_id(&conn, session_id, packaged);
        let charged_attendance = attendance_id(&conn, session_id, per_session);
        assert_eq!(
            financial_row_counts(&conn, package_attendance),
            if consumes { (1, 0) } else { (0, 0) },
            "{status}={setting_value} paket etkisi"
        );
        assert_eq!(
            financial_row_counts(&conn, charged_attendance),
            if consumes { (0, 1) } else { (0, 0) },
            "{status}={setting_value} defter etkisi"
        );
        assert_eq!(
            common::remaining(&conn, package_id),
            if consumes { 7 } else { 8 }
        );
        assert_eq!(
            balance(&conn, per_session),
            if consumes { -25_000 } else { 0 }
        );
        common::assert_ledger_invariant(&conn);
    }
}

#[test]
fn save_attendance_dort_halkali_duzeltmede_iki_finans_degismezini_korur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Geometri");
    let group_id = common::group(&conn, "Geometri Grubu", subject_id);
    let packaged = common::student(&conn, "Baştan Paketli");
    let charged = common::student(&conn, "Sonradan Paketli");
    for student_id in [packaged, charged] {
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
    let original_package = common::package(&conn, packaged);
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");
    let mut planned_makeup_id = None;

    for (step, status, marked_at, expected_rows, expected_remaining, expected_balance) in [
        (1, "present", "2026-03-31 18:01", 1, 7, -25_000),
        (2, "excused", "2026-04-01 18:02", 2, 8, 0),
        (3, "present", "2026-04-02 18:03", 3, 7, -25_000),
        (4, "excused", "2026-04-03 18:04", 4, 8, 0),
    ] {
        if step == 3 {
            // Borç zinciri açıldıktan sonra paket almak geçmiş dersi paket
            // sınıfına taşıyamaz; tersin tersi yine deftere yazılır.
            common::package(&conn, charged);
        }
        let input = SaveAttendanceInput {
            session_id,
            marked_at: marked_at.into(),
            marks: [packaged, charged]
                .into_iter()
                .map(|student_id| AttendanceMarkInput {
                    student_id,
                    status: status.into(),
                    note: None,
                })
                .collect(),
        };
        repo::attendance::save_attendance(&conn, &input).unwrap();

        let package_attendance = attendance_id(&conn, session_id, packaged);
        let charged_attendance = attendance_id(&conn, session_id, charged);
        assert_eq!(
            financial_row_counts(&conn, package_attendance),
            (expected_rows, 0)
        );
        assert_eq!(
            financial_row_counts(&conn, charged_attendance),
            (0, expected_rows)
        );
        assert_package_usage_chain(
            &conn,
            package_attendance,
            original_package,
            expected_rows as usize,
            expected_remaining,
        );
        assert_session_charge_chain(
            &conn,
            charged_attendance,
            charged,
            expected_rows as usize,
            expected_balance,
        );

        // `attendance_detail`, Tauri komutunun ekrana döndürdüğü aynı kalıcı
        // projeksiyondur. Her kayıttan sonra bir sonraki yönü gerçek zincir ucundan okur.
        let detail = repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
        let package_row = detail
            .rows
            .iter()
            .find(|row| row.student_id == packaged)
            .unwrap();
        let charged_row = detail
            .rows
            .iter()
            .find(|row| row.student_id == charged)
            .unwrap();
        assert_eq!(package_row.status, status);
        assert_eq!(charged_row.status, status);
        let currently_consumed = step % 2 == 1;
        assert_eq!(
            package_row.effects.present.lesson_credits,
            if currently_consumed { 0 } else { 1 }
        );
        assert_eq!(
            package_row.effects.excused.lesson_credits,
            if currently_consumed { -1 } else { 0 }
        );
        assert_eq!(
            charged_row.effects.present.debt_kurus,
            if currently_consumed { 0 } else { 25_000 }
        );
        assert_eq!(
            charged_row.effects.excused.debt_kurus,
            if currently_consumed { -25_000 } else { 0 }
        );

        // Çift tık/ağ tekrarı aynı hedefi yeniden gönderse de yön fonksiyonları
        // mevcut ucu görür; ne ikinci başlık ne de yeni reversal oluşur.
        repo::attendance::save_attendance(&conn, &input).unwrap();
        assert_package_usage_chain(
            &conn,
            package_attendance,
            original_package,
            expected_rows as usize,
            expected_remaining,
        );
        assert_session_charge_chain(
            &conn,
            charged_attendance,
            charged,
            expected_rows as usize,
            expected_balance,
        );

        let debts = repo::attendance::makeup_debt_rows(&conn).unwrap();
        if currently_consumed {
            assert!(debts.is_empty());
        } else {
            assert_eq!(debts.len(), 2);
            assert!(debts.iter().all(|row| row.pending_count == 1));
        }

        if step == 2 {
            let report = repo::schedule::save_makeup_session(
                &conn,
                &MakeupSessionInput {
                    attendance_id: package_attendance,
                    teacher_id: Some(1),
                    day: "2026-04-10".into(),
                    start_time: "16:00".into(),
                    duration_min: 60,
                },
            )
            .unwrap();
            planned_makeup_id = report.session_id;
            assert_eq!(report.created, 1);
            assert_eq!(
                repo::attendance::pending_makeup_count(&conn, packaged).unwrap(),
                1,
                "planlı telafi kaynak yoklamayı ikinci kez saymamalı"
            );
        }

        if step >= 2 {
            let detail =
                repo::attendance::attendance_detail(&conn, session_id, common::TODAY).unwrap();
            let package_row = detail
                .rows
                .iter()
                .find(|row| row.student_id == packaged)
                .unwrap();
            assert_eq!(package_row.makeup_session_id, planned_makeup_id);
        }
    }

    let later_package: i64 = conn
        .query_row(
            "SELECT id FROM package WHERE student_id = ?1 ORDER BY id DESC LIMIT 1",
            [charged],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(common::remaining(&conn, later_package), 8);

    let package_attendance = attendance_id(&conn, session_id, packaged);
    let charged_attendance = attendance_id(&conn, session_id, charged);
    assert_package_usage_chain(&conn, package_attendance, original_package, 4, 8);
    assert_session_charge_chain(&conn, charged_attendance, charged, 4, 0);
    assert_eq!(
        repo::attendance::pending_makeup_count(&conn, packaged).unwrap(),
        1,
        "kaynak tekrar mazeretli olduğunda mevcut plan tek telafi borcu olarak kalmalı"
    );
    let linked_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session \
             WHERE makeup_for_attendance_id = ?1 AND deleted_at IS NULL",
            [package_attendance],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(linked_count, 1);
    let statement = repo::finance::statement_rows(
        &conn,
        &repo::finance::StatementQuery {
            student_id: charged,
            from: None,
            to: None,
        },
    )
    .unwrap();
    assert_eq!(
        statement
            .iter()
            .map(|row| row.entry_date.as_str())
            .collect::<Vec<_>>(),
        ["2026-04-03", "2026-04-02", "2026-04-01", "2026-03-20"]
    );
    assert_eq!(
        statement
            .iter()
            .map(|row| row.balance_kurus)
            .collect::<Vec<_>>(),
        [0, -25_000, 0, -25_000]
    );
}

#[test]
fn iptal_durumu_net_etkiyi_sifirlar_ve_tekrarda_yeni_satir_yazmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Türkçe");
    let group_id = common::group(&conn, "Türkçe Grubu", subject_id);
    let packaged = common::student(&conn, "Paketli");
    let charged = common::student(&conn, "Ders Başı");
    for student_id in [packaged, charged] {
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
    let package_id = common::package(&conn, packaged);
    let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

    let save_status = |status: &str| {
        repo::attendance::save_attendance(
            &conn,
            &SaveAttendanceInput {
                session_id,
                marked_at: "2026-03-31 18:05".into(),
                marks: [packaged, charged]
                    .into_iter()
                    .map(|student_id| AttendanceMarkInput {
                        student_id,
                        status: status.into(),
                        note: None,
                    })
                    .collect(),
            },
        )
        .unwrap();
    };

    save_status("cancelled");
    let package_attendance = attendance_id(&conn, session_id, packaged);
    let charged_attendance = attendance_id(&conn, session_id, charged);
    assert_eq!(financial_row_counts(&conn, package_attendance), (0, 0));
    assert_eq!(financial_row_counts(&conn, charged_attendance), (0, 0));

    save_status("present");
    assert_eq!(common::remaining(&conn, package_id), 7);
    assert_eq!(balance(&conn, charged), -25_000);

    save_status("cancelled");
    save_status("cancelled");
    assert_eq!(financial_row_counts(&conn, package_attendance), (2, 0));
    assert_eq!(financial_row_counts(&conn, charged_attendance), (0, 2));
    assert_eq!(common::remaining(&conn, package_id), 8);
    assert_eq!(balance(&conn, charged), 0);
    common::assert_ledger_invariant(&conn);
}

#[test]
fn telafi_seansi_geldi_olsa_da_borc_ve_hak_etkisini_atlar() {
    for packaged in [false, true] {
        let conn = common::conn();
        let subject_id = common::subject(&conn, "Telafi");
        let student_id = common::student(&conn, "Telafi Öğrencisi");
        let package_id = packaged.then(|| common::package(&conn, student_id));
        let session_id = solo_session_with(
            &conn,
            student_id,
            subject_id,
            "2026-03-20",
            Some(30_000),
            true,
        );

        save_one(&conn, session_id, student_id, "present", "2026-03-31 18:05");

        let attendance_id = attendance_id(&conn, session_id, student_id);
        assert_eq!(financial_row_counts(&conn, attendance_id), (0, 0));
        assert_eq!(balance(&conn, student_id), 0);
        if let Some(package_id) = package_id {
            assert_eq!(common::remaining(&conn, package_id), 8);
        }
        let state: (String, Option<String>) = conn
            .query_row(
                "SELECT status, attendance_taken_at FROM session WHERE id = ?1",
                [session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(state, ("done".into(), Some("2026-03-31 18:05".into())));
    }
}

#[test]
fn telafi_kisayolu_backendde_yalnizca_excused_durumunu_kabul_eder() {
    for status in ["present", "unexcused", "cancelled"] {
        let conn = common::conn();
        let subject_id = common::subject(&conn, "Telafi Uygunluk");
        let student_id = common::student(&conn, "Uygunluk Öğrencisi");
        let session_id = solo_session(&conn, student_id, subject_id, "2026-03-20");
        save_one(&conn, session_id, student_id, status, "2026-03-31 18:05");
        let source_attendance = attendance_id(&conn, session_id, student_id);

        let err = repo::schedule::save_makeup_session(
            &conn,
            &MakeupSessionInput {
                attendance_id: source_attendance,
                teacher_id: Some(1),
                day: "2026-04-01".into(),
                start_time: "16:00".into(),
                duration_min: 60,
            },
        )
        .unwrap_err();

        assert_eq!(err.code, "makeup.status", "{status} telafi doğurmamalı");
        let linked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM session WHERE makeup_for_attendance_id = ?1",
                [source_attendance],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(linked, 0);
    }
}

#[test]
fn telafi_baglantisi_idempotenttir_borc_cift_sayilmaz_ve_islenince_ikinci_etki_yazmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Telafi Zinciri");
    let student_id = common::student(&conn, "Telafi Bekleyen");
    let package_id = common::package(&conn, student_id);
    let original_session = solo_session(&conn, student_id, subject_id, "2026-03-20");
    save_one(
        &conn,
        original_session,
        student_id,
        "excused",
        "2026-03-31 18:05",
    );
    let source_attendance = attendance_id(&conn, original_session, student_id);

    let input = MakeupSessionInput {
        attendance_id: source_attendance,
        teacher_id: Some(1),
        day: "2026-04-01".into(),
        start_time: "16:00".into(),
        duration_min: 60,
    };
    let first = repo::schedule::save_makeup_session(&conn, &input).unwrap();
    let second = repo::schedule::save_makeup_session(&conn, &input).unwrap();
    let makeup_session = first.session_id.unwrap();

    assert_eq!(first.created, 1);
    assert_eq!(second.created, 0);
    assert_eq!(second.session_id, Some(makeup_session));
    let linked: (i64, i64, i64, i64) = conn
        .query_row(
            "SELECT COUNT(*), MIN(is_makeup), MIN(makeup_for_attendance_id), MIN(student_id) \
             FROM session WHERE makeup_for_attendance_id = ?1 AND deleted_at IS NULL",
            [source_attendance],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(linked, (1, 1, source_attendance, student_id));

    // Planlanmış telafi henüz borcu kapatmaz ve kaynak yoklama satırı bir kez sayılır.
    let debts = repo::attendance::makeup_debt_rows(&conn).unwrap();
    assert_eq!(debts.len(), 1);
    assert_eq!(debts[0].student_id, student_id);
    assert_eq!(debts[0].pending_count, 1);
    assert_eq!(
        repo::attendance::pending_makeup_count(&conn, student_id).unwrap(),
        1
    );
    assert_eq!(
        repo::roster::student_detail(&conn, student_id, Some(common::TODAY.into()))
            .unwrap()
            .pending_makeup_count,
        1
    );

    // İptal edilen plan mazereti korur ama telafi taahhüdünü listeden çıkarır;
    // aynı kaynak için daha sonra yeni bir plan yapılabilir.
    repo::schedule::cancel_session(&conn, makeup_session, Some("Saat uyuşmadı")).unwrap();
    assert_eq!(
        repo::attendance::pending_makeup_count(&conn, student_id).unwrap(),
        0
    );
    let source_detail =
        repo::attendance::attendance_detail(&conn, original_session, common::TODAY).unwrap();
    assert_eq!(source_detail.rows[0].makeup_session_id, None);

    let replacement = repo::schedule::save_makeup_session(
        &conn,
        &MakeupSessionInput {
            day: "2026-04-02".into(),
            ..input.clone()
        },
    )
    .unwrap();
    let replacement_session = replacement.session_id.unwrap();
    assert_eq!(replacement.created, 1);
    assert_ne!(replacement_session, makeup_session);
    let linked_counts: (i64, i64) = conn
        .query_row(
            "SELECT COUNT(*), SUM(status <> 'cancelled') FROM session \
             WHERE makeup_for_attendance_id = ?1 AND deleted_at IS NULL",
            [source_attendance],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(linked_counts, (2, 1));
    assert_eq!(
        repo::attendance::pending_makeup_count(&conn, student_id).unwrap(),
        1
    );

    save_one(
        &conn,
        replacement_session,
        student_id,
        "present",
        "2026-04-02 17:05",
    );
    let makeup_attendance = attendance_id(&conn, replacement_session, student_id);

    // §2'nin gerçek save_attendance yolundan işlendi; telafi ikinci hak/borç üretmez.
    assert_eq!(financial_row_counts(&conn, source_attendance), (0, 0));
    assert_eq!(financial_row_counts(&conn, makeup_attendance), (0, 0));
    assert_eq!(common::remaining(&conn, package_id), 8);
    assert_eq!(balance(&conn, student_id), 0);
    assert!(repo::attendance::makeup_debt_rows(&conn)
        .unwrap()
        .is_empty());
    assert_eq!(
        repo::attendance::pending_makeup_count(&conn, student_id).unwrap(),
        0
    );
    assert_eq!(
        repo::roster::student_detail(&conn, student_id, Some(common::TODAY.into()))
            .unwrap()
            .pending_makeup_count,
        0
    );
    common::assert_ledger_invariant(&conn);
}

#[test]
fn bekleyen_telafi_listesi_kaynak_yoklama_basina_satir_dondurur() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Telafi Sayacı");
    let first = common::student(&conn, "İki Telafi");
    let second = common::student(&conn, "Bir Telafi");

    for (student_id, days) in [
        (first, vec!["2026-03-18", "2026-03-20"]),
        (second, vec!["2026-03-19"]),
    ] {
        for day in days {
            let session_id = solo_session(&conn, student_id, subject_id, day);
            save_one(&conn, session_id, student_id, "excused", "2026-03-31 18:05");
        }
    }

    let rows = repo::attendance::makeup_debt_rows(&conn).unwrap();
    assert_eq!(rows.len(), 3);
    assert_eq!(
        rows.iter()
            .filter(|row| row.student_id == first)
            .map(|row| row.pending_count)
            .sum::<i64>(),
        2
    );
    assert_eq!(
        rows.iter()
            .filter(|row| row.student_id == second)
            .map(|row| row.pending_count)
            .sum::<i64>(),
        1
    );
    assert!(rows
        .iter()
        .all(|row| row.pending_count == 1 && row.attendance_id > 0));
}

#[test]
fn iptal_edilmis_seans_yoklamayla_yeniden_acilmaz() {
    let conn = common::conn();
    let subject_id = common::subject(&conn, "Fizik");
    let student_id = common::student(&conn, "İptal Öğrencisi");
    let session_id = solo_session(&conn, student_id, subject_id, "2026-03-20");
    repo::schedule::cancel_session(&conn, session_id, Some("Kurs iptali")).unwrap();

    let err = repo::attendance::save_attendance(
        &conn,
        &SaveAttendanceInput {
            session_id,
            marked_at: "2026-03-31 18:05".into(),
            marks: vec![AttendanceMarkInput {
                student_id,
                status: "present".into(),
                note: None,
            }],
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "attendance.sessionCancelled");
    assert!(repo::academic::attendance_of_session(&conn, session_id)
        .unwrap()
        .is_empty());
    let status: String = conn
        .query_row(
            "SELECT status FROM session WHERE id = ?1",
            [session_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "cancelled");
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
fn fiyat_ve_paket_hatasi_butun_yoklama_finans_ve_seans_yazimlarini_geri_alir() {
    // İlk öğrencinin paket hakkı düştükten sonra ikinci öğrencinin fiyatı
    // çözülemezse ilk öğrencinin hareketi de kalmamalı.
    {
        let conn = common::conn();
        let subject_id = common::subject(&conn, "Fiyat Hatası");
        let group_id = common::group(&conn, "Fiyat Hatası Grubu", subject_id);
        let packaged = common::student(&conn, "İlk Paketli");
        let missing_price = common::student(&conn, "Fiyatı Eksik");
        common::enrollment(
            &conn,
            packaged,
            Some(group_id),
            subject_id,
            "2026-03-01",
            None,
        )
        .unwrap();
        repo::academic::insert_enrollment(
            &conn,
            &Enrollment {
                id: None,
                student_id: missing_price,
                study_group_id: Some(group_id),
                subject_id,
                teacher_id: Some(1),
                price_rule_id: None,
                pricing_model: "package".into(),
                unit_price: 25_000,
                start_on: "2026-03-01".into(),
                end_on: None,
                status: "active".into(),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )
        .unwrap();
        let package_id = common::package(&conn, packaged);
        let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");

        let err = repo::attendance::save_attendance(
            &conn,
            &SaveAttendanceInput {
                session_id,
                marked_at: "2026-03-31 18:05".into(),
                marks: [packaged, missing_price]
                    .into_iter()
                    .map(|student_id| AttendanceMarkInput {
                        student_id,
                        status: "present".into(),
                        note: None,
                    })
                    .collect(),
            },
        )
        .unwrap_err();

        assert_eq!(err.code, "price_not_found");
        assert!(repo::academic::attendance_of_session(&conn, session_id)
            .unwrap()
            .is_empty());
        assert_eq!(common::remaining(&conn, package_id), 8);
        let finance_rows: i64 = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM package_usage) + \
                        (SELECT COUNT(*) FROM ledger_entry)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(finance_rows, 0);
        let state: (String, Option<String>) = conn
            .query_row(
                "SELECT status, attendance_taken_at FROM session WHERE id = ?1",
                [session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(state, ("planned".into(), None));
    }

    // İlk öğrencinin defter borcu yazıldıktan sonra paket hareketi SQLite
    // seviyesinde patlarsa defter başlığı da geri alınmalı.
    {
        let conn = common::conn();
        let subject_id = common::subject(&conn, "Paket Hatası");
        let group_id = common::group(&conn, "Paket Hatası Grubu", subject_id);
        let charged = common::student(&conn, "İlk Ders Başı");
        let packaged = common::student(&conn, "Paket Yazımı Hatalı");
        for student_id in [charged, packaged] {
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
        let package_id = common::package(&conn, packaged);
        let session_id = common::group_session(&conn, group_id, subject_id, "2026-03-20");
        conn.execute_batch(
            "CREATE TEMP TRIGGER fail_package_usage \
             BEFORE INSERT ON package_usage \
             BEGIN SELECT RAISE(ABORT, 'forced_package_usage_failure'); END;",
        )
        .unwrap();

        let err = repo::attendance::save_attendance(
            &conn,
            &SaveAttendanceInput {
                session_id,
                marked_at: "2026-03-31 18:05".into(),
                marks: [charged, packaged]
                    .into_iter()
                    .map(|student_id| AttendanceMarkInput {
                        student_id,
                        status: "present".into(),
                        note: None,
                    })
                    .collect(),
            },
        )
        .unwrap_err();

        assert_eq!(err.code, "sqlite");
        assert!(repo::academic::attendance_of_session(&conn, session_id)
            .unwrap()
            .is_empty());
        assert_eq!(common::remaining(&conn, package_id), 8);
        let finance_rows: i64 = conn
            .query_row(
                "SELECT (SELECT COUNT(*) FROM package_usage) + \
                        (SELECT COUNT(*) FROM ledger_entry)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(finance_rows, 0);
        let state: (String, Option<String>) = conn
            .query_row(
                "SELECT status, attendance_taken_at FROM session WHERE id = ?1",
                [session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(state, ("planned".into(), None));
    }
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
