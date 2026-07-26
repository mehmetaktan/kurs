import { useCallback, useEffect, useMemo, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  addGroupMember,
  addStudentNote,
  archiveGroup,
  endGroupMembership,
  fetchGroupDetail,
  fetchStudentList,
  restoreGroup,
  type AppError,
  type GroupDetail,
  type GroupMember,
  type GroupNote,
  type GroupSessionRow,
  type StudentRow,
} from '../../lib/api'
import { formatDate, formatTime } from '../../lib/format'
import { navigate } from '../../lib/router'
import { sortTrBy } from '../../lib/sortTr'
import { PageContent } from '../../shell/AppShell'
import {
  Badge,
  Button,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  SearchSelect,
  Select,
  StatCard,
  StatStrip,
  StatusDot,
  Table,
  Tabs,
  Textarea,
  useToast,
} from '../../ui'
import type { Column } from '../../ui'
import { subjectColorOf } from '../tanimlar/palette'
import { GroupForm } from './GroupForm'
import { isOverCapacity, weeklySummary } from './filters'
import styles from './Groups.module.css'

type DetailTab = 'members' | 'sessions' | 'notes'

const GROUPS_PATH = '/gruplar'

/**
 * EKRANLAR.md E5 — `Grup detayı`.
 *
 * Özet şerit kolonları **Öğrenci detayıyla aynı** (tasarım dosyasının şartı):
 * Doluluk · Haftalık program · Devam oranı · Sıradaki ders.
 *
 * Üç sekme. `Seans geçmişi`, `generate_sessions`'ın ürettiği dersleri gösteren ekran —
 * takvim Faz 5C'ye kaldığı için üretimin çalıştığını bugün burada görüyoruz.
 */
export function GroupDetailPage({ groupId }: { groupId: number }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [tab, setTab] = useState<DetailTab>('members')
  const [formOpen, setFormOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      setDetail(await fetchGroupDetail(groupId))
    } catch (err) {
      setError(err as AppError)
      setDetail(null)
    }
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  // `Esc` listeye döner. Diyalog ya da çekmece açıkken devreye girmez — onların kendi
  // `Esc`'i var ve önce onlar kapanmalı.
  useEffect(() => {
    if (formOpen || confirmArchive || addOpen || removing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(GROUPS_PATH)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formOpen, confirmArchive, addOpen, removing])

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      toast(message)
      await load()
    } catch (err) {
      setError(err as AppError)
    }
  }

  if (error && !detail) {
    return (
      <PageContent>
        <BackRow />
        <ErrorState message={error.message} onRetry={() => void load()} />
      </PageContent>
    )
  }

  if (!detail) {
    return (
      <PageContent>
        <BackRow />
        <LoadingState />
      </PageContent>
    )
  }

  const { group, members, sessions, notes } = detail

  return (
    <>
      <PageContent>
        <BackRow />

        {/* Yükleme sonrası çıkan hata: veri ekranda kalır, hata üstte durur. */}
        {error && <ErrorState inline message={error.message} onRetry={() => void load()} />}

        <div className={styles.identity}>
          <div>
            <h1 className={styles.identityName}>
              {group.name}
              {group.archived && <Badge tone="neutral">{tr.groups.table.archived}</Badge>}
            </h1>
            <div className={styles.identityMeta}>
              <span
                className={styles.swatch}
                style={{ background: subjectColorOf(group.subjectColor) }}
                aria-hidden
              />
              {group.subjectName}
              {tr.units.separator}
              <StatusDot
                tone={group.isActive ? 'success' : 'neutral'}
                hollow={!group.isActive}
                label={group.isActive ? tr.groups.table.active : tr.groups.table.passive}
              />
              {group.teacherName && (
                <>
                  {tr.units.separator}
                  {group.teacherName}
                </>
              )}
            </div>
          </div>

          <div className={styles.identityActions}>
            {group.archived ? (
              <Button
                variant="primary"
                onClick={() => void run(() => restoreGroup(group.id), tr.groups.table.restore)}
              >
                {tr.groups.table.restore}
              </Button>
            ) : (
              <>
                <Button onClick={() => setFormOpen(true)}>{tr.actions.edit}</Button>
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  {tr.groups.detail.archive.confirm}
                </Button>
              </>
            )}
          </div>
        </div>

        <SummaryStrip detail={detail} />

        <Tabs
          label={tr.pages.groups.title}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'members', label: tr.groups.detail.tabs.members, count: members.length },
            { value: 'sessions', label: tr.groups.detail.tabs.sessions },
            { value: 'notes', label: tr.groups.detail.tabs.notes, count: notes.length },
          ]}
        />

        <div className={styles.tabPanel}>
          {tab === 'members' && (
            <MembersTab
              members={members}
              onAdd={() => setAddOpen(true)}
              onRemove={setRemoving}
            />
          )}
          {tab === 'sessions' && <SessionsTab sessions={sessions} />}
          {tab === 'notes' && (
            <NotesTab
              notes={notes}
              members={members}
              onAdded={() => void load()}
              onError={setError}
            />
          )}
        </div>
      </PageContent>

      <GroupForm
        open={formOpen}
        groupId={group.id}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          void load()
        }}
      />

      <AddMemberDialog
        open={addOpen}
        detail={detail}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false)
          void load()
        }}
        onError={setError}
      />

      <ConfirmDialog
        open={removing !== null}
        title={tr.groups.detail.members.remove_.title}
        description={`${removing?.fullName ?? ''} ${tr.groups.detail.members.remove_.body}`}
        confirmLabel={tr.groups.detail.members.remove_.confirm}
        destructive
        onConfirm={() => {
          const target = removing
          setRemoving(null)
          if (target) {
            void run(
              () => endGroupMembership(target.enrollmentId),
              tr.groups.detail.members.remove_.done,
            )
          }
        }}
        onCancel={() => setRemoving(null)}
      />

      <ConfirmDialog
        open={confirmArchive}
        title={tr.groups.detail.archive.title}
        description={`${group.name} ${tr.groups.detail.archive.body}`}
        confirmLabel={tr.groups.detail.archive.confirm}
        destructive
        onConfirm={() => {
          setConfirmArchive(false)
          void run(() => archiveGroup(group.id), tr.groups.detail.archive.done)
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  )
}

