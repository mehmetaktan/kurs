import { useEffect, useId, useRef, useState } from 'react'
import { tr } from '../i18n/tr'
import {
  dateToIso,
  formatDate,
  formatTime,
  isoToDate,
  minutesToTime,
  parseDateTr,
  parseTimeTr,
} from '../lib/format'
import { Button } from './Button'
import { FieldShell } from './Field'
import { marks } from './marks'
import fieldStyles from './Field.module.css'
import styles from './Picker.module.css'

/**
 * Neden yerel `<input type="date">` KULLANILMIYOR:
 *
 * WebView2'de yerel tarih girdisinin biçimi Windows'un bölge ayarına bağlıdır. İngilizce
 * Windows'ta kullanıcıya `mm/dd/yyyy` gösterilir; kurs sahibi `07/25/2026` görüp `25/07`
 * yazarsa tarih sessizce başka bir güne gider. Aynı sorun `type="time"` için AM/PM
 * biçiminde çıkar. Ayrıştırma bizde olduğu sürece (`lib/format.ts`, testli) Windows'un
 * dil ayarı hiçbir şeyi değiştirmiyor.
 */

const FIRST_SLOT_MIN = 8 * 60 // 08:00 — takvim aralığının başı
const LAST_SLOT_MIN = 22 * 60 // 22:00
const SLOT_STEP_MIN = 30

/** Panel dışına tıklanınca ya da Esc'e basılınca kapanır. */
function useDismiss(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDismiss()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onDismiss])

  return ref
}

export interface DatePickerProps {
  /** `'YYYY-MM-DD'` ya da `null`. */
  value: string | null
  onChange: (iso: string | null) => void
  label?: string
  hint?: string
  /** Dışarıdan gelen doğrulama hatası; biçim hatası zaten içeride yakalanıyor. */
  error?: string
  /**
   * Birden fazla tarih alanının paylaştığı dış hata metninin id'si. `error` gibi
   * ikinci bir canlı uyarı çizmez; girdiyi mevcut tek mesaja bağlar.
   */
  errorMessageId?: string
  disabled?: boolean
  /** Ay ızgarasında çerçeveyle işaretlenen gün. Rust'tan gelen "bugün" (§0). */
  today?: string
}

export function DatePicker({
  value,
  onChange,
  label,
  hint,
  error,
  errorMessageId,
  disabled,
  today,
}: DatePickerProps) {
  const id = useId()
  const [text, setText] = useState(() => (value ? formatDate(value) : ''))
  const [formatError, setFormatError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => isoToDate(value ?? today ?? '') ?? new Date())

  // Dışarıdan değer değişince (form sıfırlama, başka satır seçme) metni eşitle.
  useEffect(() => {
    setText(value ? formatDate(value) : '')
    setFormatError(null)
  }, [value])

  const wrapRef = useDismiss(open, () => setOpen(false))

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setFormatError(null)
      onChange(null)
      return
    }
    const iso = parseDateTr(trimmed)
    if (!iso) {
      setFormatError(tr.form.dateInvalid)
      return
    }
    setFormatError(null)
    setText(formatDate(iso))
    onChange(iso)
  }

  const pick = (iso: string) => {
    setFormatError(null)
    setText(formatDate(iso))
    onChange(iso)
    setOpen(false)
  }

  const shownError = error ?? formatError ?? undefined
  const invalid = Boolean(shownError || errorMessageId)

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <FieldShell label={label} hint={hint} error={shownError} htmlFor={id}>
        <div className={styles.inputRow}>
          <input
            id={id}
            className={[
              fieldStyles.control,
              styles.grow,
              invalid ? fieldStyles.invalid : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            value={text}
            placeholder={tr.form.datePlaceholder}
            disabled={disabled}
            inputMode="numeric"
            aria-invalid={invalid ? true : undefined}
            aria-errormessage={shownError ? `${id}-error` : errorMessageId}
            onChange={(event) => setText(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit(text)
              }
            }}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setMonth(isoToDate(value ?? today ?? '') ?? new Date())
              setOpen((current) => !current)
            }}
            aria-label={tr.actions.openCalendar}
            aria-expanded={open}
            disabled={disabled}
          >
            {marks.caret}
          </Button>
        </div>
      </FieldShell>

      {open && (
        <MonthGrid
          month={month}
          selected={value}
          today={today}
          onMonthChange={setMonth}
          onPick={pick}
        />
      )}
    </div>
  )
}

interface MonthGridProps {
  month: Date
  selected: string | null
  today?: string
  onMonthChange: (date: Date) => void
  onPick: (iso: string) => void
}

