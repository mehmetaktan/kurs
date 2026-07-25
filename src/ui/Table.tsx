import type { CSSProperties, ReactNode } from 'react'
import styles from './Table.module.css'

export interface Column<T> {
  /** React key ve test seçicisi. */
  key: string
  header: string
  /** CSS Grid track'i: `'150px'`, `'minmax(160px,1.6fr)'`, `'96px'`. */
  width: string
  /** Sayı kolonları sağa hizalanır (TASARIM-SISTEMI §6/14). */
  align?: 'start' | 'end'
  render: (row: T) => ReactNode
}

export interface TableProps<T> {
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string | number
  /** Satırın tamamı tıklanabilir olur; içindeki düğmeler tıklamayı yutmaz (aşağıya bak). */
  onRowClick?: (row: T) => void
  /** Amber zemin + sol şerit — "yoklama girilmedi" gibi dikkat isteyen satırlar. */
  rowAttention?: (row: T) => boolean
  stickyHeader?: boolean
  /** Satır yoksa gösterilecek içerik (`EmptyState`). Verilmezse başlık da çizilmez. */
  emptyState?: ReactNode
  /** Ekran okuyucu için tablonun adı. */
  label: string
}

/**
 * TASARIM-SISTEMI §6/14 — veri tablosu.
 *
 * Satır tıklaması: tasarımda satırın tamamı tıklanabilir ve içindeki "Tahsilat al"
 * düğmesi `stopPropagation` yapıyor. Bunu her çağırana bırakmak yerine tablo kendisi
 * kontrol ediyor — bir yerde unutulduğunda kullanıcı tahsilat alırken çekmece de açılır.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowAttention,
  stickyHeader = false,
  emptyState,
  label,
}: TableProps<T>) {
  const template: CSSProperties = {
    gridTemplateColumns: columns.map((column) => column.width).join(' '),
  }

  if (rows.length === 0 && emptyState) {
    return <div className={styles.empty}>{emptyState}</div>
  }

  return (
    <div className={styles.table} role="table" aria-label={label}>
      <div
        className={[styles.head, stickyHeader ? styles.headSticky : undefined]
          .filter(Boolean)
          .join(' ')}
        style={template}
        role="row"
      >
        {columns.map((column) => (
          <div
            key={column.key}
            role="columnheader"
            className={[styles.cell, column.align === 'end' ? styles.alignEnd : undefined]
              .filter(Boolean)
              .join(' ')}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={rowKey(row)}
          role="row"
          className={[
            styles.row,
            onRowClick ? styles.rowClickable : undefined,
            rowAttention?.(row) ? styles.rowAttention : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
          style={template}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={(event) => {
            if (!onRowClick) return
            // Satırın içindeki düğme/bağlantı kendi işini yapar, satırı açmaz.
            if ((event.target as HTMLElement).closest('button, a, input, select')) return
            onRowClick(row)
          }}
          onKeyDown={(event) => {
            if (!onRowClick) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            if (event.target !== event.currentTarget) return
            event.preventDefault()
            onRowClick(row)
          }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              role="cell"
              className={[styles.cell, column.align === 'end' ? styles.alignEnd : undefined]
                .filter(Boolean)
                .join(' ')}
            >
              {column.render(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
