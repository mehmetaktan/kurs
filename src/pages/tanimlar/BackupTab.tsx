import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  copyBackupTo,
  createBackupNow,
  fetchBackupStatus,
  openBackupDirectory,
  restoreBackup,
  selectBackupDestination,
  selectBackupFile,
  updateSetting,
  type AppError,
  type BackupLog,
  type BackupStatus,
} from '../../lib/api'
import { formatDate, formatTime } from '../../lib/format'
import { navigate } from '../../lib/router'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  SectionHeader,
  Table,
  useToast,
  type Column,
} from '../../ui'
import styles from './Definitions.module.css'

/** E19 — kullanıcıya görünür yedek klasörü, geçmiş ve kurtarma işlemleri. */
export function BackupTab() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const [restorePath, setRestorePath] = useState<string | null>(null)
  const [restoreStep, setRestoreStep] = useState<0 | 1 | 2>(0)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(await fetchBackupStatus())
    } catch (caught) {
      setStatus(null)
      setError(caught as AppError)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const manualBackup = async () => {
    setBusy(true)
    setError(null)
    try {
      await createBackupNow()
      toast(tr.backup.messages.created)
      await load()
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setBusy(false)
    }
  }

  const openFolder = async (directory: string) => {
    setError(null)
    try {
      await openBackupDirectory(directory)
    } catch (caught) {
      setError(caught as AppError)
    }
  }

  const chooseRestore = async () => {
    try {
      const path = await selectBackupFile()
      if (!path) return
      setRestorePath(path)
      setRestoreStep(1)
    } catch (caught) {
      setError(caught as AppError)
    }
  }

  const confirmRestore = async () => {
    const path = restorePath
    if (!path) return
    setRestoreStep(0)
    setBusy(true)
    setError(null)
    try {
      await restoreBackup(path)
      toast(tr.backup.messages.restored)
      navigate('/')
    } catch (caught) {
      setError(caught as AppError)
      setRestorePath(null)
    } finally {
      setBusy(false)
    }
  }

  const copyToExternal = async (log: BackupLog) => {
    setError(null)
    try {
      const destination = await selectBackupDestination()
      if (!destination) return
      await copyBackupTo(log.filePath, destination)
      toast(tr.backup.messages.copied)
    } catch (caught) {
      setError(caught as AppError)
    }
  }

  const columns = useMemo<readonly Column<BackupLog>[]>(
    () => [
      {
        key: 'date',
        header: tr.backup.table.date,
        width: '170px',
        render: (row) => (
          <span className={styles.tabular}>
            {formatDate(row.takenAt.slice(0, 10))}
            {tr.units.separator}
            {formatTime(row.takenAt)}
          </span>
        ),
      },
      {
        key: 'kind',
        header: tr.backup.table.kind,
        width: '120px',
        render: (row) => (row.isAuto ? tr.backup.table.automatic : tr.backup.table.manual),
      },
      {
        key: 'size',
        header: tr.backup.table.size,
        width: '120px',
        align: 'end',
        render: (row) => <span className={styles.tabular}>{formatFileSize(row.sizeBytes)}</span>,
      },
      {
        key: 'status',
        header: tr.backup.table.status,
        width: 'minmax(190px, 1fr)',
        render: (row) =>
          row.ok ? (
            <Badge tone="success">{tr.backup.table.success}</Badge>
          ) : (
            <span className={styles.backupFailure}>
              <Badge tone="danger">{tr.backup.table.failed}</Badge>
              {row.error && <small>{row.error}</small>}
            </span>
          ),
      },
      {
        key: 'action',
        header: tr.backup.table.action,
        width: '160px',
        align: 'end',
        render: (row) =>
          row.ok ? (
            <Button size="small" disabled={busy} onClick={() => void copyToExternal(row)}>
              {tr.backup.actions.copy}
            </Button>
          ) : null,
      },
    ],
    [busy],
  )

  if (status === null && !error) return <LoadingState />
  if (status === null && error) {
    return <ErrorState message={error.message} details={error.details} onRetry={() => void load()} />
  }
  if (status === null) return null

  return (
    <section className={styles.section}>
      <SectionHeader title={tr.backup.heading} />
      <div className={styles.sectionHead}>
        <p className={styles.lead}>{tr.backup.lead}</p>
        <div className={styles.backupActions}>
          <Button disabled={busy} onClick={() => void openFolder(status.directory)}>
            {tr.backup.actions.openFolder}
          </Button>
          <Button disabled={busy} onClick={() => void chooseRestore()}>
            {tr.backup.actions.restore}
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void manualBackup()}>
            {busy ? tr.backup.actions.working : tr.backup.actions.create}
          </Button>
        </div>
      </div>

      {error && (
        <div className={styles.backupError}>
          <ErrorState inline message={error.message} details={error.details} />
        </div>
      )}

      <div className={styles.backupSettings}>
        <div className={styles.card}>
          <span className={styles.backupLabel}>{tr.backup.directory.label}</span>
          <strong className={styles.backupPath}>{status.directory}</strong>
          <span className={styles.settingHint}>{tr.backup.directory.hint}</span>
        </div>
        <WarnDays value={status.warnDays} onSaved={load} onError={setError} />
      </div>

      <div className={styles.backupHistory}>
        <SectionHeader
          title={tr.backup.history}
          meta={`${status.logs.length} ${tr.backup.table.countSuffix}`}
        />
        <Table
          label={tr.backup.table.label}
          columns={columns}
          rows={status.logs}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState title={tr.backup.empty.title} body={tr.backup.empty.body} />
          }
        />
      </div>

      <ConfirmDialog
        open={restoreStep === 1}
        title={tr.backup.restore.firstTitle}
        description={tr.backup.restore.firstDescription}
        confirmLabel={tr.backup.restore.firstConfirm}
        confirmHint={tr.backup.restore.firstHint}
        destructive
        onConfirm={() => setRestoreStep(2)}
        onCancel={() => {
          setRestoreStep(0)
          setRestorePath(null)
        }}
      />
      <ConfirmDialog
        open={restoreStep === 2}
        title={tr.backup.restore.secondTitle}
        description={tr.backup.restore.secondDescription}
        confirmLabel={tr.backup.restore.secondConfirm}
        confirmHint={tr.backup.restore.secondHint}
        destructive
        onConfirm={() => void confirmRestore()}
        onCancel={() => {
          setRestoreStep(0)
          setRestorePath(null)
        }}
      />
    </section>
  )
}

function WarnDays({
  value,
  onSaved,
  onError,
}: {
  value: number
  onSaved: () => Promise<void>
  onError: (error: AppError | null) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const save = async () => {
    const next = Number(text)
    if (!Number.isInteger(next) || next < 1 || next > 30) {
      setText(String(value))
      onError({
        code: 'backup.warnDays',
        message: tr.backup.warnDays.error,
      })
      return
    }
    if (next === value) return
    try {
      await updateSetting('backup_warn_days', String(next))
      await onSaved()
    } catch (caught) {
      onError(caught as AppError)
      setText(String(value))
    }
  }

  return (
    <div className={styles.card}>
      <Input
        label={tr.backup.warnDays.label}
        hint={tr.backup.warnDays.hint}
        inputMode="numeric"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setText(String(value))
        }}
      />
    </div>
  )
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return tr.units.emptyValue
  const kilobytes = Math.max(1, Math.ceil(bytes / 1024))
  if (kilobytes < 1024) return `${kilobytes} ${tr.backup.units.kilobyte}`
  const tenths = Math.round((kilobytes * 10) / 1024)
  return `${Math.floor(tenths / 10)},${tenths % 10} ${tr.backup.units.megabyte}`
}
