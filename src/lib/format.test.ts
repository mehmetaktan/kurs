import { describe, expect, it } from 'vitest'
import {
  backspacePhone,
  dateToIso,
  editPhone,
  formatDate,
  formatDateLong,
  formatDateWithWeekday,
  formatKurus,
  formatLira,
  formatPhone,
  formatTime,
  isoToDate,
  maskPhone,
  matchesQuery,
  minutesToTime,
  monthNameTr,
  normalizeTr,
  parseDateTr,
  parseKurus,
  parseTimeTr,
  phoneDigits,
  timeToMinutes,
  upperTr,
  weekdayTr,
} from './format'

/**
 * CLAUDE.md > Para: *"Para ile ilgili her fonksiyonun testi olur. Bu pazarlık konusu değil."*
 *
 * Bu dosya `src-tauri/src/money.rs`'teki testlerin ikizidir. İki taraf AYNI değerleri
 * üretmek zorunda: Rust tutarı biçimleyip arayüze gönderiyor, arayüz kullanıcının
 * yazdığını ayrıştırıp Rust'a geri veriyor. Biri kayarsa kuruş kaybolur.
 */

describe('formatKurus', () => {
  it('kuruşu Türkçe para metnine çevirir', () => {
    expect(formatKurus(0)).toBe('0,00')
    expect(formatKurus(5)).toBe('0,05')
    expect(formatKurus(50)).toBe('0,50')
    expect(formatKurus(100)).toBe('1,00')
    expect(formatKurus(25000)).toBe('250,00')
    expect(formatKurus(123456)).toBe('1.234,56')
    expect(formatKurus(100000000)).toBe('1.000.000,00')
  })

  it('negatifte U+2212 kullanır, ASCII tire değil (ADR-014)', () => {
    expect(formatKurus(-123456)).toBe('−1.234,56')
    expect(formatKurus(-120000)).toBe('−1.200,00')
    expect(formatKurus(-100).includes('-')).toBe(false)
    // Tasarımdaki `balance: -1200` → "−1.200,00 ₺"
    expect(formatLira(-120000)).toBe('−1.200,00 ₺')
  })

  it('tam sayı olmayan girdiyi reddeder — float yasak (ADR-003)', () => {
    expect(() => formatKurus(12.5)).toThrow()
  })
})

describe('parseKurus', () => {
  it('Türkçe para metnini kuruşa çevirir', () => {
    expect(parseKurus('1.234,56')).toBe(123456)
    expect(parseKurus('1234,56')).toBe(123456)
    expect(parseKurus('250')).toBe(25000)
    expect(parseKurus('250,5')).toBe(25050)
    expect(parseKurus('0,05')).toBe(5)
    expect(parseKurus(' 1.234,56 ₺ ')).toBe(123456)
  })

  it('her iki eksi işaretini de kabul eder', () => {
    expect(parseKurus('−1.200,00')).toBe(-120000)
    expect(parseKurus('-1.200,00')).toBe(-120000)
  })

  it('bozuk girdide null döner', () => {
    for (const bad of ['', 'abc', '12,345', ',', '1.2,3.4']) {
      expect(parseKurus(bad), `girdi: ${JSON.stringify(bad)}`).toBeNull()
    }
  })
})

describe('gidiş-dönüş', () => {
  it('formatKurus → parseKurus aynı değeri verir', () => {
    for (const value of [0, 1, 99, 100, 25000, 123456, -123456, 999999999]) {
      expect(parseKurus(formatKurus(value)), `değer: ${value}`).toBe(value)
    }
  })
})

describe('Rust karşılığıyla aynı çıktı', () => {
  // src-tauri/src/money.rs `bicimlendirme` ve `negatifte_u2212_kullanilir`
  // testlerindeki BİREBİR aynı beklentiler. İkisi ayrışırsa buradan görülür.
  const rustBeklentileri: Array<[number, string]> = [
    [0, '0,00'],
    [5, '0,05'],
    [50, '0,50'],
    [100, '1,00'],
    [25000, '250,00'],
    [123456, '1.234,56'],
    [100000000, '1.000.000,00'],
    [-123456, '−1.234,56'],
    [-120000, '−1.200,00'],
  ]

  it.each(rustBeklentileri)('formatKurus(%i) === %s', (kurus, beklenen) => {
    expect(formatKurus(kurus)).toBe(beklenen)
  })
})

