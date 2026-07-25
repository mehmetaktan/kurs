import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { fetchStudentDebts } from '../lib/api'
import { GlobalSearch } from './GlobalSearch'
import { SidebarNav } from './SidebarNav'
import styles from './Shell.module.css'

export interface AppShellProps {
  currentPath: string
  children: ReactNode
}

/**
 * TASARIM-SISTEMI §6/1 — 216px kenar çubuğu + esnek ana alan, `100vh`, `min-width:1280px`.
 *
 * Kabuğun iki işi var: gezinme ve `Ctrl K`. Sayfa içeriği `children` olarak geliyor.
 */
export function AppShell({ currentPath, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [debtorCount, setDebtorCount] = useState<number | undefined>(undefined)
  const mainRef = useRef<HTMLElement>(null)

  // Ctrl K / Cmd K — tasarımda iki ekranda ipucu olarak yazılı.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * Ödemeler rozeti: borçlu öğrenci sayısı, defterden (ADR-018 + ADR-022).
   *
   * Hata **yutuluyor** ve rozet çıkmıyor: bu bir yan bilgi, kullanıcının o an yaptığı
   * işle ilgisi yok. Tarayıcıda (`npm run web:dev`) Tauri IPC'si olmadığı için burada
   * daima hata gelir — kabuk buna rağmen çalışmaya devam etmeli.
   */
  useEffect(() => {
    let cancelled = false
    fetchStudentDebts()
      .then((debts) => {
        if (!cancelled) setDebtorCount(debts.length)
      })
      .catch(() => {
        if (!cancelled) setDebtorCount(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.shell}>
      {/*
        Atlama bağlantısı `<a href="#icerik">` DEĞİL, düğme: uygulama hash tabanlı
        yönlendirme kullanıyor (ADR-023) ve `#icerik` yazmak rotayı bozardı.
      */}
      <button
        type="button"
        className={styles.skip}
        onClick={() => mainRef.current?.focus()}
      >
        {tr.app.skipToContent}
      </button>

      <SidebarNav currentPath={currentPath} debtorCount={debtorCount} />

      <main className={styles.main} id="icerik" ref={mainRef} tabIndex={-1}>
        {children}
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

/** Kaydırılan içerik alanı — `space-7` yatay dolgu, max 1320px. */
export function PageContent({ children }: { children: ReactNode }) {
  return (
    <div className={styles.content}>
      <div className={styles.contentInner}>{children}</div>
    </div>
  )
}
