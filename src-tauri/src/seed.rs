//! Geliştirme demo verisi — **üretim derlemesine girmez** (`seed` özelliği, faz-02 §6).
//!
//! `setting` varsayılanları ve `teacher` satırı buraya GİRMEZ; onlar `001_initial.sql`
//! içindeki başlangıç verisidir. Seed'e konsalardı kurs sahibinin gerçek makinesinde
//! o tablolar sonsuza kadar boş kalırdı (§1.3).
//!
//! Veri, denetimden çıkan kenar durumları bilerek içerir — sonraki fazlar bunlarla
//! test edecek:
//!
//! | öğrenci | durum | neden burada |
//! |---|---|---|
//! | Ayşe Demir | avanslı (mahsup edilmemiş fazla ödeme) | borçlu listesinde ÇIKMAMALI |
//! | Fatma Öztürk | ters kaydedilmiş bir ders | ters kayıt borcu düşürmeli |
//! | Selin Aksoy | arşivli **ama borçlu** | bakiyesi kaybolmamalı (`is_live = 0`) |
//! | Zeynep Kaya | iki aktif paket | `consume_package` en eskisini seçmeli |
//! | Mehmet Aslan | ders başı, hiç ödemeyen | borçlu listesinde ÇIKMALI (ADR-018) |
//! | İrem Aydın / Işıl Korkmaz | `İ` ve `I` ile başlayan adlar | Türkçe arama ve sıralama |

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::Connection;

use crate::clock;
use crate::error::{AppError, AppResult};
use crate::model::*;
use crate::repo;

#[derive(Debug, Default)]
pub struct Summary {
    pub students: i64,
    pub guardians: i64,
    pub subjects: i64,
    pub groups: i64,
    pub sessions: i64,
    pub attendances: i64,
    pub packages: i64,
    pub payments: i64,
    pub ledger_entries: i64,
}

/// Geçmiş bir ay + gelecek iki hafta.
const PAST_DAYS: i64 = 30;
const FUTURE_DAYS: i64 = 14;

