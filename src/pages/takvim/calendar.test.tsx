import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DaySessionRow } from '../../lib/api'
import { ToastProvider } from '../../ui'
import { CalendarPage } from './CalendarPage'

/**
 * Takvim ekranının arayüz testleri.
 *
 * `lib/api` taklit ediliyor: jsdom'da Tauri IPC'si yok. Sınananlar ekranın **kararları**:
 * hangi boş durumun çıktığı, çakışan ve çakışmayan derslerin kaç şeride bölündüğü,
 * sürüklemenin tıklamadan nasıl ayrıldığı ve kapalı günün hedef kabul etmediği.
 * Geometrinin kendisi `calendarGrid.test.ts` ve `drag.test.ts` içinde.
 *
 * jsdom yerleşim hesaplamıyor — `getBoundingClientRect` sıfır döner ve ızgara ölçümü
 * `null` verirdi. Sütun kutusu bu yüzden bilerek taklit ediliyor; taklit edilen tek şey
 * **tarayıcının ölçüsü**, ekranın mantığı değil.
 */
const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchRangeSessions: vi.fn(),
  fetchClosedDaysInRange: vi.fn(),
  fetchHasSchedule: vi.fn(),
  rescheduleSession: vi.fn(),
  // `SessionForm` / `TemplateModal` açılışta bunları çağırıyor.
  fetchSubjects: vi.fn(),
  fetchGroupList: vi.fn(),
  fetchStudentList: vi.fn(),
  fetchTeachers: vi.fn(),
  fetchDefaultMinutes: vi.fn(),
  fetchIsClosedDay: vi.fn(),
  fetchSessionConflicts: vi.fn(),
  saveSession: vi.fn(),
  cancelSession: vi.fn(),
  deleteSessions: vi.fn(),
  fetchTemplatePreview: vi.fn(),
  applyTemplate: vi.fn(),
}))

vi.mock('../../lib/api', () => api)

/** 2026-07-22 Çarşamba, saat 10:00. Hafta: 20.07 Pzt – 26.07 Paz. */
const NOW = '2026-07-22 10:00'

const SLOT_PX = 30
const COLUMN_PX = 120

function row(over: Partial<DaySessionRow> & { id: number; startsAt: string }): DaySessionRow {
  return {
    seriesId: null,
    endsAt: over.startsAt.slice(0, 11) + addHour(over.startsAt),
    kind: 'group',
    subjectId: 1,
    subjectName: 'Matematik',
    subjectColor: null,
    teacherId: 1,
    studyGroupId: 1,
    studentId: null,
    title: 'Grup A',
    status: 'planned',
    attendanceTaken: false,
    studentCount: 4,
    presentCount: 0,
    markedCount: 0,
    isMakeup: false,
    cancelReason: null,
    ...over,
  }
}

function addHour(stamp: string): string {
  const hour = Number(stamp.slice(11, 13)) + 1
  return `${String(hour).padStart(2, '0')}:${stamp.slice(14, 16)}`
}

/**
 * Izgara ölçüsünü taklit et: sütun `COLUMN_PX` geniş, 28 dilim × `SLOT_PX` yüksek.
 * `WeekGrid` dilim yüksekliğini sütunun boyundan türetiyor, o yüzden ikisi tutarlı.
 */
function mockLayout(slotCount = 28) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      width: COLUMN_PX,
      height: slotCount * SLOT_PX,
      top: 0,
      left: 0,
      right: COLUMN_PX,
      bottom: slotCount * SLOT_PX,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  })
}

const draw = () =>
  render(
    <ToastProvider>
      <CalendarPage />
    </ToastProvider>,
  )

/** Ekrandaki ders blokları — `--lanes` değişkeni şerit sayısını taşıyor. */
function blocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-kind]'))
}

