import { useCallback, useEffect, useState } from 'react'
import { fetchAppStatus, type AppError, type AppStatus } from '../lib/api'
import { PageContent } from '../shell/AppShell'
import { PageHeader } from '../shell/PageHeader'
import { Card, ErrorState, LoadingState } from '../ui'
import styles from './Showcase.module.css'
import { statusTr } from './status.tr'

/**
 * `/dev/durum` — Faz 2'nin veritabanı teşhis paneli.
 *
 * Faz 3'te `App.tsx`'ten çıkarıldı ama silinmedi: Tauri IPC'sinin, migration'ların ve
 * veritabanı yolunun canlı kanıtı. **ADR-022 migration'ının uygulandığını da burada
 * görüyoruz** — "Uygulanan güncellemeler" satırında `1, 2` yazmalı.
 *
 * Tarayıcıda (`npm run web:dev`) IPC yok, `ErrorState` çıkar — bu da hata durumunun
 * gerçek veriyle sınandığı tek yer.
 */
export default function Status() {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStatus(await fetchAppStatus())
    } catch (err) {
      setError(err as AppError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader title={statusTr.heading} subtitle={statusTr.subtitle} />
      <PageContent>
        {loading && <LoadingState />}

        {!loading && error && <ErrorState message={error.message} onRetry={() => void load()} />}

        {!loading && !error && status && (
          <Card>
            <p className={styles.ok}>{statusTr.healthy}</p>
            <dl className={styles.facts}>
              <Fact label={statusTr.institution} value={status.institutionName} />
              <Fact label={statusTr.teacher} value={status.teacherName} />
              <Fact label={statusTr.studentCount} value={String(status.studentCount)} />
              <Fact label={statusTr.sessionCount} value={String(status.sessionCount)} />
              <Fact label={statusTr.ledgerCount} value={String(status.ledgerCount)} />
              <Fact label={statusTr.sqliteVersion} value={status.sqliteVersion} />
              <Fact label={statusTr.journalMode} value={status.journalMode} />
              <Fact
                label={statusTr.foreignKeys}
                value={status.foreignKeys ? statusTr.on : statusTr.off}
              />
              <Fact label={statusTr.migrations} value={status.appliedMigrations.join(', ')} />
              <Fact label={statusTr.dbPath} value={status.dbPath} mono />
            </dl>
            {status.studentCount === 0 && (
              <p className={styles.intro}>{statusTr.seedHint}</p>
            )}
          </Card>
        )}
      </PageContent>
    </>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? styles.mono : undefined}>{value}</dd>
    </>
  )
}
