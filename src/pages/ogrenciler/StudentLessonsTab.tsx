import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchLocalNow,
  fetchStudentLessonOverview,
  type AppError,
  type AttendanceStatus,
  type StudentLessonOverview,
  type StudentLessonRow,
  type StudentPendingMakeupRow,
} from '../../lib/api'
import { formatDate, formatTime } from '../../lib/format'
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusDot,
  Table,
  type Column,
} from '../../ui'
import styles from './Students.module.css'

type StatusPresentation = {
  label: string
  tone: 'success' | 'warn' | 'danger' | 'neutral'
  hollow?: boolean
}

function statusPresentation(status: AttendanceStatus): StatusPresentation {
  const labels = tr.students.detail.lessons.status
  switch (status) {
    case 'present':
      return { label: labels.present, tone: 'success' }
    case 'excused':
      return { label: labels.excused, tone: 'warn' }
    case 'unexcused':
      return { label: labels.unexcused, tone: 'danger' }
    case 'cancelled':
      return { label: labels.cancelled, tone: 'neutral', hollow: true }
    case 'pending':
      return { label: labels.pending, tone: 'neutral', hollow: true }
  }
}

/**
 * Faz 6 §4 — öğrenci detayı ders geçmişi.
 *
 * Sekme açılınca yüklenir: mevcut "bekleyen telafi" rozeti `student_detail` içindeki
 * ucuz sayacı kullanmaya devam eder; ayrıntılı geçmiş/telafi sorgusu kullanıcı bu
 * sekmeye gelmedikçe ikinci kez çalışmaz.
 */
export function StudentLessonsTab({ studentId }: { studentId: number }) {
  const [overview, setOverview] = useState<StudentLessonOverview | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const requestGeneration = useRef(0)

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    setOverview(null)
    setError(null)
    try {
      const now = await fetchLocalNow()
      const next = await fetchStudentLessonOverview(studentId, now)
      if (requestGeneration.current === generation) setOverview(next)
    } catch (caught) {
      if (requestGeneration.current === generation) setError(caught as AppError)
    }
  }, [studentId])

  useEffect(() => {
    void load()
    return () => {
      requestGeneration.current += 1
    }
  }, [load])

  if (error) {
    return <ErrorState message={error.message} onRetry={() => void load()} />
  }
  if (!overview) {
    return <LoadingState />
  }

  return <StudentLessonsContent overview={overview} />
}

