/**
 * Türkçe biçimleme — para, tarih, saat, telefon, arama normalleştirmesi.
 *
 * ## Rust ile parite
 *
 * Bu dosyadaki bazı fonksiyonların Rust tarafında birebir karşılığı var. İkisi ayrışırsa
 * kullanıcı iki farklı sayı/sonuç görür — Faz 2 denetimi tam bunu yakaladı (`parseKurus`
 * `'1.2,3.4'` girdisini sessizce `1234` yaparken Rust reddediyordu).
 *
 * | Buradaki | Rust karşılığı | Ortak test vektörleri |
 * |---|---|---|
 * | `formatKurus` / `parseKurus` | `money::format_kurus` / `parse_kurus` | `format.test.ts` + `money.rs` |
 * | `phoneDigits` | `text::phone_digits` | `format.test.ts` + `text.rs` |
 * | `normalizeTr` | `text::search_name` | `format.test.ts` + `text.rs` |
 *
 * **Bu dosyaya dokunan her değişiklikte Rust karşılığı ve bozuk girdi listesi birlikte
 * güncellenir.** Tarih/saat biçimleyicisinin henüz Rust karşılığı YOK; Faz 8 makbuz için
 * bir tane yazınca vektörleri buradaki testlerden alıp iki tarafa da koyar.
 */
import { tr } from '../i18n/tr'

/**
 * Kuruş → Türkçe para metni (ADR-003).
 * Binlik ayıracı '.', ondalık ',' ve eksi işareti U+2212 (ASCII tire değil, ADR-014).
 *
 *   123456  → "1.234,56"
 *  -123456  → "−1.234,56"
 *
 * Rust tarafındaki `money::format_kurus` ile aynı davranışı üretir; ikisinin de testi var.
 */
export function formatKurus(kurus: number): string {
  if (!Number.isInteger(kurus)) {
    throw new Error(`formatKurus tam sayı bekler, geldi: ${kurus}`)
  }
  const negative = kurus < 0
  const abs = Math.abs(kurus)
  const lira = Math.trunc(abs / 100)
  const cents = abs % 100

  const liraText = lira.toLocaleString('tr-TR')
  const centsText = String(cents).padStart(2, '0')
  const body = `${liraText},${centsText}`

  return negative ? `${tr.units.minus}${body}` : body
}

/** Kuruş → "1.234,56 ₺" */
export function formatLira(kurus: number): string {
  return formatKurus(kurus) + tr.units.currencySuffix
}

/**
 * Türkçe para metni → kuruş. Hem '−' (U+2212) hem '-' kabul edilir.
 * Ayrıştırılamayan girdi `null` döner — çağıran tarafta Türkçe hata gösterilir.
 */
export function parseKurus(input: string): number | null {
  const raw = input.replace(/\s|₺/g, '')
  if (raw === '') return null

  const negative = raw.startsWith('−') || raw.startsWith('-')
  const rest = negative ? raw.slice(1) : raw

  // Rust'taki `money::parse_kurus` ile AYNI sırada çalışır: önce virgülden bölünür,
  // nokta YALNIZCA lira tarafından atılır. Tüm noktaları baştan atmak, virgülden
  // sonra gelen bir noktayı da yutar ve "1.2,3.4" gibi bozuk girdiyi sessizce
  // 1234'e çevirirdi — Rust ise onu reddediyor. İki taraf ayrışırsa kuruş kaybolur.
  const comma = rest.indexOf(',')
  const liraPart = comma === -1 ? rest : rest.slice(0, comma)
  const centsPart = comma === -1 ? '' : rest.slice(comma + 1)

  const liraDigits = liraPart.replace(/\./g, '')
  if (liraDigits === '' || !/^\d+$/.test(liraDigits)) return null
  if (centsPart.length > 2 || (centsPart !== '' && !/^\d+$/.test(centsPart))) return null

  // "1,5" → 50 kuruş, "1,50" → 50 kuruş. Tek basamak onda birdir.
  const cents =
    centsPart.length === 0 ? 0 : centsPart.length === 1 ? Number(centsPart) * 10 : Number(centsPart)

  const value = Number(liraDigits) * 100 + cents
  if (!Number.isSafeInteger(value)) return null
  return negative ? -value : value
}

