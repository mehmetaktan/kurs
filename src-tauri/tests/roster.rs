//! Faz 4 — öğrenci listesi, arama, filtre, arşivleme ve veli ilişkisi.
//!
//! Bellek içi SQLite, **gerçek migration'lar uygulanarak** (ADR-002).
//! `today` her yerde sabit (`common::TODAY`) — §0 `'now'` kuralı: hiçbir test SQLite
//! saatini okumaz, yoksa CI makinesinin saat dilimine bağlı olurdu.

mod common;

use common::TODAY;
use kurs_takip_lib::model::*;
use kurs_takip_lib::repo;
use kurs_takip_lib::repo::roster::{GuardianInput, StudentInput, StudentQuery};
use rusqlite::Connection;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

fn query() -> StudentQuery {
    StudentQuery {
        today: Some(TODAY.into()),
        ..StudentQuery::default()
    }
}

fn rows(conn: &Connection, q: &StudentQuery) -> Vec<kurs_takip_lib::repo::roster::StudentRow> {
    repo::roster::student_rows(conn, q).expect("liste okunmalı")
}

fn names(rows: &[kurs_takip_lib::repo::roster::StudentRow]) -> Vec<&str> {
    rows.iter().map(|r| r.full_name.as_str()).collect()
}

/// Adı ve tek velisi olan bir öğrenci — formun gerçekten kullandığı yol.
fn save(conn: &Connection, name: &str, guardian: Option<(&str, &str)>) -> i64 {
    let guardians: Vec<(&str, &str)> = guardian.into_iter().collect();
    save_with_guardians(conn, name, &guardians)
}

/// Adı ve **birden çok** velisi olan öğrenci. İlk veli birincil (ekranda görünen o),
/// kalanlar yalnızca aramanın kapsamında — gerçek hayatta anne birincil, baba ikinci.
fn save_with_guardians(conn: &Connection, name: &str, guardians: &[(&str, &str)]) -> i64 {
    let guardians: Vec<GuardianInput> = guardians
        .iter()
        .enumerate()
        .map(|(index, (g_name, phone))| GuardianInput {
            guardian_id: None,
            full_name: (*g_name).into(),
            phone: (*phone).into(),
            email: None,
            relation: Some(if index == 0 { "Anne" } else { "Baba" }.into()),
            is_primary: index == 0,
        })
        .collect();

    repo::roster::save_student(
        conn,
        &StudentInput {
            id: None,
            full_name: name.into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: Some("0532 111 22 33".into()),
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians,
        },
    )
    .expect("öğrenci kaydedilmeli")
}

// ---------------------------------------------------------------------------
// Arama — Türkçe karakterler dahil (K9)
// ---------------------------------------------------------------------------

/// Asıl mesele `I/ı` çifti: SQLite'ın `lower()`'ı `'İ'`yi küçültmüyor, `'I'`yi de
/// `'i'` yapıyor. Normalleştirme `text::search_name` ile tek yerde yapılıyor.
#[test]
fn arama_noktali_ve_noktasiz_i_ayirir() {
    let conn = common::conn();
    save(&conn, "İrem Aydın", None);
    save(&conn, "Işıl Korkmaz", None);
    save(&conn, "Ilgaz Demir", None);

    // Noktalı i ile aranan, noktalı i'liyi bulur — küçük harfle yazılmış olsa bile.
    let found = rows(
        &conn,
        &StudentQuery {
            search: "irem".into(),
            ..query()
        },
    );
    assert_eq!(names(&found), vec!["İrem Aydın"]);

    // ASCII `I` ile yazılmış ad, NOKTASIZ ı ile bulunur. SQLite'ın `lower()`'ı burada
    // `'i'` üretirdi ve `Ilgaz` `ilgaz` aramasına düşerdi — Türkçe'de yanlış.
    let found = rows(
        &conn,
        &StudentQuery {
            search: "ılgaz".into(),
            ..query()
        },
    );
    assert_eq!(names(&found), vec!["Ilgaz Demir"]);

    // Ayrımın kendisi: noktalı i ile aranınca `Ilgaz` ÇIKMAZ.
    let found = rows(
        &conn,
        &StudentQuery {
            search: "ilgaz".into(),
            ..query()
        },
    );
    assert!(found.is_empty(), "noktalı i, noktasız ı'yı bulmamalı");

    // Aynı ayrım ters yönde: `İrem` noktasız ı ile aranınca çıkmaz.
    let found = rows(
        &conn,
        &StudentQuery {
            search: "ırem".into(),
            ..query()
        },
    );
    assert!(found.is_empty());

    // Türkçe'ye özgü diğer harfler de eşleşiyor.
    let found = rows(
        &conn,
        &StudentQuery {
            search: "IŞIL".into(),
            ..query()
        },
    );
    assert_eq!(names(&found), vec!["Işıl Korkmaz"]);
}

