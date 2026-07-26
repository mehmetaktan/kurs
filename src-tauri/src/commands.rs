//! Frontend'e açılan komutlar.
//!
//! Bu katman **ince** olmak zorunda (ADR-002): argümanı alır, repository'yi çağırır,
//! sonucu döndürür. İş mantığı burada değil `repo` altında — orada in-memory SQLite ile
//! test edilebiliyor, burada edilemez.
//!
//! Faz 2'de yalnızca iskeletin çalıştığını gösteren komutlar var; modül komutları
//! kendi fazlarında eklenir.

use serde::Serialize;
use tauri::State;

use crate::clock;
use crate::error::AppResult;
use crate::model::{
    ClosedDay, Guardian, InstallmentOpen, PriceRule, Setting, Student, StudentBalance, StudentDebt,
    StudyGroup, Subject, Teacher,
};
use crate::repo::attendance::{AttendanceDetail, SaveAttendanceInput, SaveAttendanceReport};
use crate::repo::finance::{
    PackageCloseMode, PackageCloseReport, PackageOverview, PackageSaleInput,
    PaymentAllocationInput, PaymentInput, PaymentReport, PriceRuleInput,
};
use crate::repo::people::TeacherInput;
use crate::repo::roster::{StudentDetail, StudentInput, StudentQuery, StudentRow};
use crate::repo::schedule::{
    ApplyTemplateReport, Capacity, ClosedDayInput, Conflict, DaySessionRow, DeleteReport,
    GroupDetail, GroupInput, GroupQuery, GroupRow, RescheduleReport, RescheduleScope,
    SaveSessionReport, SessionInput, SessionScope, SubjectInput, TemplatePreview,
};
use crate::{db, repo, AppState};

/// Faz 2 durum ekranının verisi — veritabanı bağlantısının çalıştığının kanıtı.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub db_path: String,
    pub sqlite_version: String,
    pub journal_mode: String,
    pub foreign_keys: bool,
    pub applied_migrations: Vec<i64>,
    pub institution_name: String,
    pub teacher_name: String,
    pub student_count: i64,
    pub session_count: i64,
    pub ledger_count: i64,
}

#[tauri::command]
pub fn app_status(state: State<'_, AppState>) -> AppResult<AppStatus> {
    let db_path = state.db_path.display().to_string();
    let applied_migrations = state.applied_migrations.clone();

    state.with_conn(|conn| {
        Ok(AppStatus {
            db_path,
            sqlite_version: db::sqlite_version(conn)?,
            journal_mode: db::journal_mode(conn)?,
            foreign_keys: db::foreign_keys_enabled(conn)?,
            applied_migrations,
            // ADR-024: kurum adı `setting` tablosundan DEĞİL, derleme anında gömülen
            // `config/kurum.json`'dan geliyor. `setting.institution_name` satırı
            // migration mühürlü olduğu için duruyor ama okunmuyor.
            institution_name: crate::brand::institution_name().to_string(),
            teacher_name: teacher_name(conn)?,
            student_count: repo::count_live::<Student>(conn)?,
            session_count: repo::count_live::<crate::model::Session>(conn)?,
            ledger_count: repo::count_live::<crate::model::LedgerEntry>(conn)?,
        })
    })
}

#[tauri::command]
pub fn list_settings(state: State<'_, AppState>) -> AppResult<Vec<Setting>> {
    state.with_conn(repo::setting::list)
}

/// Sonuç **sırasızdır** — Türkçe sıralama `src/lib/sortTr.ts` içinde yapılır (ADR-020).
#[tauri::command]
pub fn list_students(state: State<'_, AppState>) -> AppResult<Vec<Student>> {
    state.with_conn(repo::list_live::<Student>)
}

#[tauri::command]
pub fn search_students(state: State<'_, AppState>, query: String) -> AppResult<Vec<Student>> {
    state.with_conn(|conn| repo::people::search_students(conn, &query))
}

