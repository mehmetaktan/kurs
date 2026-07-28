import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GroupDetail, StudentRow } from '../../lib/api'
import { ToastProvider } from '../../ui'
import { GroupDetailPage } from './GroupDetailPage'

const api = vi.hoisted(() => ({
  fetchGroupDetail: vi.fn(),
  fetchStudentList: vi.fn(),
  addGroupMember: vi.fn(),
}))

vi.mock('../../lib/api', async (original) => ({ ...(await original()), ...api }))

const detail: GroupDetail = {
  group: {
    id: 3,
    name: 'Grup A',
    subjectId: 1,
    subjectName: 'Matematik',
    subjectColor: null,
    teacherId: 2,
    teacherName: 'Ayşe Öğretmen',
    capacity: 6,
    memberCount: 0,
    weekly: [],
    isActive: true,
    archived: false,
    startsOn: null,
    endsOn: null,
    nextSessionAt: null,
  },
  members: [
    {
      enrollmentId: 11,
      studentId: 7,
      fullName: 'Elif Yılmaz',
      startOn: '2026-07-01',
      endOn: '2026-07-28',
      isCurrent: false,
    },
  ],
  sessions: [],
  notes: [],
  processedSessions: 0,
  attendedCount: 0,
  markedCount: 0,
}

const student: StudentRow = {
  id: 7,
  fullName: 'Elif Yılmaz',
  school: null,
  grade: null,
  phone: null,
  isActive: true,
  archived: false,
  guardianName: null,
  guardianPhone: null,
  guardianCount: 0,
  balanceKurus: 0,
  debtKurus: 0,
  oldestDueOn: null,
  remainingLessons: null,
  processedLessons: 0,
  attendedLessons: 0,
  lastSessionDate: null,
  subjectIds: [1],
  groupIds: [],
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchGroupDetail.mockResolvedValue(detail)
  api.fetchStudentList.mockResolvedValue([student])
  api.addGroupMember.mockResolvedValue(11)
})

describe('grup üyesini yeniden ekleme', () => {
  it('ayrılmış öğrenciye görünür aksiyon sunar ve öğrenciyi seçili açar', async () => {
    render(
      <ToastProvider>
        <GroupDetailPage groupId={3} />
      </ToastProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Yeniden ekle' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Gruba ekle' }))

    await waitFor(() => {
      expect(api.addGroupMember).toHaveBeenCalledWith(3, 7, null)
    })
  })
})
