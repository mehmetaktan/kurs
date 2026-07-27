import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  fetchStudentDetail,
  saveStudent,
  type AppError,
  type StudentInput,
} from '../../lib/api'
import { formatDate, parseDateTr } from '../../lib/format'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DatePicker,
  Drawer,
  ErrorState,
  Input,
  LoadingState,
  PhoneInput,
  Textarea,
  useToast,
} from '../../ui'
import { GuardianFields } from './GuardianFields'
import {
  emptyStudentDraft,
  hasErrors,
  isFieldError,
  validateStudent,
  type FieldErrors,
  type GuardianDraft,
  type StudentDraft,
} from './validate'
import styles from './Students.module.css'

export interface StudentFormProps {
  open: boolean
  /** `null` → yeni öğrenci. */
  studentId: number | null
  onClose: () => void
  onSaved: (studentId: number) => void
}

/**
 * EKRANLAR.md E1 — `Yeni öğrenci / Düzenle`.
 *
 * Çekmece (396px) + alt eylem çubuğu. Doğrulama **alan bazlı**: hata ilgili girdinin
 * ALTINDA, Türkçe ve eylem öneren bir cümleyle çıkar. Jenerik "bir hata oluştu" yasak
 * (CLAUDE.md > Arayüz), o yüzden Rust'tan dönen hata da `code`'una bakılarak doğru
 * alana yerleştiriliyor (`isFieldError`).
 *
 * Kaydetmeden çıkarken uyarı var: form uzun ve yanlışlıkla kapatmak bütün emeği siler.
 */
