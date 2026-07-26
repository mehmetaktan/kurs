import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { tr } from '../../i18n/tr'
import type { DaySessionRow } from '../../lib/api'
import { formatTime, isoToDate, minutesToTime } from '../../lib/format'
import { subjectColorOf } from '../tanimlar/palette'
import {
  gridRange,
  hourLabels,
  nowSlots,
  placeBlocks,
  scrollTopForNow,
  SLOT_MIN,
  type GridRange,
  type Placed,
} from './calendarGrid'
import { rowsByDay } from './filters'
import { dragOutcome, isDropAllowed, isSamePlace, snapToSlot, type DragOrigin } from './drag'
import styles from './Calendar.module.css'

export interface WeekGridProps {
  /** Görünen günler: haftada 7, gün görünümünde 1 (ADR-038 — öğretmen sütunu yok). */
  days: readonly string[]
  /**
   * `'YYYY-MM-DD HH:MM'` — **tek kaynak** (`local_now`, ADR-029). Bugünün hangi gün
   * olduğu da, "şimdi" çizgisinin nereye düşeceği de bundan türetiliyor; ızgara
   * kendi başına `new Date()` çağırmıyor.
   */
  now: string
  rows: readonly DaySessionRow[]
  closedDays: ReadonlySet<string>
  onSelect: (row: DaySessionRow) => void
  onCreate: (day: string, startMin: number) => void
  onMove: (row: DaySessionRow, day: string, startMin: number) => void
}

interface DragState {
  pointerId: number
  row: DaySessionRow
  origin: DragOrigin
  startX: number
  startY: number
  /** `null` = henüz eşik aşılmadı ya da hedef geçersiz (K-2). */
  target: { dayIndex: number; startMin: number } | null
}

/**
 * Haftalık / günlük ızgara (`EKRANLAR §2`) — **elde yazıldı** (ADR-031).
 *
 * Ölçüm burada, aritmetik `calendarGrid.ts` ve `drag.ts` içinde. Ayrım bilinçli: sütun
 * genişliği ve dilim yüksekliği ekrandan **ölçülür** (Segoe UI metrikleri ve DPI
 * ölçeklemesi bilinmiyor — ADR-030), kural ise saf fonksiyonda durur ve jsdom'da
 * sınanır.
 *
 * **Kaydırma ızgaranın kendisinde**, sayfada değil: 08:00–22:00 rahat yoğunlukta 840px
 * ve tipik bir Windows dizüstü önerilen ölçeklemede bunu vermiyor. Gün başlıkları
 * `sticky` kalıyor, açılışta ızgara "şimdi"ye kayıyor.
 */
