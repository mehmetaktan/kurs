import { describe, expect, it } from 'vitest'
import type { Setting } from '../../lib/api'
import { rowToAppointment } from './appointments'
import { calendarSettingsOf, visibleDayHours } from './calendarSettings'

const settings = (values: Record<string, string>): Setting[] =>
  Object.entries(values).map(([key, value]) => ({ key, value }))

describe('takvim çalışma düzeni', () => {
  it('Tanımlar → Genel değerlerini okur', () => {
    expect(
      calendarSettingsOf(
        settings({
          day_start: '07:30',
          day_end: '20:30',
          slot_minutes: '15',
          default_session_minutes: '45',
        }),
      ),
    ).toEqual({
      dayStart: '07:30',
      dayEnd: '20:30',
      slotMinutes: 15,
      defaultSessionMinutes: 45,
    })
  })

  it('bozuk veya ters ayarda güvenli varsayılana döner', () => {
    expect(
      calendarSettingsOf(
        settings({
          day_start: '22:00',
          day_end: '08:00',
          slot_minutes: '0',
          default_session_minutes: 'bozuk',
        }),
      ),
    ).toEqual({
      dayStart: '08:00',
      dayEnd: '22:00',
      slotMinutes: 30,
      defaultSessionMinutes: 60,
    })
  })

  it('ayar dışındaki gerçek dersi saklamaz, görünür aralığı genişletir', () => {
    const appointment = rowToAppointment(
      {
        id: 1,
        seriesId: null,
        startsAt: '2026-07-22 23:15',
        endsAt: '2026-07-23 00:15',
        kind: 'solo',
        subjectId: 1,
        subjectName: 'Matematik',
        subjectColor: null,
        teacherId: 1,
        teacherName: 'Ayşe',
        studyGroupId: null,
        studentId: 1,
        title: 'Deniz',
        status: 'planned',
        attendanceTaken: false,
        studentCount: 1,
        presentCount: 0,
        markedCount: 0,
        isMakeup: false,
        cancelReason: null,
      },
      '2026-07-22 10:00',
    )
    expect(
      visibleDayHours(
        calendarSettingsOf(
          settings({ day_start: '08:00', day_end: '22:00' }),
        ),
        [appointment],
      ),
    ).toEqual({ start: 8, end: 24 })
  })
})
