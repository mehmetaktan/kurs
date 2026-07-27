import type {
  AbsenceReportRow,
  MonthlyCollectionRow,
  SubjectLessonRow,
} from '../../lib/api'
import { compareTr } from '../../lib/sortTr'

export function sortMonthlyCollections(
  rows: readonly MonthlyCollectionRow[],
): MonthlyCollectionRow[] {
  return [...rows].sort((a, b) => (a.month === b.month ? 0 : a.month < b.month ? 1 : -1))
}

export function sortSubjectLessons(rows: readonly SubjectLessonRow[]): SubjectLessonRow[] {
  return [...rows].sort(
    (a, b) =>
      b.processedSessionCount - a.processedSessionCount ||
      compareTr(a.subjectName, b.subjectName) ||
      a.subjectId - b.subjectId,
  )
}

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
