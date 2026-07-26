import { describe, expect, it } from 'vitest'
import { buildPriceRuleInput, priceRuleState, type PriceRuleDraft } from './priceRules'

const draft: PriceRuleDraft = {
  replacesId: null,
  name: '8 derslik paket',
  pricingModel: 'package',
  subjectId: '2',
  lessonKind: 'solo',
  unitPrice: '250,00',
  lessonCount: '8',
  totalPrice: '1.900,00',
  periodMonths: '',
  defaultInstallments: '2',
  validFrom: '2026-08-01',
}

describe('tarife formu para dönüşümü', () => {
  it('bütün tutarları kuruş cinsinden tam sayıya çevirir', () => {
    const result = buildPriceRuleInput(draft)
    expect(result).toEqual({
      ok: true,
      input: expect.objectContaining({ unitPrice: 25000, totalPrice: 190000 }),
    })
  })

  it('bozuk para metnini sessizce sıfıra çevirmez', () => {
    const result = buildPriceRuleInput({ ...draft, unitPrice: '1.2,3.4' })
    expect(result).toEqual({
      ok: false,
      field: 'unitPrice',
      code: 'money',
    })
  })

  it('pakette ders sayısı ve toplam tutarı zorunlu tutar', () => {
    const result = buildPriceRuleInput({ ...draft, lessonCount: '', totalPrice: '' })
    expect(result).toEqual(expect.objectContaining({ ok: false, field: 'lessonCount' }))
  })
})

describe('tarifenin geçerlilik durumu', () => {
  const rule = {
    id: 1,
    name: 'Tarife',
    pricingModel: 'per_session' as const,
    subjectId: null,
    studyGroupId: null,
    isGroup: null,
    unitPrice: 10000,
    lessonCount: null,
    totalPrice: null,
    periodMonths: null,
    defaultInstallments: 1,
    validFrom: '2026-01-01',
    validTo: null,
    deletedAt: null,
  }

  it('bugünü tek kaynaktan verilen tarihle sınıflandırır', () => {
    expect(priceRuleState(rule, '2026-07-26')).toBe('current')
    expect(priceRuleState({ ...rule, validFrom: '2026-08-01' }, '2026-07-26')).toBe('future')
    expect(priceRuleState({ ...rule, validTo: '2026-07-25' }, '2026-07-26')).toBe('past')
    expect(priceRuleState({ ...rule, deletedAt: '2026-07-20' }, '2026-07-26')).toBe('archived')
  })
})
