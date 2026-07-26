/**
 * Sürükleme aritmetiği — **ADR-030**: Pointer Events, HTML5 sürükle-bırak değil.
 *
 * Bu dosyada DOM yok ve olmaması bütün mesele. `dragstart`'ın eşiğini tarayıcı
 * belirlediği için `PRD R3.7`'nin 5px kuralı HTML5 DnD üzerinde kırılgan değil,
 * **kurulamaz**; Pointer Events'te eşik bizim aritmetiğimiz ve girdisi sıradan
 * koordinat çiftleri. Sonucu: kural jsdom'da test edilebiliyor.
 */
import { SLOT_MIN, type GridRange } from './calendarGrid'

/**
 * `R3.7` — bu mesafenin **altındaki** hareket tıklamadır.
 *
 * Karşılaştırma **yarıçap** (Öklid), kare değil. Fark önemli: `|dx|≤5 && |dy|≤5`
 * kuralında 5px sağa + 5px aşağı hareket (7.07px) hâlâ tıklama sayılırdı —
 * `/faz-05c-karar` react-big-calendar'ı tam olarak bu yüzden de eledi.
 */
export const DRAG_THRESHOLD_PX = 5

/** Hareket sürükleme mi, yoksa tıklama mı (R3.7). */
export function isDrag(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
}

/** En yakın 30 dakikaya yuvarlar (R3.7 — sürükleme 30 dk'ya kilitli). */
export function snapToSlot(minutes: number): number {
  return Math.round(minutes / SLOT_MIN) * SLOT_MIN
}

export interface DragGeometry {
  /** Bir gün sütununun genişliği (px) — ekrandan ÖLÇÜLÜR, sabit yazılmaz. */
  columnWidth: number
  /** Kaç gün sütunu var: haftada 7, gün görünümünde 1. */
  dayCount: number
  /** `--calendar-slot-height`in o anki piksel karşılığı (yoğunluk ayarı). */
  slotHeightPx: number
  range: GridRange
}

export interface DragOrigin {
  /** Sürüklenen dersin başlangıcı, gün başından beri dakika. */
  startMin: number
  durationMin: number
  /** Dersin bulunduğu sütun (0 tabanlı). */
  dayIndex: number
}

export type DragOutcome =
  | { kind: 'click' }
  | { kind: 'move'; dayIndex: number; startMin: number }

/**
 * İşaretçinin gittiği yerin ne anlama geldiği.
 *
 * Delta üzerinden çalışıyor, işaretçinin mutlak konumu üzerinden değil: kullanıcı bloğu
 * neresinden tuttuysa oradan taşıyor. Mutlak konum kullanılsaydı blok, tutulan noktaya
 * göre zıplardı.
 *
 * İki kenetleme var ve ikisi de bilerek: sütun 0..dayCount−1 arasına, saat de ızgaranın
 * içine. Kenetleme olmasaydı sürükleme ızgaranın dışına ders yazabilirdi.
 */
export function dragOutcome(
  dx: number,
  dy: number,
  origin: DragOrigin,
  geo: DragGeometry,
): DragOutcome {
  if (!isDrag(dx, dy)) return { kind: 'click' }

  const dayIndex = clamp(origin.dayIndex + Math.round(dx / geo.columnWidth), 0, geo.dayCount - 1)

  const movedMin = (dy / geo.slotHeightPx) * SLOT_MIN
  const latest = geo.range.endMin - origin.durationMin
  const startMin = clamp(
    snapToSlot(origin.startMin + movedMin),
    geo.range.startMin,
    // Süresi ızgaradan uzun bir ders (gece yarısını aşan) alt sınırı aşağı iterdi.
    Math.max(geo.range.startMin, latest),
  )

  return { kind: 'move', dayIndex, startMin }
}

/**
 * Hedef geçerli mi — **K-2: tatil/kapalı güne bırakılamaz.**
 *
 * Ekran bunu hedef göstergesini çizmeden ÖNCE soruyor: geçersiz bir hedefe gölge
 * göstermek, bırakınca hata veren bir davranışı önce mümkün gibi göstermek olurdu.
 * Son söz yine Rust'ta (`reschedule_session` de aynı günü reddediyor).
 */
export function isDropAllowed(day: string, closedDays: ReadonlySet<string>): boolean {
  return !closedDays.has(day)
}

/** Taşıma bir şeyi değiştirmiyorsa kaydetmeye gerek yok (R3.12'nin gürültüsüz hâli). */
export function isSamePlace(target: DragOutcome, origin: DragOrigin): boolean {
  return (
    target.kind === 'move' &&
    target.dayIndex === origin.dayIndex &&
    target.startMin === origin.startMin
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
