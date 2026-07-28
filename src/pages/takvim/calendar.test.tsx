import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DaySessionRow } from '../../lib/api'
import { ToastProvider } from '../../ui'
import type { CalendarAppointment } from './appointments'
import { wallClockToDate } from './calendarDateAdapter'
import { CalendarPage } from './CalendarPage'

const dx = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  showAppointmentPopup: vi.fn(),
  views: [] as Record<string, unknown>[],
  resources: [] as Record<string, unknown>[],
}))

vi.mock('devextreme/data/array_store', () => ({
  default: class MockArrayStore {
    data: CalendarAppointment[]

    constructor(options: { data: CalendarAppointment[] }) {
      this.data = options.data
    }

    push(
      changes: Array<{
        type: 'insert' | 'update' | 'remove'
        key?: number
        data?: CalendarAppointment
      }>,
    ) {
      const scrollable = document.querySelector<HTMLElement>(
        '.dx-scheduler-date-table-scrollable .dx-scrollable-container',
      )
      if (scrollable !== null) {
        scrollable.scrollTop = 0
        scrollable.scrollLeft = 0
      }
      for (const change of changes) {
        if (change.type === 'insert' && change.data !== undefined) {
          this.data.push(change.data)
        } else if (change.type === 'update' && change.data !== undefined) {
          const index = this.data.findIndex((item) => item.id === change.key)
          if (index >= 0) this.data[index] = change.data
        } else if (change.type === 'remove') {
          this.data = this.data.filter((item) => item.id !== change.key)
        }
      }
    }
  },
}))

vi.mock('devextreme-react/scheduler', () => ({
  default: (props: Record<string, unknown>) => {
    dx.props = props
    const initialized = props.onInitialized as
      | ((event: { component: { showAppointmentPopup: typeof dx.showAppointmentPopup } }) => void)
      | undefined
    initialized?.({
      component: { showAppointmentPopup: dx.showAppointmentPopup },
    })
    const source = props.dataSource as { data: CalendarAppointment[] }
    return (
      <div className="dx-scheduler-work-space" data-testid="scheduler-mock">
        <div className="dx-scheduler-date-table-scrollable">
          <div className="dx-scrollable-container" data-testid="scheduler-scroll">
          {source.data.length === 0 ? String(props.noDataText) : null}
          {source.data.map((item) => (
            <button key={item.id} data-kind={item.kind}>
              {item.text}
            </button>
          ))}
          </div>
        </div>
        {props.children as React.ReactNode}
      </div>
    )
  },
  Resource: (props: Record<string, unknown>) => {
    dx.resources.push(props)
    return null
  },
  View: (props: Record<string, unknown>) => {
    dx.views.push(props)
    return null
  },
}))

vi.mock('devextreme/localization', () => ({
  loadMessages: vi.fn(),
  locale: vi.fn(),
}))

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchSettings: vi.fn(),
  fetchRangeSessions: vi.fn(),
  fetchClosedDaysInRange: vi.fn(),
  fetchHasSchedule: vi.fn(),
  fetchSessionConflicts: vi.fn(),
  rescheduleSession: vi.fn(),
  fetchSubjects: vi.fn(),
  fetchGroupList: vi.fn(),
  fetchStudentList: vi.fn(),
  fetchTeachers: vi.fn(),
  fetchDefaultMinutes: vi.fn(),
  fetchIsClosedDay: vi.fn(),
  saveSession: vi.fn(),
  cancelSession: vi.fn(),
  deleteSessions: vi.fn(),
  fetchTemplatePreview: vi.fn(),
  applyTemplate: vi.fn(),
  fetchAttendanceDetail: vi.fn(),
  saveAttendance: vi.fn(),
  reserveReceiptNo: vi.fn(),
  fetchOpenInstallments: vi.fn(),
  suggestPaymentAllocations: vi.fn(),
  recordPayment: vi.fn(),
  openReceiptPdf: vi.fn(),
}))

vi.mock('../../lib/api', () => api)

const NOW = '2026-07-22 10:00'

function row(
  patch: Partial<DaySessionRow> & { id: number; startsAt: string },
): DaySessionRow {
  return {
    seriesId: null,
    endsAt: `${patch.startsAt.slice(0, 11)}17:00`,
    kind: 'group',
    subjectId: 1,
    subjectName: 'Matematik',
    subjectColor: null,
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
  }
}

const draw = () =>
  render(
    <ToastProvider>
      <CalendarPage />
    </ToastProvider>,
  )

function schedulerProps(): Record<string, unknown> {
  if (dx.props === null) throw new Error('Scheduler çizilmedi')
  return dx.props
}

