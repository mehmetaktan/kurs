import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceDetail, DaySessionRow } from '../../lib/api'
import { ToastProvider } from '../../ui'
import { AttendanceDrawer } from './AttendanceDrawer'

const api = vi.hoisted(() => ({
  fetchAttendanceDetail: vi.fn(),
  saveAttendance: vi.fn(),
}))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

const NOW = '2026-07-27 18:05'
const ROW: DaySessionRow = {
  id: 7,
  seriesId: null,
  startsAt: '2026-07-27 16:00',
  endsAt: '2026-07-27 17:00',
  kind: 'group',
  subjectId: 1,
  subjectName: 'Matematik',
  subjectColor: null,
  teacherId: 1,
  teacherName: 'Ayşe Demir',
  studyGroupId: 1,
  studentId: null,
  title: 'Grup A',
  status: 'planned',
  attendanceTaken: false,
  studentCount: 2,
  presentCount: 0,
  markedCount: 0,
  isMakeup: false,
  cancelReason: null,
}

const DETAIL: AttendanceDetail = {
  sessionId: 7,
  title: 'Grup A',
  subjectName: 'Matematik',
  startsAt: '2026-07-27 16:00',
  endsAt: '2026-07-27 17:00',
  kind: 'group',
  policy: { excusedConsumesLesson: false, unexcusedConsumesLesson: true },
  rows: [
    {
      attendanceId: null,
      studentId: 1,
      fullName: 'Zeynep Kaya',
      status: 'pending',
      note: null,
      effects: {
        present: { lessonCredits: 1, debtKurus: 0 },
        excused: { lessonCredits: 0, debtKurus: 0 },
        unexcused: { lessonCredits: 1, debtKurus: 0 },
        cancelled: { lessonCredits: 0, debtKurus: 0 },
      },
    },
    {
      attendanceId: null,
      studentId: 2,
      fullName: 'Ali Çelik',
      status: 'pending',
      note: null,
      effects: {
        present: { lessonCredits: 0, debtKurus: 25_000 },
        excused: { lessonCredits: 0, debtKurus: 0 },
        unexcused: { lessonCredits: 0, debtKurus: 25_000 },
        cancelled: { lessonCredits: 0, debtKurus: 0 },
      },
    },
  ],
}

