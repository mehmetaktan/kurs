import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Overlay.module.css'

/** Tasarımdaki süre (`Takvim` ve `Öğrenci detayı` ekranlarının `flash()` fonksiyonu). */
export const TOAST_MS = 2200

/**
 * Eylemli bildirim daha uzun durur ve sebebi tasarım değil aritmetik: 2200 ms bir
 * düğmeyi fark edip tıklamaya yetmiyor. Süresiz de bırakılmıyor — kalıcı bir çubuk
 * ekranın altını sürekli işgal ederdi.
 */
export const TOAST_ACTION_MS = 6000

/** Bildirimin yanındaki tek düğme — bugün yalnızca "Geri al" (PRD R3.12). */
export interface ToastAction {
  label: string
  onAction: () => void
}

const ToastContext = createContext<(message: string, action?: ToastAction) => void>(() => {})

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
  const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string, action?: ToastAction) => {
    setToast({ message: next, action })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), action ? TOAST_ACTION_MS : TOAST_MS)
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
      {toast !== null && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast.message}
          {toast.action && (
            <button
              type="button"
              className={styles.toastAction}
              onClick={() => {
                // Bildirim ÖNCE kapanıyor: eylem yeni bir bildirim gösteriyor ve
                // ikisi üst üste binseydi kullanıcı hangisinin güncel olduğunu bilemezdi.
                setToast(null)
                toast.action?.onAction()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** Her başarılı işlemden sonra bildirim (CLAUDE.md > Arayüz). */
export function useToast(): (message: string, action?: ToastAction) => void {
  return useContext(ToastContext)
}
