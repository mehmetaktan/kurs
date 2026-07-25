import { useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import { searchGuardians, type Guardian } from '../../lib/api'
import { formatPhone } from '../../lib/format'
import { Button, Input, Modal, SearchInput, Select } from '../../ui'
import {
  emptyGuardianDraft,
  guardianField,
  type FieldErrors,
  type GuardianDraft,
} from './validate'
import styles from './Students.module.css'

/** Şemadaki değerler (§1.7). Metin ve saklanan değer aynı — kolon serbest metin. */
const RELATION_OPTIONS = [
  { value: tr.students.form.relations.mother, label: tr.students.form.relations.mother },
  { value: tr.students.form.relations.father, label: tr.students.form.relations.father },
  { value: tr.students.form.relations.other, label: tr.students.form.relations.other },
]

const SEARCH_DEBOUNCE_MS = 200

export interface GuardianFieldsProps {
  guardians: GuardianDraft[]
  errors: FieldErrors
  onChange: (guardians: GuardianDraft[]) => void
  onClearError: (field: string) => void
}

/**
 * Formun veli bölümü (§4).
 *
 * İki yol var ve ikisi de gerekli:
 * - **Yeni veli** — çoğu durum.
 * - **Mevcut veliyi bul ve bağla** — kardeşler. Aynı veli iki öğrenciye bağlanır ve
 *   ikinci bir kopya AÇILMAZ; telefon bir yerde değişince iki kardeşte birden değişir.
 *
 * Birincil veli tek olabilir (`ux_sg_primary`); işareti koymak diğerlerini düşürür,
 * çünkü iki birincil bir şema ihlali ve kullanıcıya gösterilecek bir hata değil.
 */
export function GuardianFields({
  guardians,
  errors,
  onChange,
  onClearError,
}: GuardianFieldsProps) {
  const [findOpen, setFindOpen] = useState(false)

  const patch = (index: number, changes: Partial<GuardianDraft>) => {
    onChange(guardians.map((guardian, i) => (i === index ? { ...guardian, ...changes } : guardian)))
  }

  const setPrimary = (index: number) => {
    onClearError('guardians.primary')
    onChange(guardians.map((guardian, i) => ({ ...guardian, isPrimary: i === index })))
  }

  const add = (guardian: GuardianDraft) => {
    // İlk veli kendiliğinden birincil olur: velisi olan bir öğrenci birincilsiz kalamaz,
    // liste telefonu ondan okuyor.
    onChange([...guardians, { ...guardian, isPrimary: guardians.length === 0 }])
  }

  const remove = (index: number) => {
    const next = guardians.filter((_, i) => i !== index)
    // Birincil çıkarıldıysa ilk kalan birincil olur.
    if (next.length > 0 && !next.some((guardian) => guardian.isPrimary)) {
      next[0] = { ...next[0]!, isPrimary: true }
    }
    onChange(next)
  }

  return (
    <div className={styles.formSection}>
      <div className={styles.guardianHead}>
        <span className={styles.guardianTitle}>{tr.students.form.guardianSection}</span>
        <div className={styles.guardianActions}>
          <Button size="small" onClick={() => setFindOpen(true)}>
            {tr.students.form.findGuardian}
          </Button>
          <Button size="small" onClick={() => add(emptyGuardianDraft(false))}>
            {tr.students.form.addGuardian}
          </Button>
        </div>
      </div>

      {errors['guardians.primary'] && (
        <div className={styles.formError} role="alert">
          {errors['guardians.primary']}
        </div>
      )}

      {guardians.length === 0 && <p className={styles.hint}>{tr.students.form.noGuardians}</p>}

      {guardians.map((guardian, index) => (
        <div className={styles.guardianCard} key={guardian.guardianId ?? `new-${index}`}>
          <div className={styles.guardianHead}>
            <span className={styles.guardianTitle}>
              {guardian.guardianId === null
                ? tr.students.form.guardianName
                : tr.students.form.guardianLinked}
            </span>
            <Button size="small" variant="ghost" onClick={() => remove(index)}>
              {tr.students.form.removeGuardian}
            </Button>
          </div>

          <div className={styles.formGrid}>
            <Input
              label={tr.students.form.guardianName}
              value={guardian.fullName}
              error={errors[guardianField(index, 'fullName')]}
              onChange={(event) => {
                onClearError(guardianField(index, 'fullName'))
                patch(index, { fullName: event.target.value })
              }}
            />

            <div className={styles.formPair}>
              <Input
                label={tr.students.form.guardianPhone}
                placeholder={tr.students.form.phonePlaceholder}
                inputMode="tel"
                value={guardian.phone}
                error={errors[guardianField(index, 'phone')]}
                onChange={(event) => {
                  onClearError(guardianField(index, 'phone'))
                  patch(index, { phone: event.target.value })
                }}
              />
              <Select
                label={tr.students.form.guardianRelation}
                value={guardian.relation}
                placeholder={tr.units.emptyValue}
                options={RELATION_OPTIONS}
                onChange={(event) => patch(index, { relation: event.target.value })}
              />
            </div>

            <Input
              label={tr.students.form.guardianEmail}
              type="email"
              value={guardian.email}
              onChange={(event) => patch(index, { email: event.target.value })}
            />

            {/*
              Radyo davranışı: birincil işaretini koymak diğerlerini düşürür. `Checkbox`
              kullanılıyor çünkü tek elemanlı bir radyo grubu klavyeyle terk edilemez —
              kullanıcı işareti kaldıramaz.
            */}
            <label className={styles.hint}>
              <input
                type="radio"
                name="guardian-primary"
                checked={guardian.isPrimary}
                onChange={() => setPrimary(index)}
              />{' '}
              {tr.students.form.guardianPrimary}
            </label>
            {guardian.isPrimary && (
              <span className={styles.hint}>{tr.students.form.guardianPrimaryHint}</span>
            )}
          </div>
        </div>
      ))}

      <FindGuardianModal
        open={findOpen}
        onClose={() => setFindOpen(false)}
        alreadyLinked={guardians.map((guardian) => guardian.guardianId)}
        onPick={(guardian) => {
          setFindOpen(false)
          add({
            guardianId: guardian.id,
            fullName: guardian.fullName,
            phone: guardian.phone ?? '',
            email: guardian.email ?? '',
            relation: '',
            isPrimary: false,
          })
        }}
      />
    </div>
  )
}

/** "Mevcut veliyi bul" — kardeş kaydında ikinci bir veli kopyası açılmasın (§4). */
function FindGuardianModal({
  open,
  onClose,
  onPick,
  alreadyLinked,
}: {
  open: boolean
  onClose: () => void
  onPick: (guardian: Guardian) => void
  alreadyLinked: (number | null)[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Guardian[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSearched(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (query.trim() === '') {
      setResults([])
      setSearched(false)
      return
    }

    const timer = setTimeout(() => {
      void searchGuardians(query)
        .then((found) => {
          setResults(found.filter((guardian) => !alreadyLinked.includes(guardian.id)))
          setSearched(true)
        })
        // Arama sonucu gelmezse boş liste: kullanıcı yeni veli ekleme yolunu kullanır.
        .catch(() => {
          setResults([])
          setSearched(true)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, open, alreadyLinked])

  return (
    <Modal
      open={open}
      title={tr.students.form.findGuardianTitle}
      description={tr.students.form.findGuardianHint}
      onClose={onClose}
    >
      <SearchInput
        value={query}
        placeholder={tr.students.form.findGuardianPlaceholder}
        aria-label={tr.students.form.findGuardianPlaceholder}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className={styles.guardianResults}>
        {query.trim() === '' && (
          <p className={styles.hint}>{tr.students.form.findGuardianStart}</p>
        )}
        {searched && results.length === 0 && (
          <p className={styles.hint}>{tr.students.form.findGuardianEmpty}</p>
        )}
        {results.map((guardian) => (
          <button
            key={guardian.id}
            type="button"
            className={styles.guardianResult}
            onClick={() => onPick(guardian)}
          >
            {guardian.fullName}
            <span className={styles.guardianResultMeta}>{formatPhone(guardian.phone)}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
