import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsPage } from './ReportsPage'

const api = vi.hoisted(() => ({
  fetchAbsenceReport: vi.fn(),
  fetchAbsenceReportOptions: vi.fn(),
  fetchLocalNow: vi.fn(),
  fetchReportOverview: vi.fn(),
  fetchMonthlyCollectionReport: vi.fn(),
  fetchSubjectLessonReport: vi.fn(),
}))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

beforeEach(() => {
  api.fetchLocalNow.mockReset().mockResolvedValue('2026-03-20 10:00')
  api.fetchAbsenceReportOptions.mockReset().mockResolvedValue({
    subjects: [
      { id: 1, name: 'Matematik', archived: false },
      { id: 2, name: 'Fizik', archived: false },
      { id: 3, name: 'Tarih', archived: true },
    ],
    groups: [
      { id: 10, name: 'Grup A', subjectId: 1, archived: false },
      { id: 20, name: 'Grup B', subjectId: 2, archived: false },
      { id: 30, name: 'Eski Grup', subjectId: 3, archived: true },
    ],
  })
  api.fetchAbsenceReport.mockReset().mockResolvedValue([
    {
      studentId: 3,
      fullName: 'Işık Kaya',
      archived: false,
      excusedCount: 2,
      unexcusedCount: 1,
      totalCount: 3,
    },
    {
      studentId: 2,
      fullName: 'Çınar Kaya',
      archived: true,
      excusedCount: 1,
      unexcusedCount: 2,
      totalCount: 3,
    },
    {
      studentId: 1,
      fullName: 'Ahmet Kaya',
      archived: false,
      excusedCount: 1,
      unexcusedCount: 4,
      totalCount: 5,
    },
  ])
  api.fetchReportOverview.mockReset().mockResolvedValue({
    month: '2026-03',
    collectedKurus: 325_000,
    collectionCount: 4,
    processedSessionCount: 18,
    attendancePresentCount: 12,
    attendanceEligibleCount: 15,
    attendancePercentage: 80,
    activeStudentCount: 9,
    totalReceivableKurus: 120_000,
    debtorCount: 2,
    ledgerEntryCount: 20,
  })
  api.fetchMonthlyCollectionReport.mockReset().mockResolvedValue([
    { month: '2026-02', collectedKurus: 200_000, collectionCount: 2 },
    { month: '2026-03', collectedKurus: 325_000, collectionCount: 4 },
  ])
  api.fetchSubjectLessonReport.mockReset().mockResolvedValue([
    {
      subjectId: 1,
      subjectName: 'Matematik',
      archived: false,
      processedSessionCount: 12,
    },
  ])
})