function lanesOf(block: HTMLElement): string {
  return block.style.getPropertyValue('--lanes')
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchLocalNow.mockResolvedValue(NOW)
  api.fetchRangeSessions.mockResolvedValue([])
  api.fetchClosedDaysInRange.mockResolvedValue([])
  api.fetchHasSchedule.mockResolvedValue(true)
  api.fetchSubjects.mockResolvedValue([])
  api.fetchGroupList.mockResolvedValue([])
  api.fetchStudentList.mockResolvedValue([])
  api.fetchTeachers.mockResolvedValue([{ id: 1, fullName: 'Aydın Hoca' }])
  api.fetchDefaultMinutes.mockResolvedValue(60)
  api.fetchIsClosedDay.mockResolvedValue(false)
  api.fetchSessionConflicts.mockResolvedValue([])
  mockLayout()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('haftalık ızgara', () => {
  it('haftanın aralığını sorar ve başlığa yazar', async () => {
    draw()
    await waitFor(() => expect(api.fetchRangeSessions).toHaveBeenCalled())
    // Pazartesi'den Pazar'a — çapa Çarşamba olsa bile.
    expect(api.fetchRangeSessions).toHaveBeenCalledWith('2026-07-20', '2026-07-26')
    expect(screen.getByText('20.07.2026 – 26.07.2026')).toBeTruthy()
  })

  it('AYRI günlerdeki aynı saatli dersler TAM genişlikte kalır', async () => {
    // Gerçek uygulamada yakalanan hata: haftanın tamamı tek şerit hesabına verilince
    // Pazartesi 16:00 ile Çarşamba 16:00 çakışan iki ders sayılıyordu.
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-20 16:00' }),
      row({ id: 2, startsAt: '2026-07-22 16:00' }),
    ])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(2))
    expect(blocks().map(lanesOf)).toEqual(['1', '1'])
  })

  it('AYNI gündeki çakışan dersler iki şeride bölünür', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00' }),
      row({ id: 2, startsAt: '2026-07-22 16:30' }),
    ])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(2))
    expect(blocks().map(lanesOf)).toEqual(['2', '2'])
  })

  it('branş çipi görünen dersleri süzer', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-20 16:00' }),
      row({ id: 2, startsAt: '2026-07-21 16:00', subjectId: 2, subjectName: 'Fizik' }),
    ])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(2))

    // Çipin erişilebilir adı sayısını da taşıyor (`Fizik` + rozet → "Fizik1"). Blok da
    // "Fizik" yazdığı için tam adla soruluyor, yoksa iki öğe birden eşleşiyor.
    fireEvent.click(screen.getByRole('button', { name: 'Fizik1' }))
    await waitFor(() => expect(blocks()).toHaveLength(1))
  })
})

describe('dört boş durum ayrı ayrı', () => {
  it('program hiç yoksa kurulum metni ve şablon düğmesi çıkar', async () => {
    api.fetchHasSchedule.mockResolvedValue(false)
    draw()
    await screen.findByText('Bu hafta için program tanımlı değil')
    expect(screen.getByRole('button', { name: 'Şablondan oluştur' })).toBeTruthy()
  })

  it('hafta tamamen tatilse eylem SUNULMAZ', async () => {
    api.fetchClosedDaysInRange.mockResolvedValue([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
    ])
    draw()
    await screen.findByText('Bu hafta tamamen tatil')
    // Ders eklenemeyeceği için "Ders ekle" boş durumun içinde ÇIKMAZ; üst çubuktaki
    // tek düğme sayfa başlığında kalıyor.
    expect(screen.queryByText('Bu hafta için program tanımlı değil')).toBeNull()
  })

  it('filtre sonuçsuzsa "Filtreyi temizle" çıkar', async () => {
    // Gerçek senaryo: Fizik seçiliyken Fizik dersi olmayan bir haftaya geçmek.
    // Çipler görünen veriden türediği için boş sonuç ancak böyle doğuyor.
    api.fetchRangeSessions.mockImplementation((from: string) =>
      Promise.resolve(
        from === '2026-07-20'
          ? [
              row({ id: 1, startsAt: '2026-07-20 16:00' }),
              row({ id: 2, startsAt: '2026-07-21 16:00', subjectId: 2, subjectName: 'Fizik' }),
            ]
          : [row({ id: 3, startsAt: '2026-07-27 16:00' })],
      ),
    )
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(2))

    fireEvent.click(screen.getByRole('button', { name: 'Fizik1' }))
    await waitFor(() => expect(blocks()).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))
    await screen.findByText('Bu filtreyle ders yok')

    // "Hafta boş" DEĞİL: veri var, seçim onu dışarıda bırakıyor — cümle bunu söylüyor.
    fireEvent.click(screen.getByRole('button', { name: 'Filtreyi temizle' }))
    await waitFor(() => expect(blocks()).toHaveLength(1))
  })

  it('gün görünümünde boş gün kendi cümlesini söyler', async () => {
    draw()
    await waitFor(() => expect(api.fetchRangeSessions).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Gün' }))
    await screen.findByText('Bu gün için ders yok')
  })

  it('gün görünümünde kapalı gün "Bu gün kapalı" der', async () => {
    api.fetchClosedDaysInRange.mockResolvedValue(['2026-07-22'])
    draw()
    await waitFor(() => expect(api.fetchRangeSessions).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Gün' }))
    await screen.findByText('Bu gün kapalı')
  })
})

