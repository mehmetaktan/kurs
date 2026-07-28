import { useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  cancelSession,
  deleteSessions,
  rescheduleSession,
  restoreCancelledSession,
  type AppError,
  type DaySessionRow,
  type DeleteReport,
  type SessionScope,
} from '../../lib/api'
import {
  Button,
  DatePicker,
  Input,
  Modal,
  ModalOption,
  Textarea,
  TimePicker,
  useToast,
} from '../../ui'
import styles from './Sessions.module.css'

/**
 * Silme kapsamı — **sıra bağlayıcı: en dar olan başta** (R3.8).
 *
 * `SessionScope` varsayılanı Rust tarafında da `Only`. Program kullanıcının yerine karar
 * vermiyor: üçü de net cümlelerle soruluyor ve hiçbiri önceden seçili gelmiyor.
 */
export const DELETE_SCOPES: readonly {
  value: SessionScope
  title: string
  hint: string
}[] = [
  { value: 'only', title: tr.sessions.remove.only, hint: tr.sessions.remove.onlyHint },
  {
    value: 'following',
    title: tr.sessions.remove.following,
    hint: tr.sessions.remove.followingHint,
  },
  { value: 'all', title: tr.sessions.remove.all, hint: tr.sessions.remove.allHint },
]

export type SessionAction = 'reschedule' | 'cancel' | 'restore' | 'remove'

interface Props {
  action: SessionAction | null
  row: DaySessionRow
  today: string
  onClose: () => void
  onDone: () => void
}

/** Ertele · İptal et · Sil — üçü de `Modal` üzerinde, hepsi onay istiyor. */
export function SessionActions({ action, row, today, onClose, onDone }: Props) {
  if (action === 'reschedule') {
    return <RescheduleModal row={row} today={today} onClose={onClose} onDone={onDone} />
  }
  if (action === 'cancel') {
    return <CancelModal row={row} onClose={onClose} onDone={onDone} />
  }
  if (action === 'restore') {
    return <RestoreModal row={row} onClose={onClose} onDone={onDone} />
  }
  if (action === 'remove') {
    return <RemoveModal row={row} onClose={onClose} onDone={onDone} />
  }
  return null
}

function RestoreModal({
  row,
  onClose,
  onDone,
}: {
  row: DaySessionRow
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await restoreCancelledSession(row.id)
      toast(tr.sessions.restore.done)
      onDone()
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={tr.sessions.restore.title}
      description={
        row.rescheduledOnce === true
          ? tr.sessions.restore.bodyRescheduled
          : tr.sessions.restore.body
      }
      onClose={onClose}
      actions={
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          {tr.sessions.restore.confirm}
        </Button>
      }
    >
      {error && (
        <p className={styles.formError} role="alert">
          {error.message}
        </p>
      )}
      <p className={styles.subject}>{sessionLabel(row)}</p>
    </Modal>
  )
}

/**
 * Erteleme. **Yoklaması alınmış ders taşınamaz** (R3.13) — kontrolü Rust yapıyor ve
 * mesajı olduğu gibi gösteriyoruz: kural tek yerde dursun, arayüz onu tahmin etmesin.
 */