#[test]
fn arama_buyuk_kucuk_harf_ve_bosluk_farkini_yutar() {
    let conn = common::conn();
    save(&conn, "Ayşe  Demir", None);

    for needle in ["AYŞE", "ayşe demir", "  Demir  ", "şe De"] {
        let found = rows(
            &conn,
            &StudentQuery {
                search: needle.into(),
                ..query()
            },
        );
        assert_eq!(found.len(), 1, "\"{needle}\" öğrenciyi bulmalı");
    }
}

/// Tasarımın arama kutusu "Öğrenci adı **veya veli telefonu** ara" diyor; Faz 4 ayrıca
/// veli **adını** istiyor. Veli aradığında kurs sahibi çocuğun değil velinin adını
/// hatırlıyor olabilir.
#[test]
fn arama_veli_adini_ve_telefonunu_da_kapsar() {
    let conn = common::conn();
    save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );
    save(
        &conn,
        "Mehmet Aslan",
        Some(("Sevgi Aslan", "0505 337 41 62")),
    );

    let by_guardian = rows(
        &conn,
        &StudentQuery {
            search: "Hatice".into(),
            ..query()
        },
    );
    assert_eq!(names(&by_guardian), vec!["Elif Yılmaz"]);

    // Telefon rakam rakam eşleşir: boşluklu yazım da bulmalı.
    let by_phone = rows(
        &conn,
        &StudentQuery {
            search: "0505 337".into(),
            ..query()
        },
    );
    assert_eq!(names(&by_phone), vec!["Mehmet Aslan"]);

    let by_phone_bare = rows(
        &conn,
        &StudentQuery {
            search: "3374162".into(),
            ..query()
        },
    );
    assert_eq!(names(&by_phone_bare), vec!["Mehmet Aslan"]);
}

/// Faz 4 denetiminin 1. bulgusu. Arama yalnızca **birincil** veliye bakıyordu ve bu
/// testin kendisi de aynı kör noktayı taşıyordu: bütün öğrenciler tek veliliydi.
///
/// Somut arıza: annesi birincil kayıtlı öğrenciyi babası arıyor, kurs sahibi babanın
/// numarasını yazıyor, ekran "sonuç yok" diyor ve **ikinci bir öğrenci kaydı** açılıyor.
#[test]
fn arama_ikinci_veliyi_de_bulur() {
    let conn = common::conn();
    save_with_guardians(
        &conn,
        "Elif Yılmaz",
        &[
            ("Hatice Yılmaz", "0532 214 88 10"),
            ("Şükrü Yılmaz", "0505 337 41 62"),
        ],
    );
    save(
        &conn,
        "Mehmet Aslan",
        Some(("Sevgi Aslan", "0555 100 20 30")),
    );

    // İkinci velinin ADIYLA.
    let by_name = rows(
        &conn,
        &StudentQuery {
            search: "Şükrü".into(),
            ..query()
        },
    );
    assert_eq!(names(&by_name), vec!["Elif Yılmaz"]);

    // İkinci velinin TELEFONUYLA — boşluklu yazımla da.
    let by_phone = rows(
        &conn,
        &StudentQuery {
            search: "0505 337".into(),
            ..query()
        },
    );
    assert_eq!(names(&by_phone), vec!["Elif Yılmaz"]);

    // Değişen yalnızca aramanın kapsamı: satırın GÖRÜNÜMÜ hâlâ birincil veli.
    let row = by_name.first().expect("satır dönmeli");
    assert_eq!(row.guardian_name.as_deref(), Some("Hatice Yılmaz"));
    assert_eq!(row.guardian_phone.as_deref(), Some("0532 214 88 10"));
    assert_eq!(row.guardian_count, 2);
}

