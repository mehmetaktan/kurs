/**
 * `/dev/durum` teşhis panelinin metinleri.
 *
 * `i18n/tr.ts` içinde DEĞİL ve bu bir taşıma değil bir **düzeltme**: metinler orada
 * dururken üretim paketine sızıyorlardı. `tr.ts` her ekrandan statik olarak `import`
 * ediliyor, yani içindeki her dize pakete giriyor — komponentin kendisi ölü dal
 * elenmesiyle çıksa bile. `npm run verify:bundle` bunu Faz 5C'de yakaladı: kapıya
 * `/dev/durum` işaretçileri eklenince "Sistem durumu" üretim paketinde çıktı.
 *
 * Showcase'in `showcase.tr.ts`'i aynı deseni zaten kuruyordu; artık iki dev sayfası da
 * kendi sözlüğünde. Kural (ADR-007 · "JSX'te çıplak metin yok") yine karşılanıyor.
 */
export const statusTr = {
  heading: 'Sistem durumu',
  subtitle: 'Veritabanı bağlantısı ve uygulanan güncellemeler.',
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
} as const
