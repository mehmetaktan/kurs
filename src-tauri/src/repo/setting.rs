//! §1.2 `setting` — anahtar/değer. PK `key` olduğu için `Record` trait'ini uygulamaz.
//!
//! Varsayılanlar `001_initial.sql` içinde **başlangıç verisi** olarak yazılır — seed'de
//! değil. Seed yalnızca geliştirmede çalışıyor; oraya konsaydı kurs sahibinin gerçek
//! makinesinde bu tablo boş kalırdı.

use rusqlite::Connection;

use crate::clock;
use crate::error::{AppError, AppResult};
use crate::model::Setting;

/// `Tanımlar → Genel` ekranından yazılabilen anahtarlar (§1.2).
///
/// Tablodaki 14 satırın **üçü burada yok** ve bu bilinçli:
/// - `institution_name` — okunmuyor, kurum adı `config/kurum.json`'dan geliyor (ADR-024).
/// - `receipt_next_no` — makbuz sayacı; program artırır, kullanıcı değil.
/// - `last_backup_at` — yedekleme kaydı; program yazar.
pub const EDITABLE_KEYS: &[&str] = &[
    "day_start",
    "day_end",
    "slot_minutes",
    "default_session_minutes",
    "session_horizon_weeks",
    "weekly_closed_days",
    "row_density",
    "absence_excused_consumes_lesson",
    "absence_unexcused_consumes_lesson",
    "package_expiry_days",
    "receipt_prefix",
    "backup_warn_days",
];

pub fn get(conn: &Connection, key: &str) -> AppResult<Option<Setting>> {
    let mut stmt = conn.prepare(
        "SELECT key, value, created_at, updated_at, deleted_at \
         FROM setting WHERE key = ?1 AND deleted_at IS NULL",
    )?;
    let mut rows = stmt.query_map([key], from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Ham değer; anahtar yoksa `None`.
pub fn value(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    Ok(get(conn, key)?.map(|s| s.value))
}

/// Değer; anahtar yoksa verilen varsayılan.
pub fn value_or(conn: &Connection, key: &str, fallback: &str) -> AppResult<String> {
    Ok(value(conn, key)?.unwrap_or_else(|| fallback.to_string()))
}

/// Sayısal ayar. Boş ya da sayı olmayan değer `None` döner — `package_expiry_days`
/// gibi "boşsa süresiz" anlamı taşıyan anahtarlar için gerekli.
pub fn value_i64(conn: &Connection, key: &str) -> AppResult<Option<i64>> {
    Ok(value(conn, key)?.and_then(|v| v.trim().parse::<i64>().ok()))
}

/// `'1'` / `'0'` ayarları (ADR-016 devamsızlık politikası bunları okur).
pub fn value_bool(conn: &Connection, key: &str, fallback: bool) -> AppResult<bool> {
    Ok(value_i64(conn, key)?.map(|v| v != 0).unwrap_or(fallback))
}

pub fn list(conn: &Connection) -> AppResult<Vec<Setting>> {
    let mut stmt = conn.prepare(
        "SELECT key, value, created_at, updated_at, deleted_at \
         FROM setting WHERE deleted_at IS NULL ORDER BY key",
    )?;
    let rows = stmt.query_map([], from_row)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Var olan anahtarı günceller, yoksa oluşturur.
pub fn set(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO setting (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = ?3",
        rusqlite::params![key, value, clock::now_local()],
    )?;
    Ok(())
}

/// Yalnızca var olan anahtarı günceller. Yazım hatasıyla yeni anahtar doğmasını
/// engellemek isteyen ekranlar (Tanımlar → Genel) bunu kullanır.
pub fn update_existing(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    let changed = conn.execute(
        "UPDATE setting SET value = ?2, updated_at = ?3 WHERE key = ?1 AND deleted_at IS NULL",
        rusqlite::params![key, value, clock::now_local()],
    )?;
    if changed == 0 {
        return Err(AppError::new(
            "setting_not_found",
            "Bu ayar bulunamadı. Programı kapatıp yeniden açın.",
        ));
    }
    Ok(())
}

fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Setting> {
    Ok(Setting {
        key: row.get(0)?,
        value: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
        deleted_at: row.get(4)?,
    })
}
