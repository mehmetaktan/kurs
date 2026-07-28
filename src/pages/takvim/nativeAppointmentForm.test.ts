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

const interactiveCatalogs: CalendarCatalogs = {
  ...catalogs,
  groups: [
    {
      id: 8,
      name: 'Grup A',
      subjectId: 1,
      subjectName: 'Matematik',
      subjectColor: null,
      teacherId: 2,
      teacherName: 'Ayşe Demir',
      capacity: 8,
      memberCount: 3,
      weekly: [],
      isActive: true,
      archived: false,
      startsOn: '2026-07-01',
      endsOn: null,
      nextSessionAt: null,
    },
  ],
  teachers: [
    {
      id: 2,
      fullName: 'Ayşe Demir',
      color: '#2563eb',
      phone: null,
      email: null,
      isActive: true,
      sortOrder: 0,
    },
  ],
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
        onPayment: vi.fn(),
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
    const editorOption = vi.fn()
    configureNativeAppointmentForm(
      {
        appointmentData: {
          startDate: wallClockToDate('2026-07-22 16:00'),
          endDate: wallClockToDate('2026-07-22 17:00'),
        },
        form: {
          option,
          updateData,
          itemOption,
          getEditor: vi.fn(() => ({ option: editorOption })),
        },
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
        onPayment: vi.fn(),
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
    expect(updateData).toHaveBeenCalledWith('studentId', null)
    expect(editorOption).toHaveBeenCalledWith('disabled', false)
  })

  it('yeni dersi birebir açar, hücrenin öğretmenini korur ve grup seçimini yansıtır', () => {
    let formData: Record<string, unknown> = {}
    const option = vi.fn((name: string, value?: unknown) => {
      if (name !== 'formData') return undefined
      if (value !== undefined) formData = value as Record<string, unknown>
      return formData
    })
    const updateData = vi.fn((name: string, value: unknown) => {
      formData[name] = value
    })
    const itemOption = vi.fn()
    const subjectEditorOption = vi.fn()
    const teacherEditorOption = vi.fn()
    const getEditor = vi.fn((name: string) => ({
      option:
        name === 'subjectId' ? subjectEditorOption : teacherEditorOption,
    }))

    configureNativeAppointmentForm(
      {
        appointmentData: {
          startDate: wallClockToDate('2026-07-22 16:00'),
          endDate: wallClockToDate('2026-07-22 17:00'),
          teacherId: 2,
        },
        form: { option, updateData, itemOption, getEditor },
        popup: { hide: vi.fn() },
      } as unknown as AppointmentFormOpeningEvent,
      interactiveCatalogs,
      {
        dayStart: '08:00',
        dayEnd: '22:00',
        slotMinutes: 30,
        defaultSessionMinutes: 60,
      },
      '2026-07-22 10:00',
      {
        onAttendance: vi.fn(),
        onPayment: vi.fn(),
        onReschedule: vi.fn(),
        onCancel: vi.fn(),
        onArchive: vi.fn(),
      },
    )

    expect(formData).toMatchObject({
      kind: 'solo',
      teacherId: 2,
      studyGroupId: null,
    })
    const items = option.mock.calls.find(([name]) => name === 'items')?.[1] as Array<{
      dataField?: string
      editorOptions?: {
        disabled?: boolean
        dataSource?: unknown[]
        onValueChanged?: (event: { value: unknown }) => void
      }
    }>
    const subject = items.find((item) => item.dataField === 'subjectId')
    const teacher = items.find((item) => item.dataField === 'teacherId')
    expect(subject?.editorOptions).toMatchObject({
      disabled: false,
      dataSource: interactiveCatalogs.subjects,
    })
    expect(teacher?.editorOptions).toMatchObject({
      disabled: false,
      dataSource: interactiveCatalogs.teachers,
    })

    items
      .find((item) => item.dataField === 'kind')
      ?.editorOptions?.onValueChanged?.({ value: 'group' })
    items
      .find((item) => item.dataField === 'studyGroupId')
      ?.editorOptions?.onValueChanged?.({ value: 8 })

    expect(updateData).toHaveBeenCalledWith('subjectId', 1)
    expect(updateData).toHaveBeenCalledWith('teacherId', 2)
    expect(subjectEditorOption).toHaveBeenLastCalledWith('disabled', true)
    expect(teacherEditorOption).toHaveBeenLastCalledWith('disabled', true)
  })
})
