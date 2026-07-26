//! faz-02 §5 — temel CRUD, soft delete ve bakiye.

mod common;

use common::*;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;

#[test]
fn insert_ve_geri_okuma() {
    let conn = conn();
    let id = student(&conn, "Elif Yılmaz");

    let read: Student = repo::require(&conn, id).expect("kayıt okunmalı");
    assert_eq!(read.id, Some(id));
    assert_eq!(read.full_name, "Elif Yılmaz");
    // Denetim sütunları şemadaki DEFAULT ile dolmuş olmalı.
    assert!(read.created_at.is_some(), "created_at DEFAULT ile dolmalı");
    assert!(read.updated_at.is_some());
    assert!(read.deleted_at.is_none(), "yeni kayıt canlı");
}

#[test]
fn search_name_ve_phone_digits_repo_tarafinda_uretilir() {
    let conn = conn();
    // Çağıran boş bırakıyor; K9 invaryantı repository'de korunuyor.
    let id = student(&conn, "IŞIL Korkmaz");

    let read: Student = repo::require(&conn, id).unwrap();
    // 'I' → 'ı' (ASCII davranışı 'i' olurdu), 'Ş' → 'ş'.
    assert_eq!(read.search_name, "ışıl korkmaz");
    assert_eq!(read.phone_digits.as_deref(), Some("05321112233"));
}

#[test]
fn turkce_arama_i_harfini_dogru_bulur() {
    let conn = conn();
    student(&conn, "İrem Aydın");
    student(&conn, "Işıl Korkmaz");

    // ASCII lower() ile 'İngilizce' bulunamaz, 'Ilgaz' bulunurdu — K9'un varlık sebebi.
    let irem = repo::people::search_students(&conn, "irem").unwrap();
    assert_eq!(irem.len(), 1, "küçük harfle 'İrem' bulunmalı");
    assert_eq!(irem[0].full_name, "İrem Aydın");

    let isil = repo::people::search_students(&conn, "ışıl").unwrap();
    assert_eq!(isil.len(), 1, "'Işıl' noktasız ı ile bulunmalı");
    assert_eq!(isil[0].full_name, "Işıl Korkmaz");
}

