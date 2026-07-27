import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  archiveSubject,
  fetchStudyGroups,
  fetchSubjects,
  saveSubject,
  type AppError,
  type StudyGroup,
  type Subject,
} from '../../lib/api'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  SectionHeader,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { DEFAULT_SUBJECT_COLOR, SUBJECT_COLORS, subjectColorOf } from './palette'
import styles from './Definitions.module.css'

/** Taslak satırın id'si. Gerçek bir `subject.id` asla 0 olmaz (SQLite 1'den başlar). */
const DRAFT_ID = 0

interface Draft {
  name: string
  color: string
  defaultMin: string
}

/**
 * EKRANLAR.md E7 — Tanımlar → Branşlar.
 *
 * **Satır içi düzenleme** (tasarımın şartı): satır düzenleme kipine geçince hücreler
 * girdiye dönüşür. `Table` satır tıklamasını `input`/`select` üzerinde zaten yutmuyor,
 * o yüzden ayrı bir form ekranı gerekmiyor — üç alanlı bir kayıt için çekmece açmak
 * kullanıcıyı gereksiz bir adıma sokardı.
 */
export function SubjectsTab() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null)
  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [error, setError] = useState<AppError | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>({ name: '', color: DEFAULT_SUBJECT_COLOR, defaultMin: '' })
  const [fieldError, setFieldError] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Subject | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextSubjects, nextGroups] = await Promise.all([fetchSubjects(), fetchStudyGroups()])
      setSubjects(nextSubjects)
      setGroups(nextGroups)
    } catch (err) {
      setError(err as AppError)
      setSubjects(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = (subject: Subject) => {
    setFieldError(null)
    setEditingId(subject.id)
    setDraft({
      name: subject.name,
      color: subjectColorOf(subject.color),
      defaultMin: subject.defaultMin === null ? '' : String(subject.defaultMin),
    })
  }

  const startCreate = () => {
    setFieldError(null)
    setEditingId(DRAFT_ID)
    setDraft({ name: '', color: DEFAULT_SUBJECT_COLOR, defaultMin: '' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFieldError(null)
  }

  const submit = async () => {
    const minutes = draft.defaultMin.trim()
    try {
      await saveSubject({
        id: editingId === DRAFT_ID ? null : editingId,
        name: draft.name,
        color: draft.color,
        // Boş bırakılırsa `null` — "genel ayar geçerli" demek (PRD S4). `0` ile
        // karıştırılmasın diye ayrıştırılamayan girdi de `null`'a düşmüyor, hata veriyor.
        defaultMin: minutes === '' ? null : Number(minutes),
        sortOrder: 0,
      })
      toast(tr.definitions.subjects.saved)
      setEditingId(null)
      setFieldError(null)
      await load()
    } catch (err) {
      setFieldError(err as AppError)
    }
  }

  const confirmArchive = async () => {
    if (!archiving) return
    try {
      await archiveSubject(archiving.id)
      toast(tr.definitions.subjects.archive.done)
      setArchiving(null)
      await load()
    } catch (err) {
      setArchiving(null)
      setError(err as AppError)
    }
  }

  const groupCount = (subjectId: number) =>
    groups.filter((group) => group.subjectId === subjectId).length

  const rows: Subject[] =
    subjects === null
      ? []
      : editingId === DRAFT_ID
        ? [{ id: DRAFT_ID, name: '', color: null, defaultMin: null, sortOrder: 0 }, ...sortTrBy(subjects, (s) => s.name)]
        : sortTrBy(subjects, (s) => s.name)

  const columns: Column<Subject>[] = [
    {
      key: 'name',
      header: tr.definitions.subjects.table.name,
      width: 'minmax(180px, 1.6fr)',
      render: (row) =>
        row.id === editingId ? (
          <Input
            value={draft.name}
            placeholder={tr.definitions.subjects.form.namePlaceholder}
            aria-label={tr.definitions.subjects.form.name}
            autoFocus
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') cancelEdit()
            }}
          />
        ) : (
          <span className={styles.swatchCell}>
            <span
              className={styles.swatch}
              style={{ background: subjectColorOf(row.color) }}
              aria-hidden
            />
            {row.name}
          </span>
        ),
    },
    {
      key: 'color',
      header: tr.definitions.subjects.table.color,
      width: '180px',
      render: (row) =>
        row.id === editingId ? (
          <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        ) : (
          <span className={styles.muted}>{colorLabel(row.color)}</span>
        ),
    },
    {
      key: 'defaultMin',
      header: tr.definitions.subjects.table.defaultMin,
      width: '150px',
      align: 'end',
      render: (row) =>
        row.id === editingId ? (
          <Input
            value={draft.defaultMin}
            inputMode="numeric"
            placeholder={tr.definitions.subjects.inherited}
            aria-label={tr.definitions.subjects.form.defaultMin}
            onChange={(event) => setDraft({ ...draft, defaultMin: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') cancelEdit()
            }}
          />
        ) : (
          <span className={styles.tabular}>
            {row.defaultMin === null ? (
              // Boş hücre yerine "Genel ayar": kullanıcı sürenin tanımsız değil,
              // devralınmış olduğunu görmeli (PRD S4).
              <span className={styles.muted}>{tr.definitions.subjects.inherited}</span>
            ) : (
              `${row.defaultMin} ${tr.definitions.subjects.form.minutesSuffix}`
            )}
          </span>
        ),
    },
    {
      key: 'groups',
      header: tr.definitions.subjects.table.groups,
      width: '80px',
      align: 'end',
      render: (row) =>
        row.id === DRAFT_ID ? null : (
          <span className={styles.tabular}>{groupCount(row.id)}</span>
        ),
    },
    {
      key: 'action',
      header: tr.definitions.subjects.table.action,
      width: '190px',
      align: 'end',
      render: (row) =>
        row.id === editingId ? (
          <span className={styles.colorRow}>
            <Button size="small" onClick={cancelEdit}>
              {tr.actions.cancel}
            </Button>
            <Button size="small" variant="primary" onClick={() => void submit()}>
              {tr.actions.save}
            </Button>
          </span>
        ) : (
          <span className={styles.colorRow}>
            <Button size="small" onClick={() => startEdit(row)}>
              {tr.actions.edit}
            </Button>
            <Button size="small" onClick={() => setArchiving(row)}>
              {tr.definitions.subjects.archive.confirm}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <section className={styles.section}>
      <SectionHeader title={tr.definitions.subjects.heading} />
      <div className={styles.sectionHead}>
        <p className={styles.lead}>{tr.definitions.subjects.lead}</p>
        <Button variant="primary" onClick={startCreate} disabled={editingId === DRAFT_ID}>
          {tr.definitions.subjects.newSubject}
        </Button>
      </div>

      {subjects === null && !error && <LoadingState />}
      {error && (
        <ErrorState message={error.message} details={error.details} onRetry={() => void load()} />
      )}

      {fieldError && (
        <p className={styles.formError} role="alert">
          {fieldError.message}
        </p>
      )}

      {subjects !== null && !error && (
        <Table
          label={tr.definitions.subjects.table.label}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title={tr.definitions.subjects.empty}
              body={tr.definitions.subjects.emptyBody}
              action={
                <Button variant="primary" onClick={startCreate}>
                  {tr.definitions.subjects.newSubject}
                </Button>
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        title={tr.definitions.subjects.archive.title}
        description={`${archiving?.name ?? ''} ${tr.definitions.subjects.archive.body}`}
        confirmLabel={tr.definitions.subjects.archive.confirm}
        destructive
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiving(null)}
      />
    </section>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className={styles.colorRow} role="group" aria-label={tr.definitions.subjects.form.color}>
      {SUBJECT_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={[styles.colorButton, value === color.value ? styles.colorButtonActive : undefined]
            .filter(Boolean)
            .join(' ')}
          aria-label={color.label}
          aria-pressed={value === color.value}
          onClick={() => onChange(color.value)}
        >
          <span className={styles.colorDot} style={{ background: color.value }} />
        </button>
      ))}
    </div>
  )
}

function colorLabel(color: string | null): string {
  const resolved = subjectColorOf(color)
  return SUBJECT_COLORS.find((item) => item.value === resolved)?.label ?? tr.units.emptyValue
}