/// Çözülmüş bir veli bağı ekranda görünmüyor; aramada da eşleşmemeli. Arama listesi
/// `PRIMARY_GUARDIAN_SQL` ile aynı canlılık koşullarını kullanmak zorunda.
#[test]
fn cozulmus_veli_bagi_aramada_eslesmez() {
    let conn = common::conn();
    let student_id = save_with_guardians(
        &conn,
        "Elif Yılmaz",
        &[
            ("Hatice Yılmaz", "0532 214 88 10"),
            ("Şükrü Yılmaz", "0505 337 41 62"),
        ],
    );

    let link = repo::roster::guardian_links(&conn, student_id)
        .expect("veliler okunmalı")
        .into_iter()
        .find(|link| link.full_name == "Şükrü Yılmaz")
        .expect("ikinci veli bulunmalı");
    repo::roster::unlink_guardian(&conn, link.link_id).expect("bağ çözülmeli");

    for needle in ["Şükrü", "0505 337"] {
        assert!(
            rows(
                &conn,
                &StudentQuery {
                    search: needle.into(),
                    ..query()
                }
            )
            .is_empty(),
            "\"{needle}\" çözülmüş bağı bulmamalı"
        );
    }
}

#[test]
fn bos_arama_hepsini_dondurur() {
    let conn = common::conn();
    save(&conn, "Elif Yılmaz", None);
    save(&conn, "Mehmet Aslan", None);

    assert_eq!(rows(&conn, &query()).len(), 2);
    assert_eq!(
        rows(
            &conn,
            &StudentQuery {
                search: "   ".into(),
                ..query()
            }
        )
        .len(),
        2
    );
}

// ---------------------------------------------------------------------------
// Filtre — branş ve grup
// ---------------------------------------------------------------------------

#[test]
fn brans_ve_grup_filtresi_kayitlardan_gelir() {
    let conn = common::conn();
    let matematik = common::subject(&conn, "Matematik");
    let ingilizce = common::subject(&conn, "İngilizce");
    let grup_a = common::group(&conn, "Grup A", matematik);

    let elif = save(&conn, "Elif Yılmaz", None);
    let mehmet = save(&conn, "Mehmet Aslan", None);
    save(&conn, "Kayıtsız Öğrenci", None);

    common::enrollment(&conn, elif, Some(grup_a), matematik, "2026-01-01", None).unwrap();
    common::enrollment(&conn, mehmet, None, ingilizce, "2026-01-01", None).unwrap();

    let by_subject = rows(
        &conn,
        &StudentQuery {
            subject_id: Some(matematik),
            ..query()
        },
    );
    assert_eq!(names(&by_subject), vec!["Elif Yılmaz"]);

    let by_group = rows(
        &conn,
        &StudentQuery {
            group_id: Some(grup_a),
            ..query()
        },
    );
    assert_eq!(names(&by_group), vec!["Elif Yılmaz"]);

    // Birebir kaydın grubu yok — grup filtresine düşmez ama branş filtresine düşer.
    let solo = rows(
        &conn,
        &StudentQuery {
            subject_id: Some(ingilizce),
            ..query()
        },
    );
    assert_eq!(names(&solo), vec!["Mehmet Aslan"]);

    // Filtreler birlikte çalışır: eşleşmeyen kesişim boş döner.
    let both = rows(
        &conn,
        &StudentQuery {
            subject_id: Some(ingilizce),
            group_id: Some(grup_a),
            ..query()
        },
    );
    assert!(both.is_empty());
}

#[test]
fn arsivlenen_kayit_filtreden_duser() {
    let conn = common::conn();
    let matematik = common::subject(&conn, "Matematik");
    let elif = save(&conn, "Elif Yılmaz", None);
    let enrollment_id =
        common::enrollment(&conn, elif, None, matematik, "2026-01-01", None).unwrap();

    assert_eq!(
        rows(
            &conn,
            &StudentQuery {
                subject_id: Some(matematik),
                ..query()
            }
        )
        .len(),
        1
    );

    repo::archive::<Enrollment>(&conn, enrollment_id).unwrap();
    assert!(
        rows(
            &conn,
            &StudentQuery {
                subject_id: Some(matematik),
                ..query()
            }
        )
        .is_empty(),
        "kaydı arşivlenen öğrenci o branşın filtresinde çıkmamalı"
    );
}

// ---------------------------------------------------------------------------
// Arşivleme — ADR-005
// ---------------------------------------------------------------------------

