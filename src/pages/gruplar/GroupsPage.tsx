import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchGroupList,
  fetchSubjects,
  restoreGroup,
  type AppError,
  type GroupRow,
  type Subject,
} from '../../lib/api'
import { paginate } from '../../lib/paginate'
import { navigate } from '../../lib/router'
import { sortTrBy } from '../../lib/sortTr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader, StatusBar } from '../../shell/PageHeader'
import {
  Button,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Pagination,
  SearchInput,
  Select,
  StatusDot,
  Table,
} from '../../ui'
import type { Column } from '../../ui'
import { subjectColorOf } from '../tanimlar/palette'
import { GroupForm } from './GroupForm'
import {
  chipCounts,
  filterByChip,
  GROUP_CHIPS,
  isOverCapacity,
  sortGroups,
  weeklySummary,
  type GroupChip,
} from './filters'
import styles from './Groups.module.css'

/** Arama her tuşta Rust'a gitmesin; yazarken 150 ms bekleniyor. */
const SEARCH_DEBOUNCE_MS = 150

/**
 * EKRANLAR.md E4 — `Gruplar` listesi.
 *
 * **İş bölümü ADR-025 ile aynı** (Öğrenciler ekranının ikizi): arama ve branş süzgeci
 * Rust'ta (`search_name` orada, `İ/ı` yazma anında çözülmüş — K9); çipler, Türkçe
 * sıralama ve sayfalama burada.
 *
 * Alt çubukta **para rakamı yok**: grup bir para kavramı taşımıyor, dolayısıyla
 * ADR-026'nın "hangi kümeyi topluyor" sorusu burada doğmuyor.
 */
export function GroupsPage() {
  const [rows, setRows] = useState<GroupRow[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [chip, setChip] = useState<GroupChip>('all')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await fetchGroupList({ search: debouncedSearch, subjectId }))
    } catch (err) {
      setError(err as AppError)
      setRows(null)
    }
  }, [debouncedSearch, subjectId])

  useEffect(() => {
    void load()
  }, [load])

  // Branş listesi bir kez okunur; filtre seçicisinin kaynağı. Hata yutulmuyor ama
  // listeyi de bloklamıyor: seçici boş kalır, tablo çalışır.
  useEffect(() => {
    void fetchSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]))
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Süzgeç değişince 1. sayfaya dön — yoksa kullanıcı boş bir 5. sayfada kalır.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, subjectId, chip])

  const counts = useMemo(() => chipCounts(rows ?? []), [rows])
  const visible = useMemo(() => sortGroups(filterByChip(rows ?? [], chip)), [rows, chip])
  const paged = useMemo(() => paginate(visible, page), [visible, page])

  const onRestore = async (row: GroupRow) => {
    try {
      await restoreGroup(row.id)
      await load()
    } catch (err) {
      setError(err as AppError)
    }
  }

  const columns = buildColumns(chip === 'archived', (row) => void onRestore(row))

  return (
    <>
      <PageHeader
        title={tr.pages.groups.title}
        subtitle={tr.pages.groups.subtitle}
        search={
          <SearchInput
            ref={searchRef}
            value={search}
            placeholder={tr.groups.searchPlaceholder}
            aria-label={tr.groups.searchPlaceholder}
            hint={tr.search.openHint}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const first = paged.rows[0]
              if (first) navigate(`/gruplar/${first.id}`)
            }}
          />
        }
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {tr.groups.newGroup}
          </Button>
        }
      />

      <PageContent>
        <div className={styles.toolbar}>
          <ChipRow>
            {GROUP_CHIPS.map((item) => (
              <FilterChip
                key={item}
                label={tr.groups.chips[item]}
                active={chip === item}
                count={counts[item]}
                onClick={() => setChip(item)}
              />
            ))}
          </ChipRow>

          <Select
            className={styles.select}
            label={tr.groups.filters.subject}
            value={subjectId === null ? '' : String(subjectId)}
            placeholder={tr.groups.filters.allSubjects}
            options={sortTrBy(subjects, (s) => s.name).map((subject) => ({
              value: String(subject.id),
              label: subject.name,
            }))}
            onChange={(event) =>
              setSubjectId(event.target.value === '' ? null : Number(event.target.value))
            }
          />
        </div>

        {rows === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}

        {rows !== null && !error && (
          <Table
            label={tr.groups.table.label}
            columns={columns}
            rows={paged.rows}
            rowKey={(row) => row.id}
            stickyHeader
            onRowClick={(row) => navigate(`/gruplar/${row.id}`)}
            emptyState={
              <ListEmptyState
                chip={chip}
                search={debouncedSearch}
                filtered={subjectId !== null}
                onClear={() => {
                  setChip('all')
                  setSubjectId(null)
                  setSearch('')
                }}
                onCreate={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              />
            }
          />
        )}

        <Pagination page={paged.page} pageCount={paged.pageCount} onChange={setPage} />
      </PageContent>

      <StatusBar
        left={
          rows === null
            ? null
            : `${paged.total} ${tr.groups.footer.showing}${tr.units.separator}${rows.length} ${tr.groups.footer.ofTotal}`
        }
      />

      <GroupForm
        open={formOpen}
        groupId={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => {
          setFormOpen(false)
          navigate(`/gruplar/${id}`)
        }}
      />
    </>
  )
}

