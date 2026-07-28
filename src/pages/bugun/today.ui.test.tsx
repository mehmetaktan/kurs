import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayPage } from './TodayPage'

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchDashboardSessions: vi.fn(),
  fetchDashboardStudentIds: vi.fn(),
  fetchBackupStatus: vi.fn(),
  fetchHasSchedule: vi.fn(),
  fetchDebtorRows: vi.fn(),
  fetchMakeupDebts: vi.fn(),
  fetchUpcomingPayments: vi.fn(),
  fetchReportOverview: vi.fn(),
  fetchStudentList: vi.fn(),
  createBackupNow: vi.fn(),
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
  api.fetchDashboardSessions.mockResolvedValue([])
  api.fetchDashboardStudentIds.mockResolvedValue([4, 8, 9])
  api.fetchHasSchedule.mockResolvedValue(true)
  api.fetchDebtorRows.mockResolvedValue([
    { studentId: 4, fullName: 'İpek Şahin', guardianPhone: null, archived: false, debtKurus: 120_000, advanceKurus: 0, oldestDueOn: '2026-07-14', daysOverdue: 12 },
    { studentId: 5, fullName: 'Arşiv Borçlu', guardianPhone: null, archived: true, debtKurus: 80_000, advanceKurus: 0, oldestDueOn: '2026-07-10', daysOverdue: 16 },
  ])
  api.fetchMakeupDebts.mockResolvedValue([
    {
      attendanceId: 20,
      studentId: 8,
      fullName: 'Zeynep Kaya',
      subjectId: 1,
      subjectName: 'Matematik',
      teacherId: 2,
      sourceStartsAt: '2026-07-26 08:00',
      makeupSessionId: null,
      pendingCount: 1,
    },
  ])
  api.fetchUpcomingPayments.mockResolvedValue([])
  api.fetchReportOverview.mockResolvedValue({
    month: '2026-07',
    collectedKurus: 300_000,
    collectionCount: 2,
    processedSessionCount: 12,
    attendancePresentCount: 8,
    attendanceEligibleCount: 10,
    attendancePercentage: 80,
    activeStudentCount: 2,
    totalReceivableKurus: 120_000,
    debtorCount: 1,
    ledgerEntryCount: 8,
  })
  api.fetchStudentList.mockResolvedValue([
    {
      id: 9,
      fullName: 'Çınar Ak',
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
      remainingLessons: 2,
      processedLessons: 0,
      attendedLessons: 0,
      lastSessionDate: null,
      subjectIds: [],
      groupIds: [],
    },
  ])
  api.fetchBackupStatus.mockResolvedValue({
    directory: 'C:\\Users\\Ayşe\\Documents\\Kurs Takip\\Yedekler',
    warnDays: 3,
    logs: [
      {
        id: 1,
        takenAt: '2026-07-25 08:14',
        filePath: 'yedek.db',
        sizeBytes: 1000,
        isAuto: true,
        ok: true,
        error: null,
        createdAt: null,
        updatedAt: null,
        deletedAt: null,
      },
    ],
  })
  api.createBackupNow.mockResolvedValue('yedek.db')
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
    expect(screen.getAllByText('1.200,00 ₺')).toHaveLength(2)
    expect(screen.getByText('12 gün gecikti')).toBeTruthy()
    expect(screen.getAllByText(/1 öğrenci/)).toHaveLength(2)
    expect(screen.queryByText('Arşiv Borçlu')).toBeNull()
    expect(api.fetchDebtorRows).toHaveBeenCalledWith({ search: null, filter: 'all', today: '2026-07-26' })
  })

  it('bekleyen telafiyi planlama eylemiyle gösterir', async () => {
    render(<TodayPage />)

    expect(await screen.findByText('Zeynep Kaya')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Telafi planla' })).toBeTruthy()
    expect(screen.getByText('1 telafi')).toBeTruthy()
  })

  it('beş özet kartını ve biten paket listesini gösterip ilgili ekrana gider', async () => {
    window.location.hash = ''
    render(<TodayPage />)

    expect(await screen.findByText('3.000,00 ₺')).toBeTruthy()
    expect(screen.getByText('Çınar Ak')).toBeTruthy()
    expect(screen.getByText('2 ders kaldı')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bekleyen telafi · ilgili ekranı aç' })).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Akıştaki öğrencilerin borcu · ilgili ekranı aç' }),
    )
    expect(window.location.hash).toBe('#/odemeler')
  })
})

describe('Bugün yoklama girişi', () => {
  it('bitmiş dersin Yoklama al düğmesi E9 panelini açar', async () => {
    api.fetchDashboardSessions.mockResolvedValue([
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