#[test]
fn veli_telefonuyla_ogrenci_aranir() {
    let conn = conn();
    let student_id = student(&conn, "Elif Yılmaz");
    let guardian_id = repo::people::insert_guardian(
        &conn,
        &Guardian {
            id: None,
            full_name: "Hatice Yılmaz".into(),
            phone: Some("0505 987 65 43".into()),
            phone_digits: None,
            email: None,
            last_reminded_at: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    repo::people::insert_student_guardian(
        &conn,
        &StudentGuardian {
            id: None,
            student_id,
            guardian_id,
            relation: Some("Anne".into()),
            is_primary: true,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    // Tasarımın arama kutusu: "Öğrenci adı veya veli telefonu ara".
    let found = repo::people::search_students(&conn, "9876543").unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].id, Some(student_id));
}

#[test]
fn arsivlenen_kayit_canli_listede_gorunmez_arsivde_gorunur() {
    let conn = conn();
    let id = student(&conn, "Selin Aksoy");

    assert_eq!(repo::list_live::<Student>(&conn).unwrap().len(), 1);
    assert_eq!(repo::list_archived::<Student>(&conn).unwrap().len(), 0);

    assert!(repo::archive::<Student>(&conn, id).unwrap());

    let live = repo::list_live::<Student>(&conn).unwrap();
    assert!(live.is_empty(), "arşivlenen öğrenci canlı listede olmamalı");

    let archived = repo::list_archived::<Student>(&conn).unwrap();
    assert_eq!(archived.len(), 1, "arşiv görünümünde olmalı");
    assert!(archived[0].deleted_at.is_some());

    // Hard delete yok: kayıt hâlâ id ile okunabilir (ADR-005).
    let read: Student = repo::require(&conn, id).unwrap();
    assert_eq!(read.full_name, "Selin Aksoy");

    // Geri alınabilir — kullanıcıya "Arşivden çıkar".
    assert!(repo::restore::<Student>(&conn, id).unwrap());
    assert_eq!(repo::list_live::<Student>(&conn).unwrap().len(), 1);
}

#[test]
fn ikinci_arsivleme_bir_sey_yapmaz() {
    let conn = conn();
    let id = student(&conn, "Selin Aksoy");
    assert!(repo::archive::<Student>(&conn, id).unwrap());
    assert!(
        !repo::archive::<Student>(&conn, id).unwrap(),
        "ikinci çağrı false dönmeli"
    );
}

#[test]
fn bakiye_defter_toplamindan_hesaplanir() {
    let conn = conn();
    let id = student(&conn, "Mehmet Aslan");

    // Boş defter = 0 (satır yoksa da bakiye satırı dönmeli).
    let empty = repo::views::student_balance(&conn, id).unwrap().unwrap();
    assert_eq!(empty.balance_kurus, 0);
    assert!(empty.is_live);

    ledger(&conn, id, "2026-03-02", "session_charge", -25000);
    ledger(&conn, id, "2026-03-09", "session_charge", -25000);
    ledger(&conn, id, "2026-03-15", "payment", 30000);

    let balance = repo::views::student_balance(&conn, id).unwrap().unwrap();
    // −250 −250 +300 = −200 ₺ → NEGATİF = BORÇLU (K3)
    assert_eq!(balance.balance_kurus, -20000);
}

#[test]
fn arsivlenen_ogrencinin_bakiyesi_kaybolmaz() {
    let conn = conn();
    let id = student(&conn, "Selin Aksoy");
    ledger(&conn, id, "2026-03-02", "session_charge", -60000);
    repo::archive::<Student>(&conn, id).unwrap();

    // §1.23: borç arşivlemekle yok olmaz; view filtre uygulamaz, is_live bayrağı döner.
    let balance = repo::views::student_balance(&conn, id).unwrap().unwrap();
    assert_eq!(balance.balance_kurus, -60000);
    assert!(!balance.is_live, "arşivli öğrenci is_live = 0 ile dönmeli");

    // Toplam alacak da onu düşürmemeli — önceki sürümün hatası buydu.
    assert_eq!(repo::views::total_receivable(&conn).unwrap(), 60000);
}

#[test]
fn cakisan_kayit_araligi_reddedilir() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let student_id = student(&conn, "Elif Yılmaz");

    enrollment(&conn, student_id, None, subject_id, "2026-01-01", None).expect("ilk kayıt geçmeli");

    // §1.9 — aynı öğrenci + aynı branş için çakışan ikinci canlı kayıt yasak.
    let err = enrollment(&conn, student_id, None, subject_id, "2026-03-01", None).unwrap_err();
    assert_eq!(err.code, "enrollment_overlap");
    assert!(err.message.contains("zaten açık bir kaydı var"));
}

#[test]
fn cakismayan_araliklarla_gruba_geri_donulebilir() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let group_id = group(&conn, "Grup A", subject_id);
    let student_id = student(&conn, "Elif Yılmaz");

    // Şubat–Mayıs arası kayıtlı, ayrıldı; Eylül'de geri döndü (§5 Senaryo 3).
    enrollment(
        &conn,
        student_id,
        Some(group_id),
        subject_id,
        "2026-02-01",
        Some("2026-05-20"),
    )
    .expect("ilk dönem");
    enrollment(
        &conn,
        student_id,
        Some(group_id),
        subject_id,
        "2026-09-01",
        None,
    )
    .expect("çakışmayan ikinci kayıt geçmeli");

    assert_eq!(
        repo::academic::enrollments_of(&conn, student_id)
            .unwrap()
            .len(),
        2
    );
}

