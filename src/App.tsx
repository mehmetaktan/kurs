import { lazy, Suspense } from 'react'
import { matchRoute, resolveRoute, useRoute } from './lib/router'
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage'
import { GroupDetailPage } from './pages/gruplar/GroupDetailPage'
import { GroupsPage } from './pages/gruplar/GroupsPage'
import { StudentDetailPage } from './pages/ogrenciler/StudentDetailPage'
import { StudentsPage } from './pages/ogrenciler/StudentsPage'
import { DefinitionsPage } from './pages/tanimlar/DefinitionsPage'
import { AppShell } from './shell/AppShell'
import { DEFINITIONS_PATH, DEV_ROUTES, GROUPS_PATH, PAGES, STUDENTS_PATH } from './shell/routes'
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

  // Sıra bağlayıcı: SABİT yollar parametreli yollardan ÖNCE. Ters sırada
  // `/ogrenciler/yeni` gibi bir adres `:id = 'yeni'` olarak eşleşirdi (router.ts).
  if (matchRoute(STUDENTS_PATH, path)) return <StudentsPage />
  if (matchRoute(GROUPS_PATH, path)) return <GroupsPage />
  if (matchRoute(DEFINITIONS_PATH, path)) return <DefinitionsPage />

  const student = matchRoute(`${STUDENTS_PATH}/:id`, path)
  if (student) {
    const id = detailId(student.id)
    // `key`: farklı bir öğrenciye geçince bileşen sıfırdan kurulur — sekme seçimi ve
    // form durumu önceki öğrenciden taşınmasın.
    return id === null ? <NotFoundPage /> : <StudentDetailPage key={id} studentId={id} />
  }

  const group = matchRoute(`${GROUPS_PATH}/:id`, path)
  if (group) {
    const id = detailId(group.id)
    return id === null ? <NotFoundPage /> : <GroupDetailPage key={id} groupId={id} />
  }

  const match = resolveRoute(PAGES, path)
  if (!match) return <NotFoundPage />

  return <PlaceholderPage page={match.route} />
}

/**
 * `:id` parametresini kayıt numarasına çevirir. Sayı olmayan bir id "sayfa
 * bulunamadı"dır; `NaN` ile sorgu açmayız — Rust'a `null` gider ve hata mesajı
 * kullanıcının anlamadığı bir yerden çıkar.
 */
function detailId(raw: string | undefined): number | null {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
