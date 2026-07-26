import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { PackageSaleModal } from './PackageSaleModal'

const api = vi.hoisted(() => ({
  fetchPriceRules: vi.fn(),
  fetchLocalNow: vi.fn(),
  sellPackage: vi.fn(),
}))

vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue('2026-03-01 10:00')
  api.fetchPriceRules.mockResolvedValue([
    {
      id: 3,
      name: '8 derslik paket',
      pricingModel: 'package',
      subjectId: 1,
      studyGroupId: null,
      isGroup: false,
      unitPrice: 25000,
      lessonCount: 8,
      totalPrice: 200000,
      periodMonths: null,
      defaultInstallments: 2,
      validFrom: '2026-01-01',
      validTo: null,
      deletedAt: null,
    },
  ])
  api.sellPackage.mockResolvedValue(10)
})

const draw = (onSaved = vi.fn()) =>
  render(
    <ToastProvider>
      <PackageSaleModal
        open
        studentId={7}
        studentName="Elif Yılmaz"
        balanceKurus={-50000}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </ToastProvider>,
  )

describe('paket satış modalı', () => {
  it('bakiye ve ders hakkının ayrı olduğunu, satış özetini gösterir', async () => {
    draw()
    await screen.findByRole('option', { name: '8 derslik paket' })
    fireEvent.change(screen.getByLabelText('Tarife'), { target: { value: '3' } })

    expect(screen.getByText('−500,00 ₺')).toBeTruthy()
    expect(screen.getByText(/Ders hakkı ve bakiye ayrı sayaçlardır/)).toBeTruthy()
    expect(screen.getByText(/8 ders · 2\.000,00 ₺ · 2 taksit/)).toBeTruthy()
  })

  it('peşini de zorunlu tek taksit planıyla kuruş olarak kaydeder', async () => {
    const onSaved = vi.fn()
    draw(onSaved)
    await screen.findByRole('option', { name: '8 derslik paket' })
    fireEvent.change(screen.getByLabelText('Tarife'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Taksit sayısı'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() =>
      expect(api.sellPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 7,
          lessonCount: 8,
          unitPrice: 25000,
          totalPrice: 200000,
          installments: [{ dueOn: '2026-03-01', amount: 200000, label: null }],
        }),
      ),
    )
    expect(onSaved).toHaveBeenCalled()
  })
})
