import { tr } from '../../i18n/tr'
import type { DaySessionRow } from '../../lib/api'
import { formatDateWithWeekday, formatTime } from '../../lib/format'
import { Badge, Button, Modal } from '../../ui'
import type { SessionAction } from '../dersler/SessionActions'
import styles from './Calendar.module.css'

interface Props {
  row: DaySessionRow | null
  onClose: () => void
  onEdit: (row: DaySessionRow) => void
  onAttendance: (row: DaySessionRow) => void
  onAction: (row: DaySessionRow, action: SessionAction) => void
}

/** Tek tıklamanın açtığı küçük ayrıntı/eylem paneli. İş mantığı mevcut formlardadır. */
export function SessionDetailPanel({
  row,
  onClose,
  onEdit,
  onAttendance,
  onAction,
}: Props) {
  if (row === null) return null
  return (
    <Modal open title={tr.calendar.details.title} onClose={onClose}>
      <div className={styles.detailPanel}>
        <div>
          <p className={styles.detailSubject}>{row.subjectName}</p>
          <p className={styles.detailTitle}>{row.title}</p>
          <p className={styles.detailMeta}>
            {formatDateWithWeekday(row.startsAt.slice(0, 10))}
            {tr.units.separator}
            {formatTime(row.startsAt)}–{formatTime(row.endsAt)}
          </p>
          <p className={styles.detailMeta}>
            {row.teacherName ?? tr.units.emptyValue}
          </p>
        </div>
        <div className={styles.detailBadges}>
          <Badge tone="neutral">
            {row.kind === 'group' ? tr.calendar.group : tr.calendar.solo}
          </Badge>
          {row.isMakeup && <Badge tone="warn">{tr.calendar.makeup}</Badge>}
          {row.status === 'cancelled' && (
            <Badge tone="danger">{tr.calendar.cancelled}</Badge>
          )}
          {row.attendanceTaken && <Badge tone="neutral">{tr.calendar.locked}</Badge>}
        </div>
        <div className={styles.detailActions}>
          <Button variant="primary" onClick={() => onEdit(row)}>
            {tr.calendar.details.edit}
          </Button>
          <Button onClick={() => onAttendance(row)}>
            {row.attendanceTaken
              ? tr.calendar.details.attendanceView
              : tr.calendar.details.attendanceTake}
          </Button>
          <Button
            disabled={row.attendanceTaken}
            onClick={() => onAction(row, 'reschedule')}
          >
            {tr.calendar.details.reschedule}
          </Button>
          <Button onClick={() => onAction(row, 'cancel')}>
            {tr.calendar.details.cancel}
          </Button>
          <Button variant="danger" onClick={() => onAction(row, 'remove')}>
            {tr.calendar.details.archive}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
