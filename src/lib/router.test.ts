import { describe, expect, it } from 'vitest'
import { matchRoute, normalizePath, parseHash, resolveRoute } from './router'

/**
 * ADR-023: yönlendirme kütüphanesi yerine bu dosya. Bedeli, desen eşleştirmesinin
 * testinin bize düşmesi — kütüphanenin bedava verdiği güvence burada satın alınıyor.
 */

describe('normalizePath', () => {
  it('baştaki eğik çizgiyi garanti eder, sondakini atar', () => {
    expect(normalizePath('')).toBe('/')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('ogrenciler')).toBe('/ogrenciler')
    expect(normalizePath('/ogrenciler/')).toBe('/ogrenciler')
    expect(normalizePath('//ogrenciler//42//')).toBe('/ogrenciler/42')
  })
})

describe('parseHash', () => {
  it('hash yolunu ve sorgusunu ayırır', () => {
    expect(parseHash('#/ogrenciler')).toEqual({ path: '/ogrenciler', query: '' })
    expect(parseHash('#/ogrenciler/42')).toEqual({ path: '/ogrenciler/42', query: '' })
    expect(parseHash('#/ogrenciler?filtre=borclu')).toEqual({
      path: '/ogrenciler',
      query: 'filtre=borclu',
    })
  })

  it('boş hash açılış sayfasıdır', () => {
    // Uygulama ilk açıldığında hash boştur; Bugün ekranı gelmeli.
    expect(parseHash('').path).toBe('/')
    expect(parseHash('#').path).toBe('/')
    expect(parseHash('#/').path).toBe('/')
  })
})

describe('matchRoute', () => {
  it('sabit yolu eşleştirir', () => {
    expect(matchRoute('/ogrenciler', '/ogrenciler')).toEqual({})
    expect(matchRoute('/ogrenciler', '/gruplar')).toBeNull()
    // Segment sayısı farklıysa eşleşmez.
    expect(matchRoute('/ogrenciler', '/ogrenciler/42')).toBeNull()
    expect(matchRoute('/ogrenciler/42', '/ogrenciler')).toBeNull()
  })

  it('parametreyi çıkarır', () => {
    expect(matchRoute('/ogrenciler/:id', '/ogrenciler/42')).toEqual({ id: '42' })
    expect(matchRoute('/gruplar/:id/ogrenciler', '/gruplar/7/ogrenciler')).toEqual({ id: '7' })
    expect(matchRoute('/ogrenciler/:id/ders/:sessionId', '/ogrenciler/42/ders/9')).toEqual({
      id: '42',
      sessionId: '9',
    })
  })

  it('boş parametreyi reddeder', () => {
    // '/ogrenciler/' eşleşseydi detay ekranı id = '' ile açılıp "kayıt yok" derdi.
    expect(matchRoute('/ogrenciler/:id', '/ogrenciler/')).toBeNull()
    expect(matchRoute('/ogrenciler/:id', '/ogrenciler')).toBeNull()
  })

  it('yüzde kodlamasını çözer — Türkçe ad taşıyan yollar için', () => {
    expect(matchRoute('/tanimlar/:key', '/tanimlar/bran%C5%9Flar')).toEqual({ key: 'branşlar' })
  })

  it('sondaki eğik çizgi ve baştaki eksiklik eşleşmeyi bozmaz', () => {
    expect(matchRoute('ogrenciler', '/ogrenciler/')).toEqual({})
    expect(matchRoute('/ogrenciler/', 'ogrenciler')).toEqual({})
  })
})

describe('resolveRoute', () => {
  // Sıra bağlayıcı: sabit yol parametreli yoldan ÖNCE.
  const routes = [
    { path: '/', name: 'bugun' },
    { path: '/ogrenciler', name: 'liste' },
    { path: '/ogrenciler/yeni', name: 'yeni' },
    { path: '/ogrenciler/:id', name: 'detay' },
  ] as const

  it('ilk eşleşen rotayı döner', () => {
    expect(resolveRoute(routes, '/')?.route.name).toBe('bugun')
    expect(resolveRoute(routes, '/ogrenciler')?.route.name).toBe('liste')
    expect(resolveRoute(routes, '/ogrenciler/42')?.route.name).toBe('detay')
    expect(resolveRoute(routes, '/ogrenciler/42')?.params).toEqual({ id: '42' })
  })

  it('sabit yol parametreli yolu yener', () => {
    // Sıra ters olsa '/ogrenciler/yeni' adresi id = 'yeni' olan bir öğrenci arardı.
    expect(resolveRoute(routes, '/ogrenciler/yeni')?.route.name).toBe('yeni')
    expect(resolveRoute(routes, '/ogrenciler/yeni')?.params).toEqual({})
  })

  it('bilinmeyen yolda null döner — çağıran 404 gösterir', () => {
    expect(resolveRoute(routes, '/bilinmeyen')).toBeNull()
    expect(resolveRoute(routes, '/ogrenciler/42/ders')).toBeNull()
  })
})
