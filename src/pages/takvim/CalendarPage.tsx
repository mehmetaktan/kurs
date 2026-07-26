import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchClosedDaysInRange,
  fetchHasSchedule,
  fetchLocalNow,
  fetchRangeSessions,
  rescheduleSession,
  type AppError,
  type DaySessionRow,
} from '../../lib/api'
import { formatDate, formatDateWithWeekday, minutesToTime, monthNameTr } from '../../lib/format'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import {
  Button,
  ChipRow,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  SegmentedControl,
  useToast,
} from '../../ui'
import { SessionActions, type SessionAction } from '../dersler/SessionActions'
import { SessionForm } from '../dersler/SessionForm'
import { TemplateModal } from '../dersler/TemplateModal'
import { addDays, shiftMonth, weekDays, weekStart } from './calendarGrid'
import {
  allDaysClosed,
  filterBySubjects,
  filterByTeachers,
  subjectChips,
  teacherChips,
} from './filters'
import { MonthGrid } from './MonthGrid'
import { MoveDialog, type PendingMove } from './MoveDialog'
import { WeekGrid } from './WeekGrid'
import styles from './Calendar.module.css'

type CalendarView = 'month' | 'week' | 'day'

/**
 * Takvim ekranı — `EKRANLAR §2`, `ADR-031` (ızgara elde yazıldı).
 *
 * **İki filtre ekseni: branş ve öğretmen** (ADR-038 — kurs çok öğretmenli, ADR-037).
 * **Gün görünümü tek sütun kalır**; tasarımın öğretmen-başına-sütun düzeni ADR-034'ün
 * dondurmasının içinde ve kurulmuyor.
 *
 * "Şimdi" tek kaynaktan geliyor (`local_now`, ADR-029): başlık, "şimdi" çizgisi ve
 * açılış kaydırması aynı damgayı okuyor. Ekran hiçbir yerde `new Date()` çağırmıyor.
 */