describe('ICU bağımsızlığı — bu testin var olma sebebi Windows', () => {
  /**
   * Bu dosya Node'un TAM ICU'suyla koşuyor; kullanıcının WebView2'si koşmayabilir
   * (`tr.ts:801`, `format.ts > groupThousands`). Yani "vitest yeşil" tek başına
   * `Intl`'e bel bağlamadığımızın kanıtı DEĞİL — kanıt, ICU'yu bilerek bozup
   * çıktının değişmediğini görmek.
   *
   * ICU eksik bir motorda `Intl` patlamaz, sessizce başka bir yerele düşer: para
   * ayıraçları yer değiştirir (`1.234,56` → `1,234,56`) ve tutar başka bir sayı gibi
   * okunur. Aşağıdaki taklit tam olarak bunu yapıyor.
   */
  function icuBozukken<T>(govde: () => T): T {
    const numara = Number.prototype.toLocaleString
    const buyut = String.prototype.toLocaleUpperCase
    const kucult = String.prototype.toLocaleLowerCase
    Number.prototype.toLocaleString = function (this: number) {
      return `ICU-YOK-${this}`
    }
    String.prototype.toLocaleUpperCase = function (this: string) {
      return `ICU-YOK-${this}`
    }
    String.prototype.toLocaleLowerCase = function (this: string) {
      return `ICU-YOK-${this}`
    }
    try {
      return govde()
    } finally {
      Number.prototype.toLocaleString = numara
      String.prototype.toLocaleUpperCase = buyut
      String.prototype.toLocaleLowerCase = kucult
    }
  }

  it('formatKurus ICU olmadan da aynı metni üretir', () => {
    icuBozukken(() => {
      expect(formatKurus(123456)).toBe('1.234,56')
      expect(formatKurus(100000000)).toBe('1.000.000,00')
      expect(formatKurus(-120000)).toBe('−1.200,00')
      expect(formatKurus(999)).toBe('9,99')
    })
  })

  it('upperTr ICU olmadan da Türkçe büyütür', () => {
    icuBozukken(() => {
      expect(upperTr('irem')).toBe('İREM')
      expect(upperTr('ışık')).toBe('IŞIK')
    })
  })

  it('normalizeTr ICU olmadan da aynı arama anahtarını üretir', () => {
    icuBozukken(() => {
      expect(normalizeTr('İngilizce')).toBe('ingilizce')
      expect(normalizeTr('IŞIK  Yılmaz')).toBe('ışık yılmaz')
      expect(normalizeTr('ÇĞÖŞÜ')).toBe('çğöşü')
    })
  })

  it('taklit gerçekten ısırıyor — yoksa test boşa geçerdi', () => {
    // Kontrol grubu: aynı taklit altında `Intl`'e bel bağlayan bir çağrı BOZULUYOR.
    // Bu olmadan yukarıdaki iki test, taklit hiç çalışmasa da geçerdi.
    icuBozukken(() => {
      expect((1234).toLocaleString('tr-TR')).toBe('ICU-YOK-1234')
    })
  })
})

describe('upperTr — normalizeTr ile aynı i/ı disiplini', () => {
  const beklentiler: Array<[string, string]> = [
    ['irem', 'İREM'],
    ['İrem', 'İREM'],
    ['ışık', 'IŞIK'],
    ['Ilgaz', 'ILGAZ'],
    ['çğöşü', 'ÇĞÖŞÜ'],
    ['Ayşe Demir', 'AYŞE DEMİR'],
    ['', ''],
  ]

  it.each(beklentiler)('upperTr(%j) === %j', (girdi, beklenen) => {
    expect(upperTr(girdi)).toBe(beklenen)
  })

  it('normalizeTr ile gidiş-dönüş tutarlı', () => {
    // Büyütüp küçültmek adı başlangıç hâline döndürmeli — i/ı çifti burada kayardı.
    for (const ad of ['irem', 'ışık', 'ingilizce', 'ılgaz']) {
      expect(normalizeTr(upperTr(ad))).toBe(ad)
    }
  })
})

