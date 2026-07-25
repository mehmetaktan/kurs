import { invoke } from '@tauri-apps/api/core'
import { tr } from '../i18n/tr'

/**
 * Rust tarafından gelen hata (src-tauri/src/error.rs).
 * `message` kullanıcıya gösterilir — Türkçe ve eylem önerir.
 * `code` makine-okur; log ve testler için, ekranda GÖSTERİLMEZ.
 */
export interface AppError {
  code: string
  message: string
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AppError).code === 'string' &&
    typeof (value as AppError).message === 'string'
  )
}

/**
 * `invoke` sarmalayıcısı: Rust'tan gelen her hata AppError'a normalize edilir.
 * Böylece arayüz hiçbir yerde ham SQLite metniyle karşılaşmaz (CLAUDE.md > Arayüz).
 */
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  } catch (raw) {
    if (isAppError(raw)) throw raw
    console.error('[kurs] beklenmeyen hata biçimi:', raw)
    throw { code: 'unknown', message: tr.errors.unknown } satisfies AppError
  }
}

/** `app_status` komutunun dönüş tipi — src-tauri/src/commands.rs ile birebir. */
export interface AppStatus {
  dbPath: string
  sqliteVersion: string
  journalMode: string
  foreignKeys: boolean
  appliedMigrations: number[]
  institutionName: string
  teacherName: string
  studentCount: number
  sessionCount: number
  ledgerCount: number
}

export function fetchAppStatus(): Promise<AppStatus> {
  return call<AppStatus>('app_status')
}

/**
 * `v_student_debt` satırı — src-tauri/src/model.rs `StudentDebt` ile birebir
 * (`#[serde(rename_all = "camelCase")]`).
 */
export interface StudentDebt {
  studentId: number
  debtKurus: number
  /** FIFO ile ilk kapanmamış borcun vadesi (`'YYYY-MM-DD'`). Borç yoksa `null`. */
  oldestDueOn: string | null
}

/**
 * Borçlu listesi — tek kaynak defter (ADR-018), zincir paritesiyle netlenmiş
 * (ADR-022). Kenar çubuğundaki Ödemeler rozeti bunun uzunluğunu gösteriyor.
 */
export function fetchStudentDebts(): Promise<StudentDebt[]> {
  return call<StudentDebt[]>('student_debts')
}

// ─── Faz 4 — öğrenci ve veli ──────────────────────────────────────────────────
//
// Tipler `src-tauri/src/repo/roster.rs` ile birebir (`rename_all = "camelCase"`).
// Rust tarafı bir alan eklerse burası da eklenir; ayrışırlarsa TypeScript sessizce
// `undefined` okur ve ekranda boş hücre çıkar.

/** `Öğrenciler` tablosunun bir satırı — EKRANLAR.md §3'teki 8 kolonun kaynağı. */
export interface StudentRow {
  id: number
  fullName: string
  school: string | null
  grade: string | null
  phone: string | null
  /** Aktif / Pasif — yeşil nokta / içi boş halka. */
  isActive: boolean
  /** Arşivlendi. `isActive` ile FARKLI şey (VERI-MODELI §1.5). */
  archived: boolean
  guardianName: string | null
  guardianPhone: string | null
  guardianCount: number
  /** Kuruş, işaretli: **negatif = borçlu** (K3). */
  balanceKurus: number
  /** `v_student_debt` — pozitif ya da sıfır (ADR-018). */
  debtKurus: number
  oldestDueOn: string | null
  /** Geçerli paketlerin kalan hakkı. `null` = paketi hiç yok — `0`'dan farklı. */
  remainingLessons: number | null
  processedLessons: number
  attendedLessons: number
  lastSessionDate: string | null
  subjectIds: number[]
  groupIds: number[]
}

export interface StudentQuery {
  search?: string
  subjectId?: number | null
  groupId?: number | null
  /** `'YYYY-MM-DD'`. Verilmezse Rust yerel bugünü kullanır (§0: SQLite saati okunmaz). */
  today?: string | null
}

/**
 * Öğrenci listesi. Arama ve branş/grup süzgeci Rust'ta (`search_name`, K9);
 * **Türkçe sıralama ve sayfalama burada** (ADR-020) — `filters.ts`.
 *
 * Arşivlenmiş öğrenciler de gelir, `archived` ile işaretli: hangi çipin kimi
 * göstereceğine ekran karar veriyor.
 */
