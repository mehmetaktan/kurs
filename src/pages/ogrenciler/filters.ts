/**
 * Öğrenciler ekranının çipleri, Türkçe sıralaması ve sayfalaması — **saf fonksiyonlar.**
 *
 * ## Neden burada, Rust'ta değil
 *
 * Sıralama ADR-020 gereği SQL'de yapılamıyor: SQLite'ta `localeCompare('tr')` karşılığı
 * yok, `ORDER BY full_name` yazılırsa Ç/Ö/Ş/Ü/İ ile başlayan her öğrenci Z'den sonraya
 * düşer. Sayfalama da bu yüzden buraya bağlı: **sıralanmamış bir listeyi sayfalamak
 * yanlış sayfa üretir**, yani ikisi aynı yerde durmak zorunda.
 *
 * Arama ve branş/grup süzgeci ise Rust'ta (`repo::roster::student_rows`) — orada
 * `search_name` sütunu var ve `İ/ı` sorunu yazma anında çözülmüş oluyor (K9).
 * Çipler burada: sayılarını göstermek için zaten tüm satırlar elde.
 */
import type { StudentRow } from '../../lib/api'
import { compareTr } from '../../lib/sortTr'

/**
 * Tasarımdaki çipler (EKRANLAR.md §3) + `Arşivlenmiş` (E2).
 *
 * `archived` ayrı bir çip, `passive`'in bir türü değil: `is_active` ile `deleted_at`
 * iki farklı şey (VERI-MODELI §1.5). Pasif öğrenci kayıtlı ama ders almıyor;
 * arşivlenmiş öğrenci listeden çekilmiş.
 */
export type StudentChip = 'all' | 'active' | 'passive' | 'debtor' | 'lowPackage' | 'archived'

export const STUDENT_CHIPS: readonly StudentChip[] = [
  'all',
  'active',
  'passive',
  'debtor',
  'lowPackage',
  'archived',
]

/** "Paketi bitiyor" eşiği — tasarımın amber `≤ 2` kuralı. */
export const LOW_PACKAGE_THRESHOLD = 2

/**
 * Bir satır çipe uyuyor mu.
 *
 * `all` dışındaki bütün canlı çipler arşivlenmişi **dışarıda bırakır**: arşiv ayrı bir
 * görünüm (§5 — "Arşivlenmiş öğrenci varsayılan listede görünmez, filtreyle görünür").
 * `all` de arşivliyi göstermez; "Tümü" kurs sahibi için "bütün öğrencilerim" demek,
 * "arşiv dahil her kayıt" değil.
 */
export function matchesChip(row: StudentRow, chip: StudentChip): boolean {
  if (chip === 'archived') return row.archived
  if (row.archived) return false

  switch (chip) {
    case 'all':
      return true
    case 'active':
      return row.isActive
    case 'passive':
      return !row.isActive
    case 'debtor':
      return row.debtKurus > 0
    case 'lowPackage':
      // `null` = paketi hiç yok — "bitiyor" değil. `0` ise gerçekten bitmiş.
      return row.remainingLessons !== null && row.remainingLessons <= LOW_PACKAGE_THRESHOLD
  }
}

export function filterByChip(rows: readonly StudentRow[], chip: StudentChip): StudentRow[] {
  return rows.filter((row) => matchesChip(row, chip))
}

/** Her çipin sayısı — tasarımda çiplerin üstünde duruyor. */
export function chipCounts(rows: readonly StudentRow[]): Record<StudentChip, number> {
  const counts = {} as Record<StudentChip, number>
  for (const chip of STUDENT_CHIPS) {
    counts[chip] = rows.reduce((total, row) => total + (matchesChip(row, chip) ? 1 : 0), 0)
  }
  return counts
}

/**
 * Türkçe sıralama (ADR-020). Ada göre; eşitlik durumunda `id` — aynı adlı iki öğrencide
 * sıra sayfadan sayfaya oynamasın.
 */
export function sortStudents(rows: readonly StudentRow[]): StudentRow[] {
  // `compareTr` büyük/küçük harf ayırmıyor (`sensitivity: 'base'`), o yüzden eşitlik
  // gerçekten olabiliyor; `id` ile kırılıyor ki sıra sayfadan sayfaya oynamasın.
  return [...rows].sort((a, b) => compareTr(a.fullName, b.fullName) || a.id - b.id)
}

/**
 * Alt çubuktaki para özeti — **ekranda görünen satırların** toplamı (ADR-026).
 *
 * Çağıran, çip süzgecinden geçmiş ve sıralanmış listeyi verir; sayfalanmış olanı
 * değil. Rust'tan gelen ham listeyi vermek, rakamın arama/branş süzgecine tepki verip
 * çiplere kör kalması demekti: "Branş: Matematik" seçince değişen, "Borçlular" çipine
 * basınca değişmeyen bir sayı.
 *
 * `VERI-MODELI §1.23` bozulmuyor: arşivlenmiş borçlu "Arşivlenmiş" çipinde görünür ve
 * o listenin toplamına girer. Kurs geneli, süzgeçten bağımsız rakamın yeri liste
 * altbilgisi değil Dashboard'dur (Faz 9, `views::total_receivable`).
 */
export function totalReceivableKurus(rows: readonly StudentRow[]): number {
  return rows.reduce((total, row) => total + Math.max(0, row.debtKurus), 0)
}
