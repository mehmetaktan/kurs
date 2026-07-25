//! Öğrenciler ekranının ve öğrenci detayının veri katmanı (Faz 4).
//!
//! `people.rs` tabloların CRUD'u; burası **ekranın istediği birleşik satır**. Ayrı
//! durmalarının sebebi şu: bu dosyadaki sorgular defter, paket ve yoklama tablolarına
//! dokunuyor — yani `people` değil, ekran bilgisi. İkisi karışırsa `insert_student`'ın
//! yanında bir bakiye sorgusu belirir ve tablo katmanı ekrana bağlanır.
//!
//! ## Üç kural
//!
//! 1. **Sıralama yok** (ADR-020). Bütün sorgular `ORDER BY s.id` ile deterministik döner;
//!    Türkçe sıralama `src/lib/sortTr.ts` içinde yapılır. Sayfalama da orada — sıralı
//!    olmayan bir listeyi sayfalamak yanlış sayfa üretir, o yüzden ikisi aynı yerde durur.
//! 2. **`'now'` okunmaz** (§0). "Bugün" parametredir, Rust'tan bind edilir.
//! 3. **Arşivlenmiş öğrenci listeden düşmez, işaretlenir.** Satır `archived` alanıyla
//!    geliyor; kimi listeden düşeceğine ekran karar veriyor (§1.23: program ekranları
//!    arşivliyi saymaz, muhasebe listeleri sayar).

use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{AppError, AppResult};
use crate::model::{Guardian, Student, StudentGuardian, StudentNote};
use crate::repo;
use crate::text;

// ---------------------------------------------------------------------------
// Liste satırı — EKRANLAR.md §3
// ---------------------------------------------------------------------------

/// `Öğrenciler` tablosunun bir satırı. Tasarımdaki 8 kolonun tamamının kaynağı.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentRow {
    pub id: i64,
    pub full_name: String,
    pub school: Option<String>,
    pub grade: Option<String>,
    pub phone: Option<String>,
    /// Aktif / Pasif — tasarımdaki yeşil nokta / içi boş halka.
    pub is_active: bool,
    /// Arşivlendi (`deleted_at`). `is_active` ile FARKLI şey (§1.5).
    pub archived: bool,
    /// Birincil veli; yoksa en düşük id'li veli. Hiç veli yoksa `None`.
    pub guardian_name: Option<String>,
    pub guardian_phone: Option<String>,
    pub guardian_count: i64,
    /// Kuruş, işaretli: **negatif = borçlu** (K3).
    pub balance_kurus: i64,
    /// `v_student_debt` — borçlu listesinin tek kaynağı (ADR-018). Pozitif ya da sıfır.
    pub debt_kurus: i64,
    pub oldest_due_on: Option<String>,
    /// Geçerli paketlerdeki kalan hak toplamı. Paketi yoksa `None` (`0` ile aynı şey
    /// değil: "paketi bitti" ile "paketi hiç yok" ekranda farklı görünür).
    pub remaining_lessons: Option<i64>,
    /// İşlenmiş ders: yoklaması alınmış ve iptal olmayan satırlar.
    pub processed_lessons: i64,
    /// Bunların kaçında "Geldi" — devam oranının payı.
    pub attended_lessons: i64,
    pub last_session_date: Option<String>,
    /// Canlı kayıtlardan gelen branşlar — Öğrenciler ekranının branş filtresi.
    pub subject_ids: Vec<i64>,
    /// Canlı kayıtlardan gelen gruplar — grup filtresi.
    pub group_ids: Vec<i64>,
}

/// Liste sorgusunun parametreleri. Hepsi isteğe bağlı; boş sorgu "hepsi" demek.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentQuery {
    /// Ad, veli adı ya da telefon. Boşsa arama uygulanmaz.
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub subject_id: Option<i64>,
    #[serde(default)]
    pub group_id: Option<i64>,
    /// `'YYYY-MM-DD'`. Paketin geçerliliği buna göre süzülür — SQLite saati OKUNMAZ (§0).
    /// Boş bırakılırsa yerel bugün kullanılır.
    #[serde(default)]
    pub today: Option<String>,
}

