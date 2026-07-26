import type { InstallmentInput, PackageSaleInput } from '../../lib/api'
import { parseKurus } from '../../lib/format'

export interface PackageSaleDraft {
  priceRuleId: number | null
  lessonCount: string
  unitPrice: string
  totalPrice: string
  soldOn: string | null
  installments: InstallmentInput[]
}

export type PackageSaleDraftResult =
  | { ok: true; input: PackageSaleInput }
  | { ok: false; field: 'priceRuleId' | 'lessonCount' | 'unitPrice' | 'totalPrice' | 'soldOn' | 'installments' }

/** Toplam kuruşu, kuruş kaybetmeden taksitlere böler. Artan kuruşlar ilk taksitlere gider. */
export function splitInstallments(
  totalKurus: number,
  count: number,
  firstDueOn: string,
): InstallmentInput[] {
  if (!Number.isSafeInteger(totalKurus) || totalKurus <= 0) return []
  if (!Number.isSafeInteger(count) || count < 1) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueOn)) return []
  const base = Math.trunc(totalKurus / count)
  const remainder = totalKurus % count
  return Array.from({ length: count }, (_, index) => ({
    dueOn: addMonthsClamped(firstDueOn, index),
    amount: base + (index < remainder ? 1 : 0),
    label: null,
  }))
}

/** Satış özetindeki indirim; negatif sonuç indirim değil, sıfır gösterilir. */
export function packageDiscountKurus(
  unitPriceKurus: number,
  lessonCount: number,
  totalPriceKurus: number,
): number {
  if (![unitPriceKurus, lessonCount, totalPriceKurus].every(Number.isSafeInteger)) return 0
  const gross = unitPriceKurus * lessonCount
  return Number.isSafeInteger(gross) ? Math.max(0, gross - totalPriceKurus) : 0
}

export function buildPackageSaleInput(
  studentId: number,
  draft: PackageSaleDraft,
): PackageSaleDraftResult {
  if (draft.priceRuleId === null) return { ok: false, field: 'priceRuleId' }
  const lessonCount = Number(draft.lessonCount)
  if (!Number.isSafeInteger(lessonCount) || lessonCount < 1) return { ok: false, field: 'lessonCount' }
  const unitPrice = parseKurus(draft.unitPrice)
  if (unitPrice === null || unitPrice < 0) return { ok: false, field: 'unitPrice' }
  const totalPrice = parseKurus(draft.totalPrice)
  if (totalPrice === null || totalPrice <= 0) return { ok: false, field: 'totalPrice' }
  if (!draft.soldOn) return { ok: false, field: 'soldOn' }
  if (
    draft.installments.length === 0 ||
    draft.installments.some((item) => !item.dueOn || !Number.isSafeInteger(item.amount) || item.amount <= 0) ||
    draft.installments.reduce((sum, item) => sum + item.amount, 0) !== totalPrice
  ) {
    return { ok: false, field: 'installments' }
  }
  return {
    ok: true,
    input: {
      studentId,
      enrollmentId: null,
      priceRuleId: draft.priceRuleId,
      lessonCount,
      unitPrice,
      totalPrice,
      soldOn: draft.soldOn,
      installments: draft.installments,
    },
  }
}

function addMonthsClamped(iso: string, add: number): string {
  const [yearText, monthText, dayText] = iso.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1 + add
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate()
  const day = Math.min(Number(dayText), lastDay)
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
