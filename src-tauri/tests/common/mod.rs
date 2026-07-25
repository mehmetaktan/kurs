//! Test fikstürleri. Bellek içi SQLite, **gerçek migration'lar uygulanarak** (ADR-002).
//!
//! Hiçbir testte tarih SQLite'tan okunmaz (§0 `'now'` kuralı) — `today` daima sabit,
//! aksi hâlde testler CI makinesinin saat dilimine bağlı olur ve macOS'ta geçip
//! Windows CI'da düşer.

#![allow(dead_code)] // her test dosyası yardımcıların hepsini kullanmıyor

use kurs_takip_lib::db;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;
use rusqlite::Connection;

/// Testlerde kullanılan sabit "bugün".
pub const TODAY: &str = "2026-03-31";

pub fn conn() -> Connection {
    db::open_in_memory_migrated().expect("migration uygulanmalı")
}

pub fn subject(conn: &Connection, name: &str) -> i64 {
    repo::academic::insert_subject(
        conn,
        &Subject {
            id: None,
            name: name.into(),
            search_name: String::new(),
            color: None,
            default_min: Some(60),
            sort_order: 0,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("branş eklenmeli")
}

pub fn student(conn: &Connection, name: &str) -> i64 {
    repo::people::insert_student(
        conn,
        &Student {
            id: None,
            full_name: name.into(),
            search_name: String::new(),
            school: None,
            grade: None,
            birth_date: None,
            phone: Some("0532 111 22 33".into()),
            phone_digits: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("öğrenci eklenmeli")
}

pub fn group(conn: &Connection, name: &str, subject_id: i64) -> i64 {
    repo::academic::insert_study_group(
        conn,
        &StudyGroup {
            id: None,
            name: name.into(),
            search_name: String::new(),
            subject_id,
            teacher_id: Some(1),
            capacity: 6,
            starts_on: None,
            ends_on: None,
            is_active: true,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("grup eklenmeli")
}

pub fn enrollment(
    conn: &Connection,
    student_id: i64,
    group_id: Option<i64>,
    subject_id: i64,
    start_on: &str,
    end_on: Option<&str>,
) -> kurs_takip_lib::error::AppResult<i64> {
    repo::academic::insert_enrollment(
        conn,
        &Enrollment {
            id: None,
            student_id,
            study_group_id: group_id,
            subject_id,
            teacher_id: Some(1),
            price_rule_id: None,
            pricing_model: "per_session".into(),
            unit_price: 25000,
            start_on: start_on.into(),
            end_on: end_on.map(str::to_string),
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
}

/// Grup seansı (`study_group_id` dolu, `student_id` NULL).
pub fn group_session(conn: &Connection, group_id: i64, subject_id: i64, day: &str) -> i64 {
    repo::academic::insert_session(
        conn,
        &Session {
            id: None,
            series_id: None,
            study_group_id: Some(group_id),
            student_id: None,
            subject_id,
            teacher_id: Some(1),
            starts_at: format!("{day} 16:00"),
            ends_at: format!("{day} 17:00"),
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

/// Deftere borç/alacak satırı. `amount` işaretli: (−) borç, (+) alacak.
pub fn ledger(conn: &Connection, student_id: i64, day: &str, kind: &str, amount: i64) -> i64 {
    repo::finance::insert_ledger_entry(
        conn,
        &LedgerEntry {
            id: None,
            student_id,
            entry_date: day.into(),
            kind: kind.into(),
            amount,
            attendance_id: None,
            installment_id: None,
            payment_id: None,
            reverses_id: None,
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .expect("defter satırı yazılmalı")
}
