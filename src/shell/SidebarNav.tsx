import { APP_VERSION, institution } from '../config/brand'
import { tr } from '../i18n/tr'
import { Badge } from '../ui'
import { isNavActive, NAV_ITEMS } from './routes'
import styles from './Shell.module.css'

export interface SidebarNavProps {
  currentPath: string
  /**
   * Borçlu öğrenci sayısı. `undefined` → veri henüz gelmedi ya da okunamadı;
   * `0` → borçlu yok. İkisinde de rozet ÇIKMAZ: teknik olmayan kullanıcıya "0" da,
   * bir hata göstergesi de gereksiz.
   */
  debtorCount?: number
}

/**
 * TASARIM-SISTEMI §6/2. Öğeler gerçek `<a href="#/...">`: tıklama, klavye, orta tuşla
 * açma ve tarayıcı geçmişi kendiliğinden çalışıyor — `onClick` + `preventDefault` ile
 * kurulan sahte bağlantılarda bunların hepsi elle yazılmak zorunda kalırdı.
 */
export function SidebarNav({ currentPath, debtorCount }: SidebarNavProps) {
  return (
    <aside className={styles.sidebar}>
      {/*
        İki ayrı kimlik (ADR-024): 1. satır ÜRÜN adı — Aktansoft'un, sabit, `tr.ts`'ten.
        2. satır KURUM adı — müşterinin, `config/kurum.json`'dan. Aynı değeri iki yerde
        tutmak (tr.ts + setting tablosu) er geç ikiye ayrılıyordu.
      */}
      <div className={styles.brand}>
        <div className={styles.brandName}>{tr.app.brand}</div>
        <div className={styles.brandInstitution}>{institution.name}</div>
      </div>

      <nav className={styles.nav} aria-label={tr.nav.label}>
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item.path, currentPath)
          const showBadge = item.badge === 'debtors' && debtorCount !== undefined && debtorCount > 0

          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              className={[styles.navItem, active ? styles.navItemActive : undefined]
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span>{item.label}</span>
              {showBadge && (
                <Badge tone="danger">
                  <span aria-hidden="true">{debtorCount}</span>
                  <span className="visually-hidden">
                    {debtorCount} {tr.nav.debtorCount}
                  </span>
                </Badge>
              )}
            </a>
          )
        })}
      </nav>

      {/* Sürüm numarası package.json'dan; elle yazılan sürüm kayar (ADR-024 §e). */}
      <div className={styles.footer}>
        {tr.app.versionPrefix} {APP_VERSION}
        {tr.units.separator}
        {tr.app.versionLocal}
      </div>
    </aside>
  )
}
