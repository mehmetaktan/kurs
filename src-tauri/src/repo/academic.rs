//! Akademik taraf: `subject`, `study_group`, `enrollment`, `session_series`,
//! `session`, `attendance`, `closed_day`.

use rusqlite::{params, Connection, Row};

use crate::clock;
use crate::error::{AppError, AppResult};
use crate::model::{
    Attendance, ClosedDay, Enrollment, Session, SessionSeries, StudyGroup, Subject,
};
use crate::repo::{last_id, Record};
use crate::text;

// ---------------------------------------------------------------------------
// subject (§1.4)
// ---------------------------------------------------------------------------

impl Record for Subject {
    const TABLE: &'static str = "subject";
    const COLUMNS: &'static str = "id, name, search_name, color, default_min, sort_order, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Subject {
            id: row.get(0)?,
            name: row.get(1)?,
            search_name: row.get(2)?,
            color: row.get(3)?,
            default_min: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            deleted_at: row.get(8)?,
        })
    }
}

pub fn insert_subject(conn: &Connection, s: &Subject) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO subject (id, name, search_name, color, default_min, sort_order) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            s.id,
            s.name,
            text::search_name(&s.name),
            s.color,
            s.default_min,
            s.sort_order
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_subject(conn: &Connection, id: i64, s: &Subject) -> AppResult<()> {
    conn.execute(
        "UPDATE subject SET name = ?2, search_name = ?3, color = ?4, default_min = ?5, \
                            sort_order = ?6, updated_at = ?7 \
         WHERE id = ?1",
        params![
            id,
            s.name,
            text::search_name(&s.name),
            s.color,
            s.default_min,
            s.sort_order,
            clock::now_local()
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// study_group (§1.8)
// ---------------------------------------------------------------------------

impl Record for StudyGroup {
    const TABLE: &'static str = "study_group";
    const COLUMNS: &'static str = "id, name, search_name, subject_id, teacher_id, capacity, \
                                   starts_on, ends_on, is_active, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(StudyGroup {
            id: row.get(0)?,
            name: row.get(1)?,
            search_name: row.get(2)?,
            subject_id: row.get(3)?,
            teacher_id: row.get(4)?,
            capacity: row.get(5)?,
            starts_on: row.get(6)?,
            ends_on: row.get(7)?,
            is_active: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            deleted_at: row.get(11)?,
        })
    }
}

pub fn insert_study_group(conn: &Connection, g: &StudyGroup) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO study_group (id, name, search_name, subject_id, teacher_id, capacity, \
                                  starts_on, ends_on, is_active) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            g.id,
            g.name,
            text::search_name(&g.name),
            g.subject_id,
            g.teacher_id,
            g.capacity,
            g.starts_on,
            g.ends_on,
            g.is_active,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_study_group(conn: &Connection, id: i64, g: &StudyGroup) -> AppResult<()> {
    conn.execute(
        "UPDATE study_group SET name = ?2, search_name = ?3, subject_id = ?4, teacher_id = ?5, \
                                capacity = ?6, starts_on = ?7, ends_on = ?8, is_active = ?9, \
                                updated_at = ?10 \
         WHERE id = ?1",
        params![
            id,
            g.name,
            text::search_name(&g.name),
            g.subject_id,
            g.teacher_id,
            g.capacity,
            g.starts_on,
            g.ends_on,
            g.is_active,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

/// Bir gruptaki, verilen tarihte kayıtlı **canlı** öğrencilerin id'leri.
/// "Kaç dersten sorumlu" bir alan değil, bir **aralık sorgusudur** (ADR-013).
///
/// `student.deleted_at` de süzülür: arşivlenmiş öğrenci yoklama listesinde çıkmamalı.
/// Yalnızca `enrollment.deleted_at`'e bakmak yetmez — arşivleme öğrenciyi arşivler,
/// kaydını değil. §1.23'teki tablo bunu açıkça ayırıyor: program ekranları (yoklama,
/// takvim, Bugün) arşivliyi **saymaz**; muhasebe listeleri sayar ve onlar bu fonksiyonu
/// kullanmaz, defterden okur.
pub fn group_members_on(conn: &Connection, group_id: i64, day: &str) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT e.student_id FROM enrollment e \
         JOIN student s ON s.id = e.student_id AND s.deleted_at IS NULL \
         WHERE e.study_group_id = ?1 AND e.deleted_at IS NULL \
           AND e.start_on <= ?2 AND (e.end_on IS NULL OR ?2 <= e.end_on)",
    )?;
    let rows = stmt.query_map(params![group_id, day], |row| row.get(0))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// enrollment (§1.9)
// ---------------------------------------------------------------------------

impl Record for Enrollment {
    const TABLE: &'static str = "enrollment";
    const COLUMNS: &'static str = "id, student_id, study_group_id, subject_id, teacher_id, \
                                   price_rule_id, pricing_model, unit_price, start_on, end_on, \
                                   status, created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Enrollment {
            id: row.get(0)?,
            student_id: row.get(1)?,
            study_group_id: row.get(2)?,
            subject_id: row.get(3)?,
            teacher_id: row.get(4)?,
            price_rule_id: row.get(5)?,
            pricing_model: row.get(6)?,
            unit_price: row.get(7)?,
            start_on: row.get(8)?,
            end_on: row.get(9)?,
            status: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            deleted_at: row.get(13)?,
        })
    }
}

