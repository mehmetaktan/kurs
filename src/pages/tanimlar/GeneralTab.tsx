import { useCallback, useEffect, useState } from 'react'
import { tr } from '../../i18n/tr'
import { fetchSettings, updateSetting, type AppError } from '../../lib/api'
import {
  Checkbox,
  ErrorState,
  Input,
  LoadingState,
  SectionHeader,
  Select,
  TimePicker,
  useToast,
} from '../../ui'
import styles from './Definitions.module.css'

/**
 * Tanımlar → Genel — işletme ayarları (EKRANLAR.md E18, **ADR-037**).
 *
 * Bu ekran Faz 10'a bırakılmıştı ve üç faz boyunca kurs sahibi programında hiçbir
 * işletme değerini değiştiremedi. İçindeki **iki satır para politikasıdır**
 * (`absence_*_consumes_lesson`, ADR-016) ve para fazının girdisi — o yüzden buraya,
 * defterin önüne alındı.
 *
 * **Ekranda olmayan üç anahtar** (`institution_name`, `receipt_next_no`,
 * `last_backup_at`) programın kendi satırları; yazan komut da onları reddediyor
 * (`repo::setting::EDITABLE_KEYS`).
 *
 * Değişiklik **anında** kaydedilir: kaydedilmemiş bir form bırakmak, teknik olmayan
 * kullanıcıda "değiştirdim ama olmadı" ile sonuçlanıyor. Haftalık kapalı gün burada
 * değil `Tatil günleri` sekmesinde — orada zaten gün seçici var, aynı ayarı iki
 * ekrana koymak ikisinin çelişmesi demek.
 */
