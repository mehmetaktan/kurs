//! Rapor ekranlarının salt-okunur projeksiyonları.
//!
//! Arama ve veri filtreleri repository katmanında kalır (ADR-025). Türkçe öğrenci
//! adı sıralaması burada yapılmaz; sonuç arayüzde `lib/sortTr.ts` ile sıralanır
//! (ADR-020).

use chrono::NaiveDate;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::text;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReportOverview {
    pub month: String,
    pub collected_kurus: i64,
    pub collection_count: i64,
    pub processed_session_count: i64,
    pub attendance_present_count: i64,
    pub attendance_eligible_count: i64,
    pub attendance_percentage: Option<i64>,
    pub active_student_count: i64,
    pub total_receivable_kurus: i64,
    pub debtor_count: i64,
    pub ledger_entry_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyCollectionRow {
    /// `YYYY-MM`
    pub month: String,
    pub collected_kurus: i64,
    pub collection_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubjectLessonRow {
    pub subject_id: i64,
    pub subject_name: String,
    pub archived: bool,
    pub processed_session_count: i64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceReportQuery {
    /// İki uç da rapora dahildir (`YYYY-MM-DD`).
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub subject_id: Option<i64>,
    #[serde(default)]
    pub group_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceReportRow {
    pub student_id: i64,
    pub full_name: String,
    pub archived: bool,
    pub excused_count: i64,
    pub unexcused_count: i64,
    pub total_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceSubjectOption {
    pub id: i64,
    pub name: String,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceGroupOption {
    pub id: i64,
    pub name: String,
    pub subject_id: i64,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceFilterOptions {
    pub subjects: Vec<AbsenceSubjectOption>,
    pub groups: Vec<AbsenceGroupOption>,
}

/// E17 özet kartları. Para tutarları kuruş ve tam sayıdır; iptal edilen tahsilatlar
/// hem bu ay toplamından hem aylık tablodan çıkarılır.
pub fn overview(conn: &Connection, now: &str) -> AppResult<ReportOverview> {
    let day = now.get(..10).ok_or_else(|| {
        AppError::new(
            "reports.overview.date",
            "Rapor tarihi okunamadı. Ekranı yenileyip yeniden deneyin.",
        )
    })?;
    parse_day(day)?;
    let month = day[..7].to_string();

    let (collected_kurus, collection_count) = conn.query_row(
        "SELECT COALESCE(SUM(p.amount), 0), COUNT(p.id) \
         FROM payment p \
         WHERE p.deleted_at IS NULL AND substr(p.paid_on, 1, 7) = ?1 \
           AND NOT EXISTS ( \
             SELECT 1 FROM ledger_entry original \
             JOIN ledger_entry reversal \
               ON reversal.reverses_id = original.id AND reversal.deleted_at IS NULL \
             WHERE original.payment_id = p.id \
               AND original.kind = 'payment' AND original.deleted_at IS NULL \
           )",
        [&month],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let processed_session_count = conn.query_row(
        "SELECT COUNT(*) FROM session WHERE status = 'done' AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    let (attendance_present_count, attendance_eligible_count): (i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0), \
                COUNT(a.id) \
         FROM attendance a \
         JOIN session se ON se.id = a.session_id AND se.deleted_at IS NULL \
         WHERE a.deleted_at IS NULL AND se.status <> 'cancelled' \
           AND a.status IN ('present', 'excused', 'unexcused')",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let attendance_percentage = (attendance_eligible_count > 0).then(|| {
        (attendance_present_count * 100 + attendance_eligible_count / 2) / attendance_eligible_count
    });
    let active_student_count = conn.query_row(
        "SELECT COUNT(*) FROM student \
         WHERE is_active = 1 AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;
    let debtor_count = conn.query_row(
        "SELECT COUNT(*) FROM v_student_debt WHERE debt_kurus > 0",
        [],
        |row| row.get(0),
    )?;
    let ledger_entry_count = conn.query_row(
        "SELECT COUNT(*) FROM ledger_entry WHERE deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;

    Ok(ReportOverview {
        month,
        collected_kurus,
        collection_count,
        processed_session_count,
        attendance_present_count,
        attendance_eligible_count,
        attendance_percentage,
        active_student_count,
        total_receivable_kurus: crate::repo::views::total_receivable(conn)?,
        debtor_count,
        ledger_entry_count,
    })
}

pub fn monthly_collections(conn: &Connection) -> AppResult<Vec<MonthlyCollectionRow>> {
    let mut stmt = conn.prepare(
        "SELECT substr(p.paid_on, 1, 7), SUM(p.amount), COUNT(p.id) \
         FROM payment p \
         WHERE p.deleted_at IS NULL \
           AND NOT EXISTS ( \
             SELECT 1 FROM ledger_entry original \
             JOIN ledger_entry reversal \
               ON reversal.reverses_id = original.id AND reversal.deleted_at IS NULL \
             WHERE original.payment_id = p.id \
               AND original.kind = 'payment' AND original.deleted_at IS NULL \
           ) \
         GROUP BY substr(p.paid_on, 1, 7)",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(MonthlyCollectionRow {
            month: row.get(0)?,
            collected_kurus: row.get(1)?,
            collection_count: row.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// İşlenmiş bir grup dersi bir kez sayılır; öğrenci yoklama satırı kadar çoğalmaz.
/// Türkçe branş sıralaması arayüzde yapılır (ADR-020).
pub fn subject_lessons(conn: &Connection) -> AppResult<Vec<SubjectLessonRow>> {
    let mut stmt = conn.prepare(
        "SELECT sub.id, sub.name, sub.deleted_at IS NOT NULL, COUNT(se.id) \
         FROM session se \
         JOIN subject sub ON sub.id = se.subject_id \
         WHERE se.status = 'done' AND se.deleted_at IS NULL \
         GROUP BY sub.id, sub.name, sub.deleted_at",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SubjectLessonRow {
            subject_id: row.get(0)?,
            subject_name: row.get(1)?,
            archived: row.get(2)?,
            processed_session_count: row.get(3)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Rapor filtresi canlı tanımları ve geçmiş devamsızlıkta kullanılan arşivli
/// tanımları birlikte döndürür. Genel `list_subjects` / `list_study_groups` canlı
/// seçim sözleşmesi değiştirilmez.
pub fn absence_filter_options(conn: &Connection) -> AppResult<AbsenceFilterOptions> {
    let mut subject_stmt = conn.prepare(
        "SELECT sub.id, sub.name, sub.deleted_at IS NOT NULL \
         FROM subject sub \
         WHERE sub.deleted_at IS NULL \
            OR EXISTS (SELECT 1 FROM study_group g \
                       WHERE g.subject_id = sub.id AND g.deleted_at IS NULL) \
            OR EXISTS ( \
           SELECT 1 FROM session se \
           JOIN attendance a ON a.session_id = se.id AND a.deleted_at IS NULL \
           WHERE se.subject_id = sub.id AND se.deleted_at IS NULL \
             AND se.status <> 'cancelled' \
             AND a.status IN ('excused', 'unexcused') \
         )",
    )?;
    let subjects = subject_stmt
        .query_map([], |row| {
            Ok(AbsenceSubjectOption {
                id: row.get(0)?,
                name: row.get(1)?,
                archived: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut group_stmt = conn.prepare(
        "SELECT g.id, g.name, g.subject_id, g.deleted_at IS NOT NULL \
         FROM study_group g \
         WHERE g.deleted_at IS NULL OR EXISTS ( \
           SELECT 1 FROM session se \
           JOIN attendance a ON a.session_id = se.id AND a.deleted_at IS NULL \
           WHERE se.study_group_id = g.id AND se.deleted_at IS NULL \
             AND se.status <> 'cancelled' \
             AND a.status IN ('excused', 'unexcused') \
         )",
    )?;
    let groups = group_stmt
        .query_map([], |row| {
            Ok(AbsenceGroupOption {
                id: row.get(0)?,
                name: row.get(1)?,
                subject_id: row.get(2)?,
                archived: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(AbsenceFilterOptions { subjects, groups })
}

/// Seçilen kapalı tarih aralığındaki mazeretli + mazeretsiz devamsızlık toplamı.
///
/// Kaynak doğrudan `attendance`: bir yoklama satırı bir kez sayılır. Grup üyeliği
/// normal JOIN yapılmaz; ayrılıp yeniden katılan ya da bozuk/eski veride çakışan iki
/// kayıt yoklamayı çoğaltmasın diye tarih aralıklı `EXISTS` ile doğrulanır.
pub fn absence_rows(
    conn: &Connection,
    query: &AbsenceReportQuery,
) -> AppResult<Vec<AbsenceReportRow>> {
    let from = parse_day(&query.from)?;
    let to = parse_day(&query.to)?;
    if from > to {
        return Err(AppError::new(
            "reports.absence.range",
            "Başlangıç tarihi bitiş tarihinden sonra olamaz. Tarih aralığını düzeltip yeniden deneyin.",
        ));
    }

    let needle = text::search_name(&query.search);
    let mut stmt = conn.prepare(
        "SELECT st.id, st.full_name, st.deleted_at IS NOT NULL, \
                SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END), \
                SUM(CASE WHEN a.status = 'unexcused' THEN 1 ELSE 0 END), \
                COUNT(a.id) \
         FROM attendance a \
         JOIN session se ON se.id = a.session_id AND se.deleted_at IS NULL \
         JOIN student st ON st.id = a.student_id \
         WHERE a.deleted_at IS NULL \
           AND a.status IN ('excused', 'unexcused') \
           AND se.status <> 'cancelled' \
           AND se.session_date >= ?1 AND se.session_date <= ?2 \
           AND (?3 IS NULL OR se.subject_id = ?3) \
           AND (?4 IS NULL OR se.study_group_id = ?4) \
           AND (?5 = '' OR instr(st.search_name, ?5) > 0) \
           AND (se.study_group_id IS NULL OR EXISTS ( \
             SELECT 1 FROM enrollment e \
             WHERE e.student_id = a.student_id \
               AND e.study_group_id = se.study_group_id \
               AND e.deleted_at IS NULL \
               AND e.start_on <= se.session_date \
               AND (e.end_on IS NULL OR se.session_date <= e.end_on) \
           )) \
         GROUP BY st.id, st.full_name, st.deleted_at",
    )?;
    let rows = stmt.query_map(
        params![
            from.format("%Y-%m-%d").to_string(),
            to.format("%Y-%m-%d").to_string(),
            query.subject_id,
            query.group_id,
            needle,
        ],
        |row| {
            Ok(AbsenceReportRow {
                student_id: row.get(0)?,
                full_name: row.get(1)?,
                archived: row.get(2)?,
                excused_count: row.get(3)?,
                unexcused_count: row.get(4)?,
                total_count: row.get(5)?,
            })
        },
    )?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn parse_day(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").map_err(|_| {
        AppError::new(
            "reports.absence.date",
            "Tarih aralığı okunamadı. Başlangıç ve bitiş tarihlerini gün.ay.yıl biçiminde seçin.",
        )
    })
}