/// §1.9 — **çakışan kayıt aralığı yasaktır.**
///
/// SQLite'ta aralık çakışmasını kısıtla ifade etmek mümkün değil (`EXCLUDE` yok),
/// bu yüzden kural burada, kayıt yazılmadan önce doğrulanır. Çakışma serbest kalsaydı
/// birebir tahakkukta `AmbiguousEnrollment` doğar ve yoklama transaction'ı düşerdi —
/// yani kullanıcı 5 kişilik grubun yoklamasını hiç kaydedemezdi (§5).
pub fn assert_no_enrollment_overlap(
    conn: &Connection,
    e: &Enrollment,
    ignore_id: Option<i64>,
) -> AppResult<()> {
    let end = e.end_on.clone().unwrap_or_else(|| "9999-12-31".to_string());
    let overlapping: i64 = conn.query_row(
        "SELECT COUNT(*) FROM enrollment \
         WHERE deleted_at IS NULL \
           AND student_id = ?1 \
           AND subject_id = ?2 \
           AND ((study_group_id IS NULL AND ?3 IS NULL) OR study_group_id = ?3) \
           AND id IS NOT ?4 \
           AND start_on <= ?6 \
           AND COALESCE(end_on, '9999-12-31') >= ?5",
        params![
            e.student_id,
            e.subject_id,
            e.study_group_id,
            ignore_id,
            e.start_on,
            end
        ],
        |row| row.get(0),
    )?;

    if overlapping > 0 {
        return Err(AppError::new(
            "enrollment_overlap",
            "Bu öğrencinin bu branşta zaten açık bir kaydı var. \
             Önce onu kapatmak ister misiniz?",
        ));
    }
    Ok(())
}

