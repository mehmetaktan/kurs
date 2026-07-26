/**
 * Takvimin çipleri ve gün gruplaması — **saf fonksiyonlar.**
 *
 * ADR-025'in iş bölümü diğer modüllerdekiyle aynı: aralık sorgusu Rust'ta
 * (`repo::schedule::session_rows_between`), çipler burada. Takvimde sayfalama yok —
 * ızgaranın "sayfası" zaten hafta.
 *
 * **İki eksen: branş ve öğretmen** (ADR-038). Öğretmen ekseni, kurs çok öğretmenli
 * çıkınca eklendi (ADR-037): birden fazla öğretmenin dersi tek ızgarada filtresiz
 * yığılırsa ekran okunamaz. Izgaranın renk dili yine branş rengi üzerine kurulu
 * (`subject.color`), o yüzden öğretmen çipinde renk noktası yok.
 *
 * Takvimin dondurulması sürüyor (ADR-034): buraya eklenen tek şey ekseni, geometri
 * değil. **Gün görünümü tek sütun kalır.**
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

export interface TeacherChip {
  id: number
  name: string
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

/**
 * Görünen aralıktaki öğretmenler ve ders sayıları — branş ekseninin birebir eşi
 * (ADR-038).
 *
 * **Öğretmeni atanmamış dersler çip üretmez.** Bir `Atanmamış` çipi hem çip satırını
 * uzatır hem de kullanıcının düzeltmesi gereken bir eksikliği normal bir kategori gibi
 * gösterirdi; o dersler filtre seçilmediğinde zaten görünüyor.
 */
export function teacherChips(rows: readonly DaySessionRow[]): TeacherChip[] {
  const byId = new Map<number, TeacherChip>()
  for (const row of rows) {
    if (row.teacherId === null) continue
    const found = byId.get(row.teacherId)
    if (found) {
      found.count += 1
      continue
    }
    byId.set(row.teacherId, {
      id: row.teacherId,
      // Ad `session_rows_between`'in JOIN'inden geliyor; silinmiş bir satıra karşı
      // güvenlik ağı olarak id'ye düşülüyor.
      name: row.teacherName ?? String(row.teacherId),
      count: 1,
    })
  }
  return [...byId.values()].sort((a, b) => compareTr(a.name, b.name) || a.id - b.id)
}

/** Seçim boşsa süzme yok — `filterBySubjects` ile aynı kural. */
export function filterByTeachers(
  rows: readonly DaySessionRow[],
  selected: ReadonlySet<number>,
): DaySessionRow[] {
  if (selected.size === 0) return [...rows]
  return rows.filter((row) => row.teacherId !== null && selected.has(row.teacherId))
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