/// §5: "Arşivlenen öğrencinin geçmiş kayıtları bozulmaz."
/// Arşivleme yalnızca `student.deleted_at`'i dolduruyor; defter satırı yerinde kalıyor
/// ve borç toplamdan düşmüyor (§1.23 — borç arşivlemekle yok olmaz).
#[test]
fn arsivleme_geri_alinabilir_ve_gecmisi_bozmaz() {
    let conn = common::conn();
    let elif = save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );
    common::ledger(&conn, elif, TODAY, "session_charge", -25_000);

    let before = rows(&conn, &query());
    assert_eq!(before[0].balance_kurus, -25_000);
    assert!(!before[0].archived);

    assert!(repo::roster::archive_student(&conn, elif).unwrap());

    let after = rows(&conn, &query());
    assert_eq!(
        after.len(),
        1,
        "arşivlenen öğrenci listeden SİLİNMEZ, işaretlenir"
    );
    assert!(after[0].archived);
    assert_eq!(
        after[0].balance_kurus, -25_000,
        "borç arşivlemekle yok olmaz (§1.23)"
    );
    assert_eq!(
        after[0].guardian_phone.as_deref(),
        Some("0532 214 88 10"),
        "veli bağı arşivlemeden etkilenmez"
    );

    // İkinci kez arşivlemek bir şey yapmaz — çift tıkla ikinci damga atılmaz.
    assert!(!repo::roster::archive_student(&conn, elif).unwrap());

    assert!(repo::roster::restore_student(&conn, elif).unwrap());
    assert!(!rows(&conn, &query())[0].archived);
    assert!(!repo::roster::restore_student(&conn, elif).unwrap());

    common::assert_ledger_invariant(&conn);
}

/// `is_active` (Aktif/Pasif) ile `deleted_at` (Arşiv) **iki farklı şey** (§1.5).
#[test]
fn pasiflestirme_arsivleme_degildir() {
    let conn = common::conn();
    let elif = save(&conn, "Elif Yılmaz", None);

    repo::roster::set_student_active(&conn, elif, false).unwrap();
    let row = &rows(&conn, &query())[0];
    assert!(!row.is_active, "pasif");
    assert!(
        !row.archived,
        "ama arşivli değil — listede görünmeye devam eder"
    );

    // Arşivlenmiş öğrencinin aktifliği değiştirilemez: önce geri alınması gerekir.
    repo::roster::archive_student(&conn, elif).unwrap();
    let err = repo::roster::set_student_active(&conn, elif, true).unwrap_err();
    assert_eq!(err.code, "not_found");
}

// ---------------------------------------------------------------------------
// Veli ilişkisi — §1.7
// ---------------------------------------------------------------------------

/// Kardeşler: **bir veli birden fazla öğrenciye bağlanabilir.**
/// Bağ tablosu bunun için var; velinin ikinci bir kopyası açılmaz.
#[test]
fn ayni_veli_iki_ogrenciye_baglanir() {
    let conn = common::conn();
    let elif = save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );

    let hatice = repo::roster::guardian_links(&conn, elif).unwrap()[0].guardian_id;

    // İkinci kardeş MEVCUT veliye bağlanıyor (`guardian_id` dolu).
    let emre = repo::roster::save_student(
        &conn,
        &StudentInput {
            id: None,
            full_name: "Emre Yılmaz".into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: vec![GuardianInput {
                guardian_id: Some(hatice),
                full_name: "Hatice Yılmaz".into(),
                phone: "0532 214 88 10".into(),
                email: None,
                relation: Some("Anne".into()),
                is_primary: true,
            }],
        },
    )
    .unwrap();

    // Tek veli kaydı, iki bağ.
    assert_eq!(repo::list_live::<Guardian>(&conn).unwrap().len(), 1);

    let elif_links = repo::roster::guardian_links(&conn, elif).unwrap();
    let emre_links = repo::roster::guardian_links(&conn, emre).unwrap();
    assert_eq!(elif_links[0].guardian_id, emre_links[0].guardian_id);
    assert_eq!(
        elif_links[0].other_student_count, 1,
        "kardeş göstergesi: bu veli başka bir öğrenciye de bağlı"
    );

    // İki öğrencinin de liste satırında aynı telefon görünür.
    let listed = rows(&conn, &query());
    assert_eq!(listed.len(), 2);
    for row in &listed {
        assert_eq!(row.guardian_phone.as_deref(), Some("0532 214 88 10"));
    }

    // Bir kardeşin bağını çözmek diğerini etkilemez ve veliyi silmez.
    repo::roster::unlink_guardian(&conn, emre_links[0].link_id).unwrap();
    assert!(repo::roster::guardian_links(&conn, emre)
        .unwrap()
        .is_empty());
    assert_eq!(repo::roster::guardian_links(&conn, elif).unwrap().len(), 1);
    assert_eq!(repo::list_live::<Guardian>(&conn).unwrap().len(), 1);
}

