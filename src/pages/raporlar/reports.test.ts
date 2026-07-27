import { describe, expect, it } from 'vitest'
import type { AbsenceReportRow } from '../../lib/api'
import { paginate } from '../../lib/paginate'
import {
  absenceTotal,
  reportRangeError,
  sortAbsenceRows,
  sortMonthlyCollections,
  sortSubjectLessons,
} from './reports'

function row(
  studentId: number,
  fullName: string,
  excusedCount: number,
  unexcusedCount: number,
): AbsenceReportRow {
  return {
    studentId,
    fullName,
    archived: false,
    excusedCount,
    unexcusedCount,
    totalCount: excusedCount + unexcusedCount,
  }
}

describe('devamsızlık raporu sıralaması', () => {
  it('önce toplamı büyük olanı, eşitlikte Türkçe adı ve idyi kullanır', () => {
    const rows = [
      row(9, 'İpek Kaya', 1, 2),
      row(8, 'Işık Kaya', 2, 1),
      row(7, 'Çınar Kaya', 0, 3),
      row(5, 'Ada Yılmaz', 2, 3),
      row(3, 'çınar kaya', 1, 2),
    ]

    expect(sortAbsenceRows(rows).map((item) => item.studentId)).toEqual([5, 3, 7, 8, 9])
  })

  it('girdiyi değiştirmez ve yalnız iki devamsızlık toplamını toplar', () => {
    const rows = [row(1, 'B', 2, 3), row(2, 'A', 1, 0)]
    sortAbsenceRows(rows)
    expect(rows.map((item) => item.studentId)).toEqual([1, 2])
    expect(absenceTotal(rows)).toBe(6)
  })

  it('sıralanmış listeyi sayfalar', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row(index + 1, `Öğrenci ${index + 1}`, 0, index + 1),
    )
    const page = paginate(sortAbsenceRows(rows), 2, 10)
    expect(page.pageCount).toBe(3)
    expect(page.rows[0]?.totalCount).toBe(15)
  })
})

describe('tarih aralığı doğrulaması', () => {
  it('iki tarihi zorunlu tutar ve ters aralığı reddeder', () => {
    expect(reportRangeError(null, '2026-03-31')).toBe('required')
    expect(reportRangeError('2026-03-01', null)).toBe('required')
    expect(reportRangeError('2026-04-01', '2026-03-31')).toBe('order')
    expect(reportRangeError('2026-03-01', '2026-03-31')).toBeNull()
    expect(reportRangeError('2026-03-31', '2026-03-31')).toBeNull()
  })
})

describe('özet rapor tabloları', () => {
  it('ayları yeniden eskiye sıralar ve girdiyi değiştirmez', () => {
    const rows = [
      { month: '2026-01', collectedKurus: 10_000, collectionCount: 1 },
      { month: '2026-03', collectedKurus: 30_000, collectionCount: 3 },
      { month: '2026-02', collectedKurus: 20_000, collectionCount: 2 },
    ]
    expect(sortMonthlyCollections(rows).map((item) => item.month)).toEqual([
      '2026-03',
      '2026-02',
      '2026-01',
    ])
    expect(rows[0]?.month).toBe('2026-01')
  })

  it('branşları ders sayısı ve Türkçe adla sıralar', () => {
    const rows = [
      {
        subjectId: 3,
        subjectName: 'İngilizce',
        archived: false,
        processedSessionCount: 2,
      },
      { subjectId: 2, subjectName: 'Çince', archived: false, processedSessionCount: 2 },
      {
        subjectId: 1,
        subjectName: 'Matematik',
        archived: false,
        processedSessionCount: 4,
      },
    ]
    expect(sortSubjectLessons(rows).map((item) => item.subjectId)).toEqual([1, 2, 3])
  })
})
