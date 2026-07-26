import { describe, expect, it } from 'vitest'
import { gridRange } from './calendarGrid'
import {
  DRAG_THRESHOLD_PX,
  dragOutcome,
  isDrag,
  isDropAllowed,
  isSamePlace,
  snapToSlot,
  type DragGeometry,
  type DragOrigin,
} from './drag'

/**
 * Sürükleme kuralları (`/faz-05c §4`, ADR-030). Hepsi saf aritmetik — DOM yok, çünkü
 * Pointer Events'in girdisi sıradan koordinat çiftleri. HTML5 DnD'de aynı testler
 * `DataTransfer` taklidi isterdi.
 */

const GEO: DragGeometry = {
  columnWidth: 120,
  dayCount: 7,
  slotHeightPx: 30,
  range: gridRange([]),
}

/** Salı (index 1), 16:00, 60 dakika. */
const ORIGIN: DragOrigin = { startMin: 16 * 60, durationMin: 60, dayIndex: 1 }

describe('5px eşiği (R3.7)', () => {
  it('eşiğin altındaki hareket TIKLAMADIR', () => {
    expect(isDrag(0, 0)).toBe(false)
    expect(isDrag(3, 3)).toBe(false) // 4.24px
    expect(isDrag(4.9, 0)).toBe(false)
  })

  it('tam 5px sürüklemedir', () => {
    expect(isDrag(5, 0)).toBe(true)
    expect(isDrag(0, -5)).toBe(true)
  })

  it('karşılaştırma YARIÇAP, kare değil', () => {
    // 4px sağa + 4px aşağı = 5.66px, yani eşiği geçmiş bir hareket. `|dx|≤5 && |dy|≤5`
    // kuralında ikisi de "tıklama" sayılırdı; `/faz-05c-karar` react-big-calendar'ı
    // tam olarak bunun için eledi.
    expect(isDrag(4, 4)).toBe(true)
    expect(isDrag(5, 5)).toBe(true)
    // Yarıçapın içinde kalan çapraz hareket hâlâ tıklama.
    expect(isDrag(3, 3)).toBe(false)
  })

  it('eşik 5', () => {
    expect(DRAG_THRESHOLD_PX).toBe(5)
  })

  it('eşiğin altında dragOutcome tıklama döner', () => {
    expect(dragOutcome(2, 2, ORIGIN, GEO)).toEqual({ kind: 'click' })
  })
})

describe('30 dk kilidi', () => {
  it('en yakın yarım saate yuvarlar', () => {
    expect(snapToSlot(16 * 60 + 7)).toBe(16 * 60)
    expect(snapToSlot(16 * 60 + 20)).toBe(16 * 60 + 30)
    expect(snapToSlot(16 * 60 + 45)).toBe(17 * 60)
  })

  it('sürükleme sonucu daima yarım saatin katı', () => {
    for (const dy of [7, 13, 29, 44, 61, 97]) {
      const out = dragOutcome(0, dy, ORIGIN, GEO)
      expect(out.kind).toBe('move')
      if (out.kind === 'move') expect(out.startMin % 30).toBe(0)
    }
  })

  it('bir dilim aşağı sürüklemek dersi 30 dk ileri alır', () => {
    expect(dragOutcome(0, 30, ORIGIN, GEO)).toEqual({
      kind: 'move',
      dayIndex: 1,
      startMin: 16 * 60 + 30,
    })
  })

  it('yukarı sürüklemek geri alır', () => {
    expect(dragOutcome(0, -60, ORIGIN, GEO)).toEqual({
      kind: 'move',
      dayIndex: 1,
      startMin: 15 * 60,
    })
  })
})

describe('sütun değişimi', () => {
  it('bir sütun sağa sürüklemek günü değiştirir', () => {
    const out = dragOutcome(120, 0, ORIGIN, GEO)
    expect(out).toEqual({ kind: 'move', dayIndex: 2, startMin: 16 * 60 })
  })

  it('yarım sütundan az yatay hareket günü değiştirmez', () => {
    const out = dragOutcome(50, 30, ORIGIN, GEO)
    expect(out.kind === 'move' && out.dayIndex).toBe(1)
  })

  it('ızgaranın dışına taşınamaz — sütun kenetlenir', () => {
    const sol = dragOutcome(-900, 0, ORIGIN, GEO)
    const sag = dragOutcome(900, 0, ORIGIN, GEO)
    expect(sol.kind === 'move' && sol.dayIndex).toBe(0)
    expect(sag.kind === 'move' && sag.dayIndex).toBe(6)
  })

  it('gün görünümünde tek sütun var, yatay hareket etkisiz (ADR-038)', () => {
    const out = dragOutcome(500, 0, { ...ORIGIN, dayIndex: 0 }, { ...GEO, dayCount: 1 })
    expect(out.kind === 'move' && out.dayIndex).toBe(0)
  })
})

describe('saat kenetlemesi', () => {
  it('ızgaranın üstüne çıkamaz', () => {
    const out = dragOutcome(0, -3000, ORIGIN, GEO)
    expect(out.kind === 'move' && out.startMin).toBe(GEO.range.startMin)
  })

  it('ders ızgaranın altından TAŞMAZ — son slot süresi kadar yukarıda', () => {
    const out = dragOutcome(0, 3000, ORIGIN, GEO)
    // 22:00 − 60 dk = 21:00.
    expect(out.kind === 'move' && out.startMin).toBe(21 * 60)
  })

  it('genişlemiş ızgarada kenetleme yeni sınırları kullanır', () => {
    const geniş: DragGeometry = {
      ...GEO,
      range: gridRange([{ id: 1, startsAt: '2026-07-21 07:00', endsAt: '2026-07-21 08:00' }]),
    }
    const out = dragOutcome(0, -3000, ORIGIN, geniş)
    expect(out.kind === 'move' && out.startMin).toBe(7 * 60)
  })

  it('yoğunluk değişince aynı piksel farkı başka bir saat verir', () => {
    // Sıkı yoğunlukta dilim 22px: 66px = 3 dilim = 90 dk.
    const out = dragOutcome(0, 66, ORIGIN, { ...GEO, slotHeightPx: 22 })
    expect(out.kind === 'move' && out.startMin).toBe(17 * 60 + 30)
  })
})

describe('kapalı gün hedef kabul etmez (K-2)', () => {
  const closed = new Set(['2026-07-26', '2026-07-23'])

  it('tatil ve haftalık kapalı gün reddedilir', () => {
    expect(isDropAllowed('2026-07-26', closed)).toBe(false)
    expect(isDropAllowed('2026-07-23', closed)).toBe(false)
  })

  it('açık gün kabul edilir', () => {
    expect(isDropAllowed('2026-07-22', closed)).toBe(true)
  })

  it('kapalı gün listesi boşken her gün açıktır', () => {
    expect(isDropAllowed('2026-07-26', new Set())).toBe(true)
  })
})

describe('yerinde bırakma', () => {
  it('aynı gün ve saate bırakmak değişiklik değildir', () => {
    // 3px hareket zaten tıklama; burada eşiği geçip aynı slota dönen hareket sınanıyor.
    const out = dragOutcome(0, 8, ORIGIN, GEO)
    expect(isSamePlace(out, ORIGIN)).toBe(true)
  })

  it('başka slota bırakmak değişikliktir', () => {
    expect(isSamePlace(dragOutcome(0, 30, ORIGIN, GEO), ORIGIN)).toBe(false)
  })
})
