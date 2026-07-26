import { describe, expect, it } from 'vitest'
import {
  addDays,
  DEFAULT_END_MIN,
  DEFAULT_START_MIN,
  gridRange,
  hourLabels,
  monthWeeks,
  nowSlots,
  placeBlocks,
  scrollTopForNow,
  shiftMonth,
  weekDays,
  weekStart,
  type GridItem,
} from './calendarGrid'

/**
 * Izgaranın geometrisi ve şerit algoritması (`/faz-05c §4`).
 *
 * Testlerin çoğu `/faz-05c-karar`'ın denemesinden geldi ve orada 11'i ilk koşuda
 * geçmişti; **denemenin verisini denemenin kendisi seçtiği için** yakalayamadığı şey
 * aralık dışı dersti. Bu dosyanın en önemli bloğu o yüzden "aralık dışı ders".
 */

const ders = (id: number, from: string, to: string, day = '2026-07-21'): GridItem => ({
  id,
  startsAt: `${day} ${from}`,
  endsAt: `${day} ${to}`,
})

/** Varsayılan 08:00–22:00 aralığı — hepsi aralık içindeki testler için. */
const DEFAULT_RANGE = gridRange([])

describe('gridRange — aralık', () => {
  it('hepsi aralık içindeyken varsayılan 08:00–22:00 kalır', () => {
    const range = gridRange([ders(1, '09:00', '10:30'), ders(2, '20:00', '22:00')])
    expect([range.startMin, range.endMin]).toEqual([DEFAULT_START_MIN, DEFAULT_END_MIN])
    // EKRANLAR §122: 28 dilim. Rahat yoğunlukta 840px, sıkıda 616px.
    expect(range.slotCount).toBe(28)
  })

  it('ders yoksa da varsayılan aralık kurulur', () => {
    expect(gridRange([])).toEqual({ startMin: 480, endMin: 1320, slotCount: 28 })
  })

  it('aralık dışı ders ızgarayı TAM SAATE yuvarlayarak genişletir', () => {
    // 5B'nin gerçek ekran görüntüsünde 00:15'lik bir ders vardı; uygulama ders saatini
    // hiçbir yerde kısıtlamıyor.
    const range = gridRange([ders(1, '07:30', '08:30'), ders(2, '22:15', '23:00')])
    expect(range.startMin).toBe(7 * 60)
    expect(range.endMin).toBe(23 * 60)
    expect(range.slotCount).toBe(32)
  })

  it('gece yarısını aşan ders gün sonuna kadar genişletir', () => {
    const gece: GridItem = { id: 1, startsAt: '2026-07-21 23:30', endsAt: '2026-07-22 00:30' }
    expect(gridRange([gece]).endMin).toBe(24 * 60)
  })

  it('okunamayan saat aralığı bozmaz', () => {
    const bozuk: GridItem = { id: 1, startsAt: 'çöp', endsAt: 'çöp' }
    expect(gridRange([bozuk, ders(2, '09:00', '10:00')])).toEqual(DEFAULT_RANGE)
  })
})

