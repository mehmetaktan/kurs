import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  applyTemplate,
  fetchTemplatePreview,
  type AppError,
  type ApplyTemplateReport,
  type TemplatePreview,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import { Badge, Button, DatePicker, EmptyState, LoadingState, Modal, useToast } from '../../ui'
import { WEEKDAYS } from '../tanimlar/ClosedDaysTab'
import styles from './Sessions.module.css'

interface Props {
  open: boolean
  today: string
  onClose: () => void
  onApplied: () => void
}

/**
 * EKRANLAR.md E6 — Şablondan oluştur.
 *
 * **Önizleme onaydan önce gösterilir** (`faz-05b.md §2`): kaç ders ve hangi tarihler.
 * Bu bir kolaylık değil güvenlik: işlem 16 haftalık program üretiyor ve geri alması
 * ders ders silmek demek.
 *
 * Ne yaptığı: kaynak haftanın dersleri **haftalık şablona çevrilir**, kopyalanmaz.
 * Kopyalansaydı N hafta sonra takvim yeniden boşalır ve kullanıcı aynı işlemi tekrar
 * etmek zorunda kalırdı; şablon bir kez tanımlanır, üretim ufka kadar kendiliğinden
 * yürür (§1.14).
 */
export function TemplateModal({ open, today, onClose, onApplied }: Props) {
  const [sourceDay, setSourceDay] = useState<string | null>(() => weekBefore(today))
  const [applyFrom, setApplyFrom] = useState<string | null>(today)
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    if (sourceDay === null || applyFrom === null) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await fetchTemplatePreview(sourceDay, applyFrom))
    } catch (err) {
      setError(err as AppError)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [sourceDay, applyFrom])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const submit = async () => {
    if (sourceDay === null || applyFrom === null) return
    setBusy(true)
    setError(null)
    try {
      toast(appliedMessage(await applyTemplate(sourceDay, applyFrom)))
      onApplied()
    } catch (err) {
      setError(err as AppError)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const fresh = preview?.slots.filter((slot) => !slot.alreadyPlanned) ?? []

  return (
    <Modal
      open
      title={tr.sessions.template.title}
      description={tr.sessions.template.body}
      onClose={onClose}
      actions={
        <Button
          variant="primary"
          disabled={busy || loading || fresh.length === 0}
          onClick={() => void submit()}
        >
          {tr.sessions.template.confirm}
        </Button>
      }
    >
      <div className={styles.form}>
        {error && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}

        <DatePicker
          label={tr.sessions.template.sourceWeek}
          hint={tr.sessions.template.sourceWeekHint}
          today={today}
          value={sourceDay}
          onChange={setSourceDay}
        />
        <DatePicker
          label={tr.sessions.template.applyFrom}
          today={today}
          value={applyFrom}
          onChange={setApplyFrom}
        />

        {loading && <LoadingState inline />}

        {!loading && preview !== null && preview.slots.length === 0 && (
          <EmptyState
            kind="no-filter-results"
            title={tr.sessions.template.empty}
            body={tr.sessions.template.emptyBody}
          />
        )}

        {!loading && preview !== null && preview.slots.length > 0 && (
          <div>
            <p className={styles.previewHead}>
              {formatDate(preview.weekStart)} – {formatDate(preview.weekEnd)}
              {tr.units.separator}
              {fresh.length} {tr.sessions.template.previewCountSuffix}
            </p>
            <ul className={styles.previewList}>
              {preview.slots.map((slot) => (
                <li
                  key={`${slot.weekday}-${slot.startTime}-${slot.label}`}
                  className={styles.previewItem}
                >
                  <span className={styles.previewLabel}>{slot.label}</span>
                  <span className={styles.previewMeta}>
                    {weekdayName(slot.weekday)} {slot.startTime}
                    {tr.units.separator}
                    {tr.sessions.template.firstOnPrefix} {formatDate(slot.firstOn)}
                  </span>
                  {/* Atlanan satır GİZLENMİYOR: kullanıcı 4 ders sayıp 3 görürse
                      programın kaybettiğini sanar. */}
                  {slot.alreadyPlanned && (
                    <Badge tone="neutral">{tr.sessions.template.alreadyPlanned}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function weekdayName(weekday: number): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? ''
}

/** Varsayılan kaynak hafta: bir önceki hafta — "geçen hafta neyse bu hafta da o". */
function weekBefore(today: string): string {
  const [year, month, date] = today.split('-').map(Number)
  if (year === undefined || month === undefined || date === undefined) return today
  const day = new Date(Date.UTC(year, month - 1, date - 7))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`
}

export function appliedMessage(report: ApplyTemplateReport): string {
  if (report.seriesCreated === 0) return tr.sessions.template.nothing
  const head = `${report.seriesCreated} ${tr.sessions.template.donePrefix}`
  if (report.skipped === 0) return head
  return `${head} ${tr.sessions.template.doneSkippedPrefix} ${report.skipped} ${tr.sessions.template.doneSkippedSuffix}`
}
