import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { marks } from './marks'
import styles from './Controls.module.css'

/** Klavye tuşu rozeti: `Ctrl K`, `Esc`, `←`. */
export function Kbd({ children }: { children: ReactNode }) {
  return <span className={styles.kbd}>{children}</span>
}

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Sağdaki ipucu: `Ctrl K` ya da `↵ aç`. Boşsa ipucu çıkmaz. */
  hint?: ReactNode
}

/**
 * TASARIM-SISTEMI §6/7. `type="search"` kullanılmıyor: WebKit onu kendi temizleme
 * düğmesiyle çiziyor ve tasarımın sağ tarafındaki ipucunun üstüne biniyor.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ hint, className, ...rest }, ref) {
    return (
      <div className={styles.searchWrap}>
        <input
          ref={ref}
          type="text"
          className={[styles.search, className].filter(Boolean).join(' ')}
          {...rest}
        />
        {hint && (
          <span className={styles.searchHint} aria-hidden="true">
            <Kbd>{hint}</Kbd>
          </span>
        )}
      </div>
    )
  },
)

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Ekran okuyucu için grubun adı — "Görünüm", "Yoklama durumu" gibi. */
  label: string
}

/**
 * Hafta | Gün · Nakit/Kart/Havale · Geldi/Mazeretli/Mazeretsiz/İptal.
 *
 * `radiogroup` rolü veriliyor: klavyeyle ok tuşlarıyla dolaşmak yerine Tab ile her
 * seçeneğe girilir — teknik olmayan kullanıcı için ok tuşu davranışı tahmin edilemez.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.segment} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={[styles.segmentItem, active ? styles.segmentActive : undefined]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export interface StepperGroupProps {
  onPrev: () => void
  onNext: () => void
  onCenter: () => void
  centerLabel: string
  prevLabel: string
  nextLabel: string
  disabled?: boolean
}

/** `‹ Bugün ›` — takvim üst çubuğu (TASARIM-SISTEMI §6/10). */
export function StepperGroup({
  onPrev,
  onNext,
  onCenter,
  centerLabel,
  prevLabel,
  nextLabel,
  disabled = false,
}: StepperGroupProps) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepperArrow}
        onClick={onPrev}
        aria-label={prevLabel}
        disabled={disabled}
      >
        {marks.prev}
      </button>
      <button
        type="button"
        className={styles.stepperCenter}
        onClick={onCenter}
        disabled={disabled}
      >
        {centerLabel}
      </button>
      <button
        type="button"
        className={styles.stepperArrow}
        onClick={onNext}
        aria-label={nextLabel}
        disabled={disabled}
      >
        {marks.next}
      </button>
    </div>
  )
}

export interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  /** Sayı `0` ise gösterilmez — tasarımdaki `showCount: count > 0` davranışı. */
  count?: number
  disabled?: boolean
}

export function FilterChip({ label, active, onClick, count, disabled }: FilterChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, active ? styles.chipActive : undefined]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {count !== undefined && count > 0 && <span className={styles.chipCount}>{count}</span>}
    </button>
  )
}

/** Çipleri yatay saran satır. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.chipRow}>{children}</div>
}
