import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchDefaultMinutes,
  fetchGroupDetail,
  fetchSubjects,
  fetchTeachers,
  saveGroup,
  type AppError,
  type Subject,
  type Teacher,
  type WeeklySlot,
} from '../../lib/api'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Input,
  LoadingState,
  Select,
  TimePicker,
  useToast,
} from '../../ui'
import { WEEKDAYS } from '../tanimlar/ClosedDaysTab'
import styles from './Groups.module.css'

interface Props {
  open: boolean
  /** `null` = yeni grup. */
  groupId: number | null
  onClose: () => void
  onSaved: (groupId: number) => void
}

interface Draft {
  name: string
  subjectId: string
  teacherId: string
  capacity: string
  startsOn: string | null
  endsOn: string | null
  isActive: boolean
  weekly: WeeklySlot[]
}

const EMPTY: Draft = {
  name: '',
  subjectId: '',
  teacherId: '',
  capacity: '6',
  startsOn: null,
  endsOn: null,
  isActive: true,
  weekly: [],
}

/**
 * EKRANLAR.md E5 — grup formu (396px çekmece).
 *
 * **Haftalık program formun içinde**, ayrı bir ekranda değil: R5.5 "haftalık program
 * grup oluştururken tanımlanır ve seanslar üretilir" diyor. Ayrı bir adıma bölünseydi
 * kurs sahibi grubu kaydedip programsız bırakır ve takvimi boş görürdü — Bugün ekranının
 * R1.7 boş-durumu tam olarak bu senaryodan doğuyor.
 */