function BackRow() {
  return (
    <div className={styles.backRow}>
      <button type="button" className={styles.backLink} onClick={() => navigate(GROUPS_PATH)}>
        ← {tr.groups.detail.back}
      </button>
    </div>
  )
}

/**
 * Özet şerit — kolonları Öğrenci detayıyla **aynı** (tasarımın şartı).
 *
 * Devam oranı `markedCount` üzerinden: payda "yoklama satırı yazılmış öğrenci-ders"
 * sayısı, pay "Geldi". Seans sayısı üzerinden hesaplansaydı 6 kişilik grupta bir
 * öğrencinin gelmemesi oranı hiç etkilemezdi.
 */
function SummaryStrip({ detail }: { detail: GroupDetail }) {
  const { group, markedCount, attendedCount } = detail
  const rate = markedCount > 0 ? Math.round((attendedCount / markedCount) * 100) : null
  const summary = weeklySummary(group)

  return (
    <StatStrip>
      <StatCard
        label={tr.groups.detail.stats.occupancy}
        value={`${group.memberCount}/${group.capacity}`}
        tone={isOverCapacity(group) ? 'warn' : 'default'}
        caption={isOverCapacity(group) ? tr.groups.table.overCapacity : undefined}
        captionTone={isOverCapacity(group) ? 'warn' : 'default'}
      />
      <StatCard
        label={tr.groups.detail.stats.weekly}
        value={group.weekly.length === 0 ? null : `${group.weekly.length}`}
        caption={summary === '' ? tr.groups.table.noSchedule : summary}
      />
      <StatCard
        label={tr.groups.detail.stats.attendance}
        value={rate === null ? null : `%${rate}`}
        // Faz 4'ün varsayımıyla aynı (PRD S7 Faz 9'da cevaplanacak): pencere "tüm
        // işlenen dersler". Değişirse tek bir yer değişir.
        caption={rate === null ? tr.groups.detail.noAttendance : tr.groups.detail.attendanceHint}
      />
      <StatCard
        label={tr.groups.detail.stats.next}
        value={group.nextSessionAt === null ? null : formatDate(group.nextSessionAt.slice(0, 10))}
        caption={
          group.nextSessionAt === null
            ? tr.groups.detail.noNext
            : formatTime(group.nextSessionAt.slice(11))
        }
      />
    </StatStrip>
  )
}