export function fetchStudentList(query: StudentQuery = {}): Promise<StudentRow[]> {
  return call<StudentRow[]>('student_list', { query })
}

export interface GuardianLink {
  linkId: number
  guardianId: number
  fullName: string
  phone: string | null
  email: string | null
  relation: string | null
  isPrimary: boolean
  /** Bu veliye bağlı **başka** öğrenci sayısı — kardeş göstergesi. */
  otherStudentCount: number
}

/** `student` tablosunun satırı — `src-tauri/src/model.rs > Student`. */
export interface Student {
  id: number
  fullName: string
  school: string | null
  grade: string | null
  birthDate: string | null
  phone: string | null
  isActive: boolean
  enrolledOn: string | null
  note: string | null
  deletedAt: string | null
}

export interface StudentNote {
  id: number
  studentId: number
  body: string
  notedOn: string
  createdAt: string | null
}

export interface StudentDetail {
  student: Student
  row: StudentRow
  guardians: GuardianLink[]
  notes: StudentNote[]
  /** Gecikme gün sayısı — Rust'ta `today` bind edilerek hesaplanır (§0). */
  daysOverdue: number | null
  /**
   * Defterde hiç hareket var mı. Bakiye kartının altyazısı üç durumu ayırıyor ve
   * "henüz hareket yok" ile "borcu kapalı" ayrımını yalnızca bu alan verebiliyor —
   * ikisinde de bakiye `0`.
   */
  hasLedger: boolean
  /** `'YYYY-MM-DD HH:MM'` ya da `null`. */
  nextSessionAt: string | null
}

export function fetchStudentDetail(studentId: number): Promise<StudentDetail> {
  return call<StudentDetail>('student_detail', { studentId })
}

export interface GuardianInput {
  /** Mevcut veliye bağlanıyorsa dolu — kardeşler aynı veliyi paylaşır. */
  guardianId: number | null
  fullName: string
  /** **Zorunlu** (ADR-009). */
  phone: string
  email: string | null
  relation: string | null
  isPrimary: boolean
}

export interface StudentInput {
  id: number | null
  fullName: string
  school: string | null
  grade: string | null
  /** `'YYYY-MM-DD'` — ekranda `GG.AA.YYYY` yazılır, `parseDateTr` çevirir. */
  birthDate: string | null
  phone: string | null
  isActive: boolean
  enrolledOn: string | null
  note: string | null
  /** Listede olmayan mevcut bağlar çözülür; velinin kendisi silinmez. */
  guardians: GuardianInput[]
}

/** Öğrenci + velileri, Rust tarafında tek transaction. Kaydın id'si döner. */
export function saveStudent(input: StudentInput): Promise<number> {
  return call<number>('save_student', { input })
}

/** "Sil" değil **"Arşivle"** (ADR-005). */
export function archiveStudent(studentId: number): Promise<boolean> {
  return call<boolean>('archive_student', { studentId })
}

export function restoreStudent(studentId: number): Promise<boolean> {
  return call<boolean>('restore_student', { studentId })
}

/** Aktif / Pasif — arşivleme değil. */
export function setStudentActive(studentId: number, isActive: boolean): Promise<void> {
  return call<void>('set_student_active', { studentId, isActive })
}

export interface Guardian {
  id: number
  fullName: string
  phone: string | null
  email: string | null
}

/** "Mevcut veliyi bul ve bağla" — kardeş kaydında ikinci bir veli kopyası açılmasın. */
export function searchGuardians(query: string): Promise<Guardian[]> {
  return call<Guardian[]>('search_guardians', { query })
}

export function addStudentNote(studentId: number, body: string): Promise<number> {
  return call<number>('add_student_note', { studentId, body })
}

export function archiveStudentNote(noteId: number): Promise<boolean> {
  return call<boolean>('archive_student_note', { noteId })
}

/** `subject` satırı — `src-tauri/src/model.rs > Subject`. */
export interface Subject {
  id: number
  name: string
  color: string | null
  /** Varsayılan ders süresi (dk). `null` = `setting.default_session_minutes` (PRD S4). */
  defaultMin: number | null
  sortOrder: number
}

export interface StudyGroup {
  id: number
  name: string
  subjectId: number
}

/** Branş filtresinin kaynağı. Sırasız — `sortTrBy` ile sıralanır (ADR-020). */
export function fetchSubjects(): Promise<Subject[]> {
  return call<Subject[]>('list_subjects')
}

