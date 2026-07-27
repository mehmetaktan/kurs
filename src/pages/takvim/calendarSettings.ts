import type { Setting } from '../../lib/api'
import type { CalendarAppointment } from './appointments'
import { dateToTime } from './calendarDateAdapter'

export interface CalendarSettings {
  dayStart: string
  dayEnd: string
  slotMinutes: number
  defaultSessionMinutes: number
}

const DEFAULTS: CalendarSettings = {
  dayStart: '08:00',
  dayEnd: '22:00',
  slotMinutes: 30,
  defaultSessionMinutes: 60,
}

/** `Tanımlar → Genel > Çalışma düzeni` satırlarını takvimin tek ayar nesnesine çevirir. */
export function calendarSettingsOf(rows: readonly Setting[]): CalendarSettings {
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const dayStart = validTime(values.day_start) ?? DEFAULTS.dayStart
  const dayEnd = validTime(values.day_end) ?? DEFAULTS.dayEnd
  const startMin = timeMinutes(dayStart)
  const endMin = timeMinutes(dayEnd)

  return {
    dayStart: startMin < endMin ? dayStart : DEFAULTS.dayStart,
    dayEnd: startMin < endMin ? dayEnd : DEFAULTS.dayEnd,
    slotMinutes: positiveInteger(values.slot_minutes, DEFAULTS.slotMinutes),
    defaultSessionMinutes: positiveInteger(
      values.default_session_minutes,
      DEFAULTS.defaultSessionMinutes,
    ),
  }
}

/**
 * Ayarlar normal görünür aralığı belirler; aralık dışındaki gerçek ders saklanmaz.
 * Eski takvimin güvenlik sözleşmesi korunur ve sınırlar tam saate genişletilir.
 */
export function visibleDayHours(
  settings: CalendarSettings,
  appointments: readonly Pick<CalendarAppointment, 'startDate' | 'endDate'>[],
): { start: number; end: number } {
  let start = timeMinutes(settings.dayStart) / 60
  let end = timeMinutes(settings.dayEnd) / 60

  for (const appointment of appointments) {
    const appointmentStart = timeMinutes(dateToTime(appointment.startDate)) / 60
    const sameDay =
      appointment.startDate.getFullYear() === appointment.endDate.getFullYear() &&
      appointment.startDate.getMonth() === appointment.endDate.getMonth() &&
      appointment.startDate.getDate() === appointment.endDate.getDate()
    const appointmentEnd = sameDay
      ? timeMinutes(dateToTime(appointment.endDate)) / 60
      : 24
    start = Math.min(start, Math.floor(appointmentStart))
    end = Math.max(end, Math.ceil(appointmentEnd))
  }

  return {
    start: Math.max(0, start),
    end: Math.min(24, Math.max(start + settings.slotMinutes / 60, end)),
  }
}

export function timeMinutes(value: string): number {
  const [hour = 0, minute = 0] = value.split(':').map(Number)
  return hour * 60 + minute
}

function validTime(value: string | undefined): string | null {
  if (value === undefined || !/^\d{2}:\d{2}$/.test(value)) return null
  const minutes = timeMinutes(value)
  return minutes >= 0 && minutes < 24 * 60 ? value : null
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