function MembersTab({
  members,
  onAdd,
  onRemove,
}: {
  members: GroupMember[]
  onAdd: () => void
  onRemove: (member: GroupMember) => void
}) {
  const columns: Column<GroupMember>[] = [
    {
      key: 'name',
      header: tr.groups.detail.members.name,
      width: 'minmax(160px, 1.4fr)',
      render: (row) => (
        <button
          type="button"
          className={styles.backLink}
          onClick={() => navigate(`/ogrenciler/${row.studentId}`)}
        >
          {row.fullName}
        </button>
      ),
    },
    {
      key: 'startOn',
      header: tr.groups.detail.members.startOn,
      width: '120px',
      render: (row) => <span className={styles.tabular}>{formatDate(row.startOn)}</span>,
    },
    {
      key: 'endOn',
      header: tr.groups.detail.members.endOn,
      width: '120px',
      render: (row) => (
        <span className={styles.tabular}>
          {row.endOn ? formatDate(row.endOn) : <span className={styles.empty}>{tr.units.emptyValue}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: tr.groups.detail.members.status,
      width: '110px',
      render: (row) => (
        <StatusDot
          tone={row.isCurrent ? 'success' : 'neutral'}
          hollow={!row.isCurrent}
          label={row.isCurrent ? tr.groups.detail.members.current : tr.groups.detail.members.left}
        />
      ),
    },
    {
      key: 'action',
      header: '',
      width: '140px',
      align: 'end',
      render: (row) => (
        <span className={styles.rowActions}>
          {/* Ayrılmış üyede düğme yok: kayıt kapalı, ikinci kez kapatılamaz (R5.8). */}
          {row.isCurrent && (
            <Button size="small" onClick={() => onRemove(row)}>
              {tr.groups.detail.members.remove}
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className={styles.panelHead}>
        <p className={styles.lead}>{tr.groups.detail.members.emptyBody}</p>
        <Button variant="primary" onClick={onAdd}>
          {tr.groups.detail.members.add}
        </Button>
      </div>
      <Table
        label={tr.groups.detail.members.table}
        columns={columns}
        rows={members}
        rowKey={(row) => row.enrollmentId}
        emptyState={
          <EmptyState
            title={tr.groups.detail.members.empty}
            body={tr.groups.detail.members.emptyBody}
            action={
              <Button variant="primary" onClick={onAdd}>
                {tr.groups.detail.members.add}
              </Button>
            }
          />
        }
      />
    </>
  )
}

function SessionsTab({ sessions }: { sessions: GroupSessionRow[] }) {
  // En yeni üstte: seans geçmişi geriye doğru okunuyor. Rust `starts_at` artan
  // veriyor (zaman kolonu — ADR-020 yasağı metin kolonları için).
  const rows = useMemo(() => [...sessions].reverse(), [sessions])

  const columns: Column<GroupSessionRow>[] = [
    {
      key: 'date',
      header: tr.groups.detail.sessions.date,
      width: '140px',
      render: (row) => <span className={styles.tabular}>{formatDate(row.startsAt.slice(0, 10))}</span>,
    },
    {
      key: 'time',
      header: tr.groups.detail.sessions.time,
      width: '140px',
      render: (row) => (
        <span className={styles.tabular}>
          {formatTime(row.startsAt.slice(11))}–{formatTime(row.endsAt.slice(11))}
        </span>
      ),
    },
    {
      key: 'status',
      header: tr.groups.detail.sessions.status,
      width: '120px',
      render: (row) =>
        row.status === 'cancelled' ? (
          <StatusDot tone="neutral" hollow label={tr.groups.detail.sessions.cancelled} />
        ) : row.attendanceTaken ? (
          <StatusDot tone="success" label={tr.groups.detail.sessions.done} />
        ) : (
          <StatusDot tone="neutral" hollow label={tr.groups.detail.sessions.planned} />
        ),
    },
    {
      key: 'attendance',
      header: tr.groups.detail.sessions.attendance,
      width: 'minmax(120px, 1fr)',
      align: 'end',
      render: (row) =>
        row.attendanceTaken ? (
          <span className={styles.tabular}>
            {row.presentCount}
            {tr.groups.detail.sessions.attendedOf}
            {row.markedCount}
          </span>
        ) : (
          <span className={styles.empty}>{tr.groups.detail.sessions.notTaken}</span>
        ),
    },
  ]

  return (
    <Table
      label={tr.groups.detail.sessions.table}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      emptyState={
        <EmptyState
          title={tr.groups.detail.sessions.empty}
          body={tr.groups.detail.sessions.emptyBody}
        />
      }
    />
  )
}

/**
 * Notlar — **ayrı bir grup notu tablosu açılmıyor** (`faz-05.md §2`). Üyelerin
 * `student_note` kayıtlarının birleşik akışı; not eklerken öğrenci seçtiriliyor,
 * çünkü not sahibi bir öğrenciye ait olmak zorunda (§1.20).
 */
function NotesTab({
  notes,
  members,
  onAdded,
  onError,
}: {
  notes: GroupNote[]
  members: GroupMember[]
  onAdded: () => void
  onError: (error: AppError) => void
}) {
  const [studentId, setStudentId] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const current = members.filter((member) => member.isCurrent)

  const submit = async () => {
    if (studentId === '' || body.trim() === '') return
    setSaving(true)
    try {
      await addStudentNote(Number(studentId), body.trim())
      toast(tr.groups.detail.notes.added)
      setBody('')
      onAdded()
    } catch (err) {
      onError(err as AppError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className={styles.lead}>{tr.groups.detail.notes.lead}</p>

      <div className={styles.noteComposer}>
        <Select
          label={tr.groups.detail.notes.student}
          value={studentId}
          placeholder={tr.groups.detail.notes.studentPlaceholder}
          options={sortTrBy(current, (m) => m.fullName).map((member) => ({
            value: String(member.studentId),
            label: member.fullName,
          }))}
          onChange={(event) => setStudentId(event.target.value)}
        />
        <Textarea
          label={tr.groups.detail.notes.body}
          value={body}
          rows={3}
          placeholder={tr.groups.detail.notes.bodyPlaceholder}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className={styles.noteComposerFoot}>
          <Button
            variant="primary"
            disabled={saving || studentId === '' || body.trim() === ''}
            onClick={() => void submit()}
          >
            {tr.groups.detail.notes.add}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className={styles.noteList}>
          <EmptyState
            title={tr.groups.detail.notes.empty}
            body={tr.groups.detail.notes.emptyBody}
          />
        </div>
      ) : (
        <div className={styles.noteList}>
          {notes.map((note) => (
            <div key={note.id} className={styles.noteItem}>
              <div className={styles.noteHead}>
                <span>{note.studentName}</span>
                <span className={styles.tabular}>{formatDate(note.notedOn)}</span>
              </div>
              <div className={styles.noteBody}>{note.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Gruba öğrenci ekleme.
 *
 * **Kapasite aşımında onay istenir, engellenmez** (PRD S2 / K-8 / R5.6). Diyalog kaç
 * kişilik gruba kaçıncı öğrencinin eklendiğini söylüyor — "kapasite doldu" tek başına
 * kullanıcıya kararı verecek bilgiyi vermiyor.
 */
function AddMemberDialog({
  open,
  detail,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean
  detail: GroupDetail
  onClose: () => void
  onAdded: () => void
  onError: (error: AppError) => void
}) {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [studentId, setStudentId] = useState('')
  const [startOn, setStartOn] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setStudentId('')
    setStartOn(null)
    setConfirming(false)
    void fetchStudentList()
      .then(setStudents)
      .catch(() => setStudents([]))
  }, [open])

  const currentIds = new Set(
    detail.members.filter((member) => member.isCurrent).map((member) => member.studentId),
  )
  const options = sortTrBy(
    students.filter((student) => !student.archived && !currentIds.has(student.id)),
    (student) => student.fullName,
  )

  const persist = async () => {
    setSaving(true)
    try {
      await addGroupMember(detail.group.id, Number(studentId), startOn)
      toast(tr.groups.detail.members.picker.added)
      onAdded()
    } catch (err) {
      // K-22 (aynı branşta çakışan açık kayıt) buradan geçer: Rust reddeder,
      // mesajı Türkçe ve eylem önerir ("Önce onu kapatmak ister misiniz?").
      onError(err as AppError)
      onClose()
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  const submit = () => {
    if (studentId === '') return
    const { memberCount, capacity } = detail.group
    if (memberCount >= capacity) {
      setConfirming(true)
      return
    }
    void persist()
  }

  if (!open) return null

  const { memberCount, capacity } = detail.group

  return (
    <>
      <Modal
        open={!confirming}
        title={tr.groups.detail.members.picker.title}
        onClose={onClose}
        actions={
          <Button variant="primary" disabled={saving || studentId === ''} onClick={submit}>
            {tr.groups.detail.members.picker.submit}
          </Button>
        }
      >
        <div className={styles.formSection}>
          {/* K1 — kursun BÜTÜN öğrencileri listeleniyor; yerel `<select>`te tek harf
              atlamasından başka yol yoktu. Aranabilir seçim tam olarak bunun için. */}
          <SearchSelect
            label={tr.groups.detail.members.picker.student}
            value={studentId === '' ? null : studentId}
            placeholder={tr.groups.detail.members.picker.studentPlaceholder}
            options={options.map((student) => ({
              value: String(student.id),
              label: student.fullName,
            }))}
            onChange={(value) => setStudentId(value ?? '')}
          />
          <DatePicker
            label={tr.groups.detail.members.picker.startOn}
            hint={tr.groups.detail.members.picker.startOnHint}
            value={startOn}
            onChange={setStartOn}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title={tr.groups.detail.members.capacity.title}
        description={`${tr.groups.detail.members.capacity.prefix} ${capacity} ${tr.groups.detail.members.capacity.middle} ${memberCount + 1}. ${tr.groups.detail.members.capacity.suffix}`}
        confirmLabel={tr.groups.detail.members.capacity.confirm}
        confirmHint={tr.groups.detail.members.capacity.hint}
        onConfirm={() => void persist()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
