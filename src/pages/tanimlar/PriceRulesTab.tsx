import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  archivePriceRule,
  fetchLocalNow,
  fetchPriceRules,
  fetchSubjects,
  savePriceRule,
  type AppError,
  type PriceRule,
  type Subject,
} from '../../lib/api'
import { formatDate, formatLira } from '../../lib/format'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  SectionHeader,
  Select,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { buildPriceRuleInput, priceRuleState, type PriceRuleDraft } from './priceRules'
import styles from './Definitions.module.css'

const emptyDraft = (today: string): PriceRuleDraft => ({
  replacesId: null,
  name: '',
  pricingModel: 'per_session',
  subjectId: '',
  lessonKind: '',
  unitPrice: '',
  lessonCount: '',
  totalPrice: '',
  periodMonths: '',
  defaultInstallments: '1',
  validFrom: today,
})

export function PriceRulesTab() {
  const [rules, setRules] = useState<PriceRule[] | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [today, setToday] = useState('')
  const [error, setError] = useState<AppError | null>(null)
  const [draft, setDraft] = useState<PriceRuleDraft | null>(null)
  const [fieldError, setFieldError] = useState<{ field: keyof PriceRuleDraft; code: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState<PriceRule | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextRules, nextSubjects, now] = await Promise.all([
        fetchPriceRules(),
        fetchSubjects(),
        fetchLocalNow(),
      ])
      setRules(nextRules)
      setSubjects(sortTrBy(nextSubjects, (subject) => subject.name))
      setToday(now.slice(0, 10))
    } catch (caught) {
      setError(caught as AppError)
      setRules(null)
    }
  }, [])

  useEffect(() => void load(), [load])

  const ordered = useMemo(() => {
    if (!rules) return []
    const byName = sortTrBy(rules, (rule) => rule.name)
    const rank = { current: 0, future: 1, past: 2, archived: 3 }
    return byName.sort((a, b) => {
      const state = rank[priceRuleState(a, today)] - rank[priceRuleState(b, today)]
      return state || b.validFrom.localeCompare(a.validFrom)
    })
  }, [rules, today])

  const startChange = (rule: PriceRule) => {
    setFieldError(null)
    setDraft({
      replacesId: rule.id,
      name: rule.name,
      pricingModel: rule.pricingModel,
      subjectId: rule.subjectId === null ? '' : String(rule.subjectId),
      lessonKind: rule.isGroup === null ? '' : rule.isGroup ? 'group' : 'solo',
      unitPrice: formatLira(rule.unitPrice).replace(tr.units.currencySuffix, ''),
      lessonCount: rule.lessonCount === null ? '' : String(rule.lessonCount),
      totalPrice:
        rule.totalPrice === null ? '' : formatLira(rule.totalPrice).replace(tr.units.currencySuffix, ''),
      periodMonths: rule.periodMonths === null ? '' : String(rule.periodMonths),
      defaultInstallments: String(rule.defaultInstallments),
      validFrom: today,
    })
  }

  const submit = async () => {
    if (!draft || saving) return
    const result = buildPriceRuleInput(draft)
    if (!result.ok) {
      setFieldError({ field: result.field, code: result.code })
      return
    }
    setSaving(true)
    setFieldError(null)
    try {
      await savePriceRule(result.input)
      toast(tr.definitions.priceRules.saved)
      setDraft(null)
      await load()
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiving) return
    try {
      await archivePriceRule(archiving.id)
      toast(tr.definitions.priceRules.archive.done)
      setArchiving(null)
      await load()
    } catch (caught) {
      setArchiving(null)
      setError(caught as AppError)
    }
  }

  const subjectName = (id: number | null) =>
    id === null ? tr.definitions.priceRules.allSubjects : subjects.find((s) => s.id === id)?.name ?? tr.units.emptyValue

  const columns: Column<PriceRule>[] = [
    {
      key: 'name',
      header: tr.definitions.priceRules.table.name,
      width: 'minmax(170px,1.5fr)',
      render: (rule) => rule.name,
    },
    {
      key: 'scope',
      header: tr.definitions.priceRules.table.scope,
      width: 'minmax(150px,1fr)',
      render: (rule) => `${subjectName(rule.subjectId)}${tr.units.separator}${lessonKindLabel(rule.isGroup)}`,
    },
    {
      key: 'model',
      header: tr.definitions.priceRules.table.model,
      width: '120px',
      render: (rule) => modelLabel(rule.pricingModel),
    },
    {
      key: 'price',
      header: tr.definitions.priceRules.table.price,
      width: '130px',
      align: 'end',
      render: (rule) => <span className={styles.tabular}>{formatLira(rule.unitPrice)}</span>,
    },
    {
      key: 'validity',
      header: tr.definitions.priceRules.table.validity,
      width: '170px',
      render: (rule) => validityLabel(rule, today),
    },
    {
      key: 'action',
      header: tr.definitions.priceRules.table.action,
      width: '180px',
      align: 'end',
      render: (rule) =>
        priceRuleState(rule, today) === 'current' ? (
          <span className={styles.colorRow}>
            <Button size="small" onClick={() => startChange(rule)}>
              {tr.definitions.priceRules.change}
            </Button>
            <Button size="small" onClick={() => setArchiving(rule)}>
              {tr.actions.archive}
            </Button>
          </span>
        ) : null,
    },
  ]

  return (
    <section className={styles.section}>
      <SectionHeader title={tr.definitions.priceRules.heading} />
      <div className={styles.sectionHead}>
        <p className={styles.lead}>{tr.definitions.priceRules.lead}</p>
        <Button variant="primary" onClick={() => setDraft(emptyDraft(today))}>
          {tr.definitions.priceRules.newRule}
        </Button>
      </div>

      {rules === null && !error && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={() => void load()} />}
      {rules && (
        <Table
          columns={columns}
          rows={ordered}
          rowKey={(rule) => rule.id}
          label={tr.definitions.priceRules.table.label}
          emptyState={
            <EmptyState
              title={tr.definitions.priceRules.empty}
              body={tr.definitions.priceRules.emptyBody}
              action={
                <Button variant="primary" onClick={() => setDraft(emptyDraft(today))}>
                  {tr.definitions.priceRules.newRule}
                </Button>
              }
            />
          }
        />
      )}

      <PriceRuleModal
        draft={draft}
        subjects={subjects}
        today={today}
        saving={saving}
        fieldError={fieldError}
        onDraft={setDraft}
        onClose={() => setDraft(null)}
        onSubmit={() => void submit()}
      />
      <ConfirmDialog
        open={archiving !== null}
        title={tr.definitions.priceRules.archive.title}
        description={`${archiving?.name ?? ''} ${tr.definitions.priceRules.archive.body}`}
        confirmLabel={tr.actions.archive}
        destructive
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiving(null)}
      />
    </section>
  )
}

