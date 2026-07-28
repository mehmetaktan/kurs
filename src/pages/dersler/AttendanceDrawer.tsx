import { useEffect, useMemo, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  cancelSession,
  fetchAttendanceDetail,
  saveAttendance,
  undoAttendance,
  type AppError,
  type AttendanceDetail,
  type DaySessionRow,
  type MarkedAttendanceStatus,
} from '../../lib/api'
import { formatDate, formatTime } from '../../lib/format'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  SegmentedControl,
  Textarea,
  useToast,
} from '../../ui'
import {
  attendanceDrafts,
  attendanceDraftsEqual,
  attendanceEffectSummary,
  attendanceEffectText,
  type AttendanceDraft,
} from './attendance'
import { SessionForm, type MakeupSource } from './SessionForm'
import styles from './AttendanceDrawer.module.css'

const STATUS_OPTIONS = [
  { value: 'present', label: tr.attendance.status.present },
  { value: 'excused', label: tr.attendance.status.excused },
  { value: 'unexcused', label: tr.attendance.status.unexcused },
  { value: 'cancelled', label: tr.attendance.status.cancelled },
] as const

interface Props {
  row: DaySessionRow | null
  now: string
  onClose: () => void
  onSaved: () => void
}

/** E9 — ders bitiminde üç tıkla kapanan yoklama çekmecesi. */
export function AttendanceDrawer({ row, now, onClose, onSaved }: Props) {
  const [detail, setDetail] = useState<AttendanceDetail | null>(null)
  const [drafts, setDrafts] = useState<Record<number, AttendanceDraft>>({})
  const [initialDrafts, setInitialDrafts] = useState<Record<number, AttendanceDraft>>({})
  const [error, setError] = useState<AppError | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [cancelMakeupId, setCancelMakeupId] = useState<number | null>(null)
  const [makeup, setMakeup] = useState<MakeupSource | null>(null)
  const requestRef = useRef(0)
  const toast = useToast()

  const load = async (session: DaySessionRow) => {
    const request = ++requestRef.current
    setDetail(null)
    setDrafts({})
    setInitialDrafts({})
    setError(null)
    setConfirmDiscard(false)
    setMakeup(null)
    try {
      const next = await fetchAttendanceDetail(session.id, now.slice(0, 10))
      if (request !== requestRef.current) return
      setDetail(next)
      const nextDrafts = attendanceDrafts(next.rows)
      setDrafts(nextDrafts)
      setInitialDrafts(nextDrafts)
    } catch (err) {
      if (request !== requestRef.current) return
      setError(err as AppError)
    }
  }

  useEffect(() => {
    if (row !== null) {
      void load(row)
    } else {
      requestRef.current += 1
    }
    // `load` yalnızca açılan ders değiştiğinde çalışmalı; her taslak değişiminde değil.
  }, [row?.id, now])

  const sortedRows = useMemo(
    () => sortTrBy(detail?.rows ?? [], (item) => item.fullName),
    [detail],
  )
  const effect = useMemo(
    () =>
      detail === null
        ? {
            lessonCreditsToConsume: 0,
            lessonCreditsToRestore: 0,
            debtToAddKurus: 0,
            debtToRemoveKurus: 0,
            complete: false,
          }
        : attendanceEffectSummary(detail.rows, drafts),
    [detail, drafts],
  )
  const dirty = useMemo(
    () =>
      detail !== null && !attendanceDraftsEqual(detail.rows, drafts, initialDrafts),
    [detail, drafts, initialDrafts],
  )

  const attemptClose = () => {
    if (busy) return
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  const updateDraft = (studentId: number, patch: Partial<AttendanceDraft>) => {
    if (busy) return
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { status: null, note: '' }), ...patch },
    }))
  }

  const openMakeup = (item: AttendanceDetail['rows'][number]) => {
    // Disabled düğmeye sentetik olay gönderilse bile kirli taslak telafi modalıyla
    // örtülmez. Önce yoklama kaydedilir; telafi kaynağının DB'deki durumu kesinleşir.
    if (
      busy ||
      dirty ||
      row === null ||
      item.status !== 'excused' ||
      item.attendanceId === null ||
      item.makeupSessionId != null
    ) {
      return
    }
    setMakeup({
      attendanceId: item.attendanceId,
      studentId: item.studentId,
      studentName: item.fullName,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      teacherId: row.teacherId,
    })
  }

  const markAllPresent = () => {
    if (detail === null || busy) return
    setDrafts((current) =>
      Object.fromEntries(
        detail.rows.map((item) => [
          item.studentId,
          { status: 'present', note: current[item.studentId]?.note ?? '' },
        ]),
      ),
    )
  }

  const submit = async () => {
    if (detail === null || !effect.complete) return
    setBusy(true)
    setError(null)
    try {
      await saveAttendance({
        sessionId: detail.sessionId,
        markedAt: now,
        marks: detail.rows.map((item) => {
          const draft = drafts[item.studentId] ?? { status: null, note: '' }
          return {
            studentId: item.studentId,
            status: draft.status as MarkedAttendanceStatus,
            note: draft.note.trim() || null,
          }
        }),
      })
      window.dispatchEvent(new Event('kurs:debts-changed'))
      setInitialDrafts(drafts)
      toast(tr.attendance.saved)
      if (row !== null) await load(row)
      onSaved()
    } catch (err) {
      setError(err as AppError)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (row === null) return
    setBusy(true)
    setError(null)
    try {
      await undoAttendance(row.id, now.slice(0, 10))
      window.dispatchEvent(new Event('kurs:debts-changed'))
      toast(tr.attendance.undone)
      setConfirmUndo(false)
      onClose()
      onSaved()
    } catch (err) {
      setError(err as AppError)
      setConfirmUndo(false)
    } finally {
      setBusy(false)
    }
  }

  const cancelMakeup = async () => {
    if (cancelMakeupId === null) return
    setBusy(true)
    setError(null)
    try {
      await cancelSession(cancelMakeupId, tr.makeup.cancelPlan)
      toast(tr.makeup.cancelled)
      setCancelMakeupId(null)
      if (row !== null) await load(row)
      onSaved()
    } catch (err) {
      setError(err as AppError)
      setCancelMakeupId(null)
    } finally {
      setBusy(false)
    }
  }

  const title =
    row === null
      ? tr.attendance.title
      : `${row.subjectName}${tr.units.separator}${row.title}`

  return (
    <>
    <Drawer
      open={row !== null}
      title={title}
      onClose={attemptClose}
      footer={
        detail !== null && detail.rows.length > 0 ? (
          <div className={styles.footer}>
            <p className={styles.effect} aria-live="polite">
              {attendanceEffectText(effect)}
            </p>
              <Button
              variant="primary"
              block
              disabled={!effect.complete || busy}
              onClick={() => void submit()}
            >
              {busy ? tr.actions.saving : tr.actions.save}
            </Button>
          </div>
        ) : undefined
      }
    >
      {detail === null && error === null && <LoadingState />}
      {error !== null && detail === null && (
        <ErrorState
          message={error.message}
          details={error.details}
          onRetry={() => row !== null && void load(row)}
        />
      )}
      {detail !== null && (
        <div className={styles.content}>
          <p className={styles.meta}>
            {formatDate(detail.startsAt.slice(0, 10))}
            {tr.units.separator}
            {formatTime(detail.startsAt)}–{formatTime(detail.endsAt)}
          </p>
          {error !== null && (
            <p className={styles.error} role="alert">
              {error.message}
            </p>
          )}
          {detail.rows.length === 0 ? (
            <EmptyState title={tr.attendance.empty} body={tr.attendance.emptyBody} />
          ) : (
            <>
              <Button variant="primary" block disabled={busy} onClick={markAllPresent}>
                {tr.attendance.allPresent}
              </Button>
              {row?.attendanceTaken && row.presentCount === 0 && (
                <Button
                  block
                  disabled={busy || dirty}
                  onClick={() => setConfirmUndo(true)}
                >
                  {tr.attendance.undo}
                </Button>
              )}
              <div className={styles.list}>
                {sortedRows.map((item) => {
                  const draft = drafts[item.studentId] ?? { status: null, note: '' }
                  return (
                    <section className={styles.student} key={item.studentId}>
                      <h3 className={styles.name}>{item.fullName}</h3>
                      <div className={styles.statusControl}>
                        <SegmentedControl<MarkedAttendanceStatus | ''>
                          label={`${item.fullName}${tr.units.separator}${tr.attendance.statusLabel}`}
                          options={STATUS_OPTIONS.map((option) => ({
                            ...option,
                            disabled: busy,
                          }))}
                          value={draft.status ?? ''}
                          onChange={(status) =>
                            updateDraft(item.studentId, {
                              status: status as MarkedAttendanceStatus,
                            })
                          }
                        />
                      </div>
                      <Textarea
                        label={tr.attendance.note}
                        placeholder={tr.attendance.notePlaceholder}
                        maxLength={160}
                        disabled={busy}
                        rows={2}
                        value={draft.note}
                        onChange={(event) =>
                          updateDraft(item.studentId, { note: event.target.value })
                        }
                      />
                      {item.status === 'excused' && item.attendanceId !== null && (
                        item.makeupSessionId == null ? (
                          <>
                            <Button
                              size="small"
                              disabled={busy || dirty}
                              onClick={() => openMakeup(item)}
                            >
                              {tr.makeup.plan}
                            </Button>
                            {dirty && (
                              <span className={styles.makeupHint}>
                                {tr.makeup.saveAttendanceFirst}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={styles.makeupPlanned}>{tr.makeup.planned}</span>
                            <Button
                              size="small"
                              disabled={busy || dirty}
                              onClick={() => setCancelMakeupId(item.makeupSessionId ?? null)}
                            >
                              {tr.makeup.cancelPlan}
                            </Button>
                          </>
                        )
                      )}
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
      <ConfirmDialog
        open={confirmDiscard}
        title={tr.attendance.discardTitle}
        description={tr.attendance.discardBody}
        confirmLabel={tr.attendance.discardConfirm}
        confirmHint={tr.attendance.discardHint}
        cancelLabel={tr.attendance.keepEditing}
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          setDrafts(initialDrafts)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ConfirmDialog
        open={confirmUndo}
        title={tr.attendance.undoTitle}
        description={tr.attendance.undoBody}
        confirmLabel={tr.attendance.undoConfirm}
        confirmHint={tr.attendance.undoHint}
        cancelLabel={tr.actions.cancel}
        destructive
        onConfirm={() => void undo()}
        onCancel={() => setConfirmUndo(false)}
      />
      <ConfirmDialog
        open={cancelMakeupId !== null}
        title={tr.makeup.cancelTitle}
        description={tr.makeup.cancelBody}
        confirmLabel={tr.makeup.cancelPlan}
        confirmHint={tr.makeup.cancelHint}
        cancelLabel={tr.actions.cancel}
        destructive
        onConfirm={() => void cancelMakeup()}
        onCancel={() => setCancelMakeupId(null)}
      />
      <SessionForm
        open={makeup !== null}
        today={now.slice(0, 10)}
        makeup={makeup}
        onClose={() => setMakeup(null)}
        onSaved={() => {
          setMakeup(null)
          if (!dirty && row !== null) void load(row)
          onSaved()
        }}
      />
    </>
  )
}
