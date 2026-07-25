import { useEffect, useState } from 'react'
import { tr } from '../i18n/tr'
import { Modal, SearchInput } from '../ui'
import styles from './Shell.module.css'

export interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

/**
 * EKRANLAR.md E20 — global arama (`Ctrl K`).
 *
 * Tasarımda iki ekranda ipucu var ama panel çizilmemiş; aynı görsel dilde `Modal` +
 * `SearchInput` ile kuruldu. **Faz 3'te sonuç kaynağı yok:** öğrenci/grup/ders listeleri
 * Faz 4–5'te geliyor. Panel şimdiden bağlanıyor çünkü `Ctrl K` kısayolu kabuğun işi ve
 * kısayolun hiçbir şey yapmaması, olmamasından daha kötü.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')

  // Panel her açılışta temiz gelir; kullanıcı önceki aramasını silmek zorunda kalmasın.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  return (
    <Modal open={open} title={tr.search.globalTitle} onClose={onClose}>
      <SearchInput
        value={query}
        placeholder={tr.search.globalPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={tr.search.globalPlaceholder}
      />
      <div className={styles.searchGroups}>
        <p className={styles.searchHelp}>
          {query.trim() === '' ? tr.search.typeToSearch : tr.search.notReady}
        </p>
      </div>
    </Modal>
  )
}
