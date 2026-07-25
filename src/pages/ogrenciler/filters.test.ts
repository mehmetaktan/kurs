/**
 * Çipler, Türkçe sıralama ve sayfalama.
 *
 * Sıralama ve sayfalama **arayüzde** olmak zorunda (ADR-020) — SQLite'ta
 * `localeCompare('tr')` karşılığı yok. Yani bu dosya, kullanıcının gördüğü sıranın tek
 * testidir; Rust tarafında karşılığı yoktur ve olamaz.
 */
import { describe, expect, it } from 'vitest'
import type { StudentRow } from '../../lib/api'
import {
  chipCounts,
  filterByChip,
  matchesChip,
  paginate,
  sortStudents,
  totalReceivableKurus,
} from './filters'

function row(overrides: Partial<StudentRow> & { id: number; fullName: string }): StudentRow {
  return {
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
    subjectIds: [],
    groupIds: [],
    ...overrides,
  }
}

describe('Türkçe sıralama (ADR-020)', () => {
  it('Ç/Ö/Ş/Ü/İ ile başlayan adlar Z’den sonraya düşmez', () => {
    const rows = [
      row({ id: 1, fullName: 'Zeynep Kaya' }),
      row({ id: 2, fullName: 'Çağla Demir' }),
      row({ id: 3, fullName: 'Işıl Korkmaz' }),
      row({ id: 4, fullName: 'İrem Aydın' }),
      row({ id: 5, fullName: 'Ahmet Şahin' }),
      row({ id: 6, fullName: 'Ömer Yıldız' }),
      row({ id: 7, fullName: 'Şule Ak' }),
      row({ id: 8, fullName: 'Ufuk Tan' }),
      row({ id: 9, fullName: 'Ünal Er' }),
    ]

    expect(sortStudents(rows).map((r) => r.fullName)).toEqual([
      'Ahmet Şahin',
      'Çağla Demir',
      'Işıl Korkmaz',
      'İrem Aydın',
      'Ömer Yıldız',
      'Şule Ak',
      'Ufuk Tan',
      'Ünal Er',
      'Zeynep Kaya',
    ])
  })

  it('aynı ad iki kez varsa sıra id ile sabitlenir — sayfadan sayfaya oynamaz', () => {
    const rows = [
      row({ id: 9, fullName: 'Elif Yılmaz' }),
      row({ id: 2, fullName: 'elif yılmaz' }),
      row({ id: 5, fullName: 'Elif Yılmaz' }),
    ]
    expect(sortStudents(rows).map((r) => r.id)).toEqual([2, 5, 9])
  })

  it('girdiyi değiştirmez', () => {
    const rows = [row({ id: 2, fullName: 'Zeynep' }), row({ id: 1, fullName: 'Ahmet' })]
    sortStudents(rows)
    expect(rows.map((r) => r.id)).toEqual([2, 1])
  })
})

describe('çipler', () => {
  const rows = [
    row({ id: 1, fullName: 'Aktif Borçlu', debtKurus: 120_000, balanceKurus: -120_000 }),
    row({ id: 2, fullName: 'Aktif Temiz' }),
    row({ id: 3, fullName: 'Pasif Kişi', isActive: false }),
    row({ id: 4, fullName: 'Paketi Biten', remainingLessons: 1 }),
    row({ id: 5, fullName: 'Paketi Bol', remainingLessons: 9 }),
    row({ id: 6, fullName: 'Arşivli Borçlu', archived: true, debtKurus: 50_000 }),
  ]

  it('arşivlenmiş öğrenci canlı çiplerin HİÇBİRİNDE görünmez', () => {
    for (const chip of ['all', 'active', 'passive', 'debtor', 'lowPackage'] as const) {
      expect(filterByChip(rows, chip).some((r) => r.archived)).toBe(false)
    }
    expect(filterByChip(rows, 'archived').map((r) => r.id)).toEqual([6])
  })

  it('"Tümü" arşiv dahil her kayıt DEĞİL, canlı öğrencilerin tamamı', () => {
    expect(filterByChip(rows, 'all')).toHaveLength(5)
  })

  it('borçlu çipi yalnızca gerçekten borcu olanları alır', () => {
    expect(filterByChip(rows, 'debtor').map((r) => r.id)).toEqual([1])
  })

  it('"paketi bitiyor" eşiği 2; paketi HİÇ olmayan öğrenci sayılmaz', () => {
    // `remainingLessons: null` = paket yok — "bitiyor" değil. `0` gerçekten bitmiş.
    expect(filterByChip(rows, 'lowPackage').map((r) => r.id)).toEqual([4])

    expect(matchesChip(row({ id: 7, fullName: 'x', remainingLessons: 0 }), 'lowPackage')).toBe(true)
    expect(matchesChip(row({ id: 8, fullName: 'x', remainingLessons: 2 }), 'lowPackage')).toBe(true)
    expect(matchesChip(row({ id: 9, fullName: 'x', remainingLessons: 3 }), 'lowPackage')).toBe(false)
    expect(matchesChip(row({ id: 10, fullName: 'x' }), 'lowPackage')).toBe(false)
  })

  it('sayılar filtreyle aynı kuralı kullanır', () => {
    expect(chipCounts(rows)).toEqual({
      all: 5,
      active: 4,
      passive: 1,
      debtor: 1,
      lowPackage: 1,
      archived: 1,
    })
  })
})

describe('sayfalama', () => {
  const rows = Array.from({ length: 25 }, (_, index) =>
    row({ id: index + 1, fullName: `Öğrenci ${index + 1}` }),
  )

  it('sayfayı böler ve toplamı korur', () => {
    const first = paginate(rows, 1, 10)
    expect(first.rows).toHaveLength(10)
    expect(first.pageCount).toBe(3)
    expect(first.total).toBe(25)
    expect(first.rows[0]?.id).toBe(1)

    expect(paginate(rows, 3, 10).rows.map((r) => r.id)).toEqual([21, 22, 23, 24, 25])
  })

  /** Kullanıcı 5. sayfadayken filtre daraltırsa boş ekranla değil son sayfayla karşılaşır. */
  it('aralık dışındaki sayfa düzeltilir, hata verilmez', () => {
    expect(paginate(rows, 99, 10).page).toBe(3)
    expect(paginate(rows, 0, 10).page).toBe(1)
    expect(paginate(rows, -4, 10).page).toBe(1)
    expect(paginate(rows, Number.NaN, 10).page).toBe(1)
  })

  it('boş listede tek sayfa vardır — "Sayfa 1 / 0" yazmaz', () => {
    const empty = paginate([], 1, 10)
    expect(empty.pageCount).toBe(1)
    expect(empty.rows).toEqual([])
    expect(empty.total).toBe(0)
  })
})

describe('toplam alacak', () => {
  /** Arşivlenmiş borçlu DAHİL — borç arşivlemekle yok olmaz (VERI-MODELI §1.23). */
  it('arşivlenmiş öğrencinin borcunu da sayar', () => {
    const rows = [
      row({ id: 1, fullName: 'Canlı', debtKurus: 120_000 }),
      row({ id: 2, fullName: 'Arşivli', archived: true, debtKurus: 50_000 }),
      row({ id: 3, fullName: 'Avanslı', debtKurus: 0, balanceKurus: 42_000 }),
    ]
    expect(totalReceivableKurus(rows)).toBe(170_000)
  })
})
