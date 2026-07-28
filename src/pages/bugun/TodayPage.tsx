import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchDashboardSessions,
  fetchDashboardStudentIds,
  cancelSession,
  fetchBackupStatus,
  fetchDebtorRows,
  fetchHasSchedule,
  fetchLocalNow,
  fetchMakeupDebts,
  fetchUpcomingPayments,
  fetchReportOverview,
  fetchStudentList,
  createBackupNow,
  type AppError,
  type BackupStatus,
  type DaySessionRow,
  type DebtorRow,
  type MakeupDebtRow,
  type ReportOverview,
  type StudentRow,
  type UpcomingPaymentRow,
} from '../../lib/api'
import { formatDate, formatLira, formatTime } from '../../lib/format'
import { navigate } from '../../lib/router'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import { STUDENTS_PATH } from '../../shell/routes'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatCard,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { AttendanceDrawer } from '../dersler/AttendanceDrawer'
import { SessionActions, type SessionAction } from '../dersler/SessionActions'
import { SessionForm, type MakeupSource } from '../dersler/SessionForm'
import { subjectColorOf } from '../tanimlar/palette'
import { sortTrBy } from '../../lib/sortTr'
import {
  backupAgeDays,
  isPendingAttendance,
  lowPackageRows,
  pendingAttendanceCount,
  splitByNow,
} from './today'
import styles from './Today.module.css'
import { sortDebtors, visibleReceivableKurus } from '../odemeler/debtors'
import { PaymentModal } from '../odemeler/PaymentModal'
import { canTakeAttendance } from '../dersler/attendancePolicy'

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
  const [makeupDebts, setMakeupDebts] = useState<MakeupDebtRow[] | null>(null)
  const [makeupError, setMakeupError] = useState<AppError | null>(null)
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPaymentRow[] | null>(null)
  const [upcomingError, setUpcomingError] = useState<AppError | null>(null)
  const [overview, setOverview] = useState<ReportOverview | null>(null)
  const [overviewError, setOverviewError] = useState<AppError | null>(null)
  const [students, setStudents] = useState<StudentRow[] | null>(null)
  const [packageError, setPackageError] = useState<AppError | null>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [backupError, setBackupError] = useState<AppError | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DaySessionRow | null>(null)
  const [action, setAction] = useState<{ row: DaySessionRow; kind: SessionAction } | null>(null)
  const [attendanceRow, setAttendanceRow] = useState<DaySessionRow | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<{
    studentId: number
    amountKurus: number
  } | null>(null)
  const [dashboardMakeup, setDashboardMakeup] = useState<MakeupSource | null>(null)
  const [cancelMakeup, setCancelMakeup] = useState<MakeupDebtRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setDebtError(null)
    setMakeupError(null)
    setUpcomingError(null)
    setOverviewError(null)
    setPackageError(null)
    setBackupError(null)
    setDebtors(null)
    setMakeupDebts(null)
    setUpcomingPayments(null)
    setOverview(null)
    setStudents(null)
    setBackupStatus(null)
    try {
      const stamp = await fetchLocalNow()
      setNow(stamp)
      const [windowRows, windowStudentIds, schedule] = await Promise.all([
        fetchDashboardSessions(stamp),
        fetchDashboardStudentIds(stamp),
        fetchHasSchedule(),
      ])
      const studentIds = new Set(windowStudentIds)
      setRows(windowRows)
      setHasSchedule(schedule)
      try {
        const debtRows = await fetchDebtorRows({ search: null, filter: 'all', today: stamp.slice(0, 10) })
        setDebtors(sortDebtors(
          debtRows.filter((row) => !row.archived && studentIds.has(row.studentId)),
          'debt_desc',
        ))
      } catch (err) {
        setDebtError(err as AppError)
      }
      try {
        const makeupRows = await fetchMakeupDebts()
        setMakeupDebts(sortTrBy(
          makeupRows.filter((row) => studentIds.has(row.studentId)),
          (row) => row.fullName,
        ))
      } catch (err) {
        setMakeupError(err as AppError)
      }
      try {
        const paymentRows = await fetchUpcomingPayments(stamp)
        setUpcomingPayments(sortTrBy(paymentRows, (row) => row.fullName))
      } catch (err) {
        setUpcomingError(err as AppError)
      }
      try {
        setOverview(await fetchReportOverview(stamp))
      } catch (err) {
        setOverviewError(err as AppError)
      }
      try {
        setStudents(
          (await fetchStudentList({ today: stamp.slice(0, 10) }))
            .filter((row) => studentIds.has(row.id)),
        )
      } catch (err) {
        setPackageError(err as AppError)
      }
      try {
        setBackupStatus(await fetchBackupStatus())
      } catch (err) {
        setBackupError(err as AppError)
      }
    } catch (err) {
      setError(err as AppError)
      setRows(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refreshClock = () => void fetchLocalNow().then(setNow).catch(() => undefined)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshClock()
    }
    window.addEventListener('focus', refreshClock)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(refreshClock, 60_000)
    return () => {
      window.removeEventListener('focus', refreshClock)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [])

  const today = now?.slice(0, 10) ?? null
  const split = useMemo(() => splitByNow(rows ?? [], now ?? ''), [rows, now])
  const pending = useMemo(() => pendingAttendanceCount(rows ?? [], now ?? ''), [rows, now])
  const endingPackages = useMemo(() => lowPackageRows(students ?? []), [students])

  const columns = useMemo(
    () =>
      buildColumns(
        now ?? '',
        (row, kind) => setAction({ row, kind }),
        (row) => setAttendanceRow(row),
      ),
    [now],
  )

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  /** Satıra tıklamak dersi açar (EKRANLAR §1 "Yapılabilenler"). */
  const openEdit = (row: DaySessionRow) => {
    if (row.status === 'cancelled') {
      if (row.restoreAllowed === false) {
        toast(tr.sessions.restore.movedSource)
        return
      }
      setAction({ row, kind: 'restore' })
      return
    }
    setEditing(row)
    setFormOpen(true)
  }

  const refresh = () => {
    setFormOpen(false)
    setAction(null)
    setEditing(null)
    setAttendanceRow(null)
    void load()
  }

  const backupNow = async () => {
    setBackupBusy(true)
    setBackupError(null)
    try {
      await createBackupNow()
      toast(tr.backup.messages.created)
      await load()
    } catch (caught) {
      setBackupError(caught as AppError)
    } finally {
      setBackupBusy(false)
    }
  }

  const confirmCancelMakeup = async () => {
    const sessionId = cancelMakeup?.makeupSessionId
    if (sessionId === null || sessionId === undefined) return
    try {
      await cancelSession(sessionId, tr.makeup.cancelPlan)
      toast(tr.makeup.cancelled)
      setCancelMakeup(null)
      await load()
    } catch (caught) {
      setMakeupError(caught as AppError)
    }
  }

  return (
    <>
      <PageHeader
        title={tr.pages.today.title}
        subtitle={today === null ? undefined : tr.today.windowSubtitle}
        action={
          <Button variant="primary" onClick={openNew}>
            {tr.today.newSession}
          </Button>
        }
      />

      <PageContent>
        <TodaySummary
          overview={overview}
          error={overviewError}
          debtors={debtors}
          debtError={debtError}
          makeups={makeupDebts}
          makeupError={makeupError}
          endingPackages={students === null ? null : endingPackages}
          packageError={packageError}
        />
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
            {error && (
              <ErrorState
                message={error.message}
                details={error.details}
                onRetry={() => void load()}
              />
            )}

            {rows !== null && !error && rows.length === 0 && (
              <TodayEmptyState
                hasSchedule={hasSchedule}
                onCreate={openNew}
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

          {/* Tasarımın yan bölümleri korunur; açık telafi borcu da günlük iş akışına eklenir. */}
          <aside className={styles.side}>
            <DebtorSection
              rows={debtors}
              error={debtError}
              onCollect={(row) => setPaymentTarget({
                studentId: row.studentId,
                amountKurus: row.debtKurus,
              })}
            />
            <UpcomingPaymentSection
              rows={upcomingPayments}
              error={upcomingError}
              onCollect={(row) => setPaymentTarget({
                studentId: row.studentId,
                amountKurus: row.amountKurus,
              })}
            />
            <MakeupDebtSection
              rows={makeupDebts}
              error={makeupError}
              onPlan={(row) => setDashboardMakeup({
                attendanceId: row.attendanceId,
                studentId: row.studentId,
                studentName: row.fullName,
                subjectId: row.subjectId,
                subjectName: row.subjectName,
                teacherId: row.teacherId,
              })}
              onCancel={setCancelMakeup}
            />
            <PackageSection rows={students === null ? null : endingPackages} error={packageError} />
            <BackupSection
              status={backupStatus}
              error={backupError}
              today={today}
              busy={backupBusy}
              onBackup={() => void backupNow()}
            />
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


      {today !== null && action !== null && (
        <SessionActions
          action={action.kind}
          row={action.row}
          today={today}
          onClose={() => setAction(null)}
          onDone={refresh}
        />
      )}

      {now !== null && (
        <AttendanceDrawer
          row={attendanceRow}
          now={now}
          onClose={() => setAttendanceRow(null)}
          onSaved={() => void load()}
        />
      )}
      <PaymentModal
        open={paymentTarget !== null}
        initialStudentId={paymentTarget?.studentId ?? null}
        initialAmountKurus={paymentTarget?.amountKurus ?? null}
        onClose={() => setPaymentTarget(null)}
        onSaved={() => {
          setPaymentTarget(null)
          void load()
        }}
      />
      {now !== null && (
        <SessionForm
          open={dashboardMakeup !== null}
          today={now.slice(0, 10)}
          makeup={dashboardMakeup}
          onClose={() => setDashboardMakeup(null)}
          onSaved={() => {
            setDashboardMakeup(null)
            void load()
          }}
        />
      )}
      <ConfirmDialog
        open={cancelMakeup !== null}
        title={tr.makeup.cancelTitle}
        description={tr.makeup.cancelBody}
        confirmLabel={tr.makeup.cancelPlan}
        confirmHint={tr.makeup.cancelHint}
        cancelLabel={tr.actions.cancel}
        destructive
        onConfirm={() => void confirmCancelMakeup()}
        onCancel={() => setCancelMakeup(null)}
      />
    </>
  )
}

function TodaySummary({
  overview,
  error,
  debtors,
  debtError,
  makeups,
  makeupError,
  endingPackages,
  packageError,
}: {
  overview: ReportOverview | null
  error: AppError | null
  debtors: DebtorRow[] | null
  debtError: AppError | null
  makeups: MakeupDebtRow[] | null
  makeupError: AppError | null
  endingPackages: StudentRow[] | null
  packageError: AppError | null
}) {
  const pendingMakeupCount =
    makeups?.reduce((total, row) => total + row.pendingCount, 0) ?? null
  const windowReceivable =
    debtors?.reduce((total, row) => total + row.debtKurus, 0) ?? null
  const noStudents = overview !== null && overview.activeStudentCount === 0

  return (
    <section className={styles.summary} aria-label={tr.today.summary.label}>
      <div className={styles.summaryGrid}>
        <SummaryCard
          path="/odemeler"
          label={tr.today.summary.collected}
          value={
            overview === null || overview.collectionCount === 0
              ? null
              : formatLira(overview.collectedKurus)
          }
          caption={
            overview === null
              ? tr.today.summary.loading
              : overview.collectionCount === 0
                ? tr.today.summary.noCollection
                : tr.today.summary.currentMonth
          }
        />
        <SummaryCard
          path="/odemeler"
          label={tr.today.summary.receivable}
          value={
            windowReceivable === null || windowReceivable === 0
              ? null
              : formatLira(windowReceivable)
          }
          tone={windowReceivable !== null && windowReceivable > 0 ? 'danger' : 'default'}
          caption={
            debtors === null
              ? tr.today.summary.loading
              : windowReceivable === 0
                ? tr.today.summary.noLedger
                : tr.today.windowSubtitle
          }
        />
        <SummaryCard
          path="/odemeler"
          label={tr.today.summary.debtors}
          value={
            debtors === null
              ? null
              : String(debtors.length)
          }
          tone={debtors !== null && debtors.length > 0 ? 'danger' : 'default'}
          caption={
            debtors === null
              ? tr.today.summary.loading
              : debtors.length === 0
                ? tr.today.summary.noLedger
                : tr.today.windowSubtitle
          }
        />
        <SummaryCard
          path={STUDENTS_PATH}
          label={tr.today.summary.makeups}
          value={pendingMakeupCount === null || noStudents ? null : String(pendingMakeupCount)}
          tone={pendingMakeupCount !== null && pendingMakeupCount > 0 ? 'warn' : 'default'}
          caption={
            makeups === null
              ? tr.today.summary.loading
              : noStudents
                ? tr.today.summary.noStudents
                : pendingMakeupCount === 0
                  ? tr.today.summary.noMakeups
                  : tr.today.summary.makeupsCaption
          }
        />
        <SummaryCard
          path={STUDENTS_PATH}
          label={tr.today.summary.lowPackages}
          value={endingPackages === null || noStudents ? null : String(endingPackages.length)}
          tone={endingPackages !== null && endingPackages.length > 0 ? 'warn' : 'default'}
          caption={
            endingPackages === null
              ? tr.today.summary.loading
              : noStudents
                ? tr.today.summary.noStudents
                : endingPackages.length === 0
                  ? tr.today.summary.noLowPackages
                  : tr.today.summary.lowPackagesCaption
          }
        />
      </div>
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {debtError && <ErrorState inline message={debtError.message} details={debtError.details} />}
      {makeupError && (
        <ErrorState inline message={makeupError.message} details={makeupError.details} />
      )}
      {packageError && (
        <ErrorState inline message={packageError.message} details={packageError.details} />
      )}
    </section>
  )
}

function SummaryCard({
  path,
  label,
  value,
  caption,
  tone = 'default',
}: {
  path: string
  label: string
  value: string | null
  caption: string
  tone?: 'default' | 'danger' | 'warn'
}) {
  return (
    <button
      type="button"
      className={styles.summaryButton}
      aria-label={`${label}${tr.units.separator}${tr.today.summary.open}`}
      onClick={() => navigate(path)}
    >
      <StatCard label={label} value={value} caption={caption} tone={tone} />
    </button>
  )
}

function MakeupDebtSection({
  rows,
  error,
  onPlan,
  onCancel,
}: {
  rows: MakeupDebtRow[] | null
  error: AppError | null
  onPlan: (row: MakeupDebtRow) => void
  onCancel: (row: MakeupDebtRow) => void
}) {
  const total = rows?.reduce((sum, row) => sum + row.pendingCount, 0) ?? 0
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.makeup.list.heading}
        meta={rows === null ? null : `${total} ${tr.makeup.list.countSuffix}`}
      />
      {rows === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {rows !== null && !error && rows.length === 0 && (
        <p className={styles.sideBody}>{tr.makeup.list.empty}</p>
      )}
      {rows !== null && !error && rows.length > 0 && (
        <div className={styles.makeupList}>
          {rows.map((row) => (
            <div className={styles.makeupActionRow} key={row.attendanceId}>
              <span>
                <strong>{row.fullName}</strong>
                <small>
                  {row.subjectName}{tr.units.separator}
                  {formatDate(row.sourceStartsAt.slice(0, 10))}
                </small>
              </span>
              <Button
                size="small"
                onClick={() => row.makeupSessionId === null ? onPlan(row) : onCancel(row)}
              >
                {row.makeupSessionId === null ? tr.makeup.plan : tr.makeup.cancelPlan}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function UpcomingPaymentSection({
  rows,
  error,
  onCollect,
}: {
  rows: UpcomingPaymentRow[] | null
  error: AppError | null
  onCollect: (row: UpcomingPaymentRow) => void
}) {
  const total = rows?.reduce((sum, row) => sum + row.amountKurus, 0) ?? 0
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.today.upcomingPayments.heading}
        meta={rows === null ? null : `${rows.length} ${tr.today.upcomingPayments.countSuffix}${tr.units.separator}${formatLira(total)}`}
      />
      {rows === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {rows !== null && !error && rows.length === 0 && (
        <p className={styles.sideBody}>{tr.today.upcomingPayments.empty}</p>
      )}
      {rows !== null && !error && rows.length > 0 && (
        <div className={styles.paymentActionList}>
          {rows.map((row) => (
            <button
              type="button"
              className={styles.paymentActionRow}
              key={row.studentId}
              onClick={() => onCollect(row)}
            >
              <span className={styles.paymentActionInfo}>
                <strong>{row.fullName}</strong>
                <small>
                  {row.lessonCount} {tr.today.upcomingPayments.lessonSuffix}
                </small>
              </span>
              <span className={styles.paymentActionAmount}>{formatLira(row.amountKurus)}</span>
              <span className={styles.paymentActionLabel}>
                {tr.today.upcomingPayments.collect}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

function PackageSection({
  rows,
  error,
}: {
  rows: StudentRow[] | null
  error: AppError | null
}) {
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.today.packages.heading}
        meta={rows === null ? null : `${rows.length} ${tr.today.packages.countSuffix}`}
      />
      {rows === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {rows !== null && !error && rows.length === 0 && (
        <p className={styles.sideBody}>{tr.today.packages.empty}</p>
      )}
      {rows !== null && !error && rows.length > 0 && (
        <div className={styles.packageList}>
          {rows.map((row) => (
            <div className={styles.packageRow} key={row.id}>
              <span>{row.fullName}</span>
              <strong>
                {row.remainingLessons} {tr.today.packages.rowSuffix}
              </strong>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Tasarımdaki `54px / 1fr / 128px / 84px / 190px` ders satırı. */
function buildColumns(
  now: string,
  onAction: (row: DaySessionRow, kind: SessionAction) => void,
  onAttendance: (row: DaySessionRow) => void,
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
      render: (row) => <AttendanceCell row={row} now={now} onOpen={onAttendance} />,
    },
    {
      key: 'actions',
      header: tr.today.lessons.table.action,
      width: '210px',
      align: 'end',
      render: (row) => (
        <span className={styles.rowActions}>
          {row.status === 'cancelled' ? (
            row.restoreAllowed !== false && (
              <Button size="small" onClick={() => onAction(row, 'restore')}>
                {tr.sessions.actions.restore}
              </Button>
            )
          ) : (
            <>
              {row.rescheduledOnce !== true && (
                <Button size="small" onClick={() => onAction(row, 'reschedule')}>
                  {tr.sessions.actions.reschedule}
                </Button>
              )}
              <Button size="small" onClick={() => onAction(row, 'cancel')}>
                {tr.sessions.actions.cancel}
              </Button>
            </>
          )}
          <Button size="small" onClick={() => onAction(row, 'remove')}>
            {tr.sessions.actions.remove}
          </Button>
        </span>
      ),
    },
  ]
}

/** Yoklamanın dört kayıt durumu ve henüz zamanı gelmeyen dersin bekleme görünümü. */
function AttendanceCell({
  row,
  now,
  onOpen,
}: {
  row: DaySessionRow
  now: string
  onOpen: (row: DaySessionRow) => void
}) {
  if (row.status === 'cancelled') {
    return <Badge tone="neutral">{tr.today.lessons.cancelled}</Badge>
  }
  if (row.attendanceTaken) {
    return (
      <Button size="small" onClick={() => onOpen(row)}>
        <span className={styles.attendanceDone}>
          {row.presentCount}/{row.markedCount} {tr.today.lessons.attendanceDone}
        </span>
      </Button>
    )
  }
  if (canTakeAttendance(row, now)) {
    return (
      <Button variant={isPendingAttendance(row, now) ? 'warning' : 'secondary'} size="small" onClick={() => onOpen(row)}>
        {tr.attendance.open}
      </Button>
    )
  }
  return (
    <Button size="small" disabled title={tr.attendance.startsWhenLessonStarts}>
      {tr.today.lessons.attendanceWaiting}
    </Button>
  )
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
}: {
  hasSchedule: boolean
  onCreate: () => void
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
    />
  )
}

function DebtorSection({
  rows,
  error,
  onCollect,
}: {
  rows: DebtorRow[] | null
  error: AppError | null
  onCollect: (row: DebtorRow) => void
}) {
  const total = rows === null ? 0 : visibleReceivableKurus(rows)
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.today.debtors.heading}
        meta={rows === null ? null : `${rows.length} ${tr.today.debtors.countSuffix}${tr.units.separator}${formatLira(total)}`}
      />
      {rows === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {rows !== null && !error && rows.length === 0 && <p className={styles.sideBody}>{tr.today.debtors.empty}</p>}
      {rows !== null && !error && rows.length > 0 && (
        <div className={styles.paymentActionList}>
          {rows.map((row) => (
            <button
              type="button"
              className={styles.paymentActionRow}
              key={row.studentId}
              onClick={() => onCollect(row)}
            >
              <span className={styles.paymentActionInfo}>
                <strong>{row.fullName}</strong>
                <small>
                  {row.daysOverdue && row.daysOverdue > 0
                    ? `${row.daysOverdue} ${tr.today.debtors.daysOverdue}`
                    : tr.today.debtors.current}
                </small>
              </span>
              <span className={styles.paymentActionAmount}>{formatLira(row.debtKurus)}</span>
              <span className={styles.paymentActionLabel}>{tr.payments.takePayment}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

function BackupSection({
  status,
  error,
  today,
  busy,
  onBackup,
}: {
  status: BackupStatus | null
  error: AppError | null
  today: string | null
  busy: boolean
  onBackup: () => void
}) {
  const latest = status?.logs.find((row) => row.ok) ?? null
  const age = today && latest ? backupAgeDays(today, latest.takenAt) : null
  const delayed = age !== null && status !== null && age >= status.warnDays
  return (
    <Card className={styles.sideCard}>
      <SectionHeader
        title={tr.today.backup.heading}
        meta={
          latest
            ? `${formatDate(latest.takenAt.slice(0, 10))}${tr.units.separator}${formatTime(latest.takenAt)}`
            : null
        }
      />
      {status === null && !error && <LoadingState inline />}
      {error && <ErrorState inline message={error.message} details={error.details} />}
      {status !== null && !error && (
        <>
          <p className={delayed ? styles.backupDelayed : styles.sideBody}>
            {latest === null
              ? tr.today.backup.empty
              : delayed
                ? `${age} ${tr.today.backup.delayed}`
                : latest.isAuto
                  ? tr.today.backup.automatic
                  : tr.today.backup.manual}
          </p>
          <Button size="small" disabled={busy} onClick={onBackup}>
            {busy ? tr.backup.actions.working : tr.today.backup.action}
          </Button>
        </>
      )}
    </Card>
  )
}
