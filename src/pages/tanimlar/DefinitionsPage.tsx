import { useState } from 'react'
import { tr } from '../../i18n/tr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import { Tabs } from '../../ui'
import type { TabItem } from '../../ui'
import { ClosedDaysTab } from './ClosedDaysTab'
import { BackupTab } from './BackupTab'
import { GeneralTab } from './GeneralTab'
import { PriceRulesTab } from './PriceRulesTab'
import { SubjectsTab } from './SubjectsTab'
import { TeachersTab } from './TeachersTab'
import styles from './Definitions.module.css'

type DefinitionsTab = 'subjects' | 'prices' | 'teachers' | 'closedDays' | 'general' | 'backup'

/**
 * Tanımlar — E7 (branşlar), **öğretmenler (ADR-037)**, E8 (tatil / kapalı günler)
 * ve **E18 genel ayarlar**.
 *
 * Son ikisi para fazının §0'ında geldi: `Öğretmenler` yoktu ve `teacher` tablosunun
 * tek satırı üç faz boyunca `'Öğretmen'` kaldı; `Genel` Faz 10'a bırakılmıştı ama
 * içindeki devamsızlık politikası defterin girdisi (ADR-016).
 *
 * `Tarifeler` hâlâ yok — para fazının §1'inde geliyor. Boş sekme koymak kullanıcıya
 * çalışmayan bir düğme göstermek olurdu.
 */
export function DefinitionsPage() {
  const [tab, setTab] = useState<DefinitionsTab>('subjects')

  const items: TabItem<DefinitionsTab>[] = [
    { value: 'subjects', label: tr.definitions.tabs.subjects },
    { value: 'prices', label: tr.definitions.tabs.prices },
    { value: 'teachers', label: tr.definitions.tabs.teachers },
    { value: 'closedDays', label: tr.definitions.tabs.closedDays },
    { value: 'general', label: tr.definitions.tabs.general },
    { value: 'backup', label: tr.definitions.tabs.backup },
  ]

  return (
    <>
      <PageHeader title={tr.pages.definitions.title} subtitle={tr.pages.definitions.subtitle} />
      <PageContent>
        <div className={styles.tabBar}>
          <Tabs items={items} value={tab} onChange={setTab} label={tr.pages.definitions.title} />
        </div>
        {tab === 'subjects' && <SubjectsTab />}
        {tab === 'prices' && <PriceRulesTab />}
        {tab === 'teachers' && <TeachersTab />}
        {tab === 'closedDays' && <ClosedDaysTab />}
        {tab === 'general' && <GeneralTab />}
        {tab === 'backup' && <BackupTab />}
      </PageContent>
    </>
  )
}
