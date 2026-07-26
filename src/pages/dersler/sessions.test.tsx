import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DaySessionRow } from '../../lib/api'
import { DELETE_SCOPES, removedMessage, SessionActions } from './SessionActions'
import { SessionForm } from './SessionForm'
import { appliedMessage } from './TemplateModal'
import { slotBounds, validateSession, type SessionDraft } from './validate'

/**
 * Ders modallarının testleri.
 *
 * `lib/api` taklit ediliyor: jsdom'da Tauri IPC'si yok. Taklit olmadan form açılışta
 * hata durumuna düşer ve asıl sınanacak şey — çakışma uyarısının **ne yazdığı** —
 * hiç görünmezdi.
 */
const api = vi.hoisted(() => ({
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
  rescheduleSession: vi.fn(),
}))

vi.mock('../../lib/api', () => api)

const TODAY = '2026-07-27'

const ROW: DaySessionRow = {
  id: 7,
  seriesId: 3,
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
  studentCount: 4,
  presentCount: 0,
  markedCount: 0,
  isMakeup: false,
  cancelReason: null,
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchSubjects.mockResolvedValue([
    { id: 1, name: 'Matematik', color: null, defaultMin: 60, sortOrder: 0 },
  ])
  api.fetchGroupList.mockResolvedValue([
    { id: 1, name: 'Grup A', subjectId: 1, archived: false, weekly: [] },
  ])
  api.fetchStudentList.mockResolvedValue([])
  api.fetchTeachers.mockResolvedValue([{ id: 1, fullName: 'Ofis', color: '#000', isActive: true }])
  api.fetchDefaultMinutes.mockResolvedValue(60)
  api.fetchIsClosedDay.mockResolvedValue(false)
  api.fetchSessionConflicts.mockResolvedValue([])
  api.saveSession.mockResolvedValue({ sessionId: 1, seriesId: null, created: 1 })
  api.deleteSessions.mockResolvedValue({ removed: 0, cancelled: 1, seriesClosed: false })
})

// ---------------------------------------------------------------------------
// Çakışma uyarısı — K-1 / R3.11
// ---------------------------------------------------------------------------