/// Demo tabloları okunabilir kalsın diye satır şekilleri ada bağlandı.
/// (id, ad, model, birim fiyat, ders sayısı, toplam, taksit sayısı)
type PriceRuleSpec = (
    i64,
    &'static str,
    &'static str,
    i64,
    Option<i64>,
    Option<i64>,
    i64,
);
/// (id, öğrenci, grup, branş, model, birim fiyat, tarife)
type EnrollmentSpec = (i64, i64, Option<i64>, i64, &'static str, i64, Option<i64>);
/// (id, grup, öğrenci, branş, haftanın günü, saat, süre)
type SeriesSpec = (i64, Option<i64>, Option<i64>, i64, i64, &'static str, i64);

/// Demo verisini yükler. Tek transaction: yarım seed kalmaz.
pub fn load(conn: &Connection, today: NaiveDate) -> AppResult<Summary> {
    conn.execute_batch("BEGIN")?;
    match load_inner(conn, today) {
        Ok(summary) => {
            conn.execute_batch("COMMIT")?;
            Ok(summary)
        }
        Err(err) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(err)
        }
    }
}

fn load_inner(conn: &Connection, today: NaiveDate) -> AppResult<Summary> {
    let from = today - Duration::days(PAST_DAYS);
    let to = today + Duration::days(FUTURE_DAYS);

    subjects(conn)?;
    let student_ids = students(conn, today)?;
    guardians(conn)?;
    groups(conn)?;
    price_rules(conn, today)?;
    enrollments(conn, from)?;
    packages(conn, today)?;
    closed_days(conn, today)?;

    let sessions = sessions(conn, from, to)?;
    let attendances = attendance_and_charges(conn, today)?;
    let payments = settle_balances(conn, today)?;
    reversal_case(conn, today)?;
    archive_indebted_student(conn)?;
    backup_history(conn, today)?;

    Ok(Summary {
        students: student_ids.len() as i64,
        guardians: count(conn, "guardian")?,
        subjects: count(conn, "subject")?,
        groups: count(conn, "study_group")?,
        sessions,
        attendances,
        packages: count(conn, "package")?,
        payments,
        ledger_entries: count(conn, "ledger_entry")?,
    })
}

fn count(conn: &Connection, table: &str) -> AppResult<i64> {
    Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
}

// ---------------------------------------------------------------------------
// Tanımlar
// ---------------------------------------------------------------------------

fn subjects(conn: &Connection) -> AppResult<()> {
    for (id, name, color, minutes, order) in [
        (1, "Matematik", "#5f8f6b", 60, 1),
        (2, "Fizik", "#7d6f9c", 60, 2),
        (3, "İngilizce", "#c08a4e", 90, 3),
    ] {
        repo::academic::insert_subject(
            conn,
            &Subject {
                id: Some(id),
                name: name.into(),
                search_name: String::new(), // repo üretir (K9)
                color: Some(color.into()),
                default_min: Some(minutes),
                sort_order: order,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

/// 12 öğrenci. `İrem` ve `Işıl` bilerek burada: Türkçe arama/sıralama bunlarla sınanır.
fn students(conn: &Connection, today: NaiveDate) -> AppResult<Vec<i64>> {
    let enrolled = clock::date_string(today - Duration::days(200));
    let people: [(i64, &str, &str, &str, &str); 12] = [
        (
            1,
            "Elif Yılmaz",
            "Atatürk Anadolu Lisesi",
            "11. sınıf",
            "0532 214 88 10",
        ),
        (
            2,
            "Emre Yılmaz",
            "Atatürk Anadolu Lisesi",
            "9. sınıf",
            "0532 214 88 10",
        ),
        (
            3,
            "Mehmet Aslan",
            "Cumhuriyet Lisesi",
            "12. sınıf",
            "0505 337 41 62",
        ),
        (
            4,
            "Zeynep Kaya",
            "Fen Lisesi",
            "10. sınıf",
            "0533 908 15 47",
        ),
        (
            5,
            "Ahmet Şahin",
            "Cumhuriyet Lisesi",
            "11. sınıf",
            "0542 776 23 09",
        ),
        (
            6,
            "Ayşe Demir",
            "Kız Anadolu Lisesi",
            "12. sınıf",
            "0531 445 90 21",
        ),
        (
            7,
            "Mustafa Çelik",
            "Anadolu Lisesi",
            "10. sınıf",
            "0546 102 67 83",
        ),
        (
            8,
            "Fatma Öztürk",
            "Fen Lisesi",
            "11. sınıf",
            "0537 690 34 15",
        ),
        (
            9,
            "İrem Aydın",
            "Atatürk Anadolu Lisesi",
            "9. sınıf",
            "0555 823 71 40",
        ),
        (
            10,
            "Işıl Korkmaz",
            "Kız Anadolu Lisesi",
            "10. sınıf",
            "0544 318 52 96",
        ),
        (
            11,
            "Burak Çınar",
            "Cumhuriyet Lisesi",
            "12. sınıf",
            "0507 264 09 38",
        ),
        (
            12,
            "Selin Aksoy",
            "Anadolu Lisesi",
            "12. sınıf",
            "0538 571 46 20",
        ),
    ];

    let mut ids = Vec::new();
    for (id, name, school, grade, phone) in people {
        repo::people::insert_student(
            conn,
            &Student {
                id: Some(id),
                full_name: name.into(),
                search_name: String::new(), // repo üretir
                school: Some(school.into()),
                grade: Some(grade.into()),
                birth_date: None,
                phone: Some(phone.into()),
                phone_digits: None, // repo üretir
                is_active: true,
                enrolled_on: Some(enrolled.clone()),
                note: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
        ids.push(id);
    }
    Ok(ids)
}

/// Kardeşlerin velisi aynı kişi; iki öğrencinin iki velisi var.
fn guardians(conn: &Connection) -> AppResult<()> {
    let people: [(i64, &str, &str); 5] = [
        (1, "Hatice Yılmaz", "0532 214 88 10"),
        (2, "Ali Yılmaz", "0532 700 11 25"),
        (3, "Sevgi Aslan", "0505 337 41 62"),
        (4, "Kemal Aslan", "0505 118 92 73"),
        (5, "Nurten Kaya", "0533 908 15 47"),
    ];
    for (id, name, phone) in people {
        repo::people::insert_guardian(
            conn,
            &Guardian {
                id: Some(id),
                full_name: name.into(),
                phone: Some(phone.into()),
                phone_digits: None, // repo üretir
                email: None,
                last_reminded_at: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }

    // (öğrenci, veli, yakınlık, birincil mi)
    let links: [(i64, i64, &str, bool); 6] = [
        // Elif ve Emre kardeş — aynı veliler.
        (1, 1, "Anne", true),
        (1, 2, "Baba", false),
        (2, 1, "Anne", true),
        (3, 3, "Anne", true),
        (3, 4, "Baba", false),
        (4, 5, "Anne", true),
    ];
    for (student_id, guardian_id, relation, is_primary) in links {
        repo::people::insert_student_guardian(
            conn,
            &StudentGuardian {
                id: None,
                student_id,
                guardian_id,
                relation: Some(relation.into()),
                is_primary,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

fn groups(conn: &Connection) -> AppResult<()> {
    for (id, name, subject_id, capacity) in [(1, "Grup A", 1, 6), (2, "Grup B", 3, 8)] {
        repo::academic::insert_study_group(
            conn,
            &StudyGroup {
                id: Some(id),
                name: name.into(),
                search_name: String::new(), // repo üretir
                subject_id,
                teacher_id: Some(1),
                capacity,
                starts_on: None,
                ends_on: None,
                is_active: true,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

fn price_rules(conn: &Connection, today: NaiveDate) -> AppResult<()> {
    let valid_from = clock::date_string(today - Duration::days(365));
    // (id, ad, model, birim, ders sayısı, toplam, taksit)
    let rules: [PriceRuleSpec; 4] = [
        (
            1,
            "Birebir · ders başı",
            "per_session",
            25000,
            None,
            None,
            1,
        ),
        (2, "Grup · ders başı", "per_session", 15000, None, None, 1),
        (
            3,
            "Aylık paket · 8 ders",
            "package",
            25000,
            Some(8),
            Some(200000),
            2,
        ),
        (
            4,
            "Dönemlik · 32 ders",
            "package",
            23000,
            Some(32),
            Some(736000),
            4,
        ),
    ];
    for (id, name, model, unit, lessons, total, installments) in rules {
        repo::finance::insert_price_rule(
            conn,
            &PriceRule {
                id: Some(id),
                name: name.into(),
                pricing_model: model.into(),
                subject_id: None,
                study_group_id: None,
                is_group: None,
                unit_price: unit,
                lesson_count: lessons,
                total_price: total,
                period_months: None,
                default_installments: installments,
                valid_from: valid_from.clone(),
                valid_to: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

/// Kayıtlar seansların TAMAMINI kapsamalı: `trg_attendance_within_enrollment`
/// aralık dışındaki yoklamayı veritabanı seviyesinde reddeder.
fn enrollments(conn: &Connection, from: NaiveDate) -> AppResult<()> {
    let start = clock::date_string(from - Duration::days(30));

    // (id, öğrenci, grup, branş, model, birim fiyat, tarife)
    let rows: [EnrollmentSpec; 12] = [
        (1, 1, Some(1), 1, "per_session", 15000, Some(2)), // Elif  · Grup A
        (2, 2, Some(1), 1, "per_session", 15000, Some(2)), // Emre  · Grup A
        (3, 8, Some(1), 1, "per_session", 15000, Some(2)), // Fatma · Grup A
        (4, 9, Some(2), 3, "per_session", 15000, Some(2)), // İrem  · Grup B
        (5, 10, Some(2), 3, "per_session", 15000, Some(2)), // Işıl · Grup B
        (6, 12, Some(2), 3, "per_session", 15000, Some(2)), // Selin · Grup B (sonra arşivlenir)
        (7, 3, None, 1, "per_session", 25000, Some(1)),    // Mehmet — hiç ödemeyen
        (8, 6, None, 2, "per_session", 25000, Some(1)),    // Ayşe   — avanslı
        (9, 7, None, 1, "package", 25000, Some(3)),        // Mustafa — paketli
        (10, 5, None, 1, "package", 25000, Some(3)),       // Ahmet   — paketli
        (11, 4, None, 2, "package", 25000, Some(3)),       // Zeynep  — iki paketli
        (12, 11, None, 3, "package", 23000, Some(4)),      // Burak   — dönemlik, taksitli
    ];

    for (id, student_id, group_id, subject_id, model, unit_price, rule) in rows {
        repo::academic::insert_enrollment(
            conn,
            &Enrollment {
                id: Some(id),
                student_id,
                study_group_id: group_id,
                subject_id,
                teacher_id: Some(1),
                price_rule_id: rule,
                pricing_model: model.into(),
                unit_price,
                start_on: start.clone(),
                end_on: None,
                status: "active".into(),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

fn packages(conn: &Connection, today: NaiveDate) -> AppResult<()> {
    let sold = clock::date_string(today - Duration::days(35));
    let sold_recent = clock::date_string(today - Duration::days(5));

    // (id, öğrenci, kayıt, ders, birim, toplam, satış)
    let rows: [(i64, i64, i64, i64, i64, i64, &str); 5] = [
        (1, 7, 9, 8, 25000, 200000, "old"),    // Mustafa
        (2, 5, 10, 8, 25000, 200000, "old"),   // Ahmet
        (3, 4, 11, 8, 25000, 200000, "old"),   // Zeynep — 1. paket
        (4, 4, 11, 8, 25000, 200000, "new"),   // Zeynep — 2. paket (İKİ AKTİF PAKET)
        (5, 11, 12, 32, 23000, 736000, "old"), // Burak — dönemlik
    ];
    for (id, student_id, enrollment_id, lessons, unit, total, when) in rows {
        repo::finance::insert_package(
            conn,
            &Package {
                id: Some(id),
                student_id,
                enrollment_id: Some(enrollment_id),
                price_rule_id: None,
                lesson_count: lessons,
                unit_price: unit,
                total_price: total,
                sold_on: if when == "old" {
                    sold.clone()
                } else {
                    sold_recent.clone()
                },
                valid_until: None,
                status: "active".into(),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }

    // Taksit planları. Vade `today - 25` ile başlar, 30 gün aralıklı: böylece her zaman
    // TAM OLARAK biri vadesi gelmiş olur. Vade tam `today`'e denk gelirse
    // (`due_on <= today`) ikinci taksit de tahakkuk eder ve senaryo bozulurdu.
    //
    // (öğrenci, paket, kayıt, taksit sayısı, taksit tutarı)
    let plans: [(i64, i64, i64, i64, i64); 2] = [
        (7, 1, 9, 2, 100000),   // Mustafa — 2 taksit; ilki tahakkuk edip kısmen ödenecek
        (11, 5, 12, 4, 184000), // Burak  — dönemlik, 4 taksit
    ];

    for (student_id, package_id, enrollment_id, count, amount) in plans {
        for seq in 1..=count {
            let due = today - Duration::days(25) + Duration::days(30 * (seq - 1));
            repo::finance::insert_installment(
                conn,
                &Installment {
                    id: None,
                    student_id,
                    package_id: Some(package_id),
                    enrollment_id: Some(enrollment_id),
                    seq,
                    due_on: clock::date_string(due),
                    amount,
                    label: Some(format!("{seq}. taksit")),
                    accrued_entry_id: None,
                    created_at: None,
                    updated_at: None,
                    deleted_at: None,
                },
            )?;
        }
    }

    // Vadesi gelen taksiti deftere yaz (ADR-015: yalnızca vadesi geleni).
    let today_str = clock::date_string(today);
    for inst in repo::finance::due_unaccrued_installments(conn, &today_str)? {
        let id = inst.id.expect("okunan satırda id var");
        let entry_id = repo::finance::insert_ledger_entry(
            conn,
            &LedgerEntry {
                id: None,
                student_id: inst.student_id,
                entry_date: inst.due_on.clone(),
                kind: "installment_charge".into(),
                amount: -inst.amount,
                attendance_id: None,
                installment_id: Some(id),
                payment_id: None,
                reverses_id: None,
                memo: inst.label.clone(),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
        repo::finance::mark_installment_accrued(conn, id, entry_id)?;
    }
    Ok(())
}

fn closed_days(conn: &Connection, today: NaiveDate) -> AppResult<()> {
    for (offset, label) in [(-12i64, "Resmî tatil"), (7, "Ara tatil")] {
        repo::academic::insert_closed_day(
            conn,
            &ClosedDay {
                id: None,
                day: clock::date_string(today + Duration::days(offset)),
                label: label.into(),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

/// Haftalık şablonlar ve onlardan üretilen seanslar.
/// Kapalı günlere ve haftalık kapalı güne (Pazar) seans üretilmez.
fn sessions(conn: &Connection, from: NaiveDate, to: NaiveDate) -> AppResult<i64> {
    // (id, grup, öğrenci, branş, haftanın günü, saat, süre)
    let series: [SeriesSpec; 8] = [
        (1, Some(1), None, 1, 1, "16:00", 60), // Grup A · Pazartesi
        (2, Some(1), None, 1, 3, "16:00", 60), // Grup A · Çarşamba
        (3, Some(2), None, 3, 2, "17:00", 90), // Grup B · Salı
        (4, None, Some(3), 1, 4, "15:00", 60), // Mehmet
        (5, None, Some(6), 2, 5, "14:00", 60), // Ayşe
        (6, None, Some(7), 1, 1, "18:00", 60), // Mustafa
        (7, None, Some(5), 1, 3, "18:00", 60), // Ahmet
        (8, None, Some(4), 2, 4, "17:00", 60), // Zeynep
    ];

    let weekly_closed: i64 = repo::setting::value_i64(conn, "weekly_closed_days")?.unwrap_or(7);
    let start_on = clock::date_string(from - Duration::days(30));
    let mut created = 0i64;

    for (id, group_id, student_id, subject_id, weekday, start_time, duration) in series {
        repo::academic::insert_session_series(
            conn,
            &SessionSeries {
                id: Some(id),
                study_group_id: group_id,
                student_id,
                subject_id,
                teacher_id: Some(1),
                weekday,
                start_time: start_time.into(),
                duration_min: duration,
                starts_on: start_on.clone(),
                ends_on: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;

        let mut day = from;
        while day <= to {
            let iso_weekday = day.weekday().number_from_monday() as i64;
            if iso_weekday == weekday
                && iso_weekday != weekly_closed
                && !repo::academic::is_closed(conn, &clock::date_string(day))?
            {
                let starts_at = format!("{} {}", clock::date_string(day), start_time);
                let ends_at = format!(
                    "{} {}",
                    clock::date_string(day),
                    plus_minutes(start_time, duration)
                );
                repo::academic::insert_session(
                    conn,
                    &Session {
                        id: None,
                        series_id: Some(id),
                        study_group_id: group_id,
                        student_id,
                        subject_id,
                        teacher_id: Some(1),
                        starts_at,
                        ends_at,
                        session_date: None, // GENERATED
                        kind: None,         // GENERATED
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
                )?;
                created += 1;
            }
            day += Duration::days(1);
        }
    }
    Ok(created)
}

fn plus_minutes(time: &str, minutes: i64) -> String {
    let (h, m) = time.split_once(':').unwrap_or(("0", "0"));
    let total = h.parse::<i64>().unwrap_or(0) * 60 + m.parse::<i64>().unwrap_or(0) + minutes;
    format!("{:02}:{:02}", total / 60, total % 60)
}

/// Geçmiş seansların yoklaması + ders başı öğrencilerde borç, paketlilerde hak düşümü.
fn attendance_and_charges(conn: &Connection, today: NaiveDate) -> AppResult<i64> {
    let today_str = clock::date_string(today);
    let past = repo::academic::sessions_between(
        conn,
        &clock::date_string(today - Duration::days(PAST_DAYS)),
        &clock::date_string(today - Duration::days(1)),
    )?;

    let mut marked = 0i64;
    for (index, session) in past.iter().enumerate() {
        let session_id = session.id.expect("okunan satırda id var");
        let session_date = session
            .session_date
            .clone()
            .unwrap_or_else(|| today_str.clone());

        // Grup seansında katılımcılar kayıt aralığından gelir (ADR-013).
        let students: Vec<i64> = match session.study_group_id {
            Some(group_id) => repo::academic::group_members_on(conn, group_id, &session_date)?,
            None => session.student_id.into_iter().collect(),
        };

        for student_id in students {
            // Ara sıra mazeretli: devamsızlık politikasının (ADR-016) test malzemesi.
            let status = if index % 11 == 5 {
                "excused"
            } else {
                "present"
            };

            let attendance_id = repo::academic::insert_attendance(
                conn,
                &Attendance {
                    id: None,
                    session_id,
                    student_id,
                    status: status.into(),
                    marked_at: Some(format!("{session_date} 20:00")),
                    note: None,
                    created_at: None,
                    updated_at: None,
                    deleted_at: None,
                },
            )?;
            marked += 1;

            if status != "present" {
                continue; // mazeretli: hak düşmez, borç yazılmaz (ADR-016)
            }

            match active_package(conn, student_id, &today_str)? {
                // Paketli: deftere HİÇBİR satır yazılmaz, yalnızca hak düşer (ADR-015).
                Some(package_id) => {
                    repo::finance::insert_package_usage(
                        conn,
                        &PackageUsage {
                            id: None,
                            package_id,
                            attendance_id: Some(attendance_id),
                            used_on: session_date.clone(),
                            delta: -1,
                            reason: "attendance".into(),
                            memo: None,
                            created_at: None,
                            updated_at: None,
                            deleted_at: None,
                        },
                    )?;
                }
                // Ders başı: borç deftere yazılır.
                None => {
                    if let Some(unit_price) =
                        per_session_price(conn, student_id, session.subject_id, &session_date)?
                    {
                        repo::finance::insert_ledger_entry(
                            conn,
                            &LedgerEntry {
                                id: None,
                                student_id,
                                entry_date: session_date.clone(),
                                kind: "session_charge".into(),
                                amount: -unit_price,
                                attendance_id: Some(attendance_id),
                                installment_id: None,
                                payment_id: None,
                                reverses_id: None,
                                memo: Some("Ders ücreti".into()),
                                created_at: None,
                                updated_at: None,
                                deleted_at: None,
                            },
                        )?;
                    }
                }
            }
        }

        conn.execute(
            "UPDATE session SET status = 'done', attendance_taken_at = ?2, updated_at = ?2 \
             WHERE id = ?1",
            rusqlite::params![session_id, format!("{session_date} 20:00")],
        )?;
    }
    Ok(marked)
}

/// Kalan hakkı olan en eski paket. `package.status`'e güvenmez (§1.23).
fn active_package(conn: &Connection, student_id: i64, today: &str) -> AppResult<Option<i64>> {
    Ok(repo::views::active_packages(conn, student_id, today)?
        .first()
        .map(|p| p.package_id))
}

fn per_session_price(
    conn: &Connection,
    student_id: i64,
    subject_id: i64,
    day: &str,
) -> AppResult<Option<i64>> {
    let price: Option<i64> = conn
        .query_row(
            "SELECT unit_price FROM enrollment \
             WHERE student_id = ?1 AND subject_id = ?2 AND pricing_model = 'per_session' \
               AND deleted_at IS NULL AND start_on <= ?3 AND (end_on IS NULL OR ?3 <= end_on) \
             LIMIT 1",
            rusqlite::params![student_id, subject_id, day],
            |row| row.get(0),
        )
        .ok();
    Ok(price)
}

// ---------------------------------------------------------------------------
// Para
// ---------------------------------------------------------------------------

/// Seed'in her öğrenci için kurmak istediği **senaryo**.
///
/// Bilerek mutlak kuruş DEĞİL. Önceki sürüm hedefi "bakiye tam olarak −600 ₺ olsun"
/// diye yazıyordu ve bu, üretilen seans sayısına — yani seed'in çalıştığı GERÇEK
/// TARİHE — bağlıydı: testler sabit bir `TODAY` kullandığı için yeşil geçiyor, ama
/// `npm run seed` başka bir günde çalıştığında borç hedefe yetişmiyordu. Senaryo o
/// zaman sessizce oluşmuyordu (denetim bulgusu).
///
/// Şimdi hedef, oluşan borcun kendisine göre tanımlı; hangi gün çalışırsa çalışsın
/// aynı senaryo çıkar.
#[derive(Clone, Copy)]
enum Odeme {
    /// Hiç tahsilat yok — borç olduğu gibi kalır.
    Yok,
    /// Borcun tamamı ödenir → bakiye 0.
    Tamami,
    /// Borcun yarısı ödenir → kısmi ödeme, kalanı borç olarak durur.
    Yarisi,
    /// Borcun tamamı + fazlası → mahsup edilmemiş AVANS (bakiye pozitif).
    Avans(i64),
}

/// (öğrenci, senaryo). Listede olmayan öğrenciye tahsilat girilmez.
const ODEME_PLANI: [(i64, Odeme); 10] = [
    (1, Odeme::Tamami),       // Elif    — kapalı hesap
    (2, Odeme::Yarisi),       // Emre    — kısmi ödeme
    (3, Odeme::Yok),          // Mehmet  — BORÇLU: ders başı, hiç ödemeyen (ADR-018)
    (4, Odeme::Tamami),       // Zeynep  — paket peşin
    (5, Odeme::Tamami),       // Ahmet   — paket peşin
    (6, Odeme::Avans(40000)), // Ayşe    — ALACAKLI: borçlu listesinde çıkmamalı
    (7, Odeme::Yarisi),       // Mustafa — taksitini yarım ödedi
    (9, Odeme::Tamami),       // İrem
    (10, Odeme::Yarisi),      // Işıl    — kısmi borç
    (12, Odeme::Yok),         // Selin   — borçlu, sonra ARŞİVLENECEK
];

fn settle_balances(conn: &Connection, today: NaiveDate) -> AppResult<i64> {
    let paid_on = clock::date_string(today - Duration::days(6));
    let mut count = 0i64;

    for (student_id, odeme) in ODEME_PLANI {
        let balance: i64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM ledger_entry \
             WHERE student_id = ?1 AND deleted_at IS NULL",
            [student_id],
            |row| row.get(0),
        )?;
        let borc = -balance; // bakiye negatifken borç pozitif (K3)

        // Senaryonun kurulamadığı hâller sessizce geçilmez: fikstür bir garantidir,
        // sonraki fazlar bu veriyle test edecek.
        let bekleniyor_borc = |ne: &str| -> AppResult<()> {
            if borc <= 0 {
                return Err(AppError::new(
                    "seed_target_unreachable",
                    format!(
                        "Seed fikstürü tutmadı: {student_id} numaralı öğrenci için {ne} \
                         senaryosu kuruluyor ama hiç borç oluşmamış (bakiye {balance} kuruş). \
                         Seans üretimi ya da kayıt tarifesi değişmiş olmalı."
                    ),
                ));
            }
            Ok(())
        };

        let amount = match odeme {
            Odeme::Yok => continue,
            Odeme::Tamami => {
                if borc <= 0 {
                    continue; // ödenecek borç yok, meşru
                }
                borc
            }
            Odeme::Yarisi => {
                bekleniyor_borc("kısmi ödeme")?;
                // Tam sayı bölmesi: 1 kuruşluk borçta 0 çıkar, o zaman 1 kuruş öde ki
                // "kısmen ödenmiş" hâli gerçekten oluşsun.
                (borc / 2).max(1)
            }
            Odeme::Avans(fazla) => borc.max(0) + fazla,
        };

        if amount <= 0 {
            continue;
        }

        count += 1;
        let receipt_no = format!("2026-{:03}", count);
        let method = match count % 3 {
            0 => "transfer",
            1 => "cash",
            _ => "card",
        };

        let payment_id = repo::finance::insert_payment(
            conn,
            &Payment {
                id: None,
                student_id,
                paid_on: paid_on.clone(),
                amount,
                method: method.into(),
                receipt_no: Some(receipt_no),
                note: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;

        repo::finance::insert_ledger_entry(
            conn,
            &LedgerEntry {
                id: None,
                student_id,
                entry_date: paid_on.clone(),
                kind: "payment".into(),
                amount,
                attendance_id: None,
                installment_id: None,
                payment_id: Some(payment_id),
                reverses_id: None,
                memo: Some("Tahsilat".into()),
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;

        // Açık taksitlere en eskiden başlayarak mahsup et (§1.18). Artan kısım AVANS
        // olarak kalır — hiçbir taksite bağlanmaz. Ayşe Demir'in durumu tam olarak budur.
        let mut left = amount;
        for open in repo::views::open_installments(conn, student_id)? {
            if left <= 0 {
                break;
            }
            let allocated = left.min(open.open_kurus);
            if allocated <= 0 {
                continue;
            }
            repo::finance::insert_payment_allocation(
                conn,
                &PaymentAllocation {
                    id: None,
                    payment_id,
                    installment_id: open.id,
                    amount: allocated,
                    created_at: None,
                    updated_at: None,
                    deleted_at: None,
                },
            )?;
            left -= allocated;
        }
    }
    Ok(count)
}

/// Fatma Öztürk'ün bir dersi yanlış işlenmiş ve ters kaydedilmiş.
/// `v_ledger_effective` bu borcu da, ters kaydı da elemeli.
fn reversal_case(conn: &Connection, today: NaiveDate) -> AppResult<()> {
    let charge: Option<i64> = conn
        .query_row(
            "SELECT id FROM ledger_entry \
             WHERE student_id = 8 AND kind = 'session_charge' AND deleted_at IS NULL \
             ORDER BY entry_date DESC, id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(entry_id) = charge {
        repo::finance::insert_reversal(
            conn,
            entry_id,
            &clock::date_string(today - Duration::days(2)),
            Some("Ders sehven işlenmiş — iptal"),
        )?;
    }
    Ok(())
}

/// Selin Aksoy arşivlenir ama borcu durur.
/// `v_student_balance` onu `is_live = 0` ile döndürmeli; borcu kaybolmamalı (§1.23).
fn archive_indebted_student(conn: &Connection) -> AppResult<()> {
    repo::archive::<Student>(conn, 12)?;
    Ok(())
}

fn backup_history(conn: &Connection, today: NaiveDate) -> AppResult<()> {
    for offset in [-4i64, -1] {
        repo::ops::insert_backup_log(
            conn,
            &BackupLog {
                id: None,
                taken_at: format!(
                    "{} 08:14",
                    clock::date_string(today + Duration::days(offset))
                ),
                file_path: format!(
                    "yedek/kurs-{}.db",
                    clock::date_string(today + Duration::days(offset))
                ),
                size_bytes: Some(184_320),
                is_auto: true,
                ok: true,
                error: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )?;
    }
    Ok(())
}
