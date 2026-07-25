import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { SidebarNav } from './SidebarNav'
import { isNavActive, NAV_ITEMS } from './routes'

/**
 * Kabuk testleri. `lib/api` taklit ediliyor: kabuk açılışta borçlu sayısını çekiyor ve
 * jsdom'da Tauri IPC'si yok — taklit olmadan her test konsola hata basardı ve rozetin
 * iki dalını (sayı var / yok) ayrı ayrı sınamak mümkün olmazdı.
 */
const fetchStudentDebts = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({ fetchStudentDebts }))

beforeEach(() => {
  fetchStudentDebts.mockReset()
  fetchStudentDebts.mockResolvedValue([])
  window.location.hash = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isNavActive', () => {
  it('açılış sayfası yalnızca tam eşleşmede aktif', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/', '/ogrenciler')).toBe(false)
  })

  it('detay rotası üst menü öğesini işaretler', () => {
    // Faz 4'te /ogrenciler/42 açıldığında kullanıcı hangi bölümde olduğunu görmeli.
    expect(isNavActive('/ogrenciler', '/ogrenciler/42')).toBe(true)
    expect(isNavActive('/ogrenciler', '/ogrenciler')).toBe(true)
    // Ön ek benzerliği yetmez: /odemeler ile /odemelerx aynı bölüm değil.
    expect(isNavActive('/odemeler', '/odemelerx')).toBe(false)
  })
})

describe('SidebarNav', () => {
  it('EKRANLAR.md’deki 7 menü öğesini çizer', () => {
    render(<SidebarNav currentPath="/" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(7)
    expect(links.map((link) => link.textContent)).toEqual([
      'Bugün',
      'Takvim',
      'Öğrenciler',
      'Gruplar',
      'Ödemeler',
      'Tanımlar',
      'Raporlar',
    ])
  })

  it('menü öğeleri gerçek hash bağlantısı — klavye ve geçmiş kendiliğinden çalışır', () => {
    render(<SidebarNav currentPath="/" />)
    expect(screen.getByRole('link', { name: 'Öğrenciler' }).getAttribute('href')).toBe(
      '#/ogrenciler',
    )
  })

  it('aktif öğe aria-current taşır, diğerleri taşımaz', () => {
    render(<SidebarNav currentPath="/ogrenciler/42" />)
    expect(screen.getByRole('link', { name: 'Öğrenciler' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('link', { name: 'Bugün' }).hasAttribute('aria-current')).toBe(false)
  })

  it('borçlu rozeti yalnızca sayı sıfırdan büyükken çıkar', () => {
    const { rerender } = render(<SidebarNav currentPath="/" debtorCount={3} />)
    expect(screen.getByRole('link', { name: /Ödemeler/ }).textContent).toContain('3')

    // 0 borçlu iyi haber; rozet göstermek gereksiz gürültü.
    rerender(<SidebarNav currentPath="/" debtorCount={0} />)
    expect(screen.getByRole('link', { name: /Ödemeler/ }).textContent).not.toContain('0')

    // Veri okunamadı — kullanıcıya teknik hata göstermiyoruz, rozet hiç çıkmıyor.
    rerender(<SidebarNav currentPath="/" />)
    expect(screen.getByRole('link', { name: /Ödemeler/ }).textContent?.trim()).toBe('Ödemeler')
  })

  it('rozet ekran okuyucuya ne olduğunu söyler', () => {
    render(<SidebarNav currentPath="/" debtorCount={3} />)
    expect(screen.getByText('3 borçlu öğrenci')).toBeTruthy()
  })
})

describe('AppShell', () => {
  it('Ctrl K global aramayı açar, Esc kapatır', () => {
    render(
      <AppShell currentPath="/">
        <p>içerik</p>
      </AppShell>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('macOS’ta Cmd K de açar', () => {
    render(
      <AppShell currentPath="/">
        <p>içerik</p>
      </AppShell>,
    )
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('atlama düğmesi odağı ana içeriğe taşır', () => {
    // `<a href="#icerik">` kullanılamıyor: hash yönlendirmesini bozardı (ADR-023).
    render(
      <AppShell currentPath="/">
        <p>içerik</p>
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'İçeriğe geç' }))
    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('borçlu sayısı okunamazsa kabuk çalışmaya devam eder', async () => {
    fetchStudentDebts.mockRejectedValue({ code: 'unknown', message: 'olmadı' })

    render(
      <AppShell currentPath="/odemeler">
        <p>içerik</p>
      </AppShell>,
    )
    // Reddedilen sözün etkisi işlensin.
    await act(async () => {})

    expect(screen.getByText('içerik')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Ödemeler/ }).textContent?.trim()).toBe('Ödemeler')
  })

  it('borçlu sayısı gelince rozet çıkar', async () => {
    fetchStudentDebts.mockResolvedValue([
      { studentId: 1, debtKurus: 120000, oldestDueOn: '2026-07-01' },
      { studentId: 2, debtKurus: 80000, oldestDueOn: '2026-07-10' },
    ])

    render(
      <AppShell currentPath="/odemeler">
        <p>içerik</p>
      </AppShell>,
    )
    await act(async () => {})

    expect(screen.getByRole('link', { name: /Ödemeler/ }).textContent).toContain('2')
  })
})

describe('NAV_ITEMS', () => {
  it('tek rozet kaynağı var: Ödemeler', () => {
    const withBadge = NAV_ITEMS.filter((item) => item.badge !== undefined)
    expect(withBadge).toHaveLength(1)
    expect(withBadge[0]?.path).toBe('/odemeler')
  })
})