// ─── Tarih ────────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('ISO tarihi Türkçe biçime çevirir', () => {
    expect(formatDate('2026-07-25')).toBe('25.07.2026')
    expect(formatDate('2026-01-01')).toBe('01.01.2026')
    expect(formatDate('2026-12-31')).toBe('31.12.2026')
  })

  it('damganın içinden tarihi çıkarır', () => {
    // session.starts_at → 'YYYY-MM-DD HH:MM' (ADR-017)
    expect(formatDate('2026-07-25 16:00')).toBe('25.07.2026')
  })

  it('boş ve bozuk girdide tire döner — ekran çökmez', () => {
    for (const bad of [null, undefined, '', 'bugün', '25.07.2026', '2026-13-01', '2026-02-31']) {
      expect(formatDate(bad), `girdi: ${JSON.stringify(bad)}`).toBe('—')
    }
  })
})

describe('weekdayTr / formatDateLong / formatDateWithWeekday', () => {
  it('gün adını Türkçe döner', () => {
    // 2026 Temmuz: 25'i Cumartesi. Bir hafta boyunca sırayı çivile.
    expect(weekdayTr('2026-07-20')).toBe('Pazartesi')
    expect(weekdayTr('2026-07-21')).toBe('Salı')
    expect(weekdayTr('2026-07-22')).toBe('Çarşamba')
    expect(weekdayTr('2026-07-23')).toBe('Perşembe')
    expect(weekdayTr('2026-07-24')).toBe('Cuma')
    expect(weekdayTr('2026-07-25')).toBe('Cumartesi')
    expect(weekdayTr('2026-07-26')).toBe('Pazar')
  })

  it('uzun biçim ve başlık biçimi', () => {
    expect(formatDateLong('2026-07-25')).toBe('25 Temmuz 2026')
    expect(formatDateLong('2026-03-09')).toBe('9 Mart 2026')
    // Bugün ekranının başlığı (EKRANLAR.md §1)
    expect(formatDateWithWeekday('2026-07-24')).toBe('24.07.2026 · Cuma')
    expect(formatDateWithWeekday('bozuk')).toBe('—')
  })

  it('ay adları 1-tabanlı', () => {
    expect(monthNameTr(1)).toBe('Ocak')
    expect(monthNameTr(7)).toBe('Temmuz')
    expect(monthNameTr(12)).toBe('Aralık')
    expect(monthNameTr(0)).toBe('—')
    expect(monthNameTr(13)).toBe('—')
  })
})

describe('parseDateTr', () => {
  it('kullanıcının yazdığı tarihi ISO biçimine çevirir', () => {
    expect(parseDateTr('25.07.2026')).toBe('2026-07-25')
    expect(parseDateTr('5.7.2026')).toBe('2026-07-05')
    expect(parseDateTr('25/07/2026')).toBe('2026-07-25')
    expect(parseDateTr('25-07-2026')).toBe('2026-07-25')
    expect(parseDateTr('25072026')).toBe('2026-07-25')
    expect(parseDateTr('  25.07.2026  ')).toBe('2026-07-25')
  })

  it('takvimde olmayan günü reddeder', () => {
    expect(parseDateTr('31.02.2026')).toBeNull()
    expect(parseDateTr('31.04.2026')).toBeNull()
    expect(parseDateTr('29.02.2025')).toBeNull()
    // 2028 artık yıl — 29 Şubat GERÇEK bir gün, kabul edilmeli.
    expect(parseDateTr('29.02.2028')).toBe('2028-02-29')
  })

  it('bozuk girdide null döner', () => {
    // İki haneli yıl kasten reddediliyor: 1926 mı 2026 mı belli değil.
    for (const bad of ['', 'yarın', '25.07.26', '2026-07-25', '00.07.2026', '25.00.2026', '25.13.2026']) {
      expect(parseDateTr(bad), `girdi: ${JSON.stringify(bad)}`).toBeNull()
    }
  })

  it('gidiş-dönüş: formatDate → parseDateTr aynı günü verir', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-07-25', '2026-12-31']) {
      expect(parseDateTr(formatDate(iso)), `tarih: ${iso}`).toBe(iso)
    }
  })

  it('isoToDate / dateToIso birbirinin tersi', () => {
    for (const iso of ['2026-01-01', '2028-02-29', '2026-10-25']) {
      const date = isoToDate(iso)
      expect(date, `tarih: ${iso}`).not.toBeNull()
      expect(dateToIso(date as Date)).toBe(iso)
    }
    expect(isoToDate('bozuk')).toBeNull()
  })
})

