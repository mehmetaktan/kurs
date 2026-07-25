import { useEffect, useState } from 'react'
import { tr } from '../i18n/tr'
import { fetchStudentList, type StudentRow } from '../lib/api'
import { formatPhone } from '../lib/format'
import { navigate } from '../lib/router'
import { sortTrBy } from '../lib/sortTr'
import { Modal, SearchInput } from '../ui'
import { STUDENTS_PATH } from './routes'
import styles from './Shell.module.css'

export interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

/** Panel bir kısayol; uzun liste değil ilk birkaç isabet gösterilir. */
const MAX_RESULTS = 8
const SEARCH_DEBOUNCE_MS = 150

/**
 * EKRANLAR.md E20 — global arama (`Ctrl K`).
 *
 * Tasarımda iki ekranda ipucu var ama panel çizilmemiş; aynı görsel dilde `Modal` +
 * `SearchInput` ile kuruldu. **Faz 4'te öğrenci sonuçları bağlandı**; Gruplar ve Dersler
 * grupları Faz 5'te kendi veri kaynaklarıyla eklenecek — o yüzden sonuç listesi
 * şimdiden gruplu.
 *
 * Arama Rust'ta (`search_name`, K9): `İ/ı` sorunu yazma anında çözülmüş oluyor.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentRow[]>([])
  const [searched, setSearched] = useState(false)

  // Panel her açılışta temiz gelir; kullanıcı önceki aramasını silmek zorunda kalmasın.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setSearched(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (query.trim() === '') {
      setResults([])
      setSearched(false)
      return
    }

    const timer = setTimeout(() => {
      void fetchStudentList({ search: query })
        .then((rows) => {
          setResults(sortTrBy(rows, (row) => row.fullName).slice(0, MAX_RESULTS))
          setSearched(true)
        })
        // Panel bir kısayol: sonuç gelmezse boş kalır, kullanıcının o anki işini kesmez.
        .catch(() => {
          setResults([])
          setSearched(true)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, open])

  const openStudent = (row: StudentRow) => {
    onClose()
    navigate(`${STUDENTS_PATH}/${row.id}`)
  }

  return (
    <Modal open={open} title={tr.search.globalTitle} onClose={onClose}>
      <SearchInput
        value={query}
        placeholder={tr.search.globalPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const first = results[0]
          if (first) openStudent(first)
        }}
        aria-label={tr.search.globalPlaceholder}
      />

      <div className={styles.searchGroups}>
        {query.trim() === '' && <p className={styles.searchHelp}>{tr.search.typeToSearch}</p>}

        {searched && results.length === 0 && (
          <p className={styles.searchHelp}>
            &quot;{query.trim()}&quot; {tr.search.noResults}
          </p>
        )}

        {results.length > 0 && (
          <div>
            <div className={styles.searchGroupTitle}>{tr.search.groupStudents}</div>
            {results.map((row) => (
              <button
                key={row.id}
                type="button"
                className={styles.searchResult}
                onClick={() => openStudent(row)}
              >
                {row.fullName}
                <span className={styles.searchResultMeta}>
                  {row.guardianPhone ? formatPhone(row.guardianPhone) : tr.units.emptyValue}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
