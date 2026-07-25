//! Repository katmanı — frontend SQL yazmaz (ADR-002).
//!
//! Her tablonun tipli `insert` / `update` fonksiyonu kendi modülünde. Bütün tablolarda
//! aynı olan işler (`get`, `list`, `archive`, `restore`, `count`) burada bir kez yazılır
//! ve `Record` trait'i üzerinden tip güvenli biçimde paylaşılır.
//!
//! `TABLE` ve `COLUMNS` derleme zamanı sabitleridir — SQL'e kullanıcı girdisi girmez.

pub mod academic;
pub mod finance;
pub mod ops;
pub mod people;
pub mod roster;
pub mod setting;
pub mod views;

use rusqlite::Connection;

use crate::clock;
use crate::error::{AppError, AppResult};

/// `id` birincil anahtarlı ve soft delete'li her tablo bunu uygular.
/// (`setting` uygulamaz: PK'sı `key`.)
pub trait Record: Sized {
    const TABLE: &'static str;
    /// `SELECT` listesi — `from_row`'daki sütun sırasıyla AYNI olmak zorunda.
    const COLUMNS: &'static str;

    fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Self>;
}

fn select_where<T: Record>(conn: &Connection, filter: &str) -> AppResult<Vec<T>> {
    // ADR-020: Türkçe metin kolonlarında ORDER BY YOK. Sıralama `src/lib/sortTr.ts`'te.
    let sql = format!("SELECT {} FROM {} {}", T::COLUMNS, T::TABLE, filter);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| T::from_row(row))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Tek kayıt — arşivlenmiş olsa bile döner (detay ekranı arşivi de göstermeli).
pub fn get<T: Record>(conn: &Connection, id: i64) -> AppResult<Option<T>> {
    let sql = format!("SELECT {} FROM {} WHERE id = ?1", T::COLUMNS, T::TABLE);
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map([id], |row| T::from_row(row))?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Tek kayıt; yoksa kullanıcıya gösterilebilir Türkçe hata.
pub fn require<T: Record>(conn: &Connection, id: i64) -> AppResult<T> {
    get(conn, id)?.ok_or_else(|| {
        AppError::new(
            "not_found",
            "Kayıt bulunamadı. Arşivlenmiş olabilir; listeyi yenileyin.",
        )
    })
}

/// Canlı kayıtlar (`deleted_at IS NULL`).
pub fn list_live<T: Record>(conn: &Connection) -> AppResult<Vec<T>> {
    select_where(conn, "WHERE deleted_at IS NULL")
}

/// Arşivlenmiş kayıtlar — kullanıcıya "Arşiv" olarak gösterilir (ADR-005).
pub fn list_archived<T: Record>(conn: &Connection) -> AppResult<Vec<T>> {
    select_where(conn, "WHERE deleted_at IS NOT NULL")
}

/// Canlı + arşivli. Muhasebe listeleri bunu kullanır (§1.23: borç arşivlemekle yok olmaz).
pub fn list_all<T: Record>(conn: &Connection) -> AppResult<Vec<T>> {
    select_where(conn, "")
}

pub fn count_live<T: Record>(conn: &Connection) -> AppResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM {} WHERE deleted_at IS NULL", T::TABLE);
    Ok(conn.query_row(&sql, [], |row| row.get(0))?)
}

/// Soft delete. Kullanıcıya **"Arşivle"** denir, "Sil" değil (ADR-005).
/// Zaten arşivliyse hiçbir şey yapmaz ve `false` döner.
pub fn archive<T: Record>(conn: &Connection, id: i64) -> AppResult<bool> {
    let sql = format!(
        "UPDATE {} SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        T::TABLE
    );
    // Zaman damgası Rust'tan bind edilir — UPDATE'te DEFAULT çalışmaz (§0 'now' kuralı).
    let changed = conn.execute(&sql, rusqlite::params![clock::now_local(), id])?;
    Ok(changed > 0)
}

/// Arşivden geri alma.
pub fn restore<T: Record>(conn: &Connection, id: i64) -> AppResult<bool> {
    let sql = format!(
        "UPDATE {} SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NOT NULL",
        T::TABLE
    );
    let changed = conn.execute(&sql, rusqlite::params![clock::now_local(), id])?;
    Ok(changed > 0)
}

/// `insert` fonksiyonlarının ortak sonu: eklenen satırın id'si.
pub(crate) fn last_id(conn: &Connection) -> i64 {
    conn.last_insert_rowid()
}

/// Birden fazla tabloya yazan işlemler tek transaction'da koşar — yarım kayıt kalmaz.
///
/// Öğrenci + veli kaydı bunun tipik örneği: veli bağlanamazsa öğrenci de yazılmamalı,
/// yoksa kullanıcı "kaydettim" diyor ama velisiz bir öğrenci oluşuyor ve telefon kolonu
/// boş kalıyor. `Connection`'ı `&mut` olarak ödünç alamıyoruz (`AppState` `&Connection`
/// veriyor), o yüzden `seed::load`'daki açık BEGIN/COMMIT kalıbı burada bir kez yazıldı.
pub fn in_transaction<T>(
    conn: &Connection,
    f: impl FnOnce(&Connection) -> AppResult<T>,
) -> AppResult<T> {
    conn.execute_batch("BEGIN")?;
    match f(conn) {
        Ok(value) => {
            conn.execute_batch("COMMIT")?;
            Ok(value)
        }
        Err(err) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(err)
        }
    }
}
