import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchDefaultMinutes,
  fetchGroupList,
  fetchIsClosedDay,
  fetchSessionConflicts,
  fetchStudentList,
  fetchSubjects,
  fetchTeachers,
  saveSession,
  type AppError,
  type Conflict,
  type DaySessionRow,
  type GroupRow,
  type StudentRow,
  type Subject,
} from '../../lib/api'
import { formatTime } from '../../lib/format'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  Input,
  DatePicker,
  LoadingState,
  Modal,
  ModalOption,
  SegmentedControl,
  Select,
  TimePicker,
  useToast,
} from '../../ui'
import {
  emptySessionDraft,
  hasErrors,
  isFieldError,
  slotBounds,
  toSessionInput,
  validateSession,
  type FieldErrors,
  type SessionDraft,
  type SessionKind,
} from './validate'
import styles from './Sessions.module.css'

interface Props {
  open: boolean
  /** Rust'tan gelen bugün (`'YYYY-MM-DD'`) — yeni dersin varsayılan tarihi (§0). */
  today: string
  /** Dolu = düzenleme. Satır çağırandan gelir; ikinci bir komut açmaya gerek yok. */
  session?: DaySessionRow | null
  onClose: () => void
  onSaved: () => void
}

/**
 * EKRANLAR.md E3 — Ders ekle / düzenle (`Modal`, 384px).
 *
 * Üç kural burada görünür hâle geliyor ve **üçü de farklı davranıyor** (PRD §7):
 *
 * | Kural | Davranış | Nerede |
 * |---|---|---|
 * | K-2 tatil | **Engeller** | Tarih seçilir seçilmez sorulur; kaydet düğmesi kapanır |
 * | K-1 çakışma | **Uyarır** | Kaydetmeden önce dersin ADIYLA gösterilir + "Yine de ekle" |
 * | Geçmiş tarih | Sadece söyler | Uyarı satırı; kaydetmeyi engellemez |
 *
 * Süre `default_session_minutes`'tan geliyor (PRD S4) — **ikinci bir varsayılan
 * tanımlanmıyor.** Kullanıcı süreye dokunduktan sonra branş değişse bile yazdığı değer
 * korunuyor; aksi hâlde el yazısı sessizce geri alınırdı.
 */
