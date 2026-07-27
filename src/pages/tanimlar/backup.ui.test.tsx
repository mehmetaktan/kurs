import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../ui'
import { BackupTab } from './BackupTab'

const api = vi.hoisted(() => ({
  fetchBackupStatus: vi.fn(),
  createBackupNow: vi.fn(),
  openBackupDirectory: vi.fn(),
  selectBackupFile: vi.fn(),
  selectBackupDestination: vi.fn(),
  copyBackupTo: vi.fn(),
  restoreBackup: vi.fn(),
  updateSetting: vi.fn(),
}))
vi.mock('../../lib/api', () => api)

const STATUS = {
  directory: 'C:\\Users\\Ayşe\\Documents\\Kurs Takip\\Yedekler',
  warnDays: 3,
  logs: [
    {
      id: 1,
      takenAt: '2026-07-27 08:14',
      filePath: 'C:\\yedek\\kurs-yedek-2026-07-27.db',
      sizeBytes: 184_320,
      isAuto: true,
      ok: true,
      error: null,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    },
  ],
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.fetchBackupStatus.mockResolvedValue(STATUS)
  api.createBackupNow.mockResolvedValue('C:\\yedek\\elle.db')
  api.openBackupDirectory.mockResolvedValue(undefined)
  api.selectBackupFile.mockResolvedValue('D:\\kurs-yedek.db')
  api.selectBackupDestination.mockResolvedValue('E:\\Kurs Yedekleri')
  api.copyBackupTo.mockResolvedValue('E:\\Kurs Yedekleri\\kurs-yedek.db')
  api.restoreBackup.mockResolvedValue('C:\\yedek\\geri-yukleme-oncesi.db')
  api.updateSetting.mockResolvedValue(undefined)
})

const draw = () =>
  render(
    <ToastProvider>
      <BackupTab />
    </ToastProvider>,
  )

describe('Tanımlar → Yedekleme', () => {
  it('kullanıcıya görünür klasörü, geçmişi ve elle yedeklemeyi gösterir', async () => {
    draw()
    expect(await screen.findByText(STATUS.directory)).toBeTruthy()
    expect(screen.getByText('27.07.2026 · 08:14')).toBeTruthy()
    expect(screen.getByText('180 KB')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Şimdi yedekle' }))
    await waitFor(() => expect(api.createBackupNow).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Yedek başarıyla alındı.')).toBeTruthy()
  })

  it('geri yüklemeyi iki ayrı açık onaydan sonra çağırır', async () => {
    draw()
    await screen.findByText(STATUS.directory)

    fireEvent.click(screen.getByRole('button', { name: 'Yedekten geri yükle' }))
    expect(await screen.findByText('Bu yedek geri yüklensin mi?')).toBeTruthy()
    expect(api.restoreBackup).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: /^Yedeği kontrol etmeye devam et/ }),
    )
    expect(await screen.findByText('Mevcut verilerin yerine yedek konsun mu?')).toBeTruthy()
    expect(api.restoreBackup).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^Yedeği geri yükle/ }))
    await waitFor(() => expect(api.restoreBackup).toHaveBeenCalledWith('D:\\kurs-yedek.db'))
  })

  it('başarılı yedeği seçilen dış klasöre kopyalar', async () => {
    draw()
    await screen.findByText(STATUS.directory)
    fireEvent.click(screen.getByRole('button', { name: 'Başka klasöre kopyala' }))

    await waitFor(() =>
      expect(api.copyBackupTo).toHaveBeenCalledWith(
        'C:\\yedek\\kurs-yedek-2026-07-27.db',
        'E:\\Kurs Yedekleri',
      ),
    )
  })
})
