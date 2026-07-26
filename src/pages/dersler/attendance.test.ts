import { describe, expect, it } from 'vitest'
import type { AttendanceStudentRow } from '../../lib/api'
import {
  attendanceDrafts,
  attendanceEffectSummary,
  attendanceEffectText,
  type AttendanceDraft,
} from './attendance'

const ROWS: AttendanceStudentRow[] = [
  {
    attendanceId: null,
    studentId: 1,
    fullName: 'Paketli Öğrenci',
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
    fullName: 'Ders Başı Öğrenci',
    status: 'pending',
    note: null,
    effects: {
      present: { lessonCredits: 0, debtKurus: 25_000 },
      excused: { lessonCredits: 0, debtKurus: 0 },
      unexcused: { lessonCredits: 0, debtKurus: 25_000 },
      cancelled: { lessonCredits: 0, debtKurus: 0 },
    },
  },
]

const PERSISTED_PRESENT = ROWS.map((row) => ({
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

describe('yoklama etki özeti', () => {
  it('pending durumunu seçim yapmaz ve özet tamamlanmaz', () => {
    const drafts = attendanceDrafts(ROWS)
    expect(drafts[1]?.status).toBeNull()
    expect(attendanceEffectSummary(ROWS, drafts).complete).toBe(false)
  })

  it('varsayılan politikada geldi ve mazeretsiz tüketir, mazeretli tüketmez', () => {
    const drafts: Record<number, AttendanceDraft> = {
      1: { status: 'unexcused', note: '' },
      2: { status: 'present', note: '' },
    }
    expect(
      attendanceEffectSummary(ROWS, drafts),
    ).toEqual({
      lessonCreditsToConsume: 1,
      lessonCreditsToRestore: 0,
      debtToAddKurus: 25_000,
      debtToRemoveKurus: 0,
      complete: true,
    })

    drafts[1] = { status: 'excused', note: '' }
    expect(
      attendanceEffectSummary(ROWS, drafts),
    ).toEqual({
      lessonCreditsToConsume: 0,
      lessonCreditsToRestore: 0,
      debtToAddKurus: 25_000,
      debtToRemoveKurus: 0,
      complete: true,
    })
  })

  it('Genel ayarlar ters çevrilince mazeretli tüketir, mazeretsiz tüketmez', () => {
    const policyRows = ROWS.map((row) => ({
      ...row,
      effects: {
        ...row.effects,
        excused: row.effects.present,
        unexcused: { lessonCredits: 0, debtKurus: 0 },
      },
    }))
    const drafts: Record<number, AttendanceDraft> = {
      1: { status: 'excused', note: '' },
      2: { status: 'unexcused', note: '' },
    }
    expect(
      attendanceEffectSummary(policyRows, drafts),
    ).toEqual({
      lessonCreditsToConsume: 1,
      lessonCreditsToRestore: 0,
      debtToAddKurus: 0,
      debtToRemoveKurus: 0,
      complete: true,
    })
  })

  it('iptal hiçbir politikada etki doğurmaz', () => {
    const drafts: Record<number, AttendanceDraft> = {
      1: { status: 'cancelled', note: '' },
      2: { status: 'cancelled', note: '' },
    }
    expect(
      attendanceEffectSummary(ROWS, drafts),
    ).toEqual({
      lessonCreditsToConsume: 0,
      lessonCreditsToRestore: 0,
      debtToAddKurus: 0,
      debtToRemoveKurus: 0,
      complete: true,
    })
  })

  it('değişmeyen kayıt için yeni etki göstermeyip Türkçe değişmeyecek der', () => {
    const summary = attendanceEffectSummary(
      PERSISTED_PRESENT,
      attendanceDrafts(PERSISTED_PRESENT),
    )
    expect(summary).toEqual({
      lessonCreditsToConsume: 0,
      lessonCreditsToRestore: 0,
      debtToAddKurus: 0,
      debtToRemoveKurus: 0,
      complete: true,
    })
    expect(attendanceEffectText(summary)).toBe('Ders hakkı ve borç değişmeyecek.')
  })

  it('geldi → mazeretli düzeltmesini geri verme ve borç silme yönünde anlatır', () => {
    const drafts: Record<number, AttendanceDraft> = {
      1: { status: 'excused', note: '' },
      2: { status: 'excused', note: '' },
    }
    const summary = attendanceEffectSummary(PERSISTED_PRESENT, drafts)
    expect(attendanceEffectText(summary)).toBe(
      '1 ders hakkı geri verilecek, 250,00 ₺ borç silinecek.',
    )
  })

  it('mazeretli → geldi düzeltmesini hak düşümü ve borç yazma yönünde anlatır', () => {
    const persisted = ROWS.map((row) => ({ ...row, status: 'excused' as const }))
    const drafts: Record<number, AttendanceDraft> = {
      1: { status: 'present', note: '' },
      2: { status: 'present', note: '' },
    }
    const summary = attendanceEffectSummary(persisted, drafts)
    expect(attendanceEffectText(summary)).toBe(
      '1 ders hakkı düşecek, 250,00 ₺ borç yazılacak.',
    )
  })
})