export function SessionForm({ open, today, session, onClose, onSaved }: Props) {
  const editing = session != null

  const [draft, setDraft] = useState<SessionDraft>(() => emptySessionDraft(today))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<AppError | null>(null)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [teacherId, setTeacherId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closedDay, setClosedDay] = useState(false)
  /** Süreye elle dokunuldu mu — branş değişince üzerine yazılmasın. */
  const [durationTouched, setDurationTouched] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)

  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrors({})
    setConflicts(null)
    setDurationTouched(editing)
    try {
      const [nextSubjects, nextGroups, nextStudents, teachers] = await Promise.all([
        fetchSubjects(),
        fetchGroupList(),
        fetchStudentList(),
        fetchTeachers(),
      ])
      setSubjects(nextSubjects)
      // Arşivlenmiş grup/öğrenciye yeni ders açılmaz: program ekranları canlı kayıtla
      // ilgilenir (§1.23). Liste ikisini de getiriyor, süzme ekranın işi.
      setGroups(nextGroups.filter((row) => !row.archived))
      setStudents(nextStudents.filter((row) => !row.archived))
      // ADR-011: tek öğretmen. Alan gizli ama YAZILIYOR — yazılmazsa `teacher_id`
      // NULL kalır ve ikinci öğretmen eklendiği gün K-1 uyarısı ölü doğar.
      setTeacherId(teachers[0]?.id ?? null)

      if (session) {
        setDraft({
          id: session.id,
          kind: session.studyGroupId === null ? 'solo' : 'group',
          subjectId: String(session.subjectId),
          studyGroupId: session.studyGroupId === null ? '' : String(session.studyGroupId),
          studentId: session.studentId === null ? '' : String(session.studentId),
          day: session.startsAt.slice(0, 10),
          startTime: session.startsAt.slice(11, 16),
          durationMin: String(minutesBetween(session.startsAt, session.endsAt)),
          repeat: 'once',
        })
      } else {
        const only = nextSubjects.length === 1 ? String(nextSubjects[0]!.id) : ''
        setDraft({ ...emptySessionDraft(today), subjectId: only })
      }
    } catch (err) {
      setError(err as AppError)
    } finally {
      setLoading(false)
    }
  }, [editing, session, today])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  // K-2 — tatil ENGELLER. Kaydetme anında değil tarih seçilir seçilmez soruluyor:
  // kullanıcı formu doldurup en sonda reddedilmesin.
  useEffect(() => {
    if (!open || draft.day === null) {
      setClosedDay(false)
      return
    }
    let cancelled = false
    void fetchIsClosedDay(draft.day)
      .then((value) => {
        if (!cancelled) setClosedDay(value)
      })
      .catch(() => {
        // Okunamazsa engellemiyoruz; son söz zaten Rust'ta (`save_session`).
        if (!cancelled) setClosedDay(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, draft.day])

  // Süre branşın varsayılanından (PRD S4). Elle yazılmışsa dokunulmuyor.
  useEffect(() => {
    if (!open || durationTouched || draft.subjectId === '') return
    let cancelled = false
    void fetchDefaultMinutes(Number(draft.subjectId))
      .then((minutes) => {
        if (!cancelled) setDraft((prev) => ({ ...prev, durationMin: String(minutes) }))
      })
      .catch(() => {
        /* ayar okunamazsa alan boş kalır, doğrulama söyler */
      })
    return () => {
      cancelled = true
    }
  }, [open, durationTouched, draft.subjectId])

  const subjectOptions = useMemo(
    () =>
      sortTrBy(subjects, (item) => item.name).map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [subjects],
  )

  const targetOptions = useMemo(() => {
    if (draft.kind === 'group') {
      return sortTrBy(groups, (item) => item.name).map((item) => ({
        value: String(item.id),
        label: item.name,
      }))
    }
    return sortTrBy(students, (item) => item.fullName).map((item) => ({
      value: String(item.id),
      label: item.fullName,
    }))
  }, [draft.kind, groups, students])

  const patch = (next: Partial<SessionDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }))
    setConflicts(null)
  }

  /** Grup seçilince branş grubun branşına gelir — iki cevap çelişemesin. */
  const pickGroup = (value: string) => {
    const group = groups.find((row) => String(row.id) === value)
    patch({
      studyGroupId: value,
      subjectId: group ? String(group.subjectId) : draft.subjectId,
    })
    if (group) setDurationTouched(false)
  }

  const persist = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const report = await saveSession(toSessionInput(draft, teacherId))
      toast(savedMessage(report.created, draft.repeat, editing))
      onSaved()
    } catch (err) {
      const appError = err as AppError
      if (isFieldError(appError.code)) {
        setErrors({ [appError.code]: appError.message })
      } else {
        setError(appError)
      }
    } finally {
      setSaving(false)
    }
  }, [draft, editing, onSaved, teacherId, toast])

  const submit = async () => {
    const found = validateSession(draft)
    setErrors(found)
    if (hasErrors(found) || closedDay) return

    // K-1 / R3.11 — çakışma ENGELLEMEZ, kaydetmeden önce onay ister. Uyarı dersin
    // ADINI söylüyor; "çakışma var" tek başına kullanıcıya hiçbir şey anlatmıyor.
    const bounds = slotBounds(draft.day!, draft.startTime!, Number(draft.durationMin))
    if (bounds) {
      try {
        const clashes = await fetchSessionConflicts(bounds.startsAt, bounds.endsAt, draft.id)
        if (clashes.length > 0) {
          setConflicts(clashes)
          return
        }
      } catch {
        // Çakışma okunamazsa kayıt durmaz: uyarı bir kolaylık, kural değil.
      }
    }

    await persist()
  }

  if (!open) return null

  const isPast = draft.day !== null && draft.day < today

  if (conflicts !== null) {
    return (
      <Modal
        open
        title={tr.sessions.conflict.title}
        description={tr.sessions.conflict.body}
        onClose={onClose}
        dismissLabel={tr.sessions.conflict.back}
        actions={
          <ModalOption
            title={tr.sessions.conflict.confirm}
            hint={tr.sessions.conflict.hint}
            tone="primary"
            onClick={() => void persist()}
          />
        }
      >
        <ul className={styles.conflictList}>
          {conflicts.map((item) => (
            <li key={item.sessionId} className={styles.conflictItem}>
              <span className={styles.conflictLabel}>{item.label}</span>
              <span className={styles.conflictTime}>
                {formatTime(item.startsAt)}–{formatTime(item.endsAt)}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  return (
    <Modal
      open
      title={editing ? tr.sessions.form.editTitle : tr.sessions.form.newTitle}
      onClose={onClose}
      actions={
        <Button
          variant="primary"
          disabled={saving || loading || closedDay || subjects.length === 0}
          onClick={() => void submit()}
        >
          {tr.actions.save}
        </Button>
      }
    >
      {loading && <LoadingState inline />}

      {!loading && (
        <div className={styles.form}>
          {error && (
            <p className={styles.formError} role="alert">
              {error.message}
            </p>
          )}
          {subjects.length === 0 && (
            <p className={styles.formError} role="alert">
              {tr.sessions.form.errors.noSubjects}
            </p>
          )}

          {/* Düzenlemede tür kilitli: dersin hedefi devredilemez (yoklaması ve borcu
              başkasına geçerdi). Doğrusu iptal edip yenisini açmak. */}
          {editing ? (
            <p className={styles.hint}>{tr.sessions.form.kindLocked}</p>
          ) : (
            <SegmentedControl<SessionKind>
              label={tr.sessions.form.kind}
              value={draft.kind}
              options={[
                { value: 'group', label: tr.sessions.form.kindGroup },
                { value: 'solo', label: tr.sessions.form.kindSolo },
              ]}
              onChange={(kind) => patch({ kind, studyGroupId: '', studentId: '' })}
            />
          )}

          {!editing && (
            <Select
              label={draft.kind === 'group' ? tr.sessions.form.group : tr.sessions.form.student}
              placeholder={
                draft.kind === 'group'
                  ? tr.sessions.form.groupPlaceholder
                  : tr.sessions.form.studentPlaceholder
              }
              error={errors['session.target']}
              value={draft.kind === 'group' ? draft.studyGroupId : draft.studentId}
              options={targetOptions}
              onChange={(event) =>
                draft.kind === 'group'
                  ? pickGroup(event.target.value)
                  : patch({ studentId: event.target.value })
              }
            />
          )}

          <Select
            label={tr.sessions.form.subject}
            placeholder={tr.sessions.form.subjectPlaceholder}
            error={errors['session.subjectId']}
            value={draft.subjectId}
            options={subjectOptions}
            onChange={(event) => {
              patch({ subjectId: event.target.value })
              setDurationTouched(false)
            }}
          />

          <DatePicker
            label={tr.sessions.form.date}
            today={today}
            value={draft.day}
            error={closedDay ? tr.sessions.form.errors.closedDay : errors['session.day']}
            onChange={(value) => patch({ day: value })}
          />

          <div className={styles.pair}>
            <TimePicker
              label={tr.sessions.form.time}
              value={draft.startTime}
              error={errors['session.startTime']}
              onChange={(value) => patch({ startTime: value })}
            />
            <Input
              label={`${tr.sessions.form.duration} (${tr.sessions.form.minutesSuffix})`}
              hint={durationTouched ? undefined : tr.sessions.form.durationHint}
              error={errors['session.durationMin']}
              value={draft.durationMin}
              inputMode="numeric"
              onChange={(event) => {
                setDurationTouched(true)
                patch({ durationMin: event.target.value })
              }}
            />
          </div>

          {isPast && <p className={styles.warn}>{tr.sessions.form.pastWarning}</p>}

          {!editing && (
            <SegmentedControl
              label={tr.sessions.form.repeat}
              value={draft.repeat}
              options={[
                { value: 'once', label: tr.sessions.form.repeatOnce },
                { value: 'weekly', label: tr.sessions.form.repeatWeekly },
              ]}
              onChange={(repeat) => patch({ repeat })}
            />
          )}
          {!editing && draft.repeat === 'weekly' && (
            <p className={styles.hint}>{tr.sessions.form.repeatWeeklyHint}</p>
          )}
        </div>
      )}
    </Modal>
  )
}

function savedMessage(created: number, repeat: string, editing: boolean): string {
  if (editing) return tr.sessions.form.savedEdit
  if (repeat === 'weekly') {
    return `${tr.sessions.form.savedWeeklyPrefix} ${created} ${tr.sessions.form.savedWeeklySuffix}`
  }
  return tr.sessions.form.savedOnce
}

/** `'2026-04-01 16:00'` çiftinden dakika farkı — düzenlemede süre alanının kaynağı. */
function minutesBetween(startsAt: string, endsAt: string): number {
  const toMinutes = (stamp: string) => {
    const hour = Number(stamp.slice(11, 13))
    const minute = Number(stamp.slice(14, 16))
    return hour * 60 + minute
  }
  const diff = toMinutes(endsAt) - toMinutes(startsAt)
  // Gece yarısını aşan ders: bitiş ertesi güne sarkar ve fark eksiye düşer.
  return diff > 0 ? diff : diff + 24 * 60
}
