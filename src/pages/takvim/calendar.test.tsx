import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DaySessionRow } from '../../lib/api'
import { ToastProvider } from '../../ui'
import type { CalendarAppointment } from './appointments'
import { wallClockToDate } from './calendarDateAdapter'
import { CalendarPage } from './CalendarPage'

const dx = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('devextreme-react/scheduler', () => ({
  default: (props: Record<string, unknown>) => {
    dx.props = props
    const source = props.dataSource as {
      store: { data: CalendarAppointment[] }
    }
    const click = props.onAppointmentClick as
      | ((event: Record<string, unknown>) => void)
      | undefined
    return (
      <div data-testid="scheduler-mock">
        {source.store.data.map((item) => (
          <button
            key={item.id}
            data-kind={item.kind}
            onClick={() =>
              click?.({
                cancel: false,
                appointmentData: item,
              })
            }
          >
            {item.text}
          </button>
        ))}
      </div>
    )
  },
  Resource: () => null,
  View: () => null,
}))

vi.mock('devextreme/localization', () => ({
  loadMessages: vi.fn(),
  locale: vi.fn(),
}))

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
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
  const source = schedulerProps().dataSource as {
    store: { data: CalendarAppointment[] }
  }
  const item = source.store.data[0]
  if (item === undefined) throw new Error('Ders bulunamadı')
  return item
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
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue(NOW)
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
  api.fetchTemplatePreview.mockResolvedValue({
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    applyFrom: '2026-07-20',
    slots: [],
  })
})

describe('DevExtreme Scheduler yüzeyi', () => {
  it('haftayı varsayılan açar ve beş Türkçe görünümü sunar', async () => {
    draw()
    await screen.findByTestId('scheduler-mock')
    expect(api.fetchRangeSessions).toHaveBeenCalledWith('2026-07-20', '2026-07-26')
    for (const label of ['Hafta', 'Çalışma haftası', 'Gün', 'Ay', 'Ajanda']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.queryByText(/Today|Week|Month|Agenda/)).toBeNull()
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
      expect(screen.getAllByText('Matematik · Grup A')).toHaveLength(1),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Tüm filtreleri temizle' }),
    )
    await waitFor(() =>
      expect(screen.getAllByText(/Matematik · Grup A|Fizik · Grup A/)).toHaveLength(3),
    )
  })

  it('tek tıklamada ayrıntıyı açar ve bütün mevcut iş akışlarını bağlar', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Matematik · Grup A' }))
    await screen.findByText('Ders ayrıntısı')
    for (const label of [
      'Düzenle',
      'Yoklama al',
      'Ertele',
      'İptal et',
      'Arşivle',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
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
    await updateAppointment('2026-07-23 16:30', '2026-07-23 17:30')
    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenCalledWith(
        1,
        '2026-07-23 16:30',
        60,
        'only',
      ),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Geri al' }))
    await waitFor(() => expect(api.rescheduleSession).toHaveBeenCalledTimes(2))
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
    api.fetchRangeSessions.mockResolvedValue([])
    draw()
    await screen.findByText('Bu aralıkta ders yok.')
    fireEvent.click(screen.getByRole('button', { name: 'Ay' }))
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
