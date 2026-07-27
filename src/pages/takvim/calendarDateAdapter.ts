/**
 * SQLite/Rust tarafındaki yerel duvar saati ile Scheduler'ın `Date` değerleri
 * arasındaki tek geçit (ADR-017). Saat dilimi dönüşümü yapılmaz; alanlar tek tek
 * aktarılır. Böylece UTC serileştirmesi gün veya saat kaydıramaz.
 */
const WALL_CLOCK =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/

export function wallClockToDate(value: string): Date {
  const match = WALL_CLOCK.exec(value)
  if (match === null) throw new Error('Geçersiz yerel tarih ve saat')
  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error('Geçersiz yerel tarih ve saat')
  }
  return date
}

export function dateToWallClock(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Geçersiz takvim tarihi')
  return `${dateToDay(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export function dateToDay(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Geçersiz takvim tarihi')
  return `${String(value.getFullYear()).padStart(4, '0')}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function dateToTime(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Geçersiz takvim tarihi')
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

/** Takvimin işletme ayarındaki hücre aralığına en yakın duvar saati. */
export function snapDateToInterval(value: Date, intervalMinutes: number): Date {
  const minutes = value.getHours() * 60 + value.getMinutes()
  const interval =
    Number.isInteger(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 30
  const snapped = Math.round(minutes / interval) * interval
  const result = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    snapped,
    0,
    0,
  )
  return result
}

/** Eski çağıranlar için 30 dakikalık uyumluluk sarmalayıcısı. */
export function snapDateToHalfHour(value: Date): Date {
  return snapDateToInterval(value, 30)
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