describe('SessionForm — çakışma uyarısı', () => {
  async function fillAndSave() {
    render(
      <SessionForm open today={TODAY} onClose={() => {}} onSaved={() => {}} />,
    )
    await screen.findByLabelText('Grup')

    // K1 — grup/öğrenci alanı artık aranabilir seçim: odaklan, seçeneği tıkla.
    fireEvent.focus(screen.getByLabelText('Grup'))
    fireEvent.mouseDown(screen.getByText('Grup A'))
    // ADR-037 — çakışma uyarısı öğretmene bakıyor; alan otomatik dolmuyor.
    fireEvent.change(screen.getByLabelText('Öğretmen'), { target: { value: '1' } })
    const time = screen.getByLabelText('Saat')
    fireEvent.change(time, { target: { value: '16:00' } })
    fireEvent.blur(time)

    await waitFor(() =>
      expect((screen.getByLabelText(/Süre/) as HTMLInputElement).value).toBe('60'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  }

  it('uyarı çakışan dersin ADINI gösterir ve kaydetmez', async () => {
    api.fetchSessionConflicts.mockResolvedValue([
      {
        sessionId: 42,
        startsAt: '2026-07-27 16:00',
        endsAt: '2026-07-27 17:00',
        label: 'Fizik · Mehmet Aslan',
      },
    ])

    await fillAndSave()

    // "Çakışma var" tek başına hiçbir şey anlatmıyor: ders adı yazılı olmak zorunda.
    expect(await screen.findByText('Fizik · Mehmet Aslan')).not.toBeNull()
    expect(screen.getByText('Bu saatte başka bir ders var')).not.toBeNull()
    expect(api.saveSession).not.toHaveBeenCalled()
  })

  it('"Yine de ekle" ile kayıt geçer — çakışma ENGELLEMEZ (K-1)', async () => {
    api.fetchSessionConflicts.mockResolvedValue([
      {
        sessionId: 42,
        startsAt: '2026-07-27 16:00',
        endsAt: '2026-07-27 17:00',
        label: 'Fizik · Mehmet Aslan',
      },
    ])

    await fillAndSave()
    fireEvent.click(await screen.findByRole('button', { name: /Yine de ekle/ }))

    await waitFor(() => expect(api.saveSession).toHaveBeenCalledTimes(1))
  })

  it('çakışma yoksa uyarı hiç çıkmaz', async () => {
    await fillAndSave()

    await waitFor(() => expect(api.saveSession).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Bu saatte başka bir ders var')).toBeNull()
  })

  it('uyarı öğretmene bağlı sorulur — ADR-037 / DENETIM-FAZ1 > C5', async () => {
    await fillAndSave()

    await waitFor(() => expect(api.fetchSessionConflicts).toHaveBeenCalled())
    // Dördüncü argüman `teacherId`: uyarının "aynı öğretmen aynı saatte" olması
    // buna bağlı. Bu satır olmadan kural PRD K-1'i değil "aynı saatte iki ders"i
    // sorardı — üç faz boyunca öyleydi.
    expect(api.fetchSessionConflicts).toHaveBeenLastCalledWith(
      '2026-07-27 16:00',
      '2026-07-27 17:00',
      null,
      1,
    )
  })

  it('öğretmen seçilmemişse çakışma hiç sorulmaz', async () => {
    render(<SessionForm open today={TODAY} onClose={() => {}} onSaved={() => {}} />)
    await screen.findByLabelText('Grup')

    fireEvent.focus(screen.getByLabelText('Grup'))
    fireEvent.mouseDown(screen.getByText('Grup A'))
    const time = screen.getByLabelText('Saat')
    fireEvent.change(time, { target: { value: '16:00' } })
    fireEvent.blur(time)
    await waitFor(() =>
      expect((screen.getByLabelText(/Süre/) as HTMLInputElement).value).toBe('60'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(api.saveSession).toHaveBeenCalledTimes(1))
    // Sorulsa da boş dönerdi (Rust `teacher_id` yoksa boş liste veriyor), ama
    // sormamak niyeti ekranda da görünür kılıyor.
    expect(api.fetchSessionConflicts).toHaveBeenLastCalledWith(
      '2026-07-27 16:00',
      '2026-07-27 17:00',
      null,
      null,
    )
  })
})

// ---------------------------------------------------------------------------
// K-2 — tatil ENGELLER
// ---------------------------------------------------------------------------

describe('SessionForm — tatil günü', () => {
  it('kapalı günde kaydet düğmesi kapanır ve neden yazılır', async () => {
    api.fetchIsClosedDay.mockResolvedValue(true)

    render(<SessionForm open today={TODAY} onClose={() => {}} onSaved={() => {}} />)

    expect(await screen.findByText(/tatil olarak işaretli/)).not.toBeNull()
    const save = screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Silme kapsamı — R3.8, varsayılan EN DAR
// ---------------------------------------------------------------------------

describe('Silme kapsamı', () => {
  it('sıra en dar seçenekle başlar', () => {
    expect(DELETE_SCOPES.map((scope) => scope.value)).toEqual(['only', 'following', 'all'])
  })

  it('şablona bağlı derste üç seçenek çıkar, ilki "Sadece bu ders"', () => {
    render(
      <SessionActions
        action="remove"
        row={ROW}
        today={TODAY}
        onClose={() => {}}
        onDone={() => {}}
      />,
    )

    const options = screen
      .getAllByRole('button')
      .map((button) => button.textContent ?? '')
      .filter((text) => text.startsWith('Sadece') || text.startsWith('Bu ve') || text.startsWith('Tüm'))

    expect(options).toHaveLength(3)
    expect(options[0]).toContain('Sadece bu ders')
    // Hiçbiri önceden seçili DEĞİL: program kullanıcının yerine karar vermiyor.
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
  })

  it('şablona bağlı olmayan derste kapsam hiç sorulmaz', () => {
    render(
      <SessionActions
        action="remove"
        row={{ ...ROW, seriesId: null }}
        today={TODAY}
        onClose={() => {}}
        onDone={() => {}}
      />,
    )

    expect(screen.queryByText('Bu ve sonraki dersler')).toBeNull()
    expect(screen.getByText(/programdan kalkacak/)).not.toBeNull()
  })

  it('en dar kapsama basınca Rust\'a "only" gider', async () => {
    render(
      <SessionActions
        action="remove"
        row={ROW}
        today={TODAY}
        onClose={() => {}}
        onDone={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Sadece bu ders'))
    await waitFor(() => expect(api.deleteSessions).toHaveBeenCalledWith(7, 'only'))
  })
})

describe('removedMessage', () => {
  // Şablona bağlı tek ders arşivlenmiyor, İPTAL ediliyor (ux_session_series_slot).
  // "Silindi" demek, kullanıcının ertesi sabah takvimde göreceği dersi yalanlamak olur.
  it('iptal edilen dersi "silindi" diye anlatmaz', () => {
    const message = removedMessage({ removed: 0, cancelled: 1, seriesClosed: false })
    expect(message).toContain('iptal edildi')
    expect(message).not.toContain('kaldırıldı')
  })

  it('arşivlenen ders sayısını yazar', () => {
    expect(removedMessage({ removed: 12, cancelled: 0, seriesClosed: true })).toContain('12')
  })

  it('hiçbir şey silinmediyse bunu söyler', () => {
    expect(removedMessage({ removed: 0, cancelled: 0, seriesClosed: false })).toContain(
      'işlenmiş dersler yerinde kalır',
    )
  })
})

describe('appliedMessage', () => {
  it('atlanan dersleri sessizce yutmaz', () => {
    const message = appliedMessage({ seriesCreated: 3, skipped: 1, sessionsCreated: 40 })
    expect(message).toContain('3')
    expect(message).toContain('1')
  })

  it('hiç yeni şablon açılmadıysa bunu söyler', () => {
    expect(appliedMessage({ seriesCreated: 0, skipped: 2, sessionsCreated: 0 })).toContain(
      'zaten programdaydı',
    )
  })
})

// ---------------------------------------------------------------------------
// Doğrulama — Rust ikizinin arayüz tarafı
// ---------------------------------------------------------------------------

function draft(patch: Partial<SessionDraft> = {}): SessionDraft {
  return {
    id: null,
    kind: 'group',
    subjectId: '1',
    studyGroupId: '1',
    studentId: '',
    day: '2026-07-27',
    startTime: '16:00',
    durationMin: '60',
    repeat: 'once',
    ...patch,
  }
}

describe('validateSession', () => {
  it('geçerli taslakta hata yok', () => {
    expect(validateSession(draft())).toEqual({})
  })

  it('hedef seçilmemişse tür fark etmeksizin aynı kodu kullanır', () => {
    expect(validateSession(draft({ studyGroupId: '' }))['session.target']).toBeDefined()
    expect(
      validateSession(draft({ kind: 'solo', studyGroupId: '', studentId: '' }))['session.target'],
    ).toBeDefined()
  })

  it('süre sıfır ya da metin olamaz', () => {
    expect(validateSession(draft({ durationMin: '0' }))['session.durationMin']).toBeDefined()
    expect(validateSession(draft({ durationMin: 'abc' }))['session.durationMin']).toBeDefined()
  })
})

describe('slotBounds', () => {
  it('bitişi süreyle hesaplar', () => {
    expect(slotBounds('2026-07-27', '16:00', 90)).toEqual({
      startsAt: '2026-07-27 16:00',
      endsAt: '2026-07-27 17:30',
    })
  })

  // Rust'taki `slot_bounds` ile aynı gerekçe: saat metnine dakika eklenseydi 23:30 + 60
  // aynı günün 00:30'unu üretir ve çakışma sorgusu boş dönerdi.
  it('gece yarısını aşan ders ertesi güne sarkar', () => {
    expect(slotBounds('2026-07-27', '23:30', 60)).toEqual({
      startsAt: '2026-07-27 23:30',
      endsAt: '2026-07-28 00:30',
    })
  })
})
