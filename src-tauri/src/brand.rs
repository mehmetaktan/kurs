//! Kurum kimliği — `config/kurum.json`, **derleme anında gömülü** (ADR-024).
//!
//! İki ayrı kimlik var ve karıştırılmaz:
//!
//! - **Ürün kimliği Aktansoft'un, sabit.** Ürün adı `Kurs Takip`, uygulama kimliği
//!   `db::APP_IDENTIFIER`, yayıncı `Aktansoft`. Hiçbiri buradan gelmez.
//! - **Kurum kimliği müşterinin, değişken.** Yalnızca bu dosyadan gelir.
//!
//! `include_str!` çalışma anı dosya okumasını ortadan kaldırıyor. Gerekçesi ADR-008'in
//! doğrudan sonucu: çalışma anında okunan bir config dosyası Windows'ta bir dosya yolu,
//! bir kodlama (BOM'lu UTF-8), bir "kullanıcı dosyayı sildi" ve bir "OneDrive klasörü
//! senkronize etti" arıza sınıfı açardı.
//!
//! `setting.institution_name` satırı `001_initial.sql` içinde duruyor ama **okunmuyor** —
//! migration mühürlü olduğu için silinemedi (VERI-MODELI.md §1.2).
//!
//! İkizi `src/config/brand.ts`. İkisi de aynı JSON'u okuyor; ayrışmaları mümkün değil.

use std::sync::OnceLock;

use serde::Deserialize;

/// Depodaki tek kurum kaynağı. Yol `src-tauri/src/` içinden göreli.
const KURUM_JSON: &str = include_str!("../../config/kurum.json");

#[derive(Debug, Clone, Deserialize)]
pub struct Institution {
    /// Kenar çubuğunun 2. satırı ve makbuz başlığı (PRD R4.11).
    #[serde(rename = "institutionName")]
    pub name: String,
    pub receipt: Receipt,
}

/// Makbuz alt bilgisi. Boş alanlar makbuza **basılmaz** — PRD bunları istemiyor;
/// Faz 8'de gerçek bir makbuzun istediği görülürse dosya biçimi yeniden açılmasın diye
/// şimdiden yer ayrıldı.
#[derive(Debug, Clone, Deserialize)]
pub struct Receipt {
    pub address: String,
    pub phone: String,
}

/// Gömülü kurum bilgisi. İlk çağrıda bir kez ayrıştırılır.
///
/// **Bozuk ya da kurum adı boş bir `kurum.json` ile panik eder.** Bu kasıtlı: dosya
/// depoda ve derlemeye gömülü, yani hatası geliştirme makinesinde ortaya çıkar. Kurs
/// sahibinin makinesinde oluşabilecek bir arıza değil — orada dosya zaten yok, metin
/// binary'nin içinde. Testi aşağıda (`kurum_json_ayristirilabilir`).
pub fn institution() -> &'static Institution {
    static CACHE: OnceLock<Institution> = OnceLock::new();
    CACHE.get_or_init(|| {
        let parsed: Institution = serde_json::from_str(KURUM_JSON)
            .expect("config/kurum.json ayrıştırılamadı — biçimi ADR-024'te");
        assert!(
            !parsed.name.trim().is_empty(),
            "config/kurum.json > institutionName boş olamaz"
        );
        parsed
    })
}

/// Kurum adı — kenar çubuğu ve makbuz başlığı.
pub fn institution_name() -> &'static str {
    &institution().name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kurum_json_ayristirilabilir() {
        // Gömülü metin bozuksa burada düşer — çalışma anında değil.
        assert!(!institution_name().trim().is_empty());
    }

    /// Kurum adı ürün adı DEĞİL (ADR-024). İkisi karışırsa ikinci müşteride
    /// `%APPDATA%` klasörü ya da pencere başlığı yanlış ada döner.
    #[test]
    fn kurum_adi_urun_kimligine_sizmaz() {
        let name = crate::text::search_name(institution_name());
        assert!(
            !crate::db::APP_IDENTIFIER.contains(&name.replace(' ', "")),
            "kurum adı uygulama kimliğine sızmış: {}",
            crate::db::APP_IDENTIFIER
        );
    }
}
