import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayPage } from './TodayPage'

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchDaySessions: vi.fn(),
  fetchHasSchedule: vi.fn(),
  fetchDebtorRows: vi.fn(),
  fetchMakeupDebts: vi.fn(),
  fetchAttendanceDetail: vi.fn(),
  saveAttendance: vi.fn(),
}))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))
vi.mock('../dersler/SessionForm', () => ({ SessionForm: () => null }))
vi.mock('../dersler/SessionActions', () => ({ SessionActions: () => null }))
vi.mock('../dersler/TemplateModal', () => ({ TemplateModal: () => null }))

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue('2026-07-26 10:00')
  api.fetchDaySessions.mockResolvedValue([])
  api.fetchHasSchedule.mockResolvedValue(true)
  api.fetchDebtorRows.mockResolvedValue([
    { studentId: 4, fullName: 'İpek Şahin', guardianPhone: null, archived: false, debtKurus: 120_000, advanceKurus: 0, oldestDueOn: '2026-07-14', daysOverdue: 12 },
    { studentId: 5, fullName: 'Arşiv Borçlu', guardianPhone: null, archived: true, debtKurus: 80_000, advanceKurus: 0, oldestDueOn: '2026-07-10', daysOverdue: 16 },
  ])
  api.fetchMakeupDebts.mockResolvedValue([
    { studentId: 8, fullName: 'Zeynep Kaya', pendingCount: 2 },
  ])
  api.fetchAttendanceDetail.mockResolvedValue({
    sessionId: 12,
    title: 'Grup A',
    subjectName: 'Matematik',
    startsAt: '2026-07-26 08:00',
    endsAt: '2026-07-26 09:00',
    kind: 'group',
    rows: [],
    policy: { excusedConsumesLesson: false, unexcusedConsumesLesson: true },
  })
  api.saveAttendance.mockResolvedValue({ saved: 0 })
})

describe('Bugün borç özeti', () => {
  it('canlı borçluyu defter verisinden gösterir, arşivliyi dışarıda bırakır', async () => {
    render(<TodayPage />)
    expect(await screen.findByText('İpek Şahin')).toBeTruthy()
    expect(screen.getByText('1.200,00 ₺')).toBeTruthy()
    expect(screen.getByText('12 gün gecikti')).toBeTruthy()
    expect(screen.getByText(/1 öğrenci/)).toBeTruthy()
    expect(screen.queryByText('Arşiv Borçlu')).toBeNull()
    expect(api.fetchDebtorRows).toHaveBeenCalledWith({ search: null, filter: 'all', today: '2026-07-26' })
  })

  it('bekleyen telafi borcunu öğrenci başına sayısıyla gösterir', async () => {
    render(<TodayPage />)

    expect(await screen.findByText('Zeynep Kaya')).toBeTruthy()
    expect(screen.getByText('2 bekliyor')).toBeTruthy()
    expect(screen.getByText('2 telafi')).toBeTruthy()
  })
})

describe('Bugün yoklama girişi', () => {
  it('bitmiş dersin Yoklama al düğmesi E9 panelini açar', async () => {
    api.fetchDaySessions.mockResolvedValue([
      {
        id: 12,
        seriesId: null,
        startsAt: '2026-07-26 08:00',
        endsAt: '2026-07-26 09:00',
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
        studentCount: 0,
        presentCount: 0,
        markedCount: 0,
        isMakeup: false,
        cancelReason: null,
      },
    ])

    render(<TodayPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Yoklama al' }))

    expect(await screen.findByRole('dialog', { name: 'Matematik · Grup A' })).toBeTruthy()
    expect(api.fetchAttendanceDetail).toHaveBeenCalledWith(12, '2026-07-26')
  })
})
