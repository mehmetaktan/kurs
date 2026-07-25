import { useCallback, useEffect, useState } from 'react'
import { tr } from './i18n/tr'
import { fetchAppStatus, type AppError, type AppStatus } from './lib/api'

/**
 * Faz 2 ekranı. Burada ürün arayüzü YOK — tek işi veritabanı bağlantısının gerçekten
 * kurulduğunu göstermek (faz-02 §9.1). Gerçek kabuk Faz 3'te gelir.
 *
 * Her liste/veri ekranı gibi bunun da üç durumu var: yükleniyor · hata · dolu.
 */
export default function App() {
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
    <main className="shell">
      <header className="shell__head">
        <h1>{tr.app.name}</h1>
        <p className="muted">{tr.app.tagline}</p>
      </header>

      {loading && <p className="muted">{tr.status.loading}</p>}

      {!loading && error && (
        <section className="card card--error">
          <h2>{tr.errors.title}</h2>
          <p>{error.message}</p>
          <button type="button" onClick={() => void load()}>
            {tr.errors.retry}
          </button>
        </section>
      )}

      {!loading && !error && status && (
        <section className="card">
          <h2>{tr.status.heading}</h2>
          <p className="muted">{tr.status.subtitle}</p>

          <p className="ok">{tr.status.healthy}</p>

          <dl className="facts">
            <Fact label={tr.status.institution} value={status.institutionName} />
            <Fact label={tr.status.teacher} value={status.teacherName} />
            <Fact label={tr.status.studentCount} value={String(status.studentCount)} />
            <Fact label={tr.status.sessionCount} value={String(status.sessionCount)} />
            <Fact label={tr.status.ledgerCount} value={String(status.ledgerCount)} />
            <Fact label={tr.status.sqliteVersion} value={status.sqliteVersion} />
            <Fact label={tr.status.journalMode} value={status.journalMode} />
            <Fact
              label={tr.status.foreignKeys}
              value={status.foreignKeys ? tr.status.on : tr.status.off}
            />
            <Fact
              label={tr.status.migrations}
              value={status.appliedMigrations.join(', ')}
            />
            <Fact label={tr.status.dbPath} value={status.dbPath} mono />
          </dl>

          {status.studentCount === 0 && <p className="muted">{tr.status.seedHint}</p>}
        </section>
      )}
    </main>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </>
  )
}
