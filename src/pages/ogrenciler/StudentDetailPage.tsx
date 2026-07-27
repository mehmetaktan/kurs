import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import {
  addStudentNote,
  archiveStudent,
  archiveStudentNote,
  closePackage,
  fetchStudentPackages,
  fetchStudentDetail,
  restoreStudent,
  setStudentActive,
  type AppError,
  type PackageCloseMode,
  type PackageOverview,
  type StudentDetail,
} from '../../lib/api'
import { formatDate, formatLira, formatPhone, formatTime, weekdayTr } from '../../lib/format'
import { navigate } from '../../lib/router'
import { PageContent } from '../../shell/AppShell'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  ModalOption,
  StatCard,
  StatStrip,
  StatusDot,
  Tabs,
  Textarea,
  useToast,
} from '../../ui'
import { StudentForm } from './StudentForm'
import { StudentLessonsTab } from './StudentLessonsTab'
import { PackageSaleModal } from './PackageSaleModal'
import { StatementPanel } from '../odemeler/StatementPanel'
import styles from './Students.module.css'

type DetailTab = 'info' | 'lessons' | 'payments' | 'notes'

const STUDENTS_PATH = '/ogrenciler'

/**
 * EKRANLAR.md §4 — `Öğrenci detayı`.
 *
 * Sekmeler `faz-04.md §3`'teki dörtlü: `Bilgiler` `Dersler` `Ödemeler` `Notlar`.
 * Ortadaki ikisi **"Yakında"** — ders geçmişi Faz 6'da, tahsilat Faz 8'de doluyor.
 * Boş bir sekme yerine ne zaman geleceğini söyleyen bir kart konuyor.
 *
 * Özet şerit dolu: bakiye, devam oranı, kalan ders ve sıradaki ders bugün var olan
 * tablolardan okunuyor — hepsi salt okuma, Faz 5/6 mantığına dokunmuyor.
 */
