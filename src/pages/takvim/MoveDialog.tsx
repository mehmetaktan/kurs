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
}: {
  pending: PendingMove
  onClose: () => void
  onConfirm: (scope: RescheduleScope) => void
}) {
  return (
    <Modal open title={tr.calendar.move.title} onClose={onClose}>
      <div className={styles.moveBody}>
        {/* Nereye taşındığı YAZIYLA da söyleniyor: sürüklenen bloğun bıraktığı yer
            ekranda görünüyor ama onay bir cümleye dayanmalı. */}
        <p className={styles.moveLead}>
          <strong>{sessionLabel(pending.row)}</strong> {tr.calendar.move.lead}{' '}
          <strong>
            {formatDateWithWeekday(pending.day)} {formatTime(pending.startTime)}
          </strong>{' '}
          {tr.calendar.move.leadSuffix}
        </p>

        <ModalOption
          title={tr.calendar.move.only}
          hint={tr.calendar.move.onlyHint}
          tone="primary"
          onClick={() => onConfirm('only')}
        />
        <ModalOption
          title={tr.calendar.move.following}
          hint={tr.calendar.move.followingHint}
          onClick={() => onConfirm('following')}
        />
      </div>
    </Modal>
  )
}