pub fn insert_enrollment(conn: &Connection, e: &Enrollment) -> AppResult<i64> {
    assert_no_enrollment_overlap(conn, e, None)?;
    conn.execute(
        "INSERT INTO enrollment (id, student_id, study_group_id, subject_id, teacher_id, \
                                 price_rule_id, pricing_model, unit_price, start_on, end_on, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            e.id,
            e.student_id,
            e.study_group_id,
            e.subject_id,
            e.teacher_id,
            e.price_rule_id,
            e.pricing_model,
            e.unit_price,
            e.start_on,
            e.end_on,
            e.status,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_enrollment(conn: &Connection, id: i64, e: &Enrollment) -> AppResult<()> {
    assert_no_enrollment_overlap(conn, e, Some(id))?;
    conn.execute(
        "UPDATE enrollment SET study_group_id = ?2, subject_id = ?3, teacher_id = ?4, \
                               price_rule_id = ?5, pricing_model = ?6, unit_price = ?7, \
                               start_on = ?8, end_on = ?9, status = ?10, updated_at = ?11 \
         WHERE id = ?1",
        params![
            id,
            e.study_group_id,
            e.subject_id,
            e.teacher_id,
            e.price_rule_id,
            e.pricing_model,
            e.unit_price,
            e.start_on,
            e.end_on,
            e.status,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

pub fn enrollments_of(conn: &Connection, student_id: i64) -> AppResult<Vec<Enrollment>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM enrollment \
         WHERE student_id = ?1 AND deleted_at IS NULL ORDER BY start_on DESC",
        cols = Enrollment::COLUMNS
    ))?;
    let rows = stmt.query_map([student_id], Enrollment::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// session_series (§1.14)
// ---------------------------------------------------------------------------

impl Record for SessionSeries {
    const TABLE: &'static str = "session_series";
    const COLUMNS: &'static str = "id, study_group_id, student_id, subject_id, teacher_id, \
                                   weekday, start_time, duration_min, starts_on, ends_on, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(SessionSeries {
            id: row.get(0)?,
            study_group_id: row.get(1)?,
            student_id: row.get(2)?,
            subject_id: row.get(3)?,
            teacher_id: row.get(4)?,
            weekday: row.get(5)?,
            start_time: row.get(6)?,
            duration_min: row.get(7)?,
            starts_on: row.get(8)?,
            ends_on: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            deleted_at: row.get(12)?,
        })
    }
}

pub fn insert_session_series(conn: &Connection, s: &SessionSeries) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO session_series (id, study_group_id, student_id, subject_id, teacher_id, \
                                     weekday, start_time, duration_min, starts_on, ends_on) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            s.id,
            s.study_group_id,
            s.student_id,
            s.subject_id,
            s.teacher_id,
            s.weekday,
            s.start_time,
            s.duration_min,
            s.starts_on,
            s.ends_on,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_session_series(conn: &Connection, id: i64, s: &SessionSeries) -> AppResult<()> {
    conn.execute(
        "UPDATE session_series SET subject_id = ?2, teacher_id = ?3, weekday = ?4, \
                                   start_time = ?5, duration_min = ?6, starts_on = ?7, \
                                   ends_on = ?8, updated_at = ?9 \
         WHERE id = ?1",
        params![
            id,
            s.subject_id,
            s.teacher_id,
            s.weekday,
            s.start_time,
            s.duration_min,
            s.starts_on,
            s.ends_on,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// session (§1.15)
// ---------------------------------------------------------------------------

impl Record for Session {
    const TABLE: &'static str = "session";
    // session_date ve kind GENERATED — okunur, yazılmaz.
    const COLUMNS: &'static str = "id, series_id, study_group_id, student_id, subject_id, \
                                   teacher_id, starts_at, ends_at, session_date, kind, status, \
                                   is_makeup, makeup_for_attendance_id, unit_price, \
                                   attendance_taken_at, cancel_reason, note, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Session {
            id: row.get(0)?,
            series_id: row.get(1)?,
            study_group_id: row.get(2)?,
            student_id: row.get(3)?,
            subject_id: row.get(4)?,
            teacher_id: row.get(5)?,
            starts_at: row.get(6)?,
            ends_at: row.get(7)?,
            session_date: row.get(8)?,
            kind: row.get(9)?,
            status: row.get(10)?,
            is_makeup: row.get(11)?,
            makeup_for_attendance_id: row.get(12)?,
            unit_price: row.get(13)?,
            attendance_taken_at: row.get(14)?,
            cancel_reason: row.get(15)?,
            note: row.get(16)?,
            created_at: row.get(17)?,
            updated_at: row.get(18)?,
            deleted_at: row.get(19)?,
        })
    }
}

pub fn insert_session(conn: &Connection, s: &Session) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO session (id, series_id, study_group_id, student_id, subject_id, teacher_id, \
                              starts_at, ends_at, status, is_makeup, makeup_for_attendance_id, \
                              unit_price, attendance_taken_at, cancel_reason, note) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            s.id,
            s.series_id,
            s.study_group_id,
            s.student_id,
            s.subject_id,
            s.teacher_id,
            s.starts_at,
            s.ends_at,
            s.status,
            s.is_makeup,
            s.makeup_for_attendance_id,
            s.unit_price,
            s.attendance_taken_at,
            s.cancel_reason,
            s.note,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_session(conn: &Connection, id: i64, s: &Session) -> AppResult<()> {
    conn.execute(
        "UPDATE session SET subject_id = ?2, teacher_id = ?3, starts_at = ?4, ends_at = ?5, \
                            status = ?6, is_makeup = ?7, makeup_for_attendance_id = ?8, \
                            unit_price = ?9, attendance_taken_at = ?10, cancel_reason = ?11, \
                            note = ?12, updated_at = ?13 \
         WHERE id = ?1",
        params![
            id,
            s.subject_id,
            s.teacher_id,
            s.starts_at,
            s.ends_at,
            s.status,
            s.is_makeup,
            s.makeup_for_attendance_id,
            s.unit_price,
            s.attendance_taken_at,
            s.cancel_reason,
            s.note,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

/// Bir günün seansları. `starts_at` zaman kolonu — ORDER BY serbest (ADR-020).
pub fn sessions_on(conn: &Connection, day: &str) -> AppResult<Vec<Session>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM session \
         WHERE session_date = ?1 AND deleted_at IS NULL ORDER BY starts_at",
        cols = Session::COLUMNS
    ))?;
    let rows = stmt.query_map([day], Session::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// İki tarih arasındaki seanslar (takvim haftası/ayı).
pub fn sessions_between(conn: &Connection, from: &str, to: &str) -> AppResult<Vec<Session>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM session \
         WHERE session_date BETWEEN ?1 AND ?2 AND deleted_at IS NULL ORDER BY starts_at",
        cols = Session::COLUMNS
    ))?;
    let rows = stmt.query_map(params![from, to], Session::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// attendance (§1.16)
// ---------------------------------------------------------------------------

impl Record for Attendance {
    const TABLE: &'static str = "attendance";
    const COLUMNS: &'static str = "id, session_id, student_id, status, marked_at, note, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Attendance {
            id: row.get(0)?,
            session_id: row.get(1)?,
            student_id: row.get(2)?,
            status: row.get(3)?,
            marked_at: row.get(4)?,
            note: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            deleted_at: row.get(8)?,
        })
    }
}

