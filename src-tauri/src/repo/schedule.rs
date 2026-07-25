//! Ders programının veri katmanı (Faz 5A): seans üretimi, çakışma, kapsam silme ve
//! grupların ekran projeksiyonu.
//!
//! `academic.rs` tabloların CRUD'u; burası **ekranın istediği birleşik satır** ve zaman
//! mantığı. Ayrım `roster.rs` ↔ `people.rs` ile aynı gerekçeye dayanıyor (ADR-025):
//! ikisi aynı dosyada dursaydı `insert_session`'ın yanında bir doluluk sorgusu belirir
//! ve tablo katmanı ekrana bağlanırdı.
//!
//! ## Üç kural
//!
//! 1. **Sıralama yok** (ADR-020). Sorgular `ORDER BY id` ile deterministik döner; Türkçe
//!    sıralama ve sayfalama arayüzde. Tek istisna **zaman kolonları**: `starts_at`
//!    metinsel olarak sıralanabilir bir damga, orada `ORDER BY` serbest.
//! 2. **`'now'` okunmaz** (`VERI-MODELI §0`). "Bugün" parametredir, `chrono::Local`'dan
//!    çağıran tarafta üretilip bind edilir. Bu dosyada `date('now')` geçmez.
//! 3. **Arşivlenmiş öğrenci program ekranlarında sayılmaz** (§1.23). Doluluk, üye listesi
//!    ve devam oranı canlı öğrenciyi sayar; muhasebe listeleri bu dosyayı kullanmaz.

use std::collections::{HashMap, HashSet};

use chrono::{Datelike, Days, NaiveDate, NaiveDateTime, NaiveTime};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{AppError, AppResult};
use crate::model::{ClosedDay, Enrollment, SessionSeries, StudyGroup};
use crate::repo::{self, setting};
use crate::text;

/// `setting.session_horizon_weeks` okunamazsa kullanılan ufuk (§1.14).
const DEFAULT_HORIZON_WEEKS: i64 = 16;
/// `setting.default_session_minutes` okunamazsa kullanılan süre (PRD S4).
pub const DEFAULT_SESSION_MINUTES: i64 = 60;

// ===========================================================================
// Seans üretimi — §1.14 "Seanslar ne kadar ileriye üretilir"
// ===========================================================================

/// `generate_sessions` ne yaptı. Ekrana gitmiyor; açılış logunda ve testlerde okunuyor.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateReport {
    /// Yazılan yeni seans sayısı.
    pub created: i64,
    /// Zaten var olduğu için atlanan slot sayısı (idempotentliğin ölçüsü).
    pub existing: i64,
    /// Tatile denk geldiği için hiç üretilmeyen slot sayısı.
    pub closed: i64,
}

/// Haftalık şablonlardan ufka kadar eksik seansları üretir.
///
/// **Neden ufuk var.** `session_series.ends_on = NULL` "süresiz" demek ama seans sonsuza
/// kadar üretilemez. Ufuk tanımlı olmasaydı takvim birkaç ay sonra **sessizce boşalır**
/// ve Bugün ekranı "Haftalık ders programı henüz oluşturulmadı" (R1.7) yanlış boş-durum
/// metnini gösterirdi — oysa program var, seans üretilmemiştir.
///
/// **Neden geçmişe üretmiyor.** Üretim `max(series.starts_on, today)`'dan başlar. Geçmişte
/// olmayan bir seans ya hiç üretilmemiştir ya da bilerek kaldırılmıştır; ikisinde de
/// sonradan yazmak **olmamış bir ders icat etmek** olur. Dönem ortasında kurulan bir grup
/// için de doğrusu budur: kurs sahibi bugünden itibaren ders işleyecek.
///
/// **Idempotent.** Var olan slot atlanır; şema tarafındaki mühür `ux_session_series_slot`
/// `(series_id, starts_at)`. Atlama sessiz değil — `GenerateReport.existing` sayıyor.
///
/// **İptal edilmiş seans dirilmez**: satır yerinde duruyor (`status='cancelled'`,
/// `deleted_at` NULL), varlık kontrolü onu da görüyor.
pub fn generate_sessions(conn: &Connection, today: NaiveDate) -> AppResult<GenerateReport> {
    let weeks = setting::value_i64(conn, "session_horizon_weeks")?
        .filter(|w| *w > 0)
        .unwrap_or(DEFAULT_HORIZON_WEEKS);
    let horizon = today
        .checked_add_days(Days::new(weeks as u64 * 7))
        .ok_or_else(|| AppError::internal("horizon_overflow", "ufuk tarihi taşdı"))?;

    let weekly_closed = weekly_closed_days(conn)?;
    let closed = closed_days_between(conn, today, horizon)?;

    let mut report = GenerateReport::default();

    for series in repo::list_live::<SessionSeries>(conn)? {
        let Some(series_id) = series.id else { continue };

        let starts_on = parse_date(&series.starts_on)?;
        let mut day = starts_on.max(today);
        // İlk eşleşen güne atla: haftalık şablon `weekday` üzerinde tanımlı (1 = Pazartesi).
        while day.weekday().number_from_monday() as i64 != series.weekday {
            day = next_day(day)?;
        }

        let last = match series.ends_on.as_deref() {
            Some(end) => parse_date(end)?.min(horizon),
            None => horizon,
        };

        while day <= last {
            let key = clock::date_string(day);
            if weekly_closed.contains(&series.weekday) || closed.contains(&key) {
                report.closed += 1;
            } else {
                let (starts_at, ends_at) =
                    slot_bounds(day, &series.start_time, series.duration_min)?;
                if slot_exists(conn, series_id, &starts_at)? {
                    report.existing += 1;
                } else {
                    insert_from_series(conn, &series, series_id, &starts_at, &ends_at)?;
                    report.created += 1;
                }
            }
            day = add_days(day, 7)?;
        }
    }

    Ok(report)
}