/** Grup filtresinin kaynağı. Sırasız (ADR-020). */
export function fetchStudyGroups(): Promise<StudyGroup[]> {
  return call<StudyGroup[]>('list_study_groups')
}

// ─── Faz 5A — tanımlar, gruplar ve seans işlemleri ────────────────────────────
//
// Tipler `src-tauri/src/repo/schedule.rs` ile birebir (`rename_all = "camelCase"`).

export interface SubjectInput {
  id: number | null
  name: string
  color: string | null
  defaultMin: number | null
  sortOrder: number
}

/** Tekillik `search_name` üzerinde (K9): `Matematik` ile `matematik` aynı branştır. */
export function saveSubject(input: SubjectInput): Promise<number> {
  return call<number>('save_subject', { input })
}

export function archiveSubject(subjectId: number): Promise<boolean> {
  return call<boolean>('archive_subject', { subjectId })
}

export interface ClosedDay {
  id: number
  /** `'YYYY-MM-DD'` */
  day: string
  label: string
}

export interface ClosedDayInput {
  id: number | null
  day: string
  label: string
}

export function fetchClosedDays(): Promise<ClosedDay[]> {
  return call<ClosedDay[]>('list_closed_days')
}

export function saveClosedDay(input: ClosedDayInput): Promise<number> {
  return call<number>('save_closed_day', { input })
}

export function archiveClosedDay(closedDayId: number): Promise<boolean> {
  return call<boolean>('archive_closed_day', { closedDayId })
}

/** `1 = Pazartesi … 7 = Pazar`. Takvim ve seans üretimi bunu okur. */
export function fetchWeeklyClosedDays(): Promise<number[]> {
  return call<number[]>('weekly_closed_days')
}

export function setWeeklyClosedDays(days: number[]): Promise<void> {
  return call<void>('set_weekly_closed_days', { days })
}

/** Branşın süresi, yoksa genel ayar, o da yoksa 60 (PRD S4). */
export function fetchDefaultMinutes(subjectId: number | null): Promise<number> {
  return call<number>('default_session_minutes', { subjectId })
}

export interface Teacher {
  id: number
  fullName: string
  color: string
  isActive: boolean
}

/** ADR-011: tek öğretmen. Alan yine de yazılır, yoksa K-1 uyarısı ölü doğar. */
export function fetchTeachers(): Promise<Teacher[]> {
  return call<Teacher[]>('list_teachers')
}

/** Haftalık programın bir satırı: "Salı 16:00 · 60 dk". */
export interface WeeklySlot {
  /** Mevcut şablon satırıysa dolu; yeni satırda `null`. */
  id: number | null
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number
  /** `'16:00'` */
  startTime: string
  durationMin: number
}

/** `Gruplar` tablosunun bir satırı — EKRANLAR.md §304. */
export interface GroupRow {
  id: number
  name: string
  subjectId: number
  subjectName: string
  subjectColor: string | null
  /** Formun ihtiyacı; liste `teacherName`'i gösteriyor. */
  teacherId: number | null
  teacherName: string | null
  capacity: number
  /** Bugün itibarıyla kayıtlı **canlı** öğrenci sayısı (§1.23). */
  memberCount: number
  weekly: WeeklySlot[]
  isActive: boolean
  /** Arşivlendi. `isActive` ile FARKLI şey. */
  archived: boolean
  startsOn: string | null
  endsOn: string | null
  /** `'YYYY-MM-DD HH:MM'` — özet şeritteki "Sıradaki ders". */
  nextSessionAt: string | null
}

export interface GroupQuery {
  search?: string
  subjectId?: number | null
  today?: string | null
}

/**
 * Gruplar listesi. Arama ve branş süzgeci Rust'ta; **Türkçe sıralama ve sayfalama
 * burada** (ADR-025) — `pages/gruplar/filters.ts`.
 */
export function fetchGroupList(query: GroupQuery = {}): Promise<GroupRow[]> {
  return call<GroupRow[]>('group_list', { query })
}

export interface GroupMember {
  enrollmentId: number
  studentId: number
  fullName: string
  startOn: string
  endOn: string | null
  /** Bugün grupta mı — ayrılmış üye listede kalır, soluk gösterilir (R5.8). */
  isCurrent: boolean
}

export interface GroupSessionRow {
  id: number
  startsAt: string
  endsAt: string
  /** `'planned' | 'done' | 'cancelled'` */
  status: string
  attendanceTaken: boolean
  presentCount: number
  markedCount: number
}

