/**
 * Sayfalama — **her liste ekranının ortak parçası** (ADR-025).
 *
 * ## Neden arayüzde, Rust'ta değil
 *
 * ADR-020 Türkçe metin kolonlarında SQL `ORDER BY` yasaklıyor: SQLite'ta
 * `localeCompare('tr')` karşılığı yok. Buradan doğrudan çıkan sonuç şu: **sıralanmamış
 * bir listeyi sayfalamak yanlış sayfa üretir.** `LIMIT/OFFSET`'i Rust'a koymak,
 * kullanıcının 2. sayfada göreceği isimlerin ekrandaki sıralamayla hiçbir ilgisi
 * olmaması demekti. İkisi aynı katmanda durmak zorunda ve o katman arayüz.
 *
 * ## Neden `lib/` altında
 *
 * Faz 4'te `pages/ogrenciler/filters.ts` içindeydi. Faz 5A ikinci liste ekranını
 * (Gruplar) getirince aynı fonksiyonun ikinci kopyası doğacaktı; ADR-025 kuralı bütün
 * liste ekranları için bağlayıcı olduğuna göre parçası da ortak yerde durmalı.
 * **Çipler ve sıralama modülde kalıyor** — onlar ekranın kendi verisine bağlı.
 */

export const PAGE_SIZE = 20

export interface Page<T> {
  rows: T[]
  /** 1-tabanlı ve daima geçerli: liste kısalınca son sayfaya kayar. */
  page: number
  pageCount: number
  total: number
}

/**
 * `page` aralık dışındaysa **düzeltilir**, hata verilmez: kullanıcı 5. sayfadayken
 * filtre daraltırsa boş bir ekranla değil son sayfayla karşılaşır.
 */
export function paginate<T>(rows: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)
  const start = (safePage - 1) * size

  return {
    rows: rows.slice(start, start + size),
    page: safePage,
    pageCount,
    total: rows.length,
  }
}
