//! Para biçimlendirme ve ayrıştırma — ADR-003.
//!
//! Tutarlar her yerde **kuruş cinsinden `i64`**. Float yasak: kuruş yuvarlama hataları
//! kısmi ödeme ve paket bölüşümünde birikir, bakiye tutmaz.
//!
//! Bu modülün `src/lib/format.ts` içinde birebir karşılığı var; ikisinin de testi var
//! (`src/lib/format.test.ts` bilerek AYNI beklenti tablosunu tekrar eder — iki taraf
//! ancak böyle karşılaştırılabilir). Denetimde bulundu: TS sürümü bir ara tüm noktaları
//! baştan atıyordu ve `"1.2,3.4"` girdisini sessizce `1234`'e çeviriyordu; Rust ise
//! reddediyordu. Kuruş kaybının tipik doğuş biçimi budur, o yüzden bozuk girdi listesi
//! iki tarafta da aynı.

use crate::error::{AppError, AppResult};

/// Ekranda gösterilen eksi işareti: U+2212, ASCII tire değil (ADR-014).
pub const MINUS: char = '−';

/// Kuruş → `"1.234,56"` (negatifte `"−1.234,56"`).
pub fn format_kurus(kurus: i64) -> String {
    let negative = kurus < 0;
    // i64::MIN'in mutlak değeri i64'e sığmaz; unsigned tarafta hesaplanır.
    let abs = kurus.unsigned_abs();
    let lira = abs / 100;
    let cents = abs % 100;

    let mut lira_text = String::new();
    let digits = lira.to_string();
    for (i, ch) in digits.chars().enumerate() {
        // Baştan sayarak, kalan basamak sayısı 3'ün katıysa binlik ayıracı gir.
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            lira_text.push('.');
        }
        lira_text.push(ch);
    }

    let body = format!("{lira_text},{cents:02}");
    if negative {
        format!("{MINUS}{body}")
    } else {
        body
    }
}

/// Kuruş → `"1.234,56 ₺"`.
pub fn format_lira(kurus: i64) -> String {
    format!("{} ₺", format_kurus(kurus))
}

/// Türkçe para metni → kuruş. Hem `−` (U+2212) hem ASCII `-` kabul edilir.
///
/// Binlik ayıracı `.`, ondalık ayıracı `,`. Ondalık en fazla 2 basamak.
pub fn parse_kurus(input: &str) -> AppResult<i64> {
    let cleaned: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '₺')
        .collect();

    let invalid = || {
        AppError::new(
            "invalid_amount",
            "Tutarı anlayamadım. Örnek: 1.234,56 — sadece rakam, nokta ve virgül kullanın.",
        )
    };

    if cleaned.is_empty() {
        return Err(invalid());
    }

    let (negative, rest) = match cleaned.strip_prefix([MINUS, '-']) {
        Some(rest) => (true, rest),
        None => (false, cleaned.as_str()),
    };

    let (lira_part, cents_part) = match rest.split_once(',') {
        Some((l, c)) => (l, c),
        None => (rest, ""),
    };

    let lira_digits = lira_part.replace('.', "");
    if lira_digits.is_empty() || !lira_digits.chars().all(|c| c.is_ascii_digit()) {
        return Err(invalid());
    }
    if cents_part.len() > 2 || !cents_part.chars().all(|c| c.is_ascii_digit()) {
        return Err(invalid());
    }

    let lira: i64 = lira_digits.parse().map_err(|_| invalid())?;
    // "1,5" → 50 kuruş, "1,50" → 50 kuruş. Tek basamak onda birdir.
    let cents: i64 = match cents_part.len() {
        0 => 0,
        1 => cents_part.parse::<i64>().map_err(|_| invalid())? * 10,
        _ => cents_part.parse().map_err(|_| invalid())?,
    };

    let total = lira
        .checked_mul(100)
        .and_then(|v| v.checked_add(cents))
        .ok_or_else(invalid)?;

    Ok(if negative { -total } else { total })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bicimlendirme() {
        assert_eq!(format_kurus(0), "0,00");
        assert_eq!(format_kurus(5), "0,05");
        assert_eq!(format_kurus(50), "0,50");
        assert_eq!(format_kurus(100), "1,00");
        assert_eq!(format_kurus(25000), "250,00");
        assert_eq!(format_kurus(123456), "1.234,56");
        assert_eq!(format_kurus(100000000), "1.000.000,00");
    }

    #[test]
    fn negatifte_u2212_kullanilir() {
        assert_eq!(format_kurus(-123456), "−1.234,56");
        assert_eq!(format_kurus(-120000), "−1.200,00");
        // ASCII tire OLMAMALI (ADR-014).
        assert!(!format_kurus(-100).contains('-'));
    }

    #[test]
    fn i64_min_tasmadan_bicimlenir() {
        // abs() burada panikler; unsigned_abs kullanıldığı için sorun yok.
        assert!(format_kurus(i64::MIN).starts_with('−'));
    }

    #[test]
    fn ayristirma() {
        assert_eq!(parse_kurus("1.234,56").unwrap(), 123456);
        assert_eq!(parse_kurus("1234,56").unwrap(), 123456);
        assert_eq!(parse_kurus("250").unwrap(), 25000);
        assert_eq!(parse_kurus("250,5").unwrap(), 25050);
        assert_eq!(parse_kurus("0,05").unwrap(), 5);
        assert_eq!(parse_kurus(" 1.234,56 ₺ ").unwrap(), 123456);
    }

    #[test]
    fn ayristirma_iki_eksi_isaretini_de_kabul_eder() {
        assert_eq!(parse_kurus("−1.200,00").unwrap(), -120000);
        assert_eq!(parse_kurus("-1.200,00").unwrap(), -120000);
    }

    #[test]
    fn bozuk_girdi_turkce_hata_dondurur() {
        // "1.2,3.4": virgülden SONRA nokta. TS tarafı bir ara tüm noktaları baştan
        // atıp bunu sessizce 1234'e çeviriyordu; iki taraf da reddetmeli.
        for bad in ["", "abc", "1,234", "1.2.3,456", "12,345", ",", "1.2,3.4"] {
            let err = parse_kurus(bad).unwrap_err();
            assert_eq!(err.code, "invalid_amount", "girdi: {bad:?}");
            assert!(!err.message.is_empty());
        }
    }

    #[test]
    fn gidis_donus() {
        for value in [0i64, 1, 99, 100, 25000, 123456, -123456, 999_999_999] {
            let text = format_kurus(value);
            assert_eq!(parse_kurus(&text).unwrap(), value, "metin: {text}");
        }
    }
}