/// Migration'ın başlangıç verisini yazdığını doğrular — `setting` tablosu kurs sahibinin
/// makinesinde seed olmadan da dolu gelmek zorunda.
#[test]
fn ayarlar_baslangic_verisinden_okunur() {
    let conn = conn();
    // ⚠️ `institution_name` artık OKUNMUYOR (ADR-024): kurum adı derleme anında
    // `config/kurum.json`'dan geliyor (`brand::institution_name`). Satır `001_initial.sql`
    // mühürlü olduğu için yerinde duruyor; bu iddia da onun için silinmedi — migration'ın
    // başlangıç verisini yazdığını hâlâ kanıtlıyor. Uygulama kodunda bu anahtarı
    // sorgulayan hiçbir yer YOK.
    assert_eq!(
        repo::setting::value(&conn, "institution_name")
            .unwrap()
            .as_deref(),
        Some("Aydın Özel Ders")
    );
    assert_eq!(
        repo::setting::value_i64(&conn, "session_horizon_weeks").unwrap(),
        Some(16)
    );
    // ADR-016: mazeretli hak düşürmez, mazeretsiz düşürür.
    assert!(!repo::setting::value_bool(&conn, "absence_excused_consumes_lesson", true).unwrap());
    assert!(repo::setting::value_bool(&conn, "absence_unexcused_consumes_lesson", false).unwrap());
    // Boş bırakılan anahtar sayıya çevrilmez — "boşsa süresiz" anlamı korunur.
    assert_eq!(
        repo::setting::value_i64(&conn, "package_expiry_days").unwrap(),
        None
    );
}

#[test]
fn arsivlenen_ogrenci_grup_yoklama_listesinden_cikar() {
    let conn = conn();
    let subject_id = subject(&conn, "Matematik");
    let group_id = group(&conn, "Grup A", subject_id);
    let kalan = student(&conn, "Elif Yılmaz");
    let arsivlenen = student(&conn, "Selin Aksoy");

    enrollment(&conn, kalan, Some(group_id), subject_id, "2026-01-01", None).unwrap();
    enrollment(
        &conn,
        arsivlenen,
        Some(group_id),
        subject_id,
        "2026-01-01",
        None,
    )
    .unwrap();

    let once = repo::academic::group_members_on(&conn, group_id, "2026-03-05").unwrap();
    assert_eq!(once.len(), 2);

    repo::archive::<Student>(&conn, arsivlenen).unwrap();

    // §1.23: program ekranları arşivliyi saymaz. Arşivleme öğrenciyi arşivler,
    // KAYDINI değil — bu yüzden enrollment.deleted_at'e bakmak tek başına yetmez.
    let sonra = repo::academic::group_members_on(&conn, group_id, "2026-03-05").unwrap();
    assert_eq!(
        sonra,
        vec![kalan],
        "arşivlenen öğrenci yoklama listesinde kalmamalı"
    );

    // Ama borcu kaybolmamalı — muhasebe tarafı defterden okur, bu fonksiyondan değil.
    ledger(&conn, arsivlenen, "2026-03-02", "session_charge", -25000);
    assert_eq!(
        repo::views::student_balance(&conn, arsivlenen)
            .unwrap()
            .unwrap()
            .balance_kurus,
        -25000
    );
}

// ===========================================================================
// Öğretmen ve işletme ayarları — ADR-037 (`/faz-07 §0a`, `§0c`)
// ===========================================================================