describe('Devamsızlık raporu ekranı', () => {
  it('local_now ay aralığını kullanır, kırılımı ve Türkçe sıralamayı gösterir', async () => {
    render(<ReportsPage />)

    expect(await screen.findByText('Ahmet Kaya')).toBeTruthy()
    expect(api.fetchAbsenceReport).toHaveBeenCalledWith({
      from: '2026-03-01',
      to: '2026-03-20',
      search: '',
      subjectId: null,
      groupId: null,
    })
    const absenceTable = screen.getByRole('table', { name: 'Devamsızlık sıralaması' })
    const dataRows = within(absenceTable).getAllByRole('row').slice(1)
    expect(dataRows.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ahmet Kaya'),
      expect.stringContaining('Çınar Kaya'),
      expect.stringContaining('Işık Kaya'),
    ])
    expect(screen.getByText('Arşivlendi')).toBeTruthy()
    expect(screen.getByText('Toplam devamsızlık').parentElement?.textContent).toContain('11')
  })

  it('özet kartlarını, aylık tahsilatı ve branş derslerini mevcut devamsızlığın üstünde gösterir', async () => {
    render(<ReportsPage />)

    expect(await screen.findAllByText('3.250,00 ₺')).toHaveLength(2)
    expect(screen.getByText('%80')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()
    const monthly = screen.getByRole('table', { name: 'Aylık tahsilat dökümü' })
    expect(within(monthly).getByText('Mart 2026')).toBeTruthy()
    expect(within(monthly).getByText('3.250,00 ₺')).toBeTruthy()
    const subjects = screen.getByRole('table', { name: 'Branş bazında işlenen dersler' })
    expect(within(subjects).getByText('Matematik')).toBeTruthy()
    expect(api.fetchReportOverview).toHaveBeenCalledWith('2026-03-20 10:00')
  })

  it('branş ve bağımlı grup filtresini backend sorgusuna gönderir', async () => {
    render(<ReportsPage />)
    await screen.findByText('Ahmet Kaya')

    fireEvent.change(screen.getByLabelText('Branş'), { target: { value: '1' } })
    expect(screen.queryByRole('option', { name: 'Grup B' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Grup'), { target: { value: '10' } })

    await vi.waitFor(() =>
      expect(api.fetchAbsenceReport).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-20',
        search: '',
        subjectId: 1,
        groupId: 10,
      }),
    )

    fireEvent.change(screen.getByLabelText('Branş'), { target: { value: '2' } })
    await vi.waitFor(() =>
      expect(api.fetchAbsenceReport).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-20',
        search: '',
        subjectId: 2,
        groupId: null,
      }),
    )
  })

  it('geçmişte kullanılan arşivli branş ve grubu etiketleyip ayrı filtreler', async () => {
    render(<ReportsPage />)
    await screen.findByText('Ahmet Kaya')

    fireEvent.change(screen.getByLabelText('Branş'), { target: { value: '3' } })
    expect(screen.getByRole('option', { name: 'Tarih · Arşivlendi' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Eski Grup · Arşivlendi' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Grup A' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Grup'), { target: { value: '30' } })

    await vi.waitFor(() =>
      expect(api.fetchAbsenceReport).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-20',
        search: '',
        subjectId: 3,
        groupId: 30,
      }),
    )
  })

  it('boş ve hata durumlarını, filtre temizlemeyi ve yeniden denemeyi sunar', async () => {
    api.fetchAbsenceReport
      .mockRejectedValueOnce({ code: 'db', message: 'Rapor açılamadı. Yeniden deneyin.' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    render(<ReportsPage />)

    expect(await screen.findByText('Rapor açılamadı. Yeniden deneyin.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Bu tarih aralığında devamsızlık yok')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Öğrenci adı ara'), {
      target: { value: 'bulunmaz' },
    })
    expect(await screen.findByText('Bu filtrelerle devamsızlık bulunamadı')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Filtreyi temizle' }))
    expect((screen.getByLabelText('Öğrenci adı ara') as HTMLInputElement).value).toBe('')
  })

  it('ters tarih aralığını frontendde durdurur ve eylem öneren hata gösterir', async () => {
    render(<ReportsPage />)
    await screen.findByText('Ahmet Kaya')
    const callsBefore = api.fetchAbsenceReport.mock.calls.length

    const from = screen.getByLabelText('Başlangıç tarihi')
    fireEvent.change(from, { target: { value: '25.03.2026' } })
    fireEvent.blur(from)

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toBe(
      'Başlangıç tarihi bitiş tarihinden sonra olamaz. Tarih aralığını düzeltin.',
    )
    const to = screen.getByLabelText('Bitiş tarihi')
    expect(from.getAttribute('aria-errormessage')).toBe(alerts[0]?.id)
    expect(to.getAttribute('aria-errormessage')).toBe(alerts[0]?.id)
    expect(from.getAttribute('aria-invalid')).toBe('true')
    expect(to.getAttribute('aria-invalid')).toBe('true')
    expect(api.fetchAbsenceReport).toHaveBeenCalledTimes(callsBefore)
  })

  it('yeni istek önce çözülürse eski başarı sonucu ekranı geri alamaz', async () => {
    const oldRequest = deferred<ReturnType<typeof reportRows>>()
    const newRequest = deferred<ReturnType<typeof reportRows>>()
    api.fetchAbsenceReport
      .mockReset()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)
    render(<ReportsPage />)
    await vi.waitFor(() => expect(api.fetchAbsenceReport).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Branş'), { target: { value: '1' } })
    await vi.waitFor(() => expect(api.fetchAbsenceReport).toHaveBeenCalledTimes(2))
    newRequest.resolve(reportRows('Yeni B'))
    expect(await screen.findByText('Yeni B')).toBeTruthy()

    oldRequest.resolve(reportRows('Eski A'))
    await vi.waitFor(() => expect(screen.queryByText('Eski A')).toBeNull())
    expect(screen.getByText('Yeni B')).toBeTruthy()
  })

  it('yeni istek önce çözülürse eski hata güncel sonucu örtemez', async () => {
    const oldRequest = deferred<ReturnType<typeof reportRows>>()
    const newRequest = deferred<ReturnType<typeof reportRows>>()
    api.fetchAbsenceReport
      .mockReset()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)
    render(<ReportsPage />)
    await vi.waitFor(() => expect(api.fetchAbsenceReport).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Branş'), { target: { value: '2' } })
    await vi.waitFor(() => expect(api.fetchAbsenceReport).toHaveBeenCalledTimes(2))
    newRequest.resolve(reportRows('Yeni B'))
    expect(await screen.findByText('Yeni B')).toBeTruthy()

    oldRequest.reject({ code: 'old', message: 'Eski A hatası' })
    await vi.waitFor(() => expect(screen.queryByText('Eski A hatası')).toBeNull())
    expect(screen.getByText('Yeni B')).toBeTruthy()
  })
})

function reportRows(fullName: string) {
  return [
    {
      studentId: 99,
      fullName,
      archived: false,
      excusedCount: 1,
      unexcusedCount: 0,
      totalCount: 1,
    },
  ]
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}
