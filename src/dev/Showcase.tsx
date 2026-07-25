import { useState } from 'react'
import { formatDate, formatLira, formatPhone } from '../lib/format'
import { PageContent } from '../shell/AppShell'
import { PageHeader, StatusBar } from '../shell/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ChipRow,
  ConfirmDialog,
  DatePicker,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  Kbd,
  LoadingState,
  Modal,
  ModalOption,
  Pagination,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  StatCard,
  StatStrip,
  StatusDot,
  StepperGroup,
  Table,
  Tabs,
  Textarea,
  TimePicker,
  useToast,
} from '../ui'
import type { Column } from '../ui'
import { showcaseTr as t } from './showcase.tr'
import styles from './Showcase.module.css'

/**
 * `/dev/komponentler` — bütün komponentler, bütün varyantlarıyla.
 *
 * Proje boyunca referans: yeni bir komponent yazıldığında buraya da eklenir. Üretim
 * derlemesinde bu rota yok (`App.tsx` içindeki `import.meta.env.DEV` dalı).
 */
export default function Showcase() {
  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        search={<SearchInput placeholder={t.controls.searchPlaceholder} hint="Ctrl K" />}
        action={<Button variant="primary">{t.buttons.primary}</Button>}
      />
      <PageContent>
        <div className={styles.page}>
          <p className={styles.intro}>{t.intro}</p>

          <Buttons />
          <Fields />
          <Controls />
          <Pickers />
          <Display />
          <TableDemo />
          <Overlays />
          <States />
        </div>
      </PageContent>
      <StatusBar left={t.subtitle} right={<Kbd>Esc</Kbd>} />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <SectionHeader title={title} />
      {children}
    </section>
  )
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.stack}>
      <span className={styles.subhead}>{label}</span>
      <div className={styles.row}>{children}</div>
    </div>
  )
}

function Buttons() {
  return (
    <Section title={t.sections.buttons}>
      <Sub label={t.labels.variants}>
        <Button variant="primary">{t.buttons.primary}</Button>
        <Button variant="secondary">{t.buttons.secondary}</Button>
        <Button variant="ghost">{t.buttons.ghost}</Button>
        <Button variant="warning">{t.buttons.warning}</Button>
        <Button variant="danger">{t.buttons.danger}</Button>
        <Button variant="icon" aria-label={t.buttons.icon}>
          ‹
        </Button>
      </Sub>
      <Sub label={t.labels.sizes}>
        <Button variant="primary">{t.buttons.primary}</Button>
        <Button variant="secondary" size="small">
          {t.buttons.small}
        </Button>
        <Button variant="warning" size="small">
          {t.buttons.warning}
        </Button>
      </Sub>
      <Sub label={t.labels.disabled}>
        <Button variant="primary" disabled>
          {t.buttons.primary}
        </Button>
        <Button variant="secondary" disabled>
          {t.buttons.secondary}
        </Button>
        <Button variant="warning" size="small" disabled>
          {t.buttons.warning}
        </Button>
      </Sub>
    </Section>
  )
}

function Fields() {
  const [checked, setChecked] = useState(true)
  const subjects = [
    { value: 'mat', label: t.subjects.math },
    { value: 'ing', label: t.subjects.english },
    { value: 'fiz', label: t.subjects.physics },
  ]

  return (
    <Section title={t.sections.fields}>
      <div className={styles.grid}>
        <Input label={t.fields.nameLabel} placeholder={t.fields.namePlaceholder} />
        <Input
          label={t.fields.nameLabel}
          placeholder={t.fields.namePlaceholder}
          hint={t.fields.nameHint}
        />
        <Input label={t.fields.amountLabel} defaultValue="1.250,0" error={t.fields.amountError} />
        <Input label={t.fields.nameLabel} defaultValue="Mehmet Aslan" disabled />
        <Select label={t.fields.subjectLabel} options={subjects} placeholder={t.fields.subjectPlaceholder} />
        <Select label={t.fields.subjectLabel} options={subjects} disabled />
        <Textarea label={t.fields.noteLabel} placeholder={t.fields.notePlaceholder} />
        <Textarea label={t.fields.noteLabel} placeholder={t.fields.notePlaceholder} bare />
      </div>
      <Sub label={t.labels.variants}>
        <Checkbox
          label={t.fields.primaryGuardian}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <Checkbox label={t.fields.primaryGuardian} disabled />
      </Sub>
    </Section>
  )
}

