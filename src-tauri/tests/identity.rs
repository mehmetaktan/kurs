//! Kimlik mühürleri (ADR-024) — aynı değerin iki dosyada durduğu yerler.
//!
//! Bu testlerin koruduğu arıza sınıfı **sessizdir**: hiçbir şey çökmez, derleme geçer,
//! uygulama açılır. Yalnızca kurs sahibinin verisi beklenmedik bir yerde olur ya da
//! ekranda yanlış bir sürüm yazar. Faz 3 sonunda ikisini de yalnızca birer yorum satırı
//! koruyordu.

use std::path::{Path, PathBuf};

use kurs_takip_lib::db;

fn tauri_conf() -> serde_json::Value {
    // Yol string birleştirmeyle kurulmaz (CLAUDE.md > Windows). `CARGO_MANIFEST_DIR`
    // src-tauri/ klasörünü gösteriyor; tauri.conf.json onun içinde.
    let path: PathBuf = Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("{} okunamadı: {err}", path.display()));
    serde_json::from_str(&text).expect("tauri.conf.json geçerli JSON olmalı")
}

/// `db::APP_IDENTIFIER` ile `tauri.conf.json > identifier` **aynı** olmak zorunda.
///
/// Tauri `app_data_dir()`'i `data_dir()/identifier` olarak hesaplıyor; seed binary'si ise
/// Tauri runtime'ı olmadığı için sabiti kullanıyor. İkisi ayrışırsa `npm run seed` bir
/// klasöre, uygulama başka bir klasöre yazar — kurs sahibi verisinin kaybolduğunu sanır,
/// oysa veri başka bir `%APPDATA%` klasöründedir. Teşhisi zor bir arıza.
///
/// **Negatif kontrolü yapıldı:** sabit geçici olarak bozulduğunda bu test düştü.
#[test]
fn app_identifier_tauri_conf_ile_ayni() {
    let conf = tauri_conf();
    let identifier = conf["identifier"]
        .as_str()
        .expect("tauri.conf.json > identifier metin olmalı");

    assert_eq!(
        identifier,
        db::APP_IDENTIFIER,
        "tauri.conf.json > identifier ({identifier}) ile db::APP_IDENTIFIER ({}) ayrıştı: \
         uygulama ile seed binary'si FARKLI %APPDATA% klasörlerine yazar",
        db::APP_IDENTIFIER
    );
}

/// Ürün kimliği Aktansoft'un (ADR-024) — kurum adı taşımaz.
/// Kimlik müşteri adı taşırsa ikinci müşteride ya yanlış klasör adı kullanılır ya
/// veritabanı taşınır.
#[test]
fn app_identifier_urun_kimligidir() {
    assert_eq!(db::APP_IDENTIFIER, "com.aktansoft.kurstakip");

    let conf = tauri_conf();
    assert_eq!(
        conf["productName"].as_str(),
        Some("Kurs Takip"),
        "ürün adı sabittir, kurum adına bağlanmaz"
    );
    assert_eq!(
        conf["bundle"]["publisher"].as_str(),
        Some("Aktansoft"),
        "Windows kurulum ekranında ve 'Uygulamalar ve özellikler' listesinde görünen ad"
    );
}

/// Sürüm numarasının tek kaynağı `package.json`: Tauri onu dosya yolu üzerinden okur,
/// Cargo'daki zorunlu crate sürümü de aynı değerde kalır.
///
/// Elle yazılan sürüm kayar ve kimse fark etmez — Faz 3 sonunda kenar çubuğu
/// `'Sürüm 1.0'` diyordu, gerçek sürüm `0.1.0`'dı.
#[test]
fn surum_numarasi_cargo_ile_tauri_conf_arasinda_ayni() {
    let conf = tauri_conf();
    let package_path: PathBuf = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri kök altında olmalı")
        .join("package.json");
    let package: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&package_path)
            .unwrap_or_else(|err| panic!("{} okunamadı: {err}", package_path.display())),
    )
    .expect("package.json geçerli JSON olmalı");
    assert_eq!(
        conf["version"].as_str(),
        Some("../package.json"),
        "Tauri sürümü doğrudan package.json dosyasından okunmalı"
    );
    assert_eq!(
        package["version"].as_str(),
        Some(env!("CARGO_PKG_VERSION")),
        "package.json > version ile Cargo.toml > version ayrıştı"
    );
}
