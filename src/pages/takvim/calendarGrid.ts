/**
 * Takvim ızgarasının saf hesapları (`EKRANLAR §2`, `ADR-031`).
 *
 * React'siz ve CSS'siz olması bilinçli: ızgaranın **tek gerçek algoritması** çakışan
 * derslerin şeride bölünmesi ve o algoritma jsdom'da test edilebilir olmak zorunda.
 * Blok konumu `calc()` ile CSS'te kuruluyor ama "kaç dilim" sorusunun cevabı burada.
 * Sabit piksel hiçbir yerde yok — her şey dilim sayısı cinsinden, piksele çevirmeyi
 * `--calendar-slot-height` yapıyor (`density.css`). Yoğunluk anahtarı bu yüzden
 * ızgarayı kendiliğinden takip ediyor.
 *
 * **Saat metnini burası ayrıştırmıyor.** `lib/format`'ın doğrulayan ikizleri
 * kullanılıyor (`formatTime` + `timeToMinutes`): ikinci bir ayrıştırıcı bozuk girdide
 * `NaN` üretir ve blok sessizce kaybolurdu.
 */
import { dateToIso, formatTime, isoToDate, minutesToTime, timeToMinutes } from '../../lib/format'

/** Bir dilim 30 dakika. Sürükleme de buna kilitli (PRD R3.7). */
export const SLOT_MIN = 30

/**
 * Izgaranın **varsayılan** dikey aralığı — `EKRANLAR §122`: 08:00–22:00, 28 dilim.
 * Rahat yoğunlukta 28 × 30px = 840px, sıkıda 28 × 22px = 616px.
 */
export const DEFAULT_START_MIN = 8 * 60
export const DEFAULT_END_MIN = 22 * 60

/** Gün sonu — gece yarısını aşan ders bu sınıra kadar çizilir. */
const DAY_MAX_MIN = 24 * 60

/**
 * Izgaranın o anki dikey aralığı. **Sabit değil**: `gridRange` görünen derslere göre
 * genişletiyor (aşağıdaki gerekçe).
 */
export interface GridRange {
  /** Gün başından beri geçen dakika — daima tam saat. */
  startMin: number
  endMin: number
  /** `(endMin − startMin) / SLOT_MIN`. CSS'e `--calendar-slots` olarak gidiyor. */
  slotCount: number
}

/** Izgaranın yerleştirebileceği en az şey: bir kimlik ve iki damga. */
export interface GridItem {
  id: number
  /** `'YYYY-MM-DD HH:MM'` */
  startsAt: string
  endsAt: string
}

export interface Placed<T> {
  item: T
  /** Izgaranın üstünden kaç DİLİM aşağıda — piksel değil. */
  topSlots: number
  /** Kaç dilim yüksek. En az 1: 15 dakikalık bir ders çizilemez hâle gelmesin. */
  heightSlots: number
  /** Kaçıncı şerit (0 tabanlı) ve kümede kaç şerit var. */
  lane: number
  laneCount: number
}

export interface Layout<T> {
  blocks: Placed<T>[]
  /**
   * Saati okunamayan satırlar. **Sessizce atılmıyorlar**: veritabanında var olup
   * ekranda olmayan bir ders, bu uygulamanın kabul edemeyeceği tek hata sınıfı —
   * kullanıcı takvime bakıp "o gün boş" der. Ekran bunları uyarı olarak yazıyor.
   */
  unreadable: T[]
}

/** `'2026-07-25 14:30'` → 870. Bozuk girdide `null` (`lib/format`'ın ikizi doğruluyor). */
function stampMinutes(stamp: string): number | null {
  return timeToMinutes(formatTime(stamp))
}

interface Span {
  start: number
  end: number
}

/**
 * Dersin ızgaradaki dikey aralığı.
 *
 * Gece yarısını aşan ders (`23:30` + 60 dk) ertesi güne biten bir damga taşıyor;
 * o ders **o günün sonuna kadar** çizilir. `slot_bounds` bu damgayı bilerek
 * `NaiveDateTime` üzerinden üretiyor, biz de bilerek kırpıyoruz: bloğu ertesi güne
 * taşımak bir dersi iki günde birden göstermek olurdu.
 */
