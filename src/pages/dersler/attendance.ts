import type {
  AttendanceStudentRow,
  MarkedAttendanceStatus,
} from '../../lib/api'
import { tr } from '../../i18n/tr'
import { formatLira } from '../../lib/format'

export interface AttendanceDraft {
  status: MarkedAttendanceStatus | null
  note: string
}

export interface AttendanceEffectSummary {
  lessonCreditsToConsume: number
  lessonCreditsToRestore: number
  debtToAddKurus: number
  debtToRemoveKurus: number
  complete: boolean
}

/** `pending` bir seçim düğmesi değildir; ilk açılışta hiçbir seçenek basılı olmaz. */
export function attendanceDrafts(
  rows: readonly AttendanceStudentRow[],
): Record<number, AttendanceDraft> {
  return Object.fromEntries(
    rows.map((row) => [
      row.studentId,
      {
        status: row.status === 'pending' ? null : row.status,
        note: row.note ?? '',
      },
    ]),
  )
}

export function attendanceDraftsEqual(
  rows: readonly AttendanceStudentRow[],
  left: Readonly<Record<number, AttendanceDraft>>,
  right: Readonly<Record<number, AttendanceDraft>>,
): boolean {
  return rows.every((row) => {
    const a = left[row.studentId] ?? { status: null, note: '' }
    const b = right[row.studentId] ?? { status: null, note: '' }
    return a.status === b.status && a.note === b.note
  })
}

export function attendanceEffectSummary(
  rows: readonly AttendanceStudentRow[],
  drafts: Readonly<Record<number, AttendanceDraft>>,
): AttendanceEffectSummary {
  let lessonCreditsToConsume = 0
  let lessonCreditsToRestore = 0
  let debtToAddKurus = 0
  let debtToRemoveKurus = 0
  let complete = rows.length > 0
  for (const row of rows) {
    const status = drafts[row.studentId]?.status ?? null
    if (status === null) {
      complete = false
      continue
    }
    // Politika ve mevcut zincir etkisi Rust'ta çözülür; arayüz yalnız yönlü farkı toplar.
    const delta = row.effects[status]
    const creditDelta = delta.lessonCredits
    if (creditDelta > 0) lessonCreditsToConsume += creditDelta
    if (creditDelta < 0) lessonCreditsToRestore += -creditDelta

    const debtDelta = delta.debtKurus
    if (debtDelta > 0) debtToAddKurus += debtDelta
    if (debtDelta < 0) debtToRemoveKurus += -debtDelta
  }
  return {
    lessonCreditsToConsume,
    lessonCreditsToRestore,
    debtToAddKurus,
    debtToRemoveKurus,
    complete,
  }
}

/** Yönlü farkı kullanıcıya kaydetmeden önce tek, açık Türkçe cümleyle anlatır. */
export function attendanceEffectText(summary: AttendanceEffectSummary): string {
  if (!summary.complete) return tr.attendance.effect.pending
  const parts: string[] = []
  if (summary.lessonCreditsToConsume > 0) {
    parts.push(
      `${summary.lessonCreditsToConsume} ${tr.attendance.effect.lessonCreditsConsume}`,
    )
  }
  if (summary.lessonCreditsToRestore > 0) {
    parts.push(
      `${summary.lessonCreditsToRestore} ${tr.attendance.effect.lessonCreditsRestore}`,
    )
  }
  if (summary.debtToAddKurus > 0) {
    parts.push(`${formatLira(summary.debtToAddKurus)} ${tr.attendance.effect.debtAdd}`)
  }
  if (summary.debtToRemoveKurus > 0) {
    parts.push(`${formatLira(summary.debtToRemoveKurus)} ${tr.attendance.effect.debtRemove}`)
  }
  return parts.length === 0
    ? tr.attendance.effect.unchanged
    : `${parts.join(tr.attendance.effect.separator)}${tr.attendance.effect.period}`
}