function Controls() {
  const [view, setView] = useState<'week' | 'day'>('week')
  const [attendance, setAttendance] = useState<'present' | 'excused' | 'unexcused' | 'cancelled'>(
    'present',
  )
  const [chip, setChip] = useState('all')
  const [page, setPage] = useState(2)

  return (
    <Section title={t.sections.controls}>
      <Sub label={t.labels.variants}>
        <SegmentedControl
          label={t.controls.viewLabel}
          value={view}
          onChange={setView}
          options={[
            { value: 'week', label: t.controls.week },
            { value: 'day', label: t.controls.day },
          ]}
        />
        <StepperGroup
          centerLabel={t.controls.week}
          prevLabel={t.controls.week}
          nextLabel={t.controls.day}
          onPrev={() => {}}
          onNext={() => {}}
          onCenter={() => {}}
        />
        <Kbd>Ctrl K</Kbd>
        <Kbd>Esc</Kbd>
        <Kbd>←</Kbd>
      </Sub>

      <SegmentedControl
        label={t.controls.attendanceLabel}
        value={attendance}
        onChange={setAttendance}
        options={[
          { value: 'present', label: t.controls.present },
          { value: 'excused', label: t.controls.excused },
          { value: 'unexcused', label: t.controls.unexcused },
          { value: 'cancelled', label: t.controls.cancelled },
        ]}
      />

      <ChipRow>
        <FilterChip label={t.controls.chipAll} count={14} active={chip === 'all'} onClick={() => setChip('all')} />
        <FilterChip label={t.controls.chipActive} count={12} active={chip === 'active'} onClick={() => setChip('active')} />
        <FilterChip label={t.controls.chipPassive} count={2} active={chip === 'passive'} onClick={() => setChip('passive')} />
        <FilterChip label={t.controls.chipDebt} count={4} active={chip === 'debt'} onClick={() => setChip('debt')} />
        <FilterChip label={t.controls.chipEnding} active={chip === 'ending'} onClick={() => setChip('ending')} />
      </ChipRow>

      <Sub label={t.labels.variants}>
        <SearchInput placeholder={t.controls.searchPlaceholder} hint="↵ aç" />
        <Pagination page={page} pageCount={7} onChange={setPage} />
      </Sub>
    </Section>
  )
}

function Pickers() {
  const [date, setDate] = useState<string | null>('2026-07-25')
  const [time, setTime] = useState<string | null>('16:00')

  return (
    <Section title={t.sections.pickers}>
      <div className={styles.grid}>
        <DatePicker
          label={t.fields.dateLabel}
          value={date}
          onChange={setDate}
          today="2026-07-25"
        />
        <TimePicker label={t.fields.timeLabel} value={time} onChange={setTime} />
        <DatePicker label={t.fields.dateLabel} value={date} onChange={setDate} disabled />
      </div>
    </Section>
  )
}

