export interface AttendanceTiming {
  status: string
  attendanceTaken: boolean
  startsAt: string
  endsAt: string
}

export function canTakeAttendance(row: AttendanceTiming, now: string): boolean {
  return row.status !== 'cancelled' && now >= row.startsAt
}

export function isAttendanceOverdue(row: AttendanceTiming, now: string): boolean {
  return row.status !== 'cancelled' && !row.attendanceTaken && now >= row.endsAt
}