function firstAppointment(): CalendarAppointment {
  const source = schedulerProps().dataSource as { data: CalendarAppointment[] }
  const item = source.data[0]
  if (item === undefined) throw new Error('Ders bulunamadı')
  return item
}

function appointmentData(): CalendarAppointment[] {
  const source = schedulerProps().dataSource as { data: CalendarAppointment[] }
  return source.data
}

async function updateAppointment(
  start: string,
  end: string,
): Promise<void> {
  const handler = schedulerProps().onAppointmentUpdating as (
    event: Record<string, unknown>,
  ) => void
  await act(async () => {
    handler({
      oldData: firstAppointment(),
      newData: {
        startDate: wallClockToDate(start),
        endDate: wallClockToDate(end),
      },
      cancel: false,
    })
  })
}

beforeEach(() => {
  dx.props = null
  dx.showAppointmentPopup.mockReset()
  dx.views = []
  dx.resources = []
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue(NOW)
  api.fetchSettings.mockResolvedValue([
    { key: 'day_start', value: '08:00' },
    { key: 'day_end', value: '22:00' },
    { key: 'slot_minutes', value: '30' },
    { key: 'default_session_minutes', value: '60' },
  ])
  api.fetchRangeSessions.mockResolvedValue([
    row({ id: 1, startsAt: '2026-07-22 16:00' }),
  ])
  api.fetchClosedDaysInRange.mockResolvedValue([])
  api.fetchHasSchedule.mockResolvedValue(true)
  api.fetchSessionConflicts.mockResolvedValue([])
  api.rescheduleSession.mockResolvedValue({ seriesId: null, moved: 1 })
  api.fetchSubjects.mockResolvedValue([])
  api.fetchGroupList.mockResolvedValue([])
  api.fetchStudentList.mockResolvedValue([])
  api.fetchTeachers.mockResolvedValue([])
  api.fetchDefaultMinutes.mockResolvedValue(60)
  api.fetchIsClosedDay.mockResolvedValue(false)
  api.reserveReceiptNo.mockResolvedValue('2026-1')
  api.fetchOpenInstallments.mockResolvedValue([])
  api.suggestPaymentAllocations.mockResolvedValue([])
  api.fetchTemplatePreview.mockResolvedValue({
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    applyFrom: '2026-07-20',
    slots: [],
  })
})