export function StudentDetailPage({ studentId }: { studentId: number }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [packages, setPackages] = useState<PackageOverview[] | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [tab, setTab] = useState<DetailTab>('info')
  const [formOpen, setFormOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [packageSaleOpen, setPackageSaleOpen] = useState(false)
  const [closingPackage, setClosingPackage] = useState<PackageOverview | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextDetail, nextPackages] = await Promise.all([
        fetchStudentDetail(studentId),
        fetchStudentPackages(studentId),
      ])
      setDetail(nextDetail)
      setPackages(nextPackages)
    } catch (err) {
      setError(err as AppError)
      setDetail(null)
      setPackages(null)
    }
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  // `Esc` listeye döner (tasarımdaki `Esc listeye dön` ipucu). Diyalog ya da çekmece
  // açıkken devreye girmez: onların kendi `Esc`'i var ve önce onlar kapanmalı.
  useEffect(() => {
    if (formOpen || confirmArchive || packageSaleOpen || closingPackage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(STUDENTS_PATH)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formOpen, confirmArchive, packageSaleOpen, closingPackage])

  const finishPackageClose = async (mode: PackageCloseMode) => {
    if (!closingPackage) return
    const packageId = closingPackage.packageId
    setClosingPackage(null)
    await run(() => closePackage(packageId, mode), tr.students.packages.closeDone)
  }

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

  const { student, row, guardians, notes } = detail
  const primary = guardians.find((guardian) => guardian.isPrimary) ?? guardians[0]

  /*
    Sayfa başlığı YOK — bilerek. Tasarımda (EKRANLAR.md §4) detay ekranı doğrudan geri
    bağlantısıyla başlıyor ve öğrencinin adı kimlik bloğunda, avatarın yanında duruyor.
    Kabuğun `PageHeader`'ı da konsaydı ad iki kez, 100px arayla yazardı.
  */
  return (
    <>
      <PageContent>
        <BackRow />

        {/* Yükleme sonrası çıkan hata satırı: veri ekranda kalır, hata üstte durur. */}
        {error && <ErrorState inline message={error.message} onRetry={() => void load()} />}

        <div className={styles.identity}>
          <Avatar name={student.fullName} size={52} />
          <div className={styles.identityMain}>
            <div className={styles.identityName}>
              {student.fullName}
              {row.archived && <Badge tone="neutral">{tr.students.detail.archivedBadge}</Badge>}
              {detail.pendingMakeupCount > 0 && (
                <Badge tone="warn">
                  {detail.pendingMakeupCount} {tr.makeup.pendingBadge}
                </Badge>
              )}
            </div>
            <div className={styles.identityMeta}>
              <StatusDot
                tone={student.isActive ? 'success' : 'neutral'}
                hollow={!student.isActive}
                label={student.isActive ? tr.students.table.active : tr.students.table.passive}
              />
              {primary && (
                <>
                  {tr.units.separator}
                  {primary.fullName}
                  {tr.units.separator}
                  <span className={styles.tabular}>{formatPhone(primary.phone)}</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.identityActions}>
            {row.archived ? (
              <Button
                variant="primary"
                onClick={() =>
                  void run(() => restoreStudent(student.id), tr.students.archive.restored)
                }
              >
                {tr.students.archive.undo}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() =>
                    void run(
                      () => setStudentActive(student.id, !student.isActive),
                      student.isActive
                        ? tr.students.detail.deactivated
                        : tr.students.detail.activated,
                    )
                  }
                >
                  {student.isActive
                    ? tr.students.detail.deactivate
                    : tr.students.detail.activate}
                </Button>
                <Button onClick={() => setFormOpen(true)}>{tr.students.detail.edit}</Button>
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  {tr.students.archive.action}
                </Button>
              </>
            )}
          </div>
        </div>

        <SummaryStrip detail={detail} />

        <Tabs
          label={tr.pages.students.title}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'info', label: tr.students.detail.tabs.info },
            { value: 'lessons', label: tr.students.detail.tabs.lessons },
            { value: 'payments', label: tr.students.detail.tabs.payments },
            { value: 'notes', label: tr.students.detail.tabs.notes, count: notes.length },
          ]}
        />

        <div className={styles.tabPanel}>
          {tab === 'info' && (
            <InfoTab
              detail={detail}
              packages={packages ?? []}
              onSell={() => setPackageSaleOpen(true)}
              onClosePackage={setClosingPackage}
            />
          )}

          {tab === 'lessons' && <StudentLessonsTab studentId={student.id} />}
          {tab === 'payments' && <StatementPanel studentId={student.id} />}

          {tab === 'notes' && (
            <NotesTab
              detail={detail}
              onAdd={(body) =>
                run(() => addStudentNote(student.id, body), tr.students.detail.notes.added)
              }
              onRemove={(noteId) =>
                run(() => archiveStudentNote(noteId), tr.students.detail.notes.removed)
              }
            />
          )}
        </div>
      </PageContent>

      <StudentForm
        open={formOpen}
        studentId={student.id}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          void load()
        }}
      />

      <PackageSaleModal
        open={packageSaleOpen}
        studentId={student.id}
        studentName={student.fullName}
        balanceKurus={row.balanceKurus}
        onClose={() => setPackageSaleOpen(false)}
        onSaved={() => {
          setPackageSaleOpen(false)
          void load()
        }}
      />

      <Modal
        open={closingPackage !== null}
        title={tr.students.packages.closeTitle}
        description={tr.students.packages.closeDescription}
        onClose={() => setClosingPackage(null)}
        actions={
          <>
            <ModalOption
              title={tr.students.packages.leaveCredit}
              hint={tr.students.packages.leaveCreditHint}
              onClick={() => void finishPackageClose('leave_credit')}
            />
            <ModalOption
              title={tr.students.packages.refund}
              hint={tr.students.packages.refundHint}
              tone="danger"
              onClick={() => void finishPackageClose('refund')}
            />
          </>
        }
      />

      {/*
        Yıkıcı işlemde onay (CLAUDE.md > Arayüz). Metin ne olacağını açıkça söylüyor:
        kayıt SİLİNMİYOR, listeden kalkıyor ve geri alınabiliyor (ADR-005). Borcu olan
        öğrenci için ek uyarı var — borç arşivlemekle yok olmuyor (§1.23).
      */}
      <ConfirmDialog
        open={confirmArchive}
        title={tr.students.archive.title}
        description={`${student.fullName} ${tr.students.archive.body}${
          row.debtKurus > 0
            ? ` ${tr.students.archive.debtWarningPrefix} ${formatLira(row.debtKurus)} ${
                tr.students.archive.debtWarningSuffix
              }`
            : ''
        }`}
        confirmLabel={tr.students.archive.confirm}
        confirmHint={tr.students.archive.confirmHint}
        destructive
        onConfirm={() => {
          setConfirmArchive(false)
          void run(() => archiveStudent(student.id), tr.students.archive.done)
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  )
}

