/**
 * Türkçe sıralama — TEK YER (ADR-020).
 *
 * SQL'de Türkçe metin kolonlarına `ORDER BY` yazılmaz: SQLite'ta `localeCompare('tr')`
 * karşılığı yok, `COLLATE NOCASE` ASCII-only. `ORDER BY full_name` yazılırsa
 * Ç/Ö/Ş/Ü/İ ile başlayan her öğrenci Z'den sonraya düşer ve kullanıcı "program bozuk" der.
 * Repository katmanı bu listeleri sırasız döndürür; sıralama burada yapılır.
 *
 * Yasak yalnızca Türkçe metin kolonları içindir — tarih, tutar ve sort_order
 * kolonlarında SQL `ORDER BY` serbest ve gereklidir.
 */
const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true })

/** İki Türkçe metni karşılaştırır. Array.prototype.sort'a doğrudan verilebilir. */
export function compareTr(a: string, b: string): number {
  return collator.compare(a, b)
}

/** Diziyi verilen anahtara göre Türkçe sıralar. Girdiyi değiştirmez. */
export function sortTrBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(key(a), key(b)))
}

/** Metin dizisini Türkçe sıralar. Girdiyi değiştirmez. */
export function sortTr(items: readonly string[]): string[] {
  return [...items].sort(collator.compare)
}
