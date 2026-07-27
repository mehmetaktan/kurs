import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchAbsenceReport,
  fetchAbsenceReportOptions,
  fetchLocalNow,
  fetchMonthlyCollectionReport,
  fetchReportOverview,
  fetchSubjectLessonReport,
  type AbsenceGroupOption,
  type AbsenceReportRow,
  type AbsenceSubjectOption,
  type AppError,
  type MonthlyCollectionRow,
  type ReportOverview,
  type SubjectLessonRow,
} from '../../lib/api'
import { formatLira, monthNameTr } from '../../lib/format'
import { paginate } from '../../lib/paginate'
import { sortTrBy } from '../../lib/sortTr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader, StatusBar } from '../../shell/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
  SearchInput,
  SectionHeader,
  Select,
  StatCard,
  StatStrip,
  Table,
  type Column,
} from '../../ui'
import {
  absenceTotal,
  reportRangeError,
  sortAbsenceRows,
  sortMonthlyCollections,
  sortSubjectLessons,
} from './reports'
import styles from './Reports.module.css'

const SEARCH_DEBOUNCE_MS = 150

interface RankedAbsenceRow extends AbsenceReportRow {
  rank: number
}

/** Faz 6 §5 — seçilen kapalı tarih aralığında en çok devamsızlık yapan öğrenciler. */
export function ReportsPage() {
  const [rows, setRows] = useState<AbsenceReportRow[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [today, setToday] = useState('')
  const [subjects, setSubjects] = useState<AbsenceSubjectOption[]>([])
  const [groups, setGroups] = useState<AbsenceGroupOption[]>([])
  const [overview, setOverview] = useState<ReportOverview | null>(null)
  const [overviewError, setOverviewError] = useState<AppError | null>(null)
  const [monthlyRows, setMonthlyRows] = useState<MonthlyCollectionRow[] | null>(null)
  const [subjectRows, setSubjectRows] = useState<SubjectLessonRow[] | null>(null)
  const [overviewPage, setOverviewPage] = useState({ monthly: 1, subjects: 1 })

  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const initializationGeneration = useRef(0)
  const reportGeneration = useRef(0)
  const overviewGeneration = useRef(0)
  const rangeErrorId = useId()

  const loadOverview = useCallback(async (stamp: string) => {
    const generation = ++overviewGeneration.current
    setOverview(null)
    setMonthlyRows(null)
    setSubjectRows(null)
    setOverviewError(null)
    try {
      const [nextOverview, nextMonthly, nextSubjects] = await Promise.all([
        fetchReportOverview(stamp),
        fetchMonthlyCollectionReport(),
        fetchSubjectLessonReport(),
      ])
      if (generation !== overviewGeneration.current) return
      setOverview(nextOverview)
      setMonthlyRows(nextMonthly)
      setSubjectRows(nextSubjects)
    } catch (caught) {
      if (generation !== overviewGeneration.current) return
      setOverviewError(caught as AppError)
    }
  }, [])

  const initialize = useCallback(async () => {
    const generation = ++initializationGeneration.current
    reportGeneration.current += 1
    setError(null)
    setInitialized(false)
    try {
      const [now, options] = await Promise.all([fetchLocalNow(), fetchAbsenceReportOptions()])
      if (generation !== initializationGeneration.current) return
      const day = now.slice(0, 10)
      setToday(day)
      setFrom(`${day.slice(0, 8)}01`)
      setTo(day)
      setSubjects(options.subjects)
      setGroups(options.groups)
      setInitialized(true)
      void loadOverview(now)
    } catch (caught) {
      if (generation !== initializationGeneration.current) return
      setRows(null)
      setError(caught as AppError)
    }
  }, [loadOverview])

  useEffect(() => {
    void initialize()
    return () => {
      initializationGeneration.current += 1
      reportGeneration.current += 1
      overviewGeneration.current += 1
    }
  }, [initialize])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const rangeProblem = initialized ? reportRangeError(from, to) : null
  const rangeMessage =
    rangeProblem === 'required'
      ? tr.reports.absence.errors.dateRequired
      : rangeProblem === 'order'
        ? tr.reports.absence.errors.rangeOrder
        : null
  const load = useCallback(async () => {
    const generation = ++reportGeneration.current
    if (!initialized || !from || !to || reportRangeError(from, to)) {
      setRows(null)
      setError(null)
      return
    }
    setRows(null)
    setError(null)
    try {
      const nextRows = await fetchAbsenceReport({
        from,
        to,
        search: debouncedSearch,
        subjectId,
        groupId,
      })
      if (generation !== reportGeneration.current) return
      setRows(nextRows)
    } catch (caught) {
      if (generation !== reportGeneration.current) return
      setError(caught as AppError)
    }
  }, [debouncedSearch, from, groupId, initialized, subjectId, to])

  useEffect(() => {
    void load()
    return () => {
      reportGeneration.current += 1
    }
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, from, groupId, subjectId, to])

  const sorted = useMemo(() => sortAbsenceRows(rows ?? []), [rows])
  const ranked = useMemo<RankedAbsenceRow[]>(
    () => sorted.map((row, index) => ({ ...row, rank: index + 1 })),
    [sorted],
  )
  const paged = useMemo(() => paginate(ranked, page), [page, ranked])
  const filteredGroups = useMemo(
    () => groups.filter((group) => subjectId === null || group.subjectId === subjectId),
    [groups, subjectId],
  )
  const monthly = useMemo(
    () => paginate(sortMonthlyCollections(monthlyRows ?? []), overviewPage.monthly),
    [monthlyRows, overviewPage.monthly],
  )
  const subjectLessons = useMemo(
    () => paginate(sortSubjectLessons(subjectRows ?? []), overviewPage.subjects),
    [overviewPage.subjects, subjectRows],
  )
  const monthlyColumns: readonly Column<MonthlyCollectionRow>[] = [
    {
      key: 'month',
      header: tr.reports.monthly.table.month,
      width: 'minmax(120px, 1fr)',
      render: (row) => formatReportMonth(row.month),
    },
    {
      key: 'count',
      header: tr.reports.monthly.table.count,
      width: 'minmax(120px, 0.8fr)',
      align: 'end',
      render: (row) => <span className={styles.number}>{row.collectionCount}</span>,
    },
    {
      key: 'amount',
      header: tr.reports.monthly.table.amount,
      width: 'minmax(140px, 0.9fr)',
      align: 'end',
      render: (row) => (
        <strong className={styles.number}>{formatLira(row.collectedKurus)}</strong>
      ),
    },
  ]
  const subjectColumns: readonly Column<SubjectLessonRow>[] = [
    {
      key: 'subject',
      header: tr.reports.subjects.table.subject,
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <span className={styles.subjectName}>
          {row.subjectName}
          {row.archived && <Badge tone="neutral">{tr.reports.absence.table.archived}</Badge>}
        </span>
      ),
    },
    {
      key: 'count',
      header: tr.reports.subjects.table.count,
      width: 'minmax(130px, 0.55fr)',
      align: 'end',
      render: (row) => <strong className={styles.number}>{row.processedSessionCount}</strong>,
    },
  ]

  const clearFilters = () => {
    setSearch('')
    setSubjectId(null)
    setGroupId(null)
  }
  const hasDataFilter = debouncedSearch !== '' || subjectId !== null || groupId !== null
  const columns: readonly Column<RankedAbsenceRow>[] = [
    {
      key: 'rank',
      header: tr.reports.absence.table.rank,
      width: '64px',
      render: (row) => <span className={styles.rank}>{row.rank}</span>,
    },
    {
      key: 'student',
      header: tr.reports.absence.table.student,
      width: 'minmax(220px, 1fr)',
      render: (row) => (
        <div className={styles.student}>
          <Avatar name={row.fullName} />
          <strong className={styles.studentName}>{row.fullName}</strong>
          {row.archived && <Badge tone="neutral">{tr.reports.absence.table.archived}</Badge>}
        </div>
      ),
    },
    {
      key: 'excused',
      header: tr.reports.absence.table.excused,
      width: '140px',
      align: 'end',
      render: (row) => <span className={styles.number}>{row.excusedCount}</span>,
    },
    {
      key: 'unexcused',
      header: tr.reports.absence.table.unexcused,
      width: '140px',
      align: 'end',
      render: (row) => <span className={styles.number}>{row.unexcusedCount}</span>,
    },
    {
      key: 'total',
      header: tr.reports.absence.table.total,
      width: '110px',
      align: 'end',
      render: (row) => <span className={`${styles.number} ${styles.total}`}>{row.totalCount}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={tr.pages.reports.title}
        subtitle={tr.pages.reports.subtitle}
        search={
          <SearchInput
            value={search}
            placeholder={tr.reports.absence.search}
            aria-label={tr.reports.absence.search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
      />
      <PageContent>
        <section className={styles.overview}>
          {overview === null && !overviewError && <LoadingState />}
          {overviewError && (
            <ErrorState
              message={overviewError.message}
              details={overviewError.details}
              onRetry={() => today && void loadOverview(`${today} 00:00`)}
            />
          )}
          {overview !== null && (
            <StatStrip>
              <StatCard
                label={tr.reports.summary.collected}
                value={overview.collectionCount === 0 ? null : formatLira(overview.collectedKurus)}
                caption={
                  overview.collectionCount === 0
                    ? tr.reports.summary.noCollection
                    : `${formatReportMonth(overview.month)}${tr.units.separator}${overview.collectionCount} ${tr.reports.summary.collectionSuffix}`
                }
              />
              <StatCard
                label={tr.reports.summary.processed}
                value={
                  overview.processedSessionCount === 0
                    ? null
                    : String(overview.processedSessionCount)
                }
                caption={
                  overview.processedSessionCount === 0
                    ? tr.reports.summary.noProcessed
                    : tr.reports.summary.allProcessed
                }
              />
              <StatCard
                label={tr.reports.summary.attendance}
                value={
                  overview.attendancePercentage === null
                    ? null
                    : `%${overview.attendancePercentage}`
                }
                caption={
                  overview.attendancePercentage === null
                    ? tr.reports.summary.noAttendance
                    : tr.reports.summary.allAttendance
                }
              />
              <StatCard
                label={tr.reports.summary.activeStudents}
                value={
                  overview.activeStudentCount === 0 ? null : String(overview.activeStudentCount)
                }
                caption={
                  overview.activeStudentCount === 0
                    ? tr.reports.summary.noActiveStudents
                    : tr.reports.summary.activeStudentsCaption
                }
              />
            </StatStrip>
          )}

          {overview !== null && monthlyRows !== null && subjectRows !== null && (
            <div className={styles.reportTables}>
              <section className={styles.section}>
                <SectionHeader
                  title={tr.reports.monthly.title}
                  meta={tr.reports.monthly.description}
                />
                <Table
                  label={tr.reports.monthly.table.label}
                  columns={monthlyColumns}
                  rows={monthly.rows}
                  rowKey={(row) => row.month}
                  emptyState={
                    <EmptyState
                      title={tr.reports.monthly.empty}
                      body={tr.reports.monthly.emptyBody}
                    />
                  }
                />
                {monthly.pageCount > 1 && (
                  <Pagination
                    page={monthly.page}
                    pageCount={monthly.pageCount}
                    onChange={(next) =>
                      setOverviewPage((current) => ({ ...current, monthly: next }))
                    }
                  />
                )}
              </section>
              <section className={styles.section}>
                <SectionHeader
                  title={tr.reports.subjects.title}
                  meta={tr.reports.subjects.description}
                />
                <Table
                  label={tr.reports.subjects.table.label}
                  columns={subjectColumns}
                  rows={subjectLessons.rows}
                  rowKey={(row) => row.subjectId}
                  emptyState={
                    <EmptyState
                      title={tr.reports.subjects.empty}
                      body={tr.reports.subjects.emptyBody}
                    />
                  }
                />
                {subjectLessons.pageCount > 1 && (
                  <Pagination
                    page={subjectLessons.page}
                    pageCount={subjectLessons.pageCount}
                    onChange={(next) =>
                      setOverviewPage((current) => ({ ...current, subjects: next }))
                    }
                  />
                )}
              </section>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <SectionHeader
            title={tr.reports.absence.title}
            meta={tr.reports.absence.description}
          />
          <div className={styles.filters}>
            <DatePicker
              label={tr.reports.absence.filters.from}
              value={from}
              today={today}
              errorMessageId={rangeMessage ? rangeErrorId : undefined}
              onChange={setFrom}
            />
            <DatePicker
              label={tr.reports.absence.filters.to}
              value={to}
              today={today}
              errorMessageId={rangeMessage ? rangeErrorId : undefined}
              onChange={setTo}
            />
            <Select
              label={tr.reports.absence.filters.subject}
              value={subjectId === null ? '' : String(subjectId)}
              placeholder={tr.reports.absence.filters.allSubjects}
              options={sortTrBy(subjects, (subject) => subject.name).map((subject) => ({
                value: String(subject.id),
                label: filterOptionLabel(subject),
              }))}
              onChange={(event) => {
                const next = event.target.value === '' ? null : Number(event.target.value)
                setSubjectId(next)
                if (
                  groupId !== null &&
                  next !== null &&
                  groups.find((group) => group.id === groupId)?.subjectId !== next
                ) {
                  setGroupId(null)
                }
              }}
            />
            <Select
              label={tr.reports.absence.filters.group}
              value={groupId === null ? '' : String(groupId)}
              placeholder={tr.reports.absence.filters.allGroups}
              options={sortTrBy(filteredGroups, (group) => group.name).map((group) => ({
                value: String(group.id),
                label: filterOptionLabel(group),
              }))}
              onChange={(event) =>
                setGroupId(event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </div>
          {rangeMessage && (
            <p id={rangeErrorId} className={styles.rangeError} role="alert">
              {rangeMessage}
            </p>
          )}

          {rows === null && !error && !rangeProblem && <LoadingState />}
          {error && (
            <ErrorState
              message={error.message}
              details={error.details}
              onRetry={() => void (initialized ? load() : initialize())}
            />
          )}
          {rows !== null && !error && !rangeProblem && (
            <Table
              label={tr.reports.absence.table.label}
              columns={columns}
              rows={paged.rows}
              rowKey={(row) => row.studentId}
              stickyHeader
              emptyState={
                hasDataFilter ? (
                  <EmptyState
                    kind="no-filter-results"
                    title={tr.reports.absence.empty.filtered}
                    body={tr.reports.absence.empty.filteredBody}
                    secondaryAction={
                      <Button onClick={clearFilters}>{tr.actions.clearFilter}</Button>
                    }
                  />
                ) : (
                  <EmptyState
                    title={tr.reports.absence.empty.range}
                    body={tr.reports.absence.empty.rangeBody}
                  />
                )
              }
            />
          )}
          {rows !== null && !error && !rangeProblem && ranked.length > 0 && (
            <Pagination page={paged.page} pageCount={paged.pageCount} onChange={setPage} />
          )}
        </section>
      </PageContent>
      <StatusBar
        left={
          rows === null || error || rangeProblem
            ? null
            : `${ranked.length} ${tr.reports.absence.status.students}`
        }
        right={
          rows === null || error || rangeProblem ? null : (
            <>
              <span>{tr.reports.absence.status.total}</span>{' '}
              <strong>{absenceTotal(ranked)}</strong>
            </>
          )
        }
      />
    </>
  )
}

function filterOptionLabel(option: { name: string; archived: boolean }): string {
  return option.archived
    ? `${option.name}${tr.units.separator}${tr.reports.absence.table.archived}`
    : option.name
}

function formatReportMonth(value: string): string {
  const [year, month] = value.split('-')
  const monthNumber = Number(month)
  if (!year || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return value
  }
  return `${monthNameTr(monthNumber)} ${year}`
}
