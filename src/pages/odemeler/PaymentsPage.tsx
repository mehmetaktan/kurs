import { useState } from 'react'
import { tr } from '../../i18n/tr'
import { PageContent } from '../../shell/AppShell'
import { PageHeader } from '../../shell/PageHeader'
import { Button, EmptyState } from '../../ui'
import { PaymentModal } from './PaymentModal'

/** §5'in giriş yüzeyi; borçlu tablosu §6 commit'inde aynı sayfaya eklenecek. */
export function PaymentsPage() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHeader
        title={tr.pages.payments.title}
        subtitle={tr.pages.payments.subtitle}
        action={<Button variant="primary" onClick={() => setOpen(true)}>{tr.payments.takePayment}</Button>}
      />
      <PageContent>
        <EmptyState
          title={tr.payments.introTitle}
          body={tr.payments.introBody}
          action={<Button variant="primary" onClick={() => setOpen(true)}>{tr.payments.takePayment}</Button>}
        />
      </PageContent>
      <PaymentModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
