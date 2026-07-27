import { describe, expect, it, vi } from 'vitest'
import type { AppointmentFormOpeningEvent } from 'devextreme/ui/scheduler'
import { wallClockToDate } from './calendarDateAdapter'
import {
  configureNativeAppointmentForm,
  nativeDraftToSessionInput,
  type CalendarCatalogs,
} from './nativeAppointmentForm'

const catalogs: CalendarCatalogs = {
  subjects: [
    { id: 1, name: 'Matematik', color: null, defaultMin: 90, sortOrder: 0 },
  ],
  groups: [],
  students: [],
  teachers: [],
}

describe('DevExtreme ders formu adaptörü', () => {
  it('yeni dersi mevcut SessionInput sözleşmesine çevirir', () => {
    expect(
      nativeDraftToSessionInput({
        startDate: wallClockToDate('2026-07-22 16:15'),
        endDate: wallClockToDate('2026-07-22 17:45'),
        kind: 'solo',
        subjectId: 1,
        teacherId: 2,
        studyGroupId: null,
        studentId: 7,
      }),
    ).toEqual({
      id: null,
      subjectId: 1,
      teacherId: 2,
      studyGroupId: null,
      studentId: 7,
      day: '2026-07-22',
      startTime: '16:15',
      durationMin: 90,
    })
  })

  it('branş varsayılan süresini DevExtreme formuna uygular', () => {
    const option = vi.fn()
    const updateData = vi.fn()
    const formData = {
      startDate: wallClockToDate('2026-07-22 16:00'),
    }
    option.mockImplementation((name: string) =>
      name === 'formData' ? formData : undefined,
    )
    configureNativeAppointmentForm(
      {
        appointmentData: {
          startDate: formData.startDate,
          endDate: wallClockToDate('2026-07-22 17:00'),
        },
        form: { option, updateData, itemOption: vi.fn() },
        popup: { hide: vi.fn() },
      } as unknown as AppointmentFormOpeningEvent,
      catalogs,
      {
        dayStart: '08:00',
        dayEnd: '22:00',
        slotMinutes: 15,
        defaultSessionMinutes: 60,
      },
      '2026-07-22 10:00',
      {
        onAttendance: vi.fn(),
        onReschedule: vi.fn(),
        onCancel: vi.fn(),
        onArchive: vi.fn(),
      },
    )
    const items = option.mock.calls.find(([name]) => name === 'items')?.[1] as Array<{
      dataField?: string
      editorOptions?: { onValueChanged?: (event: { value: number }) => void }
    }>
    const subject = items.find((item) => item.dataField === 'subjectId')
    subject?.editorOptions?.onValueChanged?.({ value: 1 })
    expect(updateData).toHaveBeenCalledWith(
      'endDate',
      wallClockToDate('2026-07-22 17:30'),
    )
  })

  it('takvim formunda tekrar alanı açmaz ve ders türü alanlarını değiştirir', () => {
    const option = vi.fn()
    const updateData = vi.fn()
    const itemOption = vi.fn()
    configureNativeAppointmentForm(
      {
        appointmentData: {
          startDate: wallClockToDate('2026-07-22 16:00'),
          endDate: wallClockToDate('2026-07-22 17:00'),
        },
        form: { option, updateData, itemOption },
        popup: { hide: vi.fn() },
      } as unknown as AppointmentFormOpeningEvent,
      catalogs,
      {
        dayStart: '08:00',
        dayEnd: '22:00',
        slotMinutes: 30,
        defaultSessionMinutes: 60,
      },
      '2026-07-22 10:00',
      {
        onAttendance: vi.fn(),
        onReschedule: vi.fn(),
        onCancel: vi.fn(),
        onArchive: vi.fn(),
      },
    )
    const items = option.mock.calls.find(([name]) => name === 'items')?.[1] as Array<{
      dataField?: string
      editorOptions?: {
        onValueChanged?: (event: { value: 'group' | 'solo' }) => void
      }
    }>
    expect(items.some((item) => item.dataField === 'repeat')).toBe(false)
    expect(items.some((item) => item.dataField?.startsWith('weekly'))).toBe(
      false,
    )

    items
      .find((item) => item.dataField === 'kind')
      ?.editorOptions?.onValueChanged?.({ value: 'group' })
    expect(itemOption).toHaveBeenCalledWith('studyGroupId', 'visible', true)
    expect(itemOption).toHaveBeenCalledWith('studentId', 'visible', false)
    expect(updateData).not.toHaveBeenCalled()
  })
})
