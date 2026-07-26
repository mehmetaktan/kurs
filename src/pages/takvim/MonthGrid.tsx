import { tr } from '../../i18n/tr'
import type { DaySessionRow } from '../../lib/api'
import { formatTime } from '../../lib/format'
import { subjectColorOf } from '../tanimlar/palette'
import { monthWeeks, sameMonth } from './calendarGrid'
import { rowsByDay } from './filters'
import styles from './Calendar.module.css'

export interface MonthGridProps {
  /** Ayın herhangi bir günü — ızgara bundan türetiliyor. */
  anchor: string
  now: string
  rows: readonly DaySessionRow[]
  closedDays: ReadonlySet<string>
  /** Bir güne tıklamak o günün görünümünü açar — ay bir **genel bakış**, çalışma yeri değil. */
  onOpenDay: (day: string) => void
}

/** Bir hücreye sığan ders sayısı; gerisi "+N daha" olarak **sayılıyor**, gizlenmiyor. */
const VISIBLE_PER_DAY = 3

/**
 * Aylık genel bakış (`/faz-05c §1`).
 *
 * Saat ızgarası **yok** ve olmaması bilinçli: ayın 30 gününü dikey ızgarayla göstermek
 * ne sığar ne okunur. Ay görünümünün cevapladığı soru başka — "hangi günler dolu, hangi
 * günler tatil". Ders üzerinde işlem yapmak için gün ya da hafta görünümüne iniliyor.
 *
 * Sürükle-bırak burada da yok: 30 dakikalık kilit (R3.7) saat ızgarası olmayan bir
 * yüzeyde anlamsız olurdu.
 */
export function MonthGrid({ anchor, now, rows, closedDays, onOpenDay }: MonthGridProps) {
  const weeks = monthWeeks(anchor)
  const byDay = rowsByDay(rows)
  const today = now.slice(0, 10)

  return (
    <div className={styles.monthFrame}>
      <div className={styles.monthHead}>
        {tr.dates.weekdaysShortMonFirst.map((name) => (
          <div key={name} className={styles.monthHeadCell}>
            {name}
          </div>
        ))}
      </div>

      <div className={styles.monthBody}>
        {weeks.flat().map((day) => {
          const lessons = byDay.get(day) ?? []
          const closed = closedDays.has(day)
          return (
            <button
              key={day}
              type="button"
              className={styles.monthCell}
              data-today={day === today}
              data-outside={!sameMonth(day, anchor)}
              data-closed={closed}
              onClick={() => onOpenDay(day)}
            >
              <span className={styles.monthDayNumber}>{Number(day.slice(8, 10))}</span>

              {closed && <span className={styles.monthClosed}>{tr.calendar.closed}</span>}

              {lessons.slice(0, VISIBLE_PER_DAY).map((row) => (
                <span key={row.id} className={styles.monthLesson} data-status={row.status}>
                  <span
                    className={styles.monthDot}
                    style={{ background: subjectColorOf(row.subjectColor) }}
                    aria-hidden
                  />
                  <span className={styles.monthLessonText}>
                    {formatTime(row.startsAt)} {row.title}
                  </span>
                </span>
              ))}

              {lessons.length > VISIBLE_PER_DAY && (
                <span className={styles.monthMore}>
                  +{lessons.length - VISIBLE_PER_DAY} {tr.calendar.more}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