#[tauri::command]
pub fn student_balance(
    state: State<'_, AppState>,
    student_id: i64,
) -> AppResult<Option<StudentBalance>> {
    state.with_conn(|conn| repo::views::student_balance(conn, student_id))
}

/// Borçlu listesi — tek kaynak defter (ADR-018).
#[tauri::command]
pub fn student_debts(state: State<'_, AppState>) -> AppResult<Vec<StudentDebt>> {
    state.with_conn(repo::views::student_debts)
}

#[tauri::command]
pub fn debtor_rows(
    state: State<'_, AppState>,
    query: repo::views::DebtQuery,
) -> AppResult<Vec<repo::views::DebtorRow>> {
    state.with_conn(|conn| repo::views::debtor_rows(conn, &query))
}

// ---------------------------------------------------------------------------
// Para fazı §1 — fiyat tarifesi
// ---------------------------------------------------------------------------

/// Canlı ve arşivlenmiş tarifeler birlikte döner: geçmiş fiyatlar ekranda kaybolmaz.
#[tauri::command]
pub fn price_rules(state: State<'_, AppState>) -> AppResult<Vec<PriceRule>> {
    state.with_conn(repo::finance::price_rules)
}

/// Fiyat değişikliği eski satırı değiştirmez; yeni geçerlilik satırı açar (ADR-006).
#[tauri::command]
pub fn save_price_rule(state: State<'_, AppState>, input: PriceRuleInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::finance::save_price_rule(conn, &input))
}

#[tauri::command]
pub fn archive_price_rule(state: State<'_, AppState>, price_rule_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::archive::<PriceRule>(conn, price_rule_id))
}

// ---------------------------------------------------------------------------
// Para fazı §2 — paket satışı ve kapatma
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn sell_package(state: State<'_, AppState>, input: PackageSaleInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::finance::sell_package(conn, &input))
}

#[tauri::command]
pub fn student_packages(
    state: State<'_, AppState>,
    student_id: i64,
) -> AppResult<Vec<PackageOverview>> {
    state.with_conn(|conn| repo::finance::package_overviews(conn, student_id))
}

#[tauri::command]
pub fn close_package(
    state: State<'_, AppState>,
    package_id: i64,
    closed_on: Option<String>,
    mode: PackageCloseMode,
) -> AppResult<PackageCloseReport> {
    let day = closed_on.unwrap_or_else(clock::today_local_string);
    state.with_conn(|conn| repo::finance::close_package(conn, package_id, &day, mode))
}

// ---------------------------------------------------------------------------
// Para fazı §5 — tahsilat
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn reserve_receipt_no(state: State<'_, AppState>) -> AppResult<String> {
    state.with_conn(repo::finance::reserve_receipt_no)
}

#[tauri::command]
pub fn open_installments(
    state: State<'_, AppState>,
    student_id: i64,
) -> AppResult<Vec<InstallmentOpen>> {
    state.with_conn(|conn| repo::views::open_installments(conn, student_id))
}

#[tauri::command]
pub fn suggest_payment_allocations(
    state: State<'_, AppState>,
    student_id: i64,
    amount: i64,
) -> AppResult<Vec<PaymentAllocationInput>> {
    state.with_conn(|conn| repo::finance::suggest_payment_allocations(conn, student_id, amount))
}

#[tauri::command]
pub fn record_payment(state: State<'_, AppState>, input: PaymentInput) -> AppResult<PaymentReport> {
    state.with_conn(|conn| repo::finance::record_payment(conn, &input))
}

#[tauri::command]
pub fn cancel_payment(
    state: State<'_, AppState>,
    payment_id: i64,
    cancelled_on: Option<String>,
) -> AppResult<i64> {
    let day = cancelled_on.unwrap_or_else(clock::today_local_string);
    state.with_conn(|conn| repo::finance::cancel_payment(conn, payment_id, &day))
}

#[tauri::command]
pub fn statement_rows(
    state: State<'_, AppState>,
    query: repo::finance::StatementQuery,
) -> AppResult<Vec<repo::finance::StatementRow>> {
    state.with_conn(|conn| repo::finance::statement_rows(conn, &query))
}

