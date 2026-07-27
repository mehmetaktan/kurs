/**
 * Ders formunun alan bazlı doğrulaması (E3).
 *
 * ## Rust ile ikizlik
 *
 * `src-tauri/src/repo/schedule.rs > validate_session` aynı kuralları uyguluyor. Buradaki
 * kopya **anında geri bildirim** için, oradaki **son söz** — arayüz atlatılırsa bile
 * veritabanına hedefsiz ya da sıfır süreli bir ders girmez.
 *
 * İki taraf aynı `code` uzayını kullanıyor (`session.target`, `session.durationMin`,
 * `session.day`), böylece Rust'tan dönen hata jenerik bir kutuya değil doğru girdinin
 * altına yerleşiyor (ADR-025). **Bu dosyaya dokunan her değişiklikte Rust ikizi de
 * güncellenir.**
 *
 * Tatil kontrolü burada YOK ve olamaz: kapalı gün bilgisi veritabanında
 * (`closed_day` + `setting.weekly_closed_days`). Form onu `fetchIsClosedDay` ile ayrıca
 * soruyor; son söz yine Rust'ta (K-2).
 */
import { tr } from '../../i18n/tr'
import type { SessionInput } from '../../lib/api'

export type FieldErrors = Record<string, string>

/** Ders birebir mi grup mu — ADR-012'nin dışlayıcı arc'ının arayüzdeki karşılığı. */
export type SessionKind = 'group' | 'solo'

export interface SessionDraft {
  /** Dolu = mevcut tek dersi düzenle. */
  id: number | null
  kind: SessionKind
  subjectId: string
  studyGroupId: string
  studentId: string
  /** `'YYYY-MM-DD'` */
  day: string | null
  /** `'HH:MM'` */
  startTime: string | null
  durationMin: string
}

export function emptySessionDraft(day: string): SessionDraft {
  return {
    id: null,
    kind: 'group',
    subjectId: '',
    studyGroupId: '',
    studentId: '',
    day,
    startTime: null,
    durationMin: '',
  }
}

export function validateSession(draft: SessionDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.subjectId === '') {
    errors['session.subjectId'] = tr.sessions.form.errors.subjectRequired
  }

  // ADR-012: grup ve öğrenciden tam olarak biri. Arayüzde tür seçili olduğu için
  // "ikisi de dolu" hâli doğmuyor; kalan tek risk seçilmemiş hedef.
  if (draft.kind === 'group' && draft.studyGroupId === '') {
    errors['session.target'] = tr.sessions.form.errors.groupRequired
  }
  if (draft.kind === 'solo' && draft.studentId === '') {
    errors['session.target'] = tr.sessions.form.errors.studentRequired
  }

  if (draft.day === null || draft.day === '') {
    errors['session.day'] = tr.sessions.form.errors.dateRequired
  }
  if (draft.startTime === null || draft.startTime === '') {
    errors['session.startTime'] = tr.sessions.form.errors.timeRequired
  }

  const minutes = Number(draft.durationMin)
  if (!Number.isInteger(minutes) || minutes <= 0) {
    errors['session.durationMin'] = tr.sessions.form.errors.durationInvalid
  }

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Rust'tan dönen hata alan bazlı mı — değilse ekranın üstündeki genel kutuya gider. */
export function isFieldError(code: string): boolean {
  return code.startsWith('session.')
}

/** Doğrulanmış taslak → Rust girdisi. Doğrulama geçmeden çağrılmaz. */
export function toSessionInput(draft: SessionDraft, teacherId: number | null): SessionInput {
  return {
    id: draft.id,
    subjectId: Number(draft.subjectId),
    teacherId,
    studyGroupId: draft.kind === 'group' ? Number(draft.studyGroupId) : null,
    studentId: draft.kind === 'solo' ? Number(draft.studentId) : null,
    day: draft.day ?? '',
    startTime: draft.startTime ?? '',
    durationMin: Number(draft.durationMin),
  }
}

/**
 * Çakışma sorgusunun ihtiyacı olan `'YYYY-MM-DD HH:MM'` çifti.
 *
 * Bitiş `Date` üzerinden hesaplanıyor, saat metnine dakika eklenerek değil: gece
 * yarısını aşan bir ders (23:30 + 60 dk) aksi hâlde aynı günün `00:30`'unu üretir ve
 * çakışma sorgusu boş döner — Rust tarafındaki `slot_bounds` da aynı gerekçeyle
 * `NaiveDateTime` kullanıyor.
 */
export function slotBounds(
  day: string,
  startTime: string,
  durationMin: number,
): { startsAt: string; endsAt: string } | null {
  const [hour, minute] = startTime.split(':').map(Number)
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }
  const [year, month, date] = day.split('-').map(Number)
  if (year === undefined || month === undefined || date === undefined) return null

  const start = new Date(Date.UTC(year, month - 1, date, hour, minute))
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + durationMin * 60_000)

  return { startsAt: stamp(start), endsAt: stamp(end) }
}

function stamp(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` +
    ` ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
  )
}