// ─── Saat ─────────────────────────────────────────────────────────────────────

describe('formatTime / parseTimeTr', () => {
  it('saati damgadan da düz metinden de okur', () => {
    expect(formatTime('14:30')).toBe('14:30')
    expect(formatTime('2026-07-25 16:00')).toBe('16:00')
    expect(formatTime('08:00')).toBe('08:00')
  })

  it('boş ve bozuk girdide tire döner', () => {
    for (const bad of [null, undefined, '', '24:00', '14:60', 'akşam']) {
      expect(formatTime(bad), `girdi: ${JSON.stringify(bad)}`).toBe('—')
    }
  })

  it('kullanıcının yazdığı saati HH:MM yapar', () => {
    expect(parseTimeTr('14:30')).toBe('14:30')
    expect(parseTimeTr('14.30')).toBe('14:30')
    expect(parseTimeTr('1430')).toBe('14:30')
    expect(parseTimeTr('930')).toBe('09:30')
    expect(parseTimeTr('9:05')).toBe('09:05')
    expect(parseTimeTr(' 08:00 ')).toBe('08:00')
  })

  it('aralık dışını ve bozuk girdiyi reddeder', () => {
    for (const bad of ['', '24:00', '23:60', '2530', 'yok', '1:2', '14:3']) {
      expect(parseTimeTr(bad), `girdi: ${JSON.stringify(bad)}`).toBeNull()
    }
  })

  it('dakika dönüşümü gidiş-dönüş', () => {
    expect(timeToMinutes('08:00')).toBe(480)
    expect(timeToMinutes('14:30')).toBe(870)
    expect(timeToMinutes('22:00')).toBe(1320)
    for (const minutes of [0, 480, 870, 1320, 1439]) {
      const time = minutesToTime(minutes)
      expect(time, `dakika: ${minutes}`).not.toBeNull()
      expect(timeToMinutes(time as string)).toBe(minutes)
    }
    expect(minutesToTime(1440)).toBeNull()
    expect(minutesToTime(-1)).toBeNull()
  })
})

// ─── Telefon: Rust `text::phone_digits` ile parite ────────────────────────────

describe('phoneDigits — Rust text::phone_digits ile aynı', () => {
  // src-tauri/src/text.rs `telefon_rakamlari` testindeki BİREBİR aynı vektörler.
  const rustBeklentileri: Array<[string, string]> = [
    ['0532 111 22 33', '05321112233'],
    ['+90 (532) 111-22-33', '905321112233'],
    ['', ''],
  ]

  it.each(rustBeklentileri)('phoneDigits(%j) === %j', (girdi, beklenen) => {
    expect(phoneDigits(girdi)).toBe(beklenen)
  })

  it('yalnızca ASCII rakam bırakır', () => {
    // Rust `char::is_ascii_digit` kullanıyor: Arapça-Hint rakamları da düşer.
    expect(phoneDigits('٥٣٢')).toBe('')
    expect(phoneDigits('tel: 0532')).toBe('0532')
  })
})

describe('formatPhone', () => {
  it('okunur telefon biçimi üretir (0 5XX XXX XX XX)', () => {
    expect(formatPhone('05321112233')).toBe('0 532 111 22 33')
    expect(formatPhone('0532 111 22 33')).toBe('0 532 111 22 33')
    // Baştaki sıfır yazılmamış ve +90 ile girilmiş numaralar aynı biçime çekilir.
    expect(formatPhone('5321112233')).toBe('0 532 111 22 33')
    expect(formatPhone('+90 532 111 22 33')).toBe('0 532 111 22 33')
  })

  it('tanımadığı uzunlukta girdiyi OLDUĞU GİBİ döner', () => {
    // Veli telefonu yanlış gösterilirse kullanıcı yanlış numarayı arar; mangling yok.
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone('0212 555 44 33 66')).toBe('0212 555 44 33 66')
    expect(formatPhone(null)).toBe('—')
    expect(formatPhone('')).toBe('—')
  })
})