fn slot_exists(conn: &Connection, series_id: i64, starts_at: &str) -> AppResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM session \
         WHERE series_id = ?1 AND starts_at = ?2 AND deleted_at IS NULL",
        params![series_id, starts_at],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Şablondan tek bir seans yazar.
///
/// **`unit_price` neden yalnızca birebirde doluyor (ADR-006).** Grup seansının tek bir
/// ücreti yoktur: her üyenin fiyatı kendi `enrollment` satırında. Oraya `0` yazmak,
/// `VERI-MODELI §5`'in `resolve_unit_price` zincirinde "bu ders bedava" anlamına gelen
/// sessiz bir yedek üretirdi — o bölümün açıkça yasakladığı şey bu. Grup seansında alan
/// `NULL` kalır ve fiyat yoklama anında üyenin kaydından çözülür.
fn insert_from_series(
    conn: &Connection,
    series: &SessionSeries,
    series_id: i64,
    starts_at: &str,
    ends_at: &str,
) -> AppResult<()> {
    let unit_price = match series.student_id {
        Some(student_id) => solo_unit_price(conn, student_id, series.subject_id, starts_at)?,
        None => None,
    };

    repo::academic::insert_session(
        conn,
        &crate::model::Session {
            id: None,
            series_id: Some(series_id),
            study_group_id: series.study_group_id,
            student_id: series.student_id,
            subject_id: series.subject_id,
            teacher_id: series.teacher_id,
            starts_at: starts_at.to_string(),
            ends_at: ends_at.to_string(),
            session_date: None, // GENERATED
            kind: None,         // GENERATED
            status: "planned".into(),
            is_makeup: false,
            makeup_for_attendance_id: None,
            unit_price,
            attendance_taken_at: None,
            cancel_reason: None,
            note: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )?;
    Ok(())
}

/// Birebir seansın ücret snapshot'ı: o tarihte geçerli, aynı branştaki canlı kaydın
/// birim ücreti. Kayıt yoksa `None` — sıfır yazılmaz (yukarıdaki gerekçe).
fn solo_unit_price(
    conn: &Connection,
    student_id: i64,
    subject_id: i64,
    starts_at: &str,
) -> AppResult<Option<i64>> {
    let day = &starts_at[..10];
    let mut stmt = conn.prepare(
        "SELECT unit_price FROM enrollment \
         WHERE student_id = ?1 AND subject_id = ?2 AND study_group_id IS NULL \
           AND deleted_at IS NULL \
           AND start_on <= ?3 AND (end_on IS NULL OR ?3 <= end_on) \
         ORDER BY id LIMIT 1",
    )?;
    let mut rows = stmt.query_map(params![student_id, subject_id, day], |row| row.get(0))?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// `setting.weekly_closed_days` — "1,7" gibi virgülle ayrılmış gün numaraları
/// (1 = Pazartesi … 7 = Pazar). Boş değer "haftalık kapalı gün yok" demektir.
pub fn weekly_closed_days(conn: &Connection) -> AppResult<HashSet<i64>> {
    let raw = setting::value_or(conn, "weekly_closed_days", "")?;
    Ok(parse_weekdays(&raw))
}

pub fn parse_weekdays(raw: &str) -> HashSet<i64> {
    raw.split(&[',', ' '][..])
        .filter_map(|part| part.trim().parse::<i64>().ok())
        .filter(|day| (1..=7).contains(day))
        .collect()
}

pub fn format_weekdays(days: &[i64]) -> String {
    let mut sorted: Vec<i64> = days
        .iter()
        .copied()
        .filter(|d| (1..=7).contains(d))
        .collect();
    sorted.sort_unstable();
    sorted.dedup();
    sorted
        .iter()
        .map(|d| d.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

fn closed_days_between(
    conn: &Connection,
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<HashSet<String>> {
    let mut stmt = conn.prepare(
        "SELECT day FROM closed_day \
         WHERE deleted_at IS NULL AND day BETWEEN ?1 AND ?2",
    )?;
    let rows = stmt.query_map(
        params![clock::date_string(from), clock::date_string(to)],
        |row| row.get::<_, String>(0),
    )?;
    let mut out = HashSet::new();
    for row in rows {
        out.insert(row?);
    }
    Ok(out)
}

/// Bir gün programa kapalı mı: tek seferlik tatil **veya** haftalık kapalı gün.
/// Takvim taralı sütunu ve K-2 ("tatile ders bırakılamaz") bunu okur.
pub fn is_closed_day(conn: &Connection, day: NaiveDate) -> AppResult<bool> {
    if weekly_closed_days(conn)?.contains(&(day.weekday().number_from_monday() as i64)) {
        return Ok(true);
    }
    repo::academic::is_closed(conn, &clock::date_string(day))
}

// ---------------------------------------------------------------------------
// Tarih / saat yardımcıları — hepsi saf, hiçbiri SQLite saatini okumaz (§0)
// ---------------------------------------------------------------------------

fn parse_date(raw: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| {
        AppError::new(
            "invalid_date",
            "Tarih okunamadı. Tarihi gün.ay.yıl biçiminde seçin.",
        )
    })
}

fn parse_time(raw: &str) -> AppResult<NaiveTime> {
    NaiveTime::parse_from_str(raw.trim(), "%H:%M")
        .map_err(|_| AppError::new("invalid_time", "Saat okunamadı. Saati 16:00 gibi yazın."))
}

fn add_days(day: NaiveDate, count: u64) -> AppResult<NaiveDate> {
    day.checked_add_days(Days::new(count))
        .ok_or_else(|| AppError::internal("date_overflow", "tarih taşdı"))
}

fn next_day(day: NaiveDate) -> AppResult<NaiveDate> {
    add_days(day, 1)
}

/// `('YYYY-MM-DD HH:MM', 'YYYY-MM-DD HH:MM')` — yerel duvar saati (ADR-017).
///
/// Bitiş `NaiveDateTime` üzerinden hesaplanıyor, saat metnine dakika eklenerek değil:
/// gece yarısını aşan bir ders (23:30 + 60 dk) aksi hâlde `00:30` üretir ve
/// `CHECK (ends_at > starts_at)` metin karşılaştırması olduğu için şema reddeder.
pub fn slot_bounds(
    day: NaiveDate,
    start_time: &str,
    duration_min: i64,
) -> AppResult<(String, String)> {
    if duration_min <= 0 {
        return Err(AppError::new(
            "invalid_duration",
            "Ders süresi sıfırdan büyük olmalı.",
        ));
    }
    let start = NaiveDateTime::new(day, parse_time(start_time)?);
    let end = start
        .checked_add_signed(chrono::TimeDelta::minutes(duration_min))
        .ok_or_else(|| AppError::internal("time_overflow", "bitiş saati taşdı"))?;
    Ok((format_stamp(start), format_stamp(end)))
}

fn format_stamp(value: NaiveDateTime) -> String {
    value.format("%Y-%m-%d %H:%M").to_string()
}

// ===========================================================================
// Çakışma — PRD K-1 / R3.11: uyar, ENGELLEME
// ===========================================================================

/// Çakışan bir dersin ekranda gösterilecek özeti. Uyarı dersin **adını** söylemek
/// zorunda (`faz-05.md §6`) — "çakışma var" tek başına kullanıcıya hiçbir şey anlatmıyor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    pub session_id: i64,
    pub starts_at: String,
    pub ends_at: String,
    /// `Matematik · Grup A` ya da `Fizik · Mehmet Aslan`.
    pub label: String,
}

/// Verilen aralıkla çakışan canlı seanslar.
///
/// **Bitişik ders çakışmaz**: karşılaştırma `<` ve `>` ile kurulu, `<=` ile değil.
/// 16:00–17:00 ile 17:00–18:00 arka arkaya iki derstir; bunu çakışma saymak uyarıyı
/// gürültüye çevirir ve kullanıcı bir süre sonra hepsini onaylamaya başlar.
///
/// **Öğretmen süzgeci yok** çünkü ADR-011 tek öğretmen diyor: bu kurulumda üst üste gelen
/// her ders zaten aynı öğretmenin. İkinci öğretmen eklendiğinde buraya `teacher_id`
/// koşulu girer; sorgunun geri kalanı aynı kalır.
///
/// İptal edilmiş seans çakışma saymaz — o saatte ders yok.
pub fn detect_conflicts(
    conn: &Connection,
    starts_at: &str,
    ends_at: &str,
    ignore_session_id: Option<i64>,
) -> AppResult<Vec<Conflict>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.starts_at, s.ends_at, sub.name, g.name, st.full_name \
         FROM session s \
         JOIN subject sub ON sub.id = s.subject_id \
         LEFT JOIN study_group g ON g.id = s.study_group_id \
         LEFT JOIN student st ON st.id = s.student_id \
         WHERE s.deleted_at IS NULL \
           AND s.status <> 'cancelled' \
           AND s.id IS NOT ?3 \
           AND s.starts_at < ?2 AND s.ends_at > ?1 \
         ORDER BY s.starts_at",
    )?;
    let rows = stmt.query_map(params![starts_at, ends_at, ignore_session_id], |row| {
        let subject: String = row.get(3)?;
        let group: Option<String> = row.get(4)?;
        let student: Option<String> = row.get(5)?;
        let who = group.or(student).unwrap_or_default();
        Ok(Conflict {
            session_id: row.get(0)?,
            starts_at: row.get(1)?,
            ends_at: row.get(2)?,
            label: if who.is_empty() {
                subject
            } else {
                format!("{subject} · {who}")
            },
        })
    })?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ===========================================================================
// Seans işlemleri — faz-05 §5
// ===========================================================================

/// Silme kapsamı. Varsayılan **en dar** olan (`Only`); kullanıcıya net sorulur.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionScope {
    /// Sadece bu ders.
    #[default]
    Only,
    /// Bu ve sonraki dersler.
    Following,
    /// Tüm seri.
    All,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReport {
    /// Arşivlenen seans sayısı.
    pub removed: i64,
    /// İptal işaretlenen seans sayısı (şablona bağlı tek ders).
    pub cancelled: i64,
    /// Seri kapatıldı mı / arşivlendi mi.
    pub series_closed: bool,
}

/// Seans siler; kapsamı çağıran belirler.
///
/// **Neden şablona bağlı tek seans arşivlenmiyor, iptal ediliyor.**
/// `ux_session_series_slot` kısmi bir indeks: `WHERE deleted_at IS NULL`. Yani bir seansı
/// arşivlemek slotu **boşaltır** ve `generate_sessions` bir sonraki açılışta o dersi
/// yeniden yazar — kullanıcı sildiği dersi ertesi sabah takvimde bulur. `VERI-MODELI
/// §1.14` bunun çözümünü zaten yazıyor: satır yerinde kalır, `status='cancelled'` olur.
/// Tasarım da bunu istiyor (iptal edilen ders takvimde içi boş gri nokta olarak durur).
///
/// Şablona bağlı **olmayan** seansta böyle bir risk yok; orada arşivleme doğru davranış.
///
/// `Following` / `All` kapsamlarında seri kapandığı için arşivleme güvenli: şablon artık
/// o tarihleri kapsamıyor, üretim geri getirmiyor.
///
/// **İşlenmiş ders hiçbir kapsamda silinmez** (R3.9): yoklaması alınmış seanslar yerinde
/// kalır, yoksa geçmiş ders sayısı ve devam oranı sessizce değişirdi.
pub fn delete_sessions(
    conn: &Connection,
    session_id: i64,
    scope: SessionScope,
) -> AppResult<DeleteReport> {
    let session: crate::model::Session = repo::require(conn, session_id)?;
    let mut report = DeleteReport::default();

    match (scope, session.series_id) {
        // Tek ders, şablona bağlı: iptal (yukarıdaki gerekçe).
        (SessionScope::Only, Some(_)) => {
            cancel_session(conn, session_id, None)?;
            report.cancelled = 1;
        }
        // Şablonsuz seans: arşivleme güvenli, üretim onu geri getirmiyor.
        // "Sonraki dersler" / "tüm seri" de burada tek derse iner — şablon yok.
        (_, None) => {
            if repo::archive::<crate::model::Session>(conn, session_id)? {
                report.removed = 1;
            }
        }
        (SessionScope::Following, Some(series_id)) => {
            let pivot = session_day(&session);
            close_series_before(conn, series_id, &pivot)?;
            report.series_closed = true;
            report.removed = archive_unprocessed(conn, series_id, Some(&pivot))?;
        }
        (SessionScope::All, Some(series_id)) => {
            repo::archive::<SessionSeries>(conn, series_id)?;
            report.series_closed = true;
            report.removed = archive_unprocessed(conn, series_id, None)?;
        }
    }

    Ok(report)
}

fn session_day(session: &crate::model::Session) -> String {
    session
        .session_date
        .clone()
        .unwrap_or_else(|| session.starts_at[..10.min(session.starts_at.len())].to_string())
}

/// Seriyi pivot günün **bir gün öncesinde** kapatır — "Bu ve sonraki dersler" (§1.14).
/// Geçmiş seanslar eski `series_id`'ye bağlı kalır ve hiç dokunulmaz.
fn close_series_before(conn: &Connection, series_id: i64, pivot: &str) -> AppResult<()> {
    let ends_on =
        clock::date_string(parse_date(pivot)?.pred_opt().ok_or_else(|| {
            AppError::internal("date_underflow", "seri bitiş tarihi hesaplanamadı")
        })?);
    conn.execute(
        "UPDATE session_series SET ends_on = ?2, updated_at = ?3 WHERE id = ?1",
        params![series_id, ends_on, clock::now_local()],
    )?;
    Ok(())
}

/// Serinin **yoklaması alınmamış** seanslarını arşivler. `from` verilirse o günden
/// itibaren, verilmezse tamamı.
fn archive_unprocessed(conn: &Connection, series_id: i64, from: Option<&str>) -> AppResult<i64> {
    let changed = conn.execute(
        "UPDATE session SET deleted_at = ?2, updated_at = ?2 \
         WHERE series_id = ?1 AND deleted_at IS NULL \
           AND attendance_taken_at IS NULL AND status <> 'done' \
           AND (?3 IS NULL OR session_date >= ?3)",
        params![series_id, clock::now_local(), from],
    )?;
    Ok(changed as i64)
}

/// İptal — kayıt **silinmez**, durumu değişir (`VERI-MODELI §4`).
/// `deleted_at` dolmaz: iptal edilen ders takvimde ve ders geçmişinde görünmeye devam eder.
///
/// Defter ve paket tarafındaki karşılığı (ters kayıt / hak iadesi) **Faz 6'da** yazılır;
/// burada yalnızca programın durumu değişiyor.
pub fn cancel_session(conn: &Connection, session_id: i64, reason: Option<&str>) -> AppResult<()> {
    let changed = conn.execute(
        "UPDATE session SET status = 'cancelled', cancel_reason = ?2, updated_at = ?3 \
         WHERE id = ?1 AND deleted_at IS NULL",
        params![session_id, reason, clock::now_local()],
    )?;
    if changed == 0 {
        return Err(AppError::new(
            "session_not_found",
            "Ders bulunamadı. Listeyi yenileyip tekrar deneyin.",
        ));
    }
    Ok(())
}

/// Erteleme — tarih/saat değişir, şablon bağı (`series_id`) korunur.
///
/// **Yoklaması alınmış ders taşınamaz** (R3.13): taşınsaydı yoklama başka bir güne ait
/// olurdu ve devam oranı ile ders geçmişi sessizce yanlış bir tarihe kayardı.
pub fn reschedule_session(
    conn: &Connection,
    session_id: i64,
    starts_at: &str,
    duration_min: i64,
) -> AppResult<()> {
    let session: crate::model::Session = repo::require(conn, session_id)?;
    if session.attendance_taken_at.is_some() {
        return Err(AppError::new(
            "session_locked",
            "Bu dersin yoklaması alınmış; ders taşınamaz. \
             Önce yoklamayı geri alın ya da yeni bir telafi dersi planlayın.",
        ));
    }

    let day = parse_date(&starts_at[..10.min(starts_at.len())])?;
    let time = &starts_at[10.min(starts_at.len())..];
    let (starts, ends) = slot_bounds(day, time.trim(), duration_min)?;

    conn.execute(
        "UPDATE session SET starts_at = ?2, ends_at = ?3, updated_at = ?4 WHERE id = ?1",
        params![session_id, starts, ends, clock::now_local()],
    )?;
    Ok(())
}

// ===========================================================================
// Gruplar — EKRANLAR.md §304 (E4) ve §305 (E5)
// ===========================================================================

/// Haftalık programın bir satırı: "Salı 16:00 · 60 dk".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklySlot {
    #[serde(default)]
    pub id: Option<i64>,
    /// 1 = Pazartesi … 7 = Pazar
    pub weekday: i64,
    /// '16:00'
    pub start_time: String,
    pub duration_min: i64,
}

/// `Gruplar` tablosunun bir satırı.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRow {
    pub id: i64,
    pub name: String,
    pub subject_id: i64,
    pub subject_name: String,
    pub subject_color: Option<String>,
    /// Formun ihtiyacı; liste `teacher_name`'i gösteriyor. İkisi birden dönüyor ki
    /// düzenleme ekranı öğretmeni **adına göre** eşlemek zorunda kalmasın — aynı adlı
    /// ikinci bir öğretmen eklendiği gün o eşleme sessizce yanlış satırı seçerdi.
    pub teacher_id: Option<i64>,
    pub teacher_name: Option<String>,
    pub capacity: i64,
    /// Bugün itibarıyla gruba kayıtlı **canlı** öğrenci sayısı (§1.23).
    pub member_count: i64,
    pub weekly: Vec<WeeklySlot>,
    pub is_active: bool,
    /// Arşivlendi (`deleted_at`). `is_active` ile FARKLI şey (§1.5 ile aynı ayrım).
    pub archived: bool,
    pub starts_on: Option<String>,
    pub ends_on: Option<String>,
    /// Bugünden sonraki ilk planlı seans — özet şeritteki "Sıradaki ders".
    pub next_session_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupQuery {
    /// Grup ya da branş adı. Boşsa arama uygulanmaz.
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub subject_id: Option<i64>,
    /// `'YYYY-MM-DD'`. Doluluk ve "sıradaki ders" buna göre hesaplanır — SQLite saati
    /// OKUNMAZ (§0). Boş bırakılırsa yerel bugün.
    #[serde(default)]
    pub today: Option<String>,
}

/// Gruplar listesi. **Sırasız** döner (ADR-020); Türkçe sıralama ve sayfalama arayüzde.
///
/// Arşivlenmiş gruplar da gelir, `archived` alanıyla işaretli — hangi çipin kimi
/// göstereceğine ekran karar veriyor. Öğrenci listesindeki kalıbın aynısı.
pub fn group_rows(conn: &Connection, query: &GroupQuery) -> AppResult<Vec<GroupRow>> {
    let today = query
        .today
        .clone()
        .unwrap_or_else(clock::today_local_string);

    // Haftalık program satır başına ayrı sorgu açılmıyor (N+1): tek sorguda alınıp
    // Rust'ta eşleniyor — `roster.rs`'teki `enrollment_tags` kalıbı.
    let weekly = weekly_index(conn)?;

    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.subject_id, sub.name, sub.color, g.teacher_id, t.full_name, \
                g.capacity, COALESCE(m.n, 0) AS member_count, \
                g.is_active, g.deleted_at IS NOT NULL AS archived, \
                g.starts_on, g.ends_on, nx.next_at \
         FROM study_group g \
         JOIN subject sub ON sub.id = g.subject_id \
         LEFT JOIN teacher t ON t.id = g.teacher_id \
         LEFT JOIN ( SELECT e.study_group_id, COUNT(*) AS n \
                     FROM enrollment e \
                     JOIN student s ON s.id = e.student_id AND s.deleted_at IS NULL \
                     WHERE e.deleted_at IS NULL AND e.study_group_id IS NOT NULL \
                       AND e.start_on <= ?1 AND (e.end_on IS NULL OR ?1 <= e.end_on) \
                     GROUP BY e.study_group_id ) m ON m.study_group_id = g.id \
         LEFT JOIN ( SELECT study_group_id, MIN(starts_at) AS next_at \
                     FROM session \
                     WHERE deleted_at IS NULL AND status = 'planned' \
                       AND session_date >= ?1 AND study_group_id IS NOT NULL \
                     GROUP BY study_group_id ) nx ON nx.study_group_id = g.id \
         ORDER BY g.id",
    )?;

    let rows = stmt.query_map(params![today], |row| group_row_from(row, &weekly))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }

    Ok(filter_groups(out, query))
}

