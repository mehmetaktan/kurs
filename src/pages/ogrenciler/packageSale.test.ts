import { describe, expect, it } from 'vitest'
import { buildPackageSaleInput, packageDiscountKurus, splitInstallments } from './packageSale'

describe('paket satışının kuruş aritmetiği', () => {
  it('bölünemeyen toplamda tek kuruş kaybetmeden ilk taksitlere dağıtır', () => {
    const plan = splitInstallments(100_001, 3, '2026-01-31')
    expect(plan.map((item) => item.amount)).toEqual([33_334, 33_334, 33_333])
    expect(plan.map((item) => item.dueOn)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(plan.reduce((sum, item) => sum + item.amount, 0)).toBe(100_001)
  })

  it('indirim tutarını float kullanmadan kuruş olarak bulur', () => {
    expect(packageDiscountKurus(25_000, 8, 190_000)).toBe(10_000)
    expect(packageDiscountKurus(25_000, 8, 210_000)).toBe(0)
  })

  it('peşin satışı satış gününe tek taksit planı olarak üretir', () => {
    expect(splitInstallments(200_000, 1, '2026-03-01')).toEqual([
      { dueOn: '2026-03-01', amount: 200_000, label: null },
    ])
  })

  it('taksit toplamı paket toplamına eşit değilse kaydı reddeder', () => {
    const result = buildPackageSaleInput(7, {
      priceRuleId: 3,
      lessonCount: '8',
      unitPrice: '250,00',
      totalPrice: '2.000,00',
      soldOn: '2026-03-01',
      installments: [{ dueOn: '2026-03-01', amount: 199_999, label: null }],
    })
    expect(result).toEqual({ ok: false, field: 'installments' })
  })
})
