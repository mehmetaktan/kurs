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
    // Alt bilgi: "Sürüm <numara> · AktanSoft". Sayı APP_VERSION'dan, kelimeler buradan.
    versionPrefix: 'Sürüm',
    versionPublisher: 'AktanSoft',
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
    archive: 'Arşivle',
    saving: 'Kaydediliyor…',
    copyDetails: 'Ayrıntıları kopyala',
    detailsCopied: 'Ayrıntılar kopyalandı',
    detailsCopyFailed: 'Ayrıntılar kopyalanamadı',
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
    // Aranabilir seçim (K1) — uzun listelerde yerel <select>ün yerini alır.
    searchSelect: {
      noResults: 'Eşleşen kayıt yok',
    },
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

  help: {
    label: 'Ekran yardımı',
    prefix: 'Bu ekran:',
    screens: {
      today: 'Günün derslerini, bekleyen işleri ve önemli özetleri bir arada gösterir.',
      calendar: 'Ders programını gün ve hafta içinde görmenizi ve düzenlemenizi sağlar.',
      students: 'Öğrenci, veli, bakiye ve ders hakkı kayıtlarını yönetir.',
      groups: 'Grup üyelerini, kapasiteyi ve haftalık ders düzenini yönetir.',
      payments: 'Borçları izler, tahsilat alır ve öğrenci cari ekstresini açar.',
      definitions: 'Branş, tarife, öğretmen, tatil, çalışma düzeni ve yedeklemeyi ayarlar.',
      reports: 'Tahsilat, işlenen ders, devam ve devamsızlık sonuçlarını karşılaştırır.',
      fallback: 'Seçtiğiniz bölümdeki kayıtları görüntüler ve yönetir.',
    },
  },

  onboarding: {
    later: 'Şimdilik kapat',
    course: {
      title: 'Kurs Takip’e hoş geldiniz',
      description:
        'Program bu kurs için hazırlanmıştır. Önce kurs adını kontrol edin, sonra ilk branş ve öğrenci kaydını birlikte oluşturalım.',
      institution: 'Kurs adı',
      continue: 'Kurs adı doğru, devam et',
    },
    subject: {
      title: 'İlk branşı ekleyin',
      description:
        'Öğrencileri ve dersleri bağlamak için önce bir branş gerekir. Ders süresi ve rengi daha sonra Tanımlar ekranından değiştirilebilir.',
      label: 'Branş adı',
      placeholder: 'Örnek: Matematik',
      save: 'Branşı kaydet ve devam et',
    },
    student: {
      title: 'İlk öğrenciyi ekleyin',
      description:
        'Branş hazır. Şimdi öğrenci ve veli bilgilerini kaydedin; ders ve ödeme işlemlerine bundan sonra başlayabilirsiniz.',
      open: 'Yeni öğrenci formunu aç',
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

    packages: {
      action: 'Paket sat',
      title: 'Ders paketi sat',
      student: 'Öğrenci',
      currentBalance: 'Güncel bakiye',
      rule: 'Tarife',
      rulePlaceholder: 'Tarife seçin',
      lessonCount: 'Ders sayısı',
      unitPrice: 'Birim ücret (TL)',
      totalPrice: 'Paket toplamı (TL)',
      discount: 'İndirim',
      soldOn: 'Satış tarihi',
      installmentCount: 'Taksit sayısı',
      firstDueOn: 'İlk vade',
      plan: 'Taksit planı',
      installmentAmount: 'Taksit tutarı',
      installmentDueOn: 'Vade',
      summary: 'Satış özeti',
      summaryLessons: 'ders',
      summaryInstallments: 'taksit',
      summaryFirstDue: 'ilk vade',
      separateCounters: 'Ders hakkı ve bakiye ayrı sayaçlardır; satış anında bakiye değişmez.',
      noRules: 'Satılabilir paket tarifesi yok. Önce Tanımlar → Tarifeler bölümünden paket ekleyin.',
      saved: 'Paket ve taksit planı kaydedildi.',
      saving: 'Paket kaydediliyor…',
      listTitle: 'Ders paketleri',
      listEmpty: 'Henüz paket satılmamış.',
      remaining: 'kalan ders',
      sold: 'satış',
      close: 'Paketi kapat',
      closed: 'Kapandı',
      closeTitle: 'Paket nasıl kapatılsın?',
      closeDescription: 'Kullanılmayan derslerin tutarı paket satışındaki birim ücretten hesaplanır.',
      leaveCredit: 'Avans bırak',
      leaveCreditHint: 'Kullanılmayan tutar öğrenci hesabında alacak olarak kalır.',
      refund: 'İade et',
      refundHint: 'Kullanılmayan tutar iade hareketiyle kapatılır.',
      closeDone: 'Paket kapatıldı.',
      errors: {
        priceRuleId: 'Bir paket tarifesi seçin.',
        lessonCount: 'Ders sayısını sıfırdan büyük tam sayı olarak yazın.',
        unitPrice: 'Geçerli bir birim ücret yazın.',
        totalPrice: 'Geçerli bir paket toplamı yazın.',
        soldOn: 'Satış tarihini seçin.',
        installments: 'Taksit toplamı paket toplamına eşit olmalı ve her taksit sıfırdan büyük olmalı.',
      },
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

      lessons: {
        attendance: {
          title: 'Devam yüzdesi',
          caption: 'Geldi / sonuç girilmiş dersler · İptal ve girilmedi hariç',
          empty: 'Hesaplanacak sonuç girilmiş ders yok',
          presentPrefix: 'Geldiği',
          eligibleSuffix: 'sonuç girilmiş ders',
        },
        absences: {
          title: 'Son 3 ayın devamsızlık dağılımı',
          since: 'tarihinden bugüne',
          excused: 'Mazeretli',
          unexcused: 'Mazeretsiz',
          totalSuffix: 'devamsızlık',
          empty: 'Bu aralıkta mazeretli veya mazeretsiz devamsızlık yok.',
        },
        history: {
          title: 'Geçmiş dersler',
          countSuffix: 'ders',
          table: 'Öğrencinin geçmiş dersleri',
          date: 'Tarih',
          time: 'Saat',
          subject: 'Branş',
          kind: 'Ders türü',
          status: 'Durum',
          solo: 'Birebir',
          makeup: 'Telafi',
          empty: 'Henüz geçmiş ders yok',
          emptyBody: 'Ders tarihi geçince burada yoklama durumuyla birlikte görünür.',
        },
        status: {
          present: 'Geldi',
          excused: 'Mazeretli',
          unexcused: 'Mazeretsiz',
          cancelled: 'İptal',
          pending: 'girilmedi',
        },
        makeups: {
          title: 'Bekleyen telafiler',
          countSuffix: 'telafi',
          table: 'Öğrencinin bekleyen telafileri',
          sourceDate: 'Asıl ders',
          subject: 'Branş',
          plan: 'Telafi planı',
          planned: 'Planlandı',
          notPlanned: 'Henüz planlanmadı',
          empty: 'Bekleyen telafi yok',
          emptyBody: 'Tamamlanan telafiler bu listeden kendiliğinden kalkar.',
        },
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
  payments: {
    takePayment: 'Tahsilat al',
    receipt: {
      print: 'Makbuzu aç / yazdır',
      opened: 'Makbuz PDF olarak açıldı.',
      openError: 'Makbuz açılamadı. Bilgisayarınızda bir PDF okuyucu bulunduğunu kontrol edip yeniden deneyin.',
    },
    introTitle: 'Tahsilat kaydı hazır',
    introBody: 'Öğrenciyi seçip tahsilatı kaydedin. Borçlu listesi bu ekranın sonraki bölümünde gösterilecek.',
    searchPlaceholder: 'Öğrenci adı veya veli telefonu ara',
    filters: {
      all: 'Tümü',
      overdue: 'Gecikmiş',
      due_this_month: 'Bu ay vadesi gelen',
      advance: 'Avansı olan',
    },
    sorts: {
      label: 'Sıralama',
      debt_desc: 'Borç tutarı',
      overdue_desc: 'Gecikme süresi',
    },
    table: {
      label: 'Borçlu öğrenciler',
      student: 'Öğrenci',
      phone: 'Veli telefonu',
      debt: 'Borç',
      advance: 'Avans',
      oldestDue: 'En eski vade',
      overdue: 'Gecikme',
      action: 'İşlem',
      days: 'gün',
      current: 'Güncel',
      archived: 'Arşivlendi',
      noPhone: 'Telefon yok',
      copyPhone: 'Telefonu kopyala',
      phoneCopied: 'Telefon kopyalandı.',
      copyFailed: 'Telefon kopyalanamadı. Numarayı seçip elle kopyalayın.',
    },
    empty: {
      clear: 'Aramayı temizle',
      noDebt: 'Borcu olan öğrenci yok',
      noDebtBody: 'Harika — seçili görünümde açık borç bulunmuyor.',
      noResults: 'Bu aramayla eşleşen kayıt yok',
      noResultsBody: 'Öğrenci adını veya veli telefonunu değiştirip yeniden deneyin.',
    },
    status: {
      showing: 'kayıt gösteriliyor',
      visibleReceivable: 'Görünen listenin alacağı',
    },
    statement: {
      title: 'Cari ekstre',
      subtitle: 'Borç ve alacak hareketleri, yürüyen bakiye ile',
      from: 'Başlangıç',
      to: 'Bitiş',
      print: 'Yazdır',
      exportCsv: 'CSV dışa aktar',
      exported: 'Cari ekstre Dışa Aktarımlar klasörüne kaydedildi.',
      tableLabel: 'Cari ekstre hareketleri',
      columns: { date: 'Tarih', description: 'Açıklama', debit: 'Borç', credit: 'Alacak', balance: 'Bakiye', action: 'İşlem' },
      kinds: { session_charge: 'Ders ücreti', installment_charge: 'Taksit', payment: 'Tahsilat', reversal: 'İptal / düzeltme', adjustment: 'Düzeltme' },
      cancelled: 'İptal',
      cancel: 'İptal et',
      cancelTitle: 'Tahsilat iptal edilsin mi?',
      cancelBody: 'Tahsilat silinmez. Deftere ters kayıt yazılır ve taksit mahsupları yeniden açılır.',
      cancelConfirm: 'Tahsilatı iptal et',
      cancelHint: 'Makbuz iptal olarak kalır; ödeme kaydı silinmez.',
      cancelDone: 'Tahsilat iptal edildi.',
      receipt: 'Makbuz',
      empty: 'Bu tarih aralığında cari hareket yok',
      emptyBody: 'Tarih aralığını genişletin veya yeni bir tahsilat kaydedin.',
    },
    modal: {
      title: 'Tahsilat al',
      student: 'Öğrenci',
      studentPlaceholder: 'Öğrenci seçin',
      amount: 'Tutar',
      date: 'Tarih',
      method: 'Ödeme yöntemi',
      methods: { cash: 'Nakit', card: 'Kart', transfer: 'Havale' },
      receiptNo: 'Makbuz numarası',
      receiptHint: 'Otomatik ayrıldı; matbu koçan için değiştirebilirsiniz.',
      note: 'Açıklama',
      notePlaceholder: 'İsteğe bağlı kısa açıklama',
      installments: 'Açık taksitlere mahsup',
      installmentsHint: 'En eski vadeden başlayarak önerildi; tutarları değiştirebilirsiniz.',
      noInstallments: 'Bu öğrencinin açık taksidi yok; tahsilat bakiyede avans olarak kalır.',
      installmentOpen: 'açık',
      allocation: 'Mahsup',
      advance: 'avans olarak kalacak.',
      save: 'Tahsilatı kaydet',
      saving: 'Kaydediliyor…',
      saved: 'Tahsilat kaydedildi.',
      savedTitle: 'Tahsilat başarıyla kaydedildi',
      savedBody: 'Makbuzu şimdi açıp yazdırabilir veya pencereyi kapatabilirsiniz.',
      close: 'Kapat',
      errors: {
        student: 'Tahsilat yapılacak öğrenciyi seçin.',
        amount: 'Sıfırdan büyük, geçerli bir tutar yazın.',
        date: 'Tahsilat tarihini seçin.',
        receiptNo: 'Makbuz numarasını yazın.',
        allocation: 'Mahsup toplamı tahsilat tutarını aşamaz.',
      },
    },
  },

  definitions: {
    tabs: {
      subjects: 'Branşlar',
      prices: 'Tarifeler',
      teachers: 'Öğretmenler',
      closedDays: 'Tatil günleri',
      general: 'Genel',
      backup: 'Yedekleme',
    },
    priceRules: {
      heading: 'Fiyat tarifeleri',
      lead: 'Yeni fiyatlar başlangıç tarihinden itibaren geçerli olur. Geçmiş derslerin ve paketlerin ücreti değişmez.',
      newRule: 'Yeni tarife',
      saved: 'Tarife kaydedildi.',
      change: 'Yeni fiyat',
      allSubjects: 'Tüm branşlar',
      empty: 'Henüz tarife tanımlanmadı',
      emptyBody: 'Ders ve paket ücretlerini kullanabilmek için ilk tarifeyi ekleyin.',
      table: {
        label: 'Fiyat tarifeleri',
        name: 'Ad',
        scope: 'Branş ve ders türü',
        model: 'Tip',
        price: 'Birim ücret',
        validity: 'Geçerlilik',
        action: '',
      },
      models: {
        perSession: 'Ders başı',
        package: 'Paket',
        period: 'Dönemlik',
      },
      lessonKinds: {
        any: 'Birebir ve grup',
        solo: 'Birebir',
        group: 'Grup',
      },
      validity: {
        since: ' tarihinden beri',
        starts: ' tarihinde başlayacak',
        archived: 'Arşivlenmiş',
      },
      form: {
        newTitle: 'Yeni tarife',
        changeTitle: 'Yeni fiyatı tanımla',
        historyHint: 'Fiyat değişikliği eski satırı değiştirmez; seçilen tarihten başlayan yeni bir satır açar.',
        name: 'Tarife adı',
        model: 'Tarife tipi',
        subject: 'Branş',
        lessonKind: 'Ders türü',
        unitPrice: 'Birim ücret (TL)',
        lessonCount: 'Ders sayısı',
        totalPrice: 'Toplam tutar (TL)',
        periodMonths: 'Dönem süresi (ay)',
        installments: 'Varsayılan taksit sayısı',
        validFrom: 'Şu tarihten itibaren geçerli',
      },
      errors: {
        required: 'Bu alanı doldurun.',
        money: 'Geçerli bir tutar yazın; örnek: 1.250,00',
        integer: 'Sıfırdan büyük bir tam sayı yazın.',
        package: 'Paket için ders sayısını ve toplam tutarı yazın.',
        installments: 'Taksit sayısı en az 1 olmalı.',
        date: 'Geçerlilik başlangıcını seçin.',
      },
      archive: {
        title: 'Tarife arşivlensin mi?',
        body: 'yeni kayıtlarda seçilemeyecek. Geçmiş ders ve paket tutarları değişmeyecek.',
        done: 'Tarife arşivlendi.',
      },
    },
    // Para fazı §0a — ADR-037. Kurs çok öğretmenli; adı 'Öğretmen' olan migration
    // satırı bu ekranın ilk kaydıdır ve kurs sahibi onu düzeltir.
    teachers: {
      heading: 'Öğretmenler',
      lead: 'Ders veren kişiler burada tanımlanır. Renk takvimde ve ders bloğunda görünür.',
      newTeacher: 'Yeni öğretmen',
      table: {
        label: 'Öğretmenler',
        name: 'Ad',
        color: 'Renk',
        phone: 'Telefon',
        email: 'E-posta',
        status: 'Durum',
        action: '',
      },
      form: {
        name: 'Ad soyad',
        namePlaceholder: 'Ayşe Demir',
        color: 'Renk',
        phone: 'Telefon',
        email: 'E-posta',
        emailPlaceholder: 'ayse@ornek.com',
        active: 'Aktif',
      },
      active: 'Aktif',
      inactive: 'Pasif',
      // İki durum karışmasın diye söylenmesi gereken cümle: pasif öğretmen listede
      // kalır, arşivlenen kalkar.
      inactiveHint: 'Pasif öğretmen yeni derse atanamaz; geçmiş dersleri olduğu gibi kalır.',
      saved: 'Öğretmen kaydedildi.',
      empty: 'Henüz öğretmen yok',
      emptyBody: 'Derslere öğretmen atayabilmek için önce bir öğretmen tanımlayın.',
      archive: {
        title: 'Öğretmen arşivlensin mi?',
        body: 'listeden kalkacak. Bu öğretmenin geçmiş dersleri ve grupları olduğu gibi kalır.',
        confirm: 'Arşivle',
        done: 'Öğretmen arşivlendi.',
      },
    },
    // Para fazı §0c — E18. Buradaki iki devamsızlık satırı PARA POLİTİKASIDIR
    // (ADR-016) ve para fazının girdisi.
    general: {
      heading: 'İşletme ayarları',
      lead: 'Kursun çalışma düzeni ve ders hakkı politikası. Değişiklik anında kaydedilir.',
      saved: 'Ayar kaydedildi.',
      groups: {
        hours: 'Çalışma düzeni',
        absence: 'Devamsızlık politikası',
        money: 'Paket ve makbuz',
        other: 'Diğer',
      },
      keys: {
        dayStart: 'Gün başlangıcı',
        dayEnd: 'Gün bitişi',
        slotMinutes: 'Takvim aralığı (dk)',
        defaultSessionMinutes: 'Varsayılan ders süresi (dk)',
        sessionHorizonWeeks: 'Kaç hafta ileriye ders üretilsin',
        rowDensity: 'Liste satır yüksekliği',
        excusedConsumes: 'Mazeretli devamsızlıkta ders hakkı düşsün',
        unexcusedConsumes: 'Mazeretsiz devamsızlıkta ders hakkı düşsün',
        packageExpiryDays: 'Paket geçerlilik süresi (gün)',
        receiptPrefix: 'Makbuz numarası öneki',
      },
      hints: {
        hours: 'Takvimin dikey aralığı bu iki saat arasıdır.',
        slotMinutes: 'Takvimde sürükleme bu aralığa kilitlenir.',
        sessionHorizonWeeks:
          'Değişiklik ders üretimini etkiler; eksik dersler bir sonraki açılışta tamamlanır.',
        excusedConsumes: 'Kapalıyken mazeretli devamsızlıkta ders hakkı düşmez.',
        unexcusedConsumes: 'Açıkken mazeretsiz devamsızlık gelmiş ders sayılır.',
        packageExpiryDays: 'Boş bırakılırsa paketler süresizdir.',
        receiptPrefix: 'Makbuz numarasının başına eklenir, örnek: 2026-14.',
      },
      density: {
        comfortable: 'Rahat',
        compact: 'Sıkı',
      },
      on: 'Açık',
      off: 'Kapalı',
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
      teacherPlaceholder: 'Öğretmen seçin',
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

  // Faz 5B — Bugün ekranı (EKRANLAR.md §1, PRD R1.1–R1.7).
  today: {
    newSession: 'Yeni ders',
    fromTemplate: 'Şablondan oluştur',
    summary: {
      label: 'Kurs özeti',
      open: 'ilgili ekranı aç',
      loading: 'Özet yükleniyor',
      collected: 'Bu ay tahsil edilen',
      currentMonth: 'İçinde bulunduğumuz ay',
      noCollection: 'Bu ay henüz tahsilat yok',
      receivable: 'Kursun toplam alacağı',
      receivableCaption: 'Arşivlenmiş öğrenciler dahil',
      debtors: 'Borçlu öğrenci',
      debtorsCaption: 'Kurs genelindeki tüm borçlular',
      noLedger: 'Henüz hesap hareketi yok',
      makeups: 'Bekleyen telafi',
      makeupsCaption: 'Tüm açık telafi borçları',
      noMakeups: 'Bekleyen telafi yok',
      lowPackages: 'Paketi bitmek üzere',
      lowPackagesCaption: '1 veya 2 dersi kalan öğrenciler',
      noLowPackages: 'Biten paket uyarısı yok',
      noStudents: 'Henüz aktif öğrenci yok',
    },

    lessons: {
      heading: 'Bugünkü dersler',
      // Tasarımdaki `54px / 1fr / 128px / 84px / 190px` ders satırının kolonları.
      table: {
        time: 'Saat',
        lesson: 'Ders',
        students: 'Öğrenci',
        attendance: 'Yoklama',
        action: 'İşlem',
      },
      // "3 ders · 1 yoklama bekliyor" — R1.2 başlıkta da sayılır.
      countSuffix: 'ders',
      pendingSuffix: 'yoklama bekliyor',
      group: 'Grup',
      solo: 'Birebir',
      makeup: 'Telafi',
      // "6 öğrenci"
      studentSuffix: 'öğrenci',
      // Yoklamanın üç durumu (EKRANLAR §1). **"Yoklama al" düğmesi Faz 6'da gelir** —
      // bugün konsaydı çalışmayan bir düğme olurdu (Faz 4'teki "Aç" kolonu kararı).
      attendanceDone: 'katıldı',
      attendanceMissing: 'Yoklama girilmedi',
      attendanceWaiting: 'Bekleniyor',
      cancelled: 'İptal',
      // Geçmişle gelecek arasındaki ayraç — yalnızca ikisi de varsa çıkar (R1.1).
      nowLine: 'Şimdi',
      empty: 'Bugün planlanmış ders yok.',
      emptyBody: 'Program tanımlı; bugüne ders düşmemiş.',
      // R1.7 — program hiç yoksa boş liste DEĞİL, yönlendirme.
      noSchedule: 'Haftalık ders programı henüz oluşturulmadı',
      noScheduleBody:
        'Ders eklerseniz bu liste her sabah kendiliğinden dolar. Grup dersleri için Gruplar ekranından haftalık program da girebilirsiniz.',
      noScheduleAction: 'Ders ekle',
    },

    // Üç yan bölüm de tasarımda var ve **kaldırılmıyor** (R1.6): veri kaynakları
    // sonraki fazlarda bağlanıyor. Boş durum metni yerine "yakında" yazıyor, çünkü
    // "borçlu öğrenci yok" demek kontrol edilmemiş bir şeyi doğru gibi sunmak olurdu.
    debtors: {
      heading: 'Borcu olan öğrenciler',
      countSuffix: 'öğrenci',
      daysOverdue: 'gün gecikti',
      current: 'Güncel borç',
      empty: 'Gecikmiş ödemesi olan öğrenci yok.',
    },
    packages: {
      heading: 'Paketi bitmek üzere',
      countSuffix: 'öğrenci',
      rowSuffix: 'ders kaldı',
      empty: 'Paketi bitmek üzere olan öğrenci yok.',
    },
    backup: {
      heading: 'Yedekleme',
      empty: 'Henüz başarılı yedek yok.',
      automatic: 'Son yedek otomatik alındı.',
      manual: 'Son yedek elle alındı.',
      delayed: 'gündür yedek alınmadı.',
      action: 'Şimdi yedekle',
    },
  },

  // Faz 6 §1 — yoklama paneli (E9, PRD R2.1–R2.4).
  attendance: {
    title: 'Yoklama',
    open: 'Yoklama al',
    edit: 'Yoklamayı aç',
    allPresent: 'Hepsi geldi',
    statusLabel: 'Yoklama durumu',
    status: {
      present: 'Geldi',
      excused: 'Mazeretli',
      unexcused: 'Mazeretsiz',
      cancelled: 'İptal',
    },
    note: 'Kısa not',
    notePlaceholder: 'İsteğe bağlı',
    empty: 'Bu derse kayıtlı öğrenci yok',
    emptyBody: 'Grubun bu ders tarihindeki katılım kayıtlarını kontrol edin.',
    effect: {
      pending: 'Etkiyi görmek için her öğrencinin durumunu seçin.',
      lessonCreditsConsume: 'ders hakkı düşecek',
      lessonCreditsRestore: 'ders hakkı geri verilecek',
      debtAdd: 'borç yazılacak',
      debtRemove: 'borç silinecek',
      unchanged: 'Ders hakkı ve borç değişmeyecek.',
      separator: ', ',
      period: '.',
    },
    discardTitle: 'Kaydedilmemiş yoklama değişiklikleri var',
    discardBody: 'Paneli kapatırsanız yaptığınız seçimler ve notlar kaybolur.',
    discardConfirm: 'Kaydetmeden kapat',
    discardHint: 'Yoklama değişiklikleri silinir.',
    keepEditing: 'Yoklamaya dön',
    saved: 'Yoklama kaydedildi.',
  },

  // Faz 6 §3 — mazeretli yoklamanın telafi planı ve kursun açık telafi borcu.
  makeup: {
    plan: 'Telafi planla',
    planned: 'Telafi planlandı',
    saveAttendanceFirst: 'Önce yoklama değişikliklerini kaydedin, sonra telafiyi planlayın.',
    saved: 'Telafi dersi programa eklendi.',
    alreadyPlanned: 'Bu yoklama için telafi zaten planlanmış.',
    pendingBadge: 'bekleyen telafi',
    form: {
      title: 'Telafi dersi planla',
      source: 'Telafi hakkı',
    },
    list: {
      heading: 'Bekleyen telafiler',
      countSuffix: 'telafi',
      rowSuffix: 'bekliyor',
      empty: 'Bekleyen telafi yok.',
    },
  },

  // Faz 5B — ders ekle/düzenle (E3), seans işlemleri ve şablondan oluştur (E6).
  sessions: {
    form: {
      newTitle: 'Yeni ders',
      editTitle: 'Dersi düzenle',
      kind: 'Ders türü',
      kindSolo: 'Birebir',
      kindGroup: 'Grup',
      // Düzenlemede hedef DEĞİŞMEZ: dersin grubu/öğrencisi devredilemez, yoksa o dersin
      // yoklaması ve borcu başkasına geçerdi. Doğrusu iptal edip yenisini açmak.
      kindLocked: 'Dersin grubu ya da öğrencisi düzenlemeyle değiştirilemez.',
      subject: 'Branş',
      subjectPlaceholder: 'Branş seçin',
      group: 'Grup',
      groupPlaceholder: 'Grup seçin',
      student: 'Öğrenci',
      studentPlaceholder: 'Öğrenci seçin',
      // ADR-037 — çakışma uyarısı bu alana bakıyor (PRD K-1).
      teacher: 'Öğretmen',
      teacherPlaceholder: 'Öğretmen seçin',
      teacherHint: 'Boş bırakılırsa aynı saatteki dersler için uyarı verilmez.',
      date: 'Tarih',
      time: 'Saat',
      duration: 'Süre',
      minutesSuffix: 'dk',
      // PRD S4: süre branşın varsayılanından gelir, ikinci bir varsayılan tanımlanmaz.
      durationHint: 'Branşın varsayılan süresi geldi; değiştirebilirsiniz.',
      repeat: 'Tekrar',
      repeatOnce: 'Tek seferlik',
      repeatWeekly: 'Her hafta',
      repeatWeeklyHint: 'Seçilen günde her hafta ders açılır ve programa işlenir.',
      // Geçmiş tarihe ders yazmak yasak değil ama nadiren istenir — söylemek gerekiyor.
      pastWarning: 'Seçtiğiniz tarih geçmişte. Ders geçmişe eklenecek.',
      errors: {
        subjectRequired: 'Dersin branşını seçin.',
        groupRequired: 'Dersi hangi gruba ekleyeceğinizi seçin.',
        studentRequired: 'Dersi hangi öğrenciye ekleyeceğinizi seçin.',
        dateRequired: 'Ders tarihini seçin.',
        timeRequired: 'Ders saatini yazın, örnek: 16:00.',
        durationInvalid: 'Ders süresini dakika olarak yazın, örnek: 60.',
        noSubjects: 'Önce Tanımlar → Branşlar\'dan bir branş tanımlayın.',
        // K-2 — Rust'taki cümlenin aynısı (`save_session`): kullanıcı aynı kural için
        // iki farklı metin görmesin.
        closedDay:
          'Bu gün tatil olarak işaretli, o güne ders eklenemez. Başka bir gün seçin ya da Tanımlar → Tatil günleri\'nden tatili kaldırın.',
      },
      savedOnce: 'Ders programa eklendi.',
      savedEdit: 'Ders güncellendi.',
      // "Her hafta tekrarlanacak · 16 ders programa eklendi."
      savedWeeklyPrefix: 'Her hafta tekrarlanacak ·',
      savedWeeklySuffix: 'ders programa eklendi.',
    },

    // K-1 / R3.11 — çakışma ENGELLEMEZ, uyarır. Uyarı çakışan dersin ADINI söyler:
    // "çakışma var" tek başına kullanıcıya hiçbir şey anlatmıyor.
    conflict: {
      title: 'Bu saatte başka bir ders var',
      body: 'Aynı saate denk gelen dersler:',
      confirm: 'Yine de ekle',
      hint: 'Ders eklenir; çakışma programda görünür kalır.',
      back: 'Saati değiştir',
    },

    actions: {
      reschedule: 'Ertele',
      cancel: 'İptal et',
      remove: 'Sil',
    },

    reschedule: {
      title: 'Dersi ertele',
      body: 'Dersin yeni tarih ve saatini seçin. Şablon bağı korunur.',
      confirm: 'Ertele',
      done: 'Ders ertelendi.',
    },

    cancelDialog: {
      title: 'Ders iptal edilsin mi?',
      body: 'Ders takvimde ve ders geçmişinde kalır, durumu "İptal" olur.',
      reason: 'İptal sebebi',
      reasonPlaceholder: 'Örnek: Öğretmen hasta',
      reasonHint: 'İsteğe bağlı; ders kartında görünür.',
      confirm: 'Dersi iptal et',
      done: 'Ders iptal edildi.',
    },

    remove: {
      title: 'Bu ders silinsin mi?',
      // Kapsam NET sorulur ve varsayılan EN DAR olan (R3.8). Şablona bağlı olmayan
      // derste kapsam sorusu hiç çıkmaz — silinecek tek şey o ders.
      bodySeries: 'Bu ders haftalık şablonda tekrar ediyor. Neyi silmek istiyorsunuz?',
      bodySingle: 'Bu ders programdan kalkacak. Geçmiş kayıtlar etkilenmez.',
      only: 'Sadece bu ders',
      onlyHint: 'Şablon ve diğer haftalar olduğu gibi kalır.',
      following: 'Bu ve sonraki dersler',
      followingHint: 'Şablon bu tarihte kapanır; geçmiş dersler korunur.',
      all: 'Tüm seri',
      allHint: 'Şablon arşivlenir; işlenmiş dersler yerinde kalır.',
      confirm: 'Sil',
      // DeleteReport ne olduğunu söylüyor ve bildirim onu DOĞRU anlatmak zorunda:
      // şablona bağlı tek ders arşivlenmiyor, İPTAL ediliyor (ux_session_series_slot).
      doneCancelled: 'Ders iptal edildi; şablonda yerinde kalıyor.',
      doneRemovedPrefix: 'Programdan',
      doneRemovedSuffix: 'ders kaldırıldı.',
      doneNone: 'Silinecek ders bulunamadı; işlenmiş dersler yerinde kalır.',
    },

    // E6 — önizleme onaydan ÖNCE gösterilir.
    template: {
      title: 'Şablondan oluştur',
      body: 'Seçtiğiniz haftanın dersleri haftalık programa çevrilir ve ileriye doğru üretilir.',
      sourceWeek: 'Kaynak hafta',
      sourceWeekHint: 'O haftadan herhangi bir gün seçmeniz yeterli.',
      applyFrom: 'Şu tarihten itibaren uygula',
      preview: 'Önizleme',
      // "4 ders haftalık programa eklenecek"
      previewCountSuffix: 'ders haftalık programa eklenecek',
      firstOnPrefix: 'ilk ders',
      alreadyPlanned: 'Zaten programda',
      empty: 'Seçilen haftada ders yok',
      emptyBody: 'Dersi olan bir hafta seçin ya da önce tek tek ders ekleyin.',
      confirm: 'Programa uygula',
      // "3 ders haftalık programa eklendi · 1 ders zaten programdaydı."
      donePrefix: 'ders haftalık programa eklendi.',
      doneSkippedPrefix: '·',
      doneSkippedSuffix: 'ders zaten programdaydı.',
      nothing: 'Yeni ders eklenmedi; hepsi zaten programdaydı.',
    },
  },

  backup: {
    heading: 'Yedekleme',
    lead:
      'Veriler her gün Belgeler klasörüne otomatik yedeklenir. Bilgisayar arızasına karşı düzenli olarak USB belleğe veya bulut klasörüne de kopyalayın.',
    history: 'Son yedeklemeler',
    actions: {
      openFolder: 'Yedek klasörünü aç',
      restore: 'Yedekten geri yükle',
      create: 'Şimdi yedekle',
      working: 'Yedekleniyor…',
      copy: 'Başka klasöre kopyala',
    },
    directory: {
      label: 'Yedek klasörü',
      hint: 'Belgeler altında tutulur; son 30 yedek saklanır.',
    },
    warnDays: {
      label: 'Kaç gün sonra uyarı verilsin',
      hint: '1 ile 30 gün arasında yazın.',
      error: 'Uyarı günü 1 ile 30 arasında olmalı. Değeri düzeltip yeniden deneyin.',
    },
    table: {
      label: 'Yedekleme geçmişi',
      countSuffix: 'kayıt',
      date: 'Tarih',
      kind: 'Tür',
      automatic: 'Otomatik',
      manual: 'Elle',
      size: 'Boyut',
      status: 'Durum',
      success: 'Başarılı',
      failed: 'Başarısız',
      action: 'İşlem',
    },
    empty: {
      title: 'Henüz yedek alınmadı',
      body: 'Şimdi yedekle düğmesine basın; sonraki günlerde otomatik yedekler burada görünür.',
    },
    dialog: {
      restoreTitle: 'Geri yüklenecek yedeği seçin',
      databaseFiles: 'Kurs Takip yedekleri',
      copyTitle: 'Yedeğin kopyalanacağı klasörü seçin',
    },
    restore: {
      firstTitle: 'Bu yedek geri yüklensin mi?',
      firstDescription:
        'Program önce bugünkü verilerinizi otomatik olarak yedekleyecek, ardından seçtiğiniz yedeğe dönecek.',
      firstConfirm: 'Yedeği kontrol etmeye devam et',
      firstHint: 'Henüz hiçbir veri değişmeyecek.',
      secondTitle: 'Mevcut verilerin yerine yedek konsun mu?',
      secondDescription:
        'Bu işlem ekrandaki öğrenci, ders ve tahsilatları seçtiğiniz yedeğin tarihindeki hâline döndürür.',
      secondConfirm: 'Yedeği geri yükle',
      secondHint: 'İşlemden önce alınan kurtarma yedeği Belgeler klasöründe kalacak.',
    },
    messages: {
      created: 'Yedek başarıyla alındı.',
      copied: 'Yedek seçilen klasöre kopyalandı.',
      restored: 'Yedek geri yüklendi.',
    },
    errors: {
      openDirectory:
        'Yedek klasörü açılamadı. Belgeler klasörünü Dosya Gezgini üzerinden açmayı deneyin.',
    },
    units: {
      kilobyte: 'KB',
      megabyte: 'MB',
    },
  },

  // Faz 10 §0 — Rapor özeti + Faz 6'dan korunan devamsızlık dökümü.
  reports: {
    summary: {
      collected: 'Bu ay tahsil edilen',
      collectionSuffix: 'tahsilat',
      noCollection: 'Bu ay henüz tahsilat yok',
      processed: 'İşlenen ders',
      allProcessed: 'Tüm işlenen dersler',
      noProcessed: 'Henüz ders işlenmedi',
      attendance: 'Devam oranı',
      allAttendance: 'Tüm sonuç girilmiş dersler',
      noAttendance: 'Henüz sonuç girilmiş ders yok',
      activeStudents: 'Aktif öğrenci',
      activeStudentsCaption: 'Bugün aktif olan kayıtlar',
      noActiveStudents: 'Henüz aktif öğrenci yok',
    },
    monthly: {
      title: 'Aylık tahsilat',
      description: 'İptal edilmemiş tahsilatların aylara göre toplamı',
      table: {
        label: 'Aylık tahsilat dökümü',
        month: 'Ay',
        count: 'Tahsilat sayısı',
        amount: 'Tahsil edilen',
      },
      empty: 'Bu dönem için tahsilat verisi yok',
      emptyBody: 'İlk tahsilat kaydedildiğinde aylık döküm burada görünür.',
    },
    subjects: {
      title: 'Branş bazında ders',
      description: 'Tüm işlenmiş derslerin branşlara göre dağılımı',
      table: {
        label: 'Branş bazında işlenen dersler',
        subject: 'Branş',
        count: 'İşlenen ders',
      },
      empty: 'Bu dönem için ders verisi yok',
      emptyBody: 'İlk ders işlenip yoklaması kaydedildiğinde dağılım burada görünür.',
    },
    absence: {
      title: 'Devamsızlık raporu',
      description:
        'Seçilen tarih aralığında mazeretli ve mazeretsiz devamsızlıkları en çoktan aza gösterir.',
      search: 'Öğrenci adı ara',
      filters: {
        from: 'Başlangıç tarihi',
        to: 'Bitiş tarihi',
        subject: 'Branş',
        group: 'Grup',
        allSubjects: 'Tüm branşlar',
        allGroups: 'Tüm gruplar',
      },
      errors: {
        dateRequired: 'Başlangıç ve bitiş tarihlerini seçin.',
        rangeOrder:
          'Başlangıç tarihi bitiş tarihinden sonra olamaz. Tarih aralığını düzeltin.',
      },
      table: {
        label: 'Devamsızlık sıralaması',
        rank: 'Sıra',
        student: 'Öğrenci',
        excused: 'Mazeretli',
        unexcused: 'Mazeretsiz',
        total: 'Toplam',
        archived: 'Arşivlendi',
      },
      empty: {
        range: 'Bu tarih aralığında devamsızlık yok',
        rangeBody: 'Başka bir tarih aralığı seçerek yeniden deneyin.',
        filtered: 'Bu filtrelerle devamsızlık bulunamadı',
        filteredBody: 'Branş, grup ya da öğrenci filtresini değiştirerek yeniden deneyin.',
      },
      status: {
        students: 'öğrenci gösteriliyor',
        total: 'Toplam devamsızlık',
      },
    },
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

  // Takvim ekranı (EKRANLAR §2). Gün/ay ADLARI burada değil, `dates` altında: biri
  // ekranın metni, öteki uygulamanın her yerinde kullanılan sözlük.
  calendar: {
    views: {
      month: 'Ay',
      week: 'Hafta',
      workWeek: 'Çalışma haftası',
      day: 'Gün',
      agenda: 'Ajanda',
    },
    today: 'Bugün',
    prev: 'Önceki',
    next: 'Sonraki',
    newSession: '＋ Ders ekle',
    fromTemplate: 'Şablondan oluştur',
    clearAllFilters: 'Tüm filtreleri temizle',
    subjects: 'Branşlar',
    teachers: 'Öğretmenler',
    noData: 'Bu aralıkta ders yok.',
    closed: 'Tatil',
    now: 'şimdi',
    // Blok içindeki ikinci satır: grupta "4/6", birebirde tek kelime.
    solo: 'Birebir',
    makeup: 'Telafi',
    cancelled: 'İptal',
    attendanceMissing: 'Yoklama',
    locked: 'Kilitli',
    conflict: 'Öğretmen çakışması',
    group: 'Grup',
    details: {
      title: 'Ders ayrıntısı',
      edit: 'Düzenle',
      attendanceTake: 'Yoklama al',
      attendanceView: 'Yoklamayı görüntüle',
      reschedule: 'Ertele',
      cancel: 'İptal et',
      archive: 'Arşivle',
      close: 'Kapat',
    },
    conflictDialog: {
      title: 'Öğretmen çakışması var',
      body: 'Aynı öğretmenin bu saatte başka dersi var. Ders yine de bu saate taşınsın mı?',
      confirm: 'Yine de taşı',
    },
    moveBlocked: {
      closed: 'Bu gün kapalı. Açık bir gün seçip yeniden deneyin.',
      locked: 'Yoklaması alınmış ders taşınamaz veya süresi değiştirilemez.',
      failed: 'Ders taşınamadı. Takvimi yenileyip yeniden deneyin.',
    },
    // Ay ızgarasının hücre altyazısı: "3 ders".
    lessonCount: 'ders',
    more: 'daha',
    // Saati okunamayan satır ızgaraya çizilemiyor ama SAKLANMIYOR da: veritabanında
    // olup ekranda olmayan bir ders, kullanıcıya "o gün boş" dedirtir. Satırın adı
    // düğme olarak yazılıyor; tıklayınca ders açılıp saati düzeltilebiliyor.
    unreadable: 'dersin saati okunamadı ve takvime çizilemedi. Açıp saatini düzeltin:',
    legend: {
      heading: 'Açıklama',
      group: 'Grup dersi',
      solo: 'Birebir',
      makeup: 'Telafi / tek seferlik',
      attendanceMissing: 'Yoklama girilmedi',
      done: 'İşlenmiş ders',
      cancelled: 'İptal edilmiş',
      closed: 'Tatil / kapalı gün',
    },
    // Dördü ayrı (EKRANLAR §149) — tek bir "kayıt yok" hepsini anlatmıyor.
    empty: {
      noSchedule: 'Bu hafta için program tanımlı değil',
      noScheduleBody:
        'Haftalık ders programı henüz kurulmamış. Bir ders ekleyin ya da geçmiş bir haftayı şablona çevirin.',
      allClosed: 'Bu hafta tamamen tatil',
      allClosedBody: 'Haftanın her günü kapalı. Tanımlar → Tatil günleri\'nden değiştirebilirsiniz.',
      noResults: 'Bu filtreyle ders yok',
      noResultsBody: 'Seçili branşlarda bu hafta ders bulunmuyor.',
      clearFilter: 'Filtreyi temizle',
      dayEmpty: 'Bu gün için ders yok',
      dayClosed: 'Bu gün kapalı',
    },
    // Sürükle-bırak sonrası kapsam sorusu (R3.8). En dar olan başta, hiçbiri seçili değil.
    move: {
      title: 'Dersi taşı',
      // "Matematik · Grup A dersi Perşembe 18:00'e taşınacak."
      lead: 'dersi',
      leadSuffix: 'saatine taşınacak.',
      only: 'Sadece bu ders',
      onlyHint: 'Yalnızca bu hafta taşınır; haftalık program eski gün ve saatinde kalır.',
      following: 'Bu ve sonraki dersler',
      followingHint:
        'Haftalık program bu tarihten itibaren yeni gün ve saate geçer. Geçmiş dersler yerinde kalır.',
      confirm: 'Taşı',
      done: 'Ders taşındı.',
      doneFollowing: 'ders yeni gün ve saate taşındı.',
      undo: 'Geri al',
      undone: 'Taşıma geri alındı.',
    },
  },

  // `Date.prototype.toLocaleDateString('tr')` kullanılmıyor: WebView2'de ICU verisi
  // eksik kurulmuş bir Windows'ta İngilizce gün adı döner. Listeler burada sabit.
  dates: {
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
