import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scheduler, { Resource, View } from 'devextreme-react/scheduler'
import { loadMessages, locale } from 'devextreme/localization'
import trMessages from 'devextreme/localization/messages/tr.json'
import type {
  AppointmentClickEvent,
  AppointmentDblClickEvent,
  AppointmentFormOpeningEvent,
  AppointmentTooltipShowingEvent,
  AppointmentUpdatingEvent,
  CellClickEvent,
  ContentReadyEvent,
} from 'devextreme/ui/scheduler'
import 'devextreme/dist/css/dx.light.css'
import { tr } from '../../i18n/tr'
import {
  fetchClosedDaysInRange,
  fetchHasSchedule,
  fetchLocalNow,
  fetchRangeSessions,
  fetchSessionConflicts,
  rescheduleSession,
  type AppError,
  type DaySessionRow,
} from '../../lib/api'
import { formatDate, formatDateWithWeekday, monthNameTr } from '../../lib/format'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import {
  Button,
  ChipRow,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChip,
  LoadingState,
  SegmentedControl,
  useToast,
} from '../../ui'
import { AttendanceDrawer } from '../dersler/AttendanceDrawer'
import { SessionActions, type SessionAction } from '../dersler/SessionActions'
import { SessionForm } from '../dersler/SessionForm'
import { TemplateModal } from '../dersler/TemplateModal'
import { addDays, shiftMonth, weekStart } from './calendarGrid'
import {
  dateToDay,
  dateToTime,
  dateToWallClock,
  durationMinutes,
  snapDateToHalfHour,
  wallClockToDate,
} from './calendarDateAdapter'
import {
  rowsToAppointments,
  type CalendarAppointment,
} from './appointments'
import {
  allDaysClosed,
  filterBySubjects,
  filterByTeachers,
  subjectChips,
  teacherChips,
} from './filters'
import { MoveDialog, type PendingMove } from './MoveDialog'
import { RequestGate } from './requestGate'
import { SessionDetailPanel } from './SessionDetailPanel'
import styles from './Calendar.module.css'

loadMessages(trMessages)
locale('tr')

type CalendarView = 'month' | 'week' | 'workWeek' | 'day' | 'agenda'

interface PendingUpdate {
  appointment: CalendarAppointment
  start: Date
  end: Date
}

/**
 * DevExtreme yalnızca çizim ve jest katmanıdır. Veri, tarih ve bütün kalıcı işlemler
 * mevcut Tauri komutlarında kalır (ADR-034).
 */
