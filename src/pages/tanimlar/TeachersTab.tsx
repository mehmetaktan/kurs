import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  archiveTeacher,
  fetchTeachers,
  saveTeacher,
  type AppError,
  type Teacher,
} from '../../lib/api'
import { formatPhone } from '../../lib/format'
import { sortTrBy } from '../../lib/sortTr'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PhoneInput,
  SectionHeader,
  Table,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { DEFAULT_SUBJECT_COLOR, SUBJECT_COLORS, subjectColorOf } from './palette'
import styles from './Definitions.module.css'

/** Taslak satırın id'si — gerçek bir `teacher.id` asla 0 olmaz (SQLite 1'den başlar). */
const DRAFT_ID = 0

interface Draft {
  fullName: string
  color: string
  phone: string
  email: string
  isActive: boolean
}

const EMPTY: Draft = {
  fullName: '',
  color: DEFAULT_SUBJECT_COLOR,
  phone: '',
  email: '',
  isActive: true,
}

/**
 * Tanımlar → Öğretmenler — **ADR-037** (ADR-011 düştü).
 *
 * Üç faz boyunca `teacher` tablosunda `'Öğretmen'` adlı tek bir satır vardı ve onu
 * değiştirecek ekran yoktu; Gruplar listesinin `Öğretmen` kolonunda `Öğretmen`
 * yazıyordu. Migration'ın yazdığı o satır burada **ilk kayıt** olarak duruyor.
 *
 * Satır içi düzenleme `SubjectsTab` ile aynı gerekçeyle: beş alanlı bir kayıt için
 * çekmece açmak kullanıcıyı gereksiz bir adıma sokardı.
 *
 * **`is_active` ile arşiv iki farklı şey.** Pasif öğretmen bu listede kalır (yoksa
 * geri açılamaz), yeni ders seçimlerinde çıkmaz; arşivlenen listeden kalkar.
 */