export interface GroupNote {
  id: number
  studentId: number
  studentName: string
  body: string
  notedOn: string
}

export interface GroupDetail {
  group: GroupRow
  members: GroupMember[]
  sessions: GroupSessionRow[]
  /** Ayrı bir tablo yok: üyelerin `student_note` kayıtlarının birleşik akışı. */
  notes: GroupNote[]
  processedSessions: number
  attendedCount: number
  markedCount: number
}

export function fetchGroupDetail(groupId: number): Promise<GroupDetail> {
  return call<GroupDetail>('group_detail', { groupId })
}

export interface GroupInput {
  id: number | null
  name: string
  subjectId: number
  teacherId: number | null
  capacity: number
  startsOn: string | null
  endsOn: string | null
  isActive: boolean
  weekly: WeeklySlot[]
}

/** Grup + haftalık program tek transaction; ardından seanslar üretilir (R5.5). */
export function saveGroup(input: GroupInput): Promise<number> {
  return call<number>('save_group', { input })
}

export function archiveGroup(groupId: number): Promise<boolean> {
  return call<boolean>('archive_group', { groupId })
}

export function restoreGroup(groupId: number): Promise<boolean> {
  return call<boolean>('restore_group', { groupId })
}

export interface Capacity {
  memberCount: number
  capacity: number
}

/** Kapasite aşımı onay diyaloğunun sayıları (PRD S2 / K-8) — engelleme değil, uyarı. */
export function fetchGroupCapacity(groupId: number): Promise<Capacity> {
  return call<Capacity>('group_capacity', { groupId })
}

/** Kapasite kontrol edilmez (S2); çakışan açık kayıt ise engellenir (K-22). */
export function addGroupMember(
  groupId: number,
  studentId: number,
  startOn: string | null = null,
): Promise<number> {
  return call<number>('add_group_member', { groupId, studentId, startOn })
}

/** Gruptan çıkarma — kayıt silinmez, bitiş tarihi yazılır (R5.8). */
export function endGroupMembership(
  enrollmentId: number,
  endOn: string | null = null,
): Promise<void> {
  return call<void>('end_group_membership', { enrollmentId, endOn })
}

export interface Conflict {
  sessionId: number
  startsAt: string
  endsAt: string
  /** `Matematik · Grup A` — uyarı dersin **adını** söylemek zorunda. */
  label: string
}

/** Çakışma **uyarıdır, engel değil** (K-1 / R3.11). Boş dizi "çakışma yok". */
export function fetchSessionConflicts(
  startsAt: string,
  endsAt: string,
  ignoreSessionId: number | null = null,
): Promise<Conflict[]> {
  return call<Conflict[]>('session_conflicts', { startsAt, endsAt, ignoreSessionId })
}

/** Kapsam: en dar olan varsayılan. `only` şablona bağlı dersi **iptal eder**, silmez. */
export type SessionScope = 'only' | 'following' | 'all'

export interface DeleteReport {
  removed: number
  cancelled: number
  seriesClosed: boolean
}

export function deleteSessions(
  sessionId: number,
  scope: SessionScope = 'only',
): Promise<DeleteReport> {
  return call<DeleteReport>('delete_sessions', { sessionId, scope })
}

export function cancelSession(sessionId: number, reason: string | null = null): Promise<void> {
  return call<void>('cancel_session', { sessionId, reason })
}

/** Yoklaması alınmış ders taşınamaz (R3.13) — Rust reddeder. */
export function rescheduleSession(
  sessionId: number,
  startsAt: string,
  durationMin: number,
): Promise<void> {
  return call<void>('reschedule_session', { sessionId, startsAt, durationMin })
}

// ─── Faz 5B — Bugün ekranı, ders ekle/düzenle, şablondan oluştur ──────────────

/**
 * **"Şimdi"nin tek kaynağı** (`VERI-MODELI §0`): `chrono::Local`, SQLite saati değil.
 * `'YYYY-MM-DD HH:MM'` döner; tarih ilk 10 karakter.
 *
 * Arayüz `new Date()` de kurabilirdi ama o zaman "bugün" iki ayrı yerden gelirdi ve
 * gece yarısını geçen bir oturumda başlıkla liste farklı günü gösterirdi.
 */
export function fetchLocalNow(): Promise<string> {
  return call<string>('local_now')
}

