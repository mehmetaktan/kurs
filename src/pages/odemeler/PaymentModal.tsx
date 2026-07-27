import { useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchLocalNow,
  fetchOpenInstallments,
  fetchStudentList,
  openReceiptPdf,
  recordPayment,
  reserveReceiptNo,
  suggestPaymentAllocations,
  type AppError,
  type InstallmentOpen,
  type PaymentAllocationInput,
  type PaymentReport,
  type StudentRow,
} from '../../lib/api'
import { formatDate, formatKurus, formatLira, parseKurus } from '../../lib/format'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  DatePicker,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  SearchSelect,
  SegmentedControl,
  Textarea,
  useToast,
} from '../../ui'
import styles from './Payments.module.css'

type Method = 'cash' | 'card' | 'transfer'

interface PaymentModalProps {
  open: boolean
  initialStudentId?: number | null
  onClose: () => void
  onSaved?: (report: PaymentReport) => void
}

/** E13 — makbuz numarasını açılışta ayıran, FIFO mahsup önerili tahsilat formu. */
export function PaymentModal({ open, initialStudentId = null, onClose, onSaved }: PaymentModalProps) {
  const [students, setStudents] = useState<StudentRow[] | null>(null)
  const [studentId, setStudentId] = useState<number | null>(initialStudentId)
  const [amountText, setAmountText] = useState('')
  const [today, setToday] = useState('')
  const [paidOn, setPaidOn] = useState<string | null>(null)
  const [method, setMethod] = useState<Method>('cash')
  const [receiptNo, setReceiptNo] = useState('')
  const [note, setNote] = useState('')
  const [installments, setInstallments] = useState<InstallmentOpen[]>([])
  const [allocations, setAllocations] = useState<PaymentAllocationInput[]>([])
  const [loadingInstallments, setLoadingInstallments] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [fieldError, setFieldError] = useState<'student' | 'amount' | 'date' | 'receiptNo' | 'allocation' | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedReport, setSavedReport] = useState<PaymentReport | null>(null)
  const [openingReceipt, setOpeningReceipt] = useState(false)
  const savingRef = useRef(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    let live = true
    setError(null)
    setStudents(null)
    setStudentId(initialStudentId)
    setAmountText('')
    setMethod('cash')
    setNote('')
    setInstallments([])
    setAllocations([])
    setFieldError(null)
    savingRef.current = false
    setSaving(false)
    setSavedReport(null)
    setOpeningReceipt(false)
    void Promise.all([fetchStudentList({}), reserveReceiptNo(), fetchLocalNow()])
      .then(([rows, receipt, now]) => {
        if (!live) return
        setStudents(sortTrBy(rows.filter((row) => !row.archived), (row) => row.fullName))
        setReceiptNo(receipt)
        setToday(now.slice(0, 10))
        setPaidOn(now.slice(0, 10))
      })
      .catch((caught: AppError) => live && setError(caught))
    return () => { live = false }
  }, [initialStudentId, open])

  const amount = parseKurus(amountText)

  useEffect(() => {
    if (!open || studentId === null) {
      setInstallments([])
      setAllocations([])
      return
    }
    let live = true
    setLoadingInstallments(true)
    void Promise.all([
      fetchOpenInstallments(studentId),
      suggestPaymentAllocations(studentId, amount && amount > 0 ? amount : 0),
    ])
      .then(([rows, suggested]) => {
        if (!live) return
        setInstallments(rows)
        setAllocations(suggested)
      })
      .catch((caught: AppError) => live && setError(caught))
      .finally(() => live && setLoadingInstallments(false))
    return () => { live = false }
  }, [amount, open, studentId])

  const allocated = useMemo(
    () => allocations.reduce((sum, item) => sum + item.amount, 0),
    [allocations],
  )
  const advance = amount === null ? 0 : Math.max(0, amount - allocated)

  const updateAllocation = (installmentId: number, value: string) => {
    const parsed = parseKurus(value)
    setAllocations((current) => [
      ...current.filter((item) => item.installmentId !== installmentId),
      ...(parsed !== null && parsed > 0 ? [{ installmentId, amount: parsed }] : []),
    ])
  }

  const submit = async () => {
    if (savingRef.current) return
    if (studentId === null) return setFieldError('student')
    if (amount === null || amount <= 0) return setFieldError('amount')
    if (!paidOn) return setFieldError('date')
    if (receiptNo.trim() === '') return setFieldError('receiptNo')
    if (allocated > amount) return setFieldError('allocation')
    savingRef.current = true
    setSaving(true)
    setFieldError(null)
    setError(null)
    try {
      const report = await recordPayment({
        studentId,
        paidOn,
        amount,
        method,
        receiptNo: receiptNo.trim(),
        note: note.trim() || null,
        allocations,
      })
      toast(tr.payments.modal.saved)
      onSaved?.(report)
      setSavedReport(report)
    } catch (caught) {
      setError(caught as AppError)
      savingRef.current = false
      setSaving(false)
    }
  }

  const openReceipt = async () => {
    if (!savedReport || openingReceipt) return
    setOpeningReceipt(true)
    setError(null)
    try {
      await openReceiptPdf(savedReport.paymentId)
      toast(tr.payments.receipt.opened)
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setOpeningReceipt(false)
    }
  }

  const ready = students !== null && paidOn !== null && receiptNo !== ''
  return (
    <Modal open={open} title={tr.payments.modal.title} onClose={onClose} dismissLabel={false}>
      {!ready && !error ? <LoadingState inline /> : (
        savedReport ? (
          <div className={styles.paymentSuccess}>
            <strong>{tr.payments.modal.savedTitle}</strong>
            <p>{tr.payments.modal.savedBody}</p>
            {error && <ErrorState inline message={error.message} details={error.details} />}
            <div className={styles.modalActions}>
              <Button onClick={onClose}>{tr.payments.modal.close}</Button>
              <Button variant="primary" disabled={openingReceipt} onClick={() => void openReceipt()}>
                {tr.payments.receipt.print}
              </Button>
            </div>
          </div>
        ) : (
        <div className={styles.paymentForm}>
          {error && <ErrorState inline message={error.message} details={error.details} />}
          <SearchSelect
            label={tr.payments.modal.student}
            placeholder={tr.payments.modal.studentPlaceholder}
            options={(students ?? []).map((row) => ({ value: String(row.id), label: row.fullName }))}
            value={studentId === null ? null : String(studentId)}
            onChange={(value) => { setStudentId(value ? Number(value) : null); setFieldError(null) }}
            error={fieldError === 'student' ? tr.payments.modal.errors.student : undefined}
          />
          <div className={styles.formPair}>
            <Input
              label={tr.payments.modal.amount}
              value={amountText}
              inputMode="decimal"
              onChange={(event) => { setAmountText(event.target.value); setFieldError(null) }}
              error={fieldError === 'amount' ? tr.payments.modal.errors.amount : undefined}
            />
            <DatePicker
              label={tr.payments.modal.date}
              value={paidOn}
              today={today}
              onChange={(value) => { setPaidOn(value); setFieldError(null) }}
              error={fieldError === 'date' ? tr.payments.modal.errors.date : undefined}
            />
          </div>
          <div>
            <div className={styles.fieldLabel}>{tr.payments.modal.method}</div>
            <SegmentedControl
              label={tr.payments.modal.method}
              value={method}
              onChange={setMethod}
              options={([
                ['cash', tr.payments.modal.methods.cash],
                ['card', tr.payments.modal.methods.card],
                ['transfer', tr.payments.modal.methods.transfer],
              ] as const).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Input
            label={tr.payments.modal.receiptNo}
            hint={tr.payments.modal.receiptHint}
            value={receiptNo}
            onChange={(event) => { setReceiptNo(event.target.value); setFieldError(null) }}
            error={fieldError === 'receiptNo' ? tr.payments.modal.errors.receiptNo : undefined}
          />
          <Textarea
            label={tr.payments.modal.note}
            placeholder={tr.payments.modal.notePlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <section className={styles.installments}>
            <strong>{tr.payments.modal.installments}</strong>
            <p>{tr.payments.modal.installmentsHint}</p>
            {loadingInstallments ? <LoadingState inline /> : installments.length === 0 ? (
              <p>{tr.payments.modal.noInstallments}</p>
            ) : installments.map((row) => {
              const value = allocations.find((item) => item.installmentId === row.id)?.amount ?? 0
              return (
                <div className={styles.installmentRow} key={`${row.id}-${value}`}>
                  <div>
                    <strong>{row.label ?? `${row.seq}. ${tr.payments.modal.installments}`}</strong>
                    <span>{formatDate(row.dueOn)} · {formatLira(row.openKurus)} {tr.payments.modal.installmentOpen}</span>
                  </div>
                  <Input
                    aria-label={`${row.label ?? row.seq} ${tr.payments.modal.allocation}`}
                    defaultValue={value > 0 ? formatKurus(value) : ''}
                    inputMode="decimal"
                    onBlur={(event) => updateAllocation(row.id, event.target.value)}
                  />
                </div>
              )
            })}
          </section>
          {advance > 0 && <div className={styles.advance}><strong>{formatLira(advance)}</strong> {tr.payments.modal.advance}</div>}
          {fieldError === 'allocation' && <ErrorState inline message={tr.payments.modal.errors.allocation} />}
          <div className={styles.modalActions}>
            <Button onClick={onClose}>{tr.actions.cancel}</Button>
            <Button variant="primary" disabled={saving} onClick={() => void submit()}>
              {saving ? tr.payments.modal.saving : tr.payments.modal.save}
            </Button>
          </div>
        </div>
        )
      )}
    </Modal>
  )
}