export function GeneralTab() {
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [fieldError, setFieldError] = useState<AppError | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await fetchSettings()
      setValues(Object.fromEntries(rows.map((row) => [row.key, row.value])))
    } catch (err) {
      setError(err as AppError)
      setValues(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Yazma **iyimser**: alan anında güncellenir, hata olursa sunucudan gelen değer
   * geri yüklenir. Aksi hâlde her tuş vuruşunda ekran bir tur donardı.
   */
  const save = async (key: string, value: string) => {
    setValues((prev) => (prev === null ? prev : { ...prev, [key]: value }))
    setFieldError(null)
    try {
      await updateSetting(key, value)
      toast(tr.definitions.general.saved)
    } catch (err) {
      setFieldError(err as AppError)
      await load()
    }
  }

  if (values === null && !error) return <LoadingState />
  if (error) return <ErrorState message={error.message} onRetry={() => void load()} />
  if (values === null) return null

  const t = tr.definitions.general

  return (
    <section className={styles.section}>
      <SectionHeader title={t.heading} />
      <div className={styles.sectionHead}>
        <p className={styles.lead}>{t.lead}</p>
      </div>

      {fieldError && (
        <p className={styles.formError} role="alert">
          {fieldError.message}
        </p>
      )}

      <div className={styles.settingGroups}>
        <SettingGroup title={t.groups.hours}>
          <div className={styles.formPair}>
            {/* Saat boşaltılırsa kaydedilmez: `day_start` boş kalırsa takvimin dikey
                aralığı hiç kurulamaz — "temizle" burada geçerli bir değer değil. */}
            <TimePicker
              label={t.keys.dayStart}
              value={values.day_start ?? null}
              hint={t.hints.hours}
              onChange={(value) => {
                if (value !== null) void save('day_start', value)
              }}
            />
            <TimePicker
              label={t.keys.dayEnd}
              value={values.day_end ?? null}
              onChange={(value) => {
                if (value !== null) void save('day_end', value)
              }}
            />
          </div>
          <div className={styles.formPair}>
            <NumberSetting
              label={t.keys.slotMinutes}
              hint={t.hints.slotMinutes}
              value={values.slot_minutes ?? ''}
              onCommit={(value) => void save('slot_minutes', value)}
            />
            <NumberSetting
              label={t.keys.defaultSessionMinutes}
              value={values.default_session_minutes ?? ''}
              onCommit={(value) => void save('default_session_minutes', value)}
            />
          </div>
          <NumberSetting
            label={t.keys.sessionHorizonWeeks}
            hint={t.hints.sessionHorizonWeeks}
            value={values.session_horizon_weeks ?? ''}
            onCommit={(value) => void save('session_horizon_weeks', value)}
          />
        </SettingGroup>

        {/*
          ADR-016 — bu iki satır PARA POLİTİKASI. Etiketleri "1/0" değil Türkçe bir
          cümle söylüyor: kullanıcı ne yaptığını okumadan işaretleyemesin.
        */}
        <SettingGroup title={t.groups.absence}>
          <Checkbox
            label={t.keys.excusedConsumes}
            checked={values.absence_excused_consumes_lesson === '1'}
            onChange={(event) =>
              void save('absence_excused_consumes_lesson', event.target.checked ? '1' : '0')
            }
          />
          <p className={styles.settingHint}>{t.hints.excusedConsumes}</p>
          <Checkbox
            label={t.keys.unexcusedConsumes}
            checked={values.absence_unexcused_consumes_lesson === '1'}
            onChange={(event) =>
              void save('absence_unexcused_consumes_lesson', event.target.checked ? '1' : '0')
            }
          />
          <p className={styles.settingHint}>{t.hints.unexcusedConsumes}</p>
        </SettingGroup>

        <SettingGroup title={t.groups.money}>
          <div className={styles.formPair}>
            <NumberSetting
              label={t.keys.packageExpiryDays}
              hint={t.hints.packageExpiryDays}
              value={values.package_expiry_days ?? ''}
              allowEmpty
              onCommit={(value) => void save('package_expiry_days', value)}
            />
            <TextSetting
              label={t.keys.receiptPrefix}
              hint={t.hints.receiptPrefix}
              value={values.receipt_prefix ?? ''}
              onCommit={(value) => void save('receipt_prefix', value)}
            />
          </div>
        </SettingGroup>

        <SettingGroup title={t.groups.other}>
          <Select
            label={t.keys.rowDensity}
            value={values.row_density ?? 'comfortable'}
            options={[
              { value: 'comfortable', label: t.density.comfortable },
              { value: 'compact', label: t.density.compact },
            ]}
            onChange={(event) => void save('row_density', event.target.value)}
          />
        </SettingGroup>
      </div>
    </section>
  )
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.settingGroupTitle}>{title}</h3>
      <div className={styles.formGrid}>{children}</div>
    </div>
  )
}

interface TextSettingProps {
  label: string
  hint?: string
  value: string
  onCommit: (value: string) => void
}

/**
 * Metin ayarı — kaydetme `blur`'da ve `Enter`'da, her tuş vuruşunda değil.
 * "Anında kaydedilir" her harfte bir yazma demek olsaydı, yarım yazılmış bir
 * `receipt_prefix` de kaydedilirdi.
 */
function TextSetting({ label, hint, value, onCommit }: TextSettingProps) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = () => {
    if (text !== value) onCommit(text)
  }

  return (
    <Input
      label={label}
      hint={hint}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setText(value)
      }}
    />
  )
}

interface NumberSettingProps extends TextSettingProps {
  /** `package_expiry_days` boş bırakılabilir — "süresiz" demek (§1.2). */
  allowEmpty?: boolean
}

/** Sayısal ayar. Ayrıştırılamayan girdi **kaydedilmez**, alan eski değere döner. */
function NumberSetting({ label, hint, value, allowEmpty = false, onCommit }: NumberSettingProps) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === value) return
    if (trimmed === '') {
      if (allowEmpty) onCommit('')
      else setText(value)
      return
    }
    if (!/^\d+$/.test(trimmed)) {
      setText(value)
      return
    }
    onCommit(trimmed)
  }

  return (
    <Input
      label={label}
      hint={hint}
      value={text}
      inputMode="numeric"
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setText(value)
      }}
    />
  )
}
