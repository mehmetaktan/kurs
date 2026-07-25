//! Türkçe metin normalleştirme — VERI-MODELI.md §0 K9.
//!
//! SQLite'ın `lower()` fonksiyonu ASCII-only: `'İ'` küçülmez, `'I'` → `'i'` olur
//! (Türkçe'de `'ı'` olmalı). Sonuç tutarsız: kullanıcı `ingilizce` yazınca `İngilizce`
//! branşını **bulamaz**, ama ASCII `I` ile başlayan `Ilkbahar Grubu`'nu **bulur**.
//!
//! Bu yüzden aranabilir metin sütunları (`search_name`) yazma anında burada üretilir;
//! sorgu tarafı basit `LIKE` ile deterministik çalışır.
//!
//! Not: Rust'ın kendi `to_lowercase()`'i de yetmez — `'İ'`yi iki kod noktasına
//! (`i` + birleşen nokta) açar ve `'I'`yi `'i'` yapar. İkisi de özel olarak ele alınır.

/// Türkçe küçültme + boşluk normalleştirme. `search_name` sütunlarına yazılan değer.
///
/// ```
/// # use kurs_takip_lib::text::search_name;
/// assert_eq!(search_name("İngilizce"), "ingilizce");
/// assert_eq!(search_name("IŞIK  Yılmaz"), "ışık yılmaz");
/// ```
pub fn search_name(input: &str) -> String {
    let lowered: String = input
        .chars()
        .flat_map(|ch| match ch {
            // Türkçe'nin ASCII'den ayrıldığı tek yer: noktalı/noktasız i çifti.
            'I' => vec!['ı'],
            'İ' => vec!['i'],
            other => other.to_lowercase().collect(),
        })
        .collect();

    // Aradaki boşluk yığınları tek boşluğa iner: "Ali  Veli" ile "Ali Veli" aynı kayıt.
    lowered.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Telefonun yalnızca rakamları — arama için (`phone_digits`).
/// `'0532 111 22 33'` ve `'+90 532 111 22 33'` aynı öğrenciyi bulmalı.
pub fn phone_digits(input: &str) -> String {
    input.chars().filter(char::is_ascii_digit).collect()
}

#[cfg(test)]
mod tests {
    //! Bu dosyadaki vektörlerin ikizi `src/lib/format.test.ts` içindedir
    //! (`normalizeTr` ↔ `search_name`, `phoneDigits` ↔ `phone_digits`). Biri değişirse
    //! ikisi birlikte değişir — Faz 2 denetimi `parseKurus` ayrışmasını böyle yakaladı.

    use super::*;

    #[test]
    fn noktali_i_kuculur() {
        assert_eq!(search_name("İngilizce"), "ingilizce");
        assert_eq!(search_name("İSTANBUL"), "istanbul");
    }

    #[test]
    fn noktasiz_i_dogru_uretilir() {
        // ASCII davranışı 'I' -> 'i' olurdu; Türkçe'de 'ı' olmalı.
        assert_eq!(search_name("IŞIK"), "ışık");
        assert_eq!(search_name("Ilgaz"), "ılgaz");
    }

    #[test]
    fn diger_turkce_harfler() {
        assert_eq!(search_name("ÇĞÖŞÜ"), "çğöşü");
        assert_eq!(search_name("Öğrenci Şahin"), "öğrenci şahin");
    }

    #[test]
    fn bosluklar_normallesir() {
        assert_eq!(search_name("  Ali   Veli  "), "ali veli");
    }

    #[test]
    fn ayni_brans_iki_yazimla_ayni_anahtari_uretir() {
        // ux_subject_name bu sayede mükerrer branşı şema seviyesinde engelliyor.
        assert_eq!(search_name("İngilizce"), search_name("ingilizce"));
        assert_eq!(search_name("Matematik"), search_name("MATEMATİK"));
    }

    /// Vektörlerin ikizi `src/lib/format.test.ts` içinde (`phoneDigits`). Arama kutusu
    /// TS tarafından, `phone_digits` sütunu buradan geçiyor; ikisi ayrışırsa kullanıcı
    /// kendi kaydettiği numarayı bulamaz.
    #[test]
    fn telefon_rakamlari() {
        assert_eq!(phone_digits("0532 111 22 33"), "05321112233");
        assert_eq!(phone_digits("+90 (532) 111-22-33"), "905321112233");
        assert_eq!(phone_digits(""), "");
        assert_eq!(phone_digits("tel: 0532"), "0532");
        // ASCII olmayan rakamlar düşer (`is_ascii_digit`) — TS `\D` ile aynı sonuç.
        assert_eq!(phone_digits("٥٣٢"), "");
    }
}
