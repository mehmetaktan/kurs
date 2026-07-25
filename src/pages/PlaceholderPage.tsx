import { tr } from '../i18n/tr'
import { PageContent } from '../shell/AppShell'
import { PageHeader } from '../shell/PageHeader'
import type { PageDef } from '../shell/routes'
import styles from '../shell/Shell.module.css'

/**
 * Faz 3 sayfaları: kabuk ve tasarım sistemi kuruldu, içerik sonraki fazlarda geliyor.
 *
 * Boş bir alan bırakmak yerine ne olacağını söyleyen bir kart konuyor. Kullanıcı bunu
 * göremeyecek (paket Faz 10'da teslim ediliyor) ama geliştirme boyunca hangi ekranın
 * hangi fazı beklediği tek bakışta görünüyor.
 */
export function PlaceholderPage({ page }: { page: PageDef }) {
  return (
    <>
      <PageHeader title={page.title} subtitle={page.subtitle} />
      <PageContent>
        <div className={styles.placeholder}>
          <span className={styles.placeholderTitle}>{tr.placeholder.title}</span>
          <p className={styles.placeholderBody}>{tr.placeholder.body}</p>
        </div>
      </PageContent>
    </>
  )
}

/** Bilinmeyen adres. Kullanıcıya ne yapacağını söylüyor. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader title={tr.pages.notFound.title} subtitle={tr.pages.notFound.subtitle} />
      <PageContent>
        <div className={styles.placeholder}>
          <p className={styles.placeholderBody}>{tr.pages.notFound.body}</p>
        </div>
      </PageContent>
    </>
  )
}
