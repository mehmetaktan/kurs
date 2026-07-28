import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { tr } from '../i18n/tr'
import { fetchStudentDebts } from '../lib/api'
import { GlobalSearch } from './GlobalSearch'
import { Onboarding } from './Onboarding'
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
    const refreshDebtorCount = () => fetchStudentDebts()
      .then((debts) => {
        if (!cancelled) setDebtorCount(debts.length)
      })
      .catch(() => {
        if (!cancelled) setDebtorCount(undefined)
      })
    void refreshDebtorCount()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshDebtorCount()
    }
    const onChanged = () => void refreshDebtorCount()
    window.addEventListener('focus', onChanged)
    window.addEventListener('kurs:debts-changed', onChanged)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onChanged)
      window.removeEventListener('kurs:debts-changed', onChanged)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [currentPath])

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
        <ScreenHelp currentPath={currentPath} />
      </main>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Onboarding currentPath={currentPath} />
    </div>
  )
}

export function screenHelpText(path: string): string {
  if (path === '/') return tr.help.screens.today
  if (path.startsWith('/takvim')) return tr.help.screens.calendar
  if (path.startsWith('/ogrenciler')) return tr.help.screens.students
  if (path.startsWith('/gruplar')) return tr.help.screens.groups
  if (path.startsWith('/odemeler')) return tr.help.screens.payments
  if (path.startsWith('/tanimlar')) return tr.help.screens.definitions
  if (path.startsWith('/raporlar')) return tr.help.screens.reports
  return tr.help.screens.fallback
}

function ScreenHelp({ currentPath }: { currentPath: string }) {
  return (
    <aside className={styles.screenHelp} aria-label={tr.help.label}>
      <strong>{tr.help.prefix}</strong> {screenHelpText(currentPath)}
    </aside>
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