/** `← Öğrenciler` + `Esc listeye dön` — tasarımın detay ekranının ilk satırı. */
function BackRow() {
  return (
    <div className={styles.backRow}>
      <button type="button" className={styles.backLink} onClick={() => navigate(STUDENTS_PATH)}>
        {tr.students.detail.back}
      </button>
      <span className={styles.hint}>{tr.students.detail.backHint}</span>
    </div>
  )
}

/**
 * Bakiye kartının altyazısı **üç** durumu ayırır.
 *
 * Ölçüt `daysOverdue` değil `hasLedger`: `daysOverdue` yalnızca gecikmiş borçta
 * doluyor, dolayısıyla ikili bir dal borcunu tamamen ödemiş — defterinde onlarca
 * hareket olan — öğrenciye de "Henüz hareket yok" yazdırıyordu. Avans vermiş öğrencide
 * de aynısı. Kurs sahibi teknik değil: bir rakamın altında onu yalanlayan bir cümle
 * okursa ya rakama ya uygulamaya güveni gider.
 */
function balanceCaption(daysOverdue: number | null, hasLedger: boolean): string {
  if (daysOverdue !== null) return `${daysOverdue} ${tr.students.detail.cards.overdue}`
  return hasLedger
    ? tr.students.detail.cards.balanceCurrentCaption
    : tr.students.detail.cards.balanceEmptyCaption
}

/** Dört kart — kolon oranları bağlayıcı (TASARIM-SISTEMI §8, `--stat-strip-columns`). */
function SummaryStrip({ detail }: { detail: StudentDetail }) {
  const { row, daysOverdue, hasLedger, nextSessionAt } = detail

  // Devam oranı: işlenen derslerin kaçında "Geldi". PRD S7 hangi PENCEREDE
  // hesaplanacağını hâlâ soruyor (Faz 9); bugünkü cevap "tümü" ve alt satırda yazıyor,
  // böylece sayı belirsiz kalmıyor.
  const rate =
    row.processedLessons > 0
      ? Math.round((row.attendedLessons / row.processedLessons) * 100)
      : null

  return (
    <StatStrip>
      <StatCard
        label={tr.students.detail.cards.balance}
        value={formatLira(row.balanceKurus)}
        tone={row.balanceKurus < 0 ? 'danger' : 'default'}
        caption={balanceCaption(daysOverdue, hasLedger)}
        captionTone={daysOverdue !== null ? 'warn' : 'default'}
      />
      <StatCard
        label={tr.students.detail.cards.attendance}
        value={rate === null ? null : `%${rate}`}
        caption={
          rate === null
            ? tr.students.detail.cards.attendanceEmpty
            : tr.students.detail.cards.attendanceCaption
        }
      />
      <StatCard
        label={tr.students.detail.cards.remaining}
        value={row.remainingLessons === null ? null : String(row.remainingLessons)}
        tone={row.remainingLessons !== null && row.remainingLessons <= 2 ? 'warn' : 'default'}
        caption={
          row.remainingLessons === null
            ? tr.students.detail.cards.remainingEmpty
            : tr.students.detail.cards.remainingCaption
        }
      />
      <StatCard
        label={tr.students.detail.cards.nextSession}
        value={nextSessionAt ? formatDate(nextSessionAt) : null}
        caption={
          nextSessionAt
            ? `${weekdayTr(nextSessionAt)}${tr.units.separator}${formatTime(nextSessionAt)}`
            : tr.students.detail.cards.nextSessionEmpty
        }
      />
    </StatStrip>
  )
}