describe('placeBlocks — şerit atama', () => {
  const lay = (items: GridItem[], range = DEFAULT_RANGE) => placeBlocks(items, range).blocks

  it('çakışmayan dersler tek şeritte kalır', () => {
    const placed = lay([ders(1, '09:00', '10:00'), ders(2, '11:00', '12:00')])
    expect(placed.map((b) => [b.lane, b.laneCount])).toEqual([
      [0, 1],
      [0, 1],
    ])
  })

  it('bitişik ders çakışma sayılmaz', () => {
    // 09:00–10:00 ve 10:00–11:00: `repo::schedule::detect_conflicts` de böyle sayıyor.
    const placed = lay([ders(1, '09:00', '10:00'), ders(2, '10:00', '11:00')])
    expect(placed.every((b) => b.laneCount === 1)).toBe(true)
  })

  it('çakışan iki ders yan yana iki şeride bölünür', () => {
    const placed = lay([ders(1, '13:00', '14:00'), ders(2, '13:30', '14:30')])
    expect(placed.map((b) => b.lane)).toEqual([0, 1])
    expect(placed.every((b) => b.laneCount === 2)).toBe(true)
  })

  it('zincirleme çakışmada A ile C aynı şeridi PAYLAŞMAZ', () => {
    // A–B çakışıyor, B–C çakışıyor, A–C çakışmıyor. Şerit sayısı kümenin tamamına
    // göre belirlenmezse A ile C aynı genişliği alır ve ekranda üst üste biner.
    const placed = lay([
      ders(1, '13:00', '14:00'),
      ders(2, '13:30', '14:30'),
      ders(3, '14:00', '15:00'),
    ])
    expect(placed.every((b) => b.laneCount === 2)).toBe(true)
    // C, A'nın boşalttığı şeride girer — üçüncü şerit açılmaz.
    expect(placed.map((b) => b.lane)).toEqual([0, 1, 0])
  })

  it('üç ders aynı anda çakışırsa üç şerit açılır', () => {
    const placed = lay([
      ders(1, '13:00', '15:00'),
      ders(2, '13:30', '15:00'),
      ders(3, '14:00', '15:00'),
    ])
    expect(placed.map((b) => b.lane)).toEqual([0, 1, 2])
    expect(placed.every((b) => b.laneCount === 3)).toBe(true)
  })

  it('altı ders aynı anda çakışırsa altı şerit açılır', () => {
    // Denemenin hiç görmediği yoğunluk; `npm run seed` verisinde mümkün.
    const items = Array.from({ length: 6 }, (_, index) => ders(index + 1, '10:00', '11:00'))
    const placed = lay(items)
    expect(placed.map((b) => b.lane)).toEqual([0, 1, 2, 3, 4, 5])
    expect(placed.every((b) => b.laneCount === 6)).toBe(true)
  })

  it('ayrı kümeler birbirinin şerit sayısını kirletmez', () => {
    const placed = lay([
      ders(1, '09:00', '10:00'),
      ders(2, '13:00', '14:00'),
      ders(3, '13:30', '14:30'),
    ])
    expect(placed.map((b) => b.laneCount)).toEqual([1, 2, 2])
  })

  it('konum ve yükseklik DİLİM cinsinden — pikselden bağımsız', () => {
    const block = lay([ders(1, '09:00', '10:30')])[0]!
    // 08:00'dan 09:00'a 2 dilim; 90 dakika 3 dilim.
    expect(block.topSlots).toBe(2)
    expect(block.heightSlots).toBe(3)
  })

  it('bir dilimden kısa ders çizilebilir kalır', () => {
    expect(lay([ders(1, '09:00', '09:15')])[0]!.heightSlots).toBe(1)
  })

  it('girdi sırası çıktıyı değiştirmez', () => {
    const ileri = lay([ders(1, '13:00', '14:00'), ders(2, '13:30', '14:30')])
    const geri = lay([ders(2, '13:30', '14:30'), ders(1, '13:00', '14:00')])
    expect(geri).toEqual(ileri)
  })

  it('YALNIZCA saati görür — farklı günler çağırana ayrılmak zorunda', () => {
    // Gerçek `seed` verisiyle yakalanan hata: haftanın tamamı tek çağrıya verilince
    // Pazartesi 16:00 ile Çarşamba 16:00 çakışan iki ders sayıldı, ikisi de yarım
    // genişlikte çizildi ve çakışma konturu aldı. Algoritma sütunu görmüyor; bu bir
    // eksiklik değil sözleşme, ama yazılı olmadığı için ekran ona güvenmişti.
    const pazartesi = ders(1, '16:00', '17:00', '2026-07-20')
    const carsamba = ders(2, '16:00', '17:00', '2026-07-22')

    const birlikte = lay([pazartesi, carsamba])
    expect(birlikte.every((b) => b.laneCount === 2)).toBe(true)

    // Doğru kullanım: gün başına bir çağrı.
    expect(lay([pazartesi])[0]!.laneCount).toBe(1)
    expect(lay([carsamba])[0]!.laneCount).toBe(1)
  })

  it('saati okunamayan ders SESSİZCE atılmaz, ayrı listede döner', () => {
    const bozuk: GridItem = { id: 9, startsAt: '2026-07-21 çöp', endsAt: '2026-07-21 10:00' }
    const layout = placeBlocks([bozuk, ders(1, '09:00', '10:00')], DEFAULT_RANGE)
    expect(layout.blocks.map((b) => b.item.id)).toEqual([1])
    expect(layout.unreadable.map((row) => row.id)).toEqual([9])
  })
})

describe('aralık dışı ders — hiçbir blok negatif ya da taşan konum almaz', () => {
  it('07:30 ve 23:00 dersleri genişleyen ızgaraya SIĞAR', () => {
    const items = [ders(1, '07:30', '08:30'), ders(2, '12:00', '13:00'), ders(3, '22:30', '23:00')]
    const range = gridRange(items)
    const { blocks } = placeBlocks(items, range)

    expect(blocks).toHaveLength(3)
    for (const block of blocks) {
      expect(block.topSlots).toBeGreaterThanOrEqual(0)
      expect(block.topSlots + block.heightSlots).toBeLessThanOrEqual(range.slotCount)
    }
    // 07:30 dersi ızgaranın ilk yarım dilimine oturur, üstünde kalmaz.
    expect(blocks[0]!.topSlots).toBe(1)
  })

  it('00:15 dersi ızgarayı gece yarısına indirir', () => {
    const items = [ders(1, '00:15', '01:15')]
    const range = gridRange(items)
    const { blocks } = placeBlocks(items, range)

    expect(range.startMin).toBe(0)
    expect(blocks[0]!.topSlots).toBe(0.5)
    expect(blocks[0]!.topSlots).toBeGreaterThanOrEqual(0)
  })

  it('gece yarısını aşan ders gün sonunda kırpılır, ertesi güne sarkmaz', () => {
    const gece: GridItem = { id: 1, startsAt: '2026-07-21 23:30', endsAt: '2026-07-22 00:30' }
    const range = gridRange([gece])
    const { blocks } = placeBlocks([gece], range)
    expect(blocks[0]!.topSlots + blocks[0]!.heightSlots).toBe(range.slotCount)
  })
})