const persistedPresentRows = () =>
  DETAIL.rows.map((row) => ({
    ...row,
    status: 'present' as const,
    effects:
      row.studentId === 1
        ? {
            present: { lessonCredits: 0, debtKurus: 0 },
            excused: { lessonCredits: -1, debtKurus: 0 },
            unexcused: { lessonCredits: 0, debtKurus: 0 },
            cancelled: { lessonCredits: -1, debtKurus: 0 },
          }
        : {
            present: { lessonCredits: 0, debtKurus: 0 },
            excused: { lessonCredits: 0, debtKurus: -25_000 },
            unexcused: { lessonCredits: 0, debtKurus: 0 },
            cancelled: { lessonCredits: 0, debtKurus: -25_000 },
          },
  }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const draw = (onSaved = vi.fn(), onClose = vi.fn()) =>
  render(
    <ToastProvider>
      <AttendanceDrawer row={ROW} now={NOW} onClose={onClose} onSaved={onSaved} />
    </ToastProvider>,
  )

beforeEach(() => {
  api.fetchAttendanceDetail.mockReset().mockResolvedValue(DETAIL)
  api.saveAttendance.mockReset().mockResolvedValue({ saved: 2 })
})

describe('Yoklama paneli', () => {
  it('pending için düğme göstermez; dört şema durumu ve en görünür toplu eylem vardır', async () => {
    draw()
    await screen.findByText('Ali Çelik')

    expect(screen.queryByRole('button', { name: /pending/i })).toBeNull()
    for (const label of ['Geldi', 'Mazeretli', 'Mazeretsiz', 'İptal']) {
      expect(screen.getAllByRole('button', { name: label })).toHaveLength(2)
    }
    expect(screen.getByRole('button', { name: 'Hepsi geldi' }).className).toContain('primary')
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Hepsi geldi tüm satırları tek tıkla seçer ve kaydetmeden önce etkiyi gösterir', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Hepsi geldi' }))

    expect(screen.getAllByRole('button', { name: 'Geldi', pressed: true })).toHaveLength(2)
    expect(screen.getByText('1 ders hakkı düşecek, 250,00 ₺ borç yazılacak.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('politika Genel ayarlardan geldiği gibi mazeretli/mazeretsiz özetine uygulanır', async () => {
    api.fetchAttendanceDetail.mockResolvedValue({
      ...DETAIL,
      policy: { excusedConsumesLesson: true, unexcusedConsumesLesson: false },
      rows: DETAIL.rows.map((row) => ({
        ...row,
        effects: {
          ...row.effects,
          excused: row.effects.present,
          unexcused: { lessonCredits: 0, debtKurus: 0 },
        },
      })),
    })
    draw()
    await screen.findByText('Ali Çelik')

    const ali = screen.getByText('Ali Çelik').closest('section')
    const zeynep = screen.getByText('Zeynep Kaya').closest('section')
    expect(ali).not.toBeNull()
    expect(zeynep).not.toBeNull()
    fireEvent.click(within(ali as HTMLElement).getByRole('button', { name: 'Mazeretsiz' }))
    fireEvent.click(within(zeynep as HTMLElement).getByRole('button', { name: 'Mazeretli' }))

    expect(screen.getByText('1 ders hakkı düşecek.')).toBeTruthy()
  })

  it('değişmeyen kayıt için yeni tüketim göstermeyip etkisiz olduğunu söyler', async () => {
    api.fetchAttendanceDetail.mockResolvedValue({
      ...DETAIL,
      rows: persistedPresentRows(),
    })
    draw()

    expect(await screen.findByText('Ders hakkı ve borç değişmeyecek.')).toBeTruthy()
  })

  it('geldi → mazeretli düzeltmesini hak iadesi ve borç silme olarak gösterir', async () => {
    api.fetchAttendanceDetail.mockResolvedValue({
      ...DETAIL,
      rows: persistedPresentRows(),
    })
    draw()
    await screen.findByText('Ali Çelik')
    for (const name of ['Ali Çelik', 'Zeynep Kaya']) {
      const student = screen.getByText(name).closest('section') as HTMLElement
      fireEvent.click(within(student).getByRole('button', { name: 'Mazeretli' }))
    }

    expect(
      screen.getByText('1 ders hakkı geri verilecek, 250,00 ₺ borç silinecek.'),
    ).toBeTruthy()
  })

  it('mazeretli → geldi düzeltmesini hak düşümü ve borç yazma olarak gösterir', async () => {
    api.fetchAttendanceDetail.mockResolvedValue({
      ...DETAIL,
      rows: DETAIL.rows.map((row) => ({ ...row, status: 'excused' })),
    })
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Hepsi geldi' }))

    expect(
      screen.getByText('1 ders hakkı düşecek, 250,00 ₺ borç yazılacak.'),
    ).toBeTruthy()
  })

  it('öğrenci notunu ve dört durumdan seçileni tek save_attendance yoluna gönderir', async () => {
    const onSaved = vi.fn()
    draw(onSaved)
    await screen.findByText('Ali Çelik')
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi geldi' }))
    const ali = screen.getByText('Ali Çelik').closest('section') as HTMLElement
    fireEvent.change(within(ali).getByLabelText('Kısa not'), {
      target: { value: '  Ödevini getirmedi  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(api.saveAttendance).toHaveBeenCalledTimes(1))
    expect(api.saveAttendance).toHaveBeenCalledWith({
      sessionId: 7,
      markedAt: NOW,
      marks: [
        { studentId: 1, status: 'present', note: null },
        { studentId: 2, status: 'present', note: 'Ödevini getirmedi' },
      ],
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Yoklama kaydedildi.')).toBeTruthy()
  })

  it('öğrenci yoksa açık ve eylem öneren boş durumu gösterir', async () => {
    api.fetchAttendanceDetail.mockResolvedValue({ ...DETAIL, rows: [] })
    draw()

    expect(await screen.findByText('Bu derse kayıtlı öğrenci yok')).toBeTruthy()
    expect(screen.getByText(/katılım kayıtlarını kontrol edin/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull()
  })

  it.each(['kapat düğmesi', 'Escape', 'zemin'])(
    'kirli panel %s ile kapanırken onay ister',
    async (route) => {
      const onClose = vi.fn()
      draw(vi.fn(), onClose)
      await screen.findByText('Ali Çelik')
      const ali = screen.getByText('Ali Çelik').closest('section') as HTMLElement
      fireEvent.click(within(ali).getByRole('button', { name: 'Geldi' }))

      if (route === 'kapat düğmesi') {
        fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
      } else if (route === 'Escape') {
        fireEvent.keyDown(document, { key: 'Escape' })
      } else {
        const drawer = screen.getByRole('dialog', { name: 'Matematik · Grup A' })
        fireEvent.click(drawer.parentElement as HTMLElement)
      }

      expect(await screen.findByText('Kaydedilmemiş yoklama değişiklikleri var')).toBeTruthy()
      expect(onClose).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: /^Kaydetmeden kapat/ }))
      expect(onClose).toHaveBeenCalledTimes(1)
    },
  )

  it('pristine panel doğrudan kapanır, başarılı kayıttan sonra onay çıkmaz', async () => {
    const pristineClose = vi.fn()
    const first = draw(vi.fn(), pristineClose)
    await screen.findByText('Ali Çelik')
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(pristineClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Kaydedilmemiş yoklama değişiklikleri var')).toBeNull()
    first.unmount()

    const onSaved = vi.fn()
    draw(onSaved)
    fireEvent.click(await screen.findByRole('button', { name: 'Hepsi geldi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Kaydedilmemiş yoklama değişiklikleri var')).toBeNull()
  })

  it('save sürerken kapanış ve bütün taslak mutasyonları kilitlenir; gönderilen snapshot değişmez', async () => {
    const pending = deferred<{ saved: number }>()
    api.saveAttendance.mockReturnValue(pending.promise)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    draw(onSaved, onClose)
    await screen.findByText('Ali Çelik')
    const ali = screen.getByText('Ali Çelik').closest('section') as HTMLElement
    const zeynep = screen.getByText('Zeynep Kaya').closest('section') as HTMLElement
    fireEvent.click(within(ali).getByRole('button', { name: 'Geldi' }))
    fireEvent.change(within(ali).getByLabelText('Kısa not'), {
      target: { value: 'Gönderilen not' },
    })
    fireEvent.click(within(zeynep).getByRole('button', { name: 'Mazeretsiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(api.saveAttendance).toHaveBeenCalledTimes(1))
    expect((screen.getByRole('button', { name: 'Hepsi geldi' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(ali).getByLabelText('Kısa not') as HTMLTextAreaElement).disabled).toBe(true)
    expect(
      (within(zeynep).getByRole('button', { name: 'Geldi' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Kaydediliyor…' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    // X, Escape ve zemin aynı busy korumasından geçer; hiçbiri kapatamaz/onay açamaz.
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    const drawer = screen.getByRole('dialog', { name: 'Matematik · Grup A' })
    fireEvent.click(drawer.parentElement as HTMLElement)
    // Savunmacı handler kontrolleri: disabled öğeye sentetik olay gelse de taslak değişmez.
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi geldi' }))
    fireEvent.change(within(ali).getByLabelText('Kısa not'), {
      target: { value: 'İstek sırasında değişmesin' },
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText('Kaydedilmemiş yoklama değişiklikleri var')).toBeNull()
    expect(within(zeynep).getByRole('button', { name: 'Mazeretsiz', pressed: true })).toBeTruthy()
    expect((within(ali).getByLabelText('Kısa not') as HTMLTextAreaElement).value).toBe(
      'Gönderilen not',
    )

    pending.resolve({ saved: 2 })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(api.saveAttendance).toHaveBeenCalledWith({
      sessionId: 7,
      markedAt: NOW,
      marks: [
        { studentId: 1, status: 'unexcused', note: null },
        { studentId: 2, status: 'present', note: 'Gönderilen not' },
      ],
    })
    expect(api.saveAttendance).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('save hatası paneli ve gönderilen taslağı açık bırakır', async () => {
    const pending = deferred<{ saved: number }>()
    api.saveAttendance.mockReturnValue(pending.promise)
    const onSaved = vi.fn()
    const onClose = vi.fn()
    draw(onSaved, onClose)
    await screen.findByText('Ali Çelik')
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi geldi' }))
    const ali = screen.getByText('Ali Çelik').closest('section') as HTMLElement
    fireEvent.change(within(ali).getByLabelText('Kısa not'), {
      target: { value: 'Korunacak not' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))

    pending.reject({
      code: 'attendance_save_failed',
      message: 'Yoklama kaydedilemedi. Yeniden deneyin.',
    })
    expect(await screen.findByText('Yoklama kaydedilemedi. Yeniden deneyin.')).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Matematik · Grup A' })).toBeTruthy()
    expect((within(ali).getByLabelText('Kısa not') as HTMLTextAreaElement).value).toBe(
      'Korunacak not',
    )
    expect(screen.getAllByRole('button', { name: 'Geldi', pressed: true })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(await screen.findByText('Kaydedilmemiş yoklama değişiklikleri var')).toBeTruthy()
  })
})
