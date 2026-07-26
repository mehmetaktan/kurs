import type { PriceRule, PriceRuleInput, PricingModel } from '../../lib/api'
import { parseKurus } from '../../lib/format'

export interface PriceRuleDraft {
  replacesId: number | null
  name: string
  pricingModel: PricingModel
  subjectId: string
  lessonKind: '' | 'solo' | 'group'
  unitPrice: string
  lessonCount: string
  totalPrice: string
  periodMonths: string
  defaultInstallments: string
  validFrom: string | null
}

export type DraftResult =
  | { ok: true; input: PriceRuleInput }
  | { ok: false; field: keyof PriceRuleDraft; code: 'required' | 'money' | 'integer' | 'package' | 'installments' | 'date' }

/** Formdaki para metinlerini yalnızca kuruşa çevirir; float üretmez (ADR-003). */
export function buildPriceRuleInput(draft: PriceRuleDraft): DraftResult {
  if (!draft.name.trim()) {
    return { ok: false, field: 'name', code: 'required' }
  }
  const unitPrice = parseKurus(draft.unitPrice)
  if (unitPrice === null || unitPrice < 0) {
    return { ok: false, field: 'unitPrice', code: 'money' }
  }
  const lessonCount = optionalPositiveInteger(draft.lessonCount)
  if (lessonCount === false) {
    return { ok: false, field: 'lessonCount', code: 'integer' }
  }
  const totalPrice = draft.totalPrice.trim() === '' ? null : parseKurus(draft.totalPrice)
  if (totalPrice !== null && totalPrice < 0) {
    return { ok: false, field: 'totalPrice', code: 'money' }
  }
  if (draft.pricingModel === 'package' && (lessonCount === null || totalPrice === null)) {
    return {
      ok: false,
      field: lessonCount === null ? 'lessonCount' : 'totalPrice',
      code: 'package',
    }
  }
  const periodMonths = optionalPositiveInteger(draft.periodMonths)
  if (periodMonths === false) {
    return { ok: false, field: 'periodMonths', code: 'integer' }
  }
  const installments = Number(draft.defaultInstallments)
  if (!Number.isInteger(installments) || installments < 1) {
    return { ok: false, field: 'defaultInstallments', code: 'installments' }
  }
  if (!draft.validFrom) {
    return { ok: false, field: 'validFrom', code: 'date' }
  }

  return {
    ok: true,
    input: {
      replacesId: draft.replacesId,
      name: draft.name.trim(),
      pricingModel: draft.pricingModel,
      subjectId: draft.subjectId === '' ? null : Number(draft.subjectId),
      isGroup: draft.lessonKind === '' ? null : draft.lessonKind === 'group',
      unitPrice,
      lessonCount,
      totalPrice,
      periodMonths,
      defaultInstallments: installments,
      validFrom: draft.validFrom,
    },
  }
}

function optionalPositiveInteger(value: string): number | null | false {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : false
}

export function priceRuleState(rule: PriceRule, today: string): 'current' | 'future' | 'past' | 'archived' {
  if (rule.deletedAt !== null) return 'archived'
  if (rule.validFrom > today) return 'future'
  if (rule.validTo !== null && rule.validTo < today) return 'past'
  return 'current'
}
