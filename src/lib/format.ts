import { tr } from '../i18n/tr'

/**
 * Kuruş → Türkçe para metni (ADR-003).
 * Binlik ayıracı '.', ondalık ',' ve eksi işareti U+2212 (ASCII tire değil, ADR-014).
 *
 *   123456  → "1.234,56"
 *  -123456  → "−1.234,56"
 *
 * Rust tarafındaki `money::format_kurus` ile aynı davranışı üretir; ikisinin de testi var.
 */
export function formatKurus(kurus: number): string {
  if (!Number.isInteger(kurus)) {
    throw new Error(`formatKurus tam sayı bekler, geldi: ${kurus}`)
  }
  const negative = kurus < 0
  const abs = Math.abs(kurus)
  const lira = Math.trunc(abs / 100)
  const cents = abs % 100

  const liraText = lira.toLocaleString('tr-TR')
  const centsText = String(cents).padStart(2, '0')
  const body = `${liraText},${centsText}`

  return negative ? `${tr.units.minus}${body}` : body
}

/** Kuruş → "1.234,56 ₺" */
export function formatLira(kurus: number): string {
  return formatKurus(kurus) + tr.units.currencySuffix
}

/**
 * Türkçe para metni → kuruş. Hem '−' (U+2212) hem '-' kabul edilir.
 * Ayrıştırılamayan girdi `null` döner — çağıran tarafta Türkçe hata gösterilir.
 */
export function parseKurus(input: string): number | null {
  const raw = input.replace(/\s|₺/g, '')
  if (raw === '') return null

  const negative = raw.startsWith('−') || raw.startsWith('-')
  const rest = negative ? raw.slice(1) : raw

  // Rust'taki `money::parse_kurus` ile AYNI sırada çalışır: önce virgülden bölünür,
  // nokta YALNIZCA lira tarafından atılır. Tüm noktaları baştan atmak, virgülden
  // sonra gelen bir noktayı da yutar ve "1.2,3.4" gibi bozuk girdiyi sessizce
  // 1234'e çevirirdi — Rust ise onu reddediyor. İki taraf ayrışırsa kuruş kaybolur.
  const comma = rest.indexOf(',')
  const liraPart = comma === -1 ? rest : rest.slice(0, comma)
  const centsPart = comma === -1 ? '' : rest.slice(comma + 1)

  const liraDigits = liraPart.replace(/\./g, '')
  if (liraDigits === '' || !/^\d+$/.test(liraDigits)) return null
  if (centsPart.length > 2 || (centsPart !== '' && !/^\d+$/.test(centsPart))) return null

  // "1,5" → 50 kuruş, "1,50" → 50 kuruş. Tek basamak onda birdir.
  const cents =
    centsPart.length === 0 ? 0 : centsPart.length === 1 ? Number(centsPart) * 10 : Number(centsPart)

  const value = Number(liraDigits) * 100 + cents
  if (!Number.isSafeInteger(value)) return null
  return negative ? -value : value
}