export function CalendarPage() {
  const [now, setNow] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>('week')
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
  const [detail, setDetail] = useState<DaySessionRow | null>(null)
  const [attendance, setAttendance] = useState<DaySessionRow | null>(null)
  const [action, setAction] = useState<{ row: DaySessionRow; kind: SessionAction } | null>(
    null,
  )
  const [move, setMove] = useState<PendingMove | null>(null)
  const [conflict, setConflict] = useState<PendingUpdate | null>(null)
  const gate = useRef(new RequestGate())
  const loadedSpan = useRef<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    let active = true
    void fetchLocalNow()
      .then((stamp) => {
        if (!active) return
        setNow(stamp)
        setAnchor(stamp.slice(0, 10))
      })
      .catch((err) => {
        if (active) setError(err as AppError)
      })
    return () => {
      active = false
    }
  }, [])

  const span = useMemo(
    () => (anchor === null ? null : rangeOf(view, anchor)),
    [view, anchor],
  )

  const load = useCallback(async () => {
    if (span === null) return
    const request = gate.current.next()
    const spanKey = span.join(':')
    if (loadedSpan.current !== spanKey) setRows(null)
    setError(null)
    try {
      const [visible, closedDays, schedule] = await Promise.all([
        fetchRangeSessions(span[0], span[1]),
        fetchClosedDaysInRange(span[0], span[1]),
        fetchHasSchedule(),
      ])
      if (!gate.current.isCurrent(request)) return
      loadedSpan.current = spanKey
      setRows(visible)
      setClosed(new Set(closedDays))
      setHasSchedule(schedule)
      // Yeni aralıkta artık bulunmayan çip, görünmez bir filtre olarak kalamaz.
      const subjectIds = new Set(visible.map((row) => row.subjectId))
      const teacherIds = new Set(
        visible.flatMap((row) => (row.teacherId === null ? [] : [row.teacherId])),
      )
      setSubjects((current) => intersect(current, subjectIds))
      setTeachers((current) => intersect(current, teacherIds))
    } catch (err) {
      if (!gate.current.isCurrent(request)) return
      setError(err as AppError)
      setRows([])
    }
  }, [span])

  useEffect(() => {
    void load()
    return () => gate.current.invalidate()
  }, [load])

  const subjectRow = useMemo(() => subjectChips(rows ?? []), [rows])
  const teacherRow = useMemo(() => teacherChips(rows ?? []), [rows])
  const visible = useMemo(
    () => filterByTeachers(filterBySubjects(rows ?? [], subjects), teachers),
    [rows, subjects, teachers],
  )
  const appointments = useMemo(
    () => (now === null ? [] : rowsToAppointments(visible, now)),
    [visible, now],
  )
  const resources = useMemo(
    () =>
      teacherRow.map((teacher) => ({
        id: teacher.id,
        text: teacher.name,
      })),
    [teacherRow],
  )

  const refresh = () => {
    setFormOpen(false)
    setTemplateOpen(false)
    setEditing(null)
    setDraft(null)
    setDetail(null)
    setAttendance(null)
    setAction(null)
    setMove(null)
    setConflict(null)
    void load()
  }

  const clearFilters = () => {
    setSubjects(new Set())
    setTeachers(new Set())
  }

  const step = (delta: number) => {
    if (anchor === null) return
    if (view === 'month') setAnchor(shiftMonth(anchor, delta))
    else setAnchor(addDays(anchor, delta * stepDays(view)))
  }

  const openNew = (day?: string, startTime = '09:00') => {
    setEditing(null)
    setDraft(day === undefined ? null : { day, startTime })
    setFormOpen(true)
  }

  const beginUpdate = async (pending: PendingUpdate) => {
    const { appointment, start, end } = pending
    if (appointment.locked) {
      toast(tr.calendar.moveBlocked.locked)
      return
    }
    const snappedStart = snapDateToHalfHour(start)
    const snappedEnd = snapDateToHalfHour(end)
    if (
      dateToWallClock(snappedStart) === appointment.row.startsAt &&
      dateToWallClock(snappedEnd) === appointment.row.endsAt
    ) {
      return
    }
    if (closed.has(dateToDay(snappedStart))) {
      toast(tr.calendar.moveBlocked.closed)
      return
    }
    try {
      const conflicts = await fetchSessionConflicts(
        dateToWallClock(snappedStart),
        dateToWallClock(snappedEnd),
        appointment.id,
        appointment.teacherId,
      )
      const next = { appointment, start: snappedStart, end: snappedEnd }
      if (conflicts.length > 0) setConflict(next)
      else prepareMove(next)
    } catch (err) {
      toast((err as AppError).message)
    }
  }

  const prepareMove = (pending: PendingUpdate) => {
    const durationMin = durationMinutes(pending.start, pending.end)
    if (durationMin <= 0) {
      toast(tr.calendar.moveBlocked.failed)
      return
    }
    const next: PendingMove = {
      row: pending.appointment.row,
      day: dateToDay(pending.start),
      startTime: dateToTime(pending.start),
      durationMin,
      kind:
        durationMin !== rowDuration(pending.appointment.row)
          ? 'resize'
          : 'move',
    }
    setConflict(null)
    if (pending.appointment.seriesId === null) void applyMove(next, 'only')
    else setMove(next)
  }

  const applyMove = async (pending: PendingMove, scope: 'only' | 'following') => {
    const oldDuration = rowDuration(pending.row)
    try {
      const copy =
        pending.kind === 'resize' ? tr.calendar.resize : tr.calendar.move
      const report = await rescheduleSession(
        pending.row.id,
        `${pending.day} ${pending.startTime}`,
        pending.durationMin,
        scope,
      )
      setMove(null)
      if (scope === 'only') {
        toast(copy.done, {
          label: tr.calendar.move.undo,
          onAction: () =>
            void undoMove(
              pending.row.id,
              pending.row.startsAt,
              oldDuration,
              pending.kind,
            ),
        })
      } else {
        toast(`${report.moved} ${copy.doneFollowing}`)
      }
      void load()
    } catch (err) {
      setMove(null)
      toast((err as AppError).message)
      void load()
    }
  }

  const undoMove = async (
    sessionId: number,
    startsAt: string,
    durationMin: number,
    kind: PendingMove['kind'],
  ) => {
    try {
      await rescheduleSession(sessionId, startsAt, durationMin, 'only')
      toast(
        kind === 'resize'
          ? tr.calendar.resize.undone
          : tr.calendar.move.undone,
      )
    } catch (err) {
      toast((err as AppError).message)
    }
    void load()
  }

  const onAppointmentUpdating = (event: AppointmentUpdatingEvent) => {
    event.cancel = true
    const oldData = event.oldData as CalendarAppointment
    const next = { ...oldData, ...(event.newData as Partial<CalendarAppointment>) }
    void beginUpdate({
      appointment: oldData,
      start: next.startDate,
      end: next.endDate,
    })
  }

  const onAppointmentClick = (event: AppointmentClickEvent) => {
    event.cancel = true
    setDetail((event.appointmentData as CalendarAppointment).row)
  }

  const cancelDblClick = (event: AppointmentDblClickEvent) => {
    event.cancel = true
  }

  const cancelForm = (event: AppointmentFormOpeningEvent) => {
    event.cancel = true
  }

  const cancelTooltip = (event: AppointmentTooltipShowingEvent) => {
    event.cancel = true
  }

  const onCellClick = (event: CellClickEvent) => {
    event.cancel = true
    const date = event.cellData.startDate as Date
    const day = dateToDay(date)
    if (view === 'month') {
      setAnchor(day)
      setView('day')
      return
    }
    if (!closed.has(day)) openNew(day, dateToTime(snapDateToHalfHour(date)))
  }

  const title =
    anchor === null || span === null ? '' : rangeTitle(view, anchor, span)

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
            <Button
              size="small"
              onClick={() => setAnchor(now?.slice(0, 10) ?? null)}
            >
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
              { value: 'week', label: tr.calendar.views.week },
              { value: 'workWeek', label: tr.calendar.views.workWeek },
              { value: 'day', label: tr.calendar.views.day },
              { value: 'month', label: tr.calendar.views.month },
              { value: 'agenda', label: tr.calendar.views.agenda },
            ]}
          />
        </div>

        <div className={styles.filters}>
          {subjectRow.length > 0 && (
            <ChipRow>
              {subjectRow.map((chip) => (
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
          {(subjects.size > 0 || teachers.size > 0) && visible.length > 0 && (
            <Button size="small" onClick={clearFilters}>
              {tr.calendar.clearAllFilters}
            </Button>
          )}
        </div>

        {rows === null && !error && <LoadingState />}
        {error && <ErrorState message={error.message} onRetry={() => void load()} />}
        {rows !== null &&
          !error &&
          now !== null &&
          anchor !== null &&
          span !== null && (
            <CalendarBody
              view={view}
              anchor={anchor}
              now={now}
              rows={visible}
              unfiltered={rows}
              appointments={appointments}
              resources={resources}
              closed={closed}
              hasSchedule={hasSchedule}
              span={span}
              onClearFilters={clearFilters}
              onCreate={openNew}
              onTemplate={() => setTemplateOpen(true)}
              onAppointmentClick={onAppointmentClick}
              onAppointmentUpdating={onAppointmentUpdating}
              onAppointmentDblClick={cancelDblClick}
              onAppointmentFormOpening={cancelForm}
              onAppointmentTooltipShowing={cancelTooltip}
              onCellClick={onCellClick}
              onViewDateChange={(date) => setAnchor(dateToDay(date))}
            />
          )}
      </PageContent>

      <SessionDetailPanel
        row={detail}
        onClose={() => setDetail(null)}
        onEdit={(row) => {
          setDetail(null)
          setEditing(row)
          setFormOpen(true)
        }}
        onAttendance={(row) => {
          setDetail(null)
          setAttendance(row)
        }}
        onAction={(row, kind) => {
          setDetail(null)
          setAction({ row, kind })
        }}
      />
      {now !== null && (
        <AttendanceDrawer
          row={attendance}
          now={now}
          onClose={() => setAttendance(null)}
          onSaved={refresh}
        />
      )}
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
          onClose={() => {
            setMove(null)
            void load()
          }}
          onConfirm={(scope) => void applyMove(move, scope)}
        />
      )}
      <ConfirmDialog
        open={conflict !== null}
        title={tr.calendar.conflictDialog.title}
        description={tr.calendar.conflictDialog.body}
        confirmLabel={tr.calendar.conflictDialog.confirm}
        onCancel={() => {
          setConflict(null)
          void load()
        }}
        onConfirm={() => {
          if (conflict !== null) prepareMove(conflict)
        }}
      />
    </>
  )
}

interface CalendarBodyProps {
  view: CalendarView
  anchor: string
  now: string
  rows: readonly DaySessionRow[]
  unfiltered: readonly DaySessionRow[]
  appointments: readonly CalendarAppointment[]
  resources: readonly { id: number; text: string }[]
  closed: ReadonlySet<string>
  hasSchedule: boolean
  span: readonly [string, string]
  onClearFilters: () => void
  onCreate: (day?: string, startTime?: string) => void
  onTemplate: () => void
  onAppointmentClick: (event: AppointmentClickEvent) => void
  onAppointmentUpdating: (event: AppointmentUpdatingEvent) => void
  onAppointmentDblClick: (event: AppointmentDblClickEvent) => void
  onAppointmentFormOpening: (event: AppointmentFormOpeningEvent) => void
  onAppointmentTooltipShowing: (event: AppointmentTooltipShowingEvent) => void
  onCellClick: (event: CellClickEvent) => void
  onViewDateChange: (date: Date) => void
}

const CalendarBody = memo(CalendarBodyView, sameCalendarBodyProps)

function CalendarBodyView(props: CalendarBodyProps) {
  const days = daysBetween(props.span[0], props.span[1])
  const autoScrollKey = useRef<string | null>(null)
  const dataSource = useMemo(
    () => ({
      store: {
        type: 'array' as const,
        key: 'id',
        data: [...props.appointments],
      },
    }),
    [props.appointments],
  )
  const onContentReady = (event: ContentReadyEvent) => {
    if (props.view === 'month' || props.view === 'agenda') return
    const appointmentKey = props.appointments
      .map((item) => `${item.id}:${item.row.startsAt}:${item.row.endsAt}`)
      .join('|')
    const key = `${props.view}:${props.anchor}:${appointmentKey}`
    if (autoScrollKey.current === key) return
    autoScrollKey.current = key
    event.component.scrollTo(
      scrollTarget(props.now, props.span, props.appointments, props.anchor),
      { alignInView: 'center' },
    )
  }

  if (!props.hasSchedule && props.unfiltered.length === 0) {
    return (
      <EmptyState
        title={tr.calendar.empty.noSchedule}
        body={tr.calendar.empty.noScheduleBody}
        action={
          <Button variant="primary" onClick={() => props.onCreate(props.anchor)}>
            {tr.calendar.newSession}
          </Button>
        }
        secondaryAction={
          <Button onClick={props.onTemplate}>{tr.calendar.fromTemplate}</Button>
        }
      />
    )
  }
  if (allDaysClosed(days, props.closed)) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={
          props.view === 'day'
            ? tr.calendar.empty.dayClosed
            : tr.calendar.empty.allClosed
        }
        body={tr.calendar.empty.allClosedBody}
      />
    )
  }
  if (props.rows.length === 0 && props.unfiltered.length > 0) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={tr.calendar.empty.noResults}
        body={tr.calendar.empty.noResultsBody}
        action={
          <Button onClick={props.onClearFilters}>
            {tr.calendar.clearAllFilters}
          </Button>
        }
      />
    )
  }
  if (props.rows.length === 0) {
    return (
      <EmptyState
        kind="no-filter-results"
        title={
          props.view === 'day'
            ? tr.calendar.empty.dayEmpty
            : tr.calendar.noData
        }
        action={
          props.view === 'day' ? (
            <Button variant="primary" onClick={() => props.onCreate(props.anchor)}>
              {tr.calendar.newSession}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className={styles.schedulerFrame} data-testid="devextreme-scheduler">
      <Scheduler
        dataSource={dataSource}
        textExpr="text"
        startDateExpr="startDate"
        endDateExpr="endDate"
        currentDate={wallClockToDate(`${props.anchor} 12:00`)}
        currentView={props.view}
        onCurrentDateChange={(value) => {
          if (value instanceof Date) props.onViewDateChange(value)
        }}
        firstDayOfWeek={1}
        cellDuration={30}
        startDayHour={0}
        endDayHour={24}
        showAllDayPanel={false}
        showCurrentTimeIndicator
        shadeUntilCurrentTime={false}
        timeZone="Europe/Istanbul"
        noDataText={tr.calendar.noData}
        height="100%"
        focusStateEnabled
        toolbar={{ visible: false }}
        editing={{
          allowAdding: false,
          allowDeleting: false,
          allowUpdating: true,
          allowDragging: true,
          allowResizing: true,
          allowTimeZoneEditing: false,
        }}
        appointmentDragging={{
          autoScroll: true,
          scrollSensitivity: 80,
          scrollSpeed: 30,
          onDragStart: (event) => {
            const item = event.itemData as CalendarAppointment
            if (item.locked) event.cancel = true
          },
        }}
        appointmentComponent={AppointmentContent}
        dateCellRender={(data) => <DateCell date={data.date as Date} />}
        timeCellRender={(data) => (
          <span className={styles.timeCell}>{dateToTime(data.date as Date)}</span>
        )}
        dataCellRender={(data) => (
          <span
            className={styles.dataCell}
            data-closed={props.closed.has(dateToDay(data.startDate as Date))}
            aria-label={
              props.closed.has(dateToDay(data.startDate as Date))
                ? tr.calendar.empty.dayClosed
                : undefined
            }
          />
        )}
        resourceCellRender={(data) => (
          <span className={styles.resourceName}>{String(data.text ?? '')}</span>
        )}
        onAppointmentClick={props.onAppointmentClick}
        onAppointmentDblClick={props.onAppointmentDblClick}
        onAppointmentFormOpening={props.onAppointmentFormOpening}
        onAppointmentTooltipShowing={props.onAppointmentTooltipShowing}
        onAppointmentUpdating={props.onAppointmentUpdating}
        onCellClick={props.onCellClick}
        onContentReady={onContentReady}
      >
        <View type="week" name="week" />
        <View type="workWeek" name="workWeek" />
        <View
          type="day"
          name="day"
          groups={props.resources.length > 0 ? ['teacherId'] : []}
          groupOrientation="horizontal"
        />
        <View type="month" name="month" />
        <View type="agenda" name="agenda" agendaDuration={14} />
        <Resource
          fieldExpr="teacherId"
          valueExpr="id"
          displayExpr="text"
          label={tr.calendar.teachers}
          dataSource={[...props.resources]}
        />
      </Scheduler>
    </div>
  )
}

function sameCalendarBodyProps(
  previous: CalendarBodyProps,
  next: CalendarBodyProps,
): boolean {
  return (
    previous.view === next.view &&
    previous.anchor === next.anchor &&
    previous.now === next.now &&
    previous.rows === next.rows &&
    previous.unfiltered === next.unfiltered &&
    previous.appointments === next.appointments &&
    previous.resources === next.resources &&
    previous.closed === next.closed &&
    previous.hasSchedule === next.hasSchedule &&
    previous.span === next.span
  )
}

function AppointmentContent({
  data,
}: {
  data: {
    appointmentData?: CalendarAppointment
    targetedAppointmentData?: CalendarAppointment
  }
}) {
  const item = data.targetedAppointmentData ?? data.appointmentData
  if (item === undefined) return null
  const labels = [
    `${dateToTime(item.startDate)}–${dateToTime(item.endDate)}`,
    item.subjectName,
    item.title,
    item.teacherName ?? '',
    item.kind === 'group' ? tr.calendar.group : tr.calendar.solo,
    item.isMakeup ? tr.calendar.makeup : '',
    item.status === 'cancelled' ? tr.calendar.cancelled : '',
    item.attendanceMissing ? tr.calendar.attendanceMissing : '',
    item.locked ? tr.calendar.locked : '',
    item.conflict ? tr.calendar.conflict : '',
  ].filter(Boolean)
  return (
    <div
      className={styles.appointment}
      style={{ '--subject-color': item.subjectColor } as React.CSSProperties}
      data-kind={item.kind}
      data-makeup={item.isMakeup}
      data-cancelled={item.status === 'cancelled'}
      data-past={item.isPast}
      data-attendance-missing={item.attendanceMissing}
      data-locked={item.locked}
      data-conflict={item.conflict}
      role="button"
      tabIndex={0}
      aria-label={labels.join(tr.units.separator)}
    >
      <span className={styles.appointmentTime}>
        {dateToTime(item.startDate)}–{dateToTime(item.endDate)}
      </span>
      <strong>{item.subjectName}</strong>
      <span>{item.title}</span>
      <span className={styles.appointmentMeta}>{item.teacherName}</span>
      <span className={styles.appointmentTags}>
        {item.kind === 'group' ? tr.calendar.group : tr.calendar.solo}
        {item.isMakeup && ` · ${tr.calendar.makeup}`}
        {item.attendanceMissing && ` · ${tr.calendar.attendanceMissing}`}
        {item.status === 'cancelled' && ` · ${tr.calendar.cancelled}`}
        {item.locked && ` · 🔒 ${tr.calendar.locked}`}
        {item.conflict && ` · ! ${tr.calendar.conflict}`}
      </span>
    </div>
  )
}

function DateCell({ date }: { date: Date }) {
  const weekday = tr.dates.weekdaysShortMonFirst[(date.getDay() + 6) % 7] ?? ''
  return (
    <span className={styles.dateCell}>
      {weekday} {date.getDate()}
    </span>
  )
}

function rangeOf(view: CalendarView, anchor: string): [string, string] {
  if (view === 'day') return [anchor, anchor]
  if (view === 'month') {
    const first = `${anchor.slice(0, 7)}-01`
    const start = weekStart(first)
    return [start, addDays(start, 41)]
  }
  if (view === 'agenda') return [anchor, addDays(anchor, 13)]
  const monday = weekStart(anchor)
  return [monday, addDays(monday, view === 'workWeek' ? 4 : 6)]
}

function rangeTitle(
  view: CalendarView,
  anchor: string,
  span: readonly [string, string],
): string {
  if (view === 'day') return formatDateWithWeekday(anchor)
  if (view === 'month') {
    return `${monthNameTr(Number(anchor.slice(5, 7)))} ${anchor.slice(0, 4)}`
  }
  return `${formatDate(span[0])} – ${formatDate(span[1])}`
}

function stepDays(view: CalendarView): number {
  if (view === 'day') return 1
  if (view === 'agenda') return 14
  return 7
}

function rowDuration(row: DaySessionRow): number {
  return durationMinutes(
    wallClockToDate(row.startsAt),
    wallClockToDate(row.endsAt),
  )
}

function toggle(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set)
  if (!next.delete(id)) next.add(id)
  return next
}

function intersect(
  selected: ReadonlySet<number>,
  available: ReadonlySet<number>,
): ReadonlySet<number> {
  const next = new Set([...selected].filter((id) => available.has(id)))
  if (
    next.size === selected.size &&
    [...next].every((id) => selected.has(id))
  ) {
    return selected
  }
  return next
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

function scrollTarget(
  now: string,
  span: readonly [string, string],
  appointments: readonly CalendarAppointment[],
  anchor: string,
): Date {
  const today = now.slice(0, 10)
  if (today >= span[0] && today <= span[1]) return wallClockToDate(now)
  const first = appointments.reduce<Date | null>(
    (earliest, appointment) =>
      earliest === null || appointment.startDate < earliest
        ? appointment.startDate
        : earliest,
    null,
  )
  return first ?? wallClockToDate(`${anchor} 08:00`)
}
