import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { StatementPanel } from './StatementPanel'

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(), fetchStatementRows: vi.fn(), exportStatementCsv: vi.fn(), cancelPayment: vi.fn(),
}))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))
vi.mock('./PaymentModal', () => ({ PaymentModal: () => null }))

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue('2026-03-20 10:00')
  api.fetchStatementRows.mockResolvedValue([
    { entryId: 1, entryDate: '2026-03-01', kind: 'installment_charge', memo: 'Mart taksiti', debitKurus: 100_000, creditKurus: 0, balanceKurus: -100_000, paymentId: null, paymentCancelled: false },
    { entryId: 2, entryDate: '2026-03-05', kind: 'payment', memo: 'Tahsilat', debitKurus: 0, creditKurus: 40_000, balanceKurus: -60_000, paymentId: 9, paymentCancelled: false },
  ])
  api.exportStatementCsv.mockResolvedValue('/data/exports/cari-ekstre.csv')
  api.cancelPayment.mockResolvedValue(3)
})

const draw = () => render(<ToastProvider><StatementPanel studentId={7} /></ToastProvider>)

describe('cari ekstre', () => {
  it('borç, alacak ve yürüyen bakiyeyi gösterip BOM CSV komutunu çağırır', async () => {
    draw()
    expect(await screen.findByText('Mart taksiti')).toBeTruthy()
    expect(screen.getByText('1.000,00 ₺')).toBeTruthy()
    expect(screen.getByText('−600,00 ₺')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'CSV dışa aktar' }))
    await vi.waitFor(() => expect(api.exportStatementCsv).toHaveBeenCalledWith({ studentId: 7, from: null, to: null }))
    expect(await screen.findByText('Cari ekstre Dışa Aktarımlar klasörüne kaydedildi.')).toBeTruthy()
  })

  it('tahsilatı yalnızca onaydan sonra ters kaydeder', async () => {
    draw()
    await screen.findByText('Mart taksiti')
    fireEvent.click(screen.getByRole('button', { name: 'İptal et' }))
    expect(api.cancelPayment).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^Tahsilatı iptal et/ }))
    await vi.waitFor(() => expect(api.cancelPayment).toHaveBeenCalledWith(9))
  })
})