/// `ux_sg_primary` öğrenci başına tek birincil veliye izin veriyor. Birincili
/// değiştirmek `UNIQUE` ihlaline düşmemeli — sıra bağlayıcı (önce düşür, sonra kaldır).
#[test]
fn birincil_veli_degistirilebilir() {
    let conn = common::conn();

    let make = |primary_index: usize| StudentInput {
        id: None,
        full_name: "Elif Yılmaz".into(),
        school: None,
        grade: None,
        birth_date: None,
        phone: None,
        is_active: true,
        enrolled_on: None,
        note: None,
        guardians: vec![
            GuardianInput {
                guardian_id: None,
                full_name: "Hatice Yılmaz".into(),
                phone: "0532 214 88 10".into(),
                email: None,
                relation: Some("Anne".into()),
                is_primary: primary_index == 0,
            },
            GuardianInput {
                guardian_id: None,
                full_name: "Ali Yılmaz".into(),
                phone: "0532 700 11 25".into(),
                email: None,
                relation: Some("Baba".into()),
                is_primary: primary_index == 1,
            },
        ],
    };

    let elif = repo::roster::save_student(&conn, &make(0)).unwrap();
    assert_eq!(
        rows(&conn, &query())[0].guardian_phone.as_deref(),
        Some("0532 214 88 10"),
        "listedeki telefon BİRİNCİL veliden okunur"
    );

    // Babayı birincil yap — mevcut velilere bağlanarak.
    let links = repo::roster::guardian_links(&conn, elif).unwrap();
    let mut update = make(1);
    update.id = Some(elif);
    for (input, existing) in update.guardians.iter_mut().zip(
        // Bağlar birincil önce sıralı geliyor; id'leri ada göre eşleştiriyoruz.
        ["Hatice Yılmaz", "Ali Yılmaz"].map(|name| {
            links
                .iter()
                .find(|l| l.full_name == name)
                .expect("veli bulunmalı")
                .guardian_id
        }),
    ) {
        input.guardian_id = Some(existing);
    }

    repo::roster::save_student(&conn, &update).expect("birincil veli değiştirilebilmeli");

    assert_eq!(
        rows(&conn, &query())[0].guardian_phone.as_deref(),
        Some("0532 700 11 25")
    );
    let after = repo::roster::guardian_links(&conn, elif).unwrap();
    assert_eq!(after.iter().filter(|l| l.is_primary).count(), 1);
    assert_eq!(after[0].full_name, "Ali Yılmaz");
}

/// Hiçbir veli birincil işaretlenmemişse ilki birincil olur — velisi olan bir öğrenci
/// birincilsiz kalamaz, çünkü liste telefonu ondan okuyor.
#[test]
fn birincil_isaretlenmezse_ilk_veli_birincil_olur() {
    let conn = common::conn();
    let elif = repo::roster::save_student(
        &conn,
        &StudentInput {
            id: None,
            full_name: "Elif Yılmaz".into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: vec![GuardianInput {
                guardian_id: None,
                full_name: "Hatice Yılmaz".into(),
                phone: "0532 214 88 10".into(),
                email: None,
                relation: None,
                is_primary: false,
            }],
        },
    )
    .unwrap();

    assert!(repo::roster::guardian_links(&conn, elif).unwrap()[0].is_primary);
}

/// Formdan çıkarılan veli bağı çözülür; velinin **kendisi** silinmez.
#[test]
fn listeden_cikarilan_veli_bagi_cozulur() {
    let conn = common::conn();
    let elif = save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );
    assert_eq!(repo::roster::guardian_links(&conn, elif).unwrap().len(), 1);

    repo::roster::save_student(
        &conn,
        &StudentInput {
            id: Some(elif),
            full_name: "Elif Yılmaz".into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: Vec::new(),
        },
    )
    .unwrap();

    assert!(repo::roster::guardian_links(&conn, elif)
        .unwrap()
        .is_empty());
    assert_eq!(
        repo::list_live::<Guardian>(&conn).unwrap().len(),
        1,
        "veli kaydı durur — kardeşe bağlı olabilir"
    );
}

