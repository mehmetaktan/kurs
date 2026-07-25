import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  archiveClosedDay,
  fetchClosedDays,
  fetchWeeklyClosedDays,
  saveClosedDay,
  setWeeklyClosedDays,
  type AppError,
  type ClosedDay,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  SectionHeader,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import styles from './Definitions.module.css'

const DRAFT_ID = 0

/**
 * Haftanın günleri, **şemanın numaralandırmasıyla**: 1 = Pazartesi … 7 = Pazar
 * (`session_series.weekday`, `setting.weekly_closed_days`).
 *
 * `tr.calendar.weekdays` Pazar'dan başlıyor çünkü `Date.prototype.getDay()` öyle;
 * buradaki sıra ondan farklı ve bu **bilinçli** — iki numaralandırmayı tek listeye
 * sıkıştırmak, birinin diğerine dönüştürüldüğü yeri gizler.
 */
export const WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 1, label: tr.calendar.weekdays[1] },
  { value: 2, label: tr.calendar.weekdays[2] },
  { value: 3, label: tr.calendar.weekdays[3] },
  { value: 4, label: tr.calendar.weekdays[4] },
  { value: 5, label: tr.calendar.weekdays[5] },
  { value: 6, label: tr.calendar.weekdays[6] },
  { value: 7, label: tr.calendar.weekdays[0] },
]

/** EKRANLAR.md E8 — Tanımlar → Tatil / kapalı günler. Takvim buradan besleniyor. */
export function ClosedDaysTab() {
  const [days, setDays] = useState<ClosedDay[] | null>(null)
  const [weekly, setWeekly] = useState<number[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftDay, setDraftDay] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [fieldError, setFieldError] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<ClosedDay | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextDays, nextWeekly] = await Promise.all([
        fetchClosedDays(),
        fetchWeeklyClosedDays(),
      ])
      setDays(nextDays)
      setWeekly(nextWeekly)
    } catch (err) {
      setError(err as AppError)
      setDays(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleWeekday = async (weekday: number, checked: boolean) => {
    const next = checked ? [...weekly, weekday] : weekly.filter((d) => d !== weekday)
    // İyimser güncelleme: onay kutusu tıklandığı anda değişmeli, sunucuyu beklememeli.
    // Hata olursa `load()` gerçek durumu geri yazıyor.
    setWeekly(next)
    try {
      await setWeeklyClosedDays(next)
      toast(tr.definitions.closedDays.weekly.saved)
    } catch (err) {
      setError(err as AppError)
      await load()
    }
  }

  const startCreate = () => {
    setFieldError(null)
    setEditingId(DRAFT_ID)
    setDraftDay(null)
    setDraftLabel('')
  }

  const startEdit = (row: ClosedDay) => {
    setFieldError(null)
    setEditingId(row.id)
    setDraftDay(row.day)
    setDraftLabel(row.label)
  }

  const submit = async () => {
    try {
      await saveClosedDay({
        id: editingId === DRAFT_ID ? null : editingId,
        day: draftDay ?? '',
        label: draftLabel,
      })
      toast(tr.definitions.closedDays.saved)
      setEditingId(null)
      setFieldError(null)
      await load()
    } catch (err) {
      setFieldError(err as AppError)
    }
  }

  const confirmArchive = async () => {
    if (!archiving) return
    try {
      await archiveClosedDay(archiving.id)
      toast(tr.definitions.closedDays.archive.done)
      setArchiving(null)
      await load()
    } catch (err) {
      setArchiving(null)
      setError(err as AppError)
    }
  }

  // Tarih kolonu — metin değil zaman: `ORDER BY` yasağı (ADR-020) buraya uygulanmaz,
  // ama sıralama yine arayüzde çünkü Rust listeyi sırasız veriyor.
  const sorted = [...(days ?? [])].sort((a, b) => a.day.localeCompare(b.day))
  const rows: ClosedDay[] =
    editingId === DRAFT_ID ? [{ id: DRAFT_ID, day: '', label: '' }, ...sorted] : sorted

  const columns: Column<ClosedDay>[] = [
    {
      key: 'day',
      header: tr.definitions.closedDays.table.day,
      width: '200px',
      render: (row) =>
        row.id === editingId ? (
          <DatePicker
            value={draftDay}
            onChange={setDraftDay}
            aria-label={tr.definitions.closedDays.form.day}
          />
        ) : (
          <span className={styles.tabular}>{formatDate(row.day)}</span>
        ),
    },
    {
      key: 'label',
      header: tr.definitions.closedDays.table.label_,
      width: 'minmax(200px, 1fr)',
      render: (row) =>
        row.id === editingId ? (
          <Input
            value={draftLabel}
            placeholder={tr.definitions.closedDays.form.labelPlaceholder}
            aria-label={tr.definitions.closedDays.form.label}
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') setEditingId(null)
            }}
          />
        ) : (
          row.label
        ),
    },
    {
      key: 'action',
      header: tr.definitions.closedDays.table.action,
      width: '190px',
      align: 'end',
      render: (row) =>
        row.id === editingId ? (
          <span className={styles.colorRow}>
            <Button size="small" onClick={() => setEditingId(null)}>
              {tr.actions.cancel}
            </Button>
            <Button size="small" variant="primary" onClick={() => void submit()}>
              {tr.actions.save}
            </Button>
          </span>
        ) : (
          <span className={styles.colorRow}>
            <Button size="small" onClick={() => startEdit(row)}>
              {tr.actions.edit}
            </Button>
            <Button size="small" onClick={() => setArchiving(row)}>
              {tr.definitions.closedDays.archive.confirm}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <>
      <section className={styles.section}>
        <SectionHeader title={tr.definitions.closedDays.weekly.heading} />
        <p className={styles.lead}>{tr.definitions.closedDays.weekly.lead}</p>
        <div className={styles.card}>
          <div className={styles.weekdayRow} role="group" aria-label={tr.definitions.closedDays.weekly.heading}>
            {WEEKDAYS.map((day) => (
              <Checkbox
                key={day.value}
                label={day.label}
                checked={weekly.includes(day.value)}
                onChange={(event) => void toggleWeekday(day.value, event.target.checked)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <SectionHeader title={tr.definitions.closedDays.heading} />
            <p className={styles.lead}>{tr.definitions.closedDays.lead}</p>
          </div>
          <Button variant="primary" onClick={startCreate} disabled={editingId === DRAFT_ID}>
            {tr.definitions.closedDays.newDay}
          </Button>
        </div>

        {days === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}

        {fieldError && (
          <p className={styles.formError} role="alert">
            {fieldError.message}
          </p>
        )}

        {days !== null && !error && (
          <Table
            label={tr.definitions.closedDays.table.label}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            emptyState={
              <EmptyState
                title={tr.definitions.closedDays.empty}
                body={tr.definitions.closedDays.emptyBody}
                action={
                  <Button variant="primary" onClick={startCreate}>
                    {tr.definitions.closedDays.newDay}
                  </Button>
                }
              />
            }
          />
        )}
      </section>

      <ConfirmDialog
        open={archiving !== null}
        title={tr.definitions.closedDays.archive.title}
        description={`${formatDate(archiving?.day)} ${tr.definitions.closedDays.archive.body}`}
        confirmLabel={tr.definitions.closedDays.archive.confirm}
        destructive
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiving(null)}
      />
    </>
  )
}
