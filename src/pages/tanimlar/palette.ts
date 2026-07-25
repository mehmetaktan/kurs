/**
 * Branş renk paleti — TASARIM-SISTEMI §1.6 kategori paleti (`--color-cat-*`).
 *
 * Renk **serbest girilmiyor, seçiliyor.** Beş renk hem takvimde ayırt etmeye yetiyor
 * hem de tasarım sisteminin dışına çıkılmasını engelliyor: serbest bir renk seçici
 * konsaydı kurs sahibi neon bir yeşil seçer ve ekran kendi renk dilinden kopardı.
 *
 * Ham `#rrggbb` değerleri veritabanına yazılıyor (`subject.color`) — CSS değişkeni adı
 * değil. Gerekçe: token adı ileride değişirse veritabanındaki satırlar anlamsız kalırdı;
 * renk bir veri, bir stil referansı değil.
 */
export interface SubjectColor {
  value: string
  label: string
}

export const SUBJECT_COLORS = [
  { value: '#5f8f6b', label: 'Yeşil' },
  { value: '#6a86a8', label: 'Mavi' },
  { value: '#b57314', label: 'Amber' },
  { value: '#9079a6', label: 'Mor' },
  { value: '#8a8079', label: 'Gri' },
] as const satisfies readonly SubjectColor[]

export const DEFAULT_SUBJECT_COLOR: string = SUBJECT_COLORS[0].value

/** Palette dışında kalan bir değerin düştüğü yer (elle düzenlenmiş `.db`). */
const FALLBACK_COLOR: string = SUBJECT_COLORS[4].value

/** Kayıtlı renk paletin dışındaysa griye düşer — ekranda boş nokta çıkmasın. */
export function subjectColorOf(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR
  return SUBJECT_COLORS.some((item) => item.value === color) ? color : FALLBACK_COLOR
}