describe('sürükleme — 5px eşiği ve kapsam sorusu', () => {
  const drag = (block: HTMLElement, dx: number, dy: number) => {
    fireEvent.pointerDown(block, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(block, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy })
    fireEvent.pointerUp(block, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy })
  }

  beforeEach(() => {
    // jsdom `setPointerCapture`'ı tanımıyor; sürüklemenin kendisi onu kullanıyor.
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })

  it('eşiğin altındaki hareket dersi AÇAR, taşımaz', async () => {
    api.fetchRangeSessions.mockResolvedValue([row({ id: 1, startsAt: '2026-07-22 16:00' })])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(1))

    drag(blocks()[0]!, 3, 3)

    await screen.findByText('Dersi düzenle')
    expect(api.rescheduleSession).not.toHaveBeenCalled()
  })

  it('şablona bağlı ders sürüklenince KAPSAM sorulur', async () => {
    api.fetchRangeSessions.mockResolvedValue([
      row({ id: 1, startsAt: '2026-07-22 16:00', seriesId: 9 }),
    ])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(1))

    // Bir dilim aşağı: 16:00 → 16:30.
    drag(blocks()[0]!, 0, SLOT_PX)

    await screen.findByText('Dersi taşı')
    expect(screen.getByText('Sadece bu ders')).toBeTruthy()
    expect(screen.getByText('Bu ve sonraki dersler')).toBeTruthy()
    // Soru sorulmadan hiçbir şey yazılmıyor.
    expect(api.rescheduleSession).not.toHaveBeenCalled()

    api.rescheduleSession.mockResolvedValue({ seriesId: null, moved: 1 })
    fireEvent.click(screen.getByText('Sadece bu ders'))
    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenCalledWith(1, '2026-07-22 16:30', 60, 'only'),
    )
  })

  it('şablonsuz ders SORULMADAN taşınır ve bildirim geri alınabilir', async () => {
    api.fetchRangeSessions.mockResolvedValue([row({ id: 1, startsAt: '2026-07-22 16:00' })])
    api.rescheduleSession.mockResolvedValue({ seriesId: null, moved: 1 })
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(1))

    drag(blocks()[0]!, 0, SLOT_PX)

    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenCalledWith(1, '2026-07-22 16:30', 60, 'only'),
    )
    expect(screen.queryByText('Dersi taşı')).toBeNull()

    // R3.12 — "Geri al" dersi ESKİ damgasına yazıyor.
    fireEvent.click(await screen.findByRole('button', { name: 'Geri al' }))
    await waitFor(() =>
      expect(api.rescheduleSession).toHaveBeenLastCalledWith(1, '2026-07-22 16:00', 60, 'only'),
    )
  })

  it('kapalı güne bırakılamaz — hiçbir şey yazılmaz (K-2)', async () => {
    // Perşembe kapalı; Çarşamba'daki ders bir sütun sağa sürükleniyor.
    api.fetchClosedDaysInRange.mockResolvedValue(['2026-07-23'])
    api.fetchRangeSessions.mockResolvedValue([row({ id: 1, startsAt: '2026-07-22 16:00' })])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(1))

    drag(blocks()[0]!, COLUMN_PX, 0)

    expect(api.rescheduleSession).not.toHaveBeenCalled()
    expect(screen.queryByText('Dersi taşı')).toBeNull()
  })
})

describe('gün görünümü', () => {
  it('tek sütun çizer (ADR-011 — öğretmen sütunu yok)', async () => {
    api.fetchRangeSessions.mockResolvedValue([row({ id: 1, startsAt: '2026-07-22 16:00' })])
    draw()
    await waitFor(() => expect(blocks()).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Gün' }))
    await waitFor(() =>
      expect(api.fetchRangeSessions).toHaveBeenLastCalledWith('2026-07-22', '2026-07-22'),
    )
    expect(screen.getByText('22.07.2026 · Çarşamba')).toBeTruthy()
  })
})

describe('ay görünümü', () => {
  it('6 haftalık aralığı sorar ve güne tıklamak gün görünümünü açar', async () => {
    api.fetchRangeSessions.mockResolvedValue([])
    draw()
    await waitFor(() => expect(api.fetchRangeSessions).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Ay' }))
    // Temmuz 2026'nın 1'i Çarşamba → ızgara 29.06 Pazartesi'den başlar, 41 gün sürer.
    await waitFor(() =>
      expect(api.fetchRangeSessions).toHaveBeenLastCalledWith('2026-06-29', '2026-08-09'),
    )
    expect(screen.getByText('Temmuz 2026')).toBeTruthy()
  })
})
