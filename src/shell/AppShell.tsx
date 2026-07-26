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

/**
 * Kaydırılan içerik alanı — `space-7` yatay dolgu, max 1320px.
 *
 * **`fill`: kaydırmayı çocuk devralır.** Takvim ızgarası kendi içinde kaydırmak zorunda
 * (gün başlıkları `sticky` kalsın ve açılışta "şimdi"ye kayabilsin — ADR-030'un DPI
 * maddesi). Sayfa kaydırıcısı açık kalsaydı iki kaydırıcı iç içe girerdi. Sarmalayıcıyı
 * tamamen atlamak da yanlış: `/faz-05c-karar`'ın iki denemesi doğrudan `main`'e bağlandı
 * ve **ikisi de kırpıldı**.
 */
export function PageContent({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div className={fill ? `${styles.content} ${styles.contentFill}` : styles.content}>
      <div className={fill ? `${styles.contentInner} ${styles.contentInnerFill}` : styles.contentInner}>
        {children}
      </div>
    </div>
  )
}
