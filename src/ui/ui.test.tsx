import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { PhoneInput } from './Field'
import { DatePicker, TimePicker } from './Picker'
import { Drawer } from './Drawer'
import { Modal } from './Modal'
import { StatCard, Tabs } from './Display'
import { ErrorState } from './States'
import { Table } from './Table'
import { TOAST_MS, ToastProvider, useToast } from './Toast'
import type { Column } from './Table'

/**
 * Komponentlerin **davranışı** — görünüşü değil.
 *
 * Buradaki iddiaların hepsi fazın kabul şartlarından geliyor: "klavye ile tam
 * gezinilebilir", "her yıkıcı işlemde onay", "toast 2200 ms sonra kapanır", "liste
 * satırının içindeki düğme satırı açmaz". Bunların hiçbiri showcase sayfasına bakarak
 * doğrulanamaz; gözle bakmak çalıştığını değil çizildiğini gösterir.
 *
 * `@testing-library/jest-dom` KURULMADI: `toHaveTextContent` gibi kolaylık eşleştiricileri
 * için üçüncü bir bağımlılık taşımak yerine `textContent` / `getAttribute` okunuyor.
 */

afterEach(() => {
  vi.useRealTimers()
})

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Button', () => {
  it('varsayılan type=button — form içinde kazara gönderim yapmaz', () => {
    render(<Button>Kaydet</Button>)
    const button = screen.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement
    expect(button.type).toBe('button')
  })

  it('disabled iken tıklanamaz', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Kaydet
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ErrorState', () => {
  it('beklenmeyen hata ayrıntısını göstermeden panoya kopyalar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<ErrorState message="Türkçe kullanıcı mesajı" details="sqlite: teknik ayrıntı" />)

    expect(screen.queryByText('sqlite: teknik ayrıntı')).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları kopyala' }))
    })
    expect(writeText).toHaveBeenCalledWith('sqlite: teknik ayrıntı')
    expect(screen.getByRole('button', { name: 'Ayrıntılar kopyalandı' })).toBeTruthy()
  })
})

