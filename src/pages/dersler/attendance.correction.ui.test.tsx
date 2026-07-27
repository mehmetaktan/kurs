import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AttendanceDetail,
  AttendanceStatus,
  AttendanceStatusEffects,
  DaySessionRow,
  SaveAttendanceInput,
} from '../../lib/api'
import { ToastProvider } from '../../ui'
import { AttendanceDrawer } from './AttendanceDrawer'

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }))

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

const STUDENTS = [
  { studentId: 1, fullName: 'Paketli Öğrenci', packaged: true },
  { studentId: 2, fullName: 'Ders Başı Öğrenci', packaged: false },
] as const

let persisted: Record<number, AttendanceStatus>
let linkedMakeupSessionId: number | null

const EFFECT_FIXTURES = {
  packaged: {
    pending: {
      present: { lessonCredits: 1, debtKurus: 0 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 1, debtKurus: 0 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
    present: {
      present: { lessonCredits: 0, debtKurus: 0 },
      excused: { lessonCredits: -1, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 0 },
      cancelled: { lessonCredits: -1, debtKurus: 0 },
    },
    excused: {
      present: { lessonCredits: 1, debtKurus: 0 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 1, debtKurus: 0 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
    unexcused: {
      present: { lessonCredits: 0, debtKurus: 0 },
      excused: { lessonCredits: -1, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 0 },
      cancelled: { lessonCredits: -1, debtKurus: 0 },
    },
    cancelled: {
      present: { lessonCredits: 1, debtKurus: 0 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 1, debtKurus: 0 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
  },
  perSession: {
    pending: {
      present: { lessonCredits: 0, debtKurus: 25_000 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 25_000 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
    present: {
      present: { lessonCredits: 0, debtKurus: 0 },
      excused: { lessonCredits: 0, debtKurus: -25_000 },
      unexcused: { lessonCredits: 0, debtKurus: 0 },
      cancelled: { lessonCredits: 0, debtKurus: -25_000 },
    },
    excused: {
      present: { lessonCredits: 0, debtKurus: 25_000 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 25_000 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
    unexcused: {
      present: { lessonCredits: 0, debtKurus: 0 },
      excused: { lessonCredits: 0, debtKurus: -25_000 },
      unexcused: { lessonCredits: 0, debtKurus: 0 },
      cancelled: { lessonCredits: 0, debtKurus: -25_000 },
    },
    cancelled: {
      present: { lessonCredits: 0, debtKurus: 25_000 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 25_000 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
  },
} satisfies Record<
  'packaged' | 'perSession',
  Record<AttendanceStatus, AttendanceStatusEffects>
>

function detail(): AttendanceDetail {
  return {
    sessionId: ROW.id,
    title: ROW.title,
    subjectId: ROW.subjectId,
    subjectName: ROW.subjectName,
    teacherId: ROW.teacherId,
    startsAt: ROW.startsAt,
    endsAt: ROW.endsAt,
    kind: ROW.kind,
    policy: { excusedConsumesLesson: false, unexcusedConsumesLesson: true },
    rows: STUDENTS.map((student) => {
      const status = persisted[student.studentId] ?? 'pending'
      return {
        attendanceId: status === 'pending' ? null : 30 + student.studentId,
        makeupSessionId:
          student.packaged && status !== 'pending' ? linkedMakeupSessionId : null,
        studentId: student.studentId,
        fullName: student.fullName,
        status,
        note: null,
        effects:
          EFFECT_FIXTURES[student.packaged ? 'packaged' : 'perSession'][status],
      }
    }),
  }
}

function savedInputs(): SaveAttendanceInput[] {
  return tauri.invoke.mock.calls
    .filter(([command]) => command === 'save_attendance')
    .map(([, args]) => (args as { input: SaveAttendanceInput }).input)
}

function selectForBoth(label: string) {
  for (const student of STUDENTS) {
    const section = screen.getByText(student.fullName).closest('section') as HTMLElement
    fireEvent.click(within(section).getByRole('button', { name: label }))
  }
}

function draw(onSaved: () => void) {
  return render(
    <ToastProvider>
      <AttendanceDrawer
        row={ROW}
        now={NOW}
        onClose={() => undefined}
        onSaved={onSaved}
      />
    </ToastProvider>,
  )
}

beforeEach(() => {
  persisted = { 1: 'pending', 2: 'pending' }
  linkedMakeupSessionId = null
  tauri.invoke.mockReset().mockImplementation(
    async (command: string, args?: Record<string, unknown>) => {
      if (command === 'attendance_detail') return detail()
      if (command === 'save_attendance') {
        const input = (args as { input: SaveAttendanceInput }).input
        for (const mark of input.marks) persisted[mark.studentId] = mark.status
        return { saved: input.marks.length }
      }
      throw new Error(`Beklenmeyen komut: ${command}`)
    },
  )
})

describe('kalıcı yoklama düzeltmesi', () => {
  it('AttendanceDrawer gerçek API sarmalayıcısından her kayıttan sonra doğru yönlü etkiyi yeniden okur', async () => {
    const onSaved = vi.fn()
    const view = draw(onSaved)
    await screen.findByText('Ders Başı Öğrenci')

    expect(tauri.invoke.mock.calls[0]).toEqual([
      'attendance_detail',
      { sessionId: 7, today: '2026-07-27' },
    ])

    // 1. halka: pending → Geldi.
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi geldi' }))
    expect(
      screen.getByText('1 ders hakkı düşecek, 250,00 ₺ borç yazılacak.'),
    ).toBeTruthy()
    const firstSave = screen.getByRole('button', { name: 'Kaydet' })
    fireEvent.click(firstSave)
    // React kilidi ikinci tıkı API'ye taşımaz; Rust yön fonksiyonlarının
    // idempotency'si ayrı entegrasyon testinde ağ tekrarını da korur.
    fireEvent.click(firstSave)
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(savedInputs()).toHaveLength(1)
    expect(await screen.findByText('Ders hakkı ve borç değişmeyecek.')).toBeTruthy()

    // 2. halka: Geldi → Mazeretli; iki sayaç da geri alma yönünü gösterir.
    selectForBoth('Mazeretli')
    expect(
      screen.getByText('1 ders hakkı geri verilecek, 250,00 ₺ borç silinecek.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Ders hakkı ve borç değişmeyecek.')).toBeTruthy()

    // Bu noktada başka bir ekranda planlanmış telafi, kaynak durum değiştirilse
    // bile bağlantı olarak korunur; kısayol yalnızca exact excused durumunda görünür.
    linkedMakeupSessionId = 77
    view.unmount()
    draw(onSaved)
    expect(await screen.findByText('Telafi planlandı')).toBeTruthy()

    // 3. halka: Mazeretli → Geldi; kalıcı yeniden yükleme ileri yönü getirir.
    fireEvent.click(screen.getByRole('button', { name: 'Hepsi geldi' }))
    expect(
      screen.getByText('1 ders hakkı düşecek, 250,00 ₺ borç yazılacak.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('Ders hakkı ve borç değişmeyecek.')).toBeTruthy()
    expect(screen.queryByText('Telafi planlandı')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Telafi planla' })).toBeNull()

    // 4. halka: tekrar Mazeretli; bağlı plan tek kalır, yeni kısayol açılmaz.
    selectForBoth('Mazeretli')
    expect(
      screen.getByText('1 ders hakkı geri verilecek, 250,00 ₺ borç silinecek.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(4))
    expect(await screen.findByText('Ders hakkı ve borç değişmeyecek.')).toBeTruthy()
    const packaged = screen.getByText('Paketli Öğrenci').closest('section') as HTMLElement
    expect(within(packaged).getByText('Telafi planlandı')).toBeTruthy()
    expect(within(packaged).queryByRole('button', { name: 'Telafi planla' })).toBeNull()

    const inputs = savedInputs()
    expect(inputs).toHaveLength(4)
    expect(inputs.map((input) => input.marks.map((mark) => mark.status))).toEqual([
      ['present', 'present'],
      ['excused', 'excused'],
      ['present', 'present'],
      ['excused', 'excused'],
    ])
    expect(inputs.every((input) => input.sessionId === 7 && input.markedAt === NOW)).toBe(true)
    const detailCalls = tauri.invoke.mock.calls.filter(
      ([command]) => command === 'attendance_detail',
    )
    expect(detailCalls).toHaveLength(6)
    for (const [, args] of detailCalls) {
      expect(args).toEqual({ sessionId: 7, today: '2026-07-27' })
    }
  })
})