#[test]
fn veli_aramasi_ada_ve_telefona_bakar() {
    let conn = common::conn();
    save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );
    save(
        &conn,
        "Mehmet Aslan",
        Some(("Sevgi Aslan", "0505 337 41 62")),
    );

    assert_eq!(
        repo::roster::search_guardians(&conn, "hatice")
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        repo::roster::search_guardians(&conn, "YILMAZ")
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        repo::roster::search_guardians(&conn, "0505").unwrap().len(),
        1
    );
    assert!(repo::roster::search_guardians(&conn, "")
        .unwrap()
        .is_empty());
    assert!(repo::roster::search_guardians(&conn, "yok böyle biri")
        .unwrap()
        .is_empty());
}

// ---------------------------------------------------------------------------
// Yazma yolu — transaction ve doğrulama
// ---------------------------------------------------------------------------

/// Veli doğrulaması düşerse **öğrenci de yazılmaz**. Aksi hâlde velisiz bir öğrenci
/// oluşur ve listedeki telefon kolonu sessizce boş kalır.
#[test]
fn gecersiz_veli_ogrenciyi_de_yazdirmaz() {
    let conn = common::conn();

    let err = repo::roster::save_student(
        &conn,
        &StudentInput {
            id: None,
            full_name: "Elif Yılmaz".into(),
            school: None,
            grade: None,
            birth_date: None,
            phone: None,
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: vec![GuardianInput {
                guardian_id: None,
                full_name: "Hatice Yılmaz".into(),
                phone: "  ".into(), // ADR-009: veli telefonu zorunlu
                email: None,
                relation: None,
                is_primary: true,
            }],
        },
    )
    .unwrap_err();

    assert_eq!(err.code, "guardians.0.phone");
    assert!(rows(&conn, &query()).is_empty(), "öğrenci de yazılmamalı");
    assert!(repo::list_live::<Guardian>(&conn).unwrap().is_empty());
}

#[test]
fn guncelleme_search_name_ve_phone_digits_i_yeniden_uretir() {
    let conn = common::conn();
    let id = save(&conn, "Elif Yilmaz", None);

    repo::roster::save_student(
        &conn,
        &StudentInput {
            id: Some(id),
            full_name: "Elif Yılmaz".into(),
            school: Some("  ".into()), // boş metin NULL'a döner
            grade: None,
            birth_date: None,
            phone: Some("+90 (532) 214-88-10".into()),
            is_active: true,
            enrolled_on: None,
            note: None,
            guardians: Vec::new(),
        },
    )
    .unwrap();

    let student: Student = repo::require(&conn, id).unwrap();
    assert_eq!(student.search_name, "elif yılmaz");
    assert_eq!(student.phone_digits.as_deref(), Some("905322148810"));
    assert_eq!(student.school, None, "boş metin NULL olur, '' değil");

    // Yeni yazımıyla aranabilmeli.
    assert_eq!(
        rows(
            &conn,
            &StudentQuery {
                search: "yılmaz".into(),
                ..query()
            }
        )
        .len(),
        1
    );
}

// ---------------------------------------------------------------------------
// Liste satırının sayıları
// ---------------------------------------------------------------------------

#[test]
fn satir_bakiye_kalan_ders_ve_islenen_dersi_tasir() {
    let conn = common::conn();
    let matematik = common::subject(&conn, "Matematik");
    let grup = common::group(&conn, "Grup A", matematik);
    let elif = save(&conn, "Elif Yılmaz", None);
    common::enrollment(&conn, elif, Some(grup), matematik, "2026-01-01", None).unwrap();

    // İki seans: birine geldi, birine mazeretsiz gelmedi. Üçüncüsü yoklamasız.
    let mut attendance_ids = Vec::new();
    for (day, status) in [("2026-03-10", "present"), ("2026-03-17", "unexcused")] {
        let session_id = common::group_session(&conn, grup, matematik, day);
        attendance_ids.push(
            repo::academic::insert_attendance(
                &conn,
                &Attendance {
                    id: None,
                    session_id,
                    student_id: elif,
                    status: status.into(),
                    marked_at: Some(format!("{day} 17:00")),
                    note: None,
                    created_at: None,
                    updated_at: None,
                    deleted_at: None,
                },
            )
            .unwrap(),
        );
    }
    common::group_session(&conn, grup, matematik, "2026-03-24"); // yoklama girilmedi

    // 8 derslik paket, 2 hakkı kullanılmış.
    let package_id = repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: elif,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 8,
            unit_price: 25_000,
            total_price: 200_000,
            sold_on: "2026-03-01".into(),
            valid_until: None,
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    for attendance_id in &attendance_ids {
        repo::finance::insert_package_usage(
            &conn,
            &PackageUsage {
                id: None,
                package_id,
                attendance_id: Some(*attendance_id),
                used_on: "2026-03-10".into(),
                delta: -1,
                reason: "attendance".into(),
                reverses_id: None,
                memo: None,
                created_at: None,
                updated_at: None,
                deleted_at: None,
            },
        )
        .unwrap();
    }

    common::ledger(&conn, elif, "2026-03-01", "installment_charge", -100_000);
    common::ledger(&conn, elif, "2026-03-05", "payment", 40_000);

    let row = &rows(&conn, &query())[0];
    assert_eq!(row.balance_kurus, -60_000, "negatif = borçlu (K3)");
    assert_eq!(
        row.debt_kurus, 60_000,
        "borç pozitif gösterilir (v_student_debt)"
    );
    assert_eq!(row.remaining_lessons, Some(6), "8 − 2 kullanılan");
    assert_eq!(
        row.processed_lessons, 2,
        "yoklaması girilmemiş ders işlenmiş sayılmaz"
    );
    assert_eq!(row.attended_lessons, 1);
    assert_eq!(row.last_session_date.as_deref(), Some("2026-03-17"));
    assert_eq!(row.subject_ids, vec![matematik]);
    assert_eq!(row.group_ids, vec![grup]);

    common::assert_ledger_invariant(&conn);
}