describe('Modal — odak tuzağı ve Esc', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Aç
        </button>
        <Modal
          open={open}
          title="Dersi taşı"
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="primary">Sadece bu ders</Button>
              <Button>Bu ve sonraki dersler</Button>
            </>
          }
        />
      </>
    )
  }

  it('açılınca odak modalın içine girer', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    // İlk odaklanabilir öğe ilk eylem düğmesi olmalı.
    expect(document.activeElement?.textContent).toBe('Sadece bu ders')
  })

  it('Tab son öğeden başa döner, Shift+Tab sondan dolanır', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }))

    const dialog = screen.getByRole('dialog')
    const focusables = within(dialog).getAllByRole('button')
    const first = focusables[0] as HTMLElement
    const last = focusables[focusables.length - 1] as HTMLElement
    // İki eylem düğmesi + "Vazgeç" bağlantısı.
    expect(focusables).toHaveLength(3)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('Esc kapatır ve odak açan düğmeye döner', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Aç' })
    // Gerçek tarayıcıda tıklama düğmeyi odaklar; jsdom'da `click` odak vermiyor.
    // Odağın geri döndüğü yerin doğru olması için başlangıç durumunu kuralım.
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('kapalıyken hiç çizilmez', () => {
    render(<Modal open={false} title="Gizli" onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Drawer', () => {
  it('Esc, kapatma düğmesi ve zemin tıklaması kapatır', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Drawer open title="Mehmet Aslan" onClose={onClose}>
        <p>Özet</p>
      </Drawer>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    // Zemin (scrim) — çekmece bir özet, form değil; dışına tıklamak kapatır.
    const scrim = container.firstElementChild as HTMLElement
    fireEvent.click(scrim)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('çekmecenin içine tıklamak kapatmaz', () => {
    const onClose = vi.fn()
    render(
      <Drawer open title="Mehmet Aslan" onClose={onClose}>
        <p>Özet</p>
      </Drawer>,
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Toast', () => {
  function Harness() {
    const toast = useToast()
    return (
      <button type="button" onClick={() => toast('Ders taşındı')}>
        Taşı
      </button>
    )
  }

  it('2200 ms sonra kendiliğinden kapanır', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Taşı' }))
    expect(screen.getByRole('status').textContent).toBe('Ders taşındı')

    // Süre dolmadan hâlâ ekranda.
    tick(TOAST_MS - 1)
    expect(screen.queryByRole('status')).not.toBeNull()

    tick(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('yeni bildirim eskisinin süresini sıfırlar', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
    const button = screen.getByRole('button', { name: 'Taşı' })

    fireEvent.click(button)
    tick(TOAST_MS - 100)
    fireEvent.click(button)

    // Eski sürenin bitmesi gereken anı geçtik ama yeni bildirim ayakta.
    tick(200)
    expect(screen.queryByRole('status')).not.toBeNull()

    tick(TOAST_MS)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Table', () => {
  interface Row {
    id: number
    name: string
  }

  const columns: readonly Column<Row>[] = [
    { key: 'name', header: 'Ad Soyad', width: '1fr', render: (row) => row.name },
    {
      key: 'action',
      header: '',
      width: '108px',
      align: 'end',
      render: () => <Button size="small">Tahsilat al</Button>,
    },
  ]

  const rows: Row[] = [
    { id: 1, name: 'Mehmet Aslan' },
    { id: 2, name: 'Zeynep Ak' },
  ]

  const renderTable = (onRowClick?: (row: Row) => void) =>
    render(
      <Table
        label="Öğrenciler"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    )

  it('satırın tamamı tıklanabilir', () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    fireEvent.click(screen.getByText('Mehmet Aslan'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('satır içindeki düğme satırı AÇMAZ', () => {
    // Tasarımdaki `stopPropagation` davranışı. Her çağırana bırakılsaydı bir yerde
    // unutulur ve kullanıcı tahsilat alırken çekmece de açılırdı.
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    fireEvent.click(screen.getAllByRole('button', { name: 'Tahsilat al' })[0] as HTMLElement)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('klavyeyle satır açılır: Enter ve Boşluk', () => {
    const onRowClick = vi.fn()
    renderTable(onRowClick)
    // Başlık satırı da role="row" olduğu için ilk veri satırı indeks 1.
    const row = screen.getAllByRole('row')[1] as HTMLElement
    expect(row.tabIndex).toBe(0)

    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })
    expect(onRowClick).toHaveBeenCalledTimes(2)
  })

  it('tıklanamaz tabloda satır odak sırasına GİRMEZ', () => {
    renderTable()
    const row = screen.getAllByRole('row')[1] as HTMLElement
    expect(row.hasAttribute('tabindex')).toBe(false)
  })

  it('satır yoksa boş durumu gösterir, başlığı çizmez', () => {
    render(
      <Table
        label="Öğrenciler"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyState={<span>Henüz öğrenci kaydı yok</span>}
      />,
    )
    expect(screen.getByText('Henüz öğrenci kaydı yok')).toBeTruthy()
    expect(screen.queryByRole('columnheader')).toBeNull()
  })
})

describe('Tabs', () => {
  function Harness() {
    const [value, setValue] = useState('kayitlar')
    return (
      <Tabs
        label="Öğrenci detayı"
        value={value}
        onChange={setValue}
        items={[
          { value: 'kayitlar', label: 'Kayıtlar', count: 2 },
          { value: 'gecmis', label: 'Ders geçmişi', count: 24 },
          { value: 'notlar', label: 'Notlar' },
        ]}
      />
    )
  }

  const selected = (name: RegExp) =>
    screen.getByRole('tab', { name }).getAttribute('aria-selected')

  it('← → ile sekme değişir ve başta/sonda dolanır', () => {
    render(<Harness />)
    expect(selected(/Kayıtlar/)).toBe('true')

    fireEvent.keyDown(screen.getByRole('tab', { name: /Kayıtlar/ }), { key: 'ArrowRight' })
    expect(selected(/Ders geçmişi/)).toBe('true')

    fireEvent.keyDown(screen.getByRole('tab', { name: /Ders geçmişi/ }), { key: 'ArrowLeft' })
    expect(selected(/Kayıtlar/)).toBe('true')

    // Baştan sola gidince sona dolanmalı.
    fireEvent.keyDown(screen.getByRole('tab', { name: /Kayıtlar/ }), { key: 'ArrowLeft' })
    expect(selected(/Notlar/)).toBe('true')
  })

  it('yalnızca seçili sekme odak sırasında (tablist deseni)', () => {
    render(<Harness />)
    expect((screen.getByRole('tab', { name: /Kayıtlar/ }) as HTMLElement).tabIndex).toBe(0)
    expect((screen.getByRole('tab', { name: /Notlar/ }) as HTMLElement).tabIndex).toBe(-1)
  })
})

describe('StatCard', () => {
  it('değer yoksa tire gösterir', () => {
    render(<StatCard label="KALAN DERS" value={null} caption="Aktif kayıt yok" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('değer varsa olduğu gibi yazar', () => {
    render(<StatCard label="BAKİYE" value="−1.200,00 ₺" tone="danger" />)
    expect(screen.getByText('−1.200,00 ₺')).toBeTruthy()
  })
})

describe('DatePicker', () => {
  function Harness({ initial = null }: { initial?: string | null }) {
    const [value, setValue] = useState<string | null>(initial)
    return (
      <>
        <DatePicker label="Tarih" value={value} onChange={setValue} today="2026-07-25" />
        <p data-testid="deger">{value ?? 'bos'}</p>
      </>
    )
  }

  const value = () => screen.getByTestId('deger').textContent

  it('yazılan tarihi ISO biçimine çevirir', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Tarih')

    fireEvent.change(input, { target: { value: '25.07.2026' } })
    fireEvent.blur(input)
    expect(value()).toBe('2026-07-25')
  })

  it('bozuk tarihte örnekli Türkçe hata gösterir ve değeri değiştirmez', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Tarih')

    fireEvent.change(input, { target: { value: '31.02.2026' } })
    fireEvent.blur(input)

    // Hata mesajı biçimi ÖRNEKLE anlatıyor; ham hata kodu yok (CLAUDE.md > Arayüz).
    expect(screen.getByRole('alert').textContent).toContain('25.07.2026')
    expect(value()).toBe('bos')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('ay ızgarasından gün seçilir ve panel kapanır', () => {
    render(<Harness initial="2026-07-25" />)
    fireEvent.click(screen.getByRole('button', { name: 'Takvimi aç' }))

    const panel = screen.getByRole('dialog', { name: 'Takvimi aç' })
    fireEvent.click(within(panel).getByRole('button', { name: '03.07.2026' }))

    expect(value()).toBe('2026-07-03')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ay ızgarası Pazartesi ile başlar', () => {
    render(<Harness initial="2026-07-25" />)
    fireEvent.click(screen.getByRole('button', { name: 'Takvimi aç' }))

    const panel = screen.getByRole('dialog', { name: 'Takvimi aç' })
    expect(within(panel).getByText('Temmuz 2026')).toBeTruthy()
    // 1 Temmuz 2026 Çarşamba: Pazartesi başlangıçlı ızgarada önce 29–30 Haziran gelir.
    expect(within(panel).getByRole('button', { name: '29.06.2026' })).toBeTruthy()
    expect(within(panel).getAllByText('Pzt')).toHaveLength(1)
  })

  it('Esc paneli kapatır', () => {
    render(<Harness initial="2026-07-25" />)
    fireEvent.click(screen.getByRole('button', { name: 'Takvimi aç' }))
    expect(screen.queryByRole('dialog')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('PhoneInput', () => {
  function Harness({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return <PhoneInput label="Telefon" value={value} onChange={setValue} />
  }

  const field = () => screen.getByLabelText('Telefon') as HTMLInputElement

  it('yazarken maskeyi kurar ve kaydedilen değer maskeli metindir', () => {
    render(<Harness />)
    fireEvent.change(field(), { target: { value: '05321112233' } })
    expect(field().value).toBe('0532 111 22 33')
  })

  it('+90 yapıştırması kabul edilir', () => {
    render(<Harness />)
    fireEvent.change(field(), { target: { value: '+90 532 111 22 33' } })
    expect(field().value).toBe('0532 111 22 33')
  })

  it('ayıraç üstünde Backspace bir RAKAM siler — alan kilitlenmez', () => {
    render(<Harness initial="0532 111 22 33" />)
    const input = field()
    input.setSelectionRange(5, 5) // `0532 |111 …`

    fireEvent.keyDown(input, { key: 'Backspace' })

    // Boşluk silinseydi maske onu anında geri koyar, tuş çalışmıyormuş gibi görünürdü.
    expect(input.value).toBe('0531 112 23 3')
    expect(input.selectionStart).toBe(3)
  })

  it('ortadan yazınca imleç sona atlamaz', () => {
    render(<Harness initial="0532 111 22 33" />)
    const input = field()

    // `0532 1|911 22 33` — 6. konuma `9` yazıldı.
    fireEvent.change(input, { target: { value: '0532 1911 22 33', selectionStart: 7 } })

    expect(input.value.slice(0, input.selectionStart ?? 0)).toBe('0532 19')
  })
})

describe('TimePicker', () => {
  function Harness() {
    const [value, setValue] = useState<string | null>(null)
    return (
      <>
        <TimePicker label="Saat" value={value} onChange={setValue} />
        <p data-testid="deger">{value ?? 'bos'}</p>
      </>
    )
  }

  const value = () => screen.getByTestId('deger').textContent

  it('kısa yazımı tam saate çevirir', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Saat')

    fireEvent.change(input, { target: { value: '930' } })
    fireEvent.blur(input)
    expect(value()).toBe('09:30')
  })

  it('30 dakikalık dilimlerden seçilir (08:00–22:00)', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Saat listesini aç' }))

    const panel = screen.getByRole('dialog', { name: 'Saat listesini aç' })
    expect(within(panel).getByRole('button', { name: '08:00' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: '22:00' })).toBeTruthy()
    // Takvim aralığının dışı listelenmez.
    expect(within(panel).queryByRole('button', { name: '07:30' })).toBeNull()
    expect(within(panel).queryByRole('button', { name: '22:30' })).toBeNull()

    fireEvent.click(within(panel).getByRole('button', { name: '16:30' }))
    expect(value()).toBe('16:30')
  })

  it('aralık dışı saatte hata gösterir', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Saat')

    fireEvent.change(input, { target: { value: '25:00' } })
    fireEvent.blur(input)
    expect(screen.getByRole('alert').textContent).toContain('14:30')
    expect(value()).toBe('bos')
  })
})