/** Bugün ekranının (ve 5C'de takvimin) ders satırı — `repo/schedule.rs > DaySessionRow`. */
export interface DaySessionRow {
  id: number
  /** Şablona bağlıysa dolu — silme kapsamının sorulup sorulmayacağını bu belirler. */
  seriesId: number | null
  startsAt: string
  endsAt: string
  /** `'solo'` | `'group'` — şemada GENERATED (ADR-012). */
  kind: string
  subjectId: number
  subjectName: string
  subjectColor: string | null
  teacherId: number | null
  studyGroupId: number | null
  studentId: number | null
  /** Grubun ya da öğrencinin adı. */
  title: string
  /** `'planned' | 'done' | 'cancelled'` */
  status: string
  attendanceTaken: boolean
  /** Grupta o günkü **canlı** üye sayısı, birebirde 1 (§1.23). */
  studentCount: number
  presentCount: number
  markedCount: number
  isMakeup: boolean
  cancelReason: string | null
}

/**
 * Bir günün dersleri, saat sırasıyla (R1.1). `day` verilmezse Rust yerel bugünü kullanır.
 * Arşivlenmiş öğrencinin birebir dersi listelenmez (§1.23).
 */
export function fetchDaySessions(day: string | null = null): Promise<DaySessionRow[]> {
  return call<DaySessionRow[]>('day_sessions', { day })
}

/**
 * Haftalık program tanımlı mı — Bugün ekranının **iki** boş durumunu ayırır (R1.7).
 * Boş bir gün listesi iki durumu da üretiyor; ayrımı başka bir şey veremiyor.
 */
export function fetchHasSchedule(): Promise<boolean> {
  return call<boolean>('has_schedule')
}

/** Tatil **veya** haftalık kapalı gün. Form kaydetmeden önce buna bakar (K-2). */
export function fetchIsClosedDay(day: string): Promise<boolean> {
  return call<boolean>('is_closed_day', { day })
}

/** `'once'` tek bir seans, `'weekly'` bir şablon yazar ve seansları üretir. */
export type SessionRepeat = 'once' | 'weekly'

export interface SessionInput {
  /** Dolu = mevcut **tek** dersi düzenle. Şablon düzenleme grup formunda (E5). */
  id: number | null
  subjectId: number
  teacherId: number | null
  /** `studyGroupId` ve `studentId`'den **tam olarak biri** dolu (ADR-012). */
  studyGroupId: number | null
  studentId: number | null
  /** `'YYYY-MM-DD'` */
  day: string
  /** `'HH:MM'` */
  startTime: string
  durationMin: number
  repeat: SessionRepeat
}

export interface SaveSessionReport {
  sessionId: number | null
  seriesId: number | null
  /** Programa eklenen ders sayısı — bildirimde yazılır. */
  created: number
}

/**
 * Ders kaydeder. **Tatile ders eklenmez** (K-2) — Rust reddeder.
 * **Çakışma engellemez** (K-1 / R3.11): uyarıyı `fetchSessionConflicts` ile ekran gösterir.
 */
export function saveSession(input: SessionInput): Promise<SaveSessionReport> {
  return call<SaveSessionReport>('save_session', { input })
}

export interface TemplateSlot {
  /** 1 = Pazartesi … 7 = Pazar */
  weekday: number
  startTime: string
  durationMin: number
  subjectId: number
  studyGroupId: number | null
  studentId: number | null
  teacherId: number | null
  /** `Matematik · Grup A` */
  label: string
  /** Uygulanırsa bu dersin düşeceği **ilk** tarih. */
  firstOn: string
  /** Şablonu zaten var; uygulanınca atlanır — önizleme bunu söyler, satırı gizlemez. */
  alreadyPlanned: boolean
}

export interface TemplatePreview {
  weekStart: string
  weekEnd: string
  applyFrom: string
  slots: TemplateSlot[]
}

/** Önizleme **yazmaz**; onay bu listeden sonra istenir (E6). */
export function fetchTemplatePreview(
  sourceDay: string,
  applyFrom: string,
): Promise<TemplatePreview> {
  return call<TemplatePreview>('template_preview', { sourceDay, applyFrom })
}

export interface ApplyTemplateReport {
  seriesCreated: number
  /** Zaten şablonu olduğu için atlananlar — sessiz değil, sayılıyor. */
  skipped: number
  sessionsCreated: number
}

export function applyTemplate(
  sourceDay: string,
  applyFrom: string,
): Promise<ApplyTemplateReport> {
  return call<ApplyTemplateReport>('apply_template', { sourceDay, applyFrom })
}
