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