export function TeachersTab() {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [fieldError, setFieldError] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Teacher | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      setTeachers(await fetchTeachers())
    } catch (err) {
      setError(err as AppError)
      setTeachers(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEdit = (teacher: Teacher) => {
    setFieldError(null)
    setEditingId(teacher.id)
    setDraft({
      fullName: teacher.fullName,
      color: subjectColorOf(teacher.color),
      phone: teacher.phone ?? '',
      email: teacher.email ?? '',
      isActive: teacher.isActive,
    })
  }

  const startCreate = () => {
    setFieldError(null)
    setEditingId(DRAFT_ID)
    setDraft(EMPTY)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFieldError(null)
  }

  const submit = async () => {
    try {
      await saveTeacher({
        id: editingId === DRAFT_ID ? null : editingId,
        fullName: draft.fullName,
        color: draft.color,
        phone: draft.phone.trim() === '' ? null : draft.phone,
        email: draft.email.trim() === '' ? null : draft.email,
        isActive: draft.isActive,
        sortOrder: 0,
      })
      toast(tr.definitions.teachers.saved)
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
      await archiveTeacher(archiving.id)
      toast(tr.definitions.teachers.archive.done)
      setArchiving(null)
      await load()
    } catch (err) {
      setArchiving(null)
      setError(err as AppError)
    }
  }

  const draftRow: Teacher = {
    id: DRAFT_ID,
    fullName: '',
    color: DEFAULT_SUBJECT_COLOR,
    phone: null,
    email: null,
    isActive: true,
    sortOrder: 0,
  }

  const rows: Teacher[] =
    teachers === null
      ? []
      : editingId === DRAFT_ID
        ? [draftRow, ...sortTrBy(teachers, (t) => t.fullName)]
        : sortTrBy(teachers, (t) => t.fullName)

  const submitKeys = (event: { key: string }) => {
    if (event.key === 'Enter') void submit()
    if (event.key === 'Escape') cancelEdit()
  }

  const columns: Column<Teacher>[] = [
    {
      key: 'name',
      header: tr.definitions.teachers.table.name,
      width: 'minmax(180px, 1.6fr)',
      render: (row) =>
        row.id === editingId ? (
          <Input
            value={draft.fullName}
            placeholder={tr.definitions.teachers.form.namePlaceholder}
            aria-label={tr.definitions.teachers.form.name}
            autoFocus
            onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
            onKeyDown={submitKeys}
          />
        ) : (
          <span className={styles.swatchCell}>
            <span
              className={styles.swatch}
              style={{ background: subjectColorOf(row.color) }}
              aria-hidden
            />
            {row.fullName}
          </span>
        ),
    },
    {
      key: 'color',
      header: tr.definitions.teachers.table.color,
      width: '180px',
      render: (row) =>
        row.id === editingId ? (
          <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        ) : (
          <span className={styles.muted}>{colorLabel(row.color)}</span>
        ),
    },
    {
      key: 'phone',
      header: tr.definitions.teachers.table.phone,
      width: '170px',
      render: (row) =>
        row.id === editingId ? (
          <PhoneInput
            value={draft.phone}
            aria-label={tr.definitions.teachers.form.phone}
            onChange={(phone) => setDraft({ ...draft, phone })}
          />
        ) : (
          // ADR-027: telefonun biçimi veri değil, gösterim.
          <span className={styles.tabular}>
            {row.phone ? formatPhone(row.phone) : <span className={styles.muted}>{tr.units.emptyValue}</span>}
          </span>
        ),
    },
    {
      key: 'email',
      header: tr.definitions.teachers.table.email,
      width: 'minmax(160px, 1fr)',
      render: (row) =>
        row.id === editingId ? (
          <Input
            value={draft.email}
            type="email"
            placeholder={tr.definitions.teachers.form.emailPlaceholder}
            aria-label={tr.definitions.teachers.form.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            onKeyDown={submitKeys}
          />
        ) : row.email ? (
          <span>{row.email}</span>
        ) : (
          <span className={styles.muted}>{tr.units.emptyValue}</span>
        ),
    },
    {
      key: 'status',
      header: tr.definitions.teachers.table.status,
      width: '110px',
      render: (row) =>
        row.id === editingId ? (
          <Checkbox
            label={tr.definitions.teachers.form.active}
            checked={draft.isActive}
            onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
          />
        ) : row.isActive ? (
          <span>{tr.definitions.teachers.active}</span>
        ) : (
          <span className={styles.muted}>{tr.definitions.teachers.inactive}</span>
        ),
    },
    {
      key: 'action',
      header: tr.definitions.teachers.table.action,
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
              {tr.definitions.teachers.archive.confirm}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <section className={styles.section}>
      <SectionHeader title={tr.definitions.teachers.heading} />
      <div className={styles.sectionHead}>
        <p className={styles.lead}>
          {tr.definitions.teachers.lead} {tr.definitions.teachers.inactiveHint}
        </p>
        <Button variant="primary" onClick={startCreate} disabled={editingId === DRAFT_ID}>
          {tr.definitions.teachers.newTeacher}
        </Button>
      </div>

      {teachers === null && !error && <LoadingState />}
      {error && <ErrorState message={error.message} onRetry={() => void load()} />}

      {fieldError && (
        <p className={styles.formError} role="alert">
          {fieldError.message}
        </p>
      )}

      {teachers !== null && !error && (
        <Table
          label={tr.definitions.teachers.table.label}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title={tr.definitions.teachers.empty}
              body={tr.definitions.teachers.emptyBody}
              action={
                <Button variant="primary" onClick={startCreate}>
                  {tr.definitions.teachers.newTeacher}
                </Button>
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={archiving !== null}
        title={tr.definitions.teachers.archive.title}
        description={`${archiving?.fullName ?? ''} ${tr.definitions.teachers.archive.body}`}
        confirmLabel={tr.definitions.teachers.archive.confirm}
        destructive
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiving(null)}
      />
    </section>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className={styles.colorRow} role="group" aria-label={tr.definitions.teachers.form.color}>
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
