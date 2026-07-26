import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  cancelPayment,
  exportStatementCsv,
  fetchLocalNow,
  fetchStatementRows,
  openReceiptPdf,
  type AppError,
  type StatementRow,
} from '../../lib/api'
import { formatDate, formatLira } from '../../lib/format'
import { paginate } from '../../lib/paginate'
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SectionHeader,
  Table,
  useToast,
  type Column,
} from '../../ui'
import { PaymentModal } from './PaymentModal'
import styles from './Payments.module.css'

export function StatementPanel({ studentId }: { studentId: number }) {
  const [rows, setRows] = useState<StatementRow[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [today, setToday] = useState('')
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cancelling, setCancelling] = useState<StatementRow | null>(null)
  const toast = useToast()
  const query = useMemo(() => ({ studentId, from, to }), [from, studentId, to])

  useEffect(() => { void fetchLocalNow().then((now) => setToday(now.slice(0, 10))).catch((caught: AppError) => setError(caught)) }, [])
  const load = useCallback(async () => {
    setError(null)
    try { setRows(await fetchStatementRows(query)) }
    catch (caught) { setRows(null); setError(caught as AppError) }
  }, [query])
  useEffect(() => { void load() }, [load])
  useEffect(() => setPage(1), [from, to])

  const exportCsv = async () => {
    try { await exportStatementCsv(query); toast(tr.payments.statement.exported) }
    catch (caught) { setError(caught as AppError) }
  }
  const confirmCancel = async () => {
    const paymentId = cancelling?.paymentId
    if (!paymentId) return
    setCancelling(null)
    try { await cancelPayment(paymentId); toast(tr.payments.statement.cancelDone); await load() }
    catch (caught) { setError(caught as AppError) }
  }
  const openReceipt = async (paymentId: number) => {
    try { await openReceiptPdf(paymentId); toast(tr.payments.receipt.opened) }
    catch (caught) { setError(caught as AppError) }
  }

  const columns: readonly Column<StatementRow>[] = [
    { key: 'date', header: tr.payments.statement.columns.date, width: '105px', render: (row) => formatDate(row.entryDate) },
    { key: 'description', header: tr.payments.statement.columns.description, width: 'minmax(180px,1fr)', render: (row) => <div className={styles.statementDescription}><span>{row.memo ?? tr.payments.statement.kinds[row.kind]}</span>{row.paymentCancelled && row.kind === 'payment' && <Badge tone="neutral">{tr.payments.statement.cancelled}</Badge>}</div> },
    { key: 'debit', header: tr.payments.statement.columns.debit, width: '110px', align: 'end', render: (row) => row.debitKurus > 0 ? formatLira(row.debitKurus) : '—' },
    { key: 'credit', header: tr.payments.statement.columns.credit, width: '110px', align: 'end', render: (row) => row.creditKurus > 0 ? formatLira(row.creditKurus) : '—' },
    { key: 'balance', header: tr.payments.statement.columns.balance, width: '115px', align: 'end', render: (row) => <strong>{formatLira(row.balanceKurus)}</strong> },
    { key: 'action', header: tr.payments.statement.columns.action, width: '172px', render: (row) => row.kind === 'payment' && row.paymentId ? <div className={styles.rowActions}><Button size="small" onClick={() => void openReceipt(row.paymentId!)}>{tr.payments.statement.receipt}</Button>{!row.paymentCancelled && <Button size="small" variant="danger" onClick={() => setCancelling(row)}>{tr.payments.statement.cancel}</Button>}</div> : null },
  ]
  const paged = paginate(rows ?? [], page)

  return (
    <div className={styles.statement}>
      <SectionHeader title={tr.payments.statement.title} meta={tr.payments.statement.subtitle} />
      <div className={styles.statementToolbar}>
        <div className={styles.statementDates}>
          <DatePicker label={tr.payments.statement.from} value={from} today={today} onChange={setFrom} />
          <DatePicker label={tr.payments.statement.to} value={to} today={today} onChange={setTo} />
        </div>
        <div className={styles.statementActions}>
          <Button onClick={() => window.print()}>{tr.payments.statement.print}</Button>
          <Button onClick={() => void exportCsv()}>{tr.payments.statement.exportCsv}</Button>
          <Button variant="primary" onClick={() => setPaymentOpen(true)}>{tr.payments.takePayment}</Button>
        </div>
      </div>
      {rows === null && !error && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={() => void load()} />}
      {rows !== null && !error && <Table label={tr.payments.statement.tableLabel} columns={columns} rows={paged.rows} rowKey={(row) => row.entryId} emptyState={<EmptyState kind="no-filter-results" title={tr.payments.statement.empty} body={tr.payments.statement.emptyBody} />} />}
      {rows !== null && !error && <Pagination page={paged.page} pageCount={paged.pageCount} onChange={setPage} />}
      <PaymentModal open={paymentOpen} initialStudentId={studentId} onClose={() => setPaymentOpen(false)} onSaved={() => void load()} />
      <ConfirmDialog
        open={cancelling !== null}
        title={tr.payments.statement.cancelTitle}
        description={tr.payments.statement.cancelBody}
        confirmLabel={tr.payments.statement.cancelConfirm}
        confirmHint={tr.payments.statement.cancelHint}
        destructive
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelling(null)}
      />
    </div>
  )
}