export function GroupForm({ open, groupId, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [nextSubjects, nextTeachers] = await Promise.all([fetchSubjects(), fetchTeachers()])
      setSubjects(nextSubjects)
      setTeachers(nextTeachers)

      if (groupId === null) {
        setDraft({
          ...EMPTY,
          // Tek öğretmen varsa alan ONUN üzerine gelir (ADR-011). Gizlenmiyor: yazan
          // bir ekran olmazsa `teacher_id` NULL kalır ve K-1 çakışma uyarısı ölü doğar.
          teacherId: nextTeachers.length === 1 ? String(nextTeachers[0]!.id) : '',
          subjectId: nextSubjects.length === 1 ? String(nextSubjects[0]!.id) : '',
        })
      } else {
        const detail = await fetchGroupDetail(groupId)
        setDraft({
          name: detail.group.name,
          subjectId: String(detail.group.subjectId),
          teacherId: detail.group.teacherId === null ? '' : String(detail.group.teacherId),
          capacity: String(detail.group.capacity),
          startsOn: detail.group.startsOn,
          endsOn: detail.group.endsOn,
          isActive: detail.group.isActive,
          weekly: detail.group.weekly,
        })
      }
    } catch (err) {
      setError(err as AppError)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const addSlot = async () => {
    const subjectId = draft.subjectId === '' ? null : Number(draft.subjectId)
    // Süre branşın varsayılanından, yoksa genel ayardan (PRD S4). Rust tek kaynak;
    // burada ikinci bir varsayılan tanımlamıyoruz.
    let minutes = 60
    try {
      minutes = await fetchDefaultMinutes(subjectId)
    } catch {
      // Ayar okunamazsa 60 ile devam — form açık kalsın, kullanıcı süreyi düzeltebilir.
    }
    setDraft((prev) => ({
      ...prev,
      weekly: [
        ...prev.weekly,
        { id: null, weekday: 1, startTime: '16:00', durationMin: minutes },
      ],
    }))
  }

  const updateSlot = (index: number, patch: Partial<WeeklySlot>) => {
    setDraft((prev) => ({
      ...prev,
      weekly: prev.weekly.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    }))
  }

  const removeSlot = (index: number) => {
    setDraft((prev) => ({ ...prev, weekly: prev.weekly.filter((_, i) => i !== index) }))
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const id = await saveGroup({
        id: groupId,
        name: draft.name,
        subjectId: Number(draft.subjectId),
        teacherId: draft.teacherId === '' ? null : Number(draft.teacherId),
        capacity: Number(draft.capacity),
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        isActive: draft.isActive,
        weekly: draft.weekly,
      })
      toast(tr.groups.form.saved)
      onSaved(id)
    } catch (err) {
      setError(err as AppError)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const subjectMissing = draft.subjectId === ''

  return (
    <Drawer
      open
      title={groupId === null ? tr.groups.form.newTitle : tr.groups.form.editTitle}
      onClose={onClose}
      footer={
        <div className={styles.formActions}>
          <Button onClick={onClose}>{tr.actions.cancel}</Button>
          <Button
            variant="primary"
            disabled={saving || loading || subjectMissing}
            onClick={() => void submit()}
          >
            {tr.actions.save}
          </Button>
        </div>
      }
    >
      {loading && <LoadingState inline />}

      {!loading && (
        <div className={styles.formSection}>
          {error && (
            <p className={styles.formError} role="alert">
              {error.message}
            </p>
          )}

          <Input
            label={tr.groups.form.name}
            value={draft.name}
            placeholder={tr.groups.form.namePlaceholder}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />

          <Select
            label={tr.groups.form.subject}
            value={draft.subjectId}
            placeholder={tr.groups.form.subjectPlaceholder}
            options={sortTrBy(subjects, (s) => s.name).map((subject) => ({
              value: String(subject.id),
              label: subject.name,
            }))}
            onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })}
          />

          <Select
            label={tr.groups.form.teacher}
            value={draft.teacherId}
            options={teachers.map((teacher) => ({
              value: String(teacher.id),
              label: teacher.fullName,
            }))}
            onChange={(event) => setDraft({ ...draft, teacherId: event.target.value })}
          />

          <Input
            label={tr.groups.form.capacity}
            hint={tr.groups.form.capacityHint}
            value={draft.capacity}
            inputMode="numeric"
            onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
          />

          <div className={styles.formPair}>
            <DatePicker
              label={tr.groups.form.startsOn}
              value={draft.startsOn}
              onChange={(value) => setDraft({ ...draft, startsOn: value })}
            />
            <DatePicker
              label={tr.groups.form.endsOn}
              hint={tr.groups.form.endsOnHint}
              value={draft.endsOn}
              onChange={(value) => setDraft({ ...draft, endsOn: value })}
            />
          </div>

          <Checkbox
            label={tr.groups.form.isActive}
            checked={draft.isActive}
            onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
          />

          <div>
            <div className={styles.panelHead}>
              <div>
                <strong>{tr.groups.form.weekly}</strong>
                <p className={styles.lead}>{tr.groups.form.weeklyHint}</p>
              </div>
              <Button size="small" onClick={() => void addSlot()}>
                {tr.groups.form.addSlot}
              </Button>
            </div>

            {draft.weekly.length === 0 && <p className={styles.lead}>{tr.groups.form.noSlots}</p>}

            <div className={styles.slotList}>
              {draft.weekly.map((slot, index) => (
                <div key={slot.id ?? `new-${index}`} className={styles.slotCard}>
                  <div className={styles.slotGrid}>
                    <Select
                      className={styles.slotDay}
                      label={tr.groups.form.weekday}
                      value={String(slot.weekday)}
                      options={WEEKDAYS.map((day) => ({
                        value: String(day.value),
                        label: day.label,
                      }))}
                      onChange={(event) =>
                        updateSlot(index, { weekday: Number(event.target.value) })
                      }
                    />
                    <TimePicker
                      label={tr.groups.form.startTime}
                      value={slot.startTime}
                      onChange={(value) => updateSlot(index, { startTime: value ?? '' })}
                    />
                    <Input
                      label={tr.groups.form.duration}
                      value={String(slot.durationMin)}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateSlot(index, { durationMin: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.slotFoot}>
                    <Button size="small" onClick={() => removeSlot(index)}>
                      {tr.groups.form.removeSlot}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}
