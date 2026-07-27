import { describe, expect, it } from 'vitest'
import type { DaySessionRow } from '../../lib/api'
import { conflictingSessionIds, rowsToAppointments } from './appointments'

const session = (id: number, patch: Partial<DaySessionRow> = {}): DaySessionRow => ({
  id,
  seriesId: null,
  startsAt: '2026-07-27 16:00',
  endsAt: '2026-07-27 17:00',
  kind: 'group',
  subjectId: 1,
  subjectName: 'Matematik',
  subjectColor: 'amber',
  teacherId: 1,
  teacherName: 'Ayşe Demir',
  studyGroupId: 1,
  studentId: null,
  title: 'Grup A',
  status: 'planned',
  attendanceTaken: false,
  studentCount: 4,
  presentCount: 0,
  markedCount: 0,
  isMakeup: false,
  cancelReason: null,
  ...patch,
})

describe('appointment adaptörü', () => {
  it('kimlikleri, duvar saatini ve durumları korur', () => {
    const [item] = rowsToAppointments(
      [session(7, { seriesId: 4, isMakeup: true })],
      '2026-07-27 18:00',
    )
    expect(item).toMatchObject({
      id: 7,
      seriesId: 4,
      subjectName: 'Matematik',
      title: 'Grup A',
      isMakeup: true,
      isPast: true,
      attendanceMissing: true,
    })
  })

  it('farklı öğretmenlerin eşzamanlı derslerini çakışma saymaz', () => {
    expect(conflictingSessionIds([session(1), session(2, { teacherId: 2 })]).size).toBe(0)
  })

  it('aynı öğretmenin eşzamanlı derslerini çakışma sayar', () => {
    expect([...conflictingSessionIds([session(1), session(2)])]).toEqual([1, 2])
  })

  it('iptal edilmiş dersi çakışmaya katmaz', () => {
    expect(conflictingSessionIds([session(1), session(2, { status: 'cancelled' })]).size).toBe(0)
  })
})
