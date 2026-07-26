import type { DebtorRow } from '../../lib/api'
import { compareTr } from '../../lib/sortTr'

export type DebtSort = 'debt_desc' | 'overdue_desc'

export function sortDebtors(rows: readonly DebtorRow[], sort: DebtSort): DebtorRow[] {
  return [...rows].sort((a, b) => {
    const primary = sort === 'debt_desc'
      ? b.debtKurus - a.debtKurus
      : (b.daysOverdue ?? -1) - (a.daysOverdue ?? -1)
    return primary || compareTr(a.fullName, b.fullName) || a.studentId - b.studentId
  })
}

/** ADR-026: sayfayı değil, arama/çip sonrası görünen listenin alacağını toplar. */
export function visibleReceivableKurus(rows: readonly DebtorRow[]): number {
  return rows.reduce((total, row) => total + row.debtKurus, 0)
}
