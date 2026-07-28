import type { AppointmentFormOpeningEvent } from 'devextreme/ui/scheduler'
import { tr } from '../../i18n/tr'
import type {
  GroupRow,
  SessionInput,
  StudentRow,
  Subject,
  Teacher,
} from '../../lib/api'
import type { CalendarAppointment } from './appointments'
import {
  dateToDay,
  dateToTime,
  durationMinutes,
  wallClockToDate,
} from './calendarDateAdapter'
import type { CalendarSettings } from './calendarSettings'

export interface CalendarCatalogs {
  subjects: readonly Subject[]
  groups: readonly GroupRow[]
  students: readonly StudentRow[]
  teachers: readonly Teacher[]
}

export interface NativeAppointmentDraft {
  id?: number
  startDate: Date
  endDate: Date
  kind: 'group' | 'solo'
  subjectId: number | null
  teacherId: number | null
  studyGroupId: number | null
  studentId: number | null
  source?: CalendarAppointment
}

export interface NativeFormActions {
  onAttendance: (row: CalendarAppointment['row']) => void
  onPayment: (studentId: number | null) => void
  onReschedule: (row: CalendarAppointment['row']) => void
  onCancel: (row: CalendarAppointment['row']) => void
  onArchive: (row: CalendarAppointment['row']) => void
}

/**
 * DevExtreme'in kendi appointment popup/formunu kursun alanlarıyla doldurur.
 * Popup, tarih seçiciler, klavye ve kaydet/iptal davranışı DevExtreme'e aittir;
 * yalnız form alanları ürünün veri sözleşmesine uyarlanır.
 */
