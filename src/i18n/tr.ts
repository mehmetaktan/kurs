/**
 * Arayüzdeki BÜTÜN Türkçe metinler burada (ADR-007).
 * JSX içinde çıplak metin bulunmaz — yeni metin eklerken önce buraya anahtar açılır.
 *
 * İstisna: `src/dev/` altındaki geliştirici sayfaları kendi sözlüğünü taşır
 * (`src/dev/showcase.tr.ts`). Onlar üretim paketine girmiyor ve ürün metni değil;
 * bu dosya ürünün metin envanteri olarak temiz kalıyor.
 *
 * **Kurum adı burada BULUNMAZ (ADR-024).** Burası ürün metinlerinin envanteri; kurum
 * müşteri değişkenidir ve `config/kurum.json` içinde yaşar (`src/config/brand.ts`).
 * Sürüm numarası da elle yazılmaz — `package.json`'dan gelir (`APP_VERSION`).
 */
export const tr = {
  app: {
    name: 'Kurs Takip',
    tagline: 'Öğrenci, ders ve tahsilat takibi',
    // Kenar çubuğunun 1. satırı: ÜRÜN adı, sabit (ADR-024). 2. satır kurum adıdır ve
    // config'ten gelir. Faz 3'te burada `'DersTakip'` yazıyordu — hiçbir yerde
    // karşılığı olmayan dördüncü bir ad.
    brand: 'Kurs Takip',
    // Alt bilgi: "Sürüm <numara> · Yerel". Sayı APP_VERSION'dan, kelimeler buradan.
    // "Yerel" kasıtlı: kullanıcıya verinin buluta gitmediğini söyler (EKRANLAR.md).
    versionPrefix: 'Sürüm',
    versionLocal: 'Yerel',
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

  // Faz 4 — Öğrenci ve veli modülü (EKRANLAR.md §3, §4, E1, E2).
  students: {
    searchPlaceholder: 'Öğrenci adı, veli adı veya telefon ara',
    newStudent: 'Yeni öğrenci',
    newStudentLong: 'Yeni öğrenci ekle',

    chips: {
      all: 'Tümü',
      active: 'Aktif',
      passive: 'Pasif',
      debtor: 'Borçlu',
      lowPackage: 'Paketi bitiyor',
      archived: 'Arşivlenmiş',
    },

    filters: {
      subject: 'Branş',
      group: 'Grup',
      allSubjects: 'Tüm branşlar',
      allGroups: 'Tüm gruplar',
    },

    table: {
      label: 'Öğrenci listesi',
      name: 'Ad Soyad',
      guardianPhone: 'Veli telefonu',
      lessons: 'Ders',
      balance: 'Bakiye',
      remaining: 'Kalan ders',
      lastSession: 'Son ders',
      status: 'Durum',
      action: 'İşlem',
      open: 'Aç',
      restore: 'Geri al',
      active: 'Aktif',
      passive: 'Pasif',
      archived: 'Arşivlendi',
    },

    footer: {
      // "12 öğrenci gösteriliyor · 14 kayıt"
      showing: 'öğrenci gösteriliyor',
      ofTotal: 'kayıt',
      // ADR-026: rakam görünen satırları topluyor, kurs genelini değil. Etiket bunu
      // söylemek zorunda — kurs geneli toplam alacağın yeri Dashboard (Faz 9).
      receivable: 'Görünen listenin alacağı',
    },

    empty: {
      firstUse: 'Henüz öğrenci kaydı yok',
      firstUseBody:
        'İlk öğrenciyi ekleyince listede adı, veli telefonu ve bakiyesi görünecek.',
      noFilterResults: 'Bu filtrede öğrenci yok',
      noArchived: 'Arşivlenmiş öğrenci yok',
      noArchivedBody: 'Arşivlediğiniz öğrenciler burada durur ve geri alınabilir.',
    },

    drawer: {
      title: 'Öğrenci özeti',
      contact: 'İletişim',
      guardian: 'Veli',
      noGuardian: 'Veli kaydı yok',
      // "+1 veli daha" — çekmece yalnızca birincil veliyi gösteriyor.
      moreGuardians: 'veli daha',
      balance: 'Bakiye',
      remaining: 'Kalan ders',
      totalLessons: 'Toplam ders',
      lastSession: 'Son ders',
      openDetail: 'Detayı aç',
    },

    form: {
      newTitle: 'Yeni öğrenci',
      editTitle: 'Öğrenciyi düzenle',
      studentSection: 'Öğrenci bilgileri',
      guardianSection: 'Veliler',
      fullName: 'Ad Soyad',
      fullNamePlaceholder: 'Örnek: Elif Yılmaz',
      school: 'Okul',
      grade: 'Sınıf',
      gradePlaceholder: 'Örnek: 11. sınıf',
      birthDate: 'Doğum tarihi',
      phone: 'Öğrenci telefonu',
      phonePlaceholder: '0532 111 22 33',
      phoneHint: 'İsteğe bağlı. Borç konuşulan numara veli telefonudur.',
      enrolledOn: 'Kayıt tarihi',
      note: 'Not',
      notePlaceholder: 'Bu öğrenciyle ilgili kısa not',
      isActive: 'Aktif öğrenci',
      isActiveHint: 'Pasif öğrenci listede kalır, ders programına girmez.',

      addGuardian: 'Veli ekle',
      findGuardian: 'Mevcut veliyi bul',
      findGuardianTitle: 'Veli ara',
      findGuardianPlaceholder: 'Veli adı veya telefon',
      findGuardianHint: 'Kardeşi kayıtlıysa aynı veliyi seçin; ikinci bir kayıt açılmaz.',
      findGuardianEmpty: 'Bu aramayla eşleşen veli yok.',
      findGuardianStart: 'Aramak için velinin adını ya da telefonunu yazın.',
      guardianName: 'Veli adı',
      guardianPhone: 'Veli telefonu',
      guardianEmail: 'E-posta',
      guardianRelation: 'Yakınlık',
      guardianPrimary: 'Birincil veli',
      guardianPrimaryHint: 'Listede ve aramalarda bu velinin telefonu görünür.',
      guardianLinked: 'Kayıtlı veli',
      // "Bu veli 1 öğrenciye daha bağlı"
      guardianShared: 'öğrenciye daha bağlı',
      removeGuardian: 'Veliyi çıkar',
      noGuardians: 'Henüz veli eklenmedi. Veli telefonu olmadan borç görüşmesi yapılamaz.',
      relations: { mother: 'Anne', father: 'Baba', other: 'Diğer' },

      errors: {
        nameRequired: 'Öğrencinin adını ve soyadını yazın.',
        nameTooLong: 'Ad çok uzun. En fazla 120 karakter yazın.',
        phoneInvalid: 'Telefonu 0 ile başlayan 11 hane olarak yazın, örnek: 0532 111 22 33.',
        birthDateInvalid: 'Doğum tarihini GG.AA.YYYY biçiminde yazın, örnek: 12.05.2010.',
        enrolledOnInvalid: 'Kayıt tarihini GG.AA.YYYY biçiminde yazın, örnek: 01.09.2025.',
        guardianNameRequired: 'Velinin adını ve soyadını yazın.',
        guardianPhoneRequired: 'Veli telefonu zorunlu. Borç konuşulacak numara bu.',
        singlePrimary: 'Yalnızca bir veli birincil olabilir. Listede tek birincil bırakın.',
        summary: 'Kaydedilmedi. İşaretli alanları düzeltip tekrar deneyin.',
      },

      discardTitle: 'Kaydedilmemiş değişiklikler var',
      discardBody: 'Formu kapatırsanız yazdıklarınız kaybolur.',
      discardConfirm: 'Kaydetmeden kapat',
      discardHint: 'Yazdıklarınız silinir.',
      keepEditing: 'Düzenlemeye dön',

      savedNew: 'Öğrenci eklendi.',
      savedEdit: 'Değişiklikler kaydedildi.',
      saving: 'Kaydediliyor…',
    },

    detail: {
      back: '← Öğrenciler',
      backHint: 'Esc listeye dön',
      edit: 'Düzenle',
      activate: 'Aktifleştir',
      deactivate: 'Pasifleştir',
      activated: 'Öğrenci aktifleştirildi.',
      deactivated: 'Öğrenci pasifleştirildi.',
      archivedBadge: 'Arşivlendi',

      cards: {
        balance: 'Bakiye',
        // Üç ayrı altyazı, üç ayrı durum. `balanceEmptyCaption` YALNIZCA defteri boş
        // öğrenci için: borcunu ödemiş öğrencinin de bakiyesi 0 ve ona "henüz hareket
        // yok" demek, rakamın altına onu yalanlayan bir cümle koymak olurdu.
        balanceEmptyCaption: 'Henüz hareket yok',
        // Borç var ama vadesi gelmemiş · bakiye kapalı · avans — üçünde de aynı cümle:
        // kullanıcının bu kartta aradığı tek uyarı gecikme.
        balanceCurrentCaption: 'Vadesi geçmiş borç yok',
        // "12 gün gecikmiş"
        overdue: 'gün gecikmiş',
        attendance: 'Devam oranı',
        attendanceCaption: 'Tüm işlenen dersler',
        attendanceEmpty: 'Henüz ders işlenmedi',
        remaining: 'Kalan ders',
        remainingEmpty: 'Aktif paket yok',
        remainingCaption: 'Geçerli paketlerin toplamı',
        nextSession: 'Sıradaki ders',
        nextSessionEmpty: 'Planlı ders yok',
      },

      tabs: {
        info: 'Bilgiler',
        lessons: 'Dersler',
        payments: 'Ödemeler',
        notes: 'Notlar',
      },

      info: {
        school: 'Okul',
        grade: 'Sınıf',
        birthDate: 'Doğum tarihi',
        phone: 'Telefon',
        enrolledOn: 'Kayıt tarihi',
        note: 'Not',
        guardians: 'Veliler',
        noGuardians: 'Bu öğrenciye veli bağlanmamış. Düzenle ile ekleyebilirsiniz.',
        totalLessons: 'İşlenen ders',
        attendedLessons: 'Geldiği ders',
      },

      soon: {
        lessonsTitle: 'Ders geçmişi yakında',
        lessonsBody: 'Yoklama ve devamsızlık dökümü ders modülüyle birlikte gelecek.',
        paymentsTitle: 'Ödemeler yakında',
        paymentsBody: 'Tahsilat, taksit ve cari ekstre tahsilat modülüyle birlikte gelecek.',
      },

      notes: {
        placeholder: 'Bu öğrenciyle ilgili bir not yazın',
        hint: 'Girişler tarihiyle kaydedilir.',
        add: 'Not ekle',
        added: 'Not eklendi.',
        empty: 'Henüz not eklenmemiş. İlk notu yukarıdan ekleyin.',
        remove: 'Notu sil',
        removed: 'Not silindi.',
        removeTitle: 'Not silinsin mi?',
        removeBody: 'Not listeden kalkar. Öğrencinin diğer kayıtları etkilenmez.',
        removeConfirm: 'Notu sil',
        author: 'Ofis',
      },
    },

    archive: {
      action: 'Arşivle',
      title: 'Öğrenci arşivlensin mi?',
      // "Elif Yılmaz listeden kalkacak. …"
      body: 'listeden kalkacak. Geçmiş dersleri, ödemeleri ve borcu olduğu gibi kalır; istediğinizde geri alabilirsiniz.',
      confirm: 'Arşivle',
      confirmHint: 'Kayıt silinmez, listeden kalkar.',
      done: 'Öğrenci arşivlendi.',
      undo: 'Geri al',
      restored: 'Öğrenci arşivden geri alındı.',
      // PRD K-14: uyarı borcun VARLIĞINI değil TUTARINI söyler —
      // "Bu öğrencinin 1.200,00 ₺ borcu var; arşivlense de …". İkinci yarı Faz 1
      // denetimi A8'in karşılığı (§1.23) ve PRD'nin örneğinden daha bilgilendirici.
      debtWarningPrefix: 'Bu öğrencinin',
      debtWarningSuffix: 'borcu var; arşivlense de toplam alacakta sayılmaya devam eder.',
    },
  },

  // Faz 5A — Tanımlar (EKRANLAR.md E7 branşlar, E8 tatil günleri).
  definitions: {
    tabs: {
      subjects: 'Branşlar',
      closedDays: 'Tatil günleri',
    },
    subjects: {
      heading: 'Branşlar',
      lead: 'Ders adları burada tanımlanır. Renk takvimde dersleri ayırt etmeye yarar.',
      newSubject: 'Yeni branş',
      table: {
        label: 'Branşlar',
        name: 'Branş',
        color: 'Renk',
        defaultMin: 'Varsayılan süre',
        groups: 'Grup',
        action: '',
      },
      form: {
        name: 'Branş adı',
        namePlaceholder: 'Matematik',
        color: 'Renk',
        defaultMin: 'Varsayılan ders süresi',
        // PRD S4: boş bırakılırsa genel ayar (60 dk) geçerli.
        defaultMinHint: 'Boş bırakılırsa genel ayar kullanılır.',
        minutesSuffix: 'dk',
      },
      // K9: tekillik küçültülmüş ad üzerinde — bunu SÖYLEMEK gerekiyor, yoksa
      // kullanıcı ekranda farklı yazılmış iki adı görüp reddi anlamıyor.
      duplicateHint: 'Büyük/küçük harf farkı yeni bir branş oluşturmaz.',
      inherited: 'Genel ayar',
      saved: 'Branş kaydedildi.',
      empty: 'Henüz branş yok',
      emptyBody: 'Grup ve ders oluşturabilmek için önce bir branş tanımlayın.',
      archive: {
        title: 'Branş arşivlensin mi?',
        body: 'listeden kalkacak. Bu branştaki geçmiş dersler ve gruplar olduğu gibi kalır.',
        confirm: 'Arşivle',
        done: 'Branş arşivlendi.',
      },
    },
    closedDays: {
      heading: 'Tatil ve kapalı günler',
      lead: 'Kapalı günlere ders programı işlemez; takvimde taralı görünürler.',
      newDay: 'Yeni tatil',
      table: {
        label: 'Kapalı günler',
        day: 'Tarih',
        label_: 'Açıklama',
        action: '',
      },
      form: {
        day: 'Tarih',
        label: 'Açıklama',
        labelPlaceholder: 'Ramazan Bayramı',
      },
      weekly: {
        heading: 'Haftalık kapalı gün',
        lead: 'Her hafta kapalı olan günler. Ders programı bu günlere seans üretmez.',
        saved: 'Haftalık kapalı günler güncellendi.',
      },
      saved: 'Tatil günü kaydedildi.',
      empty: 'Tanımlı tatil yok',
      emptyBody: 'Resmî tatilleri ve kursun kapalı olacağı günleri buraya ekleyin.',
      archive: {
        title: 'Tatil kaldırılsın mı?',
        body: 'günü yeniden ders günü olur. O güne düşen dersler kendiliğinden geri gelmez; programı yeniden kaydetmeniz gerekir.',
        confirm: 'Kaldır',
        done: 'Tatil kaldırıldı.',
      },
    },
  },

  // Faz 5A — Gruplar (EKRANLAR.md E4 liste, E5 detay).
  groups: {
    searchPlaceholder: 'Grup veya branş ara',
    newGroup: 'Yeni grup',
    newGroupLong: 'İlk grubu oluştur',
    chips: {
      all: 'Tümü',
      active: 'Aktif',
      full: 'Dolu',
      available: 'Boş kontenjan',
      archived: 'Arşivlenmiş',
    },
    filters: {
      subject: 'Branş',
      allSubjects: 'Tüm branşlar',
    },
    table: {
      label: 'Gruplar',
      name: 'Grup',
      subject: 'Branş',
      teacher: 'Öğretmen',
      occupancy: 'Doluluk',
      weekly: 'Haftalık ders',
      status: 'Durum',
      action: '',
      open: 'Aç',
      restore: 'Geri al',
      active: 'Aktif',
      passive: 'Pasif',
      archived: 'Arşivlendi',
      // Kapasite aşımı görünür kılınır (PRD S2) — engellenmediği için tek işaret bu.
      overCapacity: 'Kapasite aşıldı',
      noSchedule: 'Program yok',
    },
    footer: {
      showing: 'grup gösteriliyor',
      ofTotal: 'kayıt',
    },
    empty: {
      firstUse: 'Henüz grup yok',
      firstUseBody: 'Grup dersleri için önce bir grup oluşturun; haftalık programı da aynı formda girilir.',
      noFilterResults: 'Bu filtreye uyan grup yok',
      noArchived: 'Arşivlenmiş grup yok',
      noArchivedBody: 'Arşivlenen gruplar bu listede toplanır.',
    },
    form: {
      newTitle: 'Yeni grup',
      editTitle: 'Grubu düzenle',
      name: 'Grup adı',
      namePlaceholder: 'Grup A',
      subject: 'Branş',
      subjectPlaceholder: 'Branş seçin',
      teacher: 'Öğretmen',
      capacity: 'Kapasite',
      capacityHint: 'Hedef sayıdır; aşılabilir, aşınca onay istenir.',
      startsOn: 'Dönem başlangıcı',
      endsOn: 'Dönem bitişi',
      endsOnHint: 'Boş bırakılırsa süresiz.',
      isActive: 'Aktif',
      weekly: 'Haftalık program',
      weeklyHint: 'Seçilen gün ve saatlere ders programı otomatik oluşturulur.',
      addSlot: 'Gün ekle',
      removeSlot: 'Kaldır',
      weekday: 'Gün',
      startTime: 'Saat',
      duration: 'Süre',
      minutesSuffix: 'dk',
      noSlots: 'Henüz gün eklenmedi. Program sonradan da girilebilir.',
      saved: 'Grup kaydedildi.',
      // Program girildiğinde kaç ders üretildiğini söylemek gerekiyor: kullanıcı
      // "kaydettim" ile "takvimim doldu" arasındaki bağı başka türlü kuramıyor.
      generatedPrefix: 'Grup kaydedildi ·',
      generatedSuffix: 'ders programa eklendi.',
    },
    detail: {
      back: 'Gruplar',
      stats: {
        occupancy: 'Doluluk',
        weekly: 'Haftalık program',
        attendance: 'Devam oranı',
        next: 'Sıradaki ders',
      },
      attendanceHint: 'Tüm işlenen dersler',
      noAttendance: 'Henüz işlenen ders yok',
      noNext: 'Planlanmış ders yok',
      weeklyPerWeek: 'ders/hafta',
      tabs: {
        members: 'Öğrenciler',
        sessions: 'Seans geçmişi',
        notes: 'Notlar',
      },
      members: {
        add: 'Öğrenci ekle',
        table: 'Grup öğrencileri',
        name: 'Öğrenci',
        startOn: 'Katılım',
        endOn: 'Ayrılış',
        status: 'Durum',
        current: 'Grupta',
        left: 'Ayrıldı',
        remove: 'Gruptan çıkar',
        empty: 'Bu grupta henüz öğrenci yok',
        emptyBody: 'Öğrenci ekleyince katılım tarihi kaydedilir; o tarihten önceki derslerden sorumlu olmaz.',
        picker: {
          title: 'Gruba öğrenci ekle',
          student: 'Öğrenci',
          studentPlaceholder: 'Öğrenci seçin',
          startOn: 'Katılım tarihi',
          startOnHint: 'Bu tarihten önceki derslerin yoklamasında görünmez.',
          submit: 'Gruba ekle',
          added: 'Öğrenci gruba eklendi.',
        },
        // PRD S2 / K-8: kapasite aşımında onay istenir, ENGELLENMEZ. Diyalog kaç
        // kişilik gruba kaçıncı öğrencinin eklendiğini söyler.
        capacity: {
          title: 'Kapasite aşılıyor',
          prefix: 'Bu grup',
          middle: 'kişilik ve dolu.',
          suffix: 'öğrenci eklensin mi?',
          confirm: 'Yine de ekle',
          hint: 'Kapasite bir hedeftir; program eklemeyi engellemez.',
        },
        remove_: {
          title: 'Öğrenci gruptan çıkarılsın mı?',
          body: 'için bugün ayrılış tarihi yazılacak. Geçmiş dersleri, yoklamaları ve borcu olduğu gibi kalır.',
          confirm: 'Gruptan çıkar',
          done: 'Öğrenci gruptan çıkarıldı.',
        },
      },
      sessions: {
        table: 'Seans geçmişi',
        date: 'Tarih',
        time: 'Saat',
        status: 'Durum',
        attendance: 'Yoklama',
        planned: 'Planlandı',
        done: 'İşlendi',
        cancelled: 'İptal',
        notTaken: 'Girilmedi',
        attendedOf: '/',
        empty: 'Henüz seans yok',
        emptyBody: 'Haftalık program girildiğinde dersler burada listelenir.',
      },
      notes: {
        // Ayrı bir grup notu tablosu AÇILMAZ — üyelerin notlarının birleşik akışı.
        lead: 'Grup öğrencilerinin notları. Not eklerken hangi öğrenciye ait olduğu seçilir.',
        student: 'Öğrenci',
        studentPlaceholder: 'Öğrenci seçin',
        body: 'Not',
        bodyPlaceholder: 'Kısa bir not yazın…',
        add: 'Not ekle',
        added: 'Not eklendi.',
        empty: 'Bu grupta not yok',
        emptyBody: 'Öğrencilerle ilgili notlar burada toplanır.',
      },
      archive: {
        title: 'Grup arşivlensin mi?',
        body: 'listeden kalkacak. Geçmiş dersleri ve öğrenci kayıtları olduğu gibi kalır; gelecekteki dersleri programdan düşer.',
        confirm: 'Arşivle',
        done: 'Grup arşivlendi.',
      },
      notFound: 'Grup bulunamadı',
      notFoundBody: 'Arşivlenmiş olabilir. Gruplar listesine dönüp arşiv görünümüne bakın.',
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
