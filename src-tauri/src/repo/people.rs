//! Kişiler: `teacher`, `student`, `guardian`, `student_guardian`, `student_note`.
//!
//! **`search_name` ve `phone_digits` çağırana bırakılmaz** — insert/update sırasında
//! `text` modülüyle burada üretilir. Aksi hâlde K9'un tek dayanağı "herkes hatırlasın"
//! olurdu ve bir ekranın unutması aramayı sessizce bozardı.

use rusqlite::{params, Connection, Row};

use crate::clock;
use crate::error::AppResult;
use crate::model::{Guardian, Student, StudentGuardian, StudentNote, Teacher};
use crate::repo::{last_id, Record};
use crate::text;

// ---------------------------------------------------------------------------
// teacher (§1.3)
// ---------------------------------------------------------------------------

impl Record for Teacher {
    const TABLE: &'static str = "teacher";
    const COLUMNS: &'static str = "id, full_name, color, phone, email, is_active, sort_order, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Teacher {
            id: row.get(0)?,
            full_name: row.get(1)?,
            color: row.get(2)?,
            phone: row.get(3)?,
            email: row.get(4)?,
            is_active: row.get(5)?,
            sort_order: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
            deleted_at: row.get(9)?,
        })
    }
}

pub fn insert_teacher(conn: &Connection, t: &Teacher) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO teacher (id, full_name, color, phone, email, is_active, sort_order) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            t.id,
            t.full_name,
            t.color,
            t.phone,
            t.email,
            t.is_active,
            t.sort_order
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_teacher(conn: &Connection, id: i64, t: &Teacher) -> AppResult<()> {
    conn.execute(
        "UPDATE teacher SET full_name = ?2, color = ?3, phone = ?4, email = ?5, \
                            is_active = ?6, sort_order = ?7, updated_at = ?8 \
         WHERE id = ?1",
        params![
            id,
            t.full_name,
            t.color,
            t.phone,
            t.email,
            t.is_active,
            t.sort_order,
            clock::now_local()
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// student (§1.5)
// ---------------------------------------------------------------------------

impl Record for Student {
    const TABLE: &'static str = "student";
    const COLUMNS: &'static str = "id, full_name, search_name, school, grade, birth_date, \
                                   phone, phone_digits, is_active, enrolled_on, note, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Student {
            id: row.get(0)?,
            full_name: row.get(1)?,
            search_name: row.get(2)?,
            school: row.get(3)?,
            grade: row.get(4)?,
            birth_date: row.get(5)?,
            phone: row.get(6)?,
            phone_digits: row.get(7)?,
            is_active: row.get(8)?,
            enrolled_on: row.get(9)?,
            note: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            deleted_at: row.get(13)?,
        })
    }
}

