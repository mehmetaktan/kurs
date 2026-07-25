import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Overlay.module.css'

/** Tasarımdaki süre (`Takvim` ve `Öğrenci detayı` ekranlarının `flash()` fonksiyonu). */
export const TOAST_MS = 2200

const ToastContext = createContext<(message: string) => void>(() => {})

/**
 * TASARIM-SISTEMI §6/32 — alt-orta, koyu, 2200 ms sonra kendiliğinden kapanır.
 *
 * Tek bildirim gösterilir; yenisi gelince eskisinin süresi sıfırlanır (tasarımdaki
 * davranış). Kuyruk yok: üst üste binen bildirim bu uygulamada olmuyor, olsa da
 * kullanıcı hepsini okumaya çalışırken asıl işini kaybeder.
 *
 * `role="status"` + `aria-live="polite"`: ekran okuyucu bildirimi kullanıcının işini
 * kesmeden okur.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string) => {
    setMessage(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), TOAST_MS)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        <div className={styles.toast} role="status" aria-live="polite">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** Her başarılı işlemden sonra bildirim (CLAUDE.md > Arayüz). */
export function useToast(): (message: string) => void {
  return useContext(ToastContext)
}
