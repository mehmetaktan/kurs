/**
 * Kimlik mühürlerinin TypeScript ayağı (ADR-024). Rust ayağı `src-tauri/tests/identity.rs`.
 *
 * Dosyalar `?raw` / JSON import'uyla okunuyor, `node:fs` ile değil: `@types/node` bu
 * projede kurulu değil ve tek bir test için dördüncü bir tip paketi taşımak istemiyoruz
 * (aynı gerekçe `@testing-library/jest-dom` için de verilmişti).
 */
import { describe, expect, it } from 'vitest'
import { APP_VERSION, institution } from './brand'
import { tr } from '../i18n/tr'
import trSource from '../i18n/tr.ts?raw'
import pkg from '../../package.json'
import tauriConf from '../../src-tauri/tauri.conf.json'

describe('kurum kimliği (config/kurum.json)', () => {
  it('kurum adı doludur — boş bırakılırsa kenar çubuğunda ve makbuzda boşluk kalır', () => {
    expect(institution.name.trim()).not.toBe('')
  })

  it('makbuz alanları tanımlıdır; boş olmaları serbest — boşsa makbuza basılmaz', () => {
    expect(typeof institution.receipt.address).toBe('string')
    expect(typeof institution.receipt.phone).toBe('string')
  })

  /**
   * `tr.ts` ürün metinlerinin envanteri; kurum adı orada durmaz. İki yerde duran bir
   * değer er geç ikiye ayrılıyor — Faz 3 sonunda `tr.app.institution` ile
   * `setting.institution_name` tam olarak bu durumdaydı.
   */
  it('kurum adı tr.ts içinde geçmez', () => {
    expect(trSource).not.toContain(institution.name)
  })
})

describe('ürün kimliği — Aktansoft’un, sabit', () => {
  it('kenar çubuğunun 1. satırı ürün adıdır', () => {
    expect(tr.app.brand).toBe('Kurs Takip')
    expect(tr.app.name).toBe('Kurs Takip')
  })

  it('ürün adı kurum adından bağımsızdır', () => {
    expect(tr.app.brand).not.toBe(institution.name)
  })
})

describe('sürüm numarası tek kaynaktan gelir', () => {
  it('APP_VERSION package.json ile aynı', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('tauri.conf.json sürümü doğrudan package.json yolundan okur', () => {
    expect(tauriConf.version).toBe('../package.json')
  })

  /** Sürüm numarası metinlerin arasında elle yazılmaz — kayar ve kimse fark etmez. */
  it('tr.ts içinde elle yazılmış sürüm numarası yok', () => {
    expect(trSource).not.toMatch(/Sürüm\s+\d/)
  })
})

describe('uygulama kimliği', () => {
  it('kurum adı taşımaz — %APPDATA% klasörü müşteri adıyla anılmaz', () => {
    expect(tauriConf.identifier).toBe('com.aktansoft.kurstakip')
  })

  it('yayıncı Aktansoft', () => {
    expect(tauriConf.bundle.publisher).toBe('Aktansoft')
  })
})