export function WeekGrid({ days, now, rows, closedDays, onSelect, onCreate, onMove }: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const today = now.slice(0, 10)
  const nowMin = minutesOf(now) ?? 0
  const range = gridRange(rows)
  const hours = hourLabels(range)

  /**
   * Sütun genişliği ve dilim yüksekliği — sabit yazılmıyor, **ölçülüyor.**
   * Dilim yüksekliği sütunun boyundan türetiliyor (`height: slot × slots`), böylece
   * yoğunluk anahtarı (`--calendar-slot-height`) sürüklemeyi de kendiliğinden takip
   * ediyor; ikinci bir yerde 30px yazılı değil.
   */
  const measure = useCallback((): { columnWidth: number; slotHeightPx: number } | null => {
    const column = columnRef.current
    if (!column) return null
    const box = column.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return null
    return { columnWidth: box.width, slotHeightPx: box.height / range.slotCount }
  }, [range.slotCount])

  /**
   * Açılışta "şimdi"ye kaydır. Kurs sahibi sabah uygulamayı açtığında 08:00'i değil,
   * içinde bulunduğu saati görmeli. Konum saf fonksiyondan geliyor (`scrollTopForNow`).
   *
   * Bağımlılık **yalnızca gezinme**: her veri tazelemesinde kaydırmak (bir ders
   * taşındığında, bir modal kapandığında) kullanıcının baktığı yeri altından çekmek
   * olurdu. `scrollKey` bu niyeti tek bir değere indiriyor.
   */
  const scrollKey = `${days[0] ?? ''}/${days.length}`
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const size = measure()
    if (!scroll || !size) return
    scroll.scrollTop = scrollTopForNow(nowMin, range, size.slotHeightPx, scroll.clientHeight)
  }, [scrollKey])

  /**
   * **Şerit hesabı GÜN BAŞINA yapılır.** Bütün haftayı tek çağrıya vermek, Pazartesi
   * 16:00 ile Çarşamba 16:00'yı çakışan iki ders sayardı: ikisi de yarım genişlikte
   * çizilir ve çakışma konturu alırdı. Algoritma zamanı görüyor, sütunu görmüyor —
   * sütunu ayırmak çağıranın işi. (Gerçek `seed` verisiyle ilk açılışta yakalandı;
   * denemenin tek sütunu bu hatayı gösteremezdi.)
   */
  const byDay = rowsByDay(rows)
  const placedByDay = new Map<string, Placed<DaySessionRow>[]>()
  const unreadable: DaySessionRow[] = []
  for (const day of days) {
    const layout = placeBlocks(byDay.get(day) ?? [], range)
    placedByDay.set(day, layout.blocks)
    unreadable.push(...layout.unreadable)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, row: DaySessionRow) => {
    // Yalnızca birincil düğme; sağ tık ve orta tık sürükleme başlatmaz.
    if (event.button !== 0) return
    const startMin = minutesOf(row.startsAt)
    const dayIndex = days.indexOf(row.startsAt.slice(0, 10))
    if (startMin === null || dayIndex === -1) return

    // `setPointerCapture`: blok kendi sınırlarının dışına çıksa da olayları almaya
    // devam eder. Takvimde sürükleme tanımı gereği bloğun dışına çıkar (ADR-030).
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      pointerId: event.pointerId,
      row,
      origin: { startMin, durationMin: durationOf(row), dayIndex },
      startX: event.clientX,
      startY: event.clientY,
      target: null,
    })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const size = measure()
    if (!size) return

    const outcome = dragOutcome(event.clientX - drag.startX, event.clientY - drag.startY, drag.origin, {
      ...size,
      dayCount: days.length,
      range,
    })

    // K-2: kapalı güne bırakılamaz ve **hedef göstergesi bile çıkmaz.** Geçersiz bir
    // hedefe gölge göstermek, olmayacak bir şeyi önce mümkün gibi göstermek olurdu.
    const target =
      outcome.kind === 'move' && isDropAllowed(days[outcome.dayIndex] ?? '', closedDays)
        ? { dayIndex: outcome.dayIndex, startMin: outcome.startMin }
        : null
    setDrag({ ...drag, target })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const size = measure()
    setDrag(null)
    if (!size) return

    const outcome = dragOutcome(event.clientX - drag.startX, event.clientY - drag.startY, drag.origin, {
      ...size,
      dayCount: days.length,
      range,
    })

    // R3.7 — 5px'in altındaki hareket tıklamadır ve tıklama dersi açar.
    if (outcome.kind === 'click' || isSamePlace(outcome, drag.origin)) {
      onSelect(drag.row)
      return
    }
    const day = days[outcome.dayIndex]
    if (day === undefined || !isDropAllowed(day, closedDays)) return
    onMove(drag.row, day, outcome.startMin)
  }

  // Sürükleme iptal edilirse (Esc, sistem jesti) blok yerinde kalır — yarım kalmış bir
  // taşımayı kaydetmek kullanıcının yapmadığı bir işlem olurdu.
  useEffect(() => {
    if (!drag) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrag(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drag])

  /** Boş bir slota tıklamak ders kartını açar (`EKRANLAR §142`). */
  const onColumnClick = (event: ReactMouseEvent<HTMLDivElement>, day: string) => {
    if (event.target !== event.currentTarget || closedDays.has(day)) return
    const size = measure()
    if (!size) return
    const offsetY = event.clientY - event.currentTarget.getBoundingClientRect().top
    const minutes = range.startMin + (offsetY / size.slotHeightPx) * SLOT_MIN
    onCreate(day, Math.min(snapToSlot(minutes), range.endMin - SLOT_MIN))
  }

  return (
    <div className={styles.frame}>
      {unreadable.length > 0 && (
        <p className={styles.unreadable} role="status">
          {unreadable.length} {tr.calendar.unreadable}{' '}
          {unreadable.map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.unreadableLink}
              onClick={() => onSelect(row)}
            >
              {row.subjectName}
              {tr.units.separator}
              {row.title}
            </button>
          ))}
        </p>
      )}

      <div className={styles.scroll} ref={scrollRef}>
        <div
          className={styles.grid}
          style={
            {
              '--calendar-days': days.length,
              '--calendar-slots': range.slotCount,
            } as CSSProperties
          }
        >
          <div className={`${styles.headerCell} ${styles.rulerHead}`} />
          {days.map((day) => (
            <div
              key={day}
              className={styles.headerCell}
              data-today={day === today}
              data-closed={closedDays.has(day)}
            >
              <span className={styles.headerWeekday}>{weekdayShort(day)}</span>
              <span className={styles.headerDay}>{dayNumber(day)}</span>
            </div>
          ))}

          <div className={styles.ruler}>
            {hours.map((label) => (
              <div key={label} className={styles.hour}>
                {label}
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const closed = closedDays.has(day)
            const dropping = drag?.target?.dayIndex === dayIndex
            return (
              <div
                key={day}
                ref={dayIndex === 0 ? columnRef : undefined}
                className={styles.column}
                data-closed={closed}
                data-past={day < today}
                onClick={(event) => onColumnClick(event, day)}
              >
                {closed && <span className={styles.closedLabel}>{tr.calendar.closed}</span>}

                {day === today && <NowLine nowMin={nowMin} range={range} />}

                {(placedByDay.get(day) ?? []).map((block) => (
                  <SessionBlock
                    key={block.item.id}
                    row={block.item}
                    top={block.topSlots}
                    height={block.heightSlots}
                    lane={block.lane}
                    lanes={block.laneCount}
                    now={now}
                    dragging={drag?.row.id === block.item.id && drag.target !== null}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                ))}

                {/* Bırakma göstergesi — yalnızca GEÇERLİ hedefte çizilir (K-2). */}
                {dropping && drag?.target && (
                  <div
                    className={styles.dropTarget}
                    aria-hidden
                    style={
                      {
                        '--top-slots': (drag.target.startMin - range.startMin) / SLOT_MIN,
                        '--height-slots': Math.max(1, drag.origin.durationMin / SLOT_MIN),
                      } as CSSProperties
                    }
                  >
                    {minutesToTime(drag.target.startMin)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Legend />
    </div>
  )
}

/** `EKRANLAR §122`: 1.5px amber çizgi + sol nokta + "şimdi" etiketi. */
function NowLine({ nowMin, range }: { nowMin: number; range: GridRange }) {
  const slots = nowSlots(nowMin, range)
  if (slots === null) return null
  return (
    <div
      className={styles.nowLine}
      style={{ '--top-slots': slots } as CSSProperties}
      aria-hidden
    >
      <span className={styles.nowLabel}>{tr.calendar.now}</span>
    </div>
  )
}

interface BlockProps {
  row: DaySessionRow
  top: number
  height: number
  lane: number
  lanes: number
  /** `'YYYY-MM-DD HH:MM'` — dersin geçmişte kalıp kalmadığı bununla karşılaştırılıyor. */
  now: string
  dragging: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, row: DaySessionRow) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
}

/**
 * Ders bloğu — `EKRANLAR §127`'nin varyantları `data-*` üzerinden CSS'e iniyor.
 *
 * `button` değil `div role="button"` değil, gerçek `button`: klavyeyle de açılabilmeli.
 * Sürükleme klavyeyle yapılamıyor ve bu bilinçli bir sınır — taşımanın klavye yolu
 * dersin kendi "Ertele" düğmesi (Bugün ekranı ve ders kartı).
 */
function SessionBlock({
  row,
  top,
  height,
  lane,
  lanes,
  now,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BlockProps) {
  return (
    <button
      type="button"
      className={styles.block}
      data-kind={row.kind}
      data-status={row.status}
      data-makeup={row.isMakeup}
      data-attention={row.status === 'planned' && !row.attendanceTaken && row.endsAt < now}
      data-done={row.attendanceTaken}
      data-clash={lanes > 1}
      data-narrow={lanes > 1}
      data-dragging={dragging}
      style={
        {
          '--top-slots': top,
          '--height-slots': height,
          '--lane': lane,
          '--lanes': lanes,
          '--subject-color': subjectColorOf(row.subjectColor),
        } as CSSProperties
      }
      onPointerDown={(event) => onPointerDown(event, row)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span className={styles.blockTime}>{formatTime(row.startsAt)}</span>
      <span className={styles.blockTitle}>
        {row.subjectName}
        {tr.units.separator}
        {row.title}
      </span>
      <span className={styles.blockMeta}>
        {row.status === 'cancelled'
          ? tr.calendar.cancelled
          : row.kind === 'group'
            ? `${row.studentCount}`
            : tr.calendar.solo}
        {/* ADR-038 — kurs çok öğretmenli; blok kimin dersi olduğunu söylemek zorunda.
            Atanmamışsa satır kısalıyor, `—` yazılmıyor: meta satırı dar. */}
        {row.teacherName !== null && `${tr.units.separator}${row.teacherName}`}
        {row.isMakeup && `${tr.units.separator}${tr.calendar.makeup}`}
      </span>
    </button>
  )
}

/** Açıklama şeridi — tasarımda ızgaranın altında duruyor (`EKRANLAR §114`). */
function Legend() {
  return (
    <div className={styles.legend}>
      <span className={styles.legendTitle}>{tr.calendar.legend.heading}</span>
      <span className={styles.legendItem} data-swatch="group">
        {tr.calendar.legend.group}
      </span>
      <span className={styles.legendItem} data-swatch="solo">
        {tr.calendar.legend.solo}
      </span>
      <span className={styles.legendItem} data-swatch="makeup">
        {tr.calendar.legend.makeup}
      </span>
      <span className={styles.legendItem} data-swatch="attention">
        {tr.calendar.legend.attendanceMissing}
      </span>
      <span className={styles.legendItem} data-swatch="done">
        {tr.calendar.legend.done}
      </span>
      <span className={styles.legendItem} data-swatch="cancelled">
        {tr.calendar.legend.cancelled}
      </span>
      <span className={styles.legendItem} data-swatch="closed">
        {tr.calendar.legend.closed}
      </span>
    </div>
  )
}

/** `'YYYY-MM-DD HH:MM'` → dakika. `lib/format`'ın doğrulayan ikizinden geçiyor. */
function minutesOf(stamp: string): number | null {
  const time = formatTime(stamp)
  if (time === tr.units.emptyValue) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

function durationOf(row: DaySessionRow): number {
  const start = minutesOf(row.startsAt)
  const end = minutesOf(row.endsAt)
  if (start === null || end === null || end <= start) return SLOT_MIN
  return end - start
}

function weekdayShort(iso: string): string {
  const date = isoToDate(iso)
  if (!date) return tr.units.emptyValue
  // `weekdaysShortMonFirst` Pazartesi'den başlıyor, `getUTCDay()` Pazar'dan.
  return tr.dates.weekdaysShortMonFirst[(date.getUTCDay() + 6) % 7] ?? tr.units.emptyValue
}

function dayNumber(iso: string): string {
  return String(Number(iso.slice(8, 10)))
}
