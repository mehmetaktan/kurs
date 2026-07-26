/**
 * Takvimin çipleri ve gün gruplaması — **saf fonksiyonlar.**
 *
 * ADR-025'in iş bölümü diğer modüllerdekiyle aynı: aralık sorgusu Rust'ta
 * (`repo::schedule::session_rows_between`), çipler burada. Takvimde sayfalama yok —
 * ızgaranın "sayfası" zaten hafta.
 *
 * **Öğretmen filtresi yok** (ADR-011: tek öğretmen). Filtrenin tek ekseni branş, çünkü
 * ızgaranın renk dili de branş rengi üzerine kurulu (`subject.color`).
 */
import type { DaySessionRow } from '../../lib/api'
import { compareTr } from '../../lib/sortTr'
import { subjectColorOf } from '../tanimlar/palette'

export interface SubjectChip {
  id: number
  name: string
  color: string
  count: number
}

/**
 * Görünen aralıktaki branşlar ve ders sayıları.
 *
 * Liste **veriden** türetiliyor, `list_subjects`'ten değil: takvimin çipi "bu hafta ne
 * var" sorusunu cevaplıyor. Bütün branşlar listelenseydi hafta boyunca hiç dersi olmayan
 * branşlar da sıfır sayıyla durur ve çip satırı kullanıcının haftasını anlatmazdı.
 */
export function subjectChips(rows: readonly DaySessionRow[]): SubjectChip[] {
  const byId = new Map<number, SubjectChip>()
  for (const row of rows) {
    const found = byId.get(row.subjectId)
    if (found) {
      found.count += 1
      continue
    }
    byId.set(row.subjectId, {
      id: row.subjectId,
      name: row.subjectName,
      color: subjectColorOf(row.subjectColor),
      count: 1,
    })
  }
  // ADR-020: Türkçe sıralama arayüzde. Eşitlik `id` ile kırılıyor ki sıra oynamasın.
  return [...byId.values()].sort((a, b) => compareTr(a.name, b.name) || a.id - b.id)
}

/** Seçim boşsa süzme yok — "hiçbiri seçili değil" ile "hepsi seçili" aynı ekran. */
export function filterBySubjects(
  rows: readonly DaySessionRow[],
  selected: ReadonlySet<number>,
): DaySessionRow[] {
  if (selected.size === 0) return [...rows]
  return rows.filter((row) => selected.has(row.subjectId))
}

/** Dersleri gününe göre böler (`'YYYY-MM-DD'` → satırlar). Boş gün anahtarsız kalır. */
export function rowsByDay(rows: readonly DaySessionRow[]): Map<string, DaySessionRow[]> {
  const byDay = new Map<string, DaySessionRow[]>()
  for (const row of rows) {
    const day = row.startsAt.slice(0, 10)
    const found = byDay.get(day)
    if (found) found.push(row)
    else byDay.set(day, [row])
  }
  return byDay
}

/**
 * Görünen günlerin **hepsi** kapalı mı — `EKRANLAR §149`'un dört boş durumundan biri
 * ("Bu hafta tamamen tatil"). "Ders yok" ile "hafta kapalı" farklı iki cümle: birinde
 * kullanıcı ders ekleyebilir, ötekinde ekleyemez.
 */
export function allDaysClosed(days: readonly string[], closed: ReadonlySet<string>): boolean {
  return days.length > 0 && days.every((day) => closed.has(day))
}
