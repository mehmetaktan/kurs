import type { AbsenceReportRow } from '../../lib/api'
import { compareTr } from '../../lib/sortTr'

export function sortAbsenceRows(rows: readonly AbsenceReportRow[]): AbsenceReportRow[] {
  return [...rows].sort(
    (a, b) =>
      b.totalCount - a.totalCount ||
      compareTr(a.fullName, b.fullName) ||
      a.studentId - b.studentId,
  )
}

export function absenceTotal(rows: readonly AbsenceReportRow[]): number {
  return rows.reduce((total, row) => total + row.totalCount, 0)
}

export function reportRangeError(
  from: string | null,
  to: string | null,
): 'required' | 'order' | null {
  if (!from || !to) return 'required'
  return from > to ? 'order' : null
}
