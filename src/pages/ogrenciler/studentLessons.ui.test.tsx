import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudentLessonOverview } from '../../lib/api'
import { StudentLessonsTab } from './StudentLessonsTab'

const api = vi.hoisted(() => ({
  fetchLocalNow: vi.fn(),
  fetchStudentLessonOverview: vi.fn(),
}))

vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

const OVERVIEW: StudentLessonOverview = {
  attendancePercentage: 33,
  attendanceEligibleCount: 3,
  presentCount: 1,
  absenceWindowStart: '2025-12-31',
  excusedAbsences: 1,
  unexcusedAbsences: 1,
  lessons: [
    {
      sessionId: 5,
      startsAt: '2026-03-30 10:00',
      endsAt: '2026-03-30 11:00',
      subjectName: 'Matematik',
      groupName: null,
      status: 'pending',
      isMakeup: false,
    },
    {
      sessionId: 4,
      startsAt: '2026-03-29 10:00',
      endsAt: '2026-03-29 11:00',
      subjectName: 'Matematik',
      groupName: 'İleri Grup',
      status: 'cancelled',
      isMakeup: false,
    },
    {
      sessionId: 3,
      startsAt: '2026-03-28 10:00',
      endsAt: '2026-03-28 11:00',
      subjectName: 'Matematik',
      groupName: null,
      status: 'present',
      isMakeup: false,
    },
    {
      sessionId: 2,
      startsAt: '2026-03-27 10:00',
      endsAt: '2026-03-27 11:00',
      subjectName: 'Matematik',
      groupName: null,
      status: 'excused',
      isMakeup: false,
    },
    {
      sessionId: 1,
      startsAt: '2026-03-26 10:00',
      endsAt: '2026-03-26 11:00',
      subjectName: 'Matematik',
      groupName: null,
      status: 'unexcused',
      isMakeup: false,
    },
  ],
  pendingMakeups: [
    {
      attendanceId: 22,
      sourceStartsAt: '2026-03-27 10:00',
      subjectName: 'Matematik',
      makeupSessionId: 70,
      makeupStartsAt: '2026-04-05 13:00',
    },
    {
      attendanceId: 21,
      sourceStartsAt: '2026-03-20 10:00',
      subjectName: 'İngilizce',
      makeupSessionId: null,
      makeupStartsAt: null,
    },
  ],
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  api.fetchLocalNow.mockReset().mockResolvedValue('2026-03-31 12:00')
  api.fetchStudentLessonOverview.mockReset().mockResolvedValue(OVERVIEW)
})

describe('öğrenci ders geçmişi', () => {
  it('local_now damgasını projeksiyona verir ve beş şema durumunu birebir Türkçe gösterir', async () => {
    render(<StudentLessonsTab studentId={7} />)

    const history = await screen.findByRole('table', {
      name: 'Öğrencinin geçmiş dersleri',
    })
    expect(api.fetchLocalNow).toHaveBeenCalledTimes(1)
    expect(api.fetchStudentLessonOverview).toHaveBeenCalledWith(7, '2026-03-31 12:00')

    for (const status of ['girilmedi', 'İptal', 'Geldi', 'Mazeretli', 'Mazeretsiz']) {
      expect(within(history).getByText(status)).toBeTruthy()
    }
    expect(within(history).getAllByRole('row')).toHaveLength(6)
    expect(within(history).getByText('İleri Grup')).toBeTruthy()
  })

  it('backend yüzdesini, üç aylık dağılımı ve telafi listesini gösterir', async () => {
    render(<StudentLessonsTab studentId={7} />)

    expect(await screen.findByText('%33')).toBeTruthy()
    expect(screen.getByText('Geldiği 1 / 3 sonuç girilmiş ders')).toBeTruthy()
    expect(screen.getByText('31.12.2025 tarihinden bugüne')).toBeTruthy()
    expect(screen.getByText((text) => text.startsWith('Planlandı ·'))).toBeTruthy()
    expect(screen.getByText((text) => text.startsWith('05.04.2026 ·'))).toBeTruthy()
    expect(screen.getByText('Henüz planlanmadı')).toBeTruthy()

    const makeups = screen.getByRole('table', {
      name: 'Öğrencinin bekleyen telafileri',
    })
    expect(within(makeups).getAllByRole('row')).toHaveLength(3)
  })

  it('geçmiş, dağılım ve telafi için ayrı boş durumları gösterir', async () => {
    api.fetchStudentLessonOverview.mockResolvedValue({
      ...OVERVIEW,
      attendancePercentage: null,
      attendanceEligibleCount: 0,
      presentCount: 0,
      excusedAbsences: 0,
      unexcusedAbsences: 0,
      lessons: [],
      pendingMakeups: [],
    })

    render(<StudentLessonsTab studentId={7} />)

    expect(await screen.findByText('Henüz geçmiş ders yok')).toBeTruthy()
    expect(screen.getByText('Bekleyen telafi yok')).toBeTruthy()
    expect(
      screen.getByText('Bu aralıkta mazeretli veya mazeretsiz devamsızlık yok.'),
    ).toBeTruthy()
    expect(screen.getByText('Hesaplanacak sonuç girilmiş ders yok')).toBeTruthy()
  })

  it('yükleniyor, eylem öneren hata ve tekrar deneme durumlarını taşır', async () => {
    let rejectFirst: (reason: unknown) => void = () => undefined
    api.fetchStudentLessonOverview.mockImplementationOnce(
      () =>
        new Promise<StudentLessonOverview>((_resolve, reject) => {
          rejectFirst = reject
        }),
    )

    render(<StudentLessonsTab studentId={7} />)
    expect((await screen.findByRole('status')).textContent).toContain('Yükleniyor…')

    rejectFirst({
      code: 'studentLessons.failed',
      message: 'Ders geçmişi alınamadı. Ekranı yenileyip tekrar deneyin.',
    })
    expect(
      await screen.findByText('Ders geçmişi alınamadı. Ekranı yenileyip tekrar deneyin.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByRole('table', { name: 'Öğrencinin geçmiş dersleri' })).toBeTruthy()
    expect(api.fetchStudentLessonOverview).toHaveBeenCalledTimes(2)
  })

  it('öğrenci değişince geç dönen eski isteğin yeni geçmişi ezmesine izin vermez', async () => {
    const first = deferred<StudentLessonOverview>()
    const second = deferred<StudentLessonOverview>()
    api.fetchStudentLessonOverview
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const view = render(<StudentLessonsTab studentId={7} />)
    await waitFor(() =>
      expect(api.fetchStudentLessonOverview).toHaveBeenCalledWith(7, '2026-03-31 12:00'),
    )

    view.rerender(<StudentLessonsTab studentId={8} />)
    await waitFor(() =>
      expect(api.fetchStudentLessonOverview).toHaveBeenCalledWith(8, '2026-03-31 12:00'),
    )

    second.resolve({
      ...OVERVIEW,
      lessons: [{ ...OVERVIEW.lessons[0]!, sessionId: 80, subjectName: 'Yeni geçmiş' }],
    })
    expect(await screen.findByText('Yeni geçmiş')).toBeTruthy()

    await act(async () => {
      first.resolve({
        ...OVERVIEW,
        lessons: [{ ...OVERVIEW.lessons[0]!, sessionId: 70, subjectName: 'Eski geçmiş' }],
      })
    })
    expect(screen.queryByText('Eski geçmiş')).toBeNull()
    expect(screen.getByText('Yeni geçmiş')).toBeTruthy()
  })
})
