import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scheduler, { Resource, View } from 'devextreme-react/scheduler'
import ArrayStore from 'devextreme/data/array_store'
import { loadMessages, locale } from 'devextreme/localization'
import trMessages from 'devextreme/localization/messages/tr.json'
import { confirm } from 'devextreme/ui/dialog'
import type {
  AppointmentAddingEvent,
  AppointmentDblClickEvent,
  AppointmentDeletingEvent,
  AppointmentFormOpeningEvent,
  AppointmentUpdatingEvent,
  CellClickEvent,
  ContentReadyEvent,
  SchedulerPredefinedToolbarItem,
} from 'devextreme/ui/scheduler'
import 'devextreme/dist/css/dx.light.css'
import { tr } from '../../i18n/tr'
import {
  fetchClosedDaysInRange,
  fetchHasSchedule,
  fetchGroupList,
  fetchLocalNow,
  fetchRangeSessions,
  fetchSettings,
  fetchSessionConflicts,
  fetchStudentList,
  fetchSubjects,
  fetchTeachers,
  rescheduleSession,
  saveSession,
  type AppError,
  type DaySessionRow,
} from '../../lib/api'
import { formatDate, formatDateWithWeekday, monthNameTr } from '../../lib/format'
import { navigate } from '../../lib/router'
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
  useToast,
} from '../../ui'
import { AttendanceDrawer } from '../dersler/AttendanceDrawer'
import { SessionActions, type SessionAction } from '../dersler/SessionActions'
import { SessionForm } from '../dersler/SessionForm'
import { PaymentModal } from '../odemeler/PaymentModal'
import { addDays, weekStart } from './calendarGrid'
import {
  dateToDay,
  dateToTime,
  dateToWallClock,
  durationMinutes,
  snapDateToInterval,
  wallClockToDate,
} from './calendarDateAdapter'
import {
  rowsToAppointments,
  type CalendarAppointment,
} from './appointments'
import {
  filterBySubjects,
  filterByTeachers,
  subjectChips,
  teacherChips,
} from './filters'
import { MoveDialog, type PendingMove } from './MoveDialog'
import { RequestGate } from './requestGate'
import { SessionDetailPanel } from './SessionDetailPanel'
import {
  calendarSettingsOf,
  visibleDayHours,
  type CalendarSettings,
} from './calendarSettings'
import {
  configureNativeAppointmentForm,
  nativeDraftToSessionInput,
  type CalendarCatalogs,
  type NativeAppointmentDraft,
} from './nativeAppointmentForm'
import styles from './Calendar.module.css'

loadMessages(trMessages)
locale('tr')

const SCHEDULER_TOOLBAR = {
  visible: true,
  multiline: true,
  items: [
    'today',
    'dateNavigator',
    'viewSwitcher',
  ] as SchedulerPredefinedToolbarItem[],
}

const SCHEDULER_EDITING = {
  allowAdding: true,
  allowDeleting: true,
  allowUpdating: true,
  allowDragging: true,
  allowResizing: true,
  allowTimeZoneEditing: false,
}

const TEACHER_GROUP = ['teacherId']
const NO_GROUPS: string[] = []

type CalendarView = 'month' | 'week' | 'workWeek' | 'day' | 'agenda'

const CALENDAR_PREFERENCE_KEY = 'kurs.calendar.preference.v1'

