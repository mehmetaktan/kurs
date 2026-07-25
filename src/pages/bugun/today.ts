/**
 * Bugün ekranının saf hesapları — PRD R1.1 ve R1.2.
 *
 * Ekranın kendisinden ayrı duruyorlar çünkü sınanacak davranış tam olarak burada:
 * listenin saat sırası, "şimdi" çizgisinin **ne zaman çıkmadığı** ve hangi dersin
 * yoklama beklediği. `pages/<modül>/filters.ts` kalıbının aynısı (ADR-025).
 *
 * "Şimdi" dışarıdan geliyor (`local_now`, `chrono::Local`) — burada `new Date()`
 * çağrılmıyor. Yoksa testler makinenin saatine bağlanırdı ve §0'ın SQLite için koyduğu
 * kural arayüzde delinmiş olurdu.
 */
import type { DaySessionRow } from '../../lib/api'

export interface DaySplit {
  /** Bitmiş dersler, saat sırasıyla. */
  past: DaySessionRow[]
  /** Henüz bitmemiş dersler — süren ders de burada. */
  future: DaySessionRow[]
  /**
   * "Şimdi" çizgisi çıkacak mı. **Yalnızca ikisi de doluysa** (R1.1): tek başına bir
   * çizgi neyi neyden ayırdığını söylemez, listenin başında ya da sonunda asılı kalır.
   */
  showNowLine: boolean
}

/** Saat sırası (R1.1). `'YYYY-MM-DD HH:MM'` metinsel olarak sıralanabilir (ADR-017). */
export function sortByStart(rows: readonly DaySessionRow[]): DaySessionRow[] {
  return [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/**
 * Listeyi "şimdi"ye göre ikiye böler.
 *
 * Ayraç **bitiş saati**: süren ders geçmişe düşmez, çizginin altında kalır. Başlangıca
 * göre bölünseydi 16:00'da başlamış, hâlâ devam eden bir ders "geçmiş" sayılır ve
 * yoklaması girilmediği için amber şeritle işaretlenirdi — daha bitmemiş bir dersin
 * yoklamasını istemek olurdu.
 */
export function splitByNow(rows: readonly DaySessionRow[], now: string): DaySplit {
  const sorted = sortByStart(rows)
  const past = sorted.filter((row) => row.endsAt <= now)
  const future = sorted.filter((row) => row.endsAt > now)
  return { past, future, showNowLine: past.length > 0 && future.length > 0 }
}

/**
 * Yoklaması girilmemiş **geçmiş** ders mi (R1.2) — amber zemin + sol şeridin ölçütü.
 *
 * İptal edilmiş dersin yoklaması beklenmez: o gün ders yapılmadı (`VERI-MODELI §4`).
 */
export function isPendingAttendance(row: DaySessionRow, now: string): boolean {
  return row.endsAt <= now && !row.attendanceTaken && row.status !== 'cancelled'
}

/** Başlıkta yazan sayı (R1.2: "başlıkta sayılır"). */
export function pendingAttendanceCount(rows: readonly DaySessionRow[], now: string): number {
  return rows.filter((row) => isPendingAttendance(row, now)).length
}
