import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { PaymentsPage } from './PaymentsPage'

const api = vi.hoisted(() => ({ fetchLocalNow: vi.fn(), fetchDebtorRows: vi.fn() }))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))
vi.mock('./PaymentModal', () => ({
  PaymentModal: ({ open, initialStudentId }: { open: boolean; initialStudentId: number | null }) =>
    open ? <div data-testid="payment-modal">{initialStudentId ?? 'seçimsiz'}</div> : null,
}))

beforeEach(() => {
  api.fetchLocalNow.mockReset().mockResolvedValue('2026-03-20 10:00')
  api.fetchDebtorRows.mockReset().mockResolvedValue([
    { studentId: 4, fullName: 'İpek Şahin', guardianPhone: '0532 111 22 33', archived: true, debtKurus: 60_000, advanceKurus: 0, oldestDueOn: '2026-03-02', daysOverdue: 18 },
    { studentId: 5, fullName: 'Ahmet Kaya', guardianPhone: null, archived: false, debtKurus: 25_000, advanceKurus: 0, oldestDueOn: '2026-03-10', daysOverdue: 10 },
  ])
})

describe('Ödemeler borçlu listesi', () => {
  it('arşivliyi gösterir, görünen toplamı yazar ve satırdan tahsilat açar', async () => {
    render(<ToastProvider><PaymentsPage /></ToastProvider>)
    expect(await screen.findByText('İpek Şahin')).toBeTruthy()
    expect(screen.getByText('Arşivlendi')).toBeTruthy()
    expect(screen.getByText('850,00 ₺')).toBeTruthy()

    const actions = screen.getAllByRole('button', { name: 'Tahsilat al' })
    fireEvent.click(actions[1]!)
    expect(screen.getByTestId('payment-modal').textContent).toBe('4')
  })

  it('gecikmiş çipini Rust sorgusuna gönderir', async () => {
    render(<ToastProvider><PaymentsPage /></ToastProvider>)
    await screen.findByText('İpek Şahin')
    fireEvent.click(screen.getByRole('button', { name: 'Gecikmiş' }))
    await vi.waitFor(() => expect(api.fetchDebtorRows).toHaveBeenLastCalledWith({
      search: '', filter: 'overdue', today: '2026-03-20',
    }))
  })
})
