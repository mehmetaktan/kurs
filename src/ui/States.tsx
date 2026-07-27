import { useState, type ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { Button } from './Button'
import { marks } from './marks'
import styles from './Overlay.module.css'

/**
 * Her liste dört durum taşır (TASARIM-SISTEMI §7): dolu · ilk kullanım · filtre
 * sonuçsuz · arama sonuçsuz. Üçü de **farklı metin** gösterir — "sonuç yok" üç ayrı
 * sebebi aynı cümleyle anlatırsa kullanıcı ne yapacağını bilemez.
 */
export type EmptyKind = 'first-use' | 'no-filter-results' | 'no-search-results'

export interface EmptyStateProps {
  kind?: EmptyKind
  title: string
  body?: string
  /** Birincil eylem — ilk kullanımda "Yeni öğrenci ekle" gibi. */
  action?: ReactNode
  /** İkincil eylem — "Filtreyi temizle", "Tümünü göster". */
  secondaryAction?: ReactNode
}

export function EmptyState({
  kind = 'first-use',
  title,
  body,
  action,
  secondaryAction,
}: EmptyStateProps) {
  // İlk kullanımda "ekle", arama/filtre sonuçsuzluğunda "ara" işareti.
  const icon = kind === 'first-use' ? marks.add : marks.search

  return (
    <div className={styles.state}>
      <span className={styles.stateIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.stateTitle}>{title}</div>
      {body && <p className={styles.stateBody}>{body}</p>}
      {(action ?? secondaryAction) && (
        <div className={styles.stateActions}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}

/** Yükleniyor. Metin `tr.states.loading` — her listede aynı cümle. */
export function LoadingState({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className={styles.stateInline} role="status" aria-live="polite">
        {tr.states.loading}
      </div>
    )
  }
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <div className={styles.stateTitle}>{tr.states.loading}</div>
    </div>
  )
}

export interface ErrorStateProps {
  /** Rust'tan gelen Türkçe, eylem öneren mesaj. Ham hata kodu GÖSTERİLMEZ. */
  message: string
  onRetry?: () => void
  title?: string
  inline?: boolean
  /** Beklenmeyen hatanın teknik ayrıntısı; ekrana basılmaz, yalnız panoya kopyalanır. */
  details?: string
}

export function ErrorState({
  message,
  onRetry,
  title = tr.states.errorTitle,
  inline = false,
  details,
}: ErrorStateProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copyDetails = async () => {
    if (!details) return
    try {
      await navigator.clipboard.writeText(details)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const detailAction = details ? (
    <Button size="small" onClick={() => void copyDetails()}>
      {copyState === 'copied'
        ? tr.actions.detailsCopied
        : copyState === 'failed'
          ? tr.actions.detailsCopyFailed
          : tr.actions.copyDetails}
    </Button>
  ) : null

  if (inline) {
    return (
      <div className={[styles.stateInline, styles.stateInlineError].join(' ')} role="alert">
        {message}
        {(onRetry ?? detailAction) && (
          <div className={styles.stateActions}>
            {onRetry && (
              <Button size="small" onClick={onRetry}>
                {tr.actions.retry}
              </Button>
            )}
            {detailAction}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.state} role="alert">
      <span className={styles.stateIcon} aria-hidden="true">
        {marks.conflict}
      </span>
      <div className={styles.stateTitle}>{title}</div>
      <p className={styles.stateBody}>{message}</p>
      {(onRetry ?? detailAction) && (
        <div className={styles.stateActions}>
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              {tr.actions.retry}
            </Button>
          )}
          {detailAction}
        </div>
      )}
    </div>
  )
}
