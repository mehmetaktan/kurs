//! Tarih ve saat — VERI-MODELI.md §0 `'now'` kuralının Rust tarafı.
//!
//! SQLite'ın `datetime('now')` fonksiyonu `TZ`'den bağımsız olarak **daima UTC** döner.
//! Türkiye UTC+3 olduğu için gece 00:00–03:00 arasında bir önceki günü verir — yani
//! ADR-017'nin (yerel duvar saati) tam tersi.
//!
//! Kural: kullanıcıya görünen hiçbir hesap SQLite saatini okumaz. "Bugün" bir sorgu
//! parametresidir, burada üretilip **bind edilir**. Yan fayda: testler CI makinesinin
//! saat dilimine bağlı olmaktan çıkar.
//!
//! SQL içinde `'now'` yalnızca denetim sütunlarının `DEFAULT`'unda ve daima `'localtime'`
//! ile geçer (INSERT'te devreye girer). UPDATE'te `DEFAULT` çalışmadığı için
//! `updated_at` buradan bind edilir.

use chrono::{Local, NaiveDate};

/// Yerel duvar saati damgası: `'YYYY-MM-DD HH:MM'`.
/// Şemadaki `strftime('%Y-%m-%d %H:%M','now','localtime')` ile aynı biçim.
pub fn now_local() -> String {
    Local::now().format("%Y-%m-%d %H:%M").to_string()
}

/// Yerel bugünün tarihi. Para ve vade hesaplarına parametre olarak girer.
pub fn today_local() -> NaiveDate {
    Local::now().date_naive()
}

/// Yerel bugün, `'YYYY-MM-DD'` metni.
pub fn today_local_string() -> String {
    today_local().format("%Y-%m-%d").to_string()
}

/// `NaiveDate` → şema biçimi.
pub fn date_string(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_local_semada_beklenen_bicimde() {
        let now = now_local();
        assert_eq!(now.len(), 16, "'YYYY-MM-DD HH:MM' 16 karakter: {now}");
        assert_eq!(now.as_bytes()[4], b'-');
        assert_eq!(now.as_bytes()[7], b'-');
        assert_eq!(now.as_bytes()[10], b' ');
        assert_eq!(now.as_bytes()[13], b':');
    }

    #[test]
    fn today_local_string_on_karakter() {
        assert_eq!(today_local_string().len(), 10);
    }
}