/// Öğrenci listesi. **Sırasız** (ADR-020) — `s.id` ile deterministik.
///
/// Arşivlenmiş öğrenciler de döner; `archived` alanıyla işaretli.
pub fn student_rows(conn: &Connection, query: &StudentQuery) -> AppResult<Vec<StudentRow>> {
    let today = query
        .today
        .clone()
        .unwrap_or_else(clock::today_local_string);

    // Kayıt etiketleri (branş / grup) tek sorguda alınıp Rust'ta eşleniyor: satır başına
    // sorgu açmak N+1 olurdu, JOIN etmek ise bakiye/paket alt sorgularını çoğaltırdı.
    let tags = enrollment_tags(conn)?;

    let mut stmt = conn.prepare(&format!(
        "SELECT s.id, s.full_name, s.school, s.grade, s.phone, s.is_active, \
                s.deleted_at IS NOT NULL AS archived, \
                pg.guardian_name, pg.guardian_phone, \
                COALESCE(gc.n, 0)                                   AS guardian_count, \
                COALESCE(b.balance_kurus, 0)                        AS balance_kurus, \
                COALESCE(d.debt_kurus, 0)                           AS debt_kurus, \
                d.oldest_due_on, \
                pr.remaining_lessons, \
                COALESCE(att.processed, 0)                          AS processed_lessons, \
                COALESCE(att.attended, 0)                           AS attended_lessons, \
                att.last_session_date \
         FROM student s \
         LEFT JOIN ( {primary_guardian} ) pg ON pg.student_id = s.id AND pg.rn = 1 \
         LEFT JOIN ( SELECT sg.student_id, COUNT(*) AS n FROM student_guardian sg \
                     JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
                     WHERE sg.deleted_at IS NULL GROUP BY sg.student_id ) gc \
                ON gc.student_id = s.id \
         LEFT JOIN v_student_balance b ON b.student_id = s.id \
         LEFT JOIN v_student_debt    d ON d.student_id = s.id \
         LEFT JOIN ( SELECT r.student_id, SUM(r.remaining) AS remaining_lessons \
                     FROM v_package_remaining r \
                     WHERE r.remaining > 0 \
                       AND (r.valid_until IS NULL OR r.valid_until >= ?1) \
                     GROUP BY r.student_id ) pr ON pr.student_id = s.id \
         LEFT JOIN ( {attendance_rollup} ) att ON att.student_id = s.id \
         ORDER BY s.id",
        primary_guardian = PRIMARY_GUARDIAN_SQL,
        attendance_rollup = ATTENDANCE_ROLLUP_SQL,
    ))?;

    let rows = stmt.query_map(params![today], |row| row_from(row, &tags))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }

    Ok(filter_rows(out, query))
}

/// Arama ve branş/grup süzgeci.
///
/// Arama Rust'ta: veli adı `guardian.search_name` sütunu olmadığı için SQL'de doğru
/// küçültülemiyor (gerekçe `people::search_students` içinde) ve aynı normalleştirmeyi
/// iki yerde kurmaktansa süzgecin tamamı tek yerde duruyor. Liste birkaç yüz satır;
/// maliyeti ölçülemez.
fn filter_rows(rows: Vec<StudentRow>, query: &StudentQuery) -> Vec<StudentRow> {
    let needle = text::search_name(&query.search);

    rows.into_iter()
        .filter(|row| matches_search(row, &needle, &query.search))
        .filter(|row| match query.subject_id {
            Some(id) => row.subject_ids.contains(&id),
            None => true,
        })
        .filter(|row| match query.group_id {
            Some(id) => row.group_ids.contains(&id),
            None => true,
        })
        .collect()
}

fn matches_search(row: &StudentRow, needle: &str, raw: &str) -> bool {
    if needle.is_empty() {
        return true;
    }
    if text::search_name(&row.full_name).contains(needle) {
        return true;
    }
    if let Some(name) = &row.guardian_name {
        if text::search_name(name).contains(needle) {
            return true;
        }
    }

    // Telefon dalı rakam rakam: "0532" ile "0 532" aynı numarayı bulmalı.
    let digits = text::phone_digits(raw);
    if digits.is_empty() {
        return false;
    }
    let has = |value: &Option<String>| {
        value
            .as_deref()
            .map(|v| text::phone_digits(v).contains(&digits))
            .unwrap_or(false)
    };
    has(&row.phone) || has(&row.guardian_phone)
}