function buildColumns(
  archivedView: boolean,
  onRestore: (row: GroupRow) => void,
): Column<GroupRow>[] {
  return [
    {
      key: 'name',
      header: tr.groups.table.name,
      width: 'minmax(150px, 1.4fr)',
      render: (row) => (
        <span className={styles.nameCell}>
          <span
            className={styles.swatch}
            style={{ background: subjectColorOf(row.subjectColor) }}
            aria-hidden
          />
          <span className={styles.name}>{row.name}</span>
        </span>
      ),
    },
    {
      key: 'subject',
      header: tr.groups.table.subject,
      width: '130px',
      render: (row) => row.subjectName,
    },
    {
      key: 'teacher',
      header: tr.groups.table.teacher,
      width: '130px',
      render: (row) => row.teacherName ?? <span className={styles.empty}>{tr.units.emptyValue}</span>,
    },
    {
      key: 'occupancy',
      header: tr.groups.table.occupancy,
      width: '96px',
      align: 'end',
      // Kapasite aşımı ENGELLENMİYOR (PRD S2) — listedeki bu işaret onu görünür kılan
      // tek şey. Aksi hâlde 7 kişilik bir "6 kişilik grup" sessizce dururdu.
      render: (row) => (
        <span
          className={[styles.tabular, isOverCapacity(row) ? styles.over : undefined]
            .filter(Boolean)
            .join(' ')}
          title={isOverCapacity(row) ? tr.groups.table.overCapacity : undefined}
        >
          {row.memberCount}/{row.capacity}
        </span>
      ),
    },
    {
      key: 'weekly',
      header: tr.groups.table.weekly,
      width: 'minmax(140px, 1fr)',
      render: (row) => {
        const summary = weeklySummary(row)
        return summary === '' ? (
          <span className={styles.empty}>{tr.groups.table.noSchedule}</span>
        ) : (
          <span className={styles.muted}>{summary}</span>
        )
      },
    },
    {
      key: 'status',
      header: tr.groups.table.status,
      width: '96px',
      render: (row) =>
        row.archived ? (
          <StatusDot tone="neutral" hollow label={tr.groups.table.archived} />
        ) : (
          <StatusDot
            tone={row.isActive ? 'success' : 'neutral'}
            hollow={!row.isActive}
            label={row.isActive ? tr.groups.table.active : tr.groups.table.passive}
          />
        ),
    },
    {
      key: 'action',
      header: tr.groups.table.action,
      width: '96px',
      align: 'end',
      render: (row) => (
        <span className={styles.rowActions}>
          {archivedView ? (
            <Button size="small" onClick={() => onRestore(row)}>
              {tr.groups.table.restore}
            </Button>
          ) : (
            <Button size="small" onClick={() => navigate(`/gruplar/${row.id}`)}>
              {tr.groups.table.open}
            </Button>
          )}
        </span>
      ),
    },
  ]
}

/** Üç ayrı boş durum (TASARIM-SISTEMI §7) — arşiv görünümünün kendi metni var. */
function ListEmptyState({
  chip,
  search,
  filtered,
  onClear,
  onCreate,
}: {
  chip: GroupChip
  search: string
  filtered: boolean
  onClear: () => void
  onCreate: () => void
}) {
  if (search.trim() !== '') {
    return (
      <EmptyState
        kind="no-search-results"
        title={`"${search.trim()}" ${tr.search.noResults}`}
        body={tr.search.noResultsHint}
        secondaryAction={<Button onClick={onClear}>{tr.actions.clearFilter}</Button>}
      />
    )
  }

  if (chip === 'archived') {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.groups.empty.noArchived}
        body={tr.groups.empty.noArchivedBody}
        secondaryAction={<Button onClick={onClear}>{tr.actions.showAll}</Button>}
      />
    )
  }

  if (chip !== 'all' || filtered) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.groups.empty.noFilterResults}
        secondaryAction={<Button onClick={onClear}>{tr.actions.showAll}</Button>}
      />
    )
  }

  return (
    <EmptyState
      title={tr.groups.empty.firstUse}
      body={tr.groups.empty.firstUseBody}
      action={
        <Button variant="primary" onClick={onCreate}>
          {tr.groups.newGroupLong}
        </Button>
      }
    />
  )
}
