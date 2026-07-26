import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { tr } from '../i18n/tr'
import { normalizeTr } from '../lib/format'
import { FieldShell } from './Field'
import type { SelectOption } from './Field'
import { marks } from './marks'
import fieldStyles from './Field.module.css'
import styles from './SearchSelect.module.css'

/**
 * Aranabilir seçim — `KULLANILABILIRLIK.md > K1`.
 *
 * Ürün sahibinin şikâyeti: *"ne selectbox'larda arama var ne kullanılabilirlik iyi."*
 * Yerel `<select>`te uzun listede tek harf atlamasından başka yol yok; 120 öğrencili
 * bir listede tahsilat almak imkânsız.
 *
 * **`Select` kaldırılmadı, yanına kondu.** Kısa listelerde (branş, ödeme yöntemi,
 * öğretmen) yerel `<select>` doğru olan: klavye, dokunmatik ve ekran okuyucu
 * davranışını işletim sistemi veriyor. Bu komponent yalnızca listenin uzun
 * olabildiği yerlerde kullanılır.
 *
 * **Eşleşme Türkçe** (`normalizeTr`, ADR-030'un ICU satırı): `ingilizce` yazınca
 * `İngilizce` bulunur. `toLocaleLowerCase('tr')` kullanılmıyor — Windows'ta ICU
 * verisinin varlığına güvenmiyoruz, `lib/format.ts` eşlemeyi elle yapıyor ve testli.
 *
 * Klavye: yaz-filtrele · `↑`/`↓` gez · `Enter` seç · `Esc` kapat (metin seçili
 * değere döner). Fare: seçenek `mousedown`'da seçilir — `click`'i beklerken girdi
 * odağı kaybeder ve liste kapanırdı.
 */
export interface SearchSelectProps {
  options: readonly SelectOption[]
  /** Seçili seçeneğin `value`'su; seçim yoksa `null`. */
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  disabled?: boolean
  /** Erişilebilir ad — `label` verilmediğinde (tablo hücresi gibi) gerekli. */
  'aria-label'?: string
}

export function SearchSelect({
  options,
  value,
  onChange,
  label,
  hint,
  error,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
}: SearchSelectProps) {
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((option) => option.value === value) ?? null
  const selectedLabel = selected?.label ?? ''

  // Kapalıyken girdi seçili değeri gösterir; dışarıdan değişirse (form yüklenince)
  // metin de onunla gelir.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open, selectedLabel])

  const matches = useMemo(() => {
    const needle = normalizeTr(query)
    const usable = options.filter((option) => !option.disabled)
    if (needle === '') return usable
    return usable.filter((option) => normalizeTr(option.label).includes(needle))
  }, [options, query])

  // Filtre daralınca imleç listenin dışında kalmasın.
  useEffect(() => {
    setActive((prev) => (prev < matches.length ? prev : 0))
  }, [matches.length])

  const openList = () => {
    if (disabled) return
    setOpen(true)
    const index = matches.findIndex((option) => option.value === value)
    setActive(index < 0 ? 0 : index)
  }

  const commit = (option: SelectOption) => {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  const close = () => {
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      if (matches.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((prev) => (prev + step + matches.length) % matches.length)
      return
    }
    if (event.key === 'Enter') {
      if (!open) return
      // Formun kendi `Enter`'ıyla çakışmasın: liste açıkken tuş burada tükenir.
      event.preventDefault()
      const option = matches[active]
      if (option) commit(option)
      return
    }
    if (event.key === 'Escape') {
      if (!open) return
      event.preventDefault()
      // Panel kapanır, dış diyalog kapanmaz — iki kapanmayı tek tuşa bindirmek
      // kullanıcıya formu kaybettiriyor.
      event.stopPropagation()
      close()
    }
  }

  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={id}>
      <div className={styles.wrap}>
        <div className={fieldStyles.selectWrap}>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? `${id}-error` : undefined}
            autoComplete="off"
            disabled={disabled}
            className={[fieldStyles.control, error ? fieldStyles.invalid : undefined]
              .filter(Boolean)
              .join(' ')}
            placeholder={selectedLabel === '' ? placeholder : selectedLabel}
            value={open ? query : selectedLabel}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              if (!open) setOpen(true)
            }}
            onFocus={openList}
            onMouseDown={() => {
              if (!open) openList()
            }}
            onBlur={close}
            onKeyDown={onKeyDown}
          />
          <span className={fieldStyles.caret} aria-hidden="true">
            {marks.caret}
          </span>
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className={styles.list}
            // Seçenek `mousedown` ile seçiliyor; varsayılan davranış girdiden odağı
            // alır ve `onBlur` listeyi seçim yazılmadan kapatırdı.
            onMouseDown={(event) => event.preventDefault()}
          >
            {matches.length === 0 ? (
              <li className={styles.empty}>{tr.form.searchSelect.noResults}</li>
            ) : (
              matches.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={[
                    styles.option,
                    index === active ? styles.optionActive : undefined,
                    option.value === value ? styles.optionSelected : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseDown={() => commit(option)}
                  onMouseEnter={() => setActive(index)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FieldShell>
  )
}
