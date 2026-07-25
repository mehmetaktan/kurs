import { describe, expect, it } from 'vitest'
import { compareTr, sortTr, sortTrBy } from './sortTr'

/**
 * ADR-020'nin tek dayanağı bu dosya. SQL'de `ORDER BY` yasak olduğu için Türkçe
 * sıralamanın DOĞRU olduğunu kanıtlayan başka hiçbir yer yok.
 *
 * Beklentiler `docs/VERI-MODELI.md §6` (`sort_tr`) satırından birebir alındı.
 */

describe('compareTr', () => {
  it('VERI-MODELI §6 sözleşmesini karşılar', () => {
    expect(compareTr('Çınar', 'Demir')).toBeLessThan(0)
    expect(compareTr('İnce', 'Kaya')).toBeLessThan(0)
    expect(compareTr('ışık', 'iyi')).toBeLessThan(0)
  })

  it('Türkçe alfabe sırasını uygular', () => {
    // Türkçe'de: c < ç, g < ğ, i < ı? HAYIR — ı < i. o < ö, s < ş, u < ü
    expect(compareTr('cam', 'çam')).toBeLessThan(0)
    expect(compareTr('gol', 'göl')).toBeLessThan(0)
    expect(compareTr('sac', 'saç')).toBeLessThan(0)
    expect(compareTr('un', 'ün')).toBeLessThan(0)
    // Kritik: ı, i'den ÖNCE gelir. İngilizce sıralamada tam tersi olurdu.
    expect(compareTr('ısı', 'iyi')).toBeLessThan(0)
  })
})

describe('sortTr', () => {
  it('Ç/Ö/Ş/Ü/İ ile başlayanları Z sonrasına atmaz', () => {
    // ADR-020'nin gerekçesi: `ORDER BY full_name` yazılsaydı bu adlar listenin
    // en altına düşerdi ve kullanıcı "program bozuk" derdi.
    const sirali = sortTr(['Zeynep', 'Çınar', 'Öztürk', 'Ahmet', 'Şahin', 'Ünal', 'İrem'])
    expect(sirali).toEqual(['Ahmet', 'Çınar', 'İrem', 'Öztürk', 'Şahin', 'Ünal', 'Zeynep'])
  })

  it('girdiyi değiştirmez', () => {
    const girdi = ['Zeynep', 'Ahmet']
    const cikti = sortTr(girdi)
    expect(girdi).toEqual(['Zeynep', 'Ahmet'])
    expect(cikti).not.toBe(girdi)
  })
})

describe('sortTrBy', () => {
  it('seed içindeki gerçek öğrenci adlarını doğru sıralar', () => {
    // İrem ve Işıl bilerek seed'de: Türkçe sıralamanın sınandığı asıl çift.
    const ogrenciler = [
      { id: 10, full_name: 'Işıl Korkmaz' },
      { id: 9, full_name: 'İrem Aydın' },
      { id: 5, full_name: 'Ahmet Şahin' },
      { id: 7, full_name: 'Mustafa Çelik' },
      { id: 11, full_name: 'Burak Çınar' },
    ]
    expect(sortTrBy(ogrenciler, (o) => o.full_name).map((o) => o.full_name)).toEqual([
      'Ahmet Şahin',
      'Burak Çınar',
      'Işıl Korkmaz', // ı, i'den önce
      'İrem Aydın',
      'Mustafa Çelik',
    ])
  })

  it('girdiyi değiştirmez', () => {
    const girdi = [{ ad: 'Zeynep' }, { ad: 'Ahmet' }]
    const cikti = sortTrBy(girdi, (x) => x.ad)
    expect(girdi[0]!.ad).toBe('Zeynep')
    expect(cikti).not.toBe(girdi)
  })
})