// ─── Telefon maskesi (Faz 4.5 §4) ─────────────────────────────────────────────
//
// `formatPhone` gösterim için (`0 532 …`), bunlar **girdi alanı** için (`0532 …`) —
// formun placeholder'ı ve hata mesajı da bu yazımı örnek veriyor.

describe('maskPhone', () => {
  it('yazarken 0532 111 22 33 biçimini kurar', () => {
    const adimlar: Array<[string, string]> = [
      ['0', '0'],
      ['05', '05'],
      ['053', '053'],
      ['0532', '0532'],
      ['05321', '0532 1'],
      ['0532111', '0532 111'],
      ['05321112', '0532 111 2'],
      ['0532111223', '0532 111 22 3'],
      ['05321112233', '0532 111 22 33'],
    ]
    for (const [girdi, beklenen] of adimlar) {
      expect(maskPhone(girdi)).toBe(beklenen)
    }
  })

  it('idempotent — kendi çıktısına uygulanınca değişmez', () => {
    for (const girdi of ['0532 214 88 10', '532 111 22 33', '0212 555 44 33', '']) {
      expect(maskPhone(maskPhone(girdi))).toBe(maskPhone(girdi))
    }
  })

  it('baştaki sıfırı ZORLA eklemez — yoksa kullanıcı onu bir daha silemezdi', () => {
    // Doğrulama 10–13 hane kabul ediyor; `532 111 22 33` geçerli bir yazım.
    expect(maskPhone('5321112233')).toBe('532 111 22 33')
    expect(maskPhone('532111')).toBe('532 111')
  })

  it('+90 ve 0090 yapıştırmasını kabul eder', () => {
    expect(maskPhone('+90 532 111 22 33')).toBe('0532 111 22 33')
    expect(maskPhone('905321112233')).toBe('0532 111 22 33')
    expect(maskPhone('0090 532 111 22 33')).toBe('0532 111 22 33')
    // Önek yalnızca numara o uzunluğa ULAŞINCA atılır: `90…` yazmaya başlayan
    // kullanıcının rakamları gözünün önünde silinmez.
    expect(maskPhone('905')).toBe('905')
  })

  it('sabit hattı da doğru gruplar', () => {
    expect(maskPhone('02125554433')).toBe('0212 555 44 33')
  })

  it('11 haneyi aşan girdiyi KIRPMAZ, artanı sona ekler', () => {
    // Sessizce rakam yutmak, yanlış numarayı doğru göstermek demek. Uzunluğu
    // doğrulama söylüyor (`errors.phoneInvalid`).
    expect(maskPhone('053211122334455')).toBe('0532 111 22 33 4455')
    expect(phoneDigits(maskPhone('053211122334455'))).toBe('053211122334455')
  })

  it('rakam olmayanı yutar', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('tel: 0532-111-22-33')).toBe('0532 111 22 33')
  })
})

describe('editPhone — imleç rakam sayısıyla taşınır', () => {
  it('sona yazarken imleç sonda kalır', () => {
    expect(editPhone('0532 1112', 9)).toEqual({ value: '0532 111 2', caret: 10 })
  })

  it('ORTADAN düzenlemede imleç sona atlamaz', () => {
    // `0532 111 22 33` içinde 6. konuma (5'ten sonra) `9` yazıldı.
    const { value, caret } = editPhone('0532 1911 22 33', 7)
    expect(value).toBe('0532 191 12 23 3')
    // İmleç yazılan `9`'un hemen ardında — 6. rakamdan sonra.
    expect(caret).toBe(7)
    expect(value.slice(0, caret)).toBe('0532 19')
  })

  it('yapıştırmada ülke kodu düşse de imleç sonda kalır', () => {
    const raw = '+90 532 111 22 33'
    expect(editPhone(raw, raw.length)).toEqual({ value: '0532 111 22 33', caret: 14 })
  })

  it('boş girdide imleç başa döner', () => {
    expect(editPhone('', 0)).toEqual({ value: '', caret: 0 })
  })
})

