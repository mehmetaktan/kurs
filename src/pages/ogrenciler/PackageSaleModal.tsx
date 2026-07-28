import { useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchLocalNow,
  fetchPriceRules,
  sellPackage,
  type AppError,
  type InstallmentInput,
  type PriceRule,
} from '../../lib/api'
import { formatDate, formatKurus, formatLira, parseKurus } from '../../lib/format'
import {
  Button,
  DatePicker,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
  useToast,
} from '../../ui'
import {
  buildPackageSaleInput,
  packageDiscountKurus,
  splitInstallments,
  type PackageSaleDraft,
} from './packageSale'
import styles from './Students.module.css'

interface PackageSaleModalProps {
  open: boolean
  studentId: number
  studentName: string
  balanceKurus: number
  onClose: () => void
  onSaved: () => void
}

export function PackageSaleModal({
  open,
  studentId,
  studentName,
  balanceKurus,
  onClose,
  onSaved,
}: PackageSaleModalProps) {
  const [rules, setRules] = useState<PriceRule[] | null>(null)
  const [today, setToday] = useState('')
  const [draft, setDraft] = useState<PackageSaleDraft | null>(null)
  const [installmentCount, setInstallmentCount] = useState('1')
  const [firstDueOn, setFirstDueOn] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<keyof typeof tr.students.packages.errors | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setError(null)
    setRules(null)
    void Promise.all([fetchPriceRules(), fetchLocalNow()])
      .then(([allRules, now]) => {
        const day = now.slice(0, 10)
        const available = allRules.filter(
          (rule) =>
            rule.deletedAt === null &&
            rule.pricingModel === 'package' &&
            rule.lessonCount !== null &&
            rule.validFrom <= day &&
            (rule.validTo === null || day <= rule.validTo),
        )
        setRules(available)
        setToday(day)
        setFirstDueOn(day)
        setDraft({
          priceRuleId: null,
          lessonCount: '',
          unitPrice: '',
          totalPrice: '',
          soldOn: day,
          installments: [],
        })
      })
      .catch((caught) => setError(caught as AppError))
  }, [open])

  const selected = rules?.find((rule) => rule.id === draft?.priceRuleId) ?? null
  const discount = useMemo(() => {
    if (!draft) return 0
    return packageDiscountKurus(
      parseKurus(draft.unitPrice) ?? 0,
      Number(draft.lessonCount),
      parseKurus(draft.totalPrice) ?? 0,
    )
  }, [draft])

  const refreshPlan = (
    nextDraft: PackageSaleDraft,
    countText = installmentCount,
    dueOn = firstDueOn,
  ) => {
    const total = parseKurus(nextDraft.totalPrice)
    const count = Number(countText)
    const installments = total !== null && dueOn ? splitInstallments(total, count, dueOn) : []
    setDraft({ ...nextDraft, installments })
  }

  const chooseRule = (id: number | null) => {
    const rule = rules?.find((item) => item.id === id)
    if (!rule) {
      setDraft((current) => (current ? { ...current, priceRuleId: null } : current))
      return
    }
    const next: PackageSaleDraft = {
      priceRuleId: rule.id,
      lessonCount: String(rule.lessonCount ?? ''),
      unitPrice: formatKurus(rule.unitPrice),
      totalPrice: formatKurus(rule.totalPrice ?? rule.unitPrice * (rule.lessonCount ?? 1)),
      soldOn: draft?.soldOn ?? today,
      installments: [],
    }
    const count = String(rule.defaultInstallments)
    setInstallmentCount(count)
    refreshPlan(next, count, firstDueOn ?? today)
  }

  const updateInstallment = (index: number, next: InstallmentInput) => {
    if (!draft) return
    const installments = draft.installments.map((item, itemIndex) =>
      itemIndex === index ? next : item,
    )
    setDraft({ ...draft, installments })
  }

  const submit = async () => {
    if (!draft || saving) return
    const result = buildPackageSaleInput(studentId, draft)
    if (!result.ok) {
      setFieldError(result.field)
      return
    }
    setSaving(true)
    setFieldError(null)
    try {
      await sellPackage(result.input)
      window.dispatchEvent(new Event('kurs:debts-changed'))
      toast(tr.students.packages.saved)
      onSaved()
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={tr.students.packages.title}
      onClose={onClose}
      dismissLabel={false}
      actions={
        rules && draft && rules.length > 0 ? (
          <div className={styles.formActions}>
            <Button onClick={onClose}>{tr.actions.cancel}</Button>
            <Button variant="primary" disabled={saving} onClick={() => void submit()}>
              {saving ? tr.students.packages.saving : tr.actions.save}
            </Button>
          </div>
        ) : undefined
      }
    >
      {rules === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {rules && draft && (
        <div className={styles.packageForm}>
          <div className={styles.packageCounters}>
            <div><span>{tr.students.packages.student}</span><strong>{studentName}</strong></div>
            <div><span>{tr.students.packages.currentBalance}</span><strong>{formatLira(balanceKurus)}</strong></div>
          </div>
          <p className={styles.hint}>{tr.students.packages.separateCounters}</p>
          {rules.length === 0 ? (
            <ErrorState inline message={tr.students.packages.noRules} />
          ) : (
            <>
              <Select
                label={tr.students.packages.rule}
                value={draft.priceRuleId === null ? '' : String(draft.priceRuleId)}
                placeholder={tr.students.packages.rulePlaceholder}
                options={rules.map((rule) => ({ value: String(rule.id), label: rule.name }))}
                error={fieldError === 'priceRuleId' ? tr.students.packages.errors.priceRuleId : undefined}
                onChange={(event) => chooseRule(event.target.value ? Number(event.target.value) : null)}
              />
              <div className={styles.formPair}>
                <Input label={tr.students.packages.lessonCount} value={draft.lessonCount} inputMode="numeric" error={fieldError === 'lessonCount' ? tr.students.packages.errors.lessonCount : undefined} onChange={(event) => setDraft({ ...draft, lessonCount: event.target.value })} />
                <Input label={tr.students.packages.unitPrice} value={draft.unitPrice} inputMode="decimal" error={fieldError === 'unitPrice' ? tr.students.packages.errors.unitPrice : undefined} onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })} />
              </div>
              <Input label={tr.students.packages.totalPrice} value={draft.totalPrice} inputMode="decimal" error={fieldError === 'totalPrice' ? tr.students.packages.errors.totalPrice : undefined} onChange={(event) => refreshPlan({ ...draft, totalPrice: event.target.value })} />
              <div className={styles.packageDiscount}>{tr.students.packages.discount}<strong>{formatLira(discount)}</strong></div>
              <DatePicker label={tr.students.packages.soldOn} value={draft.soldOn} today={today} error={fieldError === 'soldOn' ? tr.students.packages.errors.soldOn : undefined} onChange={(value) => setDraft({ ...draft, soldOn: value })} />
              <div className={styles.formPair}>
                <Input label={tr.students.packages.installmentCount} value={installmentCount} inputMode="numeric" onChange={(event) => { setInstallmentCount(event.target.value); refreshPlan(draft, event.target.value) }} />
                <DatePicker label={tr.students.packages.firstDueOn} value={firstDueOn} today={today} onChange={(value) => { setFirstDueOn(value); refreshPlan(draft, installmentCount, value) }} />
              </div>
              <div className={styles.packagePlanTitle}>{tr.students.packages.plan}</div>
              {draft.installments.map((installment, index) => (
                <div className={styles.formPair} key={`${index}-${installment.dueOn}-${installment.amount}`}>
                  <DatePicker label={`${index + 1}. ${tr.students.packages.installmentDueOn}`} value={installment.dueOn} today={today} onChange={(value) => value && updateInstallment(index, { ...installment, dueOn: value })} />
                  <Input label={`${index + 1}. ${tr.students.packages.installmentAmount}`} defaultValue={formatKurus(installment.amount)} inputMode="decimal" onBlur={(event) => updateInstallment(index, { ...installment, amount: parseKurus(event.target.value) ?? 0 })} />
                </div>
              ))}
              {fieldError === 'installments' && <p className={styles.formError}>{tr.students.packages.errors.installments}</p>}
              {selected && draft.installments.length > 0 && (
                <div className={styles.packageSummary}>
                  <strong>{tr.students.packages.summary}</strong>
                  <span>{draft.lessonCount} {tr.students.packages.summaryLessons}{tr.units.separator}{formatLira(parseKurus(draft.totalPrice) ?? 0)}{tr.units.separator}{draft.installments.length} {tr.students.packages.summaryInstallments}{tr.units.separator}{tr.students.packages.summaryFirstDue} {formatDate(draft.installments[0]?.dueOn)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
