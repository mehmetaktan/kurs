/**
 * Gruplar ekranının çipleri ve Türkçe sıralaması — **saf fonksiyonlar.**
 *
 * ADR-025'in iş bölümü, `pages/ogrenciler/filters.ts` ile birebir aynı kalıpta:
 * arama ve branş süzgeci Rust'ta (`repo::schedule::group_rows`), çipler ve sıralama
 * burada, sayfalama ortak (`lib/paginate.ts`).
 *
 * **Alt çubukta para rakamı yok**, dolayısıyla ADR-026 burada tetiklenmiyor: grup bir
 * para kavramı taşımıyor. Alt çubuk yalnızca kaç grup gösterildiğini yazıyor.
 */
import { tr } from '../../i18n/tr'
import type { GroupRow } from '../../lib/api'
import { formatTime } from '../../lib/format'
import { compareTr } from '../../lib/sortTr'

/**
 * Tasarımdaki çipler (EKRANLAR.md §304) + `Arşivlenmiş`.
 *
 * `full` ve `available` **kapasiteye göre** ayrılıyor; kapasite aşımı `full` içinde
 * kalıyor (PRD S2: aşım engellenmiyor, görünür kılınıyor).
 */
export type GroupChip = 'all' | 'active' | 'full' | 'available' | 'archived'

export const GROUP_CHIPS: readonly GroupChip[] = ['all', 'active', 'full', 'available', 'archived']

/** Kontenjan doldu mu — aşım da dolu sayılır. */
export function isFull(row: GroupRow): boolean {
  return row.memberCount >= row.capacity
}

/** Kapasite aşıldı mı — listede ayrı bir işaretle gösterilir. */
export function isOverCapacity(row: GroupRow): boolean {
  return row.memberCount > row.capacity
}

/**
 * Bir satır çipe uyuyor mu.
 *
 * `all` dahil bütün canlı çipler arşivlenmişi **dışarıda bırakır**: arşiv ayrı bir
 * görünüm. Öğrenci listesindeki kuralın aynısı — "Tümü" kurs sahibi için "bütün
 * gruplarım" demek, "arşiv dahil her kayıt" değil.
 */
export function matchesChip(row: GroupRow, chip: GroupChip): boolean {
  if (chip === 'archived') return row.archived
  if (row.archived) return false

  switch (chip) {
    case 'all':
      return true
    case 'active':
      return row.isActive
    case 'full':
      return isFull(row)
    case 'available':
      return !isFull(row)
  }
}

export function filterByChip(rows: readonly GroupRow[], chip: GroupChip): GroupRow[] {
  return rows.filter((row) => matchesChip(row, chip))
}

export function chipCounts(rows: readonly GroupRow[]): Record<GroupChip, number> {
  const counts = {} as Record<GroupChip, number>
  for (const chip of GROUP_CHIPS) {
    counts[chip] = rows.reduce((total, row) => total + (matchesChip(row, chip) ? 1 : 0), 0)
  }
  return counts
}

/**
 * Türkçe sıralama (ADR-020): önce branş, sonra grup adı.
 *
 * İki anahtarlı olmasının sebebi ekranın kendisi: aynı branşın grupları listede yan yana
 * durunca "Matematik'te kaç grubum var" bir bakışta cevaplanıyor. Eşitlik `id` ile
 * kırılıyor — `compareTr` büyük/küçük harf ayırmadığı için gerçekten eşitlik olabiliyor
 * ve sıra sayfadan sayfaya oynamamalı.
 */
export function sortGroups(rows: readonly GroupRow[]): GroupRow[] {
  return [...rows].sort(
    (a, b) =>
      compareTr(a.subjectName, b.subjectName) || compareTr(a.name, b.name) || a.id - b.id,
  )
}

/**
 * Haftalık programın tek satırlık özeti: `Sal 16:00 · Per 18:00`.
 *
 * Hem liste kolonu hem detayın özet şeridi bunu gösteriyor; iki yerde ayrı ayrı
 * kurulsaydı biri gün kısaltmasını, diğeri tam adı yazardı.
 *
 * `weekdaysShortMonFirst` Pazartesi'den başlıyor, `weekday` de 1 = Pazartesi —
 * dizin bu yüzden `weekday - 1`.
 */
export function weeklySummary(row: GroupRow): string {
  return row.weekly
    .map(
      (slot) =>
        `${tr.dates.weekdaysShortMonFirst[slot.weekday - 1]} ${formatTime(slot.startTime)}`,
    )
    .join(tr.units.separator)
}
