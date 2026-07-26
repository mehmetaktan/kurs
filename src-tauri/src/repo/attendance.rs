//! Faz 6 — yoklama panelinin birleşik veri ve tek kaydetme yolu.
//!
//! Yoklama satırları, seansın tamamlanması ve para/ders hakkı etkileri aynı
//! transaction'da yazılır. Finans hareketleri yalnızca `repo::finance` içindeki
//! yön belirten tek ücret/tüketim yolundan geçer.

use std::collections::{HashMap, HashSet};

use chrono::{NaiveDate, NaiveDateTime};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::model::Attendance;
use crate::repo;

const NOTE_MAX_CHARS: usize = 160;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendancePolicy {
    pub excused_consumes_lesson: bool,
    pub unexcused_consumes_lesson: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceStudentRow {
    pub attendance_id: Option<i64>,
    pub student_id: i64,
    pub full_name: String,
    /// `pending` yalnızca kayıt yokken/henüz işaretlenmemişken gelir; ekranda düğmesi yoktur.
    pub status: String,
    pub note: Option<String>,
    /// Her hedef durumun **mevcut etkin finans etkisine göre yönlü farkı**.
    pub effects: AttendanceStatusEffects,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceEffectDelta {
    /// Pozitif = hak düşecek, negatif = hak geri verilecek.
    pub lesson_credits: i64,
    /// Pozitif = borç yazılacak, negatif = borç silinecek (kuruş).
    pub debt_kurus: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceStatusEffects {
    pub present: AttendanceEffectDelta,
    pub excused: AttendanceEffectDelta,
    pub unexcused: AttendanceEffectDelta,
    pub cancelled: AttendanceEffectDelta,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceDetail {
    pub session_id: i64,
    pub title: String,
    pub subject_name: String,
    pub starts_at: String,
    pub ends_at: String,
    pub kind: String,
    pub rows: Vec<AttendanceStudentRow>,
    pub policy: AttendancePolicy,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceMarkInput {
    pub student_id: i64,
    pub status: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveAttendanceInput {
    pub session_id: i64,
    /// `local_now` komutundan gelen yerel duvar saati (`YYYY-MM-DD HH:MM`).
    pub marked_at: String,
    pub marks: Vec<AttendanceMarkInput>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveAttendanceReport {
    pub saved: i64,
}

#[derive(Debug)]
struct SessionContext {
    id: i64,
    group_id: Option<i64>,
    student_id: Option<i64>,
    session_day: String,
    title: String,
    subject_name: String,
    starts_at: String,
    ends_at: String,
    kind: String,
    status: String,
    is_makeup: bool,
}

#[derive(Debug)]
struct ParticipantRow {
    attendance_id: Option<i64>,
    student_id: i64,
    full_name: String,
    status: String,
    note: Option<String>,
}

/// Yoklama paneli: ders metası, o **ders günündeki** katılımcılar, mevcut işaretler,
/// Genel ayarlardan politika ve finans katmanından salt-okunur etki önizlemesi.
pub fn attendance_detail(
    conn: &Connection,
    session_id: i64,
    today: &str,
) -> AppResult<AttendanceDetail> {
    parse_day(today, "attendance.today")?;
    let session = session_context(conn, session_id)?;
    let participants = participant_rows(conn, &session)?;
    let policy = attendance_policy(conn)?;

    let mut rows = Vec::with_capacity(participants.len());
    for participant in participants {
        let effect = crate::repo::finance::preview_attendance_financials(
            conn,
            session.id,
            participant.student_id,
            participant.attendance_id,
            today,
        )?;
        rows.push(AttendanceStudentRow {
            attendance_id: participant.attendance_id,
            student_id: participant.student_id,
            full_name: participant.full_name,
            status: participant.status,
            note: participant.note,
            effects: status_effects(effect, &policy),
        });
    }

    Ok(AttendanceDetail {
        session_id: session.id,
        title: session.title,
        subject_name: session.subject_name,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        kind: session.kind,
        rows,
        policy,
    })
}

fn status_effects(
    financial: crate::repo::finance::AttendanceFinancialPreview,
    policy: &AttendancePolicy,
) -> AttendanceStatusEffects {
    let delta = |consumes: bool| AttendanceEffectDelta {
        lesson_credits: if consumes {
            financial.lesson_credits_if_consumed
        } else {
            0
        } - financial.current_lesson_credits_consumed,
        debt_kurus: if consumes {
            financial.debt_if_consumed_kurus
        } else {
            0
        } - financial.current_debt_kurus,
    };
    AttendanceStatusEffects {
        present: delta(true),
        excused: delta(policy.excused_consumes_lesson),
        unexcused: delta(policy.unexcused_consumes_lesson),
        cancelled: delta(false),
    }
}

/// Yoklama panelinin **tek** üretim kaydetme yolu.
///
/// Katılımcı kümesi ders tarihinden yeniden çözülür; arayüzden eksik/fazla öğrenci
/// gelirse hiçbir satır yazılmaz. `marked_at`, arayüzün `local_now` komutundan aldığı
/// tek yerel duvar saatidir; aktif paket günü de bu doğrulanmış değerden türetilir.
pub fn save_attendance(
    conn: &Connection,
    input: &SaveAttendanceInput,
) -> AppResult<SaveAttendanceReport> {
    let marked_at = parse_marked_at(&input.marked_at)?;
    let today = marked_at.date().format("%Y-%m-%d").to_string();
    repo::in_transaction(conn, |conn| {
        let session = session_context(conn, input.session_id)?;
        if session.status == "cancelled" {
            return Err(AppError::new(
                "attendance.sessionCancelled",
                "İptal edilmiş derse yoklama kaydedilemez. Bugün listesini yenileyip başka bir ders seçin.",
            ));
        }
        let expected = eligible_student_ids(conn, &session)?;
        validate_marks(&input.marks, &expected)?;
        let policy = attendance_policy(conn)?;

        let existing: HashMap<i64, Attendance> =
            crate::repo::academic::attendance_of_session(conn, input.session_id)?
                .into_iter()
                .map(|attendance| (attendance.student_id, attendance))
                .collect();

        for mark in &input.marks {
            let note = normalize_note(mark.note.as_deref());
            let row = Attendance {
                id: existing.get(&mark.student_id).and_then(|item| item.id),
                session_id: input.session_id,
                student_id: mark.student_id,
                status: mark.status.clone(),
                marked_at: Some(input.marked_at.clone()),
                note,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            };
            let attendance_id = if let Some(attendance_id) = row.id {
                crate::repo::academic::update_attendance(conn, attendance_id, &row)?;
                attendance_id
            } else {
                crate::repo::academic::insert_attendance(conn, &row)?
            };

            apply_financial_direction(
                conn,
                attendance_id,
                &mark.status,
                &policy,
                session.is_makeup,
                &today,
            )?;
        }

        // Yoklama kaydı tamamlandığı anda ders de işlenmiştir. Durum, zaman damgası
        // ve bütün para/hak hareketleri aynı transaction'da kalır.
        conn.execute(
            "UPDATE session SET status = 'done', attendance_taken_at = ?2, updated_at = ?2 \
             WHERE id = ?1 AND deleted_at IS NULL",
            params![input.session_id, input.marked_at],
        )?;

        Ok(SaveAttendanceReport {
            saved: input.marks.len() as i64,
        })
    })
}

fn attendance_policy(conn: &Connection) -> AppResult<AttendancePolicy> {
    Ok(AttendancePolicy {
        excused_consumes_lesson: crate::repo::setting::value_bool(
            conn,
            "absence_excused_consumes_lesson",
            false,
        )?,
        unexcused_consumes_lesson: crate::repo::setting::value_bool(
            conn,
            "absence_unexcused_consumes_lesson",
            true,
        )?,
    })
}

fn apply_financial_direction(
    conn: &Connection,
    attendance_id: i64,
    status: &str,
    policy: &AttendancePolicy,
    is_makeup: bool,
    today: &str,
) -> AppResult<()> {
    // Telafi, asıl yoklamanın para/hak sonucunu ikinci kez üretmez (ADR-016).
    if is_makeup {
        return Ok(());
    }

    let consumes = match status {
        "present" => true,
        "excused" => policy.excused_consumes_lesson,
        "unexcused" => policy.unexcused_consumes_lesson,
        "cancelled" => false,
        _ => false, // `validate_marks` bunu çağrıdan önce reddeder.
    };

    if consumes {
        // Sınıflandırmanın tek sahibi finans katmanıdır: mevcut bir ders ücreti
        // zinciri varsa onu canlandırır; paketliyse `None` ile tüketim yoluna yönlendirir.
        if crate::repo::finance::charge_session(conn, attendance_id, today)?.is_none() {
            crate::repo::finance::consume_package_credit(conn, attendance_id, today)?;
        }
    } else {
        // Hangi sayaçta başlık olduğunu burada yeniden çözmeyiz. İki yön fonksiyonu
        // da yok/zaten geri alınmış durumda idempotent olarak hiçbir şey yapmaz.
        crate::repo::finance::reverse_session_charge(conn, attendance_id, today)?;
        crate::repo::finance::restore_package_credit(conn, attendance_id)?;
    }
    Ok(())
}

fn session_context(conn: &Connection, session_id: i64) -> AppResult<SessionContext> {
    conn.query_row(
        "SELECT se.id, se.study_group_id, se.student_id, se.session_date, \
                COALESCE(g.name, st.full_name), sub.name, se.starts_at, se.ends_at, se.kind, \
                se.status, se.is_makeup \
         FROM session se \
         JOIN subject sub ON sub.id = se.subject_id \
         LEFT JOIN study_group g ON g.id = se.study_group_id \
         LEFT JOIN student st ON st.id = se.student_id \
         WHERE se.id = ?1 AND se.deleted_at IS NULL",
        [session_id],
        |row| {
            Ok(SessionContext {
                id: row.get(0)?,
                group_id: row.get(1)?,
                student_id: row.get(2)?,
                session_day: row.get(3)?,
                title: row.get(4)?,
                subject_name: row.get(5)?,
                starts_at: row.get(6)?,
                ends_at: row.get(7)?,
                kind: row.get(8)?,
                status: row.get(9)?,
                is_makeup: row.get(10)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| {
        AppError::new(
            "session_not_found",
            "Bu ders bulunamadı. Bugün listesini yenileyip yeniden deneyin.",
        )
    })
}

fn participant_rows(conn: &Connection, session: &SessionContext) -> AppResult<Vec<ParticipantRow>> {
    let mut out = Vec::new();
    if let Some(group_id) = session.group_id {
        let mut stmt = conn.prepare(
            "SELECT st.id, st.full_name, a.id, COALESCE(a.status, 'pending'), a.note \
             FROM enrollment e \
             JOIN student st ON st.id = e.student_id AND st.deleted_at IS NULL \
             LEFT JOIN attendance a ON a.session_id = ?1 AND a.student_id = st.id \
                                      AND a.deleted_at IS NULL \
             WHERE e.study_group_id = ?2 AND e.deleted_at IS NULL \
               AND e.start_on <= ?3 AND (e.end_on IS NULL OR ?3 <= e.end_on)",
        )?;
        let rows = stmt.query_map(
            params![session.id, group_id, session.session_day],
            participant_from_row,
        )?;
        for row in rows {
            out.push(row?);
        }
    } else if let Some(student_id) = session.student_id {
        let row = conn
            .query_row(
                "SELECT st.id, st.full_name, a.id, COALESCE(a.status, 'pending'), a.note \
                 FROM student st \
                 LEFT JOIN attendance a ON a.session_id = ?1 AND a.student_id = st.id \
                                          AND a.deleted_at IS NULL \
                 WHERE st.id = ?2 AND st.deleted_at IS NULL",
                params![session.id, student_id],
                participant_from_row,
            )
            .optional()?;
        if let Some(row) = row {
            out.push(row);
        }
    }
    Ok(out)
}

fn participant_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ParticipantRow> {
    Ok(ParticipantRow {
        student_id: row.get(0)?,
        full_name: row.get(1)?,
        attendance_id: row.get(2)?,
        status: row.get(3)?,
        note: row.get(4)?,
    })
}

fn eligible_student_ids(conn: &Connection, session: &SessionContext) -> AppResult<HashSet<i64>> {
    if let Some(group_id) = session.group_id {
        return Ok(
            crate::repo::academic::group_members_on(conn, group_id, &session.session_day)?
                .into_iter()
                .collect(),
        );
    }
    let Some(student_id) = session.student_id else {
        return Ok(HashSet::new());
    };
    let is_live: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM student WHERE id = ?1 AND deleted_at IS NULL)",
        [student_id],
        |row| row.get(0),
    )?;
    Ok(if is_live {
        HashSet::from([student_id])
    } else {
        HashSet::new()
    })
}

fn validate_marks(marks: &[AttendanceMarkInput], expected: &HashSet<i64>) -> AppResult<()> {
    let actual: HashSet<i64> = marks.iter().map(|mark| mark.student_id).collect();
    if actual.len() != marks.len() || &actual != expected {
        return Err(AppError::new(
            "attendance.participants",
            "Dersin öğrenci listesi değişmiş. Paneli kapatıp yeniden açın.",
        ));
    }
    for mark in marks {
        if !matches!(
            mark.status.as_str(),
            "present" | "excused" | "unexcused" | "cancelled"
        ) {
            return Err(AppError::new(
                "attendance.status",
                "Her öğrenci için Geldi, Mazeretli, Mazeretsiz veya İptal durumlarından birini seçin.",
            ));
        }
        if mark.note.as_deref().unwrap_or("").chars().count() > NOTE_MAX_CHARS {
            return Err(AppError::new(
                "attendance.note",
                "Yoklama notunu kısaltın; en fazla 160 karakter yazabilirsiniz.",
            ));
        }
    }
    Ok(())
}

fn normalize_note(note: Option<&str>) -> Option<String> {
    let trimmed = note.unwrap_or("").trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn parse_day(value: &str, code: &str) -> AppResult<()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| {
            AppError::new(
                code,
                "Tarih okunamadı. Paneli kapatıp Bugün ekranını yenileyin.",
            )
        })
}

fn parse_marked_at(value: &str) -> AppResult<NaiveDateTime> {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M").map_err(|_| {
        AppError::new(
            "attendance.markedAt",
            "Yoklama saati okunamadı. Paneli kapatıp yeniden açın.",
        )
    })
}
