import { lazy, Suspense } from 'react'
import { resolveRoute, useRoute } from './lib/router'
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage'
import { AppShell } from './shell/AppShell'
import { DEV_ROUTES, PAGES } from './shell/routes'
import { LoadingState, ToastProvider } from './ui'

/**
 * Uygulama kökü: yönlendirme + kabuk.
 *
 * **Geliştirici sayfaları üretim derlemesine girmez.** `import.meta.env.DEV` üretimde
 * `false` sabitine dönüşüyor, ölü dal eleniyor ve `import()` hiç ulaşılamaz hâle geldiği
 * için Rollup o chunk'ı üretmiyor. Kanıtı `npm run web:build` sonrası `dist/` içinde
 * showcase işaretçisinin bulunmaması (bkz. `docs/DURUM.md`).
 */
const DevShowcase = import.meta.env.DEV ? lazy(() => import('./dev/Showcase')) : null
const DevStatus = import.meta.env.DEV ? lazy(() => import('./dev/Status')) : null

export default function App() {
  const route = useRoute()

  return (
    <ToastProvider>
      <AppShell currentPath={route.path}>
        <Suspense fallback={<LoadingState />}>
          <RoutedPage path={route.path} />
        </Suspense>
      </AppShell>
    </ToastProvider>
  )
}

function RoutedPage({ path }: { path: string }) {
  if (DevShowcase && path === DEV_ROUTES.showcase) return <DevShowcase />
  if (DevStatus && path === DEV_ROUTES.status) return <DevStatus />

  const match = resolveRoute(PAGES, path)
  if (!match) return <NotFoundPage />

  return <PlaceholderPage page={match.route} />
}