function spanOf(item: GridItem): Span | null {
  const start = stampMinutes(item.startsAt)
  if (start === null) return null

  const end = stampMinutes(item.endsAt)
  const sameDay = item.endsAt.slice(0, 10) === item.startsAt.slice(0, 10)
  if (end === null || !sameDay || end <= start) return { start, end: DAY_MAX_MIN }
  return { start, end }
}

const floorHour = (minutes: number): number => Math.max(0, Math.floor(minutes / 60) * 60)
const ceilHour = (minutes: number): number => Math.min(DAY_MAX_MIN, Math.ceil(minutes / 60) * 60)

/**
 * Görünen derslere göre ızgaranın aralığı. Varsayılan 08:00–22:00; **dışına taşan ders
 * varsa tam saate yuvarlanarak genişler.**
 *
 * Neden sabit bırakılamadı: `EKRANLAR §122` ızgarayı 08:00–22:00 diye tanımlıyor ama
 * uygulama ders saatini **hiçbir yerde** kısıtlamıyor — ne `pages/dersler/validate.ts`
 * ne Rust. 00:15'lik bir ders sabit ızgarada negatif konum alır ve kırpılan alanda
 * çizilir: veritabanında var, ekranda yok. Kırpma ya da "3 ders daha" rozeti de aynı
 * şeyi yapardı, ikisi de bilgiyi saklıyor.
 *
 * Genişleme **kendiliğinden tetiklenmez**: hepsi aralık içindeyse varsayılan aynen kalır.
 */
export function gridRange(items: readonly GridItem[]): GridRange {
  let startMin = DEFAULT_START_MIN
  let endMin = DEFAULT_END_MIN

  for (const item of items) {
    const span = spanOf(item)
    if (!span) continue
    if (span.start < startMin) startMin = floorHour(span.start)
    if (span.end > endMin) endMin = ceilHour(span.end)
  }

  return { startMin, endMin, slotCount: (endMin - startMin) / SLOT_MIN }
}

/**
 * Çakışan dersleri yan yana şeritlere böler (`EKRANLAR §122`).
 *
 * İki aşamalı, ve ayrım önemli: **küme** birbirine zincirle bağlı derslerin tamamı,
 * **şerit** o küme içindeki tek bir sütun. Şerit sayısını kümenin tamamı belirliyor,
 * tek tek çiftler değil — yoksa A–B çakışıp B–C çakıştığında A ile C aynı şeridi
 * paylaşır ve ekranda üst üste biner.
 *
 * Bitişik ders çakışma sayılmaz: 09:00–10:00 ile 10:00–11:00 ayrı kümelerdir
 * (`repo::schedule::detect_conflicts` da aynı kuralı uyguluyor).
 *
 * Aralık `gridRange`'den geliyor, o yüzden hiçbir blok negatif konum almıyor; yükseklik
 * de ızgaranın altına taşmayacak şekilde kırpılıyor.
 */
export function placeBlocks<T extends GridItem>(
  items: readonly T[],
  range: GridRange,
): Layout<T> {
  const unreadable: T[] = []
  const spans: { item: T; span: Span }[] = []

  for (const item of items) {
    const span = spanOf(item)
    if (span === null) unreadable.push(item)
    else spans.push({ item, span })
  }

  spans.sort((a, b) => a.span.start - b.span.start || a.item.id - b.item.id)

  const blocks: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let clusterEnd = -1
  /** Her şeridin o ana kadarki bitiş dakikası. */
  let laneEnds: number[] = []

  const closeCluster = () => {
    for (const block of cluster) block.laneCount = laneEnds.length
    blocks.push(...cluster)
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }

  for (const { item, span } of spans) {
    // Kümeyle hiç kesişmiyorsa önceki küme kapanır.
    if (span.start >= clusterEnd) closeCluster()

    // İlk BOŞALMIŞ şeride yerleş; yoksa yeni şerit aç.
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= span.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(span.end)
    } else {
      laneEnds[lane] = span.end
    }

    const topSlots = (span.start - range.startMin) / SLOT_MIN
    const room = range.slotCount - topSlots
    cluster.push({
      item,
      topSlots,
      heightSlots: Math.min(Math.max(1, (span.end - span.start) / SLOT_MIN), room),
      lane,
      laneCount: 1,
    })
    clusterEnd = Math.max(clusterEnd, span.end)
  }
  closeCluster()

  blocks.sort((a, b) => a.item.id - b.item.id)
  return { blocks, unreadable }
}