#[test]
fn ogretmen_eklenir_duzenlenir_ve_arsivlenir() {
    let conn = conn();
    // Migration'ın başlangıç satırı (§1.3) burada, adı 'Öğretmen'.
    let basta = repo::list_live::<Teacher>(&conn).unwrap();
    assert_eq!(basta.len(), 1);
    assert_eq!(basta[0].full_name, "Öğretmen");

    // ADR-037'nin bütün mesele ettiği şey: kurs sahibi o adı düzeltebilmeli.
    repo::people::save_teacher(
        &conn,
        &repo::people::TeacherInput {
            id: basta[0].id,
            full_name: "Ayşe Demir".into(),
            color: "#5f8f6b".into(),
            phone: Some("0532 111 22 33".into()),
            email: None,
            is_active: true,
            sort_order: 0,
        },
    )
    .unwrap();

    let ikinci = teacher(&conn, "Veli Kaya");
    let hepsi = repo::list_live::<Teacher>(&conn).unwrap();
    assert_eq!(hepsi.len(), 2, "kurs çok öğretmenli (ADR-037)");
    assert!(hepsi.iter().any(|t| t.full_name == "Ayşe Demir"));

    repo::archive::<Teacher>(&conn, ikinci).unwrap();
    let kalan = repo::list_live::<Teacher>(&conn).unwrap();
    assert_eq!(kalan.len(), 1, "arşivlenen öğretmen canlı listeden çıkar");

    repo::restore::<Teacher>(&conn, ikinci).unwrap();
    assert_eq!(repo::list_live::<Teacher>(&conn).unwrap().len(), 2);
}

#[test]
fn pasif_ogretmen_listede_kalir() {
    let conn = conn();
    let id = teacher(&conn, "Veli Kaya");
    repo::people::save_teacher(
        &conn,
        &repo::people::TeacherInput {
            id: Some(id),
            full_name: "Veli Kaya".into(),
            color: "#5f8f6b".into(),
            phone: None,
            email: None,
            is_active: false,
            sort_order: 0,
        },
    )
    .unwrap();

    // `is_active = 0` "artık ders vermiyor" demek, arşiv değil: Tanımlar ekranı
    // onu göstermeye devam eder, yoksa kullanıcı geri açamaz.
    let live = repo::list_live::<Teacher>(&conn).unwrap();
    let veli = live
        .iter()
        .find(|t| t.id == Some(id))
        .expect("listede kalmalı");
    assert!(!veli.is_active);
}

#[test]
fn ogretmen_adi_bos_birakilamaz() {
    let conn = conn();
    let err = repo::people::save_teacher(
        &conn,
        &repo::people::TeacherInput {
            id: None,
            full_name: "   ".into(),
            color: "#5f8f6b".into(),
            phone: None,
            email: None,
            is_active: true,
            sort_order: 0,
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "teacher.fullName");
    assert_eq!(repo::list_live::<Teacher>(&conn).unwrap().len(), 1);
}

#[test]
fn ayar_yazilir_ve_geri_okunur() {
    let conn = conn();
    repo::setting::update_existing(&conn, "day_start", "09:00").unwrap();
    assert_eq!(
        repo::setting::value(&conn, "day_start").unwrap().as_deref(),
        Some("09:00")
    );
}

#[test]
fn olmayan_ayar_anahtari_reddedilir() {
    let conn = conn();
    // `set` yeni anahtar yaratırdı; `update_existing` yazım hatasını hata yapar —
    // `Tanımlar → Genel` ekranı bu yüzden onu kullanıyor.
    let err = repo::setting::update_existing(&conn, "day_startt", "09:00").unwrap_err();
    assert_eq!(err.code, "setting_not_found");
    assert!(repo::setting::value(&conn, "day_startt").unwrap().is_none());
}

#[test]
fn duzenlenebilir_ayar_listesi_programin_kendi_satirlarini_disarida_birakir() {
    // ADR-024: kurum adı `config/kurum.json`'dan geliyor, `setting`ten değil.
    // Diğer ikisini program yazar: makbuz sayacı ve son yedekleme zamanı.
    for key in ["institution_name", "receipt_next_no", "last_backup_at"] {
        assert!(
            !repo::setting::EDITABLE_KEYS.contains(&key),
            "{key} kullanıcı ekranından yazılamamalı"
        );
    }

    // Ve tabloda gerçekten var olan anahtarlar listeleniyor — yazım hatası
    // ekranın hiç çalışmamasına yol açardı.
    let conn = conn();
    for key in repo::setting::EDITABLE_KEYS {
        assert!(
            repo::setting::get(&conn, key).unwrap().is_some(),
            "{key} `001_initial.sql` başlangıç verisinde yok"
        );
    }
}
