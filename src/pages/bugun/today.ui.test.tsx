import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayPage } from './TodayPage'

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchDaySessions: vi.fn(),
  fetchHasSchedule: vi.fn(),
  fetchDebtorRows: vi.fn(),
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
})