/// Yoklama satırı ekler.
///
/// Grup seanslarında `trg_attendance_within_enrollment` katılım aralığını **veritabanı
/// seviyesinde** mühürler: kayıt aralığı dışındaki öğrenci için satır yazılamaz (§1.16).
pub fn insert_attendance(conn: &Connection, a: &Attendance) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO attendance (id, session_id, student_id, status, marked_at, note) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            a.id,
            a.session_id,
            a.student_id,
            a.status,
            a.marked_at,
            a.note
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_attendance(conn: &Connection, id: i64, a: &Attendance) -> AppResult<()> {
    conn.execute(
        "UPDATE attendance SET status = ?2, marked_at = ?3, note = ?4, updated_at = ?5 \
         WHERE id = ?1",
        params![id, a.status, a.marked_at, a.note, clock::now_local()],
    )?;
    Ok(())
}

pub fn attendance_of_session(conn: &Connection, session_id: i64) -> AppResult<Vec<Attendance>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM attendance WHERE session_id = ?1 AND deleted_at IS NULL",
        cols = Attendance::COLUMNS
    ))?;
    let rows = stmt.query_map([session_id], Attendance::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// closed_day (§1.21)
// ---------------------------------------------------------------------------

impl Record for ClosedDay {
    const TABLE: &'static str = "closed_day";
    const COLUMNS: &'static str = "id, day, label, created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(ClosedDay {
            id: row.get(0)?,
            day: row.get(1)?,
            label: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            deleted_at: row.get(5)?,
        })
    }
}

pub fn insert_closed_day(conn: &Connection, c: &ClosedDay) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO closed_day (id, day, label) VALUES (?1, ?2, ?3)",
        params![c.id, c.day, c.label],
    )?;
    Ok(last_id(conn))
}

pub fn update_closed_day(conn: &Connection, id: i64, c: &ClosedDay) -> AppResult<()> {
    conn.execute(
        "UPDATE closed_day SET day = ?2, label = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, c.day, c.label, clock::now_local()],
    )?;
    Ok(())
}

pub fn is_closed(conn: &Connection, day: &str) -> AppResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM closed_day WHERE day = ?1 AND deleted_at IS NULL",
        [day],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
