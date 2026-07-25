/**
 * Tipografik işaretler — TASARIM-SISTEMI §5.
 *
 * **İkon seti yok, kütüphane kurulmayacak.** Tasarım tamamen bu işaretleri kullanıyor.
 * Bu, ikon kütüphanesi bağımlılığını, lisans sorununu ve Windows'ta ikon fontu yükleme
 * riskini sıfırlıyor.
 *
 * Bunlar dil değil, tasarım token'ı — o yüzden `i18n/tr.ts` içinde değil burada. Ekran
 * okuyucuya ne söylenecekse o metin `tr.ts`'ten gelir (`aria-label`).
 */
export const marks = {
  prev: '‹',
  next: '›',
  /** U+FF0B — tam genişlikli artı; ASCII '+' bu tasarımda fazla ince duruyor. */
  add: '＋',
  close: '✕',
  closeSmall: '×',
  search: '⌕',
  check: '✓',
  enter: '↵',
  left: '←',
  right: '→',
  caret: '▾',
  conflict: '!',
  empty: '—',
} as const
