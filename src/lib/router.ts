/**
 * Hash tabanlı yönlendirme (ADR-023).
 *
 * Neden hash: uygulama `tauri://localhost` üzerinden servis ediliyor ve tek bir
 * `index.html` var. History API kullanılsaydı `/ogrenciler/42` adresine yenileme yapıldığında
 * WebView2 o yolda dosya arar ve boş sayfa açar. Hash'te böyle bir sınıf yok; geri/ileri
 * tuşları da çalışmaya devam eder.
 *
 * Neden kütüphane değil: 7 üst düzey sayfa ve birkaç detay rotası için desen eşleştirmesi
 * bu kadar. Aynı gerekçeyle ikon kütüphanesi de kurulmadı (TASARIM-SISTEMI §5).
 */
import { useCallback, useEffect, useState } from 'react'

/** Rotadan çıkan parametreler — hepsi metin, dönüşüm çağıranın işi. */
export type RouteParams = Readonly<Record<string, string>>

export interface Route {
  /** Normalleştirilmiş yol: daima `/` ile başlar, sonda `/` bulunmaz. */
  path: string
  /** Hash'in `?` sonrası kısmı. Faz 3'te kullanılmıyor, filtre kalıcılığı için var. */
  query: string
}

/**
 * `'#/ogrenciler/42?filtre=borclu'` → `{ path: '/ogrenciler/42', query: 'filtre=borclu' }`.
 * Boş hash açılış sayfasıdır.
 */
export function parseHash(hash: string): Route {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  const queryAt = withoutHash.indexOf('?')
  const rawPath = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt)
  const query = queryAt === -1 ? '' : withoutHash.slice(queryAt + 1)

  return { path: normalizePath(rawPath), query }
}

/** Baştaki `/`'ı garanti eder, sondakini atar, çift `/`'ı teke indirir. */
export function normalizePath(path: string): string {
  const collapsed = `/${path}`.replace(/\/+/g, '/')
  if (collapsed.length > 1 && collapsed.endsWith('/')) return collapsed.slice(0, -1)
  return collapsed
}

/**
 * Deseni yola uydurur. Uymuyorsa `null`, uyuyorsa parametreler (parametresiz desende
 * boş nesne — `null` ile karışmasın diye `{}` dönüyor, `if (params)` çalışsın).
 *
 *   matchRoute('/ogrenciler/:id', '/ogrenciler/42')  → { id: '42' }
 *   matchRoute('/ogrenciler', '/ogrenciler/42')      → null
 *
 * Parametre değeri boş olamaz: `/ogrenciler/` deseni `/ogrenciler/:id` ile eşleşmez,
 * yoksa detay ekranı `id = ''` ile açılıp "kayıt bulunamadı" derdi.
 */
export function matchRoute(pattern: string, path: string): RouteParams | null {
  const patternParts = splitPath(normalizePath(pattern))
  const pathParts = splitPath(normalizePath(path))
  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (const [index, patternPart] of patternParts.entries()) {
    const pathPart = pathParts[index] ?? ''
    if (patternPart.startsWith(':')) {
      if (pathPart === '') return null
      params[patternPart.slice(1)] = decodeURIComponent(pathPart)
    } else if (patternPart !== pathPart) {
      return null
    }
  }
  return params
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/** Yol değiştirir. Aynı yola gidiliyorsa geçmişe yeni kayıt eklemez. */
export function navigate(path: string): void {
  const target = `#${normalizePath(path)}`
  if (window.location.hash === target) return
  window.location.hash = target
}

/** Yolu geçmişe kayıt eklemeden değiştirir (filtre/sekme durumu için). */
export function replace(path: string): void {
  const target = `#${normalizePath(path)}`
  window.history.replaceState(null, '', target)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/**
 * Geçerli rota. `hashchange` olayını dinler — kenar çubuğundaki bağlantılar gerçek
 * `<a href="#/...">` olduğu için tıklama, orta tuşla açma ve klavye hepsi kendiliğinden
 * çalışır; burada `preventDefault` yapan bir şey yok.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    // Kayıt ile ilk okuma arasında hash değişmiş olabilir.
    onChange()
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** `navigate`'in kararlı referanslı hâli — efekt bağımlılığı olarak kullanılabilir. */
export function useNavigate(): (path: string) => void {
  return useCallback((path: string) => navigate(path), [])
}

/**
 * Rota tablosundan ilk eşleşeni bulur. Sıra bağlayıcı: sabit yollar parametreli
 * yollardan ÖNCE yazılır, yoksa `/ogrenciler/yeni` adresi `:id = 'yeni'` olarak eşleşir.
 */
export function resolveRoute<T extends { path: string }>(
  routes: readonly T[],
  path: string,
): { route: T; params: RouteParams } | null {
  for (const route of routes) {
    const params = matchRoute(route.path, path)
    if (params) return { route, params }
  }
  return null
}
