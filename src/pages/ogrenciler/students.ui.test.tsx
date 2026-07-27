import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { StudentsPage } from './StudentsPage'

const api = vi.hoisted(() => ({
  fetchStudentList: vi.fn(),
  fetchStudyGroups: vi.fn(),
  fetchSubjects: vi.fn(),
  restoreStudent: vi.fn(),
}))
vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))
vi.mock('./StudentForm', () => ({
  StudentForm: ({ open }: { open: boolean }) =>
    open ? <div data-testid="student-form-open" /> : null,
}))
vi.mock('../odemeler/PaymentModal', () => ({
  PaymentModal: ({ open, initialStudentId }: { open: boolean; initialStudentId: number | null }) =>
    open ? <div data-testid="student-payment">{initialStudentId}</div> : null,
}))

const base = {
  school: null, grade: null, phone: null, guardianName: null, guardianPhone: null,
  guardianCount: 0, balanceKurus: 0, debtKurus: 0, oldestDueOn: null,
  remainingLessons: null, processedLessons: 0, attendedLessons: 0,
  lastSessionDate: null, subjectIds: [], groupIds: [], isActive: true,
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchStudentList.mockResolvedValue([
    { ...base, id: 7, fullName: 'İpek Şahin', archived: false },
    { ...base, id: 8, fullName: 'Arşiv Öğrenci', archived: true },
  ])
  api.fetchStudyGroups.mockResolvedValue([])
  api.fetchSubjects.mockResolvedValue([])
  api.restoreStudent.mockResolvedValue(true)
  window.location.hash = ''
})

const draw = () => render(<ToastProvider><StudentsPage /></ToastProvider>)

describe('öğrenci listesinin para eylemi', () => {
  it('canlı satırdan Tahsilat al modalını doğru öğrenciyle açar', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Tahsilat al' }))
    expect(screen.getByTestId('student-payment').textContent).toBe('7')
    expect(screen.queryByRole('button', { name: 'Aç' })).toBeNull()
  })

  it('arşiv görünümünde Geri al eylemini korur', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: /Arşivlenmiş/ }))
    expect(await screen.findByRole('button', { name: 'Geri al' })).toBeTruthy()
  })

  it('karşılama bağlantısı yeni öğrenci formunu doğrudan açar', async () => {
    window.location.hash = '#/ogrenciler?yeni=1'
    draw()

    expect(await screen.findByTestId('student-form-open')).toBeTruthy()
  })
})