/** Saat cetvelinin etiketleri: 08:00, 09:00 … Yarım saatler etiketsiz. */
export function hourLabels(range: GridRange): string[] {
  const labels: string[] = []
  for (let minutes = range.startMin; minutes < range.endMin; minutes += 60) {
    labels.push(minutesToTime(minutes % DAY_MAX_MIN) ?? '')
  }
  return labels
}

/**
 * "Şimdi" çizgisinin konumu, dilim cinsinden. Aralığın dışındaysa `null` — çizgi
 * çizilmez, ızgaranın kenarına yapıştırılmaz.
 *
 * Saat **parametre**: `Date.now()` değil (ADR-029, "şimdi" tek kaynaktan gelir).
 */
export function nowSlots(nowMin: number, range: GridRange): number | null {
  if (nowMin < range.startMin || nowMin > range.endMin) return null
  return (nowMin - range.startMin) / SLOT_MIN
}

/**
 * Açılışta ızgaranın kaydırılacağı konum (px).
 *
 * Neden gerekiyor: 08:00–22:00 rahat yoğunlukta 840px ve tipik bir Windows dizüstü
 * önerilen ölçeklemede bunu vermiyor (ADR-030). Izgara kaydırıyor, ve kullanıcı sabah
 * uygulamayı açtığında 08:00'i değil **içinde bulunduğu saati** görmeli.
 *
 * "Şimdi" görünür alanın üçte birine oturuyor, ortasına değil: kurs sahibini ilgilendiren
 * şey geçmiş ders değil, önündeki dersler.
 */
export function scrollTopForNow(
  nowMin: number,
  range: GridRange,
  slotHeightPx: number,
  viewportPx: number,
): number {
  const gridHeight = range.slotCount * slotHeightPx
  const clamped = Math.min(Math.max(nowMin, range.startMin), range.endMin)
  const y = ((clamped - range.startMin) / SLOT_MIN) * slotHeightPx
  const max = Math.max(0, gridHeight - viewportPx)
  return Math.min(Math.max(0, y - viewportPx / 3), max)
}

// ─── Tarih gezinmesi ──────────────────────────────────────────────────────────
//
// `toISOString()` HİÇBİR yerde kullanılmıyor: UTC'ye çevirir ve İstanbul (+03:00) gibi
// dilimlerde tarihi bir gün geriye kaydırır. `lib/format`'ın `isoToDate`/`dateToIso`
// çifti `Date.UTC` üzerinden çalışıyor ve bu tuzağı kapatıyor.

/** Ayrıştırılamayan tarih olduğu gibi döner: gezinme çökmesin, yanlış güne de gitmesin. */
function shift(iso: string, days: number): string {
  const date = isoToDate(iso)
  if (!date) return iso
  date.setUTCDate(date.getUTCDate() + days)
  return dateToIso(date)
}

export function addDays(iso: string, days: number): string {
  return shift(iso, days)
}

/** Haftanın Pazartesi'si (Türkiye). Pazar 0 olan `getUTCDay()` düzeltiliyor. */
export function weekStart(iso: string): string {
  const date = isoToDate(iso)
  if (!date) return iso
  const weekday = (date.getUTCDay() + 6) % 7
  return shift(iso, -weekday)
}

/** Pazartesi'den Pazar'a 7 gün. */
export function weekDays(iso: string): string[] {
  const monday = weekStart(iso)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

/** Ay ızgarası: 6 hafta × 7 gün, Pazartesi başlangıçlı. Komşu ayın günleri de var. */
export function monthWeeks(iso: string): string[][] {
  const date = isoToDate(iso)
  if (!date) return []
  const first = dateToIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)))
  const start = weekStart(first)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  )
}

/**
 * Ay atlama. Gün numarası korunmuyor, **ayın 1'ine** iniliyor: 31 Mart'tan bir ay
 * ilerlemek 31 Nisan'ı arar ve `Date` onu 1 Mayıs'a taşır — kullanıcı bir ay atlamak
 * isterken iki ay atlamış olurdu.
 */
export function shiftMonth(iso: string, delta: number): string {
  const date = isoToDate(iso)
  if (!date) return iso
  return dateToIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)))
}

/** Aynı ayda mı — ay ızgarasında komşu ayın günlerini soluklaştırmak için. */
export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}
