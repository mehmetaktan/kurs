import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchSelect } from './SearchSelect'
import type { SelectOption } from './Field'

/**
 * `KULLANILABILIRLIK.md > K1` — aranabilir seçim.
 *
 * Buradaki iddiaların hepsi maddenin kabul şartı: *"uzun listede arayarak
 * seçebilmeli"*, *"klavyeyle çalışır"*, *"`ingilizce` yazınca `İngilizce` bulunur"*.
 */

const OPTIONS: readonly SelectOption[] = [
  { value: '1', label: 'İngilizce' },
  { value: '2', label: 'Işıl Korkmaz' },
  { value: '3', label: 'Matematik' },
  { value: '4', label: 'Mehmet Aslan' },
  { value: '5', label: 'Çınar Demir' },
]

function Harness({ onChange }: { onChange?: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <SearchSelect
      label="Öğrenci"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const combobox = () => screen.getByRole('combobox') as HTMLInputElement
const optionLabels = () => screen.queryAllByRole('option').map((el) => el.textContent)

function open() {
  fireEvent.focus(combobox())
}

function type(text: string) {
  fireEvent.change(combobox(), { target: { value: text } })
}

describe('SearchSelect', () => {
  it('odaklanınca bütün seçenekleri açar', () => {
    render(<Harness />)
    expect(screen.queryByRole('listbox')).toBeNull()

    open()
    expect(optionLabels()).toHaveLength(OPTIONS.length)
  })

  it('yazdıkça listeyi süzer', () => {
    render(<Harness />)
    open()
    type('ma')

    // Baştan değil, **içinden** eşleşir: `Korkmaz` da listede kalır.
    expect(optionLabels()).toEqual(['Işıl Korkmaz', 'Matematik'])
  })

  it('Türkçe eşleşir: `ingilizce` yazınca `İngilizce` bulunur', () => {
    render(<Harness />)
    open()
    type('ingilizce')

    // ASCII `toLowerCase` ile `İ` küçülmez ve bu satır boş dönerdi (K9 / ADR-030).
    expect(optionLabels()).toEqual(['İngilizce'])
  })

  it('Türkçe eşleşir: `ışıl` noktasız ı ile bulunur, `i` ile bulunmaz', () => {
    render(<Harness />)
    open()
    type('ışıl')
    expect(optionLabels()).toEqual(['Işıl Korkmaz'])

    type('isil')
    expect(optionLabels()).toEqual([])
  })

  it('eşleşme yoksa boş liste değil, cümle gösterir', () => {
    render(<Harness />)
    open()
    type('zzz')

    expect(optionLabels()).toEqual([])
    expect(screen.getByText('Eşleşen kayıt yok')).toBeTruthy()
  })

  it('ok tuşlarıyla gezilir, Enter seçer', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    open()
    type('ma')

    fireEvent.keyDown(combobox(), { key: 'ArrowDown' }) // Işıl Korkmaz → Matematik
    fireEvent.keyDown(combobox(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('3')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(combobox().value).toBe('Matematik')
  })

  it('ok tuşu listenin başına ve sonuna sarar', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    open()

    // İlk seçenekten yukarı → sona sarar. Sarmasaydı imleç ilk satırda sıkışırdı.
    fireEvent.keyDown(combobox(), { key: 'ArrowUp' })
    fireEvent.keyDown(combobox(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('Esc listeyi kapatır ve yazılan metni seçili değere geri alır', () => {
    render(<Harness />)
    open()
    type('mat')
    fireEvent.keyDown(combobox(), { key: 'Enter' })
    expect(combobox().value).toBe('Matematik')

    open()
    type('ing')
    fireEvent.keyDown(combobox(), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(combobox().value).toBe('Matematik')
  })

  it('fareyle seçilen seçenek yazılır', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    open()

    // `mousedown` — `click`'i beklerken girdi odağı kaybeder ve liste kapanırdı.
    fireEvent.mouseDown(screen.getByText('Çınar Demir'))

    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('pasif seçenek listeye girmez', () => {
    render(
      <SearchSelect
        aria-label="Öğretmen"
        options={[
          { value: '1', label: 'Ayşe Demir' },
          { value: '2', label: 'Veli Kaya', disabled: true },
        ]}
        value={null}
        onChange={() => {}}
      />,
    )
    open()

    expect(optionLabels()).toEqual(['Ayşe Demir'])
  })

  it('seçili değer dışarıdan geldiğinde girdide yazar', () => {
    render(
      <SearchSelect aria-label="Öğrenci" options={OPTIONS} value="3" onChange={() => {}} />,
    )
    expect(combobox().value).toBe('Matematik')
  })

  it('combobox rolü ve açık/kapalı durumu ekran okuyucuya bildirilir', () => {
    render(<Harness />)
    expect(combobox().getAttribute('aria-expanded')).toBe('false')

    open()
    expect(combobox().getAttribute('aria-expanded')).toBe('true')
    // İmleçteki seçenek `aria-activedescendant` ile duyurulur.
    const activeId = combobox().getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(document.getElementById(activeId!)?.textContent).toBe('İngilizce')
  })
})