function Display() {
  const [tab, setTab] = useState('enrollments')

  return (
    <Section title={t.sections.display}>
      <StatStrip>
        <StatCard
          label={t.display.balance}
          value={formatLira(-120000)}
          tone="danger"
          caption={t.display.balanceCaption}
          captionTone="warn"
          action={
            <Button size="small" variant="secondary">
              {t.overlays.drawerPay}
            </Button>
          }
        />
        <StatCard
          label={t.display.attendanceRate}
          value="%92"
          caption={t.display.rateCaption}
        />
        <StatCard
          label={t.display.remaining}
          value="2"
          tone="warn"
          caption={t.display.remainingCaption}
        />
        <StatCard label={t.display.nextSession} value={t.display.nextValue} caption={t.display.nextCaption} />
      </StatStrip>

      <Sub label={t.labels.empty}>
        <StatCard label={t.display.remaining} value={null} caption={t.display.noRecord} />
      </Sub>

      <SectionHeader title={t.display.sectionTitle} meta={t.display.sectionMeta} />

      <Sub label={t.labels.variants}>
        <Badge tone="danger">{t.display.badgeDebt}</Badge>
        <Badge tone="warn">{t.display.badgeAttendance}</Badge>
        <Badge tone="neutral">{t.display.badgeHoliday}</Badge>
        <Badge tone="success">{t.display.badgeDone}</Badge>
        <StatusDot tone="success" label={t.display.dotActive} />
        <StatusDot tone="neutral" label={t.display.dotPassive} hollow />
        <StatusDot tone="warn" label={t.display.dotWarn} />
        <StatusDot tone="danger" label={t.display.dotDanger} />
        <Avatar name="Mehmet Aslan" />
        <Avatar name="Zeynep Ak" size={52} />
      </Sub>

      <Tabs
        label={t.display.tabsLabel}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'enrollments', label: t.display.tabEnrollments, count: 2 },
          { value: 'history', label: t.display.tabHistory, count: 24 },
          { value: 'payments', label: t.display.tabPayments, count: 6 },
          { value: 'notes', label: t.display.tabNotes },
        ]}
      />
    </Section>
  )
}

interface DemoRow {
  id: number
  name: string
  phone: string
  lessons: number
  balance: number
  remaining: number
  last: string
  active: boolean
  attention?: boolean
}

const DEMO_ROWS: DemoRow[] = [
  {
    id: 1,
    name: 'Mehmet Aslan',
    phone: '05322146789',
    lessons: 24,
    balance: -120000,
    remaining: 2,
    last: '2026-07-22',
    active: true,
    attention: true,
  },
  {
    id: 2,
    name: 'Zeynep Ak',
    phone: '05413801244',
    lessons: 18,
    balance: -80000,
    remaining: 5,
    last: '2026-07-21',
    active: true,
  },
  {
    id: 3,
    name: 'Işık Yılmaz',
    phone: '05056629031',
    lessons: 30,
    balance: 35000,
    remaining: 8,
    last: '2026-07-23',
    active: true,
  },
  {
    id: 4,
    name: 'Emre Çelik',
    phone: '05375081022',
    lessons: 5,
    balance: 0,
    remaining: 0,
    last: '2026-05-02',
    active: false,
  },
]

function TableDemo() {
  const [tight, setTight] = useState(false)
  const toast = useToast()

  const columns: readonly Column<DemoRow>[] = [
    {
      key: 'name',
      header: t.table.name,
      width: 'minmax(160px,1.6fr)',
      render: (row) => row.name,
    },
    { key: 'phone', header: t.table.phone, width: '150px', render: (row) => formatPhone(row.phone) },
    {
      key: 'lessons',
      header: t.table.lessons,
      width: '96px',
      align: 'end',
      render: (row) => row.lessons,
    },
    {
      key: 'balance',
      header: t.table.balance,
      width: '120px',
      align: 'end',
      render: (row) => formatLira(row.balance),
    },
    {
      key: 'remaining',
      header: t.table.remaining,
      width: '96px',
      align: 'end',
      render: (row) => row.remaining,
    },
    {
      key: 'last',
      header: t.table.lastLesson,
      width: '118px',
      align: 'end',
      // Ham ISO gösterilmez: veritabanı 'YYYY-MM-DD' tutuyor, ekranda 25.07.2026 olur.
      render: (row) => formatDate(row.last),
    },
    {
      key: 'status',
      header: t.table.status,
      width: '108px',
      render: (row) =>
        row.active ? (
          <StatusDot tone="success" label={t.display.dotActive} />
        ) : (
          <StatusDot tone="neutral" label={t.display.dotPassive} hollow />
        ),
    },
    {
      key: 'action',
      header: '',
      width: '108px',
      align: 'end',
      render: () => (
        <Button size="small" onClick={() => toast(t.overlays.toastMessage)}>
          {t.table.action}
        </Button>
      ),
    },
  ]

  return (
    <Section title={t.sections.table}>
      <Sub label={t.labels.density}>
        <SegmentedControl
          label={t.labels.density}
          value={tight ? 'tight' : 'relaxed'}
          onChange={(value) => {
            const next = value === 'tight'
            setTight(next)
            // Yoğunluk kök öğedeki data-density'den okunuyor (density.css).
            document.documentElement.dataset.density = next ? 'tight' : 'relaxed'
          }}
          options={[
            { value: 'relaxed', label: t.labels.densityRelaxed },
            { value: 'tight', label: t.labels.densityTight },
          ]}
        />
      </Sub>

      <Table
        label={t.table.label}
        columns={columns}
        rows={DEMO_ROWS}
        rowKey={(row) => row.id}
        rowAttention={(row) => row.attention === true}
        stickyHeader
        onRowClick={() => toast(t.overlays.toastMessage)}
      />
      <StatusBar
        left={t.table.footerLeft}
        right={`${t.table.footerRight} ${formatLira(200000)}`}
      />
    </Section>
  )
}