/// Birincil veli — yoksa en düşük id'li veli.
/// `ux_sg_primary` öğrenci başına en fazla bir birincil veliye izin veriyor (§1.7);
/// `ORDER BY sg.id` yalnızca hiç birincil işaretlenmemişse devreye giriyor.
const PRIMARY_GUARDIAN_SQL: &str = "SELECT sg.student_id, \
        g.full_name AS guardian_name, g.phone AS guardian_phone, \
        ROW_NUMBER() OVER (PARTITION BY sg.student_id \
                           ORDER BY sg.is_primary DESC, sg.id) AS rn \
     FROM student_guardian sg \
     JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
     WHERE sg.deleted_at IS NULL";

/// İşlenmiş ders sayacı.
///
/// `pending` sayılmaz — yoklaması girilmemiş ders işlenmiş sayılmaz. `cancelled` de
/// sayılmaz: ders iptal olduysa öğrencinin devamsızlığı değildir. Geriye tasarımın
/// `durMap`'indeki üç gerçek durum kalıyor.
const ATTENDANCE_ROLLUP_SQL: &str = "SELECT a.student_id, \
        COUNT(*)                                                    AS processed, \
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)        AS attended, \
        MAX(ses.session_date)                                        AS last_session_date \
     FROM attendance a \
     JOIN session ses ON ses.id = a.session_id AND ses.deleted_at IS NULL \
     WHERE a.deleted_at IS NULL \
       AND a.status IN ('present', 'excused', 'unexcused') \
     GROUP BY a.student_id";

/// (öğrenci → branşlar, gruplar) — canlı kayıtlardan.
fn enrollment_tags(conn: &Connection) -> AppResult<Vec<(i64, i64, Option<i64>)>> {
    let mut stmt = conn.prepare(
        "SELECT student_id, subject_id, study_group_id FROM enrollment \
         WHERE deleted_at IS NULL ORDER BY id",
    )?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn row_from(row: &Row<'_>, tags: &[(i64, i64, Option<i64>)]) -> rusqlite::Result<StudentRow> {
    let id: i64 = row.get(0)?;

    let mut subject_ids = Vec::new();
    let mut group_ids = Vec::new();
    for (student_id, subject_id, group_id) in tags {
        if *student_id != id {
            continue;
        }
        if !subject_ids.contains(subject_id) {
            subject_ids.push(*subject_id);
        }
        if let Some(group_id) = group_id {
            if !group_ids.contains(group_id) {
                group_ids.push(*group_id);
            }
        }
    }

    Ok(StudentRow {
        id,
        full_name: row.get(1)?,
        school: row.get(2)?,
        grade: row.get(3)?,
        phone: row.get(4)?,
        is_active: row.get(5)?,
        archived: row.get(6)?,
        guardian_name: row.get(7)?,
        guardian_phone: row.get(8)?,
        guardian_count: row.get(9)?,
        balance_kurus: row.get(10)?,
        debt_kurus: row.get(11)?,
        oldest_due_on: row.get(12)?,
        remaining_lessons: row.get(13)?,
        processed_lessons: row.get(14)?,
        attended_lessons: row.get(15)?,
        last_session_date: row.get(16)?,
        subject_ids,
        group_ids,
    })
}

// ---------------------------------------------------------------------------
// Detay — EKRANLAR.md §4
// ---------------------------------------------------------------------------

/// Bir velinin öğrenciye bağlanma biçimi: yakınlık + birincil mi.
/// Bağ satırının kendi `id`'si de geliyor — çözme işlemi bunu kullanıyor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardianLink {
    pub link_id: i64,
    pub guardian_id: i64,
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub relation: Option<String>,
    pub is_primary: bool,
    /// Bu veliye bağlı **başka** öğrenci sayısı — kardeş göstergesi.
    pub other_student_count: i64,
}