interface PriceRuleModalProps {
  draft: PriceRuleDraft | null
  subjects: Subject[]
  today: string
  saving: boolean
  fieldError: { field: keyof PriceRuleDraft; code: string } | null
  onDraft: (draft: PriceRuleDraft | null) => void
  onClose: () => void
  onSubmit: () => void
}

function PriceRuleModal({ draft, subjects, today, saving, fieldError, onDraft, onClose, onSubmit }: PriceRuleModalProps) {
  if (!draft) return null
  const set = <K extends keyof PriceRuleDraft>(key: K, value: PriceRuleDraft[K]) =>
    onDraft({ ...draft, [key]: value })
  const errorFor = (field: keyof PriceRuleDraft) =>
    fieldError?.field === field
      ? tr.definitions.priceRules.errors[fieldError.code as keyof typeof tr.definitions.priceRules.errors]
      : undefined

  return (
    <Modal
      open
      title={draft.replacesId === null ? tr.definitions.priceRules.form.newTitle : tr.definitions.priceRules.form.changeTitle}
      description={tr.definitions.priceRules.form.historyHint}
      onClose={onClose}
      dismissLabel={false}
    >
      <div className={styles.formGrid}>
        <Input label={tr.definitions.priceRules.form.name} value={draft.name} error={errorFor('name')} onChange={(e) => set('name', e.target.value)} autoFocus />
        <Select
          label={tr.definitions.priceRules.form.model}
          value={draft.pricingModel}
          options={[
            { value: 'per_session', label: tr.definitions.priceRules.models.perSession },
            { value: 'package', label: tr.definitions.priceRules.models.package },
            { value: 'period', label: tr.definitions.priceRules.models.period },
          ]}
          onChange={(e) => set('pricingModel', e.target.value as PriceRuleDraft['pricingModel'])}
        />
        <Select
          label={tr.definitions.priceRules.form.subject}
          value={draft.subjectId}
          options={subjects.map((subject) => ({ value: String(subject.id), label: subject.name }))}
          placeholder={tr.definitions.priceRules.allSubjects}
          onChange={(e) => set('subjectId', e.target.value)}
        />
        <Select
          label={tr.definitions.priceRules.form.lessonKind}
          value={draft.lessonKind}
          options={[
            { value: 'solo', label: tr.definitions.priceRules.lessonKinds.solo },
            { value: 'group', label: tr.definitions.priceRules.lessonKinds.group },
          ]}
          placeholder={tr.definitions.priceRules.lessonKinds.any}
          onChange={(e) => set('lessonKind', e.target.value as PriceRuleDraft['lessonKind'])}
        />
        <Input label={tr.definitions.priceRules.form.unitPrice} value={draft.unitPrice} inputMode="decimal" error={errorFor('unitPrice')} onChange={(e) => set('unitPrice', e.target.value)} />
        {draft.pricingModel === 'package' && (
          <div className={styles.formPair}>
            <Input label={tr.definitions.priceRules.form.lessonCount} value={draft.lessonCount} inputMode="numeric" error={errorFor('lessonCount')} onChange={(e) => set('lessonCount', e.target.value)} />
            <Input label={tr.definitions.priceRules.form.totalPrice} value={draft.totalPrice} inputMode="decimal" error={errorFor('totalPrice')} onChange={(e) => set('totalPrice', e.target.value)} />
          </div>
        )}
        {draft.pricingModel === 'period' && (
          <Input label={tr.definitions.priceRules.form.periodMonths} value={draft.periodMonths} inputMode="numeric" error={errorFor('periodMonths')} onChange={(e) => set('periodMonths', e.target.value)} />
        )}
        <Input label={tr.definitions.priceRules.form.installments} value={draft.defaultInstallments} inputMode="numeric" error={errorFor('defaultInstallments')} onChange={(e) => set('defaultInstallments', e.target.value)} />
        <DatePicker label={tr.definitions.priceRules.form.validFrom} value={draft.validFrom} today={today} error={errorFor('validFrom')} onChange={(value) => set('validFrom', value)} />
        <div className={styles.formActions}>
          <Button onClick={onClose}>{tr.actions.cancel}</Button>
          <Button variant="primary" disabled={saving} onClick={onSubmit}>{saving ? tr.actions.saving : tr.actions.save}</Button>
        </div>
      </div>
    </Modal>
  )
}

function modelLabel(model: PriceRule['pricingModel']) {
  return {
    per_session: tr.definitions.priceRules.models.perSession,
    package: tr.definitions.priceRules.models.package,
    period: tr.definitions.priceRules.models.period,
  }[model]
}

function lessonKindLabel(isGroup: boolean | null) {
  if (isGroup === null) return tr.definitions.priceRules.lessonKinds.any
  return isGroup ? tr.definitions.priceRules.lessonKinds.group : tr.definitions.priceRules.lessonKinds.solo
}

function validityLabel(rule: PriceRule, today: string) {
  const state = priceRuleState(rule, today)
  if (state === 'current') return `${formatDate(rule.validFrom)}${tr.definitions.priceRules.validity.since}`
  if (state === 'future') return `${formatDate(rule.validFrom)}${tr.definitions.priceRules.validity.starts}`
  if (state === 'archived') return tr.definitions.priceRules.validity.archived
  return `${formatDate(rule.validFrom)}${tr.units.separator}${formatDate(rule.validTo)}`
}