// ─── Tarih ────────────────────────────────────────────────────────────────────
//
// Veritabanında tarih daima `'YYYY-MM-DD'`, damga `'YYYY-MM-DD HH:MM'` — yerel duvar
// saati metni olarak (ADR-017). Ekranda `25.07.2026` ve `14:30`. Dönüşüm burada; `Date`
// nesnesi yalnızca takvimsel doğrulama ve gün adı için, hiçbir yerde saat dilimi
// çevirmesi yapılmadan kullanılır.

/** Ayrıştırılmış tarih parçaları — hepsi sayı, ay 1-tabanlı. */
interface DateParts {
  year: number
  month: number
  day: number
}

/** `'YYYY-MM-DD'` (ya da `'YYYY-MM-DD HH:MM'`) → parçalar. Takvimsel olarak doğrular. */
function parseIso(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(value)
  if (!match) return null
  return validParts(Number(match[1]), Number(match[2]), Number(match[3]))
}

/**
 * Takvimsel doğrulama: `31.02.2026` ya da `31.04.2026` reddedilir.
 * `Date.UTC` kullanılıyor — yerel saat dilimi kullanılsaydı DST geçiş gününde gün kayardı.
 */
function validParts(year: number, month: number, day: number): DateParts | null {
  if (year < 1900 || year > 2999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * `'2026-07-25'` → `'25.07.2026'`. Ayrıştırılamayan/boş girdi boş değer tiresi döner —
 * bozuk tek bir satır yüzünden ekran çökmez.
 */
export function formatDate(iso: string | null | undefined): string {
  const parts = iso ? parseIso(iso) : null
  if (!parts) return tr.units.emptyValue
  return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`
}

/** `'2026-07-25'` → `'25 Temmuz 2026'`. */
export function formatDateLong(iso: string | null | undefined): string {
  const parts = iso ? parseIso(iso) : null
  if (!parts) return tr.units.emptyValue
  return `${parts.day} ${monthNameTr(parts.month)} ${parts.year}`
}

/** `'2026-07-25'` → `'25.07.2026 · Cumartesi'` (Bugün ekranının başlığı). */
export function formatDateWithWeekday(iso: string | null | undefined): string {
  const day = weekdayTr(iso)
  if (day === tr.units.emptyValue) return tr.units.emptyValue
  return `${formatDate(iso)}${tr.units.separator}${day}`
}

/** `'2026-07-25'` → `'Cumartesi'`. */
export function weekdayTr(iso: string | null | undefined): string {
  const parts = iso ? parseIso(iso) : null
  if (!parts) return tr.units.emptyValue
  const index = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  return tr.calendar.weekdays[index] ?? tr.units.emptyValue
}

/** Ay adı, 1-tabanlı ay numarasından. */
export function monthNameTr(month: number): string {
  return tr.calendar.months[month - 1] ?? tr.units.emptyValue
}

/**
 * Kullanıcının yazdığı tarih → `'YYYY-MM-DD'`. Ayrıştırılamazsa `null`.
 *
 * `25.07.2026` · `25/07/2026` · `25-07-2026` · `25072026` kabul edilir; iki haneli yıl
 * kabul EDİLMEZ (1926 mı 2026 mı belli değil). Yerel `<input type="date">` kullanmama
 * kararının bedeli bu fonksiyon: Windows'un dil ayarı gün/ay sırasını değiştiremez.
 */
export function parseDateTr(input: string): string | null {
  const raw = input.trim()
  if (raw === '') return null

  const separated = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(raw)
  const bare = /^(\d{2})(\d{2})(\d{4})$/.exec(raw)
  const match = separated ?? bare
  if (!match) return null

  const parts = validParts(Number(match[3]), Number(match[2]), Number(match[1]))
  if (!parts) return null
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

/** `'YYYY-MM-DD'` → `Date` (UTC gece yarısı). Ay ızgarası hesapları için. */
export function isoToDate(iso: string): Date | null {
  const parts = parseIso(iso)
  if (!parts) return null
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

/** `Date` (UTC) → `'YYYY-MM-DD'`. `isoToDate`'in tersi. */
export function dateToIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

// ─── Saat ─────────────────────────────────────────────────────────────────────

/**
 * `'14:30'` ya da `'2026-07-25 14:30'` → `'14:30'`. Ayrıştırılamazsa boş değer tiresi.
 * Seans tablosunda saat tam damganın içinde duruyor (`session.starts_at`), o yüzden
 * ikisini de kabul ediyor.
 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return tr.units.emptyValue
  const match = /(?:^|[ T])(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) return tr.units.emptyValue
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return tr.units.emptyValue
  return `${pad2(hour)}:${pad2(minute)}`
}

/**
 * Kullanıcının yazdığı saat → `'HH:MM'`. Ayrıştırılamazsa `null`.
 * `14:30` · `14.30` · `1430` · `930` (→ `09:30`) kabul; aralık dışı reddedilir.
 */
export function parseTimeTr(input: string): string | null {
  const raw = input.trim().replace(/\s/g, '')
  if (raw === '') return null

  const separated = /^(\d{1,2})[.:](\d{2})$/.exec(raw)
  const bare = /^(\d{1,2})(\d{2})$/.exec(raw)
  const match = separated ?? bare
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${pad2(hour)}:${pad2(minute)}`
}

/** `'14:30'` → 870 (gün başından beri geçen dakika). Takvim yerleşimi için. */
export function timeToMinutes(value: string): number | null {
  const time = parseTimeTr(value)
  if (!time) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

/** 870 → `'14:30'`. `timeToMinutes`'ın tersi. */
export function minutesToTime(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return null
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

// ─── Telefon ──────────────────────────────────────────────────────────────────

/**
 * Telefonun yalnızca ASCII rakamları. **Rust `text::phone_digits` ile aynı davranış** —
 * `phone_digits` sütununa yazılan değer orada üretiliyor, arama kutusu buradan geçiyor;
 * ikisi ayrışırsa kullanıcı kendi kaydettiği numarayı bulamaz.
 */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * `'05321112233'` → `'0 532 111 22 33'` biçiminde okunur telefon (`0 5XX XXX XX XX`).
 *
 * `+90` ile başlayan ve başındaki sıfırı eksik girilmiş numaralar da aynı biçime çekilir.
 * Tanımadığı bir uzunluk gelirse girdi olduğu gibi döner — mangling yapmaz, çünkü veli
 * telefonu yanlış gösterilirse kullanıcı yanlış numarayı arar.
 */
export function formatPhone(input: string | null | undefined): string {
  if (!input) return tr.units.emptyValue
  let digits = phoneDigits(input)

  // +90 5xx xxx xx xx → 0 5xx …
  if (digits.length === 12 && digits.startsWith('90')) digits = `0${digits.slice(2)}`
  // 5xx xxx xx xx (baştaki sıfır yazılmamış)
  if (digits.length === 10 && digits.startsWith('5')) digits = `0${digits}`

  if (digits.length !== 11 || !digits.startsWith('0')) return input

  const [operator, first, second, third] = [
    digits.slice(1, 4),
    digits.slice(4, 7),
    digits.slice(7, 9),
    digits.slice(9, 11),
  ]
  return `0 ${operator} ${first} ${second} ${third}`
}

// ─── Telefon maskesi ──────────────────────────────────────────────────────────
//
// `formatPhone` GÖSTERİM içindir (`0 532 111 22 33`); buradakiler **girdi alanı**
// içindir ve formun kendi yazımını kurar: `0532 111 22 33` — placeholder ve hata
// mesajının örneği de bu (`tr.students.form.phonePlaceholder`).
//
// Maske görsel, veri değil: kaydedilen değer kullanıcının gördüğü metindir,
// `phone_digits` normalleştirmesini Rust yapar (`text::phone_digits`).

/** Gruplama baştaki sıfıra bakar: `0532 111 22 33` · `532 111 22 33`. */
function phoneGroups(digits: string): number[] {
  return digits.startsWith('0') ? [4, 3, 2, 2] : [3, 3, 2, 2]
}

/**
 * Uluslararası yazımı ulusal yazıma indirger: `+90 532…` ve `0090 532…` → `0532…`.
 *
 * Önek yalnızca numara O UZUNLUĞA ULAŞINCA atılır (12 ve 14 hane): yazarken araya
 * girip kullanıcının o an yazdığı rakamı gözünün önünde silmesin diye. Baştaki `0`
 * ZORLA eklenmiyor — eklenseydi kullanıcı onu bir daha silemezdi ve alan kilitlenirdi;
 * `532 111 22 33` zaten geçerli bir yazım (doğrulama 10–13 hane kabul ediyor).
 */
function nationalPhoneDigits(digits: string): string {
  if (digits.length >= 14 && digits.startsWith('0090')) return `0${digits.slice(4)}`
  if (digits.length >= 12 && digits.startsWith('90')) return `0${digits.slice(2)}`
  return digits
}

/**
 * Telefon girdisinin maskesi. **İdempotent**: kendi çıktısına uygulanınca aynı metni
 * verir, o yüzden her render'da güvenle çağrılabilir.
 */
export function maskPhone(input: string): string {
  const digits = nationalPhoneDigits(phoneDigits(input))

  const parts: string[] = []
  let index = 0
  for (const size of phoneGroups(digits)) {
    if (index >= digits.length) break
    parts.push(digits.slice(index, index + size))
    index += size
  }

  // 11 haneyi aşan girdi KIRPILMAZ, artanı sona eklenir: sessizce rakam yutmak,
  // yanlış bir numarayı doğru göstermek demekti. Uzunluğu doğrulama söylüyor
  // (10–13 hane, `errors.phoneInvalid`).
  if (index < digits.length) parts.push(digits.slice(index))

  return parts.join(' ')
}

export interface PhoneEdit {
  value: string
  caret: number
}

/** `count` rakamdan hemen sonraki konum. */
function caretAfterDigits(value: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ' ') {
      seen += 1
      if (seen === count) return index + 1
    }
  }
  return value.length
}

/**
 * Yazma / yapıştırma sonrası maskeyi kurar ve imleci **aynı rakamın ardında** bırakır.
 * Ortadan düzenlerken imlecin sona atlaması bu yüzden olmuyor: konum karakterle değil
 * rakam sayısıyla taşınıyor.
 */
export function editPhone(raw: string, caret: number): PhoneEdit {
  const before = phoneDigits(raw.slice(0, caret)).length
  const rawDigits = phoneDigits(raw)
  // İmlecin ÖNÜNDEKİ rakam sayısını değiştiren tek işlem ülke kodunun atılması;
  // uzunluk kırpması olmadığı için başka kayma yok.
  const shift = nationalPhoneDigits(rawDigits).length - rawDigits.length

  const value = maskPhone(raw)
  return { value, caret: caretAfterDigits(value, Math.max(0, before + shift)) }
}

/**
 * Backspace: imleçten geriye doğru ilk **rakam** silinir.
 *
 * Ayıracı silmek maskeyi değiştirmiyor — maske boşluğu hemen geri koyuyor — ve
 * kullanıcıya hiçbir şey olmamış gibi görünüyordu; silmek için tuşa iki kez basmak
 * gerekirdi.
 */
export function backspacePhone(value: string, caret: number): PhoneEdit {
  let index = Math.min(Math.max(caret, 0), value.length) - 1
  while (index >= 0 && value[index] === ' ') index -= 1
  if (index < 0) return { value: maskPhone(value), caret: 0 }
  return editPhone(value.slice(0, index) + value.slice(index + 1), index)
}

// ─── Arama normalleştirmesi ───────────────────────────────────────────────────

/**
 * Türkçe küçültme + boşluk sıkıştırma. **Rust `text::search_name` ile aynı davranış.**
 *
 * `search_name` sütunlarını Rust yazıyor; yüklenmiş bir listeyi tarayıcı tarafında
 * süzerken (Öğrenciler ekranının filtresi) aynı normalleştirme gerekiyor. İki taraf
 * ayrışırsa `İngilizce` yazan kullanıcı `ingilizce` kaydını bulamaz.
 *
 * `toLocaleLowerCase('tr')` tek başına yetmiyor: WebView2'de ICU verisi eksik kurulmuş
 * bir Windows'ta `'I'` → `'i'` döner (Türkçe'de `'ı'` olmalı). Noktalı/noktasız i çifti
 * bu yüzden elle ele alınıyor — Rust tarafındaki gerekçenin aynısı.
 */
export function normalizeTr(input: string): string {
  let lowered = ''
  for (const ch of input) {
    if (ch === 'I') lowered += 'ı'
    else if (ch === 'İ') lowered += 'i'
    else lowered += ch.toLocaleLowerCase('tr')
  }
  return lowered.split(/\s+/).filter(Boolean).join(' ')
}

/**
 * Serbest metin araması: ad Türkçe normalleştirmeyle, telefon rakam rakam eşleşir.
 * Tasarımdaki `Öğrenciler` ekranının davranışı (`norm(name).includes(q) || digits`).
 */
export function matchesQuery(query: string, name: string, phone?: string | null): boolean {
  const needle = normalizeTr(query)
  if (needle === '') return true
  if (normalizeTr(name).includes(needle)) return true

  const digits = phoneDigits(query)
  return digits !== '' && phoneDigits(phone ?? '').includes(digits)
}
