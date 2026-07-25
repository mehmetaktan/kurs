import { forwardRef, useId, useLayoutEffect, useRef } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { backspacePhone, editPhone, maskPhone } from '../lib/format'
import { marks } from './marks'
import styles from './Field.module.css'

interface FieldShellProps {
  label?: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
}

/**
 * Etiket + girdi + yardım/hata satırı. Hata varsa yardım metni gizlenir: ikisi birden
 * gösterilince kullanıcı hangisinin eylem önerdiğini anlamıyor.
 */
export function FieldShell({ label, hint, error, htmlFor, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span
          className={styles.error}
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
        >
          {error}
        </span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </div>
  )
}

/** Girdinin `aria-*` bağlantılarını tek yerden kurar. */
function controlProps(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-errormessage': error ? `${id}-error` : undefined,
  }
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, ...rest },
  ref,
) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <input
        ref={ref}
        {...controlProps(id, error)}
        className={[styles.control, error ? styles.invalid : undefined, className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
    </FieldShell>
  )
})

export interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'type'> {
  label?: string
  hint?: string
  error?: string
  value: string
  /** Maskelenmiş metin — kaydedilen değer de budur. */
  onChange: (value: string) => void
}

/**
 * Telefon alanı: yazarken `0532 111 22 33` biçimini kurar (`faz-04.md §2`).
 *
 * Maske **görsel**; veri değil. Kaydedilen değer kullanıcının gördüğü metindir ve
 * `phone_digits` normalleştirmesi yine Rust'ta yapılır — boşluk koymak numarayı
 * değiştirmiyor (`text::phone_digits` hepsini atıyor).
 *
 * İşin zor kısmı imleç, ve üçü de `lib/format.ts`'te testli:
 * - Ortadan düzenlemede imleç sona atlamaz — konum karakterle değil **rakam sayısıyla**
 *   taşınır (`editPhone`).
 * - Ayıraç üstünde `Backspace` bir rakam siler (`backspacePhone`); yoksa maske boşluğu
 *   anında geri koyar ve tuş çalışmıyormuş gibi görünür.
 * - `+90 …` / `0090 …` yapıştırması kabul edilir (`maskPhone`).
 */
export function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)

  // İmleç, React değeri yazdıktan SONRA konuyor: `useEffect` olsaydı tarayıcı bir kare
  // boyunca imleci sonda gösterirdi.
  useLayoutEffect(() => {
    const caret = caretRef.current
    if (caret === null) return
    caretRef.current = null
    ref.current?.setSelectionRange(caret, caret)
  })

  const apply = ({ value: next, caret }: { value: string; caret: number }) => {
    caretRef.current = caret
    onChange(next)
  }

  return (
    <Input
      ref={ref}
      inputMode="tel"
      autoComplete="tel"
      value={maskPhone(value)}
      onChange={(event) =>
        apply(
          editPhone(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          ),
        )
      }
      onKeyDown={(event) => {
        if (event.key !== 'Backspace') return
        const input = event.currentTarget
        const caret = input.selectionStart
        // Seçim varsa tarayıcı zaten doğru şeyi siliyor; rakamın üstündeyse de öyle.
        if (caret === null || caret !== input.selectionEnd || caret === 0) return
        if (input.value[caret - 1] !== ' ') return
        event.preventDefault()
        apply(backspacePhone(input.value, caret))
      }}
      {...rest}
    />
  )
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label?: string
  hint?: string
  error?: string
  /** Kart içinde kenarlıksız duran hâli (Öğrenci detayı → Notlar). */
  bare?: boolean
}

export function Textarea({
  label,
  hint,
  error,
  bare = false,
  className,
  ...rest
}: TextareaProps) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        {...controlProps(id, error)}
        className={[
          styles.control,
          styles.textarea,
          bare ? styles.textareaBare : undefined,
          error ? styles.invalid : undefined,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label?: string
  hint?: string
  error?: string
  options: readonly SelectOption[]
  /** Seçim zorunluysa listenin başına konan "seçilmemiş" satırı. */
  placeholder?: string
}

/** Yerel `<select>` + `appearance:none` + `▾` (TASARIM-SISTEMI §6/8). */
export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <div className={styles.selectWrap}>
        <select
          {...controlProps(id, error)}
          className={[
            styles.control,
            styles.select,
            error ? styles.invalid : undefined,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.caret} aria-hidden="true">
          {marks.caret}
        </span>
      </div>
    </FieldShell>
  )
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function Checkbox({ label, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label
      className={[styles.checkbox, disabled ? styles.checkboxDisabled : undefined, className]
        .filter(Boolean)
        .join(' ')}
    >
      <input type="checkbox" disabled={disabled} {...rest} />
      {label}
    </label>
  )
}