describe('saat cetveli', () => {
  it('varsayılan aralıkta 08:00 ile başlar, 21:00 ile biter', () => {
    const labels = hourLabels(DEFAULT_RANGE)
    expect(labels).toHaveLength(14)
    expect(labels[0]).toBe('08:00')
    expect(labels[labels.length - 1]).toBe('21:00')
  })

  it('genişleyen aralıkta etiketler de genişler', () => {
    const labels = hourLabels(gridRange([ders(1, '07:00', '08:00')]))
    expect(labels[0]).toBe('07:00')
    expect(labels).toHaveLength(15)
  })
})

describe('"şimdi" çizgisi ve açılış kaydırması', () => {
  it('çizgi aralığın içindeyse dilim cinsinden konum verir', () => {
    // 14:30 → 08:00'dan 6.5 saat = 13 dilim.
    expect(nowSlots(14 * 60 + 30, DEFAULT_RANGE)).toBe(13)
  })

  it('aralığın dışında çizgi ÇİZİLMEZ, kenara yapıştırılmaz', () => {
    expect(nowSlots(7 * 60, DEFAULT_RANGE)).toBeNull()
    expect(nowSlots(23 * 60, DEFAULT_RANGE)).toBeNull()
  })

  it('kaydırma "şimdi"yi görünür alanın üçte birine oturtur', () => {
    // 14:00 → 12 dilim × 30px = 360px; 600px'lik pencerede 360 − 200 = 160.
    expect(scrollTopForNow(14 * 60, DEFAULT_RANGE, 30, 600)).toBe(160)
  })

  it('sabah saatinde başa kadar kaydırır, negatife düşmez', () => {
    expect(scrollTopForNow(8 * 60 + 30, DEFAULT_RANGE, 30, 600)).toBe(0)
  })

  it('akşam saatinde ızgaranın sonunu aşmaz', () => {
    // Izgara 28 × 30 = 840px, pencere 600px → en fazla 240px kaydırılabilir.
    expect(scrollTopForNow(21 * 60 + 30, DEFAULT_RANGE, 30, 600)).toBe(240)
  })

  it('ızgara pencereye sığıyorsa hiç kaydırmaz', () => {
    expect(scrollTopForNow(20 * 60, DEFAULT_RANGE, 30, 900)).toBe(0)
  })

  it('yoğunluk değişince kaydırma da takip eder', () => {
    // 14:00 = 12 dilim. Rahat 12 × 30 = 360, sıkı 12 × 22 = 264; ikisinden de
    // pencerenin üçte biri (100px) düşülüyor.
    expect(scrollTopForNow(14 * 60, DEFAULT_RANGE, 30, 300)).toBe(260)
    expect(scrollTopForNow(14 * 60, DEFAULT_RANGE, 22, 300)).toBe(164)
  })
})

describe('yoğunluk — blok konumları dilim cinsinden kaldığı için takip eder', () => {
  it('aynı blok iki yoğunlukta aynı dilim değerini verir', () => {
    // Piksele çevirmeyi CSS yapıyor (`--calendar-slot-height`), bu dosya değil.
    const block = placeBlocks([ders(1, '09:00', '10:30')], DEFAULT_RANGE).blocks[0]!
    expect(block.topSlots * 30).toBe(60)
    expect(block.topSlots * 22).toBe(44)
    expect(block.heightSlots * 30).toBe(90)
    expect(block.heightSlots * 22).toBe(66)
  })
})

describe('tarih gezinmesi', () => {
  it('hafta Pazartesi başlar', () => {
    // 2026-07-26 Pazar → aynı haftanın Pazartesi'si 2026-07-20.
    expect(weekStart('2026-07-26')).toBe('2026-07-20')
    expect(weekStart('2026-07-20')).toBe('2026-07-20')
  })

  it('hafta 7 gün ve Pazar ile biter', () => {
    const days = weekDays('2026-07-23')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-07-20')
    expect(days[6]).toBe('2026-07-26')
  })

  it('gün atlama ay ve yıl sınırını geçer', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('ay atlama 31 Mart tuzağına düşmez', () => {
    // Gün numarası korunsaydı 31 Nisan aranır ve 1 Mayıs'a taşınırdı.
    expect(shiftMonth('2026-03-31', 1)).toBe('2026-04-01')
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('ay ızgarası 6 hafta × 7 gün ve Pazartesi ile başlar', () => {
    const weeks = monthWeeks('2026-07-15')
    expect(weeks).toHaveLength(6)
    expect(weeks[0]).toHaveLength(7)
    // 2026-07-01 Çarşamba → ızgara 2026-06-29 Pazartesi'den başlar.
    expect(weeks[0]![0]).toBe('2026-06-29')
    expect(weeks[5]![6]).toBe('2026-08-09')
  })

  it('bozuk tarih gezinmeyi çökertmez', () => {
    expect(addDays('çöp', 1)).toBe('çöp')
    expect(weekStart('çöp')).toBe('çöp')
    expect(monthWeeks('çöp')).toEqual([])
  })
})
