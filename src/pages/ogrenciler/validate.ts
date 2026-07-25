/**
 * Öğrenci formunun alan bazlı doğrulaması.
 *
 * ## Rust ile ikizlik
 *
 * `src-tauri/src/repo/roster.rs > validate_student` aynı kuralları uyguluyor. Buradaki
 * kopya **anında geri bildirim** için (kullanıcı alandan çıkarken görsün), oradaki
 * **son söz** — arayüz atlatılırsa bile veritabanına bozuk kayıt girmez.
 *
 * İki taraf aynı `code` uzayını kullanıyor (`student.fullName`, `guardians.0.phone`);
 * Rust'tan dönen hata bu sayede doğru girdinin altına yerleşiyor, jenerik bir kutuya
 * değil. **Bu dosyaya dokunan her değişiklikte Rust ikizi ve iki taraftaki test
 * vektörleri birlikte güncellenir** — `format.ts` başındaki aynı kural.
 *
 * Metinler `tr.ts`'ten geliyor: mesajlar Türkçe ve **eylem öneriyor**, ham hata kodu
 * göstermiyor (CLAUDE.md > Arayüz).
 */
import { tr } from '../../i18n/tr'
import { parseDateTr, phoneDigits } from '../../lib/format'

/** Alan adı → Türkçe hata. Boş nesne = form geçerli. */
export type FieldErrors = Record<string, string>

export interface GuardianDraft {
  guardianId: number | null
  fullName: string
  phone: string
  email: string
  relation: string
  isPrimary: boolean
}

export interface StudentDraft {
  id: number | null
  fullName: string
  school: string
  grade: string
  /** Kullanıcının yazdığı hâli: `GG.AA.YYYY`. */
  birthDate: string
  phone: string
  isActive: boolean
  enrolledOn: string
  note: string
  guardians: GuardianDraft[]
}

export const MAX_NAME_CHARS = 120

/** Rust `check_phone` ile aynı aralık — gerekçesi orada. */
const PHONE_MIN_DIGITS = 10
const PHONE_MAX_DIGITS = 13

export function emptyStudentDraft(): StudentDraft {
  return {
    id: null,
    fullName: '',
    school: '',
    grade: '',
    birthDate: '',
    phone: '',
    isActive: true,
    enrolledOn: '',
    note: '',
    guardians: [],
  }
}

export function emptyGuardianDraft(isPrimary: boolean): GuardianDraft {
  return {
    guardianId: null,
    fullName: '',
    phone: '',
    email: '',
    relation: '',
    isPrimary,
  }
}

export function guardianField(index: number, name: string): string {
  return `guardians.${index}.${name}`
}

export function validateStudent(draft: StudentDraft): FieldErrors {
  const errors: FieldErrors = {}
  const name = draft.fullName.trim()

  if (name === '') {
    errors['student.fullName'] = tr.students.form.errors.nameRequired
  } else if ([...name].length > MAX_NAME_CHARS) {
    errors['student.fullName'] = tr.students.form.errors.nameTooLong
  }

  const phone = phoneError(draft.phone, false)
  if (phone) errors['student.phone'] = phone

  const birth = dateError(draft.birthDate, tr.students.form.errors.birthDateInvalid)
  if (birth) errors['student.birthDate'] = birth

  const enrolled = dateError(draft.enrolledOn, tr.students.form.errors.enrolledOnInvalid)
  if (enrolled) errors['student.enrolledOn'] = enrolled

  draft.guardians.forEach((guardian, index) => {
    if (guardian.fullName.trim() === '') {
      errors[guardianField(index, 'fullName')] = tr.students.form.errors.guardianNameRequired
    }
    // ADR-009: veli telefonu zorunlu — v2'de hatırlatma bu numaraya gidecek ve
    // sonradan toplamak, o özelliği hiç açmamakla aynı şey.
    const guardianPhone = phoneError(guardian.phone, true)
    if (guardianPhone) errors[guardianField(index, 'phone')] = guardianPhone
  })

  if (draft.guardians.filter((guardian) => guardian.isPrimary).length > 1) {
    errors['guardians.primary'] = tr.students.form.errors.singlePrimary
  }

  return errors
}

function phoneError(value: string, required: boolean): string | null {
  const raw = value.trim()
  if (raw === '') return required ? tr.students.form.errors.guardianPhoneRequired : null

  const digits = phoneDigits(raw)
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return tr.students.form.errors.phoneInvalid
  }
  return null
}

/** `parseDateTr` takvimsel olarak da doğruluyor: `31.02.2026` reddedilir. */
function dateError(value: string, message: string): string | null {
  if (value.trim() === '') return null
  return parseDateTr(value) === null ? message : null
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/**
 * Rust'tan dönen `AppError` alan bazlı mı — `code` bir alan adıysa hata o girdinin
 * altına konur, değilse ekranın üstündeki genel hata kutusuna.
 */
export function isFieldError(code: string): boolean {
  return code.startsWith('student.') || code.startsWith('guardians.') || code.startsWith('note.')
}