function Overlays() {
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const toast = useToast()

  return (
    <Section title={t.sections.overlays}>
      <Sub label={t.labels.variants}>
        <Button onClick={() => setModal(true)}>{t.overlays.openModal}</Button>
        <Button onClick={() => setConfirm(true)}>{t.overlays.openConfirm}</Button>
        <Button onClick={() => setDrawer(true)}>{t.overlays.openDrawer}</Button>
        <Button onClick={() => toast(t.overlays.toastMessage)}>{t.overlays.showToast}</Button>
      </Sub>

      <Modal
        open={modal}
        title={t.overlays.modalTitle}
        description={t.overlays.modalDescription}
        onClose={() => setModal(false)}
        actions={
          <>
            <ModalOption
              tone="primary"
              title={t.overlays.optionOnce}
              hint={t.overlays.optionOnceHint}
              onClick={() => setModal(false)}
            />
            <ModalOption
              title={t.overlays.optionFuture}
              hint={t.overlays.optionFutureHint}
              onClick={() => setModal(false)}
            />
          </>
        }
      />

      <ConfirmDialog
        open={confirm}
        destructive
        title={t.overlays.confirmTitle}
        description={t.overlays.confirmDescription}
        confirmLabel={t.overlays.confirmAction}
        confirmHint={t.overlays.confirmHint}
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />

      <Drawer
        open={drawer}
        title={t.overlays.drawerTitle}
        onClose={() => setDrawer(false)}
        leading={<Avatar name={t.overlays.drawerTitle} />}
        footer={
          <>
            <Button variant="primary" block onClick={() => setDrawer(false)}>
              {t.overlays.drawerPay}
            </Button>
            <Button onClick={() => setDrawer(false)}>{t.buttons.secondary}</Button>
          </>
        }
      >
        <span className={styles.subhead}>{t.overlays.drawerContact}</span>
        <div className={styles.drawerRow}>
          <span className={styles.drawerKey}>{t.overlays.drawerGuardian}</span>
          <span>Hasan Aslan</span>
        </div>
        <div className={styles.drawerRow}>
          <span className={styles.drawerKey}>{t.overlays.drawerPhone}</span>
          <span>{formatPhone('05322146789')}</span>
        </div>
      </Drawer>
    </Section>
  )
}

function States() {
  return (
    <Section title={t.sections.states}>
      <div className={styles.grid}>
        <EmptyState
          kind="first-use"
          title={t.states.firstUseTitle}
          body={t.states.firstUseBody}
          action={<Button variant="primary">{t.states.firstUseAction}</Button>}
        />
        <EmptyState
          kind="no-search-results"
          title={t.states.searchTitle}
          body={t.states.searchBody}
        />
        <EmptyState
          kind="no-filter-results"
          title={t.states.filterTitle}
          secondaryAction={<Button>{t.states.filterAction}</Button>}
        />
        <LoadingState />
        <ErrorState message={t.states.errorMessage} onRetry={() => {}} />
        <ErrorState message={t.states.errorMessage} onRetry={() => {}} inline />
      </div>
    </Section>
  )
}