function RescheduleModal({
  row,
  today,
  onClose,
  onDone,
}: {
  row: DaySessionRow
  today: string
  onClose: () => void
  onDone: () => void
}) {
  const [day, setDay] = useState<string | null>(row.startsAt.slice(0, 10))
  const [time, setTime] = useState<string | null>(row.startsAt.slice(11, 16))
  const [minutes, setMinutes] = useState(String(durationOf(row)))
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async () => {
    if (day === null || time === null) return
    setBusy(true)
    setError(null)
    try {
      await rescheduleSession(row.id, `${day} ${time}`, Number(minutes))
      toast(tr.sessions.reschedule.done)
      onDone()
    } catch (err) {
      setError(err as AppError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={tr.sessions.reschedule.title}
      description={tr.sessions.reschedule.body}
      onClose={onClose}
      actions={
        <Button variant="primary" disabled={busy} onClick={() => void submit()}>
          {tr.sessions.reschedule.confirm}
        </Button>
      }
    >
      <div className={styles.form}>
        {error && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <p className={styles.subject}>{sessionLabel(row)}</p>
        <DatePicker label={tr.sessions.form.date} today={today} value={day} onChange={setDay} />
        <div className={styles.pair}>
          <TimePicker label={tr.sessions.form.time} value={time} onChange={setTime} />
          <Input
            label={`${tr.sessions.form.duration} (${tr.sessions.form.minutesSuffix})`}
            value={minutes}
            inputMode="numeric"
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

/**
 * İptal — kayıt **silinmez**, durumu değişir (`VERI-MODELI §4`). Sebep isteğe bağlı ama
 * soruluyor: iptal edilmiş ders takvimde kalıyor ve "neden" sorusu üç ay sonra sorulur.
 */
function CancelModal({
  row,
  onClose,
  onDone,
}: {
  row: DaySessionRow
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await cancelSession(row.id, reason.trim() === '' ? null : reason.trim())
      toast(tr.sessions.cancelDialog.done)
      onDone()
    } catch (err) {
      setError(err as AppError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={tr.sessions.cancelDialog.title}
      description={tr.sessions.cancelDialog.body}
      onClose={onClose}
      actions={
        <ModalOption
          title={tr.sessions.cancelDialog.confirm}
          tone="danger"
          onClick={() => void submit()}
        />
      }
    >
      <div className={styles.form}>
        {error && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <p className={styles.subject}>{sessionLabel(row)}</p>
        <Textarea
          label={tr.sessions.cancelDialog.reason}
          hint={tr.sessions.cancelDialog.reasonHint}
          placeholder={tr.sessions.cancelDialog.reasonPlaceholder}
          rows={2}
          value={reason}
          disabled={busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  )
}

/**
 * Silme. Şablona bağlı derste kapsam **net sorulur** (R3.8); bağlı değilse soru hiç
 * çıkmaz — silinecek tek şey o ders.
 *
 * Bildirim `DeleteReport`'u okuyor ve **doğru anlatıyor**: şablona bağlı tek ders
 * arşivlenmiyor, `status='cancelled'` oluyor (`ux_session_series_slot` kısmi bir indeks;
 * arşivleme slotu boşaltır ve üretim dersi ertesi açılışta geri yazardı). "Silindi"
 * demek, kullanıcının ertesi sabah takvimde göreceği dersi yalanlamak olurdu.
 */
function RemoveModal({
  row,
  onClose,
  onDone,
}: {
  row: DaySessionRow
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (scope: SessionScope) => {
    setBusy(true)
    setError(null)
    try {
      toast(removedMessage(await deleteSessions(row.id, scope)))
      onDone()
    } catch (err) {
      setError(err as AppError)
      setBusy(false)
    }
  }

  const scopes = row.seriesId === null ? DELETE_SCOPES.slice(0, 1) : DELETE_SCOPES

  return (
    <Modal
      open
      title={tr.sessions.remove.title}
      description={
        row.seriesId === null ? tr.sessions.remove.bodySingle : tr.sessions.remove.bodySeries
      }
      onClose={onClose}
      actions={scopes.map((scope) => (
        <ModalOption
          key={scope.value}
          title={scope.title}
          hint={scope.hint}
          tone="danger"
          onClick={() => {
            if (!busy) void submit(scope.value)
          }}
        />
      ))}
    >
      <div className={styles.form}>
        {error && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <p className={styles.subject}>{sessionLabel(row)}</p>
      </div>
    </Modal>
  )
}

/** `Matematik · Grup A` — hangi ders üzerinde işlem yapıldığı her diyalogda yazılı. */
export function sessionLabel(row: DaySessionRow): string {
  return `${row.subjectName}${tr.units.separator}${row.title}`
}

function durationOf(row: DaySessionRow): number {
  const toMinutes = (stamp: string) =>
    Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16))
  const diff = toMinutes(row.endsAt) - toMinutes(row.startsAt)
  return diff > 0 ? diff : diff + 24 * 60
}

export function removedMessage(report: DeleteReport): string {
  if (report.cancelled > 0) return tr.sessions.remove.doneCancelled
  if (report.removed > 0) {
    return `${tr.sessions.remove.doneRemovedPrefix} ${report.removed} ${tr.sessions.remove.doneRemovedSuffix}`
  }
  return tr.sessions.remove.doneNone
}