describe('DevExtreme Scheduler yüzeyi', () => {
  it('günü varsayılan açar ve DevExtreme araç çubuğunu kullanır', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    expect(api.fetchRangeSessions).toHaveBeenCalledWith('2026-07-22', '2026-07-22')
    expect(schedulerProps().currentView).toBe('day')
    expect(schedulerProps().toolbar).toEqual({
      visible: true,
      multiline: true,
      items: ['today', 'dateNavigator', 'viewSwitcher'],
    })
    expect(schedulerProps().editing).toMatchObject({
      allowAdding: true,
      allowDeleting: true,
      allowUpdating: true,
    })
  })

  it('çalışma düzenindeki saat ve hücre ayarlarını uygular', async () => {
    api.fetchSettings.mockResolvedValue([
      { key: 'day_start', value: '07:00' },
      { key: 'day_end', value: '20:00' },
      { key: 'slot_minutes', value: '15' },
      { key: 'default_session_minutes', value: '45' },
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    expect(schedulerProps().startDayHour).toBe(7)
    expect(schedulerProps().endDayHour).toBe(20)
    expect(schedulerProps().cellDuration).toBe(15)
    for (const type of ['week', 'workWeek', 'day']) {
      expect(dx.views.find((item) => item.type === type)).toMatchObject({
        cellDuration: 15,
        startDayHour: 7,
        endDayHour: 20,
      })
    }
  })

  it('üstteki Ders ekle düğmesi DevExtreme formunu açar', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    fireEvent.click(screen.getByRole('button', { name: '＋ Ders ekle' }))
    expect(dx.showAppointmentPopup).toHaveBeenCalledWith(
      {
        startDate: wallClockToDate('2026-07-22 10:00'),
        endDate: wallClockToDate('2026-07-22 11:00'),
      },
      true,
    )
  })

  it('boş hücre ve ders çift tıklamasında DevExtreme formunu açıkça açar', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const cellHandler = schedulerProps().onCellClick as (
      event: Record<string, unknown>,
    ) => void
    const cellStart = wallClockToDate('2026-07-22 14:00')
    const cellEnd = wallClockToDate('2026-07-22 14:30')
    cellHandler({
      cancel: false,
      event: { detail: 2 },
      component: { showAppointmentPopup: dx.showAppointmentPopup },
      cellData: {
        startDate: cellStart,
        endDate: cellEnd,
        groups: { teacherId: 3 },
      },
    })
    expect(dx.showAppointmentPopup).toHaveBeenLastCalledWith(
      {
        startDate: cellStart,
        endDate: cellEnd,
        teacherId: 3,
      },
      true,
    )

    const appointmentHandler = schedulerProps().onAppointmentDblClick as (
      event: Record<string, unknown>,
    ) => void
    const appointment = firstAppointment()
    appointmentHandler({
      cancel: false,
      component: { showAppointmentPopup: dx.showAppointmentPopup },
      appointmentData: appointment,
      targetedAppointmentData: appointment,
    })
    expect(dx.showAppointmentPopup).toHaveBeenLastCalledWith(
      appointment,
      false,
      appointment,
    )
  })

  it('DevExtreme olayı tıklama sayısını taşımadığında da ikinci hücre tıklamasını tanır', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const handler = schedulerProps().onCellClick as (
      event: Record<string, unknown>,
    ) => void
    const cellData = {
      startDate: wallClockToDate('2026-07-22 15:00'),
      endDate: wallClockToDate('2026-07-22 15:30'),
      groups: {},
    }
    const component = { showAppointmentPopup: dx.showAppointmentPopup }
    handler({
      cancel: false,
      event: { detail: 1, timeStamp: 100 },
      component,
      cellData,
    })
    expect(dx.showAppointmentPopup).not.toHaveBeenCalled()
    handler({
      cancel: false,
      event: { detail: 1, timeStamp: 350 },
      component,
      cellData,
    })
    expect(dx.showAppointmentPopup).toHaveBeenCalledWith(
      {
        startDate: cellData.startDate,
        endDate: cellData.endDate,
        teacherId: null,
      },
      true,
    )
  })

  it('ilk açılışta görünümü şimdiye kaydırır ve yeniden çizimde sıçramaz', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const handler = schedulerProps().onContentReady as (event: {
      component: { scrollTo: ReturnType<typeof vi.fn> }
    }) => void
    const scrollTo = vi.fn()
    handler({ component: { scrollTo } })
    handler({ component: { scrollTo } })
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(wallClockToDate(NOW), {
      alignInView: 'center',
    })
  })

  it('branş ve öğretmen filtrelerini birlikte uygular ve birlikte temizler', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00' }),
      row({
        id: 2,
        startsAt: '2026-07-22 18:00',
        endsAt: '2026-07-22 19:00',
        teacherId: 2,
        teacherName: 'Bora Kaya',
      }),
      row({
        id: 3,
        startsAt: '2026-07-23 16:00',
        subjectId: 2,
        subjectName: 'Fizik',
      }),
    ])
    draw()
    await screen.findByText('Fizik · Grup A')
    fireEvent.click(screen.getByRole('button', { name: /Matematik2/ }))
    fireEvent.click(screen.getByRole('button', { name: /Bora Kaya1/ }))
    await waitFor(() =>
      expect(appointmentData().map((item) => item.id)).toEqual([2]),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm filtreleri temizle' }),
    )
    await waitFor(() =>
      expect(appointmentData()).toHaveLength(3),
    )
  })

  it('DevExtreme formuna bütün mevcut ders iş akışlarını bağlar', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const option = vi.fn()
    const handler = schedulerProps().onAppointmentFormOpening as (
      event: Record<string, unknown>,
    ) => void
    handler({
      appointmentData: firstAppointment(),
      form: { option, itemOption: vi.fn(), updateData: vi.fn() },
      popup: { hide: vi.fn(), on: vi.fn() },
    })
    const itemsCall = option.mock.calls.find(([name]) => name === 'items')
    expect(itemsCall?.[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: 'group',
          items: expect.arrayContaining([
            expect.objectContaining({
              buttonOptions: expect.objectContaining({ text: 'Yoklama al' }),
            }),
            expect.objectContaining({
              buttonOptions: expect.objectContaining({ text: 'Tahsilat al' }),
            }),
            expect.objectContaining({
              buttonOptions: expect.objectContaining({ text: 'Ertele' }),
            }),
            expect.objectContaining({
              buttonOptions: expect.objectContaining({ text: 'İptal et' }),
            }),
            expect.objectContaining({
              buttonOptions: expect.objectContaining({ text: 'Arşivle' }),
            }),
          ]),
        }),
      ]),
    )
  })

  it('birebir ders formundan tahsilatı ilgili öğrenci seçili açar', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({
        id: 1,
        startsAt: '2026-07-22 16:00',
        kind: 'solo',
        studyGroupId: null,
        studentId: 7,
        title: 'İpek Şahin',
      }),
    ])
    api.fetchStudentList.mockResolvedValue([
      {
        id: 7,
        fullName: 'İpek Şahin',
        school: null,
        grade: null,
        phone: null,
        isActive: true,
        archived: false,
        guardianName: null,
        guardianPhone: null,
        guardianCount: 0,
        balanceKurus: 0,
        debtKurus: 0,
        oldestDueOn: null,
        remainingLessons: null,
        processedLessons: 0,
        attendedLessons: 0,
        lastSessionDate: null,
        subjectIds: [1],
        groupIds: [],
      },
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    const option = vi.fn()
    const hide = vi.fn()
    const handler = schedulerProps().onAppointmentFormOpening as (
      event: Record<string, unknown>,
    ) => void
    handler({
      appointmentData: firstAppointment(),
      form: { option, itemOption: vi.fn(), updateData: vi.fn() },
      popup: { hide, on: vi.fn() },
    })
    const items = option.mock.calls.find(([name]) => name === 'items')?.[1] as Array<{
      itemType?: string
      items?: Array<{
        buttonOptions?: { text?: string; onClick?: () => void }
      }>
    }>
    const payment = items
      .find((item) => item.itemType === 'group')
      ?.items?.find((item) => item.buttonOptions?.text === 'Tahsilat al')

    await act(async () => payment?.buttonOptions?.onClick?.())

    expect(hide).toHaveBeenCalled()
    await waitFor(() =>
      expect(api.fetchOpenInstallments).toHaveBeenCalledWith(7),
    )
    expect(screen.getByText('Tahsilat al')).toBeTruthy()
  })

  it('yeni ders formuna yüklenen branş ve öğretmen kataloglarını taşır', async () => {
    api.fetchSubjects.mockResolvedValue([
      {
        id: 4,
        name: 'Fizik',
        color: null,
        defaultMin: 75,
        sortOrder: 0,
      },
    ])
    api.fetchTeachers.mockResolvedValue([
      {
        id: 3,
        fullName: 'Bora Kaya',
        color: '#2563eb',
        phone: null,
        email: null,
        isActive: true,
        sortOrder: 0,
      },
    ])
    draw()
    await screen.findByTestId('scheduler-mock')

    const option = vi.fn()
    const handler = schedulerProps().onAppointmentFormOpening as (
      event: Record<string, unknown>,
    ) => void
    handler({
      appointmentData: {
        startDate: wallClockToDate('2026-07-22 14:00'),
        endDate: wallClockToDate('2026-07-22 15:00'),
        teacherId: 3,
      },
      form: { option, itemOption: vi.fn(), updateData: vi.fn() },
      popup: { hide: vi.fn(), on: vi.fn() },
    })

    expect(option).toHaveBeenCalledWith(
      'formData',
      expect.objectContaining({ kind: 'solo', teacherId: 3 }),
    )
    const items = option.mock.calls.find(([name]) => name === 'items')?.[1] as Array<{
      dataField?: string
      editorOptions?: { dataSource?: unknown[]; disabled?: boolean }
    }>
    expect(
      items.find((item) => item.dataField === 'subjectId')?.editorOptions,
    ).toMatchObject({
      dataSource: [expect.objectContaining({ id: 4, name: 'Fizik' })],
      disabled: false,
    })
    expect(
      items.find((item) => item.dataField === 'teacherId')?.editorOptions,
    ).toMatchObject({
      dataSource: [
        expect.objectContaining({ id: 3, fullName: 'Bora Kaya' }),
      ],
      disabled: false,
    })
  })

  it('şablona bağlı taşıma için kapsam sorar', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00', seriesId: 8 }),
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-23 16:30', '2026-07-23 17:30')
    expect(await screen.findByText('Dersi taşı')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sadece bu ders/ })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Bu ve sonraki dersler/ }),
    ).toBeTruthy()
  })

  it('yeniden boyutlandırmayı taşıma olarak adlandırmaz', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00', seriesId: 8 }),
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-22 16:00', '2026-07-22 17:30')
    expect(await screen.findByText('Ders süresini değiştir')).toBeTruthy()
    expect(screen.getByText(/90 dakika/)).toBeTruthy()
  })

  it('üst kenardan yeniden boyutlandırmayı da süre değişikliği sayar', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00', seriesId: 8 }),
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-22 15:30', '2026-07-22 17:00')
    expect(await screen.findByText('Ders süresini değiştir')).toBeTruthy()
    expect(screen.getByText(/90 dakika/)).toBeTruthy()
  })

  it('tek ders taşımasını yazar ve geri aldırır', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const stableBefore = schedulerProps()
    const resourceBefore = dx.resources[dx.resources.length - 1]?.dataSource
    const scrollable = screen.getByTestId('scheduler-scroll')
    scrollable.scrollTop = 420
    scrollable.scrollLeft = 35
    await updateAppointment('2026-07-23 16:30', '2026-07-23 17:30')
    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenCalledWith(
        1,
        '2026-07-23 16:30',
        60,
        'only',
      ),
    )
    await waitFor(() => {
      expect(scrollable.scrollTop).toBe(420)
      expect(scrollable.scrollLeft).toBe(35)
    })
    expect(api.fetchRangeSessions).toHaveBeenCalledTimes(1)
    const stableAfter = schedulerProps()
    for (const option of [
      'currentDate',
      'currentView',
      'appointmentDragging',
      'dateCellRender',
      'dataCellRender',
      'timeCellRender',
      'resourceCellRender',
      'startDayHour',
      'endDayHour',
      'cellDuration',
    ]) {
      expect(stableAfter[option]).toBe(stableBefore[option])
    }
    expect(dx.resources[dx.resources.length - 1]?.dataSource).toBe(resourceBefore)
    expect(
      appointmentData().every(
        (appointment) => !('recurrenceRule' in appointment),
      ),
    ).toBe(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Geri al' }))
    await waitFor(() => expect(api.rescheduleSession).toHaveBeenCalledTimes(2))
    expect(api.fetchRangeSessions).toHaveBeenCalledTimes(1)
  })

  it('aynı görünümde ayar dışı ders taşınınca saat sınırını daraltmaz', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({
        id: 1,
        startsAt: '2026-07-22 01:00',
        endsAt: '2026-07-22 02:00',
        seriesId: null,
      }),
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    expect(schedulerProps().startDayHour).toBe(1)

    await updateAppointment('2026-07-22 10:00', '2026-07-22 11:00')
    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenCalledWith(
        1,
        '2026-07-22 10:00',
        60,
        'only',
      ),
    )
    expect(schedulerProps().startDayHour).toBe(1)
  })

  it('aynı öğretmen çakışmasında açık onay ister', async () => {
    api.fetchSessionConflicts.mockResolvedValue([
      {
        sessionId: 9,
        startsAt: '2026-07-23 16:00',
        endsAt: '2026-07-23 17:00',
        label: 'Fizik · Grup B',
      },
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-23 16:00', '2026-07-23 17:00')
    expect(await screen.findByText('Öğretmen çakışması var')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Yine de taşı' }))
    await waitFor(() => expect(api.rescheduleSession).toHaveBeenCalledTimes(1))
  })

  it('kapalı güne bırakmayı reddeder', async () => {
    api.fetchClosedDaysInRange.mockResolvedValue(['2026-07-23'])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-23 16:00', '2026-07-23 17:00')
    expect(
      await screen.findByText(
        'Bu gün kapalı. Açık bir gün seçip yeniden deneyin.',
      ),
    ).toBeTruthy()
    expect(api.rescheduleSession).not.toHaveBeenCalled()
  })

  it('yoklaması alınmış dersi kilitler', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({
        id: 1,
        startsAt: '2026-07-22 16:00',
        attendanceTaken: true,
      }),
    ])
    draw()
    await screen.findByTestId('scheduler-mock')
    await updateAppointment('2026-07-23 16:00', '2026-07-23 17:00')
    expect(
      await screen.findByText(
        'Yoklaması alınmış ders taşınamaz veya süresi değiştirilemez.',
      ),
    ).toBeTruthy()
    expect(api.fetchSessionConflicts).not.toHaveBeenCalled()
  })
})

describe('boş durumlar', () => {
  it('ay görünümünde boş aralığı ayrı gösterir', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    const handler = schedulerProps().onCurrentViewChange as (view: string) => void
    api.fetchRangeSessions.mockResolvedValue([])
    act(() => handler('month'))
    await screen.findByText('Bu aralıkta ders yok.')
  })

  it('filtre sonucu yoksa iki ekseni temizleyen eylemi gösterir', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00' }),
      row({
        id: 2,
        startsAt: '2026-07-23 16:00',
        subjectId: 2,
        subjectName: 'Fizik',
        teacherId: 2,
        teacherName: 'Bora Kaya',
      }),
    ])
    draw()
    await screen.findByText('Fizik · Grup A')
    fireEvent.click(screen.getByRole('button', { name: /Matematik1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Bora Kaya1/ }))
    expect(await screen.findByText('Bu filtreyle ders yok')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Tüm filtreleri temizle' }),
    ).toBeTruthy()
  })
})