export function configureNativeAppointmentForm(
  event: AppointmentFormOpeningEvent,
  catalogs: CalendarCatalogs,
  settings: CalendarSettings,
  now: string,
  actions: NativeFormActions,
): void {
  const appointment = event.appointmentData as
    | (Partial<CalendarAppointment> & Partial<NativeAppointmentDraft>)
    | undefined
  const existing = appointment?.row
  const startDate =
    appointment?.startDate instanceof Date
      ? appointment.startDate
      : wallClockToDate(now)
  const endDate =
    appointment?.endDate instanceof Date
      ? appointment.endDate
      : new Date(startDate.getTime() + settings.defaultSessionMinutes * 60_000)
  const draft: NativeAppointmentDraft = {
    id: existing?.id,
    startDate,
    endDate,
    // Grup tekrarının sahibi GroupForm'dur; takvimdeki yeni tek ders için en doğal
    // varsayılan birebirdir. Hücre/popup açıkça grup hedefi taşıyorsa onu koruruz.
    kind:
      existing !== undefined
        ? existing.kind === 'solo'
          ? 'solo'
          : 'group'
        : appointment?.kind === 'group' || appointment?.studyGroupId != null
          ? 'group'
          : 'solo',
    subjectId: existing?.subjectId ?? appointment?.subjectId ?? null,
    teacherId: existing?.teacherId ?? appointment?.teacherId ?? null,
    studyGroupId: existing?.studyGroupId ?? appointment?.studyGroupId ?? null,
    studentId: existing?.studentId ?? appointment?.studentId ?? null,
    source: appointment as CalendarAppointment | undefined,
  }
  const editing = existing !== undefined
  const groupFieldsLocked =
    draft.kind === 'group' && draft.studyGroupId !== null

  event.form.option('formData', draft)
  event.form.option('labelLocation', 'top')
  event.form.option('items', [
    {
      dataField: 'kind',
      label: { text: tr.sessions.form.kind },
      editorType: 'dxSelectBox',
      editorOptions: {
        items: [
          { id: 'group', text: tr.sessions.form.kindGroup },
          { id: 'solo', text: tr.sessions.form.kindSolo },
        ],
        valueExpr: 'id',
        displayExpr: 'text',
        disabled: editing,
        onValueChanged: ({ value }: { value: 'group' | 'solo' }) => {
          event.form.itemOption('studyGroupId', 'visible', value === 'group')
          event.form.itemOption('studentId', 'visible', value === 'solo')
          if (value === 'group') {
            event.form.updateData('studentId', null)
            const formData = event.form.option(
              'formData',
            ) as NativeAppointmentDraft | undefined
            setEditorDisabled(
              event,
              'subjectId',
              formData?.studyGroupId != null,
            )
            setEditorDisabled(
              event,
              'teacherId',
              formData?.studyGroupId != null,
            )
          } else {
            event.form.updateData('studyGroupId', null)
            setEditorDisabled(event, 'subjectId', false)
            setEditorDisabled(event, 'teacherId', false)
          }
        },
      },
    },
    {
      name: 'studyGroupId',
      dataField: 'studyGroupId',
      visible: draft.kind === 'group',
      label: { text: tr.sessions.form.group },
      editorType: 'dxSelectBox',
      editorOptions: {
        dataSource: [...catalogs.groups],
        valueExpr: 'id',
        displayExpr: 'name',
        searchEnabled: true,
        disabled: editing,
        onValueChanged: ({ value }: { value: number | null }) => {
          const group = catalogs.groups.find((item) => item.id === value)
          if (group) {
            event.form.updateData('subjectId', group.subjectId)
            event.form.updateData('teacherId', group.teacherId)
          }
          if (!editing) {
            setEditorDisabled(event, 'subjectId', group !== undefined)
            setEditorDisabled(event, 'teacherId', group !== undefined)
          }
        },
      },
    },
    {
      name: 'studentId',
      dataField: 'studentId',
      visible: draft.kind === 'solo',
      label: { text: tr.sessions.form.student },
      editorType: 'dxSelectBox',
      editorOptions: {
        dataSource: [...catalogs.students],
        valueExpr: 'id',
        displayExpr: 'fullName',
        searchEnabled: true,
        disabled: editing,
      },
    },
    {
      dataField: 'subjectId',
      label: { text: tr.sessions.form.subject },
      editorType: 'dxSelectBox',
      editorOptions: {
        dataSource: [...catalogs.subjects],
        valueExpr: 'id',
        displayExpr: 'name',
        searchEnabled: true,
        disabled: groupFieldsLocked,
        onValueChanged: ({ value }: { value: number | null }) => {
          const subject = catalogs.subjects.find((item) => item.id === value)
          const formData = event.form.option('formData') as NativeAppointmentDraft
          if (
            !editing &&
            subject !== undefined &&
            formData.startDate instanceof Date
          ) {
            const minutes = subject.defaultMin ?? settings.defaultSessionMinutes
            event.form.updateData(
              'endDate',
              new Date(formData.startDate.getTime() + minutes * 60_000),
            )
          }
        },
      },
    },
    {
      dataField: 'teacherId',
      label: { text: tr.sessions.form.teacher },
      editorType: 'dxSelectBox',
      editorOptions: {
        dataSource: [...catalogs.teachers],
        valueExpr: 'id',
        displayExpr: 'fullName',
        searchEnabled: true,
        showClearButton: true,
        disabled: groupFieldsLocked,
      },
    },
    {
      dataField: 'startDate',
      label: { text: tr.sessions.form.date },
      editorType: 'dxDateBox',
      editorOptions: {
        type: 'datetime',
        interval: settings.slotMinutes,
        disabled: existing?.rescheduledOnce === true,
      },
    },
    {
      dataField: 'endDate',
      label: { text: tr.calendar.nativeForm.end },
      editorType: 'dxDateBox',
      editorOptions: {
        type: 'datetime',
        interval: settings.slotMinutes,
      },
    },
    ...(existing === undefined
      ? []
      : [
          {
            itemType: 'group' as const,
            colCount: 2,
            items: [
              actionButton(tr.calendar.details.attendanceTake, () =>
                actions.onAttendance(existing),
              ),
              actionButton(tr.payments.takePayment, () =>
                actions.onPayment(existing.studentId),
              ),
              ...(existing.rescheduledOnce === true
                ? []
                : [
                    actionButton(tr.calendar.details.reschedule, () =>
                      actions.onReschedule(existing),
                    ),
                  ]),
              actionButton(tr.calendar.details.cancel, () =>
                actions.onCancel(existing),
              ),
              actionButton(tr.calendar.details.archive, () =>
                actions.onArchive(existing),
              ),
            ],
          },
        ]),
  ])
}

export function nativeDraftToSessionInput(
  draft: NativeAppointmentDraft,
): SessionInput | null {
  const durationMin = durationMinutes(draft.startDate, draft.endDate)
  const hasTarget =
    draft.kind === 'group'
      ? draft.studyGroupId !== null
      : draft.studentId !== null
  if (
    !hasTarget ||
    draft.subjectId === null ||
    durationMin <= 0
  ) {
    return null
  }
  return {
    id: draft.id ?? null,
    subjectId: draft.subjectId,
    teacherId: draft.teacherId,
    studyGroupId: draft.kind === 'group' ? draft.studyGroupId : null,
    studentId: draft.kind === 'solo' ? draft.studentId : null,
    day: dateToDay(draft.startDate),
    startTime: dateToTime(draft.startDate),
    durationMin,
  }
}

function actionButton(text: string, onClick: () => void) {
  return {
    itemType: 'button' as const,
    buttonOptions: {
      text,
      width: '100%',
      onClick,
    },
  }
}

function setEditorDisabled(
  event: AppointmentFormOpeningEvent,
  dataField: 'subjectId' | 'teacherId',
  disabled: boolean,
): void {
  // DevExtreme `itemOption('x', 'editorOptions.disabled', ...)` bazı sürümlerde
  // alanı yeniden kurup seçili değeri kaybedebiliyor. Açılmış formda doğrudan editor
  // instance'ını güncellemek hem değeri hem dataSource referansını korur.
  event.form.getEditor(dataField)?.option('disabled', disabled)
}