#[tauri::command]
pub fn export_statement_csv(
    state: State<'_, AppState>,
    query: repo::finance::StatementQuery,
) -> AppResult<String> {
    let rows = state.with_conn(|conn| repo::finance::statement_rows(conn, &query))?;
    let parent = state.db_path.parent().ok_or_else(|| {
        crate::error::AppError::new(
            "export_path",
            "Dışa aktarma klasörü bulunamadı. Programı kapatıp yeniden açın.",
        )
    })?;
    let export_dir = parent.join("exports");
    std::fs::create_dir_all(&export_dir).map_err(|err| {
        eprintln!("[kurs] dışa aktarma klasörü oluşturulamadı: {err}");
        crate::error::AppError::new(
            "export_directory",
            "Dışa aktarma klasörü oluşturulamadı. Disk alanını ve klasör izinlerini kontrol edin.",
        )
    })?;
    let stamp = clock::now_local().replace(['-', ':', ' '], "");
    let stem = format!("cari-ekstre-{}-{stamp}", query.student_id);
    let mut path = export_dir.join(format!("{stem}.csv"));
    let mut suffix = 2_i64;
    while path.exists() {
        path = export_dir.join(format!("{stem}-{suffix}.csv"));
        suffix = suffix.checked_add(1).ok_or_else(|| {
            crate::error::AppError::new(
                "export_name",
                "Dışa aktarma dosyası adlandırılamadı. Eski dışa aktarımları başka klasöre taşıyın.",
            )
        })?;
    }
    std::fs::write(&path, repo::finance::statement_csv(&rows)).map_err(|err| {
        eprintln!("[kurs] cari ekstre CSV yazılamadı: {err}");
        crate::error::AppError::new(
            "export_write",
            "Cari ekstre kaydedilemedi. Disk alanını ve klasör izinlerini kontrol edin.",
        )
    })?;
    Ok(path.display().to_string())
}

