import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { GeneralTab } from './GeneralTab'
import { TeachersTab } from './TeachersTab'

/**
 * `Tanımlar → Öğretmenler` ve `Tanımlar → Genel` — **ADR-037**.
 *
 * Sınananlar bu iki ekranın kabul şartı: kurs sahibi öğretmen adını değiştirebiliyor
 * mu, pasif öğretmen listede kalıyor mu, ve **para politikası** olan iki devamsızlık
 * satırı doğru anahtara yazılıyor mu (ADR-016 — bu, para fazının girdisi).
 */
const api = vi.hoisted(() => ({
  fetchTeachers: vi.fn(),
  saveTeacher: vi.fn(),
  archiveTeacher: vi.fn(),
  fetchSettings: vi.fn(),
  updateSetting: vi.fn(),
}))

vi.mock('../../lib/api', () => api)

const TEACHERS = [
  { id: 1, fullName: 'Öğretmen', color: '#5f8f6b', phone: null, email: null, isActive: true, sortOrder: 0 },
  {
    id: 2,
    fullName: 'Veli Kaya',
    color: '#6a86a8',
    phone: '0532 111 22 33',
    email: null,
    isActive: false,
    sortOrder: 0,
  },
]

const SETTINGS = [
  { key: 'day_start', value: '08:00' },
  { key: 'day_end', value: '22:00' },
  { key: 'slot_minutes', value: '30' },
  { key: 'default_session_minutes', value: '60' },
  { key: 'session_horizon_weeks', value: '16' },
  { key: 'row_density', value: 'comfortable' },
  { key: 'absence_excused_consumes_lesson', value: '0' },
  { key: 'absence_unexcused_consumes_lesson', value: '1' },
  { key: 'package_expiry_days', value: '' },
  { key: 'receipt_prefix', value: '2026-' },
  { key: 'backup_warn_days', value: '3' },
]

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchTeachers.mockResolvedValue(TEACHERS)
  api.saveTeacher.mockResolvedValue(1)
  api.archiveTeacher.mockResolvedValue(true)
  api.fetchSettings.mockResolvedValue(SETTINGS)
  api.updateSetting.mockResolvedValue(undefined)
})

const drawTeachers = () =>
  render(
    <ToastProvider>
      <TeachersTab />
    </ToastProvider>,
  )

const drawGeneral = () =>
  render(
    <ToastProvider>
      <GeneralTab />
    </ToastProvider>,
  )

describe('Tanımlar → Öğretmenler', () => {
  it('pasif öğretmen listede kalır ve durumu yazılır', async () => {
    drawTeachers()
    await screen.findByText('Veli Kaya')

    // `is_active = 0` "artık ders vermiyor" demek, arşiv değil: listeden düşseydi
    // kullanıcı onu geri açamazdı.
    expect(screen.getByText('Pasif')).toBeTruthy()
    expect(screen.getByText('Aktif')).toBeTruthy()
  })

  it("migration'ın 'Öğretmen' satırı düzenlenebilir — ADR-037'nin bütün mesele ettiği şey", async () => {
    drawTeachers()
    await screen.findByText('Öğretmen')

    fireEvent.click(screen.getAllByRole('button', { name: 'Düzenle' })[0]!)
    fireEvent.change(screen.getByLabelText('Ad soyad'), {
      target: { value: 'Ayşe Demir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() =>
      expect(api.saveTeacher).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, fullName: 'Ayşe Demir' }),
      ),
    )
  })

  it('yeni öğretmen taslak satır olarak açılır', async () => {
    drawTeachers()
    await screen.findByText('Öğretmen')

    fireEvent.click(screen.getByRole('button', { name: 'Yeni öğretmen' }))
    fireEvent.change(screen.getByLabelText('Ad soyad'), { target: { value: 'Zeynep Ak' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() =>
      expect(api.saveTeacher).toHaveBeenCalledWith(
        expect.objectContaining({ id: null, fullName: 'Zeynep Ak', isActive: true }),
      ),
    )
  })

  it('arşivleme onay ister', async () => {
    drawTeachers()
    await screen.findByText('Veli Kaya')

    fireEvent.click(screen.getAllByRole('button', { name: 'Arşivle' })[0]!)
    expect(screen.getByText('Öğretmen arşivlensin mi?')).toBeTruthy()
    expect(api.archiveTeacher).not.toHaveBeenCalled()
  })
})

describe('Tanımlar → Genel', () => {
  it('devamsızlık politikası doğru anahtara yazılır (ADR-016 — para politikası)', async () => {
    drawGeneral()
    await screen.findByText('İşletme ayarları')

    const excused = screen.getByLabelText('Mazeretli devamsızlıkta ders hakkı düşsün')
    expect((excused as HTMLInputElement).checked).toBe(false)

    fireEvent.click(excused)
    await waitFor(() =>
      expect(api.updateSetting).toHaveBeenCalledWith('absence_excused_consumes_lesson', '1'),
    )
  })

  it('değişiklik anında kaydedilir — kaydedilmemiş form bırakılmaz', async () => {
    drawGeneral()
    await screen.findByText('İşletme ayarları')

    const field = screen.getByLabelText('Varsayılan ders süresi (dk)')
    fireEvent.change(field, { target: { value: '90' } })
    fireEvent.blur(field)

    await waitFor(() =>
      expect(api.updateSetting).toHaveBeenCalledWith('default_session_minutes', '90'),
    )
  })

  it('sayı olmayan girdi kaydedilmez, alan eski değerine döner', async () => {
    drawGeneral()
    await screen.findByText('İşletme ayarları')

    const field = screen.getByLabelText('Takvim aralığı (dk)') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'yarım saat' } })
    fireEvent.blur(field)

    expect(api.updateSetting).not.toHaveBeenCalled()
    expect(field.value).toBe('30')
  })

  it('paket süresi boş bırakılabilir — "süresiz" demek', async () => {
    drawGeneral()
    await screen.findByText('İşletme ayarları')

    const field = screen.getByLabelText('Paket geçerlilik süresi (gün)')
    fireEvent.change(field, { target: { value: '90' } })
    fireEvent.blur(field)
    await waitFor(() => expect(api.updateSetting).toHaveBeenCalledWith('package_expiry_days', '90'))

    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    await waitFor(() => expect(api.updateSetting).toHaveBeenCalledWith('package_expiry_days', ''))
  })

  it("programın kendi satırları ekranda YOK (ADR-024 kurum adı, makbuz sayacı, yedek zamanı)", async () => {
    api.fetchSettings.mockResolvedValue([
      ...SETTINGS,
      { key: 'institution_name', value: 'Aydın Özel Ders' },
      { key: 'receipt_next_no', value: '14' },
      { key: 'last_backup_at', value: '2026-07-25 08:14' },
    ])
    drawGeneral()
    await screen.findByText('İşletme ayarları')

    expect(screen.queryByDisplayValue('Aydın Özel Ders')).toBeNull()
    expect(screen.queryByDisplayValue('14')).toBeNull()
    expect(screen.queryByDisplayValue('2026-07-25 08:14')).toBeNull()
  })
})
