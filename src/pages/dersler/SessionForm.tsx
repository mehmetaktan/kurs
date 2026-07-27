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
  saveMakeupSession,
  saveSession,
  type AppError,
  type Conflict,
  type DaySessionRow,
  type GroupRow,
  type StudentRow,
  type Subject,
  type Teacher,
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
  SearchSelect,
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
  /** Yoklamadan açılan telafide hedef ve branş kilitlidir; yalnızca zaman/öğretmen seçilir. */
  makeup?: MakeupSource | null
  /**
   * Yeni ders için ön dolgu — takvimde **boş bir slota tıklandığında** o slotun günü ve
   * saati (`EKRANLAR §142`). Düzenlemede yok sayılır: orada değerler dersin kendisinden
   * geliyor ve ikinci bir kaynak ikisinin çelişmesine izin verirdi.
   */
  initialDay?: string
  initialTime?: string
  onClose: () => void
  onSaved: () => void
}

export interface MakeupSource {
  attendanceId: number
  studentId: number
  studentName: string
  subjectId: number
  subjectName: string
  teacherId: number | null
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
export function SessionForm({
  open,
  today,
  session,
  makeup,
  initialDay,
  initialTime,
  onClose,
  onSaved,
}: Props) {
  const editing = session != null

  const [draft, setDraft] = useState<SessionDraft>(() => emptySessionDraft(today))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<AppError | null>(null)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
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
      // Telafide öğrenci, grup ve branş kaynak yoklamadan kilitlidir. Bu uzun listeleri
      // boşuna okumamak kısayolun açılışını hızlandırır; yalnız öğretmen seçimi kalır.
      const [nextSubjects, nextGroups, nextStudents, nextTeachers] = await Promise.all([
        makeup ? Promise.resolve<Subject[]>([]) : fetchSubjects(),
        makeup ? Promise.resolve<GroupRow[]>([]) : fetchGroupList(),
        makeup ? Promise.resolve<StudentRow[]>([]) : fetchStudentList(),
        fetchTeachers(),
      ])
      setSubjects(nextSubjects)
      // Arşivlenmiş grup/öğrenciye yeni ders açılmaz: program ekranları canlı kayıtla
      // ilgilenir (§1.23). Liste ikisini de getiriyor, süzme ekranın işi.
      setGroups(nextGroups.filter((row) => !row.archived))
      setStudents(nextStudents.filter((row) => !row.archived))
      // ADR-037: kurs çok öğretmenli, alan **gerçek bir seçim**. Otomatik doldurma yok —
      // tek adayı seçen satır, ikinci öğretmen eklenince bütün dersleri sessizce
      // birincisine yazardı ve K-1 uyarısı yanlış öğretmene bakardı.
      setTeachers(nextTeachers)
      setTeacherId(session?.teacherId ?? makeup?.teacherId ?? null)

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
        })
      } else if (makeup) {
        setDraft({
          ...emptySessionDraft(initialDay ?? today),
          kind: 'solo',
          subjectId: String(makeup.subjectId),
          studentId: String(makeup.studentId),
        })
      } else {
        const only = nextSubjects.length === 1 ? String(nextSubjects[0]!.id) : ''
        setDraft({
          ...emptySessionDraft(initialDay ?? today),
          subjectId: only,
          startTime: initialTime ?? null,
        })
      }
    } catch (err) {
      setError(err as AppError)
    } finally {
      setLoading(false)
    }
  }, [editing, makeup, session, today, initialDay, initialTime])

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

  /**
   * Öğretmen listesi kısa — yerel `<select>` doğru olan (K1 aranabilir seçimi uzun
   * listeler için). Pasif öğretmenler yeni derse atanmaz; düzenlenen dersin
   * öğretmeni pasife alınmışsa listede **kalır**, yoksa kaydetmek onu değiştirirdi.
   */
  const teacherOptions = useMemo(
    () =>
      sortTrBy(
        teachers.filter((item) => item.isActive || item.id === teacherId),
        (item) => item.fullName,
      ).map((item) => ({ value: String(item.id), label: item.fullName })),
    [teachers, teacherId],
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
    if (group) {
      setTeacherId(group.teacherId)
      setDurationTouched(false)
    }
  }

  const persist = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const report = makeup
        ? await saveMakeupSession({
            attendanceId: makeup.attendanceId,
            teacherId,
            day: draft.day ?? '',
            startTime: draft.startTime ?? '',
            durationMin: Number(draft.durationMin),
          })
        : await saveSession(toSessionInput(draft, teacherId))
      toast(
        makeup
          ? report.created === 0
            ? tr.makeup.alreadyPlanned
            : tr.makeup.saved
          : savedMessage(editing),
      )
      onSaved()
    } catch (err) {
      const appError = err as AppError
      // "Yine de ekle" sonrasındaki hata çakışma özetinin arkasında kalmasın.
      // Normal forma dönünce alan hatası ilgili girdide, genel hata üstte görünür.
      setConflicts(null)
      if (isFieldError(appError.code)) {
        setErrors({ [appError.code]: appError.message })
      } else {
        setError(appError)
      }
    } finally {
      setSaving(false)
    }
  }, [draft, editing, makeup, onSaved, teacherId, toast])

  const submit = async () => {
    const found = validateSession(draft)
    setErrors(found)
    if (hasErrors(found) || closedDay) return

    // K-1 / R3.11 — çakışma ENGELLEMEZ, kaydetmeden önce onay ister. Uyarı dersin
    // ADINI söylüyor; "çakışma var" tek başına kullanıcıya hiçbir şey anlatmıyor.
    const bounds = slotBounds(draft.day!, draft.startTime!, Number(draft.durationMin))
    if (bounds) {
      try {
        const clashes = await fetchSessionConflicts(
          bounds.startsAt,
          bounds.endsAt,
          draft.id,
          teacherId,
        )
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
      title={makeup ? tr.makeup.form.title : editing ? tr.sessions.form.editTitle : tr.sessions.form.newTitle}
      onClose={onClose}
      actions={
        <Button
          variant="primary"
          disabled={saving || loading || closedDay || (!makeup && subjects.length === 0)}
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
          {!makeup && subjects.length === 0 && (
            <p className={styles.formError} role="alert">
              {tr.sessions.form.errors.noSubjects}
            </p>
          )}

          {/* Düzenlemede tür kilitli: dersin hedefi devredilemez (yoklaması ve borcu
              başkasına geçerdi). Doğrusu iptal edip yenisini açmak. */}
          {makeup ? (
            <p className={styles.hint}>
              {tr.makeup.form.source}{tr.units.separator}{makeup.studentName}
              {tr.units.separator}{makeup.subjectName}
            </p>
          ) : editing ? (
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

          {/* K1 — öğrenci ve grup listeleri UZUN olabilir; burada aranabilir seçim
              kullanılıyor. Branş ve öğretmen kısa listeler, onlar `Select` kalıyor. */}
          {!editing && !makeup && (
            <SearchSelect
              label={draft.kind === 'group' ? tr.sessions.form.group : tr.sessions.form.student}
              placeholder={
                draft.kind === 'group'
                  ? tr.sessions.form.groupPlaceholder
                  : tr.sessions.form.studentPlaceholder
              }
              error={errors['session.target']}
              value={
                (draft.kind === 'group' ? draft.studyGroupId : draft.studentId) || null
              }
              options={targetOptions}
              onChange={(value) =>
                draft.kind === 'group'
                  ? pickGroup(value ?? '')
                  : patch({ studentId: value ?? '' })
              }
            />
          )}

          {!makeup && (
            <Select
              label={tr.sessions.form.subject}
              placeholder={tr.sessions.form.subjectPlaceholder}
              error={errors['session.subjectId']}
              value={draft.subjectId}
              options={subjectOptions}
              disabled={draft.kind === 'group' && draft.studyGroupId !== ''}
              onChange={(event) => {
                patch({ subjectId: event.target.value })
                setDurationTouched(false)
              }}
            />
          )}

          {/* ADR-037 — öğretmen artık gerçek bir alan. K-1 çakışma uyarısı buna
              bakıyor: boş bırakılan ders hiçbir uyarı üretmez. */}
          <Select
            label={tr.sessions.form.teacher}
            placeholder={tr.sessions.form.teacherPlaceholder}
            hint={tr.sessions.form.teacherHint}
            value={teacherId === null ? '' : String(teacherId)}
            options={teacherOptions}
            disabled={draft.kind === 'group' && draft.studyGroupId !== ''}
            onChange={(event) => {
              setTeacherId(event.target.value === '' ? null : Number(event.target.value))
              setConflicts(null)
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

        </div>
      )}
    </Modal>
  )
}

function savedMessage(editing: boolean): string {
  return editing ? tr.sessions.form.savedEdit : tr.sessions.form.savedOnce
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
