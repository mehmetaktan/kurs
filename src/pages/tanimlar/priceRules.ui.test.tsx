import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { PriceRulesTab } from './PriceRulesTab'

const api = vi.hoisted(() => ({
  fetchPriceRules: vi.fn(),
  fetchSubjects: vi.fn(),
  fetchLocalNow: vi.fn(),
  savePriceRule: vi.fn(),
  archivePriceRule: vi.fn(),
}))

vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

const RULE = {
  id: 1,
  name: 'Matematik birebir',
  pricingModel: 'per_session',
  subjectId: 1,
  studyGroupId: null,
  isGroup: false,
  unitPrice: 25000,
  lessonCount: null,
  totalPrice: null,
  periodMonths: null,
  defaultInstallments: 1,
  validFrom: '2026-01-01',
  validTo: null,
  deletedAt: null,
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchPriceRules.mockResolvedValue([RULE])
  api.fetchSubjects.mockResolvedValue([{ id: 1, name: 'Matematik', color: null, defaultMin: 60, sortOrder: 0 }])
  api.fetchLocalNow.mockResolvedValue('2026-07-26 18:00')
  api.savePriceRule.mockResolvedValue(2)
  api.archivePriceRule.mockResolvedValue(true)
})

const draw = () => render(<ToastProvider><PriceRulesTab /></ToastProvider>)

describe('Tanımlar → Tarifeler', () => {
  it('mevcut tarife ve geçmişi bozmama uyarısını gösterir', async () => {
    draw()
    expect(await screen.findByText('Matematik birebir')).toBeTruthy()
    expect(screen.getByText(/Geçmiş derslerin ve paketlerin ücreti değişmez/)).toBeTruthy()
    expect(screen.getByText('250,00 ₺')).toBeTruthy()
  })

  it('fiyat değişikliğini eski id ve kuruş tutarıyla gönderir', async () => {
    draw()
    await screen.findByText('Matematik birebir')
    fireEvent.click(screen.getByRole('button', { name: 'Yeni fiyat' }))
    fireEvent.change(screen.getByLabelText('Birim ücret (TL)'), { target: { value: '300,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(api.savePriceRule).toHaveBeenCalledWith(expect.objectContaining({
      replacesId: 1,
      unitPrice: 30000,
      validFrom: '2026-07-26',
    })))
  })

  it('arşivleme öncesinde onay ister', async () => {
    draw()
    await screen.findByText('Matematik birebir')
    fireEvent.click(screen.getByRole('button', { name: 'Arşivle' }))
    expect(screen.getByText('Tarife arşivlensin mi?')).toBeTruthy()
    expect(api.archivePriceRule).not.toHaveBeenCalled()
  })
})
