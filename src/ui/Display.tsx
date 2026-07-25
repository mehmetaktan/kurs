import type { ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { Button } from './Button'
import { marks } from './marks'
import styles from './Display.module.css'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')}>{children}</div>
}

export type StatTone = 'default' | 'danger' | 'warn'

export interface StatCardProps {
  /** 11px büyük harf etiket: BAKİYE, DEVAM ORANI. */
  label: string
  /** Değer yoksa `—` çizilir (TASARIM-SISTEMI §6/15 boş varyantı). */
  value?: string | null
  tone?: StatTone
  caption?: string
  captionTone?: 'default' | 'warn'
  /** Sağ üstteki eylem — "Tahsilat al" gibi. */
  action?: ReactNode
}

export function StatCard({
  label,
  value,
  tone = 'default',
  caption,
  captionTone = 'default',
  action,
}: StatCardProps) {
  const empty = value === null || value === undefined || value === ''
  const valueClass = [
    styles.statValue,
    empty
      ? styles.statValueEmpty
      : tone === 'danger'
        ? styles.statValueDanger
        : tone === 'warn'
          ? styles.statValueWarn
          : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.statCard}>
      <div className={styles.statHead}>
        <span className={styles.statLabel}>{label}</span>
        {action}
      </div>
      <div className={valueClass}>{empty ? marks.empty : value}</div>
      {caption && (
        <div
          className={[
            styles.statCaption,
            captionTone === 'warn' ? styles.statCaptionWarn : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {caption}
        </div>
      )}
    </div>
  )
}

/** Dört kartlık özet şerit. Kolon oranları bağlayıcı (TASARIM-SISTEMI §8). */
export function StatStrip({ children }: { children: ReactNode }) {
  return <div className={styles.statStrip}>{children}</div>
}

export function SectionHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionTitle}>{title}</span>
      {meta && <span className={styles.sectionMeta}>{meta}</span>}
    </div>
  )
}

export type BadgeTone = 'danger' | 'warn' | 'neutral' | 'success'

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const toneClass = {
    danger: styles.badgeDanger,
    warn: styles.badgeWarn,
    neutral: styles.badgeNeutral,
    success: styles.badgeSuccess,
  }[tone]
  return <span className={[styles.badge, toneClass].join(' ')}>{children}</span>
}

export type DotTone = 'success' | 'warn' | 'danger' | 'neutral'

export interface StatusDotProps {
  tone: DotTone
  label: string
  /** İçi boş halka → pasif / iptal (TASARIM-SISTEMI §5). */
  hollow?: boolean
}

export function StatusDot({ tone, label, hollow = false }: StatusDotProps) {
  const toneClass = {
    success: styles.dotSuccess,
    warn: styles.dotWarn,
    danger: styles.dotDanger,
    neutral: styles.dotNeutral,
  }[tone]

  return (
    <span
      className={[styles.statusDot, hollow ? styles.statusDotMuted : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[styles.dot, hollow ? styles.dotHollow : toneClass].join(' ')}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

/** Baş harfler. Ad boşsa tire — "undefined" harfleri çizilmesin. */
export function Avatar({ name, size = 44 }: { name: string; size?: 44 | 46 | 52 }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0] ?? '')
      .slice(0, 2)
      .join('')
      .toLocaleUpperCase('tr') || marks.empty

  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size >= 52 ? 17 : 15 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}

/**
 * Sekmeler. `←` `→` ile sekme değiştirilir (TASARIM-SISTEMI §7) — `tablist` rolünün
 * beklediği klavye davranışı da bu, ikisi çakışmıyor.
 */
export function Tabs<T extends string>({ items, value, onChange, label }: TabsProps<T>) {
  const move = (delta: number) => {
    const index = items.findIndex((item) => item.value === value)
    if (index === -1) return
    const next = items[(index + delta + items.length) % items.length]
    if (next) onChange(next.value)
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          tabIndex={item.value === value ? 0 : -1}
          className={[styles.tab, item.value === value ? styles.tabActive : undefined]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              move(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              move(-1)
            }
          }}
        >
          {item.label}
          {item.count !== undefined && <span className={styles.tabCount}>{item.count}</span>}
        </button>
      ))}
    </div>
  )
}

export interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

/** Tasarımda yok; aynı görsel dilde üretildi (`‹ ›` + "Sayfa 2 / 7"). */
export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className={styles.pagination} role="navigation" aria-label={tr.pagination.label}>
      <Button
        variant="icon"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={tr.actions.prev}
      >
        {marks.prev}
      </Button>
      <span>
        {tr.pagination.pageOf} {page} {tr.pagination.of} {pageCount}
      </span>
      <Button
        variant="icon"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={tr.actions.next}
      >
        {marks.next}
      </Button>
    </div>
  )
}
