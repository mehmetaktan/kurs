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

export interface Subject {
  id: number
  name: string
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
