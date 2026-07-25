import { useId } from 'react'
import type { ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { useDialog } from './useDialog'
import styles from './Overlay.module.css'

export interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  /** Başlığın altındaki açıklama — `text-wrap: pretty` ile. */
  description?: string
  /** Dikey eylem düğmeleri. */
  actions?: ReactNode
  /** Alttaki "Vazgeç" bağlantısı. `false` verilirse çıkmaz. */
  dismissLabel?: string | false
}

/**
 * TASARIM-SISTEMI §6/28 — 384px, ortalanmış modal.
 *
 * Zemine tıklamak kapatmıyor: modallarımızın çoğu form ve yanlışlıkla dışına tıklayan
 * kullanıcı yazdıklarını kaybederdi. Kapatma yolları `Esc` ve "Vazgeç".
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  description,
  actions,
  dismissLabel = tr.actions.cancel,
}: ModalProps) {
  const titleId = useId()
  const containerRef = useDialog(open, onClose)

  if (!open) return null

  return (
    <div className={styles.scrimCenter}>
      <div
        ref={containerRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.modalTitle} id={titleId}>
          {title}
        </div>
        {description && <p className={styles.description}>{description}</p>}
        {children && <div className={styles.modalBody}>{children}</div>}
        {actions && <div className={styles.modalActions}>{actions}</div>}
        {dismissLabel !== false && (
          <div className={styles.modalDismiss}>
            <button type="button" className={styles.linkButton} onClick={onClose}>
              {dismissLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export interface ModalOptionProps {
  title: string
  hint?: string
  tone?: 'primary' | 'secondary' | 'danger'
  onClick: () => void
}

/** Modal içindeki dikey seçenek düğmesi: başlık + alt açıklama (Takvim onay modalı). */
export function ModalOption({ title, hint, tone = 'secondary', onClick }: ModalOptionProps) {
  const shell = {
    primary: styles.optionPrimary,
    secondary: styles.optionSecondary,
    danger: styles.optionDanger,
  }[tone]
  const titleTone = {
    primary: styles.optionTitlePrimary,
    secondary: styles.optionTitleSecondary,
    danger: styles.optionTitleDanger,
  }[tone]
  const hintTone = {
    primary: styles.optionHintPrimary,
    secondary: styles.optionHintSecondary,
    danger: styles.optionHintDanger,
  }[tone]

  return (
    <button
      type="button"
      className={[styles.optionButton, shell].join(' ')}
      onClick={onClick}
    >
      <span className={[styles.optionTitle, titleTone].join(' ')}>{title}</span>
      {hint && <span className={[styles.optionHint, hintTone].join(' ')}>{hint}</span>}
    </button>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Ne olacağını anlatan cümle. Yıkıcı işlemde sonucu açıkça söyler. */
  description: string
  confirmLabel: string
  /** Onay düğmesinin altındaki açıklama. */
  confirmHint?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Her yıkıcı işlemde onay diyaloğu (CLAUDE.md > Arayüz). `ModalOption` kullanıyor:
 * onay düğmesi ne yapacağını kendi üstünde yazıyor, "Emin misiniz? / Evet" değil.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmHint,
  cancelLabel = tr.actions.cancel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      dismissLabel={cancelLabel}
      actions={
        <ModalOption
          title={confirmLabel}
          hint={confirmHint}
          tone={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
        />
      }
    />
  )
}