interface CalendarPreference {
  view: CalendarView
  anchor: string
}

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
  const initialPreference = useMemo(readCalendarPreference, [])
  const [now, setNow] = useState<string | null>(null)
  const [view, setView] = useState<CalendarView>(
    initialPreference?.view ?? 'day',
  )
  const [anchor, setAnchor] = useState<string | null>(
    initialPreference?.anchor ?? null,
  )
  const [rows, setRows] = useState<DaySessionRow[] | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const [hasSchedule, setHasSchedule] = useState(true)
  const [settings, setSettings] = useState<CalendarSettings | null>(null)
  const [catalogs, setCatalogs] = useState<CalendarCatalogs>({
    subjects: [],
    groups: [],
    students: [],
    teachers: [],
  })
  const [error, setError] = useState<AppError | null>(null)
  const [subjects, setSubjects] = useState<ReadonlySet<number>>(new Set())
  const [teachers, setTeachers] = useState<ReadonlySet<number>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DaySessionRow | null>(null)
  const [draft, setDraft] = useState<{ day: string; startTime: string } | null>(null)
  const [detail, setDetail] = useState<DaySessionRow | null>(null)
  const [attendance, setAttendance] = useState<DaySessionRow | null>(null)
  const [paymentStudentId, setPaymentStudentId] = useState<
    number | null | undefined
  >(undefined)
  const [action, setAction] = useState<{ row: DaySessionRow; kind: SessionAction } | null>(
    null,
  )
  const [move, setMove] = useState<PendingMove | null>(null)
  const [conflict, setConflict] = useState<PendingUpdate | null>(null)
  const gate = useRef(new RequestGate())
  const loadedSpan = useRef<string | null>(null)
  const nativeFormTarget = useRef<number | 'new' | null>(null)
  const scheduler = useRef<AppointmentAddingEvent['component'] | null>(null)
  const lastCellClick = useRef<{ key: string; timestamp: number } | null>(null)
  const toast = useToast()

  useEffect(() => {
    let active = true
    void Promise.all([
      fetchLocalNow(),
      fetchSettings(),
      fetchSubjects(),
      fetchGroupList(),
      fetchStudentList(),
      fetchTeachers(),
    ])
      .then(([stamp, settingRows, subjectRows, groupRows, studentRows, teacherRows]) => {
        if (!active) return
        setNow(stamp)
        setAnchor((current) => current ?? stamp.slice(0, 10))
        setSettings(calendarSettingsOf(settingRows))
        setCatalogs({
          subjects: subjectRows,
          groups: groupRows.filter((row) => !row.archived && row.isActive),
          students: studentRows.filter((row) => !row.archived && row.isActive),
          teachers: teacherRows.filter((row) => row.isActive),
        })
      })
      .catch((err) => {
        if (active) setError(err as AppError)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (anchor === null) return
    writeCalendarPreference({ view, anchor })
  }, [anchor, view])

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
      catalogs.teachers.map((teacher) => ({
        id: teacher.id,
        text: teacher.fullName,
      })),
    [catalogs.teachers],
  )

  const refresh = () => {
    setFormOpen(false)
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

  const openNew = (day?: string, startTime = '09:00') => {
    setEditing(null)
    setDraft(day === undefined ? null : { day, startTime })
    setFormOpen(true)
  }

  const openNativeNew = () => {
    if (
      scheduler.current === null ||
      settings === null ||
      anchor === null ||
      now === null
    ) {
      openNew()
      return
    }
    const today = now.slice(0, 10)
    const day =
      span !== null && today >= span[0] && today <= span[1] ? today : anchor
    const startTime =
      day === today
        ? dateToTime(
            snapDateToInterval(
              wallClockToDate(now),
              settings.slotMinutes,
            ),
          )
        : settings.dayStart
    const startDate = wallClockToDate(`${day} ${startTime}`)
    scheduler.current.showAppointmentPopup(
      {
        startDate,
        endDate: new Date(
          startDate.getTime() + settings.defaultSessionMinutes * 60_000,
        ),
      },
      true,
    )
  }

  const beginUpdate = async (pending: PendingUpdate) => {
    const { appointment, start, end } = pending
    if (appointment.locked) {
      toast(tr.calendar.moveBlocked.locked)
      return
    }
    const interval = settings?.slotMinutes ?? 30
    const snappedStart = snapDateToInterval(start, interval)
    const snappedEnd = snapDateToInterval(end, interval)
    if (
      dateToWallClock(snappedStart) === appointment.row.startsAt &&
      dateToWallClock(snappedEnd) === appointment.row.endsAt
    ) {
      return
    }
    if (
      appointment.row.rescheduledOnce === true &&
      dateToWallClock(snappedStart) !== appointment.row.startsAt
    ) {
      toast(tr.calendar.moveBlocked.rescheduledOnce)
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
        if (pending.row.seriesId !== null && pending.row.studyGroupId !== null) {
          toast(tr.calendar.planUpdated)
          void load()
          return
        }
        setRows((current) =>
          current === null
            ? current
            : replaceMovedRow(
                current,
                pending.row.id,
                pending.day,
                pending.startTime,
                pending.durationMin,
              ),
        )
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
        void load()
      }
    } catch (err) {
      setMove(null)
      toast((err as AppError).message)
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
      setRows((current) =>
        current === null
          ? current
          : replaceMovedRow(
              current,
              sessionId,
              startsAt.slice(0, 10),
              startsAt.slice(11, 16),
              durationMin,
              kind === 'move' ? false : undefined,
            ),
      )
      toast(
        kind === 'resize'
          ? tr.calendar.resize.undone
          : tr.calendar.move.undone,
      )
    } catch (err) {
      toast((err as AppError).message)
    }
  }

  const onAppointmentUpdating = (event: AppointmentUpdatingEvent) => {
    const oldAppointment = event.oldData as CalendarAppointment
    const changed = event.newData as Partial<NativeAppointmentDraft>
    if (nativeFormTarget.current === oldAppointment.id) {
      event.cancel = persistNativeAppointment(
        {
          id: oldAppointment.id,
          startDate: oldAppointment.startDate,
          endDate: oldAppointment.endDate,
          kind: oldAppointment.row.kind === 'solo' ? 'solo' : 'group',
          subjectId: oldAppointment.row.subjectId,
          teacherId: oldAppointment.row.teacherId,
          studyGroupId: oldAppointment.row.studyGroupId,
          studentId: oldAppointment.row.studentId,
          source: oldAppointment,
          ...changed,
        },
        event.component,
      )
      return
    }
    event.cancel = true
    const next = {
      ...oldAppointment,
      ...(event.newData as Partial<CalendarAppointment>),
    }
    void beginUpdate({
      appointment: oldAppointment,
      start: next.startDate,
      end: next.endDate,
    })
  }

  const onAppointmentFormOpening = (event: AppointmentFormOpeningEvent) => {
    const appointment = event.appointmentData as
      | Partial<CalendarAppointment>
      | undefined
    if (appointment?.row?.status === 'cancelled') {
      event.cancel = true
      if (appointment.row.restoreAllowed === false) {
        toast(tr.sessions.restore.movedSource)
      } else {
        setAction({ row: appointment.row, kind: 'restore' })
      }
      return
    }
    if (settings === null || now === null) return
    const target = appointment?.row?.id ?? 'new'
    nativeFormTarget.current = target
    event.popup.on('hidden', () => {
      if (nativeFormTarget.current === target) nativeFormTarget.current = null
    })
    const closeAndRun = (run: () => void) => {
      event.popup.hide()
      run()
    }
    configureNativeAppointmentForm(event, catalogs, settings, now, {
      onAttendance: (row) => closeAndRun(() => setAttendance(row)),
      onPayment: (studentId) =>
        closeAndRun(() => setPaymentStudentId(studentId)),
      onReschedule: (row) =>
        closeAndRun(() => setAction({ row, kind: 'reschedule' })),
      onCancel: (row) => closeAndRun(() => setAction({ row, kind: 'cancel' })),
      onArchive: (row) => closeAndRun(() => setAction({ row, kind: 'remove' })),
    })
  }

  const persistNativeAppointment = async (
    draft: NativeAppointmentDraft,
    component: AppointmentAddingEvent['component'],
  ): Promise<boolean> => {
    const input = nativeDraftToSessionInput(draft)
    if (input === null) {
      toast(tr.calendar.nativeForm.invalid)
      return true
    }
    if (closed.has(input.day)) {
      toast(tr.sessions.form.errors.closedDay)
      return true
    }
    try {
      const conflicts = await fetchSessionConflicts(
        `${input.day} ${input.startTime}`,
        dateToWallClock(draft.endDate),
        input.id,
        input.teacherId,
      )
      if (conflicts.length > 0) {
        const accepted = await confirm(
          tr.sessions.conflict.body,
          tr.sessions.conflict.title,
        )
        if (!accepted) return true
      }
      await saveSession(input)
      component.hideAppointmentPopup(false)
      toast(
        input.id !== null
          ? tr.sessions.form.savedEdit
          : tr.sessions.form.savedOnce,
      )
      void load()
    } catch (err) {
      toast((err as AppError).message)
    }
    // Kalıcı veri yalnız Tauri komutundan döner; ArrayStore'a geçici kayıt yazılmaz.
    return true
  }

  const onAppointmentAdding = (event: AppointmentAddingEvent) => {
    event.cancel = persistNativeAppointment(
      event.appointmentData as NativeAppointmentDraft,
      event.component,
    )
  }

  const onAppointmentDeleting = (event: AppointmentDeletingEvent) => {
    event.cancel = true
    const appointment = event.appointmentData as CalendarAppointment
    setAction({ row: appointment.row, kind: 'remove' })
  }

  const onAppointmentDblClick = (event: AppointmentDblClickEvent) => {
    event.cancel = true
    event.component.showAppointmentPopup(
      event.appointmentData,
      false,
      event.targetedAppointmentData,
    )
  }

  const onCellClick = (event: CellClickEvent) => {
    const date = event.cellData.startDate as Date
    const day = dateToDay(date)
    if (closed.has(day)) {
      event.cancel = true
      toast(tr.sessions.form.errors.closedDay)
      return
    }
    const pointerEvent = event.event
    const timestamp = pointerEvent?.timeStamp ?? Date.now()
    const cellKey = `${dateToWallClock(event.cellData.startDate as Date)}:${
      event.cellData.groups?.teacherId ?? ''
    }`
    const previousClick = lastCellClick.current
    const isDoubleClick =
      pointerEvent !== undefined &&
      'detail' in pointerEvent &&
      pointerEvent.detail >= 2
        ? true
        : previousClick !== null &&
          previousClick.key === cellKey &&
          timestamp - previousClick.timestamp >= 0 &&
          timestamp - previousClick.timestamp <= 700
    lastCellClick.current = { key: cellKey, timestamp }
    if (isDoubleClick) {
      event.cancel = true
      lastCellClick.current = null
      event.component.showAppointmentPopup(
        {
          startDate: event.cellData.startDate,
          endDate: event.cellData.endDate,
          teacherId: event.cellData.groups?.teacherId ?? null,
        },
        true,
      )
    }
  }

  const title =
    anchor === null || span === null ? '' : rangeTitle(view, anchor, span)

  return (
    <>
      <PageHeader
        title={tr.pages.calendar.title}
        subtitle={title}
        action={
          <Button variant="primary" onClick={openNativeNew}>
            {tr.calendar.newSession}
          </Button>
        }
      />
      <PageContent fill>
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
          settings !== null &&
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
              settings={settings}
              onClearFilters={clearFilters}
              onCreate={openNew}
              onAppointmentUpdating={onAppointmentUpdating}
              onAppointmentAdding={onAppointmentAdding}
              onAppointmentDeleting={onAppointmentDeleting}
              onAppointmentDblClick={onAppointmentDblClick}
              onAppointmentFormOpening={onAppointmentFormOpening}
              onCellClick={onCellClick}
              onViewDateChange={(date) => setAnchor(dateToDay(date))}
              onViewChange={setView}
              onSchedulerReady={(component) => {
                scheduler.current = component
              }}
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
      <PaymentModal
        open={paymentStudentId !== undefined}
        initialStudentId={paymentStudentId ?? null}
        onClose={() => setPaymentStudentId(undefined)}
      />
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
          }}
          onConfirm={(scope) => void applyMove(move, scope)}
          onEditGroup={(groupId) => {
            setMove(null)
            navigate(`/gruplar/${groupId}`)
          }}
        />
      )}
      <ConfirmDialog
        open={conflict !== null}
        title={tr.calendar.conflictDialog.title}
        description={tr.calendar.conflictDialog.body}
        confirmLabel={tr.calendar.conflictDialog.confirm}
        onCancel={() => {
          setConflict(null)
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
  settings: CalendarSettings
  onClearFilters: () => void
  onCreate: (day?: string, startTime?: string) => void
  onAppointmentUpdating: (event: AppointmentUpdatingEvent) => void
  onAppointmentAdding: (event: AppointmentAddingEvent) => void
  onAppointmentDeleting: (event: AppointmentDeletingEvent) => void
  onAppointmentDblClick: (event: AppointmentDblClickEvent) => void
  onAppointmentFormOpening: (event: AppointmentFormOpeningEvent) => void
  onCellClick: (event: CellClickEvent) => void
  onViewDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
  onSchedulerReady: (component: AppointmentAddingEvent['component'] | null) => void
}

const CalendarBody = memo(CalendarBodyView)

function CalendarBodyView(props: CalendarBodyProps) {
  const currentDate = useMemo(
    () => wallClockToDate(`${props.anchor} 12:00`),
    [props.anchor],
  )
  const dayHours = useStableDayHours(
    props.view,
    props.anchor,
    props.settings,
    props.unfiltered,
  )
  const autoScrollKey = useRef<string | null>(null)
  const schedulerFrame = useRef<HTMLDivElement | null>(null)
  const pendingScrollPosition = useRef<{ top: number; left: number } | null>(null)
  const store = useRef<ArrayStore<CalendarAppointment, number> | null>(null)
  const storedAppointments = useRef(props.appointments)
  if (store.current === null) {
    store.current = new ArrayStore({
      key: 'id',
      data: [...props.appointments],
    })
  }
  useEffect(() => {
    const previous = new Map(storedAppointments.current.map((item) => [item.id, item]))
    const next = new Map(props.appointments.map((item) => [item.id, item]))
    const changes: Array<
      | { type: 'insert'; data: CalendarAppointment }
      | { type: 'update'; key: number; data: CalendarAppointment }
      | { type: 'remove'; key: number }
    > = []
    for (const [id, item] of next) {
      const oldItem = previous.get(id)
      if (oldItem === undefined) changes.push({ type: 'insert', data: item })
      else if (!sameAppointment(oldItem, item)) {
        changes.push({ type: 'update', key: id, data: item })
      }
    }
    for (const id of previous.keys()) {
      if (!next.has(id)) changes.push({ type: 'remove', key: id })
    }
    if (changes.length > 0) {
      const scrollable = dateTableScrollable(schedulerFrame.current)
      const scrollPosition =
        scrollable === undefined || scrollable === null
          ? null
          : { top: scrollable.scrollTop, left: scrollable.scrollLeft }
      if (pendingScrollPosition.current === null) {
        pendingScrollPosition.current = scrollPosition
      }
      store.current?.push(changes)
      if (schedulerFrame.current !== null && pendingScrollPosition.current !== null) {
        restoreScrollPosition(schedulerFrame.current, pendingScrollPosition.current)
      }
      pendingScrollPosition.current = null
    }
    storedAppointments.current = props.appointments
  }, [props.appointments])
  const onContentReady = useStableEvent((event: ContentReadyEvent) => {
    if (
      pendingScrollPosition.current !== null &&
      schedulerFrame.current !== null
    ) {
      restoreScrollPosition(
        schedulerFrame.current,
        pendingScrollPosition.current,
      )
      return
    }
    if (props.view === 'month' || props.view === 'agenda') return
    const key = `${props.view}:${props.anchor}`
    if (autoScrollKey.current === key) return
    autoScrollKey.current = key
    event.component.scrollTo(
      scrollTarget(
        props.now,
        props.span,
        props.appointments,
        props.anchor,
        props.settings.dayStart,
      ),
        { alignInView: 'center' },
      )
  })
  const onCurrentViewChange = useStableEvent((value: string) => {
    if (isCalendarView(value)) props.onViewChange(value)
  })
  const onCurrentDateChange = useStableEvent((value: Date | number | string) => {
    if (value instanceof Date) props.onViewDateChange(value)
  })
  const onInitialized = useStableEvent(
    (event: { component?: AppointmentAddingEvent['component'] }) =>
      props.onSchedulerReady(event.component ?? null),
  )
  const onDisposing = useStableEvent(() => props.onSchedulerReady(null))
  const onAppointmentUpdating = useStableEvent((event: AppointmentUpdatingEvent) => {
    const scrollable = dateTableScrollable(schedulerFrame.current)
    pendingScrollPosition.current =
      scrollable === null
        ? null
        : { top: scrollable.scrollTop, left: scrollable.scrollLeft }
    props.onAppointmentUpdating(event)
    if (schedulerFrame.current !== null && pendingScrollPosition.current !== null) {
      restoreScrollPosition(schedulerFrame.current, pendingScrollPosition.current)
    }
  })
  const onAppointmentAdding = useStableEvent(props.onAppointmentAdding)
  const onAppointmentDeleting = useStableEvent(props.onAppointmentDeleting)
  const onAppointmentDblClick = useStableEvent(props.onAppointmentDblClick)
  const onAppointmentFormOpening = useStableEvent(
    props.onAppointmentFormOpening,
  )
  const onCellClick = useStableEvent(props.onCellClick)
  const appointmentDragging = useMemo(
    () => ({
      autoScroll: true,
      scrollSensitivity: 80,
      scrollSpeed: 30,
      onDragStart: (event: {
        itemData?: unknown
        cancel?: boolean
      }) => {
        const item = event.itemData as CalendarAppointment
        if (item.locked) event.cancel = true
      },
    }),
    [],
  )
  const dateCellRender = useCallback(
    (data: { date?: Date }) => <DateCell date={data.date as Date} />,
    [],
  )
  const timeCellRender = useCallback(
    (data: { date?: Date }) => (
      <span className={styles.timeCell}>{dateToTime(data.date as Date)}</span>
    ),
    [],
  )
  const dataCellRender = useStableEvent(
    (data: { startDate?: Date }) => (
      <span
        className={styles.dataCell}
        data-closed={props.closed.has(dateToDay(data.startDate as Date))}
        aria-label={
          props.closed.has(dateToDay(data.startDate as Date))
            ? tr.calendar.empty.dayClosed
            : undefined
        }
      />
    ),
  )
  const resourceCellRender = useCallback(
    (data: { text?: unknown }) => (
      <span className={styles.resourceName}>{String(data.text ?? '')}</span>
    ),
    [],
  )

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
  return (
    <div
      ref={schedulerFrame}
      className={styles.schedulerFrame}
      data-testid="devextreme-scheduler"
    >
      <Scheduler
        dataSource={store.current}
        textExpr="text"
        startDateExpr="startDate"
        endDateExpr="endDate"
        currentDate={currentDate}
        currentView={props.view}
        onCurrentViewChange={onCurrentViewChange}
        onInitialized={onInitialized}
        onDisposing={onDisposing}
        onCurrentDateChange={onCurrentDateChange}
        firstDayOfWeek={1}
        cellDuration={props.settings.slotMinutes}
        startDayHour={dayHours.start}
        endDayHour={dayHours.end}
        showAllDayPanel={false}
        showCurrentTimeIndicator
        shadeUntilCurrentTime={false}
        timeZone="Europe/Istanbul"
        noDataText={tr.calendar.noData}
        height="100%"
        focusStateEnabled
        toolbar={SCHEDULER_TOOLBAR}
        editing={SCHEDULER_EDITING}
        appointmentDragging={appointmentDragging}
        appointmentComponent={AppointmentContent}
        dateCellRender={dateCellRender}
        timeCellRender={timeCellRender}
        dataCellRender={dataCellRender}
        resourceCellRender={resourceCellRender}
        onAppointmentFormOpening={onAppointmentFormOpening}
        onAppointmentAdding={onAppointmentAdding}
        onAppointmentDeleting={onAppointmentDeleting}
        onAppointmentDblClick={onAppointmentDblClick}
        onAppointmentUpdating={onAppointmentUpdating}
        onCellClick={onCellClick}
        onContentReady={onContentReady}
      >
        <View
          type="week"
          cellDuration={props.settings.slotMinutes}
          startDayHour={dayHours.start}
          endDayHour={dayHours.end}
        />
        <View
          type="workWeek"
          cellDuration={props.settings.slotMinutes}
          startDayHour={dayHours.start}
          endDayHour={dayHours.end}
        />
        <View
          type="day"
          cellDuration={props.settings.slotMinutes}
          startDayHour={dayHours.start}
          endDayHour={dayHours.end}
          groups={props.resources.length > 0 ? TEACHER_GROUP : NO_GROUPS}
          groupOrientation="horizontal"
        />
        <View type="month" />
        <View type="agenda" agendaDuration={14} />
        <Resource
          fieldExpr="teacherId"
          valueExpr="id"
          displayExpr="text"
          label={tr.calendar.teachers}
          dataSource={props.resources}
        />
      </Scheduler>
    </div>
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

function scrollTarget(
  now: string,
  span: readonly [string, string],
  appointments: readonly CalendarAppointment[],
  anchor: string,
  dayStart: string,
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
  return first ?? wallClockToDate(`${anchor} ${dayStart}`)
}

function isCalendarView(value: string): value is CalendarView {
  return ['month', 'week', 'workWeek', 'day', 'agenda'].includes(value)
}

function readCalendarPreference(): CalendarPreference | null {
  try {
    const raw = window.localStorage.getItem(CALENDAR_PREFERENCE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<CalendarPreference>
    if (
      typeof parsed.view !== 'string' ||
      !isCalendarView(parsed.view) ||
      typeof parsed.anchor !== 'string'
    ) {
      return null
    }
    wallClockToDate(`${parsed.anchor} 12:00`)
    return { view: parsed.view, anchor: parsed.anchor }
  } catch {
    return null
  }
}

function writeCalendarPreference(preference: CalendarPreference): void {
  try {
    window.localStorage.setItem(
      CALENDAR_PREFERENCE_KEY,
      JSON.stringify(preference),
    )
  } catch {
    // Tercih yazılamazsa takvim çalışmaya devam eder; sonraki açılış Gün görünümüdür.
  }
}

function replaceMovedRow(
  rows: readonly DaySessionRow[],
  sessionId: number,
  day: string,
  startTime: string,
  durationMin: number,
  rescheduledOnce?: boolean,
): DaySessionRow[] {
  const startsAt = `${day} ${startTime}`
  const start = wallClockToDate(startsAt)
  const end = new Date(start.getTime() + durationMin * 60_000)
  return rows.map((row) =>
    row.id === sessionId
      ? {
          ...row,
          startsAt,
          endsAt: dateToWallClock(end),
          rescheduledOnce:
            rescheduledOnce ??
            (row.rescheduledOnce === true || row.startsAt !== startsAt),
        }
      : row,
  )
}

function sameAppointment(
  previous: CalendarAppointment,
  next: CalendarAppointment,
): boolean {
  return (
    previous.startDate.getTime() === next.startDate.getTime() &&
    previous.endDate.getTime() === next.endDate.getTime() &&
    previous.seriesId === next.seriesId &&
    previous.text === next.text &&
    previous.subjectId === next.subjectId &&
    previous.subjectName === next.subjectName &&
    previous.teacherId === next.teacherId &&
    previous.teacherName === next.teacherName &&
    previous.subjectColor === next.subjectColor &&
    previous.title === next.title &&
    previous.kind === next.kind &&
    previous.isMakeup === next.isMakeup &&
    previous.status === next.status &&
    previous.attendanceTaken === next.attendanceTaken &&
    previous.attendanceMissing === next.attendanceMissing &&
    previous.locked === next.locked &&
    previous.conflict === next.conflict
  )
}

function restoreScrollPosition(
  frame: HTMLElement,
  position: { top: number; left: number },
): void {
  const restore = () => {
    const element = dateTableScrollable(frame)
    if (element === null) return
    element.scrollTop = position.top
    element.scrollLeft = position.left
  }
  restore()
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      restore()
      requestAnimationFrame(restore)
    })
  }
}

function dateTableScrollable(frame: HTMLElement | null): HTMLElement | null {
  return (
    frame?.querySelector<HTMLElement>(
      '.dx-scheduler-date-table-scrollable .dx-scrollable-container',
    ) ?? null
  )
}

function useStableDayHours(
  view: CalendarView,
  anchor: string,
  settings: CalendarSettings,
  rows: readonly DaySessionRow[],
): { start: number; end: number } {
  const key = `${view}:${anchor}`
  const calculated = visibleDayHours(
    settings,
    rows.map((row) => ({
      startDate: wallClockToDate(row.startsAt),
      endDate: wallClockToDate(row.endsAt),
    })),
  )
  const state = useRef({ key, hours: calculated })
  if (state.current.key !== key) {
    state.current = { key, hours: calculated }
  } else {
    state.current.hours = {
      start: Math.min(state.current.hours.start, calculated.start),
      end: Math.max(state.current.hours.end, calculated.end),
    }
  }
  return state.current.hours
}

function useStableEvent<T extends (...args: never[]) => unknown>(handler: T): T {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  return useCallback(
    ((...args: Parameters<T>) => handlerRef.current(...args)) as T,
    [],
  )
}