fn group_row_from(
    row: &Row<'_>,
    weekly: &HashMap<i64, Vec<WeeklySlot>>,
) -> rusqlite::Result<GroupRow> {
    let id: i64 = row.get(0)?;
    Ok(GroupRow {
        id,
        name: row.get(1)?,
        subject_id: row.get(2)?,
        subject_name: row.get(3)?,
        subject_color: row.get(4)?,
        teacher_id: row.get(5)?,
        teacher_name: row.get(6)?,
        capacity: row.get(7)?,
        member_count: row.get(8)?,
        weekly: weekly.get(&id).cloned().unwrap_or_default(),
        is_active: row.get(9)?,
        archived: row.get(10)?,
        starts_on: row.get(11)?,
        ends_on: row.get(12)?,
        next_session_at: row.get(13)?,
    })
}

/// Arama ve branş süzgeci — ADR-025: **Rust'ta.**
///
/// SQL yerine burada, `roster.rs` ile aynı gerekçeyle: arama grubun **ve branşın** adına
/// birden bakıyor ve `text::search_name` tek yerde duruyor. Liste iki haneli; maliyeti
/// ölçülemez.
fn filter_groups(rows: Vec<GroupRow>, query: &GroupQuery) -> Vec<GroupRow> {
    let needle = text::search_name(&query.search);

    rows.into_iter()
        .filter(|row| {
            needle.is_empty()
                || text::search_name(&row.name).contains(&needle)
                || text::search_name(&row.subject_name).contains(&needle)
        })
        .filter(|row| match query.subject_id {
            Some(id) => row.subject_id == id,
            None => true,
        })
        .collect()
}