/// Öğrenci detayının tamamı. Tek komutta gidiyor: dört ayrı çağrı dört ayrı
/// yükleniyor/hata durumu demekti ve ekranın hepsine aynı anda ihtiyacı var.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentDetail {
    pub student: Student,
    pub row: StudentRow,
    pub guardians: Vec<GuardianLink>,
    pub notes: Vec<StudentNote>,
    /// Gecikme gün sayısı — `views::days_overdue`, `today` bind edilerek (§0).
    pub days_overdue: Option<i64>,
    /// Sıradaki planlı dersin başlangıcı (`'YYYY-MM-DD HH:MM'`). Yoksa `None`.
    pub next_session_at: Option<String>,
}

pub fn student_detail(
    conn: &Connection,
    student_id: i64,
    today: Option<String>,
) -> AppResult<StudentDetail> {
    let today = today.unwrap_or_else(clock::today_local_string);
    let student: Student = repo::require(conn, student_id)?;

    // Satır sorgusu bütün öğrencileri getirip süzüyor; tek öğrenci için ayrı bir SQL
    // yazmak aynı 6 alt sorgunun ikinci bir kopyası olurdu ve ikisi ayrışırdı.
    let row = student_rows(
        conn,
        &StudentQuery {
            today: Some(today.clone()),
            ..StudentQuery::default()
        },
    )?
    .into_iter()
    .find(|row| row.id == student_id)
    .ok_or_else(|| {
        AppError::new(
            "not_found",
            "Kayıt bulunamadı. Arşivlenmiş olabilir; listeyi yenileyin.",
        )
    })?;

    let days_overdue = crate::repo::views::days_overdue(
        chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d")
            .map_err(|err| AppError::internal("bad_today", err))?,
        row.oldest_due_on.as_deref(),
    );

    Ok(StudentDetail {
        guardians: guardian_links(conn, student_id)?,
        notes: repo::people::notes_of(conn, student_id)?,
        next_session_at: next_session_at(conn, student_id, &today)?,
        days_overdue,
        row,
        student,
    })
}