function InfoTab({
  detail,
  packages,
  onSell,
  onClosePackage,
}: {
  detail: StudentDetail
  packages: PackageOverview[]
  onSell: () => void
  onClosePackage: (item: PackageOverview) => void
}) {
  const { student, row, guardians } = detail

  return (
    <div className={styles.packageSection}>
      <Card>
      <dl className={styles.infoGrid}>
        <Fact label={tr.students.detail.info.school} value={student.school} />
        <Fact label={tr.students.detail.info.grade} value={student.grade} />
        <Fact
          label={tr.students.detail.info.birthDate}
          value={student.birthDate ? formatDate(student.birthDate) : null}
        />
        <Fact
          label={tr.students.detail.info.phone}
          value={student.phone ? formatPhone(student.phone) : null}
        />
        <Fact
          label={tr.students.detail.info.enrolledOn}
          value={student.enrolledOn ? formatDate(student.enrolledOn) : null}
        />
        <Fact label={tr.students.detail.info.totalLessons} value={String(row.processedLessons)} />
        <Fact
          label={tr.students.detail.info.attendedLessons}
          value={String(row.attendedLessons)}
        />
        <Fact label={tr.students.detail.info.note} value={student.note} />
      </dl>

      <div className={styles.drawerSection}>
        <div className={styles.drawerLabel}>{tr.students.detail.info.guardians}</div>
        {guardians.length === 0 && (
          <p className={styles.hint}>{tr.students.detail.info.noGuardians}</p>
        )}
        {guardians.map((guardian) => (
          <div className={styles.guardianRow} key={guardian.linkId}>
            <span className={styles.guardianRowName}>{guardian.fullName}</span>
            {guardian.relation && <span className={styles.hint}>{guardian.relation}</span>}
            <span className={styles.tabular}>{formatPhone(guardian.phone)}</span>
            {guardian.isPrimary && (
              <Badge tone="success">{tr.students.form.guardianPrimary}</Badge>
            )}
            {guardian.otherStudentCount > 0 && (
              <span className={styles.hint}>
                {guardian.otherStudentCount} {tr.students.form.guardianShared}
              </span>
            )}
          </div>
        ))}
      </div>
      </Card>
      <Card>
      <div className={styles.packageListHead}>
        <strong>{tr.students.packages.listTitle}</strong>
        <Button variant="primary" size="small" onClick={onSell}>
          {tr.students.packages.action}
        </Button>
      </div>
      {packages.length === 0 ? (
        <p className={styles.hint}>{tr.students.packages.listEmpty}</p>
      ) : (
        <div className={styles.packageList}>
          {packages.map((item) => (
            <div className={styles.packageRow} key={item.packageId}>
              <div>
                <strong>{item.name ?? tr.students.packages.listTitle}</strong>
                <span className={styles.hint}>
                  {formatDate(item.soldOn)} {tr.students.packages.sold}
                  {tr.units.separator}{formatLira(item.totalPrice)}
                </span>
              </div>
              <span className={styles.tabular}>
                {item.status === 'cancelled'
                  ? tr.students.packages.closed
                  : `${item.remaining} ${tr.students.packages.remaining}`}
              </span>
              {item.status !== 'cancelled' && item.remaining > 0 && (
                <Button size="small" variant="danger" onClick={() => onClosePackage(item)}>
                  {tr.students.packages.close}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      </Card>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className={styles.infoLabel}>{label}</dt>
      <dd className={[styles.infoValue, value ? undefined : styles.empty].filter(Boolean).join(' ')}>
        {value ?? tr.units.emptyValue}
      </dd>
    </>
  )
}

/** `student_note` — serbest metin, tarihli girişler (§3). */
function NotesTab({
  detail,
  onAdd,
  onRemove,
}: {
  detail: StudentDetail
  onAdd: (body: string) => Promise<void>
  onRemove: (noteId: number) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null)

  const submit = async () => {
    if (body.trim() === '' || saving) return
    setSaving(true)
    try {
      await onAdd(body.trim())
      setBody('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className={styles.noteComposer}>
        <Textarea
          bare
          value={body}
          placeholder={tr.students.detail.notes.placeholder}
          aria-label={tr.students.detail.notes.placeholder}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className={styles.noteComposerFoot}>
          <span className={styles.hint}>{tr.students.detail.notes.hint}</span>
          <Button
            variant="primary"
            size="small"
            disabled={body.trim() === '' || saving}
            onClick={() => void submit()}
          >
            {tr.students.detail.notes.add}
          </Button>
        </div>
      </div>

      {detail.notes.length === 0 ? (
        <EmptyState title={tr.students.detail.notes.empty} />
      ) : (
        <div className={styles.noteList}>
          {detail.notes.map((note) => (
            <div className={styles.noteItem} key={note.id}>
              <div className={styles.noteHead}>
                <span>
                  {tr.students.detail.notes.author}
                  {tr.units.separator}
                  {formatDate(note.notedOn)}
                </span>
                <Button size="small" variant="ghost" onClick={() => setPendingRemoval(note.id)}>
                  {tr.students.detail.notes.remove}
                </Button>
              </div>
              <p className={[styles.noteBody, styles.prose].join(' ')}>{note.body}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={tr.students.detail.notes.removeTitle}
        description={tr.students.detail.notes.removeBody}
        confirmLabel={tr.students.detail.notes.removeConfirm}
        destructive
        onConfirm={() => {
          const noteId = pendingRemoval
          setPendingRemoval(null)
          if (noteId !== null) void onRemove(noteId)
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </>
  )
}