describe('backspacePhone — ayıraç kullanıcıyı kilitlemez', () => {
  it('boşluğun üstünde bir RAKAM siler', () => {
    // `0532 |111 22 33` — imleç ayıraçtan sonra. Boşluğu silmek maskeyi
    // değiştirmezdi ve tuş çalışmıyormuş gibi görünürdü.
    expect(backspacePhone('0532 111 22 33', 5)).toEqual({
      value: '0531 112 23 3',
      caret: 3,
    })
  })

  it('rakamın üstünde normal davranır', () => {
    expect(backspacePhone('0532 111 22 33', 14)).toEqual({
      value: '0532 111 22 3',
      caret: 13,
    })
  })

  it('baştaki sıfır silinebilir — alan kilitlenmiyor', () => {
    expect(backspacePhone('0532 111 22 33', 1)).toEqual({
      value: '532 111 22 33',
      caret: 0,
    })
  })

  it('başta basılırsa hiçbir rakam silinmez', () => {
    expect(backspacePhone('0532 111 22 33', 0)).toEqual({
      value: '0532 111 22 33',
      caret: 0,
    })
  })
})

// ─── Arama: Rust `text::search_name` ile parite ───────────────────────────────

describe('normalizeTr — Rust text::search_name ile aynı', () => {
  // src-tauri/src/text.rs testlerindeki BİREBİR aynı vektörler.
  const rustBeklentileri: Array<[string, string]> = [
    ['İngilizce', 'ingilizce'],
    ['İSTANBUL', 'istanbul'],
    ['IŞIK', 'ışık'],
    ['Ilgaz', 'ılgaz'],
    ['IŞIK  Yılmaz', 'ışık yılmaz'],
    ['ÇĞÖŞÜ', 'çğöşü'],
    ['Öğrenci Şahin', 'öğrenci şahin'],
    ['  Ali   Veli  ', 'ali veli'],
  ]

  it.each(rustBeklentileri)('normalizeTr(%j) === %j', (girdi, beklenen) => {
    expect(normalizeTr(girdi)).toBe(beklenen)
  })

  it('aynı adın iki yazımı aynı anahtarı üretir', () => {
    expect(normalizeTr('İngilizce')).toBe(normalizeTr('ingilizce'))
    expect(normalizeTr('Matematik')).toBe(normalizeTr('MATEMATİK'))
  })
})

describe('matchesQuery', () => {
  it('adı Türkçe küçültmeyle arar', () => {
    expect(matchesQuery('ışık', 'IŞIK Yılmaz')).toBe(true)
    expect(matchesQuery('IŞIK', 'ışık yılmaz')).toBe(true)
    expect(matchesQuery('yılmaz', 'IŞIK Yılmaz')).toBe(true)
    expect(matchesQuery('ahmet', 'IŞIK Yılmaz')).toBe(false)
  })

  it('şapkasız arama YAPMAZ — Rust search_name de yapmıyor', () => {
    // 'ısık' → 'ışık' eşleşmesi (aksan körü arama) bilinçli olarak yok: sunucu tarafı
    // arama `search_name` sütununu LIKE ile tarıyor ve o sütun yalnızca küçültülmüş
    // metin tutuyor. Burada fazladan akıllı davranmak, aynı sorgunun iki yerde iki
    // farklı sonuç vermesi demek olurdu. Değişecekse Rust ve şema ile birlikte değişir.
    expect(matchesQuery('isik', 'IŞIK Yılmaz')).toBe(false)
    expect(matchesQuery('sahin', 'Öğrenci Şahin')).toBe(false)
  })

  it('telefonu rakam rakam arar — biçim farkı engel olmaz', () => {
    expect(matchesQuery('532 111', 'Mehmet Aslan', '0532 111 22 33')).toBe(true)
    expect(matchesQuery('2233', 'Mehmet Aslan', '0 532 111 22 33')).toBe(true)
    expect(matchesQuery('999', 'Mehmet Aslan', '0532 111 22 33')).toBe(false)
    expect(matchesQuery('532', 'Mehmet Aslan', null)).toBe(false)
  })

  it('boş sorgu her kaydı geçirir', () => {
    expect(matchesQuery('', 'Mehmet Aslan')).toBe(true)
    expect(matchesQuery('   ', 'Mehmet Aslan')).toBe(true)
  })
})
