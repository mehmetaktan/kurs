import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchAbsenceReport,
  fetchAbsenceReportOptions,
  fetchLocalNow,
  type AbsenceGroupOption,
  type AbsenceReportRow,
  type AbsenceSubjectOption,
  type AppError,
} from '../../lib/api'
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
  Table,
  type Column,
} from '../../ui'
import { absenceTotal, reportRangeError, sortAbsenceRows } from './reports'
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

  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const initializationGeneration = useRef(0)
  const reportGeneration = useRef(0)
  const rangeErrorId = useId()

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
    } catch (caught) {
      if (generation !== initializationGeneration.current) return
      setRows(null)
      setError(caught as AppError)
    }
  }, [])

  useEffect(() => {
    void initialize()
    return () => {
      initializationGeneration.current += 1
      reportGeneration.current += 1
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
