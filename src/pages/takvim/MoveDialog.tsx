import { tr } from '../../i18n/tr'
import type { DaySessionRow, RescheduleScope } from '../../lib/api'
import { formatDateWithWeekday, formatTime } from '../../lib/format'
import { Modal, ModalOption } from '../../ui'
import { sessionLabel } from '../dersler/SessionActions'
import styles from './Calendar.module.css'

export interface PendingMove {
  row: DaySessionRow
  /** `'YYYY-MM-DD'` */
  day: string
  /** `'HH:MM'` */
  startTime: string
  /** Taşıma veya yeniden boyutlandırma sonrasındaki süre. */
  durationMin: number
  kind: 'move' | 'resize'
}

/**
 * Sürükle-bırakın **ardından** sorulan kapsam sorusu (R3.8).
 *
 * Silme diyalogundan iki farkı var ve ikisi de kasıtlı:
 *
 * 1. **Üçüncü seçenek ("Tüm seri") yok.** Bütün seriyi taşımak geçmiş dersleri de
 *    taşımak olurdu ve onların yoklaması alınmış olabilir (R3.13). Rust tarafında da
 *    `RescheduleScope` iki değerli.
 * 2. **Şablonsuz derste bu diyalog hiç açılmaz.** `CalendarPage` doğrudan taşıyor —
 *    tek seçenekli bir soru, soru değil.
 *
 * Sıra bağlayıcı: en dar olan başta ve hiçbiri önceden seçili değil (silme
 * diyalogundaki kalıbın aynısı).
 */
export function MoveDialog({
  pending,
  onClose,
  onConfirm,
  onEditGroup,
}: {
  pending: PendingMove
  onClose: () => void
  onConfirm: (scope: RescheduleScope) => void
  onEditGroup: (groupId: number) => void
}) {
  const resizing = pending.kind === 'resize'
  const copy = resizing ? tr.calendar.resize : tr.calendar.move
  return (
    <Modal open title={copy.title} onClose={onClose}>
      <div className={styles.moveBody}>
        {/* Nereye taşındığı YAZIYLA da söyleniyor: sürüklenen bloğun bıraktığı yer
            ekranda görünüyor ama onay bir cümleye dayanmalı. */}
        {resizing ? (
          <p className={styles.moveLead}>
            <strong>{sessionLabel(pending.row)}</strong> {copy.lead}{' '}
            <strong>{pending.durationMin} {tr.units.minute}</strong>{' '}
            {copy.leadSuffix}
          </p>
        ) : (
          <p className={styles.moveLead}>
            <strong>{sessionLabel(pending.row)}</strong> {copy.lead}{' '}
            <strong>
              {formatDateWithWeekday(pending.day)} {formatTime(pending.startTime)}
            </strong>{' '}
            {copy.leadSuffix}
          </p>
        )}

        <ModalOption
          title={copy.only}
          hint={copy.onlyHint}
          tone="primary"
          onClick={() => onConfirm('only')}
        />
        {pending.row.studyGroupId === null ? (
          <ModalOption
            title={copy.following}
            hint={copy.followingHint}
            onClick={() => onConfirm('following')}
          />
        ) : (
          <ModalOption
            title={tr.calendar.groupProgram.edit}
            hint={tr.calendar.groupProgram.editHint}
            onClick={() => onEditGroup(pending.row.studyGroupId!)}
          />
        )}
      </div>
    </Modal>
  )
}
