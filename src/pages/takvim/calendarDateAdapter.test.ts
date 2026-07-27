import { describe, expect, it } from 'vitest'
import {
  dateToWallClock,
  durationMinutes,
  snapDateToHalfHour,
  wallClockToDate,
} from './calendarDateAdapter'

describe('CalendarDateAdapter', () => {
  it.each([
    '2026-07-27 16:30',
    '2026-12-31 23:30',
    '2027-01-01 00:30',
    '2026-03-29 00:00',
  ])('%s duvar saatini kayıpsız çevirir', (stamp) => {
    expect(dateToWallClock(wallClockToDate(stamp))).toBe(stamp)
  })

  it('ay ve yıl sınırında gece yarısını aşan dersi korur', () => {
    const start = wallClockToDate('2026-12-31 23:30')
    const end = wallClockToDate('2027-01-01 00:30')
    expect(durationMinutes(start, end)).toBe(60)
    expect(dateToWallClock(start)).toBe('2026-12-31 23:30')
    expect(dateToWallClock(end)).toBe('2027-01-01 00:30')
  })

  it('30 dakika adımına yuvarlar', () => {
    expect(dateToWallClock(snapDateToHalfHour(wallClockToDate('2026-07-27 16:17')))).toBe(
      '2026-07-27 16:30',
    )
  })
})