/// Paketi hiç olmayan öğrenci `None` döner — "paketi bitti" (`0`) ile aynı şey değil,
/// ekranda ikisi farklı görünüyor.
#[test]
fn paketsiz_ogrencinin_kalan_dersi_bos_gelir() {
    let conn = common::conn();
    save(&conn, "Elif Yılmaz", None);
    assert_eq!(rows(&conn, &query())[0].remaining_lessons, None);
}

/// Süresi geçmiş paket kalan hakka sayılmaz. `today` bind edilir — SQLite saati
/// okunmaz (§0), yoksa bu test CI'nın saat diliminde başka sonuç verirdi.
#[test]
fn suresi_gecmis_paket_kalan_derse_sayilmaz() {
    let conn = common::conn();
    let elif = save(&conn, "Elif Yılmaz", None);
    repo::finance::insert_package(
        &conn,
        &Package {
            id: None,
            student_id: elif,
            enrollment_id: None,
            price_rule_id: None,
            lesson_count: 8,
            unit_price: 25_000,
            total_price: 200_000,
            sold_on: "2026-01-01".into(),
            valid_until: Some("2026-02-01".into()), // TODAY = 2026-03-31
            status: "active".into(),
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();

    assert_eq!(rows(&conn, &query())[0].remaining_lessons, None);
    assert_eq!(
        rows(
            &conn,
            &StudentQuery {
                today: Some("2026-01-15".into()),
                ..query()
            }
        )[0]
        .remaining_lessons,
        Some(8),
        "geçerlilik tarihinden önce sayılır"
    );
}

// ---------------------------------------------------------------------------
// Detay ve notlar
// ---------------------------------------------------------------------------

#[test]
fn detay_veli_not_ve_gecikmeyi_getirir() {
    let conn = common::conn();
    let matematik = common::subject(&conn, "Matematik");
    let elif = save(
        &conn,
        "Elif Yılmaz",
        Some(("Hatice Yılmaz", "0532 214 88 10")),
    );
    // §1.13 CHECK: taksit ya bir pakete ya bir kayda bağlı olmak zorunda.
    let enrollment_id =
        common::enrollment(&conn, elif, None, matematik, "2026-01-01", None).unwrap();

    let installment_id = repo::finance::insert_installment(
        &conn,
        &Installment {
            id: None,
            student_id: elif,
            package_id: None,
            enrollment_id: Some(enrollment_id),
            seq: 1,
            due_on: "2026-03-19".into(), // TODAY = 2026-03-31 → 12 gün gecikmiş
            amount: 120_000,
            label: Some("Mart taksiti".into()),
            accrued_entry_id: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    let entry_id = repo::finance::insert_ledger_entry(
        &conn,
        &LedgerEntry {
            id: None,
            student_id: elif,
            entry_date: "2026-03-19".into(),
            kind: "installment_charge".into(),
            amount: -120_000,
            attendance_id: None,
            installment_id: Some(installment_id),
            payment_id: None,
            reverses_id: None,
            memo: None,
            created_at: None,
            updated_at: None,
            deleted_at: None,
        },
    )
    .unwrap();
    repo::finance::mark_installment_accrued(&conn, installment_id, entry_id).unwrap();

    repo::roster::add_note(&conn, elif, "  Veli aradı, sınav sonucu soruldu.  ", None).unwrap();
    repo::roster::add_note(&conn, elif, "Deneme 2", Some("2026-02-01".into())).unwrap();

    let detail = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(detail.student.full_name, "Elif Yılmaz");
    assert_eq!(detail.guardians.len(), 1);
    assert!(detail.guardians[0].is_primary);
    assert_eq!(detail.row.debt_kurus, 120_000);
    assert_eq!(
        detail.days_overdue,
        Some(12),
        "tasarımdaki '12 gün gecikti'"
    );

    assert_eq!(detail.notes.len(), 2);
    assert_eq!(
        detail.notes[0].body, "Veli aradı, sınav sonucu soruldu.",
        "not kırpılır ve en yeni önce gelir"
    );
    assert_eq!(detail.notes[1].noted_on, "2026-02-01");

    // Boş not kabul edilmez.
    assert_eq!(
        repo::roster::add_note(&conn, elif, "   ", None)
            .unwrap_err()
            .code,
        "note.body"
    );

    // Not arşivlenince listeden düşer, kayıt silinmez (ADR-005).
    let note_id = detail.notes[1].id.unwrap();
    assert!(repo::roster::archive_note(&conn, note_id).unwrap());
    let after = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(after.notes.len(), 1);
    assert!(after.has_ledger, "taksit tahakkuku deftere satır yazdı");
}

/// Faz 4 denetiminin 2. bulgusu. Bakiye kartının altyazısı `days_overdue`'ya
/// bağlıydı ve `days_overdue` yalnızca **gecikmiş** borçta doluyor — borcunu tamamen
/// ödemiş, defterinde onlarca hareket olan öğrencinin kartında da "Henüz hareket yok"
/// yazıyordu. Ayrımı bakiye veremez: ikisinde de `0`.
#[test]
fn detay_defterin_bos_olup_olmadigini_soyler() {
    let conn = common::conn();
    let elif = save(&conn, "Elif Yılmaz", None);

    let empty = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(empty.row.balance_kurus, 0);
    assert!(!empty.has_ledger, "defter gerçekten boş");
    assert_eq!(empty.days_overdue, None);

    // Borç + tam ödeme: bakiye yine 0, defter DOLU.
    common::ledger(&conn, elif, "2026-03-01", "session_charge", -25_000);
    common::ledger(&conn, elif, "2026-03-02", "payment", 25_000);

    let settled = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(settled.row.balance_kurus, 0, "bakiye kapandı");
    assert_eq!(settled.days_overdue, None, "gecikmiş borç yok");
    assert!(
        settled.has_ledger,
        "defteri dolu öğrenciye 'henüz hareket yok' denemez"
    );
    common::assert_ledger_invariant(&conn);
}

#[test]
fn detay_siradaki_dersi_hem_grup_hem_birebir_icin_bulur() {
    let conn = common::conn();
    let matematik = common::subject(&conn, "Matematik");
    let grup = common::group(&conn, "Grup A", matematik);
    let elif = save(&conn, "Elif Yılmaz", None);
    common::enrollment(&conn, elif, Some(grup), matematik, "2026-01-01", None).unwrap();

    // Geçmiş seans sıradaki ders değildir.
    common::group_session(&conn, grup, matematik, "2026-03-10");
    common::group_session(&conn, grup, matematik, "2026-04-07");
    common::group_session(&conn, grup, matematik, "2026-04-14");

    let detail = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(detail.next_session_at.as_deref(), Some("2026-04-07 16:00"));

    // Gruptan ayrılmış öğrenci sonraki seansları görmez (ADR-013 aralık sorgusu).
    let enrollments = repo::academic::enrollments_of(&conn, elif).unwrap();
    let mut closed = enrollments[0].clone();
    closed.end_on = Some("2026-03-31".into());
    repo::academic::update_enrollment(&conn, closed.id.unwrap(), &closed).unwrap();

    let detail = repo::roster::student_detail(&conn, elif, Some(TODAY.into())).unwrap();
    assert_eq!(detail.next_session_at, None);
}

#[test]
fn bilinmeyen_ogrenci_turkce_hata_dondurur() {
    let conn = common::conn();
    let err = repo::roster::student_detail(&conn, 999, Some(TODAY.into())).unwrap_err();
    assert_eq!(err.code, "not_found");
    assert!(err.message.contains("bulunamadı"));
}
