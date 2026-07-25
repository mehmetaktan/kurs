/**
 * Üretim derlemesinde geliştirici sayfalarının BULUNMADIĞINI doğrular.
 *
 * `/dev/komponentler` ve `/dev/durum` yalnızca `import.meta.env.DEV` dalında `lazy()`
 * ile yükleniyor (`src/App.tsx`). Üretimde bu dal ölü koda dönüşüyor ve Rollup ilgili
 * chunk'ı hiç üretmiyor. Ama bu garanti kırılgandır: showcase'i bir yerde **statik**
 * `import` etmek ya da koşulu kaldırmak yeter — ve kimse fark etmez, çünkü uygulama
 * çalışmaya devam eder, sadece kurs sahibine gönderilen paketin içinde bir geliştirici
 * sayfası taşınır.
 *
 * O yüzden `npm run check` bu betiği koşuyor: garantiyi gözle değil, kapıyla koruyoruz.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST_ASSETS = 'dist/assets'

/** Showcase / durum sayfasına özgü, başka hiçbir yerde geçmeyen işaretçiler. */
const FORBIDDEN = [
  'Komponentler', // showcase başlığı
  'komponentler', // /dev/komponentler rotası
  'showcaseTr', // showcase sözlüğü
  'Bildirim göster', // yalnızca showcase'te olan etiket
  'drawerRow', // yalnızca Showcase.module.css'te olan sınıf
]

/** Kabuğun gerçekten paketlendiğinin kontrolü — boş bir dist'e bakıp "temiz" demeyelim. */
const REQUIRED = ['Raporlar', 'İçeriğe geç']

let files
try {
  files = readdirSync(DIST_ASSETS)
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map((name) => ({ name, text: readFileSync(join(DIST_ASSETS, name), 'utf8') }))
} catch {
  console.error(`HATA: ${DIST_ASSETS} okunamadı. Önce "npm run web:build" çalıştırın.`)
  process.exit(1)
}

if (files.length === 0) {
  console.error(`HATA: ${DIST_ASSETS} içinde js/css yok — kontrol boşa çalışacaktı.`)
  process.exit(1)
}

const problems = []

for (const needle of FORBIDDEN) {
  const found = files.filter((file) => file.text.includes(needle)).map((file) => file.name)
  if (found.length > 0) {
    problems.push(`Geliştirici sayfası üretim paketinde: "${needle}" → ${found.join(', ')}`)
  }
}

for (const needle of REQUIRED) {
  if (!files.some((file) => file.text.includes(needle))) {
    problems.push(`Beklenen kabuk metni pakette YOK: "${needle}" — kontrol yanlış yere bakıyor`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`HATA: ${problem}`)
  process.exit(1)
}

console.log(
  `Üretim paketi temiz: ${files.length} dosya denetlendi, ` +
    `${FORBIDDEN.length} geliştirici işaretçisinin hiçbiri yok.`,
)
