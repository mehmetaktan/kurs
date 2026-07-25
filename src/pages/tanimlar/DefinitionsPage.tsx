import { useState } from 'react'
import { tr } from '../../i18n/tr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import { Tabs } from '../../ui'
import type { TabItem } from '../../ui'
import { ClosedDaysTab } from './ClosedDaysTab'
import { SubjectsTab } from './SubjectsTab'
import styles from './Definitions.module.css'

type DefinitionsTab = 'subjects' | 'closedDays'

/**
 * Tanımlar — EKRANLAR.md E7 (branşlar) ve E8 (tatil / kapalı günler).
 *
 * **İki sekme var, dört değil.** Tarifeler Faz 7'nin, Genel ayarlar ve Yedekleme
 * Faz 10'un konusu; boş sekme koymak kullanıcıya çalışmayan bir düğme göstermek olurdu.
 * Sekmeler kendi fazlarında eklenir.
 */
export function DefinitionsPage() {
  const [tab, setTab] = useState<DefinitionsTab>('subjects')

  const items: TabItem<DefinitionsTab>[] = [
    { value: 'subjects', label: tr.definitions.tabs.subjects },
    { value: 'closedDays', label: tr.definitions.tabs.closedDays },
  ]

  return (
    <>
      <PageHeader title={tr.pages.definitions.title} subtitle={tr.pages.definitions.subtitle} />
      <PageContent>
        <div className={styles.tabBar}>
          <Tabs items={items} value={tab} onChange={setTab} label={tr.pages.definitions.title} />
        </div>
        {tab === 'subjects' ? <SubjectsTab /> : <ClosedDaysTab />}
      </PageContent>
    </>
  )
}
