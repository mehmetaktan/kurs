import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchStudentList,
  fetchStudyGroups,
  fetchSubjects,
  restoreStudent,
  type AppError,
  type StudentRow,
  type StudyGroup,
  type Subject,
} from '../../lib/api'
import { formatDate, formatLira, formatPhone } from '../../lib/format'
import { navigate } from '../../lib/router'
import { sortTrBy } from '../../lib/sortTr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader, StatusBar } from '../../shell/PageHeader'
import {
  Avatar,
  Button,
  ChipRow,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  Pagination,
  SearchInput,
  Select,
  StatusDot,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { StudentForm } from './StudentForm'
import {
  chipCounts,
  filterByChip,
  paginate,
  sortStudents,
  STUDENT_CHIPS,
  totalReceivableKurus,
  type StudentChip,
} from './filters'
import styles from './Students.module.css'

/** Arama her tuşta Rust'a gitmesin; yazarken 150 ms bekleniyor. */
const SEARCH_DEBOUNCE_MS = 150

/**
 * EKRANLAR.md §3 — `Öğrenciler` listesi.
 *
 * **İş bölümü:** arama ve branş/grup süzgeci Rust'ta (`search_name` sütunu orada,
 * `İ/ı` sorunu yazma anında çözülmüş — K9). Çipler, Türkçe sıralama ve sayfalama
 * burada (ADR-020: SQLite'ta `localeCompare('tr')` yok; sıralanmamış listeyi
 * sayfalamak da yanlış sayfa üretir, o yüzden ikisi aynı yerde).
 */
export function StudentsPage() {
  const [rows, setRows] = useState<StudentRow[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<StudyGroup[]>([])

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [chip, setChip] = useState<StudentChip>('all')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<StudentRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(
        await fetchStudentList({
          search: debouncedSearch,
          subjectId,
          groupId,
        }),
      )
    } catch (err) {
      setError(err as AppError)
      setRows(null)
    }
  }, [debouncedSearch, subjectId, groupId])

  useEffect(() => {
    void load()
  }, [load])

  // Branş ve grup listeleri bir kez okunur; filtre seçicilerinin kaynağı.
  // Hata YUTULMUYOR ama listeyi de bloklamıyor: seçiciler boş kalır, tablo çalışır.
  useEffect(() => {
    void Promise.all([fetchSubjects(), fetchStudyGroups()])
      .then(([nextSubjects, nextGroups]) => {
        setSubjects(nextSubjects)
        setGroups(nextGroups)
      })
      .catch(() => {
        setSubjects([])
        setGroups([])
      })
  }, [])

  // Tasarımda arama kutusu **otomatik odaklı**: ekran açılır açılmaz yazmaya başlanır.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Süzgeç değişince 1. sayfaya dön — yoksa kullanıcı boş bir 5. sayfada kalır.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, subjectId, groupId, chip])

  const counts = useMemo(() => chipCounts(rows ?? []), [rows])
  const visible = useMemo(
    () => sortStudents(filterByChip(rows ?? [], chip)),
    [rows, chip],
  )
  const paged = useMemo(() => paginate(visible, page), [visible, page])
  // ADR-026: alt çubuğun rakamı GÖRÜNEN listeyi toplar — `rows` değil `visible`.
  // Sayfalama öncesi hâli: alt çubuk "12 öğrenci gösteriliyor" derken sayfa 1'in
  // toplamını yazsaydı iki rakam birbirini yalanlardı.
  const receivable = useMemo(() => totalReceivableKurus(visible), [visible])

  const openForm = (studentId: number | null) => {
    setEditing(studentId)
    setFormOpen(true)
  }

  const onRestore = async (row: StudentRow) => {
    try {
      await restoreStudent(row.id)
      toast(tr.students.archive.restored)
      setSelected(null)
      await load()
    } catch (err) {
      setError(err as AppError)
    }
  }

  // Sekiz kolon tanımı her render'da yeniden kuruluyor — `useMemo` etmiyoruz. Ölçüldüğünde
  // kazanç yok, karşılığında `onRestore` bağımlılığını elde tutmak gerekiyordu.
  const columns = buildColumns(chip === 'archived', (row) => void onRestore(row))

  return (
    <>
      <PageHeader
        title={tr.pages.students.title}
        subtitle={tr.pages.students.subtitle}
        search={
          <SearchInput
            ref={searchRef}
            value={search}
            placeholder={tr.students.searchPlaceholder}
            aria-label={tr.students.searchPlaceholder}
            hint={tr.search.openHint}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // `↵ aç` ipucunun karşılığı: ilk sonucun özetini açar.
              if (event.key !== 'Enter') return
              const first = paged.rows[0]
              if (first) setSelected(first)
            }}
          />
        }
        action={
          <Button variant="primary" onClick={() => openForm(null)}>
            {tr.students.newStudent}
          </Button>
        }
      />

      <PageContent>
        <div className={styles.toolbar}>
          <ChipRow>
            {STUDENT_CHIPS.map((item) => (
              <FilterChip
                key={item}
                label={tr.students.chips[item]}
                active={chip === item}
                count={counts[item]}
                onClick={() => setChip(item)}
              />
            ))}
          </ChipRow>

          <div className={styles.selects}>
            <Select
              className={styles.select}
              label={tr.students.filters.subject}
              value={subjectId === null ? '' : String(subjectId)}
              placeholder={tr.students.filters.allSubjects}
              options={sortTrBy(subjects, (s) => s.name).map((subject) => ({
                value: String(subject.id),
                label: subject.name,
              }))}
              onChange={(event) =>
                setSubjectId(event.target.value === '' ? null : Number(event.target.value))
              }
            />
            <Select
              className={styles.select}
              label={tr.students.filters.group}
              value={groupId === null ? '' : String(groupId)}
              placeholder={tr.students.filters.allGroups}
              options={sortTrBy(groups, (g) => g.name).map((group) => ({
                value: String(group.id),
                label: group.name,
              }))}
              onChange={(event) =>
                setGroupId(event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </div>
        </div>

        {rows === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}

        {rows !== null && !error && (
          <Table
            label={tr.students.table.label}
            columns={columns}
            rows={paged.rows}
            rowKey={(row) => row.id}
            stickyHeader
            onRowClick={(row) => setSelected(row)}
            emptyState={
              <ListEmptyState
                chip={chip}
                search={debouncedSearch}
                filtered={subjectId !== null || groupId !== null}
                onClear={() => {
                  setChip('all')
                  setSubjectId(null)
                  setGroupId(null)
                  setSearch('')
                }}
                onCreate={() => openForm(null)}
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
            : `${paged.total} ${tr.students.footer.showing}${tr.units.separator}${rows.length} ${tr.students.footer.ofTotal}`
        }
        right={
          receivable > 0
            ? `${tr.students.footer.receivable}: ${formatLira(receivable)}`
            : null
        }
      />

      <SummaryDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onEdit={(row) => {
          setSelected(null)
          openForm(row.id)
        }}
        onOpenDetail={(row) => {
          setSelected(null)
          navigate(`/ogrenciler/${row.id}`)
        }}
      />

      <StudentForm
        open={formOpen}
        studentId={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          void load()
        }}
      />
    </>
  )
}

/**
 * Tasarımın kolon şablonu (EKRANLAR.md §3), MVP'ye göre daraltılmış: "Tahsilat al"
 * düğmesi Faz 8'de geliyor, o yüzden son kolon şimdilik **Aç** — arşiv görünümünde
 * **Geri al** (E2). Boş bir yer tutucu düğme koymaktansa bugün gerçekten çalışan
 * eylemi koyuyoruz.
 */
function buildColumns(
  archivedView: boolean,
  onRestore: (row: StudentRow) => void,
): Column<StudentRow>[] {
  return [
    {
      key: 'name',
      header: tr.students.table.name,
      width: 'minmax(160px, 1.6fr)',
      render: (row) => (
        <span className={styles.nameCell}>
          <span className={styles.name}>{row.fullName}</span>
          {row.grade && <span className={styles.nameMeta}>{row.grade}</span>}
        </span>
      ),
    },
    {
      key: 'guardianPhone',
      header: tr.students.table.guardianPhone,
      width: '150px',
      render: (row) => (
        <span className={styles.tabular}>
          {row.guardianPhone ? formatPhone(row.guardianPhone) : emptyMark()}
        </span>
      ),
    },
    {
      key: 'lessons',
      header: tr.students.table.lessons,
      width: '76px',
      align: 'end',
      render: (row) => <span className={styles.tabular}>{row.processedLessons}</span>,
    },
    {
      key: 'balance',
      header: tr.students.table.balance,
      width: '120px',
      align: 'end',
      // Borçluysa kırmızı ve kalın; değilse nötr (tasarım). Bakiye işaretli:
      // negatif = borçlu (K3), ekranda `−1.200,00 ₺`.
      render: (row) => (
        <span
          className={[
            styles.tabular,
            row.balanceKurus < 0 ? styles.debt : styles.credit,
          ].join(' ')}
        >
          {formatLira(row.balanceKurus)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: tr.students.table.remaining,
      width: '96px',
      align: 'end',
      render: (row) => {
        if (row.remainingLessons === null) return emptyMark()
        return (
          <span
            className={[
              styles.tabular,
              row.remainingLessons <= 2 ? styles.low : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {row.remainingLessons}
          </span>
        )
      },
    },
    {
      key: 'lastSession',
      header: tr.students.table.lastSession,
      width: '108px',
      render: (row) => (
        <span className={styles.tabular}>
          {row.lastSessionDate ? formatDate(row.lastSessionDate) : emptyMark()}
        </span>
      ),
    },
    {
      key: 'status',
      header: tr.students.table.status,
      width: '96px',
      render: (row) =>
        row.archived ? (
          <StatusDot tone="neutral" hollow label={tr.students.table.archived} />
        ) : (
          <StatusDot
            tone={row.isActive ? 'success' : 'neutral'}
            hollow={!row.isActive}
            label={row.isActive ? tr.students.table.active : tr.students.table.passive}
          />
        ),
    },
    {
      key: 'action',
      header: tr.students.table.action,
      width: '96px',
      align: 'end',
      render: (row) =>
        archivedView ? (
          <Button size="small" onClick={() => onRestore(row)}>
            {tr.students.table.restore}
          </Button>
        ) : (
          <Button size="small" onClick={() => navigate(`/ogrenciler/${row.id}`)}>
            {tr.students.table.open}
          </Button>
        ),
    },
  ]
}

function emptyMark() {
  return <span className={styles.empty}>{tr.units.emptyValue}</span>
}

/**
 * Üç ayrı boş durum (TASARIM-SISTEMI §7): ilk kullanım · arama sonuçsuz · filtre
 * sonuçsuz. "Sonuç yok" üç ayrı sebebi aynı cümleyle anlatırsa kullanıcı ne yapacağını
 * bilemez. Arşiv görünümünün kendi metni var (E2).
 */
function ListEmptyState({
  chip,
  search,
  filtered,
  onClear,
  onCreate,
}: {
  chip: StudentChip
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
        title={tr.students.empty.noArchived}
        body={tr.students.empty.noArchivedBody}
        secondaryAction={<Button onClick={onClear}>{tr.actions.showAll}</Button>}
      />
    )
  }

  if (chip !== 'all' || filtered) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.students.empty.noFilterResults}
        secondaryAction={<Button onClick={onClear}>{tr.actions.showAll}</Button>}
      />
    )
  }

  return (
    <EmptyState
      title={tr.students.empty.firstUse}
      body={tr.students.empty.firstUseBody}
      action={
        <Button variant="primary" onClick={onCreate}>
          {tr.students.newStudentLong}
        </Button>
      }
    />
  )
}

/** Satıra tıklayınca açılan hızlı özet — tasarımdaki 396px çekmece. */
function SummaryDrawer({
  row,
  onClose,
  onEdit,
  onOpenDetail,
}: {
  row: StudentRow | null
  onClose: () => void
  onEdit: (row: StudentRow) => void
  onOpenDetail: (row: StudentRow) => void
}) {
  if (!row) return null

  return (
    <Drawer open title={tr.students.drawer.title} onClose={onClose}>
      <div className={styles.drawerIdentity}>
        <Avatar name={row.fullName} size={46} />
        <div>
          <div className={styles.drawerName}>{row.fullName}</div>
          <StatusDot
            tone={row.isActive && !row.archived ? 'success' : 'neutral'}
            hollow={!row.isActive || row.archived}
            label={
              row.archived
                ? tr.students.table.archived
                : row.isActive
                  ? tr.students.table.active
                  : tr.students.table.passive
            }
          />
        </div>
      </div>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>{tr.students.drawer.contact}</div>
        <div className={styles.drawerValue}>
          {row.guardianName ?? tr.students.drawer.noGuardian}
        </div>
        {row.guardianPhone && (
          <div className={[styles.drawerValue, styles.tabular].join(' ')}>
            {formatPhone(row.guardianPhone)}
          </div>
        )}
        {/*
          Çekmece yalnızca BİRİNCİL veliyi gösteriyor. İkinci bir veli varsa bunu
          söylemek gerekiyor, yoksa kullanıcı "babanın numarası kayıtlı değil" sanır.
        */}
        {row.guardianCount > 1 && (
          <div className={styles.hint}>
            +{row.guardianCount - 1} {tr.students.drawer.moreGuardians}
          </div>
        )}
      </div>

      <div className={styles.drawerGrid}>
        <Box label={tr.students.drawer.balance} value={formatLira(row.balanceKurus)} />
        <Box
          label={tr.students.drawer.remaining}
          value={row.remainingLessons === null ? tr.units.emptyValue : String(row.remainingLessons)}
        />
        <Box label={tr.students.drawer.totalLessons} value={String(row.processedLessons)} />
        <Box
          label={tr.students.drawer.lastSession}
          value={row.lastSessionDate ? formatDate(row.lastSessionDate) : tr.units.emptyValue}
        />
      </div>

      <div className={styles.formActions}>
        <Button onClick={() => onEdit(row)}>{tr.actions.edit}</Button>
        <Button variant="primary" onClick={() => onOpenDetail(row)}>
          {tr.students.drawer.openDetail}
        </Button>
      </div>
    </Drawer>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.drawerBox}>
      <div className={styles.drawerLabel}>{label}</div>
      <div className={[styles.drawerBoxValue, styles.tabular].join(' ')}>{value}</div>
    </div>
  )
}