fn weekly_index(conn: &Connection) -> AppResult<HashMap<i64, Vec<WeeklySlot>>> {
    let mut stmt = conn.prepare(
        "SELECT study_group_id, id, weekday, start_time, duration_min \
         FROM session_series \
         WHERE deleted_at IS NULL AND study_group_id IS NOT NULL \
         ORDER BY weekday, start_time",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            WeeklySlot {
                id: row.get(1)?,
                weekday: row.get(2)?,
                start_time: row.get(3)?,
                duration_min: row.get(4)?,
            },
        ))
    })?;

    let mut out: HashMap<i64, Vec<WeeklySlot>> = HashMap::new();
    for row in rows {
        let (group_id, slot) = row?;
        out.entry(group_id).or_default().push(slot);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Grup detayı — E5
// ---------------------------------------------------------------------------

/// Üyelik satırı. **Katılım ve ayrılış tarihiyle**: `enrollment` aralığı grubun kendisi
/// kadar önemli, çünkü geçmiş yoklamalar bu aralığa bakıyor (ADR-013).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub enrollment_id: i64,
    pub student_id: i64,
    pub full_name: String,
    pub start_on: String,
    pub end_on: Option<String>,
    /// Verilen günde grupta mı — ayrılmış üye listede kalır ama soluk gösterilir.
    pub is_current: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupSessionRow {
    pub id: i64,
    pub starts_at: String,
    pub ends_at: String,
    pub status: String,
    pub attendance_taken: bool,
    /// Yoklaması alınmış seanslarda "Geldi" sayısı.
    pub present_count: i64,
    /// Yoklama satırı yazılmış öğrenci sayısı.
    pub marked_count: i64,
}

/// Grup notu — **ayrı bir tablo açılmıyor** (`faz-05.md §2`). Üyelerin `student_note`
/// kayıtlarının birleşik akışı; not eklerken öğrenci seçtiriliyor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupNote {
    pub id: i64,
    pub student_id: i64,
    pub student_name: String,
    pub body: String,
    pub noted_on: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDetail {
    pub group: GroupRow,
    pub members: Vec<GroupMember>,
    pub sessions: Vec<GroupSessionRow>,
    pub notes: Vec<GroupNote>,
    /// İşlenmiş ders: yoklaması alınmış ve iptal olmayan seanslar.
    pub processed_sessions: i64,
    /// Bu seanslardaki "Geldi" sayısı — devam oranının payı.
    pub attended_count: i64,
    /// Yoklama satırı yazılmış toplam öğrenci-ders — devam oranının paydası.
    pub marked_count: i64,
}

/// Grup detayının tamamı **tek çağrıda**: dört ayrı komut dört ayrı yükleniyor/hata
/// durumu demekti ve ekranın hepsine aynı anda ihtiyacı var (`student_detail` ile aynı
/// gerekçe).
pub fn group_detail(
    conn: &Connection,
    group_id: i64,
    today: Option<String>,
) -> AppResult<GroupDetail> {
    let today = today.unwrap_or_else(clock::today_local_string);
    let group = group_rows(
        conn,
        &GroupQuery {
            today: Some(today.clone()),
            ..GroupQuery::default()
        },
    )?
    .into_iter()
    .find(|row| row.id == group_id)
    .ok_or_else(|| {
        AppError::new(
            "group_not_found",
            "Grup bulunamadı. Arşivlenmiş olabilir; listeyi yenileyin.",
        )
    })?;

    let members = group_members(conn, group_id, &today)?;
    let sessions = group_sessions(conn, group_id)?;
    let notes = group_notes(conn, group_id)?;

    let processed_sessions = sessions
        .iter()
        .filter(|s| s.attendance_taken && s.status != "cancelled")
        .count() as i64;
    let attended_count = sessions.iter().map(|s| s.present_count).sum();
    let marked_count = sessions.iter().map(|s| s.marked_count).sum();

    Ok(GroupDetail {
        group,
        members,
        sessions,
        notes,
        processed_sessions,
        attended_count,
        marked_count,
    })
}

/// Grubun üyeleri — **ayrılmış olanlar da**, `is_current` bayrağıyla.
///
/// `academic::group_members_on` yalnızca verilen gündekileri döndürür ve yoklama üretimi
/// onu kullanır. Ekran ise geçmişi de göstermek zorunda: "kim ne zaman katıldı, kim ne
/// zaman ayrıldı" tam olarak bu sekmenin sorusu (R5.7 / R5.8).
fn group_members(conn: &Connection, group_id: i64, today: &str) -> AppResult<Vec<GroupMember>> {
    let mut stmt = conn.prepare(
        "SELECT e.id, e.student_id, s.full_name, e.start_on, e.end_on, \
                (e.start_on <= ?2 AND (e.end_on IS NULL OR ?2 <= e.end_on)) AS is_current \
         FROM enrollment e \
         JOIN student s ON s.id = e.student_id AND s.deleted_at IS NULL \
         WHERE e.study_group_id = ?1 AND e.deleted_at IS NULL \
         ORDER BY e.id",
    )?;
    let rows = stmt.query_map(params![group_id, today], |row| {
        Ok(GroupMember {
            enrollment_id: row.get(0)?,
            student_id: row.get(1)?,
            full_name: row.get(2)?,
            start_on: row.get(3)?,
            end_on: row.get(4)?,
            is_current: row.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Seans geçmişi. `starts_at` zaman damgası — ORDER BY serbest (ADR-020 metin kolonları
/// için).
fn group_sessions(conn: &Connection, group_id: i64) -> AppResult<Vec<GroupSessionRow>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.starts_at, s.ends_at, s.status, \
                s.attendance_taken_at IS NOT NULL AS taken, \
                COALESCE(a.present, 0), COALESCE(a.marked, 0) \
         FROM session s \
         LEFT JOIN ( SELECT session_id, \
                            SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present, \
                            COUNT(*) AS marked \
                     FROM attendance WHERE deleted_at IS NULL GROUP BY session_id ) a \
                ON a.session_id = s.id \
         WHERE s.study_group_id = ?1 AND s.deleted_at IS NULL \
         ORDER BY s.starts_at",
    )?;
    let rows = stmt.query_map([group_id], |row| {
        Ok(GroupSessionRow {
            id: row.get(0)?,
            starts_at: row.get(1)?,
            ends_at: row.get(2)?,
            status: row.get(3)?,
            attendance_taken: row.get(4)?,
            present_count: row.get(5)?,
            marked_count: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn group_notes(conn: &Connection, group_id: i64) -> AppResult<Vec<GroupNote>> {
    let mut stmt = conn.prepare(
        "SELECT n.id, n.student_id, s.full_name, n.body, n.noted_on \
         FROM student_note n \
         JOIN student s ON s.id = n.student_id AND s.deleted_at IS NULL \
         WHERE n.deleted_at IS NULL \
           AND n.student_id IN ( SELECT e.student_id FROM enrollment e \
                                 WHERE e.study_group_id = ?1 AND e.deleted_at IS NULL ) \
         ORDER BY n.noted_on DESC, n.id DESC",
    )?;
    let rows = stmt.query_map([group_id], |row| {
        Ok(GroupNote {
            id: row.get(0)?,
            student_id: row.get(1)?,
            student_name: row.get(2)?,
            body: row.get(3)?,
            noted_on: row.get(4)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Grup yazma — E5 formu
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    pub subject_id: i64,
    #[serde(default)]
    pub teacher_id: Option<i64>,
    pub capacity: i64,
    #[serde(default)]
    pub starts_on: Option<String>,
    #[serde(default)]
    pub ends_on: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    /// Haftalık program. Boş liste geçerli: program sonra girilebilir.
    #[serde(default)]
    pub weekly: Vec<WeeklySlot>,
}

fn default_true() -> bool {
    true
}

/// Grubu ve haftalık programını **tek transaction'da** yazar, ardından seansları üretir.
///
/// Transaction şart: şablon yazılamazsa grup da yazılmamalı. Aksi hâlde kullanıcı
/// "kaydettim" diyor, grup listede görünüyor ama takvimde hiç dersi olmuyor ve neyin
/// eksik olduğunu anlamıyor — `save_student`'ın veli sorunuyla aynı sınıf.
///
/// R5.5: *"Haftalık program grup oluştururken tanımlanır ve seanslar üretilir."* Üretim
/// aynı transaction içinde; `today` çağırandan gelir (§0).
pub fn save_group(conn: &Connection, input: &GroupInput, today: NaiveDate) -> AppResult<i64> {
    validate_group(input)?;

    repo::in_transaction(conn, |conn| {
        let group = StudyGroup {
            id: input.id,
            name: input.name.trim().to_string(),
            search_name: String::new(), // repository üretir
            subject_id: input.subject_id,
            teacher_id: input.teacher_id,
            capacity: input.capacity,
            starts_on: trimmed(&input.starts_on),
            ends_on: trimmed(&input.ends_on),
            is_active: input.is_active,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        };

        let group_id = match input.id {
            Some(id) => {
                repo::academic::update_study_group(conn, id, &group)?;
                id
            }
            None => repo::academic::insert_study_group(conn, &group)?,
        };

        sync_series(conn, group_id, input, today)?;
        generate_sessions(conn, today)?;
        Ok(group_id)
    })
}

/// Formdaki haftalık program satırlarını veritabanıyla eşitler.
///
/// Kaldırılan satırın serisi arşivlenir ve **yoklaması alınmamış** seansları da düşer;
/// işlenmiş dersler yerinde kalır (R3.9). Kalan satırlar güncellenir — `series_id`
/// korunduğu için geçmiş seansların bağı kopmaz.
fn sync_series(
    conn: &Connection,
    group_id: i64,
    input: &GroupInput,
    today: NaiveDate,
) -> AppResult<()> {
    let existing = weekly_index(conn)?
        .get(&group_id)
        .cloned()
        .unwrap_or_default();

    let kept: Vec<i64> = input.weekly.iter().filter_map(|slot| slot.id).collect();
    for slot in &existing {
        let Some(id) = slot.id else { continue };
        if !kept.contains(&id) {
            repo::archive::<SessionSeries>(conn, id)?;
            archive_unprocessed(conn, id, Some(&clock::date_string(today)))?;
        }
    }

    let starts_on = trimmed(&input.starts_on).unwrap_or_else(|| clock::date_string(today));

    for slot in &input.weekly {
        let series = SessionSeries {
            id: slot.id,
            study_group_id: Some(group_id),
            student_id: None,
            subject_id: input.subject_id,
            teacher_id: input.teacher_id,
            weekday: slot.weekday,
            start_time: slot.start_time.trim().to_string(),
            duration_min: slot.duration_min,
            starts_on: starts_on.clone(),
            ends_on: trimmed(&input.ends_on),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        };
        match slot.id {
            Some(id) => repo::academic::update_session_series(conn, id, &series)?,
            None => {
                repo::academic::insert_session_series(conn, &series)?;
            }
        }
    }

    Ok(())
}

/// Alan doğrulaması. Arayüzde bir ikizi var (anında geri bildirim için); **son söz
/// burada** ve ikisi aynı `code` uzayını kullanıyor, böylece hata doğru girdinin altına
/// yerleşiyor (ADR-025).
pub fn validate_group(input: &GroupInput) -> AppResult<()> {
    if input.name.trim().is_empty() {
        return Err(AppError::new(
            "group.name",
            "Grup adı boş olamaz. Örnek: Grup A",
        ));
    }
    if input.capacity <= 0 {
        return Err(AppError::new("group.capacity", "Kapasite en az 1 olmalı."));
    }
    if let (Some(start), Some(end)) = (trimmed(&input.starts_on), trimmed(&input.ends_on)) {
        if end < start {
            return Err(AppError::new(
                "group.endsOn",
                "Bitiş tarihi başlangıçtan önce olamaz.",
            ));
        }
    }
    for (index, slot) in input.weekly.iter().enumerate() {
        if !(1..=7).contains(&slot.weekday) {
            return Err(AppError::new(
                format!("weekly.{index}.weekday"),
                "Ders günü seçilmeli.",
            ));
        }
        parse_time(&slot.start_time).map_err(|_| {
            AppError::new(
                format!("weekly.{index}.startTime"),
                "Saati 16:00 gibi yazın.",
            )
        })?;
        if slot.duration_min <= 0 {
            return Err(AppError::new(
                format!("weekly.{index}.durationMin"),
                "Ders süresi sıfırdan büyük olmalı.",
            ));
        }
    }
    Ok(())
}

fn trimmed(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

// ---------------------------------------------------------------------------
// Üyelik — R5.6 / R5.7 / R5.8, PRD K-8 ve K-22
// ---------------------------------------------------------------------------

/// Doluluk: `(üye, kapasite)`. Kapasite aşımı onay diyaloğunun metnini bu iki sayı kurar
/// ("Bu grup 6 kişilik ve dolu. 7. öğrenci eklensin mi?").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capacity {
    pub member_count: i64,
    pub capacity: i64,
}

pub fn group_capacity(conn: &Connection, group_id: i64, today: &str) -> AppResult<Capacity> {
    let capacity: i64 = conn.query_row(
        "SELECT capacity FROM study_group WHERE id = ?1",
        [group_id],
        |row| row.get(0),
    )?;
    let member_count = repo::academic::group_members_on(conn, group_id, today)?.len() as i64;
    Ok(Capacity {
        member_count,
        capacity,
    })
}

/// Gruba öğrenci ekler — `enrollment` satırı açar (ADR-013: `group_member` tablosu yok).
///
/// **Kapasite burada kontrol EDİLMİYOR ve bu bilinçli** (PRD S2 / K-8 / R5.6).
/// `study_group.capacity` bir hedeftir, kısıt değil; şemaya da CHECK/trigger konmadı.
/// Aşımı kullanıcı onaylar, program onu engellemez. Uyarının yeri arayüz: `group_capacity`
/// sayıları verir, ekran diyaloğu gösterir.
///
/// **Çakışan açık kayıt ise engellenir** (K-22): `insert_enrollment` içindeki
/// `assert_no_enrollment_overlap` aynı öğrenci + branş için ikinci bir canlı aralığa izin
/// vermiyor. Ayrım PRD §7'nin genel ilkesi: program ve kapasiteyle ilgili her şey uyarır,
/// para ve geçmişle ilgili her şey engeller.
pub fn add_group_member(
    conn: &Connection,
    group_id: i64,
    student_id: i64,
    start_on: &str,
) -> AppResult<i64> {
    let group: StudyGroup = repo::require(conn, group_id)?;

    repo::academic::insert_enrollment(
        conn,
        &Enrollment {
            id: None,
            student_id,
            study_group_id: Some(group_id),
            subject_id: group.subject_id,
            teacher_id: group.teacher_id,
            price_rule_id: None,
            // Tarife Faz 7'de. `per_session` + 0 ₺ bugünün doğru ifadesi: kayıt açık,
            // fiyatı henüz tanımlı değil. Yoklama tahakkuku Faz 6'da bu alanı okuyacak
            // ve `resolve_unit_price` sıfırı bulursa kullanıcıya soracak (§5).
            pricing_model: "per_session".into(),
            unit_price: 0,
            start_on: start_on.trim().to_string(),
            end_on: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
}

/// Gruptan çıkarma — kayıt **silinmez**, bitiş tarihi yazılır (R5.8).
///
/// Geçmiş yoklamalar ve borçlar yerinde kalır; öğrenci `end_on`'dan sonraki seanslarda
/// görünmez. `trg_attendance_within_enrollment` bunu veritabanı seviyesinde de mühürlüyor
/// (§1.16), yani kod yanlış yazılsa bile aralık dışına yoklama yazılamaz.
pub fn end_group_membership(conn: &Connection, enrollment_id: i64, end_on: &str) -> AppResult<()> {
    let enrollment: Enrollment = repo::require(conn, enrollment_id)?;
    let end = end_on.trim();
    if end < enrollment.start_on.as_str() {
        return Err(AppError::new(
            "enrollment.endOn",
            "Ayrılış tarihi katılım tarihinden önce olamaz.",
        ));
    }
    conn.execute(
        "UPDATE enrollment SET end_on = ?2, status = 'closed', updated_at = ?3 WHERE id = ?1",
        params![enrollment_id, end, clock::now_local()],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Branş ve kapalı gün — E7 / E8 formlarının yazma yolu
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    /// Boş = `setting.default_session_minutes` (PRD S4).
    #[serde(default)]
    pub default_min: Option<i64>,
    #[serde(default)]
    pub sort_order: i64,
}

/// Branş kaydeder. Tekillik `search_name` üzerinde ve **repository üretiyor** (K9):
/// `Matematik` ile `matematik` aynı branştır, ihlali `ux_subject_name` yakalar ve
/// `error.rs` Türkçeye çevirir.
pub fn save_subject(conn: &Connection, input: &SubjectInput) -> AppResult<i64> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::new(
            "subject.name",
            "Branş adı boş olamaz. Örnek: Matematik",
        ));
    }
    if let Some(min) = input.default_min {
        if min <= 0 {
            return Err(AppError::new(
                "subject.defaultMin",
                "Ders süresi sıfırdan büyük olmalı.",
            ));
        }
    }

    let subject = crate::model::Subject {
        id: input.id,
        name: name.to_string(),
        search_name: String::new(), // repository üretir
        color: trimmed(&input.color),
        default_min: input.default_min,
        sort_order: input.sort_order,
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };

    match input.id {
        Some(id) => {
            repo::academic::update_subject(conn, id, &subject)?;
            Ok(id)
        }
        None => repo::academic::insert_subject(conn, &subject),
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosedDayInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub day: String,
    pub label: String,
}

pub fn save_closed_day(conn: &Connection, input: &ClosedDayInput) -> AppResult<i64> {
    let day = input.day.trim();
    parse_date(day)?;
    let label = input.label.trim();
    if label.is_empty() {
        return Err(AppError::new(
            "closedDay.label",
            "Açıklama boş olamaz. Örnek: Ramazan Bayramı",
        ));
    }

    let closed = ClosedDay {
        id: input.id,
        day: day.to_string(),
        label: label.to_string(),
        created_at: None,
        updated_at: None,
        deleted_at: None,
    };

    match input.id {
        Some(id) => {
            repo::academic::update_closed_day(conn, id, &closed)?;
            Ok(id)
        }
        None => repo::academic::insert_closed_day(conn, &closed),
    }
}

/// Branşın varsayılan ders süresi; yoksa `setting.default_session_minutes`, o da yoksa 60.
/// PRD S4'ün cevabının okunduğu tek yer.
pub fn default_minutes(conn: &Connection, subject_id: Option<i64>) -> AppResult<i64> {
    if let Some(id) = subject_id {
        let value: Option<i64> = conn
            .query_row(
                "SELECT default_min FROM subject WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |row| row.get(0),
            )
            .unwrap_or(None);
        if let Some(min) = value.filter(|m| *m > 0) {
            return Ok(min);
        }
    }
    Ok(setting::value_i64(conn, "default_session_minutes")?
        .filter(|m| *m > 0)
        .unwrap_or(DEFAULT_SESSION_MINUTES))
}
