import type { DaySessionRow } from '../../lib/api'
import { subjectColorOf } from '../tanimlar/palette'
import { wallClockToDate } from './calendarDateAdapter'

export interface CalendarAppointment {
  id: number
  seriesId: number | null
  startDate: Date
  endDate: Date
  text: string
  subjectId: number
  subjectName: string
  subjectColor: string
  teacherId: number | null
  teacherName: string | null
  title: string
  kind: string
  isMakeup: boolean
  status: string
  attendanceTaken: boolean
  isPast: boolean
  attendanceMissing: boolean
  locked: boolean
  conflict: boolean
  row: DaySessionRow
}

export function rowsToAppointments(
  rows: readonly DaySessionRow[],
  now: string,
): CalendarAppointment[] {
  const appointments = rows.map((row) => rowToAppointment(row, now))
  const conflicts = conflictingSessionIds(rows)
  return appointments.map((item) => ({ ...item, conflict: conflicts.has(item.id) }))
}

export function rowToAppointment(row: DaySessionRow, now: string): CalendarAppointment {
  const isPast = row.endsAt <= now
  return {
    id: row.id,
    seriesId: row.seriesId,
    startDate: wallClockToDate(row.startsAt),
    endDate: wallClockToDate(row.endsAt),
    text: `${row.subjectName} · ${row.title}`,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    subjectColor: subjectColorOf(row.subjectColor),
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    title: row.title,
    kind: row.kind,
    isMakeup: row.isMakeup,
    status: row.status,
    attendanceTaken: row.attendanceTaken,
    isPast,
    attendanceMissing: isPast && !row.attendanceTaken && row.status !== 'cancelled',
    locked: row.attendanceTaken,
    conflict: false,
    row,
  }
}

/**
 * Görsel çakışma yalnızca aynı öğretmenin canlı dersleri arasındadır. Kalıcı işlem
 * öncesindeki kesin kontrol yine Rust `session_conflicts` komutudur.
 */
export function conflictingSessionIds(rows: readonly DaySessionRow[]): Set<number> {
  const result = new Set<number>()
  const active = rows.filter(
    (row) => row.status !== 'cancelled' && row.teacherId !== null,
  )
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const a = active[left]
      const b = active[right]
      if (
        a !== undefined &&
        b !== undefined &&
        a.teacherId === b.teacherId &&
        a.startsAt < b.endsAt &&
        b.startsAt < a.endsAt
      ) {
        result.add(a.id)
        result.add(b.id)
      }
    }
  }
  return result
}
