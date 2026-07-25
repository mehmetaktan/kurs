import { useId } from 'react'
import type { ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { Button } from './Button'
import { marks } from './marks'
import { useDialog } from './useDialog'
import styles from './Overlay.module.css'

export interface DrawerProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Başlığın solundaki avatar gibi sabit öğe. */
  leading?: ReactNode
  /** Alt eylem çubuğu — kaydırılmaz, daima görünür. */
  footer?: ReactNode
}

/**
 * TASARIM-SISTEMI §6/29 — sağdan 396px çekmece: başlık / kaydırılan gövde / sabit
 * eylem çubuğu.
 *
 * Zemine tıklamak kapatır (tasarımda böyle): çekmece bir özet, form değil.
 * Formlar `Modal` kullanıyor ve orada zemin tıklaması kapatmıyor.
 */
export function Drawer({ open, title, onClose, children, leading, footer }: DrawerProps) {
  const titleId = useId()
  const containerRef = useDialog(open, onClose)

  if (!open) return null

  return (
    <div
      className={styles.scrimRight}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={containerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.drawerHead}>
          {leading}
          <div className={styles.drawerTitle} id={titleId}>
            {title}
          </div>
          <Button variant="icon" onClick={onClose} aria-label={tr.actions.close}>
            {marks.closeSmall}
          </Button>
        </div>

        <div className={styles.drawerBody}>{children}</div>

        {footer && <div className={styles.drawerFoot}>{footer}</div>}
      </div>
    </div>
  )
}
