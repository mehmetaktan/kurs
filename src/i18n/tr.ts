/**
 * Arayüzdeki BÜTÜN Türkçe metinler burada (ADR-007).
 * JSX içinde çıplak metin bulunmaz — yeni metin eklerken önce buraya anahtar açılır.
 */
export const tr = {
  app: {
    name: 'Kurs Takip',
    tagline: 'Öğrenci, ders ve tahsilat takibi',
  },

  status: {
    heading: 'Sistem durumu',
    // Faz 2 ekranı: uygulamanın veritabanına gerçekten bağlandığını gösterir.
    subtitle: 'Faz 2 · iskelet. Ekranlar Faz 3 ile gelecek.',
    loading: 'Veritabanı hazırlanıyor…',
    dbPath: 'Veritabanı dosyası',
    sqliteVersion: 'SQLite sürümü',
    journalMode: 'Günlük kipi',
    foreignKeys: 'Yabancı anahtar denetimi',
    migrations: 'Uygulanan güncellemeler',
    institution: 'Kurum',
    teacher: 'Öğretmen',
    studentCount: 'Kayıtlı öğrenci',
    sessionCount: 'Planlanmış ders',
    ledgerCount: 'Defter hareketi',
    on: 'açık',
    off: 'kapalı',
    healthy: 'Veritabanı bağlantısı çalışıyor.',
    seedHint: 'Demo verisi yüklemek için: npm run seed',
  },

  errors: {
    // Kullanıcı teknik değil: mesaj Türkçe ve EYLEM önerir, ham hata kodu göstermez.
    title: 'Bir sorun çıktı',
    retry: 'Tekrar dene',
    unknown:
      'Beklenmeyen bir sorun oluştu. Programı kapatıp yeniden açın; sorun sürerse en son yedeği geri yükleyin.',
    startupFailed:
      'Program veritabanını açamadı. Bilgisayarı yeniden başlatıp tekrar deneyin; sorun sürerse en son yedeği geri yükleyin.',
  },

  units: {
    // ADR-003: tutarlar kuruş; ekranda ₺. Eksi işareti U+2212, ASCII tire değil.
    currencySuffix: ' ₺',
    minus: '−',
  },
} as const

export type Tr = typeof tr