export function CalendarPage() {
  const [now, setNow] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>('week')
  /** Görünümün demir attığı gün. Gezinme bunu kaydırıyor, aralık bundan türüyor. */
  const [anchor, setAnchor] = useState<string | null>(null)
  const [rows, setRows] = useState<DaySessionRow[] | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const [hasSchedule, setHasSchedule] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const [subjects, setSubjects] = useState<ReadonlySet<number>>(new Set())
  const [teachers, setTeachers] = useState<ReadonlySet<number>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [editing, setEditing] = useState<DaySessionRow | null>(null)
  const [draft, setDraft] = useState<{ day: string; startTime: string } | null>(null)
  const [action, setAction] = useState<{ row: DaySessionRow; kind: SessionAction } | null>(null)
  const [move, setMove] = useState<PendingMove | null>(null)
  const toast = useToast()

  const days = useMemo(
    () => (anchor === null ? [] : view === 'day' ? [anchor] : weekDays(anchor)),
    [anchor, view],
  )
  const span = useMemo(() => (anchor === null ? null : rangeOf(view, anchor)), [view, anchor])

  const load = useCallback(async () => {
    setError(null)
    try {
      const stamp = await fetchLocalNow()
      setNow(stamp)
      const at = anchor ?? stamp.slice(0, 10)
      if (anchor === null) setAnchor(at)

      const [from, to] = rangeOf(view, at)
      const [visible, closedDays, schedule] = await Promise.all([
        fetchRangeSessions(from, to),
        fetchClosedDaysInRange(from, to),
        fetchHasSchedule(),
      ])
      setRows(visible)
      setClosed(new Set(closedDays))
      setHasSchedule(schedule)
    } catch (err) {
      setError(err as AppError)
      setRows(null)
    }
  }, [anchor, view])

  useEffect(() => {
    void load()
  }, [load])

  const chips = useMemo(() => subjectChips(rows ?? []), [rows])
  // Öğretmen çipleri **süzülmemiş** listeden: branş seçilince öğretmen sayıları da
  // düşseydi kullanıcı iki eksenin hangisini daralttığını takip edemezdi.
  const teacherRow = useMemo(() => teacherChips(rows ?? []), [rows])
  const visible = useMemo(
    () => filterByTeachers(filterBySubjects(rows ?? [], subjects), teachers),
    [rows, subjects, teachers],
  )

  const refresh = () => {
    setFormOpen(false)
    setTemplateOpen(false)
    setEditing(null)
    setDraft(null)
    setAction(null)
    setMove(null)
    void load()
  }

  const step = (delta: number) => {
    if (anchor === null) return
    if (view === 'month') setAnchor(shiftMonth(anchor, delta))
    else setAnchor(addDays(anchor, view === 'day' ? delta : delta * 7))
  }

  const openNew = (day?: string, startMin?: number) => {
    setEditing(null)
    setDraft(
      day === undefined
        ? null
        : { day, startTime: minutesToTime(startMin ?? 0) ?? '09:00' },
    )
    setFormOpen(true)
  }

  const openDay = (day: string) => {
    setAnchor(day)
    setView('day')
  }

  /**
   * Sürükleme bitti. Şablona bağlı derste kapsam **sorulur** (R3.8); bağlı değilse soru
   * çıkmaz — "sonraki dersler" diye bir şey yok, taşınan tek ders var.
   */
  const onMove = (row: DaySessionRow, day: string, startMin: number) => {
    const pending: PendingMove = { row, day, startTime: minutesToTime(startMin) ?? '00:00' }
    if (row.seriesId === null) void applyMove(pending, 'only')
    else setMove(pending)
  }

  const applyMove = async (pending: PendingMove, scope: 'only' | 'following') => {
    const { row, day, startTime } = pending
    const before = row.startsAt
    try {
      const report = await rescheduleSession(
        row.id,
        `${day} ${startTime}`,
        durationOf(row),
        scope,
      )
      setMove(null)
      // R3.12 — taşıma geri alınabilir. **Yalnızca tek derste**: "bu ve sonraki dersler"
      // eski şablonu kapatıp yenisini açıyor ve onu geri almak üçüncü bir şablon
      // yazmak olurdu. Kullanıcı için doğrusu dersi tekrar sürüklemek.
      if (scope === 'only') {
        toast(tr.calendar.move.done, {
          label: tr.calendar.move.undo,
          onAction: () => void undoMove(row.id, before, durationOf(row)),
        })
      } else {
        toast(`${report.moved} ${tr.calendar.move.doneFollowing}`)
      }
      void load()
    } catch (err) {
      // Hata diyalogda kalıyor; bir taşıma başarısızsa kullanıcı nedenini görmeli
      // (yoklama alınmış ders, tatil günü). Rust'ın Türkçe cümlesi olduğu gibi geçiyor.
      setMove(null)
      toast((err as AppError).message)
    }
  }

  const undoMove = async (sessionId: number, startsAt: string, durationMin: number) => {
    try {
      await rescheduleSession(sessionId, startsAt, durationMin, 'only')
      toast(tr.calendar.move.undone)
    } catch (err) {
      toast((err as AppError).message)
    }
    void load()
  }

  const title = useMemo(() => (anchor === null ? '' : rangeTitle(view, anchor)), [view, anchor])

  return (
    <>
      <PageHeader
        title={tr.pages.calendar.title}
        subtitle={title}
        action={
          <Button variant="primary" onClick={() => openNew()}>
            {tr.calendar.newSession}
          </Button>
        }
      />

      <PageContent fill>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <Button size="small" onClick={() => step(-1)} aria-label={tr.calendar.prev}>
              ‹
            </Button>
            <Button size="small" onClick={() => setAnchor(now?.slice(0, 10) ?? null)}>
              {tr.calendar.today}
            </Button>
            <Button size="small" onClick={() => step(1)} aria-label={tr.calendar.next}>
              ›
            </Button>
          </div>

          <SegmentedControl
            label={tr.pages.calendar.title}
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: tr.calendar.views.month },
              { value: 'week', label: tr.calendar.views.week },
              { value: 'day', label: tr.calendar.views.day },
            ]}
          />
        </div>

        {chips.length > 0 && (
          <ChipRow>
            {chips.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.name}
                count={chip.count}
                active={subjects.has(chip.id)}
                onClick={() => setSubjects(toggle(subjects, chip.id))}
              />
            ))}
          </ChipRow>
        )}

        {/* İkinci eksen yalnızca birden fazla öğretmen görünürken çıkar: tek
            öğretmenli bir haftada çip satırı hiçbir şeyi süzmez, sadece yer kaplar. */}
        {teacherRow.length > 1 && (
          <ChipRow>
            {teacherRow.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.name}
                count={chip.count}
                active={teachers.has(chip.id)}
                onClick={() => setTeachers(toggle(teachers, chip.id))}
              />
            ))}
          </ChipRow>
        )}

        {rows === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}

        {rows !== null && !error && now !== null && anchor !== null && span !== null && (
          <CalendarBody
            view={view}
            anchor={anchor}
            now={now}
            days={days}
            rows={visible}
            unfiltered={rows}
            closed={closed}
            hasSchedule={hasSchedule}
            onClearFilter={() => setSubjects(new Set())}
            onSelect={(row) => {
              setEditing(row)
              setDraft(null)
              setFormOpen(true)
            }}
            onCreate={openNew}
            onMove={onMove}
            onOpenDay={openDay}
            onTemplate={() => setTemplateOpen(true)}
          />
        )}
      </PageContent>

      {now !== null && (
        <SessionForm
          open={formOpen}
          today={now.slice(0, 10)}
          session={editing}
          initialDay={draft?.day}
          initialTime={draft?.startTime}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
            setDraft(null)
          }}
          onSaved={refresh}
        />
      )}

      {now !== null && (
        <TemplateModal
          open={templateOpen}
          today={now.slice(0, 10)}
          onClose={() => setTemplateOpen(false)}
          onApplied={refresh}
        />
      )}

      {now !== null && action !== null && (
        <SessionActions
          action={action.kind}
          row={action.row}
          today={now.slice(0, 10)}
          onClose={() => setAction(null)}
          onDone={refresh}
        />
      )}

      {move !== null && (
        <MoveDialog
          pending={move}
          onClose={() => setMove(null)}
          onConfirm={(scope) => void applyMove(move, scope)}
        />
      )}
    </>
  )
}

