import type { ReactNode } from 'react'
import styles from './Shell.module.css'

export interface PageHeaderProps {
  title: string
  /** Alt satır: "Tüm kayıtlı öğrenciler ve durumları" ya da `25.07.2026 · Cumartesi`. */
  subtitle?: ReactNode
  /** Sağdaki arama kutusu. */
  search?: ReactNode
  /** Sağdaki birincil eylem — ekranda TEK tane (TASARIM-SISTEMI §1.4). */
  action?: ReactNode
}

/** TASARIM-SISTEMI §6/3. */
export function PageHeader({ title, subtitle, search, action }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
      </div>
      {(search ?? action) && (
        <div className={styles.pageHeaderRight}>
          {search}
          {action}
        </div>
      )}
    </header>
  )
}

export interface StatusBarProps {
  /** Solda sayaç: "12 öğrenci gösteriliyor · 14 kayıt". */
  left?: ReactNode
  /** Sağda toplam: "Toplam alacak 2.450 ₺". */
  right?: ReactNode
}

/** TASARIM-SISTEMI §6/5 — alt bilgi çubuğu. */
export function StatusBar({ left, right }: StatusBarProps) {
  return (
    <div className={styles.statusBar}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}
