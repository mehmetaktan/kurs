import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchDaySessions,
  fetchDebtorRows,
  fetchHasSchedule,
  fetchLocalNow,
  type AppError,
  type DaySessionRow,
  type DebtorRow,
} from '../../lib/api'
import { formatDateWithWeekday, formatLira, formatTime } from '../../lib/format'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  Table,
} from '../../ui'
import type { Column } from '../../ui'
import { SessionActions, type SessionAction } from '../dersler/SessionActions'
import { SessionForm } from '../dersler/SessionForm'
import { TemplateModal } from '../dersler/TemplateModal'
import { subjectColorOf } from '../tanimlar/palette'
import { isPendingAttendance, pendingAttendanceCount, splitByNow } from './today'
import styles from './Today.module.css'
import { sortDebtors, visibleReceivableKurus } from '../odemeler/debtors'

/**
 * EKRANLAR.md §1 — açılış ekranı. Kurs sahibi her sabah bunu açıyor.
 *
 * Borç listesi defter kaynaklı gerçek veriyi gösterir. Paket uyarısı ve yedekleme
 * şeridi sonraki işlerini bekler; bölümler kaldırılmaz (R1.6).
 *
 * **"Şimdi" Rust'tan geliyor** (`local_now`, `chrono::Local`): §0'ın SQLite için koyduğu
 * kural arayüzde de geçerli, yoksa "bugün" iki ayrı yerden gelirdi.
 */
