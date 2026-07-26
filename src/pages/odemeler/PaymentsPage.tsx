import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchDebtorRows,
  fetchLocalNow,
  type AppError,
  type DebtFilter,
  type DebtorRow,
} from '../../lib/api'
import { formatDate, formatLira, formatPhone } from '../../lib/format'
import { paginate } from '../../lib/paginate'
import { PageContent } from '../../shell/AppShell'
import { PageHeader, StatusBar } from '../../shell/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Pagination,
  SearchInput,
  Select,
  Table,
  useToast,
  type Column,
} from '../../ui'
import { PaymentModal } from './PaymentModal'
import { sortDebtors, visibleReceivableKurus, type DebtSort } from './debtors'
import styles from './Payments.module.css'

const FILTERS: readonly DebtFilter[] = ['all', 'overdue', 'due_this_month', 'advance']

/** E14 — defter kaynaklı borçlu listesi ve satırdan tek tık tahsilat. */
export function PaymentsPage() {
  const [rows, setRows] = useState<DebtorRow[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [today, setToday] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<DebtFilter>('all')
  const [sort, setSort] = useState<DebtSort>('debt_desc')
  const [page, setPage] = useState(1)
  // `undefined` = kapalı, `null` = açık ama öğrenci seçilmedi, sayı = öğrenci seçili.
  const [paymentStudentId, setPaymentStudentId] = useState<number | null | undefined>(undefined)
  const toast = useToast()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    void fetchLocalNow()
      .then((now) => setToday(now.slice(0, 10)))
      .catch((caught: AppError) => setError(caught))
  }, [])

  const load = useCallback(async () => {
    if (!today) return
    setError(null)
    try {
      setRows(await fetchDebtorRows({ search: debouncedSearch, filter, today }))
    } catch (caught) {
      setError(caught as AppError)
      setRows(null)
    }
  }, [debouncedSearch, filter, today])

  useEffect(() => { void load() }, [load])
  useEffect(() => setPage(1), [debouncedSearch, filter, sort])

  const sorted = useMemo(() => sortDebtors(rows ?? [], sort), [rows, sort])
  const paged = paginate(sorted, page)
  const total = visibleReceivableKurus(sorted)

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      toast(tr.payments.table.phoneCopied)
    } catch {
      setError({ code: 'clipboard', message: tr.payments.table.copyFailed })
    }
  }

  const columns: readonly Column<DebtorRow>[] = [
    {
      key: 'student', header: tr.payments.table.student, width: 'minmax(180px,1.5fr)',
      render: (row) => <div className={styles.studentCell}><Avatar name={row.fullName} /><div><strong>{row.fullName}</strong>{row.archived && <Badge tone="neutral">{tr.payments.table.archived}</Badge>}</div></div>,
    },
    {
      key: 'phone', header: tr.payments.table.phone, width: '150px',
      render: (row) => row.guardianPhone ? <Button size="small" variant="ghost" aria-label={tr.payments.table.copyPhone} onClick={() => void copyPhone(row.guardianPhone!)}>{formatPhone(row.guardianPhone)}</Button> : <span className={styles.muted}>{tr.payments.table.noPhone}</span>,
    },
    { key: 'debt', header: tr.payments.table.debt, width: '110px', align: 'end', render: (row) => row.debtKurus > 0 ? <strong className={styles.debt}>{formatLira(row.debtKurus)}</strong> : '—' },
    { key: 'advance', header: tr.payments.table.advance, width: '110px', align: 'end', render: (row) => row.advanceKurus > 0 ? <strong className={styles.advanceText}>{formatLira(row.advanceKurus)}</strong> : '—' },
    { key: 'due', header: tr.payments.table.oldestDue, width: '115px', render: (row) => row.oldestDueOn ? formatDate(row.oldestDueOn) : '—' },
    { key: 'overdue', header: tr.payments.table.overdue, width: '100px', render: (row) => row.daysOverdue ? `${row.daysOverdue} ${tr.payments.table.days}` : tr.payments.table.current },
    { key: 'action', header: tr.payments.table.action, width: '108px', render: (row) => <Button variant="primary" size="small" onClick={() => setPaymentStudentId(row.studentId)}>{tr.payments.takePayment}</Button> },
  ]

  const empty = debouncedSearch ? (
    <EmptyState kind="no-search-results" title={tr.payments.empty.noResults} body={tr.payments.empty.noResultsBody} secondaryAction={<Button onClick={() => setSearch('')}>{tr.payments.empty.clear}</Button>} />
  ) : (
    <EmptyState title={tr.payments.empty.noDebt} body={tr.payments.empty.noDebtBody} />
  )

  return (
    <>
      <PageHeader
        title={tr.pages.payments.title}
        subtitle={tr.pages.payments.subtitle}
        search={<SearchInput value={search} placeholder={tr.payments.searchPlaceholder} aria-label={tr.payments.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} />}
        action={<Button variant="primary" onClick={() => setPaymentStudentId(null)}>{tr.payments.takePayment}</Button>}
      />
      <PageContent>
        <div className={styles.toolbar}>
          <ChipRow>
            {FILTERS.map((item) => <FilterChip key={item} label={tr.payments.filters[item]} active={filter === item} onClick={() => setFilter(item)} />)}
          </ChipRow>
          <Select
            className={styles.sortSelect}
            label={tr.payments.sorts.label}
            value={sort}
            options={([
              ['debt_desc', tr.payments.sorts.debt_desc],
              ['overdue_desc', tr.payments.sorts.overdue_desc],
            ] as const).map(([value, label]) => ({ value, label }))}
            onChange={(event) => setSort(event.target.value as DebtSort)}
          />
        </div>
        {rows === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}
        {rows !== null && !error && <Table label={tr.payments.table.label} columns={columns} rows={paged.rows} rowKey={(row) => row.studentId} stickyHeader emptyState={empty} />}
        {rows !== null && !error && sorted.length > 0 && (
          <>
            <Pagination page={paged.page} pageCount={paged.pageCount} onChange={setPage} />
            <StatusBar left={`${paged.total} ${tr.payments.status.showing}`} right={<><span>{tr.payments.status.visibleReceivable}</span> <strong>{formatLira(total)}</strong></>} />
          </>
        )}
      </PageContent>
      <PaymentModal
        open={paymentStudentId !== undefined}
        initialStudentId={paymentStudentId ?? null}
        onClose={() => setPaymentStudentId(undefined)}
        onSaved={() => void load()}
      />
    </>
  )
}
