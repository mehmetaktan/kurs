import { describe, expect, it } from 'vitest'
import { formatKurus, formatLira, parseKurus } from './format'

/**
 * CLAUDE.md > Para: *"Para ile ilgili her fonksiyonun testi olur. Bu pazarlık konusu değil."*
 *
 * Bu dosya `src-tauri/src/money.rs`'teki testlerin ikizidir. İki taraf AYNI değerleri
 * üretmek zorunda: Rust tutarı biçimleyip arayüze gönderiyor, arayüz kullanıcının
 * yazdığını ayrıştırıp Rust'a geri veriyor. Biri kayarsa kuruş kaybolur.
 */

describe('formatKurus', () => {
  it('kuruşu Türkçe para metnine çevirir', () => {
    expect(formatKurus(0)).toBe('0,00')
    expect(formatKurus(5)).toBe('0,05')
    expect(formatKurus(50)).toBe('0,50')
    expect(formatKurus(100)).toBe('1,00')
    expect(formatKurus(25000)).toBe('250,00')
    expect(formatKurus(123456)).toBe('1.234,56')
    expect(formatKurus(100000000)).toBe('1.000.000,00')
  })

  it('negatifte U+2212 kullanır, ASCII tire değil (ADR-014)', () => {
    expect(formatKurus(-123456)).toBe('−1.234,56')
    expect(formatKurus(-120000)).toBe('−1.200,00')
    expect(formatKurus(-100).includes('-')).toBe(false)
    // Tasarımdaki `balance: -1200` → "−1.200,00 ₺"
    expect(formatLira(-120000)).toBe('−1.200,00 ₺')
  })

  it('tam sayı olmayan girdiyi reddeder — float yasak (ADR-003)', () => {
    expect(() => formatKurus(12.5)).toThrow()
  })
})

describe('parseKurus', () => {
  it('Türkçe para metnini kuruşa çevirir', () => {
    expect(parseKurus('1.234,56')).toBe(123456)
    expect(parseKurus('1234,56')).toBe(123456)
    expect(parseKurus('250')).toBe(25000)
    expect(parseKurus('250,5')).toBe(25050)
    expect(parseKurus('0,05')).toBe(5)
    expect(parseKurus(' 1.234,56 ₺ ')).toBe(123456)
  })

  it('her iki eksi işaretini de kabul eder', () => {
    expect(parseKurus('−1.200,00')).toBe(-120000)
    expect(parseKurus('-1.200,00')).toBe(-120000)
  })

  it('bozuk girdide null döner', () => {
    for (const bad of ['', 'abc', '12,345', ',', '1.2,3.4']) {
      expect(parseKurus(bad), `girdi: ${JSON.stringify(bad)}`).toBeNull()
    }
  })
})

describe('gidiş-dönüş', () => {
  it('formatKurus → parseKurus aynı değeri verir', () => {
    for (const value of [0, 1, 99, 100, 25000, 123456, -123456, 999999999]) {
      expect(parseKurus(formatKurus(value)), `değer: ${value}`).toBe(value)
    }
  })
})

describe('Rust karşılığıyla aynı çıktı', () => {
  // src-tauri/src/money.rs `bicimlendirme` ve `negatifte_u2212_kullanilir`
  // testlerindeki BİREBİR aynı beklentiler. İkisi ayrışırsa buradan görülür.
  const rustBeklentileri: Array<[number, string]> = [
    [0, '0,00'],
    [5, '0,05'],
    [50, '0,50'],
    [100, '1,00'],
    [25000, '250,00'],
    [123456, '1.234,56'],
    [100000000, '1.000.000,00'],
    [-123456, '−1.234,56'],
    [-120000, '−1.200,00'],
  ]

  it.each(rustBeklentileri)('formatKurus(%i) === %s', (kurus, beklenen) => {
    expect(formatKurus(kurus)).toBe(beklenen)
  })
})
