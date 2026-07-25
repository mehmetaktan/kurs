/**
 * Gruplar ekranının çipleri ve Türkçe sıralaması.
 *
 * Sıralama **arayüzde** olmak zorunda (ADR-020) — SQLite'ta `localeCompare('tr')`
 * karşılığı yok. Yani bu dosya, kullanıcının gördüğü sıranın tek testidir; Rust
 * tarafında karşılığı yoktur ve olamaz.
 */
import { describe, expect, it } from 'vitest'
import type { GroupRow } from '../../lib/api'
import { paginate } from '../../lib/paginate'
import {
  chipCounts,
  filterByChip,
  isFull,
  isOverCapacity,
  matchesChip,
  sortGroups,
} from './filters'

function row(overrides: Partial<GroupRow> & { id: number; name: string }): GroupRow {
  return {
    subjectId: 1,
    subjectName: 'Matematik',
    subjectColor: null,
    teacherId: 1,
    teacherName: 'Öğretmen',
    capacity: 6,
    memberCount: 0,
    weekly: [],
    isActive: true,
    archived: false,
    startsOn: null,
    endsOn: null,
    nextSessionAt: null,
    ...overrides,
  }
}

describe('çipler', () => {
  const rows = [
    row({ id: 1, name: 'Grup A', memberCount: 6, capacity: 6 }),
    row({ id: 2, name: 'Grup B', memberCount: 3, capacity: 6 }),
    row({ id: 3, name: 'Grup C', memberCount: 0, capacity: 6, isActive: false }),
    row({ id: 4, name: 'Grup D', memberCount: 7, capacity: 6 }),
    row({ id: 5, name: 'Grup E', archived: true }),
  ]

  it('"Tümü" arşivlenmiş grubu göstermez', () => {
    expect(filterByChip(rows, 'all').map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  it('"Arşivlenmiş" yalnızca arşivi gösterir', () => {
    expect(filterByChip(rows, 'archived').map((r) => r.id)).toEqual([5])
  })

  it('"Dolu" kapasitesi dolan ve AŞAN grupları kapsar', () => {
    // PRD S2: aşım engellenmiyor. Aşan grup "boş kontenjan"a düşerse listede kaybolur.
    expect(filterByChip(rows, 'full').map((r) => r.id)).toEqual([1, 4])
  })

  it('"Boş kontenjan" yalnızca yer olanları gösterir', () => {
    expect(filterByChip(rows, 'available').map((r) => r.id)).toEqual([2, 3])
  })

  it('"Aktif" pasif grubu dışarıda bırakır', () => {
    expect(filterByChip(rows, 'active').map((r) => r.id)).toEqual([1, 2, 4])
  })

  it('çip sayıları listeyle tutarlı', () => {
    const counts = chipCounts(rows)
    expect(counts.all).toBe(4)
    expect(counts.full).toBe(2)
    expect(counts.available).toBe(2)
    expect(counts.archived).toBe(1)
    expect(counts.full + counts.available).toBe(counts.all)
  })

  it('arşivlenmiş grup canlı çiplerin hiçbirinde çıkmaz', () => {
    const archived = row({ id: 9, name: 'Grup Z', archived: true, memberCount: 0 })
    expect(matchesChip(archived, 'all')).toBe(false)
    expect(matchesChip(archived, 'available')).toBe(false)
    expect(matchesChip(archived, 'archived')).toBe(true)
  })
})

describe('kapasite', () => {
  it('dolu ile aşım ayrı sorular', () => {
    const dolu = row({ id: 1, name: 'A', memberCount: 6, capacity: 6 })
    const asan = row({ id: 2, name: 'B', memberCount: 7, capacity: 6 })

    expect(isFull(dolu)).toBe(true)
    expect(isOverCapacity(dolu)).toBe(false)
    expect(isFull(asan)).toBe(true)
    expect(isOverCapacity(asan)).toBe(true)
  })
})

describe('Türkçe sıralama', () => {
  it('önce branş, sonra grup adı', () => {
    const rows = [
      row({ id: 1, name: 'Grup B', subjectName: 'Matematik' }),
      row({ id: 2, name: 'Grup A', subjectName: 'Matematik' }),
      row({ id: 3, name: 'Grup A', subjectName: 'İngilizce' }),
      row({ id: 4, name: 'Grup A', subjectName: 'Çince' }),
    ]

    // Ç < İ < M — `localeCompare('tr')` olmadan Ç ve İ Z'den sonraya düşerdi.
    expect(sortGroups(rows).map((r) => `${r.subjectName}/${r.name}`)).toEqual([
      'Çince/Grup A',
      'İngilizce/Grup A',
      'Matematik/Grup A',
      'Matematik/Grup B',
    ])
  })

  it('aynı adlı iki grupta sıra id ile sabitlenir', () => {
    const rows = [
      row({ id: 7, name: 'grup a' }),
      row({ id: 3, name: 'Grup A' }),
    ]
    expect(sortGroups(rows).map((r) => r.id)).toEqual([3, 7])
  })

  it('girdi dizisini değiştirmez', () => {
    const rows = [row({ id: 2, name: 'Grup B' }), row({ id: 1, name: 'Grup A' })]
    sortGroups(rows)
    expect(rows.map((r) => r.id)).toEqual([2, 1])
  })
})

describe('sayfalama', () => {
  const rows = Array.from({ length: 25 }, (_, index) =>
    row({ id: index + 1, name: `Grup ${index + 1}` }),
  )

  it('sıralanmış listeyi böler', () => {
    const first = paginate(sortGroups(rows), 1, 10)
    expect(first.rows).toHaveLength(10)
    expect(first.pageCount).toBe(3)
    expect(first.total).toBe(25)
  })

  it('çip daraltınca son sayfaya kayar, boş ekran göstermez', () => {
    expect(paginate(filterByChip(rows, 'archived'), 3, 10).page).toBe(1)
  })
})
