/**
 * Showcase sayfasının metinleri.
 *
 * `i18n/tr.ts` içinde DEĞİL, bilerek: burası ürün metni değil, geliştirici aracının
 * etiketleri. Üretim derlemesine girmiyor ve ürünün metin envanterini şişirmesi
 * gereksiz. Kural (ADR-007 · "JSX'te çıplak metin yok") yine karşılanıyor.
 */
export const showcaseTr = {
  title: 'Komponentler',
  subtitle: 'Faz 3 tasarım sistemi · bütün varyantlar ve durumlar',
  intro:
    'Bu sayfa proje boyunca referans. Yeni bir komponent yazıldığında buraya da eklenir. Üretim derlemesinde bu rota yok.',

  sections: {
    buttons: 'Düğmeler',
    fields: 'Girdiler',
    controls: 'Denetimler',
    pickers: 'Tarih ve saat',
    display: 'Veri gösterimi',
    table: 'Tablo',
    overlays: 'Diyaloglar ve bildirim',
    states: 'Boş · yükleniyor · hata',
  },

  labels: {
    variants: 'Varyantlar',
    sizes: 'Boyutlar',
    disabled: 'Devre dışı',
    withError: 'Hata durumu',
    density: 'Satır yoğunluğu',
    densityRelaxed: 'rahat',
    densityTight: 'sıkı',
    empty: 'Boş varyant',
  },

  buttons: {
    primary: 'Yeni ders',
    secondary: 'Düzenle',
    ghost: 'Şablondan oluştur',
    warning: 'Yoklama al',
    danger: 'Arşivle',
    small: 'Tahsilat al',
    icon: 'Önceki',
  },

  fields: {
    nameLabel: 'Ad Soyad',
    namePlaceholder: 'Öğrencinin adı',
    nameHint: 'Veli adı ayrı bir alanda saklanıyor.',
    amountLabel: 'Tutar',
    amountError: 'Tutarı 1.250,00 gibi yazın; kuruş kısmı virgülle ayrılır.',
    noteLabel: 'Not',
    notePlaceholder: 'Girişler tarihiyle kaydedilir',
    subjectLabel: 'Branş',
    subjectPlaceholder: 'Branş seçin',
    primaryGuardian: 'Birincil veli',
    dateLabel: 'Ders tarihi',
    timeLabel: 'Başlangıç saati',
  },

  subjects: {
    math: 'Matematik',
    english: 'İngilizce',
    physics: 'Fizik',
  },

  controls: {
    searchPlaceholder: 'Öğrenci adı veya veli telefonu ara',
    viewLabel: 'Görünüm',
    week: 'Hafta',
    day: 'Gün',
    attendanceLabel: 'Yoklama durumu',
    present: 'Geldi',
    excused: 'Mazeretli',
    unexcused: 'Mazeretsiz',
    cancelled: 'İptal',
    chipAll: 'Tümü',
    chipActive: 'Aktif',
    chipPassive: 'Pasif',
    chipDebt: 'Borçlu',
    chipEnding: 'Paketi bitiyor',
  },

  display: {
    balance: 'Bakiye',
    attendanceRate: 'Devam oranı',
    remaining: 'Kalan ders',
    nextSession: 'Sıradaki ders',
    balanceCaption: '12 gün gecikmiş',
    rateCaption: 'son 8 haftada +6 puan',
    remainingCaption: '≈ 31 Temmuz’da biter',
    nextCaption: 'Matematik · Grup C',
    nextValue: 'Yarın · 16:00',
    noRecord: 'Aktif kayıt yok',
    sectionTitle: 'Bugünkü dersler',
    sectionMeta: '6 ders · 2 yoklama bekliyor',
    badgeDebt: 'Borç',
    badgeHoliday: 'Tatil',
    badgeAttendance: 'Yoklama',
    badgeDone: 'Tamamlandı',
    dotActive: 'Aktif',
    dotPassive: 'Pasif',
    dotWarn: 'Yoklama girilmedi',
    dotDanger: 'Mazeretsiz',
    tabsLabel: 'Öğrenci detayı',
    tabEnrollments: 'Kayıtlar',
    tabHistory: 'Ders geçmişi',
    tabPayments: 'Ödemeler',
    tabNotes: 'Notlar',
  },

  table: {
    label: 'Örnek öğrenci listesi',
    name: 'Ad Soyad',
    phone: 'Veli telefonu',
    lessons: 'Ders',
    balance: 'Bakiye',
    remaining: 'Kalan ders',
    lastLesson: 'Son ders',
    status: 'Durum',
    action: 'Tahsilat al',
    footerLeft: '4 öğrenci gösteriliyor',
    footerRight: 'Toplam alacak',
  },

  overlays: {
    openModal: 'Modal aç',
    openConfirm: 'Onay diyaloğu aç',
    openDrawer: 'Çekmece aç',
    showToast: 'Bildirim göster',
    modalTitle: 'Dersi taşı',
    modalDescription:
      'Bu ders haftalık şablonda tekrar ediyor. Değişiklik nasıl uygulansın?',
    optionOnce: 'Sadece bu ders',
    optionOnceHint: 'Yalnızca 24.07 tarihli ders taşınır',
    optionFuture: 'Bu ve sonraki dersler',
    optionFutureHint: 'Şablon güncellenir, geçmiş dersler korunur',
    confirmTitle: 'Öğrenciyi arşivle',
    confirmDescription:
      'Mehmet Aslan listelerden kaldırılacak. Borcu ve geçmiş dersleri silinmez, arşivden geri alabilirsiniz.',
    confirmAction: 'Arşivle',
    confirmHint: 'Öğrenci arşive taşınır, kaydı silinmez',
    drawerTitle: 'Mehmet Aslan',
    drawerContact: 'İletişim',
    drawerGuardian: 'Veli',
    drawerPhone: 'Telefon',
    drawerPay: 'Tahsilat al',
    toastMessage: 'Ders 16:00’a taşındı',
  },

  states: {
    firstUseTitle: 'Henüz öğrenci kaydı yok',
    firstUseBody:
      'İlk öğrenciyi ekleyin; ders, paket ve tahsilatları buradan tek yerden takip edin.',
    firstUseAction: 'Yeni öğrenci ekle',
    searchTitle: '“Işık” için sonuç bulunamadı',
    searchBody: 'Ad ya da telefonun bir bölümünü yazmayı deneyin.',
    filterTitle: 'Bu filtrede öğrenci yok',
    filterAction: 'Tümünü göster',
    errorMessage:
      'Öğrenci listesi okunamadı. Programı kapatıp yeniden açın; sorun sürerse en son yedeği geri yükleyin.',
  },
} as const