export function StudentForm({ open, studentId, onClose, onSaved }: StudentFormProps) {
  const [draft, setDraft] = useState<StudentDraft>(emptyStudentDraft)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setErrors({})
    setFormError(null)
    setLoadError(null)
    setDirty(false)

    if (studentId === null) {
      setDraft(emptyStudentDraft())
      return
    }

    setLoading(true)
    try {
      const detail = await fetchStudentDetail(studentId)
      setDraft({
        id: detail.student.id,
        fullName: detail.student.fullName,
        school: detail.student.school ?? '',
        grade: detail.student.grade ?? '',
        // Veritabanında `'YYYY-MM-DD'`, ekranda `GG.AA.YYYY` (ADR-017 / format.ts).
        birthDate: detail.student.birthDate ? formatDate(detail.student.birthDate) : '',
        phone: detail.student.phone ?? '',
        isActive: detail.student.isActive,
        enrolledOn: detail.student.enrolledOn ? formatDate(detail.student.enrolledOn) : '',
        note: detail.student.note ?? '',
        guardians: detail.guardians.map((guardian) => ({
          guardianId: guardian.guardianId,
          fullName: guardian.fullName,
          phone: guardian.phone ?? '',
          email: guardian.email ?? '',
          relation: guardian.relation ?? '',
          isPrimary: guardian.isPrimary,
        })),
      })
    } catch (err) {
      setLoadError(err as AppError)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const patch = (changes: Partial<StudentDraft>) => {
    setDirty(true)
    setDraft((current) => ({ ...current, ...changes }))
  }

  const setGuardians = (guardians: GuardianDraft[]) => patch({ guardians })

  /** Alan düzeltilince o alanın hatası hemen kalkar — kırmızı kalıp durmaz. */
  const clearError = (field: string) =>
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })

  const attemptClose = () => {
    if (dirty && !saving) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  const submit = async () => {
    const found = validateStudent(draft)
    setErrors(found)
    if (hasErrors(found)) {
      setFormError(tr.students.form.errors.summary)
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      const input: StudentInput = {
        id: draft.id,
        fullName: draft.fullName.trim(),
        school: emptyToNull(draft.school),
        grade: emptyToNull(draft.grade),
        birthDate: parseDateTr(draft.birthDate),
        phone: emptyToNull(draft.phone),
        isActive: draft.isActive,
        enrolledOn: parseDateTr(draft.enrolledOn),
        note: emptyToNull(draft.note),
        guardians: draft.guardians.map((guardian) => ({
          guardianId: guardian.guardianId,
          fullName: guardian.fullName.trim(),
          phone: guardian.phone.trim(),
          email: emptyToNull(guardian.email),
          relation: emptyToNull(guardian.relation),
          isPrimary: guardian.isPrimary,
        })),
      }

      const savedId = await saveStudent(input)
      toast(draft.id === null ? tr.students.form.savedNew : tr.students.form.savedEdit)
      setDirty(false)
      onSaved(savedId)
    } catch (err) {
      // Rust'ın son sözü: `code` bir alan adıysa hata o girdinin altına yerleşir.
      const error = err as AppError
      if (isFieldError(error.code)) {
        setErrors({ [error.code]: error.message })
        setFormError(tr.students.form.errors.summary)
      } else {
        setFormError(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <Drawer
        open
        title={studentId === null ? tr.students.form.newTitle : tr.students.form.editTitle}
        onClose={attemptClose}
        footer={
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={attemptClose} disabled={saving}>
              {tr.actions.cancel}
            </Button>
            <Button variant="primary" onClick={() => void submit()} disabled={saving || loading}>
              {saving ? tr.students.form.saving : tr.actions.save}
            </Button>
          </div>
        }
      >
        {loading && <LoadingState />}
        {loadError && (
          <ErrorState
            message={loadError.message}
            details={loadError.details}
            onRetry={() => void load()}
          />
        )}

        {!loading && !loadError && (
          <>
            {formError && (
              <div className={styles.formError} role="alert">
                {formError}
              </div>
            )}

            <div className={styles.formSection}>
              <div className={styles.formGrid}>
                <Input
                  label={tr.students.form.fullName}
                  placeholder={tr.students.form.fullNamePlaceholder}
                  value={draft.fullName}
                  error={errors['student.fullName']}
                  autoFocus
                  onChange={(event) => {
                    clearError('student.fullName')
                    patch({ fullName: event.target.value })
                  }}
                />

                <Input
                  label={tr.students.form.school}
                  value={draft.school}
                  onChange={(event) => patch({ school: event.target.value })}
                />

                <div className={styles.formPair}>
                  <Input
                    label={tr.students.form.grade}
                    placeholder={tr.students.form.gradePlaceholder}
                    value={draft.grade}
                    onChange={(event) => patch({ grade: event.target.value })}
                  />
                  {/*
                    Yerel `<input type="date">` KULLANILMIYOR: WebView2'de biçim Windows'un
                    bölge ayarına bağlı ve İngilizce Windows'ta kullanıcı `mm/dd/yyyy`
                    görür (Picker.tsx). Maskeleme ve ayrıştırma bizde.
                  */}
                  <DatePicker
                    label={tr.students.form.birthDate}
                    value={parseDateTr(draft.birthDate)}
                    error={errors['student.birthDate']}
                    onChange={(iso) => {
                      clearError('student.birthDate')
                      patch({ birthDate: iso ? formatDate(iso) : '' })
                    }}
                  />
                </div>

                <div className={styles.formPair}>
                  {/* Maskeli: yazarken `0532 111 22 33`. Maske görsel, veri değil —
                      kayıt yine `phone_digits` normalleştirmesinden geçiyor. */}
                  <PhoneInput
                    label={tr.students.form.phone}
                    placeholder={tr.students.form.phonePlaceholder}
                    hint={tr.students.form.phoneHint}
                    value={draft.phone}
                    error={errors['student.phone']}
                    onChange={(phone) => {
                      clearError('student.phone')
                      patch({ phone })
                    }}
                  />
                  <DatePicker
                    label={tr.students.form.enrolledOn}
                    value={parseDateTr(draft.enrolledOn)}
                    error={errors['student.enrolledOn']}
                    onChange={(iso) => {
                      clearError('student.enrolledOn')
                      patch({ enrolledOn: iso ? formatDate(iso) : '' })
                    }}
                  />
                </div>

                <Textarea
                  label={tr.students.form.note}
                  placeholder={tr.students.form.notePlaceholder}
                  value={draft.note}
                  onChange={(event) => patch({ note: event.target.value })}
                />

                <Checkbox
                  label={tr.students.form.isActive}
                  checked={draft.isActive}
                  onChange={(event) => patch({ isActive: event.target.checked })}
                />
                <span className={styles.hint}>{tr.students.form.isActiveHint}</span>
              </div>
            </div>

            <GuardianFields
              guardians={draft.guardians}
              errors={errors}
              onChange={setGuardians}
              onClearError={clearError}
            />
          </>
        )}
      </Drawer>

      {/* Kaydetmeden çıkarken uyarı — form uzun, yanlışlıkla kapatmak emeği siler. */}
      <ConfirmDialog
        open={confirmDiscard}
        title={tr.students.form.discardTitle}
        description={tr.students.form.discardBody}
        confirmLabel={tr.students.form.discardConfirm}
        confirmHint={tr.students.form.discardHint}
        cancelLabel={tr.students.form.keepEditing}
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          setDirty(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}

/** Boş metin `null` gider: veritabanında `''` ile `NULL` aynı şey değil. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
