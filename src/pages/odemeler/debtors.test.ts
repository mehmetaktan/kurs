import { describe, expect, it } from 'vitest'
import type { DebtorRow } from '../../lib/api'
import { sortDebtors, visibleReceivableKurus } from './debtors'

const row = (studentId: number, fullName: string, debtKurus: number, daysOverdue: number | null): DebtorRow => ({
  studentId, fullName, debtKurus, daysOverdue, guardianPhone: null, archived: false,
  advanceKurus: 0, oldestDueOn: null,
})

describe('borçlu listesi saf hesapları', () => {
  const rows = [row(1, 'İpek', 25_000, 3), row(2, 'Ahmet', 60_000, 1)]

  it('tutara ve gecikmeye göre ayrı sıralar', () => {
    expect(sortDebtors(rows, 'debt_desc').map((item) => item.studentId)).toEqual([2, 1])
    expect(sortDebtors(rows, 'overdue_desc').map((item) => item.studentId)).toEqual([1, 2])
  })

  it('görünen listenin alacağını kuruş olarak toplar', () => {
    expect(visibleReceivableKurus(rows)).toBe(85_000)
  })
})
