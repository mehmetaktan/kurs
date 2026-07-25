/**
 * Form doğrulamasının testi.
 *
 * **İkiz vektörler:** buradaki girdi listeleri `src-tauri/src/repo/roster.rs`'in
 * `mod tests` bölümündekiyle aynı. İki taraf ayrışırsa arayüz "geçerli" der, Rust
 * reddeder ve kullanıcı sebebini anlamadığı bir hata görür — Faz 2'de `parseKurus`
 * ayrışması tam olarak böyle yakalanmıştı.
 */
import { describe, expect, it } from 'vitest'
import { tr } from '../../i18n/tr'
import {
  emptyGuardianDraft,
  emptyStudentDraft,
  hasErrors,
  isFieldError,
  validateStudent,
  type StudentDraft,
} from './validate'

function draft(overrides: Partial<StudentDraft> = {}): StudentDraft {
  return { ...emptyStudentDraft(), fullName: 'Elif Yılmaz', ...overrides }
}

function guardian(overrides: Partial<ReturnType<typeof emptyGuardianDraft>> = {}) {
  return {
    ...emptyGuardianDraft(true),
    fullName: 'Hatice Yılmaz',
    phone: '0532 214 88 10',
    ...overrides,
  }
}

describe('öğrenci adı', () => {
  it('zorunlu', () => {
    const errors = validateStudent(draft({ fullName: '   ' }))
    expect(errors['student.fullName']).toBe(tr.students.form.errors.nameRequired)
    expect(hasErrors(errors)).toBe(true)
  })

  it('120 karakteri aşamaz — Türkçe harfler tek karakter sayılır', () => {
    expect(validateStudent(draft({ fullName: 'ş'.repeat(120) }))).toEqual({})
    expect(validateStudent(draft({ fullName: 'ş'.repeat(121) }))['student.fullName']).toBe(
      tr.students.form.errors.nameTooLong,
    )
  })

  it('geçerli bir formda hiç hata yoktur', () => {
    expect(validateStudent(draft())).toEqual({})
  })
})

describe('telefon', () => {
  /** Rust `check_phone` ile aynı vektörler. */
  it('öğrenci telefonu isteğe bağlı, veli telefonu zorunlu', () => {
    expect(validateStudent(draft({ phone: '' }))).toEqual({})

    const errors = validateStudent(draft({ guardians: [guardian({ phone: '  ' })] }))
    expect(errors['guardians.0.phone']).toBe(tr.students.form.errors.guardianPhoneRequired)
  })

  it('aynı numaranın üç yazımını da kabul eder', () => {
    for (const phone of ['0532 111 22 33', '+90 532 111 22 33', '532 111 22 33']) {
      expect(validateStudent(draft({ phone }))).toEqual({})
    }
  })

  it('kısa ve uzun numarayı reddeder', () => {
    expect(validateStudent(draft({ phone: '0532' }))['student.phone']).toBe(
      tr.students.form.errors.phoneInvalid,
    )
    expect(validateStudent(draft({ phone: '0532111223344' + '5' }))['student.phone']).toBe(
      tr.students.form.errors.phoneInvalid,
    )
  })
})

describe('tarihler', () => {
  it('GG.AA.YYYY biçiminde ve takvimsel olarak geçerli olmalı', () => {
    expect(validateStudent(draft({ birthDate: '12.05.2010' }))).toEqual({})
    expect(validateStudent(draft({ birthDate: '31.02.2010' }))['student.birthDate']).toBe(
      tr.students.form.errors.birthDateInvalid,
    )
    expect(validateStudent(draft({ birthDate: '2010-05-12' }))['student.birthDate']).toBe(
      tr.students.form.errors.birthDateInvalid,
    )
  })

  it('boş tarih serbest', () => {
    expect(validateStudent(draft({ birthDate: '', enrolledOn: '' }))).toEqual({})
  })

  it('kayıt tarihinin kendi mesajı var — hangi alan olduğu belirsiz kalmaz', () => {
    const errors = validateStudent(draft({ enrolledOn: '99.99.2025' }))
    expect(errors['student.enrolledOn']).toBe(tr.students.form.errors.enrolledOnInvalid)
    expect(errors['student.birthDate']).toBeUndefined()
  })
})

describe('veliler', () => {
  it('adı zorunlu ve hata doğru sıradaki veliye işaretlenir', () => {
    const errors = validateStudent(
      draft({
        guardians: [guardian(), guardian({ fullName: '  ', isPrimary: false })],
      }),
    )
    expect(errors['guardians.1.fullName']).toBe(tr.students.form.errors.guardianNameRequired)
    expect(errors['guardians.0.fullName']).toBeUndefined()
  })

  it('iki birincil veli yazılamaz — şema da izin vermiyor (ux_sg_primary)', () => {
    const errors = validateStudent(
      draft({ guardians: [guardian(), guardian({ fullName: 'Ali Yılmaz' })] }),
    )
    expect(errors['guardians.primary']).toBe(tr.students.form.errors.singlePrimary)
  })

  it('velisiz form geçerli — veli sonradan eklenebilir', () => {
    expect(validateStudent(draft({ guardians: [] }))).toEqual({})
  })
})

describe('Rust’tan gelen hatanın yerleştirilmesi', () => {
  /** `code` bir alan adıysa hata girdinin altına, değilse genel kutuya gider. */
  it('alan kodlarını tanır', () => {
    expect(isFieldError('student.fullName')).toBe(true)
    expect(isFieldError('guardians.0.phone')).toBe(true)
    expect(isFieldError('note.body')).toBe(true)
  })

  it('alan olmayan kodları genel hataya bırakır', () => {
    expect(isFieldError('not_found')).toBe(false)
    expect(isFieldError('db_locked')).toBe(false)
    expect(isFieldError('duplicate')).toBe(false)
  })
})
