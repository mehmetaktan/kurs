import { useEffect, useRef } from 'react'

/**
 * Modal / çekmece odak yönetimi — Modal, ConfirmDialog ve Drawer bunu paylaşır.
 *
 * Üç şey yapıyor:
 *  1. Açılışta odağı diyaloğun içine alır (ilk odaklanabilir öğe, yoksa kabın kendisi).
 *  2. `Tab`'ı içeride döndürür — arkadaki menüye kaçan odak, teknik olmayan kullanıcı
 *     için "klavye çalışmıyor" demektir.
 *  3. `Esc` kapatır, kapanışta odak diyaloğu açan düğmeye geri döner.
 *
 * `onClose` bilerek efekt bağımlılığı DEĞİL: her render'da yeni bir fonksiyon gelirse
 * efekt yeniden kurulur ve odak kullanıcının yazdığı alandan başa sıçrar.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useDialog(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])

    const first = focusable()[0]
    if (first) first.focus()
    else container?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement
      const inside = container?.contains(active) ?? false

      if (event.shiftKey && (!inside || active === firstItem)) {
        event.preventDefault()
        lastItem?.focus()
      } else if (!event.shiftKey && (!inside || active === lastItem)) {
        event.preventDefault()
        firstItem?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  return containerRef
}