export function StudentLessonsContent({ overview }: { overview: StudentLessonOverview }) {
  const historyColumns = useMemo<Column<StudentLessonRow>[]>(
    () => [
      {
        key: 'date',
        header: tr.students.detail.lessons.history.date,
        width: '120px',
        render: (row) => (
          <span className={styles.tabular}>{formatDate(row.startsAt.slice(0, 10))}</span>
        ),
      },
      {
        key: 'time',
        header: tr.students.detail.lessons.history.time,
        width: '130px',
        render: (row) => (
          <span className={styles.tabular}>
            {formatTime(row.startsAt.slice(11))}–{formatTime(row.endsAt.slice(11))}
          </span>
        ),
      },
      {
        key: 'subject',
        header: tr.students.detail.lessons.history.subject,
        width: 'minmax(140px, 1fr)',
        render: (row) => row.subjectName,
      },
      {
        key: 'kind',
        header: tr.students.detail.lessons.history.kind,
        width: 'minmax(120px, 1fr)',
        render: (row) =>
          row.isMakeup
            ? tr.students.detail.lessons.history.makeup
            : (row.groupName ?? tr.students.detail.lessons.history.solo),
      },
      {
        key: 'status',
        header: tr.students.detail.lessons.history.status,
        width: '130px',
        render: (row) => {
          const status = statusPresentation(row.status)
          return <StatusDot tone={status.tone} hollow={status.hollow} label={status.label} />
        },
      },
    ],
    [],
  )

  const makeupColumns = useMemo<Column<StudentPendingMakeupRow>[]>(
    () => [
      {
        key: 'sourceDate',
        header: tr.students.detail.lessons.makeups.sourceDate,
        width: '150px',
        render: (row) => (
          <span className={styles.tabular}>
            {formatDate(row.sourceStartsAt.slice(0, 10))}
          </span>
        ),
      },
      {
        key: 'subject',
        header: tr.students.detail.lessons.makeups.subject,
        width: 'minmax(160px, 1fr)',
        render: (row) => row.subjectName,
      },
      {
        key: 'plan',
        header: tr.students.detail.lessons.makeups.plan,
        width: 'minmax(220px, 1.4fr)',
        render: (row) =>
          row.makeupStartsAt ? (
            <span>
              {tr.students.detail.lessons.makeups.planned}
              {tr.units.separator}
              <span className={styles.tabular}>
                {formatDate(row.makeupStartsAt.slice(0, 10))}
                {tr.units.separator}
                {formatTime(row.makeupStartsAt.slice(11))}
              </span>
            </span>
          ) : (
            <span className={styles.empty}>
              {tr.students.detail.lessons.makeups.notPlanned}
            </span>
          ),
      },
    ],
    [],
  )

  const absenceTotal = overview.excusedAbsences + overview.unexcusedAbsences

  return (
    <div className={styles.lessonOverview}>
      <div className={styles.lessonSummary}>
        <Card className={styles.lessonStat}>
          <span className={styles.lessonStatLabel}>
            {tr.students.detail.lessons.attendance.title}
          </span>
          <strong className={styles.lessonStatValue}>
            {overview.attendancePercentage === null
              ? tr.units.emptyValue
              : `%${overview.attendancePercentage}`}
          </strong>
          <span className={styles.hint}>
            {overview.attendancePercentage === null
              ? tr.students.detail.lessons.attendance.empty
              : `${tr.students.detail.lessons.attendance.presentPrefix} ${overview.presentCount} / ${overview.attendanceEligibleCount} ${tr.students.detail.lessons.attendance.eligibleSuffix}`}
          </span>
          <span className={styles.hint}>
            {tr.students.detail.lessons.attendance.caption}
          </span>
        </Card>

        <Card className={styles.absenceCard}>
          <SectionHeader
            title={tr.students.detail.lessons.absences.title}
            meta={`${formatDate(overview.absenceWindowStart)} ${tr.students.detail.lessons.absences.since}`}
          />
          {absenceTotal === 0 ? (
            <p className={styles.lessonEmptyHint}>
              {tr.students.detail.lessons.absences.empty}
            </p>
          ) : (
            <div className={styles.absenceDistribution}>
              <div>
                <StatusDot
                  tone="warn"
                  label={tr.students.detail.lessons.absences.excused}
                />
                <strong className={styles.tabular}>{overview.excusedAbsences}</strong>
              </div>
              <div>
                <StatusDot
                  tone="danger"
                  label={tr.students.detail.lessons.absences.unexcused}
                />
                <strong className={styles.tabular}>{overview.unexcusedAbsences}</strong>
              </div>
            </div>
          )}
        </Card>
      </div>

      <section className={styles.lessonSection}>
        <SectionHeader
          title={tr.students.detail.lessons.history.title}
          meta={`${overview.lessons.length} ${tr.students.detail.lessons.history.countSuffix}`}
        />
        <Table
          label={tr.students.detail.lessons.history.table}
          columns={historyColumns}
          rows={overview.lessons}
          rowKey={(row) => row.sessionId}
          rowAttention={(row) => row.status === 'pending'}
          emptyState={
            <EmptyState
              title={tr.students.detail.lessons.history.empty}
              body={tr.students.detail.lessons.history.emptyBody}
            />
          }
        />
      </section>

      <section className={styles.lessonSection}>
        <SectionHeader
          title={tr.students.detail.lessons.makeups.title}
          meta={`${overview.pendingMakeups.length} ${tr.students.detail.lessons.makeups.countSuffix}`}
        />
        <Table
          label={tr.students.detail.lessons.makeups.table}
          columns={makeupColumns}
          rows={overview.pendingMakeups}
          rowKey={(row) => row.attendanceId}
          emptyState={
            <EmptyState
              title={tr.students.detail.lessons.makeups.empty}
              body={tr.students.detail.lessons.makeups.emptyBody}
            />
          }
        />
      </section>
    </div>
  )
}
