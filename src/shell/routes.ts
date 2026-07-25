import { tr } from '../i18n/tr'

/**
 * Rota ve menü tablosu — `docs/EKRANLAR.md` §Gezinme.
 *
 * Yollar Türkçe ve şapkasız: kurs sahibi adres çubuğunu görmüyor ama yol adları
 * loglarda ve hata ayıklamada okunuyor; `ogrenciler` `students`'tan daha az kafa
 * karıştırıyor. Şapkalı harf kullanılmıyor — yüzde kodlaması gereksiz gürültü.
 */
export interface PageDef {
  path: string
  title: string
  subtitle: string
  /** Sayfanın içeriği hangi fazda gelecek — placeholder metninde gösterilir. */
  phase: number
}

export const PAGES: readonly PageDef[] = [
  { path: '/', title: tr.pages.today.title, subtitle: tr.pages.today.subtitle, phase: 4 },
  {
    path: '/takvim',
    title: tr.pages.calendar.title,
    subtitle: tr.pages.calendar.subtitle,
    phase: 5,
  },
  {
    path: '/ogrenciler',
    title: tr.pages.students.title,
    subtitle: tr.pages.students.subtitle,
    phase: 4,
  },
  { path: '/gruplar', title: tr.pages.groups.title, subtitle: tr.pages.groups.subtitle, phase: 5 },
  {
    path: '/odemeler',
    title: tr.pages.payments.title,
    subtitle: tr.pages.payments.subtitle,
    phase: 8,
  },
  {
    path: '/tanimlar',
    title: tr.pages.definitions.title,
    subtitle: tr.pages.definitions.subtitle,
    phase: 5,
  },
  {
    path: '/raporlar',
    title: tr.pages.reports.title,
    subtitle: tr.pages.reports.subtitle,
    phase: 9,
  },
]

export interface NavItem {
  path: string
  label: string
  /** Rozet kaynağı. Şimdilik tek rozet var: borçlu öğrenci sayısı (Ödemeler). */
  badge?: 'debtors'
}

/**
 * Kenar çubuğu — 7 öğe. **Raporlar** tasarımın menüsünde yoktu; `EKRANLAR.md`'nin
 * (a) seçeneği onaylandı (PRD §9 S8), görsel dil değişmiyor, menüde yer vardı.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: tr.nav.today },
  { path: '/takvim', label: tr.nav.calendar },
  { path: '/ogrenciler', label: tr.nav.students },
  { path: '/gruplar', label: tr.nav.groups },
  { path: '/odemeler', label: tr.nav.payments, badge: 'debtors' },
  { path: '/tanimlar', label: tr.nav.definitions },
  { path: '/raporlar', label: tr.nav.reports },
]

/** Geliştirici rotaları — üretim derlemesinde yer almaz (`import.meta.env.DEV`). */
export const DEV_ROUTES = {
  showcase: '/dev/komponentler',
  status: '/dev/durum',
} as const

/**
 * Menü öğesi aktif mi. Detay rotaları da üst menüyü işaretler:
 * `/ogrenciler/42` → Öğrenciler aktif. Açılış sayfası ('/') yalnızca tam eşleşmede.
 */
export function isNavActive(itemPath: string, currentPath: string): boolean {
  if (itemPath === '/') return currentPath === '/'
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}