/// Öğrencinin velileri, birincil önce.
pub fn guardian_links(conn: &Connection, student_id: i64) -> AppResult<Vec<GuardianLink>> {
    let mut stmt = conn.prepare(
        "SELECT sg.id, g.id, g.full_name, g.phone, g.email, sg.relation, sg.is_primary, \
                ( SELECT COUNT(*) FROM student_guardian o \
                  JOIN student st ON st.id = o.student_id \
                  WHERE o.guardian_id = g.id AND o.deleted_at IS NULL \
                    AND o.student_id <> ?1 ) AS other_student_count \
         FROM student_guardian sg \
         JOIN guardian g ON g.id = sg.guardian_id AND g.deleted_at IS NULL \
         WHERE sg.student_id = ?1 AND sg.deleted_at IS NULL \
         ORDER BY sg.is_primary DESC, sg.id",
    )?;
    let rows = stmt.query_map([student_id], |row| {
        Ok(GuardianLink {
            link_id: row.get(0)?,
            guardian_id: row.get(1)?,
            full_name: row.get(2)?,
            phone: row.get(3)?,
            email: row.get(4)?,
            relation: row.get(5)?,
            is_primary: row.get(6)?,
            other_student_count: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Sıradaki planlı ders — birebir seansı ya da kayıtlı olduğu grubun seansı.
/// `?2` bugünün damgası; SQLite saati okunmuyor (§0).
fn next_session_at(conn: &Connection, student_id: i64, today: &str) -> AppResult<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT MIN(s.starts_at) FROM session s \
         WHERE s.deleted_at IS NULL AND s.status = 'planned' AND s.session_date >= ?2 \
           AND ( s.student_id = ?1 \
              OR EXISTS ( SELECT 1 FROM enrollment e \
                          WHERE e.student_id = ?1 AND e.deleted_at IS NULL \
                            AND e.study_group_id = s.study_group_id \
                            AND e.start_on <= s.session_date \
                            AND (e.end_on IS NULL OR s.session_date <= e.end_on) ) )",
    )?;
    Ok(stmt.query_row(params![student_id, today], |row| row.get(0))?)
}

// ---------------------------------------------------------------------------
// Yazma yolu — doğrulama + öğrenci/veli birlikte
// ---------------------------------------------------------------------------

/// Formdan gelen öğrenci. `id` doluysa güncelleme, boşsa yeni kayıt.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub full_name: String,
    #[serde(default)]
    pub school: Option<String>,
    #[serde(default)]
    pub grade: Option<String>,
    #[serde(default)]
    pub birth_date: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
    #[serde(default)]
    pub enrolled_on: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    /// Formdaki veli satırlarının tamamı. Listede olmayan mevcut bağlar **çözülür**
    /// (bağ arşivlenir); velinin kendisi silinmez — başka öğrencilere bağlı olabilir.
    #[serde(default)]
    pub guardians: Vec<GuardianInput>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardianInput {
    /// Mevcut bir veliye bağlanıyorsa dolu — kardeşler aynı veliyi paylaşır (§1.7).
    #[serde(default)]
    pub guardian_id: Option<i64>,
    pub full_name: String,
    /// **Zorunlu** (ADR-009): v2'de hatırlatma bu numaraya gidecek.
    pub phone: String,
    #[serde(default)]
    pub email: Option<String>,
    /// 'Anne' | 'Baba' | 'Diğer'
    #[serde(default)]
    pub relation: Option<String>,
    #[serde(default)]
    pub is_primary: bool,
}

/// Öğrenciyi ve velilerini **tek transaction'da** kaydeder; eklenen/güncellenen id döner.
///
/// Transaction şart: veli bağlanamazsa öğrenci de yazılmamalı. Aksi hâlde kullanıcı
/// "kaydettim" diyor ama velisiz bir öğrenci oluşuyor ve listedeki telefon kolonu boş
/// kalıyor — sonra da bunu kimse fark etmiyor.
pub fn save_student(conn: &Connection, input: &StudentInput) -> AppResult<i64> {
    validate_student(input)?;

    repo::in_transaction(conn, |conn| {
        let student = Student {
            id: input.id,
            full_name: input.full_name.trim().to_string(),
            search_name: String::new(), // repository üretir
            school: trimmed(&input.school),
            grade: trimmed(&input.grade),
            birth_date: trimmed(&input.birth_date),
            phone: trimmed(&input.phone),
            phone_digits: None, // repository üretir
            is_active: input.is_active,
            enrolled_on: trimmed(&input.enrolled_on),
            note: trimmed(&input.note),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        };

        let student_id = match input.id {
            Some(id) => {
                repo::people::update_student(conn, id, &student)?;
                id
            }
            None => repo::people::insert_student(conn, &student)?,
        };

        sync_guardians(conn, student_id, &input.guardians)?;
        Ok(student_id)
    })
}

/// Formdaki veli listesini veritabanıyla eşitler.
///
/// Sıra bağlayıcı: **önce bütün birincil işaretleri düşer**, sonra tek bir tanesi
/// kalkar. `ux_sg_primary` öğrenci başına tek birincile izin veriyor (§1.7) ve iki
/// satırın aynı anda `is_primary = 1` olduğu bir an bile olsa `UNIQUE` ihlali doğar.
fn sync_guardians(conn: &Connection, student_id: i64, inputs: &[GuardianInput]) -> AppResult<()> {
    let existing = guardian_links(conn, student_id)?;

    // 1. Bu turda tutulmayan bağlar çözülür. Velinin KENDİSİ silinmez: kardeşe bağlı
    //    olabilir ve oradan da düşerdi.
    let kept: Vec<i64> = inputs.iter().filter_map(|g| g.guardian_id).collect();
    for link in &existing {
        if !kept.contains(&link.guardian_id) {
            repo::archive::<StudentGuardian>(conn, link.link_id)?;
        }
    }

    // 2. Çakışmayı önlemek için önce bütün birincil işaretleri düşürülür.
    conn.execute(
        "UPDATE student_guardian SET is_primary = 0, updated_at = ?2 \
         WHERE student_id = ?1 AND deleted_at IS NULL AND is_primary = 1",
        params![student_id, clock::now_local()],
    )?;

    // 3. Birincil kim: işaretlenen; hiçbiri işaretlenmemişse ilk veli.
    //    Velisi olan bir öğrenci birincilsiz kalamaz — liste telefonu ondan okuyor.
    let primary_index = inputs.iter().position(|g| g.is_primary).unwrap_or_default();

    for (index, input) in inputs.iter().enumerate() {
        let is_primary = index == primary_index;
        let guardian = Guardian {
            id: input.guardian_id,
            full_name: input.full_name.trim().to_string(),
            phone: Some(input.phone.trim().to_string()),
            phone_digits: None, // repository üretir
            email: trimmed(&input.email),
            last_reminded_at: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        };

        let guardian_id = match input.guardian_id {
            Some(id) => {
                repo::people::update_guardian(conn, id, &guardian)?;
                id
            }
            None => repo::people::insert_guardian(conn, &guardian)?,
        };

        link_guardian(conn, student_id, guardian_id, &input.relation, is_primary)?;
    }

    Ok(())
}

/// Bağ yoksa kurar, varsa günceller; arşivlenmiş bağ geri alınır.
///
/// `ux_sg` aynı çiftten iki canlı bağ yazılmasını engelliyor (§1.7) — yani "iki kere
/// bağla" bir hata değil, aynı bağın güncellenmesi.
pub fn link_guardian(
    conn: &Connection,
    student_id: i64,
    guardian_id: i64,
    relation: &Option<String>,
    is_primary: bool,
) -> AppResult<i64> {
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM student_guardian \
             WHERE student_id = ?1 AND guardian_id = ?2 \
             ORDER BY deleted_at IS NULL DESC, id LIMIT 1",
            params![student_id, guardian_id],
            |row| row.get(0),
        )
        .ok();

    match existing {
        Some(link_id) => {
            conn.execute(
                "UPDATE student_guardian \
                 SET relation = ?2, is_primary = ?3, deleted_at = NULL, updated_at = ?4 \
                 WHERE id = ?1",
                params![link_id, relation, is_primary, clock::now_local()],
            )?;
            Ok(link_id)
        }
        None => repo::people::insert_student_guardian(
            conn,
            &StudentGuardian {
                id: None,
                student_id,
                guardian_id,
                relation: relation.clone(),
                is_primary,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        ),
    }
}

/// Bağı çözer. Veli kaydı **durur** — kardeşe bağlı olabilir (§1.7).
pub fn unlink_guardian(conn: &Connection, link_id: i64) -> AppResult<bool> {
    repo::archive::<StudentGuardian>(conn, link_id)
}

/// Adıyla ya da telefonuyla veli arar — "mevcut veliyi bul ve bağla" akışı.
/// Türkçe küçültme Rust'ta (`guardian`ın `search_name` sütunu yok, §1.6).
pub fn search_guardians(conn: &Connection, query: &str) -> AppResult<Vec<Guardian>> {
    let needle = text::search_name(query);
    let digits = text::phone_digits(query);
    if needle.is_empty() && digits.is_empty() {
        return Ok(Vec::new());
    }

    let all: Vec<Guardian> = repo::list_live(conn)?;
    Ok(all
        .into_iter()
        .filter(|g| {
            let by_name = !needle.is_empty() && text::search_name(&g.full_name).contains(&needle);
            let by_phone = !digits.is_empty()
                && g.phone_digits
                    .as_deref()
                    .map(|p| p.contains(&digits))
                    .unwrap_or(false);
            by_name || by_phone
        })
        .collect())
}

/// Öğrenciyi arşivler (ADR-005). Geçmiş kayıtları **bozulmaz**: defter, yoklama ve
/// paket satırları yerinde kalır, yalnızca `student.deleted_at` dolar.
pub fn archive_student(conn: &Connection, id: i64) -> AppResult<bool> {
    repo::archive::<Student>(conn, id)
}

pub fn restore_student(conn: &Connection, id: i64) -> AppResult<bool> {
    repo::restore::<Student>(conn, id)
}

/// Aktif / Pasif — arşivleme DEĞİL (§1.5). Pasif öğrenci listede görünmeye devam eder.
pub fn set_student_active(conn: &Connection, id: i64, is_active: bool) -> AppResult<()> {
    let changed = conn.execute(
        "UPDATE student SET is_active = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, is_active, clock::now_local()],
    )?;
    if changed == 0 {
        return Err(AppError::new(
            "not_found",
            "Öğrenci bulunamadı. Arşivlenmiş olabilir; listeyi yenileyin.",
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Notlar (§1.20)
// ---------------------------------------------------------------------------

/// Tarihli not ekler. `noted_on` verilmezse yerel bugün — SQLite saati OKUNMAZ (§0).
pub fn add_note(
    conn: &Connection,
    student_id: i64,
    body: &str,
    noted_on: Option<String>,
) -> AppResult<i64> {
    let body = body.trim();
    if body.is_empty() {
        return Err(field_error("note.body", "Not metnini yazın."));
    }
    // Kaydın var olduğu doğrulanır: yoksa yabancı anahtar hatası yerine Türkçe mesaj.
    let _: Student = repo::require(conn, student_id)?;

    repo::people::insert_student_note(
        conn,
        &StudentNote {
            id: None,
            student_id,
            teacher_id: None, // ADR-011: tek öğretmen; yazar ayrımı v2'de
            body: body.to_string(),
            noted_on: noted_on.unwrap_or_else(clock::today_local_string),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
}

pub fn archive_note(conn: &Connection, id: i64) -> AppResult<bool> {
    repo::archive::<StudentNote>(conn, id)
}

// ---------------------------------------------------------------------------
// Doğrulama
// ---------------------------------------------------------------------------

/// Alan bazlı doğrulama. `code` **alanın adıdır** (`student.full_name`); arayüz hatayı
/// bu koda bakarak ilgili girdinin altına koyuyor. `message` Türkçe ve **eylem öneriyor** —
/// jenerik "bir hata oluştu" yasak (CLAUDE.md > Arayüz).
///
/// Arayüz aynı kuralları `src/pages/ogrenciler/validate.ts` içinde de uyguluyor: oradaki
/// kopya anında geri bildirim için, buradaki **son söz**. İkisinin ortak vektörleri iki
/// tarafın testinde de var — `parseKurus` ayrışması Faz 2'de tam böyle yakalanmıştı.
pub fn validate_student(input: &StudentInput) -> AppResult<()> {
    let name = input.full_name.trim();
    if name.is_empty() {
        return Err(field_error(
            "student.fullName",
            "Öğrencinin adını ve soyadını yazın.",
        ));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(field_error(
            "student.fullName",
            "Ad çok uzun. En fazla 120 karakter yazın.",
        ));
    }

    check_phone("student.phone", input.phone.as_deref(), false)?;
    check_date("student.birthDate", input.birth_date.as_deref(), "Doğum")?;
    check_date("student.enrolledOn", input.enrolled_on.as_deref(), "Kayıt")?;

    for (index, guardian) in input.guardians.iter().enumerate() {
        let field = |name: &str| format!("guardians.{index}.{name}");

        if guardian.full_name.trim().is_empty() {
            return Err(field_error(
                field("fullName"),
                "Velinin adını ve soyadını yazın.",
            ));
        }
        if guardian.phone.trim().is_empty() {
            // ADR-009: telefon v2'de hatırlatma için kullanılacak; boş bırakılan bir
            // numarayı sonradan toplamak, o özelliği hiç açmamakla aynı şey.
            return Err(field_error(
                field("phone"),
                "Veli telefonu zorunlu. Borç konuşulacak numara bu.",
            ));
        }
        check_phone(&field("phone"), Some(&guardian.phone), true)?;
    }

    if input.guardians.iter().filter(|g| g.is_primary).count() > 1 {
        return Err(field_error(
            "guardians.primary",
            "Yalnızca bir veli birincil olabilir. Listede tek birincil bırakın.",
        ));
    }

    Ok(())
}

const MAX_NAME_CHARS: usize = 120;

/// Türkiye cep/sabit hattı: rakamları 10–13 arasında olmalı.
///
/// Aralık bilerek geniş: `0532 111 22 33` (11), `+90 532 111 22 33` (12) ve `532 111 22 33`
/// (10) aynı numaranın üç yazımı ve kullanıcı hangisini yazarsa yazsın reddedilmemeli.
/// Biçimlendirme ekranda (`formatPhone`), saklanan değer kullanıcının yazdığıdır.
fn check_phone(field: &str, value: Option<&str>, required: bool) -> AppResult<()> {
    let raw = value.unwrap_or("").trim();
    if raw.is_empty() {
        if required {
            return Err(field_error(field, "Telefon numarasını yazın."));
        }
        return Ok(());
    }

    let digits = text::phone_digits(raw);
    if digits.len() < 10 || digits.len() > 13 {
        return Err(field_error(
            field,
            "Telefonu 0 ile başlayan 11 hane olarak yazın, örnek: 0532 111 22 33.",
        ));
    }
    Ok(())
}

/// Tarih `'YYYY-MM-DD'` ve **takvimsel olarak geçerli** olmalı — `2026-02-31` reddedilir.
/// Arayüz `GG.AA.YYYY` yazdırıp bu biçime kendisi çeviriyor (`parseDateTr`).
fn check_date(field: &str, value: Option<&str>, label: &str) -> AppResult<()> {
    let raw = value.unwrap_or("").trim();
    if raw.is_empty() {
        return Ok(());
    }
    if chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d").is_err() {
        return Err(field_error(
            field,
            format!("{label} tarihini GG.AA.YYYY biçiminde yazın, örnek: 12.05.2010."),
        ));
    }
    Ok(())
}

fn field_error(field: impl Into<String>, message: impl Into<String>) -> AppError {
    AppError::new(field, message)
}

/// Boş metni `None` yapar — veritabanında `''` ile `NULL` aynı şey değil ve boş string
/// "değer var" gibi görünüp `COALESCE` dallarını sessizce bozar.
fn trimmed(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(name: &str) -> StudentInput {
        StudentInput {
            id: None,
            full_name: name.into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: Vec::new(),
        }
    }

    #[test]
    fn ad_zorunlu() {
        let err = validate_student(&input("   ")).unwrap_err();
        assert_eq!(err.code, "student.fullName");
        // Mesaj eylem önerir, ham hata kodu göstermez.
        assert!(err.message.contains("adını"));
    }

    #[test]
    fn telefon_istege_bagli_ama_bicimli() {
        let mut ok = input("Elif Yılmaz");
        ok.phone = Some("  ".into());
        assert!(validate_student(&ok).is_ok(), "boş telefon serbest");

        let mut short = input("Elif Yılmaz");
        short.phone = Some("0532".into());
        assert_eq!(validate_student(&short).unwrap_err().code, "student.phone");

        for good in ["0532 111 22 33", "+90 532 111 22 33", "532 111 22 33"] {
            let mut s = input("Elif Yılmaz");
            s.phone = Some(good.into());
            assert!(validate_student(&s).is_ok(), "{good} kabul edilmeli");
        }
    }

    #[test]
    fn takvimsel_olmayan_tarih_reddedilir() {
        let mut s = input("Elif Yılmaz");
        s.birth_date = Some("2010-02-31".into());
        assert_eq!(
            validate_student(&s).unwrap_err().code,
            "student.birthDate",
            "31 Şubat yok"
        );
    }

    #[test]
    fn veli_telefonu_zorunlu() {
        let mut s = input("Elif Yılmaz");
        s.guardians.push(GuardianInput {
            guardian_id: None,
            full_name: "Hatice Yılmaz".into(),
            phone: "  ".into(),
            email: None,
            relation: Some("Anne".into()),
            is_primary: true,
        });
        let err = validate_student(&s).unwrap_err();
        assert_eq!(err.code, "guardians.0.phone", "hata alanı işaretli gelmeli");
    }

    #[test]
    fn iki_birincil_veli_yazilamaz() {
        let mut s = input("Elif Yılmaz");
        for name in ["Hatice Yılmaz", "Ali Yılmaz"] {
            s.guardians.push(GuardianInput {
                guardian_id: None,
                full_name: name.into(),
                phone: "0532 111 22 33".into(),
                email: None,
                relation: None,
                is_primary: true,
            });
        }
        assert_eq!(validate_student(&s).unwrap_err().code, "guardians.primary");
    }

    #[test]
    fn bos_metin_null_olur() {
        assert_eq!(trimmed(&Some("  ".into())), None);
        assert_eq!(
            trimmed(&Some(" 11. sınıf ".into())),
            Some("11. sınıf".into())
        );
    }
}
