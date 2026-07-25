/**
 * Arayüzdeki BÜTÜN Türkçe metinler burada (ADR-007).
 * JSX içinde çıplak metin bulunmaz — yeni metin eklerken önce buraya anahtar açılır.
 *
 * İstisna: `src/dev/` altındaki geliştirici sayfaları kendi sözlüğünü taşır
 * (`src/dev/showcase.tr.ts`). Onlar üretim paketine girmiyor ve ürün metni değil;
 * bu dosya ürünün metin envanteri olarak temiz kalıyor.
 */
export const tr = {
  app: {
    name: 'Kurs Takip',
    tagline: 'Öğrenci, ders ve tahsilat takibi',
    // Kenar çubuğu başlığı ve alt bilgisi. "Yerel" kasıtlı: verinin buluta gitmediğini söyler.
    brand: 'DersTakip',
    institution: 'Aydın Özel Ders',
    version: 'Sürüm 1.0 · Yerel',
    skipToContent: 'İçeriğe geç',
  },

  nav: {
    today: 'Bugün',
    calendar: 'Takvim',
    students: 'Öğrenciler',
    groups: 'Gruplar',
    payments: 'Ödemeler',
    definitions: 'Tanımlar',
    reports: 'Raporlar',
    label: 'Ana menü',
    debtorCount: 'borçlu öğrenci',
  },

  actions: {
    save: 'Kaydet',
    cancel: 'Vazgeç',
    close: 'Kapat',
    edit: 'Düzenle',
    add: 'Ekle',
    retry: 'Tekrar dene',
    clearFilter: 'Filtreyi temizle',
    showAll: 'Tümünü göster',
    today: 'Bugün',
    prev: 'Önceki',
    next: 'Sonraki',
    openCalendar: 'Takvimi aç',
    openClock: 'Saat listesini aç',
  },

  states: {
    loading: 'Yükleniyor…',
    errorTitle: 'Bu bölüm yüklenemedi',
    emptyTitle: 'Kayıt yok',
  },

  search: {
    // Bugün ekranı ve Öğrenciler ekranındaki iki ayrı arama kutusu.
    globalPlaceholder: 'Öğrenci, grup veya ders ara',
    globalShortcut: 'Ctrl K',
    globalTitle: 'Ara',
    openHint: '↵ aç',
    typeToSearch: 'Aramak için yazmaya başlayın.',
    noResults: 'için sonuç bulunamadı',
    noResultsHint: 'Ad ya da telefonun bir bölümünü yazmayı deneyin.',
    groupStudents: 'Öğrenciler',
    groupGroups: 'Gruplar',
    groupSessions: 'Dersler',
    // Faz 3 kabuğu aramayı bağlıyor ama veri kaynağı Faz 4'te geliyor.
    notReady: 'Arama sonuçları öğrenci modülüyle birlikte gelecek.',
  },

  form: {
    datePlaceholder: 'GG.AA.YYYY',
    timePlaceholder: 'SS:DD',
    dateInvalid: 'Tarihi GG.AA.YYYY biçiminde yazın, örnek: 25.07.2026',
    timeInvalid: 'Saati SS:DD biçiminde yazın, örnek: 14:30',
  },

  pagination: {
    label: 'Sayfalama',
    // "Sayfa 2 / 7"
    pageOf: 'Sayfa',
    of: '/',
  },

  // Faz 3 kabuğu: sayfalar henüz boş. Her biri hangi fazda dolacağını söylüyor —
  // kullanıcı boş bir ekranla değil, bir sözle karşılaşıyor.
  placeholder: {
    title: 'Bu ekran henüz hazır değil',
    body: 'Uygulama kabuğu ve tasarım sistemi kuruldu. Bu ekranın içeriği sıradaki adımlarda gelecek.',
  },

  pages: {
    today: { title: 'Bugün', subtitle: 'Günün dersleri, yoklama ve borç durumu' },
    calendar: { title: 'Takvim', subtitle: 'Haftalık ve günlük ders programı' },
    students: { title: 'Öğrenciler', subtitle: 'Tüm kayıtlı öğrenciler ve durumları' },
    groups: { title: 'Gruplar', subtitle: 'Grup dersleri ve doluluk durumu' },
    payments: { title: 'Ödemeler', subtitle: 'Borçlu listesi, tahsilat ve cari ekstre' },
    definitions: { title: 'Tanımlar', subtitle: 'Branş, tarife, tatil günleri ve ayarlar' },
    reports: { title: 'Raporlar', subtitle: 'Aylık tahsilat, işlenen ders ve devam oranı' },
    notFound: {
      title: 'Sayfa bulunamadı',
      subtitle: 'Adres yanlış olabilir',
      body: 'Soldaki menüden bir bölüm seçin.',
    },
  },

  status: {
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
    // Boş değer tiresi (U+2014). Biçimleyiciler ayrıştıramadıkları girdide bunu döner —
    // ekran çökmesin, kullanıcı boş hücreyi görsün.
    emptyValue: '—',
    separator: ' · ',
  },

  // `Date.prototype.toLocaleDateString('tr')` kullanılmıyor: WebView2'de ICU verisi
  // eksik kurulmuş bir Windows'ta İngilizce gün adı döner. Listeler burada sabit.
  calendar: {
    // Pazar 0 — `Date.prototype.getDay()` ile aynı sıra.
    weekdays: [
      'Pazar',
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
    ],
    /** Hafta Pazartesi başlar (Türkiye) — ay ızgarasının başlık satırı. */
    weekdaysShortMonFirst: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    months: [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ],
  },
} as const

export type Tr = typeof tr