pub fn insert_student(conn: &Connection, s: &Student) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO student (id, full_name, search_name, school, grade, birth_date, \
                              phone, phone_digits, is_active, enrolled_on, note) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            s.id,
            s.full_name,
            text::search_name(&s.full_name),
            s.school,
            s.grade,
            s.birth_date,
            s.phone,
            s.phone.as_deref().map(text::phone_digits),
            s.is_active,
            s.enrolled_on,
            s.note,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_student(conn: &Connection, id: i64, s: &Student) -> AppResult<()> {
    conn.execute(
        "UPDATE student SET full_name = ?2, search_name = ?3, school = ?4, grade = ?5, \
                            birth_date = ?6, phone = ?7, phone_digits = ?8, is_active = ?9, \
                            enrolled_on = ?10, note = ?11, updated_at = ?12 \
         WHERE id = ?1",
        params![
            id,
            s.full_name,
            text::search_name(&s.full_name),
            s.school,
            s.grade,
            s.birth_date,
            s.phone,
            s.phone.as_deref().map(text::phone_digits),
            s.is_active,
            s.enrolled_on,
            s.note,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

/// Ad veya veli telefonuyla arama — tasarımın arama kutusunun karşılığı.
/// Sonuç **sırasızdır**; sıralama `sortTr.ts` içinde yapılır (ADR-020).
pub fn search_students(conn: &Connection, query: &str) -> AppResult<Vec<Student>> {
    let name_needle = format!("%{}%", text::search_name(query));
    let digits = text::phone_digits(query);
    let phone_needle = if digits.is_empty() {
        // Rakam yoksa telefon dalını hiç eşleşmeyecek bir kalıba bağla.
        String::from("\u{0}")
    } else {
        format!("%{digits}%")
    };

    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM student s \
         WHERE s.deleted_at IS NULL \
           AND ( s.search_name LIKE ?1 \
              OR s.phone_digits LIKE ?2 \
              OR EXISTS ( SELECT 1 FROM student_guardian sg \
                          JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
                          WHERE sg.student_id = s.id AND sg.deleted_at IS NULL \
                            AND g.phone_digits LIKE ?2 ) )",
        cols = Student::COLUMNS
    ))?;
    let rows = stmt.query_map(params![name_needle, phone_needle], |row| {
        Student::from_row(row)
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// guardian (§1.6)
// ---------------------------------------------------------------------------

impl Record for Guardian {
    const TABLE: &'static str = "guardian";
    const COLUMNS: &'static str = "id, full_name, phone, phone_digits, email, \
                                   last_reminded_at, created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Guardian {
            id: row.get(0)?,
            full_name: row.get(1)?,
            phone: row.get(2)?,
            phone_digits: row.get(3)?,
            email: row.get(4)?,
            last_reminded_at: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            deleted_at: row.get(8)?,
        })
    }
}

pub fn insert_guardian(conn: &Connection, g: &Guardian) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO guardian (id, full_name, phone, phone_digits, email, last_reminded_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            g.id,
            g.full_name,
            g.phone,
            g.phone.as_deref().map(text::phone_digits),
            g.email,
            g.last_reminded_at,
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_guardian(conn: &Connection, id: i64, g: &Guardian) -> AppResult<()> {
    conn.execute(
        "UPDATE guardian SET full_name = ?2, phone = ?3, phone_digits = ?4, email = ?5, \
                             updated_at = ?6 \
         WHERE id = ?1",
        params![
            id,
            g.full_name,
            g.phone,
            g.phone.as_deref().map(text::phone_digits),
            g.email,
            clock::now_local(),
        ],
    )?;
    Ok(())
}

/// Bir öğrencinin velileri.
pub fn guardians_of(conn: &Connection, student_id: i64) -> AppResult<Vec<Guardian>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM guardian g \
         JOIN student_guardian sg ON sg.guardian_id = g.id AND sg.deleted_at IS NULL \
         WHERE sg.student_id = ?1 AND g.deleted_at IS NULL \
         ORDER BY sg.is_primary DESC",
        cols = Guardian::COLUMNS
            .split(", ")
            .map(|c| format!("g.{c}"))
            .collect::<Vec<_>>()
            .join(", ")
    ))?;
    let rows = stmt.query_map([student_id], Guardian::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// student_guardian (§1.7)
// ---------------------------------------------------------------------------

impl Record for StudentGuardian {
    const TABLE: &'static str = "student_guardian";
    const COLUMNS: &'static str = "id, student_id, guardian_id, relation, is_primary, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(StudentGuardian {
            id: row.get(0)?,
            student_id: row.get(1)?,
            guardian_id: row.get(2)?,
            relation: row.get(3)?,
            is_primary: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            deleted_at: row.get(7)?,
        })
    }
}

pub fn insert_student_guardian(conn: &Connection, sg: &StudentGuardian) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO student_guardian (id, student_id, guardian_id, relation, is_primary) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            sg.id,
            sg.student_id,
            sg.guardian_id,
            sg.relation,
            sg.is_primary
        ],
    )?;
    Ok(last_id(conn))
}

pub fn update_student_guardian(conn: &Connection, id: i64, sg: &StudentGuardian) -> AppResult<()> {
    conn.execute(
        "UPDATE student_guardian SET relation = ?2, is_primary = ?3, updated_at = ?4 \
         WHERE id = ?1",
        params![id, sg.relation, sg.is_primary, clock::now_local()],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// student_note (§1.20)
// ---------------------------------------------------------------------------

impl Record for StudentNote {
    const TABLE: &'static str = "student_note";
    const COLUMNS: &'static str = "id, student_id, teacher_id, body, noted_on, \
                                   created_at, updated_at, deleted_at";

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(StudentNote {
            id: row.get(0)?,
            student_id: row.get(1)?,
            teacher_id: row.get(2)?,
            body: row.get(3)?,
            noted_on: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            deleted_at: row.get(7)?,
        })
    }
}

pub fn insert_student_note(conn: &Connection, n: &StudentNote) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO student_note (id, student_id, teacher_id, body, noted_on) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![n.id, n.student_id, n.teacher_id, n.body, n.noted_on],
    )?;
    Ok(last_id(conn))
}

pub fn update_student_note(conn: &Connection, id: i64, n: &StudentNote) -> AppResult<()> {
    conn.execute(
        "UPDATE student_note SET teacher_id = ?2, body = ?3, noted_on = ?4, updated_at = ?5 \
         WHERE id = ?1",
        params![id, n.teacher_id, n.body, n.noted_on, clock::now_local()],
    )?;
    Ok(())
}

/// Bir öğrencinin notları, en yeniden eskiye. `noted_on` tarih kolonu — ORDER BY serbest.
pub fn notes_of(conn: &Connection, student_id: i64) -> AppResult<Vec<StudentNote>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {cols} FROM student_note \
         WHERE student_id = ?1 AND deleted_at IS NULL \
         ORDER BY noted_on DESC, id DESC",
        cols = StudentNote::COLUMNS
    ))?;
    let rows = stmt.query_map([student_id], StudentNote::from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}