/// Tahsilatın yazdırılabilir, gömülü Türkçe fontlu PDF makbuzunu uygulama veri
/// klasörünün `receipts` altına yazar. Yol `Path::join` ile kurulur (Windows).
#[tauri::command]
pub fn generate_receipt_pdf(state: State<'_, AppState>, payment_id: i64) -> AppResult<String> {
    let data = state.with_conn(|conn| repo::finance::receipt_data(conn, payment_id))?;
    let bytes = crate::receipt::build_pdf(&data, crate::brand::institution())?;
    let parent = state.db_path.parent().ok_or_else(|| {
        crate::error::AppError::new(
            "receipt_path",
            "Makbuz klasörü bulunamadı. Programı kapatıp yeniden açın.",
        )
    })?;
    let receipt_dir = parent.join("receipts");
    std::fs::create_dir_all(&receipt_dir).map_err(|err| {
        eprintln!("[kurs] makbuz klasörü oluşturulamadı: {err}");
        crate::error::AppError::new(
            "receipt_directory",
            "Makbuz klasörü oluşturulamadı. Disk alanını ve klasör izinlerini kontrol edin.",
        )
    })?;
    let receipt_part: String = data
        .receipt_no
        .chars()
        .map(|ch| {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let stamp = clock::now_local().replace(['-', ':', ' '], "");
    let stem = format!("makbuz-{}-{}-{stamp}", data.payment_id, receipt_part);
    let mut path = receipt_dir.join(format!("{stem}.pdf"));
    let mut suffix = 2_i64;
    while path.exists() {
        path = receipt_dir.join(format!("{stem}-{suffix}.pdf"));
        suffix = suffix.checked_add(1).ok_or_else(|| {
            crate::error::AppError::new(
                "receipt_name",
                "Makbuz dosyası adlandırılamadı. Eski makbuzları başka klasöre taşıyın.",
            )
        })?;
    }
    std::fs::write(&path, bytes).map_err(|err| {
        eprintln!("[kurs] makbuz PDF'i yazılamadı: {err}");
        crate::error::AppError::new(
            "receipt_write",
            "Makbuz kaydedilemedi. Disk alanını ve klasör izinlerini kontrol edin.",
        )
    })?;
    Ok(path.display().to_string())
}

// ---------------------------------------------------------------------------
// Faz 4 — öğrenci ve veli
// ---------------------------------------------------------------------------

/// Öğrenciler ekranının tablosu. **Sırasız** döner (ADR-020): Türkçe sıralama ve
/// sayfalama `src/lib/sortTr.ts` + `usePagedRows` içinde, arayüz tarafında.
///
/// Arşivlenmiş öğrenciler de gelir, `archived` alanıyla işaretli — hangi çipin kimi
/// göstereceğine ekran karar veriyor (§1.23).
#[tauri::command]
pub fn student_list(state: State<'_, AppState>, query: StudentQuery) -> AppResult<Vec<StudentRow>> {
    state.with_conn(|conn| repo::roster::student_rows(conn, &query))
}

/// Öğrenci detayının tamamı tek çağrıda — dört ayrı komut dört ayrı yükleniyor/hata
/// durumu demekti ve ekranın hepsine aynı anda ihtiyacı var.
#[tauri::command]
pub fn student_detail(
    state: State<'_, AppState>,
    student_id: i64,
    today: Option<String>,
) -> AppResult<StudentDetail> {
    state.with_conn(|conn| repo::roster::student_detail(conn, student_id, today.clone()))
}

/// Öğrenci + velileri, tek transaction. `input.id` doluysa güncelleme.
#[tauri::command]
pub fn save_student(state: State<'_, AppState>, input: StudentInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::roster::save_student(conn, &input))
}

/// "Sil" değil **"Arşivle"** (ADR-005). Geçmiş kayıtlar bozulmaz.
#[tauri::command]
pub fn archive_student(state: State<'_, AppState>, student_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::archive_student(conn, student_id))
}

/// Arşivden geri alma — onay diyaloğunun ardından gelen "Geri al".
#[tauri::command]
pub fn restore_student(state: State<'_, AppState>, student_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::restore_student(conn, student_id))
}

/// Aktif / Pasif. Arşivleme DEĞİL — pasif öğrenci listede görünmeye devam eder (§1.5).
#[tauri::command]
pub fn set_student_active(
    state: State<'_, AppState>,
    student_id: i64,
    is_active: bool,
) -> AppResult<()> {
    state.with_conn(|conn| repo::roster::set_student_active(conn, student_id, is_active))
}

/// "Mevcut veliyi bul ve bağla" akışı — kardeşler aynı veliyi paylaşır (§1.7).
#[tauri::command]
pub fn search_guardians(state: State<'_, AppState>, query: String) -> AppResult<Vec<Guardian>> {
    state.with_conn(|conn| repo::roster::search_guardians(conn, &query))
}

/// Not ekler. `notedOn` verilmezse yerel bugün — SQLite saati okunmaz (§0).
#[tauri::command]
pub fn add_student_note(
    state: State<'_, AppState>,
    student_id: i64,
    body: String,
    noted_on: Option<String>,
) -> AppResult<i64> {
    state.with_conn(|conn| repo::roster::add_note(conn, student_id, &body, noted_on.clone()))
}

#[tauri::command]
pub fn archive_student_note(state: State<'_, AppState>, note_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::roster::archive_note(conn, note_id))
}

/// Branş filtresinin kaynağı. Sırasız (ADR-020).
#[tauri::command]
pub fn list_subjects(state: State<'_, AppState>) -> AppResult<Vec<Subject>> {
    state.with_conn(repo::list_live::<Subject>)
}

/// Grup filtresinin kaynağı. Sırasız (ADR-020).
#[tauri::command]
pub fn list_study_groups(state: State<'_, AppState>) -> AppResult<Vec<StudyGroup>> {
    state.with_conn(repo::list_live::<StudyGroup>)
}

// ---------------------------------------------------------------------------
// Faz 5A — tanımlar: branş ve kapalı gün
// ---------------------------------------------------------------------------

/// Branş kaydeder. Tekillik `search_name` üzerinde ve repository üretiyor (K9):
/// `Matematik` ile `matematik` aynı branştır.
#[tauri::command]
pub fn save_subject(state: State<'_, AppState>, input: SubjectInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::schedule::save_subject(conn, &input))
}

#[tauri::command]
pub fn archive_subject(state: State<'_, AppState>, subject_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::archive::<Subject>(conn, subject_id))
}

#[tauri::command]
pub fn restore_subject(state: State<'_, AppState>, subject_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::restore::<Subject>(conn, subject_id))
}

/// Sırasız (ADR-020) — tarih kolonuna göre sıralama arayüzde yapılır.
#[tauri::command]
pub fn list_closed_days(state: State<'_, AppState>) -> AppResult<Vec<ClosedDay>> {
    state.with_conn(repo::list_live::<ClosedDay>)
}

#[tauri::command]
pub fn save_closed_day(state: State<'_, AppState>, input: ClosedDayInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::schedule::save_closed_day(conn, &input))
}

/// Tatil kaldırılınca o günün seansları **kendiliğinden geri gelmez**: üretim yalnızca
/// eksik slotu yazar, kullanıcı takvimi yenilediğinde (ya da bir sonraki açılışta) dolar.
#[tauri::command]
pub fn archive_closed_day(state: State<'_, AppState>, closed_day_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::archive::<ClosedDay>(conn, closed_day_id))
}

/// Haftalık kapalı günler — `1,7` gibi (1 = Pazartesi … 7 = Pazar).
#[tauri::command]
pub fn weekly_closed_days(state: State<'_, AppState>) -> AppResult<Vec<i64>> {
    state.with_conn(|conn| {
        let mut days: Vec<i64> = repo::schedule::weekly_closed_days(conn)?
            .into_iter()
            .collect();
        days.sort_unstable();
        Ok(days)
    })
}

#[tauri::command]
pub fn set_weekly_closed_days(state: State<'_, AppState>, days: Vec<i64>) -> AppResult<()> {
    state.with_conn(|conn| {
        repo::setting::update_existing(
            conn,
            "weekly_closed_days",
            &repo::schedule::format_weekdays(&days),
        )
    })
}

/// Branşın varsayılan ders süresi; yoksa genel ayar, o da yoksa 60 (PRD S4).
#[tauri::command]
pub fn default_session_minutes(
    state: State<'_, AppState>,
    subject_id: Option<i64>,
) -> AppResult<i64> {
    state.with_conn(|conn| repo::schedule::default_minutes(conn, subject_id))
}

/// Öğretmen listesi — **pasifler dahil** (ADR-037). `is_active = 0` "artık ders
/// vermiyor" demek; arşiv değil. Tanımlar ekranı hepsini gösterir, seçim kutuları
/// pasifleri süzer. Sonuç **sırasızdır** (ADR-020).
#[tauri::command]
pub fn list_teachers(state: State<'_, AppState>) -> AppResult<Vec<Teacher>> {
    state.with_conn(repo::list_live::<Teacher>)
}

#[tauri::command]
pub fn save_teacher(state: State<'_, AppState>, input: TeacherInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::people::save_teacher(conn, &input))
}

/// Soft delete — kullanıcıya "Arşivle" denir (ADR-005). Geçmiş dersler ve gruplar
/// `teacher_id`'yi tutmaya devam eder; yalnızca listelerden kalkar.
#[tauri::command]
pub fn archive_teacher(state: State<'_, AppState>, teacher_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::archive::<Teacher>(conn, teacher_id))
}

#[tauri::command]
pub fn restore_teacher(state: State<'_, AppState>, teacher_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::restore::<Teacher>(conn, teacher_id))
}

/// `Tanımlar → Genel` — işletme ayarlarını yazan tek kapı (ADR-037, E18).
///
/// **Anahtar beyaz listeden geçer.** `repo::setting::update_existing` zaten var olmayan
/// anahtarı reddediyor, ama o kontrol tabloda ne varsa hepsine izin verir; oysa üç satır
/// kullanıcının değil programın: `institution_name` okunmuyor (ADR-024),
/// `receipt_next_no` makbuz sayacı, `last_backup_at` yedekleme kaydı. Ekrana çıkmayan
/// bir anahtarı yazan komut bulunmasın diye liste burada.
#[tauri::command]
pub fn update_setting(state: State<'_, AppState>, key: String, value: String) -> AppResult<()> {
    if !repo::setting::EDITABLE_KEYS.contains(&key.as_str()) {
        return Err(crate::error::AppError::new(
            "setting.key",
            "Bu ayar bu ekrandan değiştirilemez.",
        ));
    }
    state.with_conn(|conn| repo::setting::update_existing(conn, &key, &value))
}

// ---------------------------------------------------------------------------
// Faz 5A — gruplar
// ---------------------------------------------------------------------------

/// Gruplar ekranının tablosu. **Sırasız** döner (ADR-020): Türkçe sıralama ve sayfalama
/// arayüzde. Arşivlenmiş gruplar da gelir, `archived` alanıyla işaretli.
#[tauri::command]
pub fn group_list(state: State<'_, AppState>, query: GroupQuery) -> AppResult<Vec<GroupRow>> {
    state.with_conn(|conn| repo::schedule::group_rows(conn, &query))
}

/// Grup detayının tamamı tek çağrıda — `student_detail` ile aynı gerekçe.
#[tauri::command]
pub fn group_detail(
    state: State<'_, AppState>,
    group_id: i64,
    today: Option<String>,
) -> AppResult<GroupDetail> {
    state.with_conn(|conn| repo::schedule::group_detail(conn, group_id, today.clone()))
}

/// Grup + haftalık program, tek transaction; ardından seanslar üretilir (R5.5).
/// "Bugün" burada bind ediliyor — SQLite saati OKUNMAZ (§0).
#[tauri::command]
pub fn save_group(state: State<'_, AppState>, input: GroupInput) -> AppResult<i64> {
    state.with_conn(|conn| repo::schedule::save_group(conn, &input, clock::today_local()))
}

#[tauri::command]
pub fn archive_group(state: State<'_, AppState>, group_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::archive::<StudyGroup>(conn, group_id))
}

#[tauri::command]
pub fn restore_group(state: State<'_, AppState>, group_id: i64) -> AppResult<bool> {
    state.with_conn(|conn| repo::restore::<StudyGroup>(conn, group_id))
}

/// Doluluk — kapasite aşımı onay diyaloğunun sayıları (PRD S2 / K-8).
#[tauri::command]
pub fn group_capacity(
    state: State<'_, AppState>,
    group_id: i64,
    today: Option<String>,
) -> AppResult<Capacity> {
    state.with_conn(|conn| {
        let day = today.clone().unwrap_or_else(clock::today_local_string);
        repo::schedule::group_capacity(conn, group_id, &day)
    })
}

/// Gruba öğrenci ekler. **Kapasite burada kontrol edilmez** — aşımı arayüz onaylatır
/// (S2). Çakışan açık kayıt ise engellenir (K-22).
#[tauri::command]
pub fn add_group_member(
    state: State<'_, AppState>,
    group_id: i64,
    student_id: i64,
    start_on: Option<String>,
) -> AppResult<i64> {
    state.with_conn(|conn| {
        let day = start_on.clone().unwrap_or_else(clock::today_local_string);
        repo::schedule::add_group_member(conn, group_id, student_id, &day)
    })
}

/// Gruptan çıkarma — kayıt silinmez, bitiş tarihi yazılır (R5.8).
#[tauri::command]
pub fn end_group_membership(
    state: State<'_, AppState>,
    enrollment_id: i64,
    end_on: Option<String>,
) -> AppResult<()> {
    state.with_conn(|conn| {
        let day = end_on.clone().unwrap_or_else(clock::today_local_string);
        repo::schedule::end_group_membership(conn, enrollment_id, &day)
    })
}

// ---------------------------------------------------------------------------
// Faz 5A — seans işlemleri
// ---------------------------------------------------------------------------

/// **Aynı öğretmenin** çakışan dersleri. **Uyarı içindir, engelleme değil**
/// (K-1 / R3.11): kurs sahibi bilerek üst üste ders koyuyor olabilir. Boş liste
/// "çakışma yok"; `teacher_id` verilmezse de boş döner (ADR-037).
#[tauri::command]
pub fn session_conflicts(
    state: State<'_, AppState>,
    starts_at: String,
    ends_at: String,
    ignore_session_id: Option<i64>,
    teacher_id: Option<i64>,
) -> AppResult<Vec<Conflict>> {
    state.with_conn(|conn| {
        repo::schedule::detect_conflicts(conn, &starts_at, &ends_at, ignore_session_id, teacher_id)
    })
}

#[tauri::command]
pub fn cancel_session(
    state: State<'_, AppState>,
    session_id: i64,
    reason: Option<String>,
) -> AppResult<()> {
    state.with_conn(|conn| repo::schedule::cancel_session(conn, session_id, reason.as_deref()))
}

/// Kapsam **çağırandan** gelir ve varsayılanı en dar olan (`only`) — kullanıcıya net
/// sorulur, program onun yerine karar vermez.
#[tauri::command]
pub fn delete_sessions(
    state: State<'_, AppState>,
    session_id: i64,
    scope: SessionScope,
) -> AppResult<DeleteReport> {
    state.with_conn(|conn| repo::schedule::delete_sessions(conn, session_id, scope))
}

/// Ders taşır. Kapsam **çağırandan** gelir ve varsayılanı en dar olan (`only`);
/// "bu ve sonraki dersler" (R3.8) şablonu bu tarihten itibaren yeni gün/saate geçirir.
/// "Bugün" burada bind ediliyor (§0) — yeni şablonun seansları üretilecek.
#[tauri::command]
pub fn reschedule_session(
    state: State<'_, AppState>,
    session_id: i64,
    starts_at: String,
    duration_min: i64,
    scope: Option<RescheduleScope>,
) -> AppResult<RescheduleReport> {
    let today = clock::today_local();
    state.with_conn(|conn| {
        repo::schedule::reschedule_sessions(
            conn,
            session_id,
            &starts_at,
            duration_min,
            scope.unwrap_or_default(),
            today,
        )
    })
}

// ---------------------------------------------------------------------------
// Faz 5B — Bugün ekranı, ders ekle/düzenle, şablondan oluştur
// ---------------------------------------------------------------------------

/// **"Şimdi"nin tek kaynağı** (`VERI-MODELI §0`): `chrono::Local`, SQLite saati değil.
///
/// Arayüz `new Date()` de kurabilirdi ama o zaman "bugün" iki ayrı yerden gelirdi ve
/// gece yarısını geçen bir oturumda Bugün ekranının başlığı ile listesi farklı günü
/// gösterirdi. Tek yer, tek cevap: `'YYYY-MM-DD HH:MM'`, tarih ilk 10 karakter.
#[tauri::command]
pub fn local_now() -> String {
    clock::now_local()
}

/// Bugünün dersleri, saat sırasıyla (R1.1). Arşivlenmiş öğrencinin birebir dersi
/// listelenmez — program ekranları canlı kayıtla ilgilenir (§1.23).
#[tauri::command]
pub fn day_sessions(
    state: State<'_, AppState>,
    day: Option<String>,
) -> AppResult<Vec<DaySessionRow>> {
    state.with_conn(|conn| {
        let day = day.clone().unwrap_or_else(clock::today_local_string);
        repo::schedule::day_rows(conn, &day)
    })
}

// ---------------------------------------------------------------------------
// Faz 6 §1–§2 — yoklama paneli ve tek atomik kaydetme yolu
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn attendance_detail(
    state: State<'_, AppState>,
    session_id: i64,
    today: String,
) -> AppResult<AttendanceDetail> {
    state.with_conn(|conn| repo::attendance::attendance_detail(conn, session_id, &today))
}

#[tauri::command]
pub fn save_attendance(
    state: State<'_, AppState>,
    input: SaveAttendanceInput,
) -> AppResult<SaveAttendanceReport> {
    state.with_conn(|conn| repo::attendance::save_attendance(conn, &input))
}

/// Haftalık program tanımlı mı — Bugün ekranının iki boş durumunu ayırır (R1.7).
#[tauri::command]
pub fn has_schedule(state: State<'_, AppState>) -> AppResult<bool> {
    state.with_conn(repo::schedule::has_schedule)
}

// ---------------------------------------------------------------------------
// Faz 5C — takvim
// ---------------------------------------------------------------------------

/// Bir tarih aralığındaki dersler — takvimin hafta/ay ızgarası (5C).
///
/// `day_sessions` ile aynı projeksiyon, aynı fonksiyon: üye sayısı **satırın kendi
/// gününe** göre hesaplandığı için aralık genişlemesi sonucu bozmuyor. Takvim için
/// ikinci bir sorgu yazılmadı.
#[tauri::command]
pub fn range_sessions(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> AppResult<Vec<DaySessionRow>> {
    state.with_conn(|conn| repo::schedule::session_rows_between(conn, from.trim(), to.trim()))
}

/// Aralıktaki kapalı günler — takvimin taralı sütunları ve K-2'nin bırakma yasağı.
#[tauri::command]
pub fn closed_days(state: State<'_, AppState>, from: String, to: String) -> AppResult<Vec<String>> {
    state.with_conn(|conn| {
        repo::schedule::closed_days_in_range(conn, parse_day(&from)?, parse_day(&to)?)
    })
}

/// Bir gün programa kapalı mı: tek seferlik tatil **veya** haftalık kapalı gün.
/// Form kaydetmeden önce buna bakar (K-2) — kullanıcı hatayı kaydetme anında değil
/// tarihi seçtiğinde görür.
#[tauri::command]
pub fn is_closed_day(state: State<'_, AppState>, day: String) -> AppResult<bool> {
    state.with_conn(|conn| repo::schedule::is_closed_day(conn, parse_day(&day)?))
}

/// Ders kaydeder: tek seferlik ya da haftalık. Tatile ders eklenmez (K-2); çakışma
/// ENGELLEMEZ, arayüz uyarır (K-1). "Bugün" burada bind ediliyor (§0).
#[tauri::command]
pub fn save_session(
    state: State<'_, AppState>,
    input: SessionInput,
) -> AppResult<SaveSessionReport> {
    state.with_conn(|conn| repo::schedule::save_session(conn, &input, clock::today_local()))
}

/// Şablondan oluştur — **önizleme**. Yazmaz; onay bu listeden sonra istenir (E6).
#[tauri::command]
pub fn template_preview(
    state: State<'_, AppState>,
    source_day: String,
    apply_from: String,
) -> AppResult<TemplatePreview> {
    state.with_conn(|conn| {
        let source = parse_day(&source_day)?;
        let from = parse_day(&apply_from)?;
        repo::schedule::template_preview(conn, source, from)
    })
}

/// Önizlenen haftayı haftalık şablona çevirir ve seansları üretir.
#[tauri::command]
pub fn apply_template(
    state: State<'_, AppState>,
    source_day: String,
    apply_from: String,
) -> AppResult<ApplyTemplateReport> {
    state.with_conn(|conn| {
        let source = parse_day(&source_day)?;
        let from = parse_day(&apply_from)?;
        repo::schedule::apply_template(conn, source, from, clock::today_local())
    })
}

fn parse_day(raw: &str) -> AppResult<chrono::NaiveDate> {
    chrono::NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d").map_err(|_| {
        crate::error::AppError::new(
            "invalid_date",
            "Tarih okunamadı. Tarihi gün.ay.yıl biçiminde seçin.",
        )
    })
}

fn teacher_name(conn: &rusqlite::Connection) -> AppResult<String> {
    Ok(conn
        .query_row(
            "SELECT full_name FROM teacher WHERE deleted_at IS NULL ORDER BY id LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "—".to_string()))
}