interface BodyProps {
  view: CalendarView
  anchor: string
  now: string
  days: readonly string[]
  rows: readonly DaySessionRow[]
  /** Süzülmemiş satırlar — "filtre sonuçsuz" ile "hafta boş"u ayırmanın tek yolu. */
  unfiltered: readonly DaySessionRow[]
  closed: ReadonlySet<string>
  hasSchedule: boolean
  onClearFilter: () => void
  onSelect: (row: DaySessionRow) => void
  onCreate: (day: string, startMin: number) => void
  onMove: (row: DaySessionRow, day: string, startMin: number) => void
  onOpenDay: (day: string) => void
  onTemplate: () => void
}

/**
 * Izgara ya da **dört ayrı boş durumdan biri** (`EKRANLAR §149`).
 *
 * Dördü tek bir "kayıt yok" ile anlatılamıyor çünkü kullanıcının yapabileceği şey her
 * birinde farklı: program hiç yoksa kurmalı, hafta tatilse yapacak bir şey yok, filtre
 * boşsa filtreyi temizlemeli, gün boşsa ders ekleyebilir. Sıra bağlayıcı: en dıştaki
 * sebep önce sorulur.
 */
function CalendarBody({
  view,
  anchor,
  now,
  days,
  rows,
  unfiltered,
  closed,
  hasSchedule,
  onClearFilter,
  onSelect,
  onCreate,
  onMove,
  onOpenDay,
  onTemplate,
}: BodyProps) {
  if (view === 'month') {
    return (
      <MonthGrid anchor={anchor} now={now} rows={rows} closedDays={closed} onOpenDay={onOpenDay} />
    )
  }

  // 1 · İlk kullanım: program hiç kurulmamış. Bu ekranda görülebilecek en boş hâl.
  if (!hasSchedule && unfiltered.length === 0) {
    return (
      <EmptyState
        title={tr.calendar.empty.noSchedule}
        body={tr.calendar.empty.noScheduleBody}
        action={
          <Button variant="primary" onClick={() => onCreate(days[0] ?? anchor, 9 * 60)}>
            {tr.calendar.newSession}
          </Button>
        }
        secondaryAction={<Button onClick={onTemplate}>{tr.calendar.fromTemplate}</Button>}
      />
    )
  }

  // 2 · Hafta (ya da gün) tamamen kapalı: ders eklenemeyeceği için eylem de sunulmuyor.
  if (allDaysClosed(days, closed)) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={view === 'day' ? tr.calendar.empty.dayClosed : tr.calendar.empty.allClosed}
        body={tr.calendar.empty.allClosedBody}
      />
    )
  }

  // 3 · Filtre sonuçsuz: veri VAR ama seçilen branşlarda yok.
  if (rows.length === 0 && unfiltered.length > 0) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.calendar.empty.noResults}
        body={tr.calendar.empty.noResultsBody}
        action={<Button onClick={onClearFilter}>{tr.calendar.empty.clearFilter}</Button>}
      />
    )
  }

  // 4 · Gün boş. Haftada boş bir gün boş bir sütundur, boş durum değil — bu yüzden
  // yalnızca gün görünümünde soruluyor.
  if (view === 'day' && rows.length === 0) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.calendar.empty.dayEmpty}
        action={
          <Button variant="primary" onClick={() => onCreate(anchor, 9 * 60)}>
            {tr.calendar.newSession}
          </Button>
        }
      />
    )
  }

  return (
    <WeekGrid
      days={days}
      now={now}
      rows={rows}
      closedDays={closed}
      onSelect={onSelect}
      onCreate={onCreate}
      onMove={onMove}
    />
  )
}

/** Görünümün sorgulayacağı tarih aralığı (`from`, `to`). */
function rangeOf(view: CalendarView, anchor: string): [string, string] {
  if (view === 'day') return [anchor, anchor]
  if (view === 'week') {
    const monday = weekStart(anchor)
    return [monday, addDays(monday, 6)]
  }
  // Ay ızgarası 6 hafta çiziyor ve komşu ayın günleri de dolu görünmeli.
  const first = `${anchor.slice(0, 7)}-01`
  const start = weekStart(first)
  return [start, addDays(start, 41)]
}

/** Başlıktaki tarih aralığı: `20.07.2026 – 26.07.2026` · `Temmuz 2026` · gün adıyla. */
function rangeTitle(view: CalendarView, anchor: string): string {
  if (view === 'day') return formatDateWithWeekday(anchor)
  if (view === 'month') return `${monthNameTr(Number(anchor.slice(5, 7)))} ${anchor.slice(0, 4)}`
  const monday = weekStart(anchor)
  return `${formatDate(monday)} – ${formatDate(addDays(monday, 6))}`
}

function durationOf(row: DaySessionRow): number {
  const minutes = (stamp: string) =>
    Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16))
  const diff = minutes(row.endsAt) - minutes(row.startsAt)
  return diff > 0 ? diff : diff + 24 * 60
}

function toggle(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set)
  if (!next.delete(id)) next.add(id)
  return next
}
