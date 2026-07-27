import { describe, expect, it } from 'vitest'
import type { DaySessionRow, StudentRow } from '../../lib/api'
import {
  isPendingAttendance,
  lowPackageRows,
  pendingAttendanceCount,
  sortByStart,
  splitByNow,
} from './today'

/**
 * Bugün ekranının iki gereksinimi burada sınanıyor: saat sırası (R1.1) ve "şimdi"
 * çizgisinin **ne zaman çıkmadığı**. İkincisi asıl önemli olan — bir çizginin
 * görünmesi kolay, gereksizken görünmemesi zor.
 *
 * "Şimdi" sabit veriliyor; `new Date()` çağrılmıyor (§0 kuralının arayüzdeki karşılığı),
 * yoksa test makinenin saatine bağlanır ve CI'da gece yarısı düşerdi.
 */
const NOW = '2026-07-26 14:00'

function row(id: number, startsAt: string, endsAt: string, extra: Partial<DaySessionRow> = {}) {
  return {
    id,
    seriesId: null,
    startsAt,
    endsAt,
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
    ...extra,
  } satisfies DaySessionRow
}

const SABAH = row(1, '2026-07-26 09:00', '2026-07-26 10:00')
const OGLE = row(2, '2026-07-26 13:30', '2026-07-26 14:30') // süren ders
const AKSAM = row(3, '2026-07-26 18:00', '2026-07-26 19:00')

describe('sortByStart', () => {
  it('dersleri saat sırasına dizer', () => {
    const sorted = sortByStart([AKSAM, SABAH, OGLE])
    expect(sorted.map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('girdiyi değiştirmez', () => {
    const input = [AKSAM, SABAH]
    sortByStart(input)
    expect(input.map((item) => item.id)).toEqual([3, 1])
  })
})

describe('splitByNow', () => {
  it('geçmiş ve gelecek varsa "şimdi" çizgisi çıkar', () => {
    const split = splitByNow([SABAH, AKSAM], NOW)
    expect(split.past.map((item) => item.id)).toEqual([1])
    expect(split.future.map((item) => item.id)).toEqual([3])
    expect(split.showNowLine).toBe(true)
  })

  // R1.1'in asıl kuralı: çizgi neyi neyden ayırdığını söyleyemiyorsa çizilmez.
  it('yalnızca geçmiş ders varsa çizgi ÇIKMAZ', () => {
    const split = splitByNow([SABAH], NOW)
    expect(split.past).toHaveLength(1)
    expect(split.future).toHaveLength(0)
    expect(split.showNowLine).toBe(false)
  })

  it('yalnızca gelecek ders varsa çizgi ÇIKMAZ', () => {
    const split = splitByNow([AKSAM], NOW)
    expect(split.showNowLine).toBe(false)
  })

  it('hiç ders yoksa çizgi ÇIKMAZ', () => {
    expect(splitByNow([], NOW).showNowLine).toBe(false)
  })

  it('süren ders geçmişe düşmez, çizginin altında kalır', () => {
    // 13:30–14:30 dersi 14:00'te hâlâ sürüyor: bitmemiş bir dersin yoklaması istenmez.
    const split = splitByNow([SABAH, OGLE], NOW)
    expect(split.past.map((item) => item.id)).toEqual([1])
    expect(split.future.map((item) => item.id)).toEqual([2])
  })

  it('sıralamayı kendisi yapar — girdinin sırasına güvenmez', () => {
    const split = splitByNow([AKSAM, OGLE, SABAH], NOW)
    expect(split.past.map((item) => item.id)).toEqual([1])
    expect(split.future.map((item) => item.id)).toEqual([2, 3])
  })
})

describe('isPendingAttendance', () => {
  it('bitmiş ve yoklaması girilmemiş ders işaretlenir (R1.2)', () => {
    expect(isPendingAttendance(SABAH, NOW)).toBe(true)
  })

  it('yoklaması alınmış ders işaretlenmez', () => {
    expect(isPendingAttendance({ ...SABAH, attendanceTaken: true }, NOW)).toBe(false)
  })

  // O gün ders yapılmadı (VERI-MODELI §4) — yoklaması da beklenmiyor.
  it('iptal edilmiş ders işaretlenmez', () => {
    expect(isPendingAttendance({ ...SABAH, status: 'cancelled' }, NOW)).toBe(false)
  })

  it('henüz bitmemiş ders işaretlenmez', () => {
    expect(isPendingAttendance(AKSAM, NOW)).toBe(false)
    expect(isPendingAttendance(OGLE, NOW)).toBe(false)
  })
})

describe('pendingAttendanceCount', () => {
  it('başlıktaki sayı yalnızca bekleyenleri sayar', () => {
    const rows = [
      SABAH,
      { ...SABAH, id: 4, attendanceTaken: true },
      { ...SABAH, id: 5, status: 'cancelled' },
      AKSAM,
    ]
    expect(pendingAttendanceCount(rows, NOW)).toBe(1)
  })
})

describe('lowPackageRows', () => {
  const student = (
    id: number,
    fullName: string,
    remainingLessons: number | null,
    extra: Partial<StudentRow> = {},
  ): StudentRow => ({
    id,
    fullName,
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
    remainingLessons,
    processedLessons: 0,
    attendedLessons: 0,
    lastSessionDate: null,
    subjectIds: [],
    groupIds: [],
    ...extra,
  })

  it('yalnız canlı 1–2 derslik paketleri kalan hak ve Türkçe ada göre sıralar', () => {
    const rows = [
      student(1, 'İpek', 2),
      student(2, 'Çınar', 1),
      student(3, 'Ada', 3),
      student(4, 'Biten', 0),
      student(5, 'Arşiv', 1, { archived: true }),
      student(6, 'Pasif', 1, { isActive: false }),
      student(7, 'Paketsiz', null),
    ]

    expect(lowPackageRows(rows).map((item) => item.id)).toEqual([2, 1])
  })
})