/**
 * Ay ızgarası. Hafta **Pazartesi** başlar (Türkiye). Bütün hesap `Date.UTC` üzerinde —
 * yerel saat kullanılsaydı yaz saati geçiş gününde bir gün kayardı.
 */
function MonthGrid({ month, selected, today, onMonthChange, onPick }: MonthGridProps) {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1))
  // getUTCDay: Pazar 0. Pazartesi başlangıçlı ızgarada Pazar 6. sütun.
  const leading = (firstOfMonth.getUTCDay() + 6) % 7

  // 6 satır × 7 gün — ayın uzunluğu değişse de ızgara zıplamıyor.
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex, 1 - leading + index))
    return {
      iso: dateToIso(date),
      day: date.getUTCDate(),
      outside: date.getUTCMonth() !== monthIndex,
    }
  })

  const shift = (delta: number) => onMonthChange(new Date(Date.UTC(year, monthIndex + delta, 1)))

  return (
    <div className={styles.panel} role="dialog" aria-label={tr.actions.openCalendar}>
      <div className={styles.monthHead}>
        <Button variant="icon" onClick={() => shift(-1)} aria-label={tr.actions.prev}>
          {marks.prev}
        </Button>
        <span className={styles.monthLabel}>
          {tr.dates.months[monthIndex]} {year}
        </span>
        <Button variant="icon" onClick={() => shift(1)} aria-label={tr.actions.next}>
          {marks.next}
        </Button>
      </div>

      <div className={styles.weekRow} aria-hidden="true">
        {tr.dates.weekdaysShortMonFirst.map((name) => (
          <span key={name} className={styles.weekLabel}>
            {name}
          </span>
        ))}
      </div>

      <div className={styles.dayGrid}>
        {days.map((entry) => (
          <button
            key={entry.iso}
            type="button"
            className={[
              styles.day,
              entry.outside ? styles.dayOutside : undefined,
              entry.iso === today ? styles.dayToday : undefined,
              entry.iso === selected ? styles.daySelected : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            /* Görünen metin gün numarası; erişilebilir ad tam tarih — ekran okuyucu
               "3" değil "03.07.2026" duyar, ızgaradaki tekrar eden numaralar da
               birbirinden ayrılır. */
            aria-label={formatDate(entry.iso)}
            aria-current={entry.iso === selected ? 'date' : undefined}
            onClick={() => onPick(entry.iso)}
          >
            {entry.day}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface TimePickerProps {
  /** `'HH:MM'` ya da `null`. */
  value: string | null
  onChange: (time: string | null) => void
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
}

export function TimePicker({
  value,
  onChange,
  label,
  hint,
  error,
  disabled,
}: TimePickerProps) {
  const id = useId()
  const [text, setText] = useState(() => (value ? formatTime(value) : ''))
  const [formatError, setFormatError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setText(value ? formatTime(value) : '')
    setFormatError(null)
  }, [value])

  const wrapRef = useDismiss(open, () => setOpen(false))

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setFormatError(null)
      onChange(null)
      return
    }
    const time = parseTimeTr(trimmed)
    if (!time) {
      setFormatError(tr.form.timeInvalid)
      return
    }
    setFormatError(null)
    setText(time)
    onChange(time)
  }

  const slots: string[] = []
  for (let minutes = FIRST_SLOT_MIN; minutes <= LAST_SLOT_MIN; minutes += SLOT_STEP_MIN) {
    const slot = minutesToTime(minutes)
    if (slot) slots.push(slot)
  }

  const shownError = error ?? formatError ?? undefined

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <FieldShell label={label} hint={hint} error={shownError} htmlFor={id}>
        <div className={styles.inputRow}>
          <input
            id={id}
            className={[
              fieldStyles.control,
              styles.grow,
              shownError ? fieldStyles.invalid : undefined,
            ]
              .filter(Boolean)
              .join(' ')}
            value={text}
            placeholder={tr.form.timePlaceholder}
            disabled={disabled}
            inputMode="numeric"
            aria-invalid={shownError ? true : undefined}
            onChange={(event) => setText(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit(text)
              }
            }}
          />
          <Button
            variant="ghost"
            onClick={() => setOpen((current) => !current)}
            aria-label={tr.actions.openClock}
            aria-expanded={open}
            disabled={disabled}
          >
            {marks.caret}
          </Button>
        </div>
      </FieldShell>

      {open && (
        <div className={styles.panel} role="dialog" aria-label={tr.actions.openClock}>
          <div className={styles.slots}>
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                className={[styles.slot, slot === value ? styles.slotSelected : undefined]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setFormatError(null)
                  setText(slot)
                  onChange(slot)
                  setOpen(false)
                }}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
