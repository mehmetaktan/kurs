import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { PaymentModal } from './PaymentModal'

const api = vi.hoisted(() => ({
  fetchStudentList: vi.fn(),
  reserveReceiptNo: vi.fn(),
  fetchLocalNow: vi.fn(),
  fetchOpenInstallments: vi.fn(),
  suggestPaymentAllocations: vi.fn(),
  recordPayment: vi.fn(),
  openReceiptPdf: vi.fn(),
}))

vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

const student = {
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
  balanceKurus: -200_000,
  debtKurus: 200_000,
  oldestDueOn: '2026-03-01',
  remainingLessons: 8,
  processedLessons: 0,
  attendedLessons: 0,
  lastSessionDate: null,
  subjectIds: [],
  groupIds: [],
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchStudentList.mockResolvedValue([student])
  api.reserveReceiptNo.mockResolvedValue('2026-14')
  api.fetchLocalNow.mockResolvedValue('2026-04-01 10:00')
  api.fetchOpenInstallments.mockResolvedValue([
    { id: 1, studentId: 7, packageId: 2, seq: 1, dueOn: '2026-03-01', label: '1. taksit', openKurus: 100_000 },
    { id: 2, studentId: 7, packageId: 2, seq: 2, dueOn: '2026-04-01', label: '2. taksit', openKurus: 100_000 },
  ])
  api.suggestPaymentAllocations.mockImplementation((_studentId: number, amount: number) =>
    Promise.resolve(amount >= 250_000
      ? [{ installmentId: 1, amount: 100_000 }, { installmentId: 2, amount: 100_000 }]
      : []),
  )
  api.recordPayment.mockResolvedValue({ paymentId: 9, ledgerEntryId: 10, allocatedKurus: 200_000, advanceKurus: 50_000 })
  api.openReceiptPdf.mockResolvedValue('/data/receipts/makbuz-9.pdf')
})

const draw = () => render(
  <ToastProvider>
    <PaymentModal open initialStudentId={7} onClose={vi.fn()} />
  </ToastProvider>,
)

describe('tahsilat modalı', () => {
  it('açılırken makbuz numarası ayırır ve bütün açık taksitleri gösterir', async () => {
    draw()
    expect(await screen.findByDisplayValue('2026-14')).toBeTruthy()
    expect(api.reserveReceiptNo).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('1. taksit')).toBeTruthy()
    expect(screen.getByText('2. taksit')).toBeTruthy()
  })

  it('fazla ödemeyi avans diye gösterir ve çift tıkta bir kez kaydeder', async () => {
    draw()
    await screen.findByDisplayValue('2026-14')
    fireEvent.change(screen.getByLabelText('Tutar'), { target: { value: '2.500,00' } })
    expect(await screen.findByText('500,00 ₺')).toBeTruthy()

    const save = screen.getByRole('button', { name: 'Tahsilatı kaydet' })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(api.recordPayment).toHaveBeenCalledTimes(1))
    expect(api.recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 7,
      amount: 250_000,
      receiptNo: '2026-14',
      allocations: [
        { installmentId: 1, amount: 100_000 },
        { installmentId: 2, amount: 100_000 },
      ],
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Makbuzu aç / yazdır' }))
    await waitFor(() => expect(api.openReceiptPdf).toHaveBeenCalledWith(9))
  })
})