export function TodayPage() {
  const [now, setNow] = useState<string | null>(null)
  const [rows, setRows] = useState<DaySessionRow[] | null>(null)
  const [hasSchedule, setHasSchedule] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const [debtors, setDebtors] = useState<DebtorRow[] | null>(null)
  const [debtError, setDebtError] = useState<AppError | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editing, setEditing] = useState<DaySessionRow | null>(null)
  const [action, setAction] = useState<{ row: DaySessionRow; kind: SessionAction } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setDebtError(null)
    setDebtors(null)
    try {
      const stamp = await fetchLocalNow()
      setNow(stamp)
      const [today, schedule] = await Promise.all([
        fetchDaySessions(stamp.slice(0, 10)),
        fetchHasSchedule(),
      ])
      setRows(today)
      setHasSchedule(schedule)
      try {
        const debtRows = await fetchDebtorRows({ search: null, filter: 'all', today: stamp.slice(0, 10) })
        setDebtors(sortDebtors(debtRows.filter((row) => !row.archived), 'debt_desc'))
      } catch (err) {
        setDebtError(err as AppError)
      }
    } catch (err) {
      setError(err as AppError)
      setRows(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = now?.slice(0, 10) ?? null
  const split = useMemo(() => splitByNow(rows ?? [], now ?? ''), [rows, now])
  const pending = useMemo(() => pendingAttendanceCount(rows ?? [], now ?? ''), [rows, now])

  const columns = useMemo(
    () =>
      buildColumns(now ?? '', (row, kind) => setAction({ row, kind })),
    [now],
  )

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  /** Satıra tıklamak dersi açar (EKRANLAR §1 "Yapılabilenler"). */
  const openEdit = (row: DaySessionRow) => {
    setEditing(row)
    setFormOpen(true)
  }

  const refresh = () => {
    setFormOpen(false)
    setTemplateOpen(false)
    setAction(null)
    setEditing(null)
    void load()
  }

  return (
    <>
      <PageHeader
        title={tr.pages.today.title}
        subtitle={today === null ? undefined : formatDateWithWeekday(today)}
        action={
          <Button variant="primary" onClick={openNew}>
            {tr.today.newSession}
          </Button>
        }
      />

      <PageContent>
        <div className={styles.layout}>
          <section className={styles.lessons}>
            <SectionHeader
              title={tr.today.lessons.heading}
              meta={
                rows === null ? null : (
                  <span className={styles.sectionMeta}>
                    {rows.length} {tr.today.lessons.countSuffix}
                    {pending > 0 && (
                      <>
                        {tr.units.separator}
                        <span className={styles.pending}>
                          {pending} {tr.today.lessons.pendingSuffix}
                        </span>
                      </>
                    )}
                  </span>
                )
              }
            />

            {rows === null && !error && <LoadingState />}
            {error && <ErrorState message={error.message} onRetry={() => void load()} />}

            {rows !== null && !error && rows.length === 0 && (
              <TodayEmptyState
                hasSchedule={hasSchedule}
                onCreate={openNew}
                onTemplate={() => setTemplateOpen(true)}
              />
            )}

            {rows !== null && !error && rows.length > 0 && (
              <>
                {split.past.length > 0 && (
                  <Table
                    label={tr.today.lessons.heading}
                    columns={columns}
                    rows={split.past}
                    rowKey={(row) => row.id}
                    onRowClick={openEdit}
                    rowAttention={(row) => isPendingAttendance(row, now ?? '')}
                  />
                )}

                {/* R1.1 — çizgi YALNIZCA hem geçmiş hem gelecek ders varsa çıkar. */}
                {split.showNowLine && (
                  <div className={styles.nowLine}>
                    <span className={styles.nowLabel}>{tr.today.lessons.nowLine}</span>
                    <span className={styles.nowRule} aria-hidden="true" />
                  </div>
                )}

                {split.future.length > 0 && (
                  <Table
                    label={tr.today.lessons.heading}
                    columns={columns}
                    rows={split.future}
                    rowKey={(row) => row.id}
                    onRowClick={openEdit}
                    hideHeader={split.past.length > 0}
                  />
                )}
              </>
            )}
          </section>

          {/* Üç yan bölüm tasarımda kalır; borç listesi artık defterden okunur. */}
          <aside className={styles.side}>
            <DebtorSection rows={debtors} error={debtError} />
            <SideSection title={tr.today.packages.heading} body={tr.today.packages.soon} />
            <SideSection title={tr.today.backup.heading} body={tr.today.backup.soon} />
          </aside>
        </div>
      </PageContent>

      {today !== null && (
        <SessionForm
          open={formOpen}
          today={today}
          session={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSaved={refresh}
        />
      )}

      {today !== null && (
        <TemplateModal
          open={templateOpen}
          today={today}
          onClose={() => setTemplateOpen(false)}
          onApplied={refresh}
        />
      )}

      {today !== null && action !== null && (
        <SessionActions
          action={action.kind}
          row={action.row}
          today={today}
          onClose={() => setAction(null)}
          onDone={refresh}
        />
      )}
    </>
  )
}

/** Tasarımdaki `54px / 1fr / 128px / 84px / 190px` ders satırı. */
function buildColumns(
  now: string,
  onAction: (row: DaySessionRow, kind: SessionAction) => void,
): Column<DaySessionRow>[] {
  return [
    {
      key: 'time',
      header: tr.today.lessons.table.time,
      width: '76px',
      render: (row) => <span className={styles.time}>{formatTime(row.startsAt)}</span>,
    },
    {
      key: 'lesson',
      header: tr.today.lessons.table.lesson,
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <span className={styles.lessonCell}>
          <span
            className={styles.swatch}
            style={{ background: subjectColorOf(row.subjectColor) }}
            aria-hidden
          />
          <span className={styles.lessonText}>
            <span className={styles.lessonTitle}>
              {row.subjectName}
              {tr.units.separator}
              {row.title}
            </span>
            <span className={styles.lessonMeta}>
              {row.kind === 'group' ? tr.today.lessons.group : tr.today.lessons.solo}
              {row.isMakeup && (
                <>
                  {tr.units.separator}
                  {tr.today.lessons.makeup}
                </>
              )}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'students',
      header: tr.today.lessons.table.students,
      width: '104px',
      align: 'end',
      render: (row) => (
        <span className={styles.tabular}>
          {row.studentCount} {tr.today.lessons.studentSuffix}
        </span>
      ),
    },
    {
      key: 'attendance',
      header: tr.today.lessons.table.attendance,
      width: '168px',
      render: (row) => <AttendanceCell row={row} now={now} />,
    },
    {
      key: 'actions',
      header: tr.today.lessons.table.action,
      width: '210px',
      align: 'end',
      render: (row) => (
        <span className={styles.rowActions}>
          <Button size="small" onClick={() => onAction(row, 'reschedule')}>
            {tr.sessions.actions.reschedule}
          </Button>
          {row.status !== 'cancelled' && (
            <Button size="small" onClick={() => onAction(row, 'cancel')}>
              {tr.sessions.actions.cancel}
            </Button>
          )}
          <Button size="small" onClick={() => onAction(row, 'remove')}>
            {tr.sessions.actions.remove}
          </Button>
        </span>
      ),
    },
  ]
}

/** Yoklamanın üç durumu (EKRANLAR §1). "Yoklama al" düğmesi Faz 6'da gelir. */
function AttendanceCell({ row, now }: { row: DaySessionRow; now: string }) {
  if (row.status === 'cancelled') {
    return <Badge tone="neutral">{tr.today.lessons.cancelled}</Badge>
  }
  if (row.attendanceTaken) {
    return (
      <span className={styles.attendanceDone}>
        {row.presentCount}/{row.markedCount} {tr.today.lessons.attendanceDone}
      </span>
    )
  }
  if (isPendingAttendance(row, now)) {
    return <Badge tone="warn">{tr.today.lessons.attendanceMissing}</Badge>
  }
  return <span className={styles.muted}>{tr.today.lessons.attendanceWaiting}</span>
}

/**
 * İki ayrı boşluk, iki ayrı cümle (R1.6 / R1.7).
 *
 * "Bugün ders yok" ile "program hiç kurulmamış" aynı şey değil: ilkinde yapacak bir şey
 * yok, ikincisinde uygulamanın tamamı boş kalıyor ve kullanıcının ne yapması gerektiğini
 * söylemek zorundayız. Boş bir gün listesi **iki durumu da** üretiyor, ayrımı yalnızca
 * `has_schedule` verebiliyor — R1.7 bu yüzden ayrı bir sorgu istiyor.
 */
function TodayEmptyState({
  hasSchedule,
  onCreate,
  onTemplate,
}: {
  hasSchedule: boolean
  onCreate: () => void
  onTemplate: () => void
}) {
  if (hasSchedule) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.today.lessons.empty}
        body={tr.today.lessons.emptyBody}
        secondaryAction={<Button onClick={onCreate}>{tr.today.newSession}</Button>}
      />
    )
  }

  return (
    <EmptyState
      title={tr.today.lessons.noSchedule}
      body={tr.today.lessons.noScheduleBody}
      action={
        <Button variant="primary" onClick={onCreate}>
          {tr.today.lessons.noScheduleAction}
        </Button>
      }
      secondaryAction={<Button onClick={onTemplate}>{tr.today.fromTemplate}</Button>}
    />
  )
}

function SideSection({ title, body }: { title: string; body: string }) {
  return (
    <Card className={styles.sideCard}>
      <SectionHeader title={title} />
      <p className={styles.sideBody}>{body}</p>
    </Card>
  )
}

function DebtorSection({ rows, error }: { rows: DebtorRow[] | null; error: AppError | null }) {
  const total = rows === null ? 0 : visibleReceivableKurus(rows)
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.today.debtors.heading}
        meta={rows === null ? null : `${rows.length} ${tr.today.debtors.countSuffix}${tr.units.separator}${formatLira(total)}`}
      />
      {rows === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} />}
      {rows !== null && !error && rows.length === 0 && <p className={styles.sideBody}>{tr.today.debtors.empty}</p>}
      {rows !== null && !error && rows.length > 0 && (
        <div className={styles.debtorList}>
          {rows.map((row) => (
            <div className={styles.debtorRow} key={row.studentId}>
              <span>{row.fullName}</span>
              <strong>{formatLira(row.debtKurus)}</strong>
              <small>{row.daysOverdue && row.daysOverdue > 0 ? `${row.daysOverdue} ${tr.today.debtors.daysOverdue}` : tr.today.debtors.current}</small>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
