---
description: Faz Para — fiyat tarifesi, paket, tahsilat, ekstre ve makbuz (eski 7+8)
---

# Faz Para — Fiyatlandırma, Paket, Tahsilat, Makbuz

> **Bu faz eski Faz 7 ile Faz 8'in birleşimidir** (2026-07-26, ürün sahibinin kararı).
> `/faz-08` komutu buraya katıldı. **Sıradaki iş bu.**

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md` (**§3 ve §4 satır satır**),
`docs/PRD.md`, `docs/KARARLAR.md` — özellikle ADR-003, ADR-004, ADR-006, **ADR-014**,
**ADR-015**, ADR-016, **ADR-018**, ADR-025, ADR-026, ADR-027, **ADR-035**,
**ADR-037** (çok öğretmenli — ADR-011 düştü), **ADR-038** (takvimin dar istisnası).

**Para mantığının temeli burada kuruluyor. Burada yapılan hata her ekstrede, her raporda
çoğalır.** Buna karşılık: **ölçüm veya araştırma oturumu açılmaz** (ADR-033). Bir yerde
tıkanırsan `docs/DURUM.md`'ye yaz ve **tek soruyla sor**; cevap yoksa en ucuz varsayımla
devam et ve varsayımı bu komuta yaz.

## Bu faz sığmazsa

**İki dikiş yeri var**, sırayla:

| Dikiş | Öncesi | Sonrası |
|---|---|---|
| **§1'in başı** | §0 — öğretmenler, ayarlar, çakışma uyarısı, aranabilir seçim | para işi |
| **§5'in başı** | tarife + paket + tahakkuk + tüketim fonksiyonu | tahsilat + borçlu + ekstre + makbuz |

`/kapat` çalıştır, **aynı komutla** sonraki oturumda devam et. Arada denetim veya karar
oturumu **açılmaz**. §0 tek başına bir oturumdan küçüktür; para işinin başıyla birlikte
sığarsa ilk dikişte durma.

---

## 0. Kurs sahibinin kendi programını tanımlayabilmesi

**Bu bölüm para işinden önce gelir ve atlanmaz.** Bugün kurs sahibi programında hiçbir
işletme değerini değiştiremiyor: öğretmenin adı `'Öğretmen'`, çalışma saatleri sabit,
devamsızlık politikası sabit. Sonuncusu bu fazın **girdisi**.

Bitiş ölçütü tek cümle: *kurs sahibi kendi öğretmenlerini ve çalışma düzenini programa
girebiliyor, ve uzun listelerden arayarak seçim yapabiliyor.*

### 0a. `Tanımlar → Öğretmenler` — **ADR-037**

ADR-011 düştü: **kursta birden fazla öğretmen var.** Şema değişmiyor, migration yazılmıyor.

- `Tanımlar` sayfasına üçüncü sekme: `DataTable` + ekle/düzenle. Alanlar: ad, renk
  (kategori paletinden — `pages/tanimlar/palette.ts`), telefon (`formatPhone`, ADR-027),
  e-posta, aktif. Arşivleme `deleted_at` ile (ADR-005), kullanıcıya "Arşivle".
- Rust tarafında `insert_teacher` / `update_teacher` **zaten var** (`repo/people.rs:40,57`);
  eksik olan `#[tauri::command]` yüzeyi ve arşivleme. `list_teachers` var, pasifleri de
  döndürecek şekilde genişletilir.
- Sıralama `lib/sortTr.ts` (ADR-020), SQL'de `ORDER BY full_name` **yazılmaz**.
- Grup ve seans formlarındaki öğretmen alanı zaten `teacher_id` yazıyor
  (`gruplar/GroupForm.tsx:154`, `dersler/validate.ts:97`). **Tek adayı otomatik seçen
  satır kaldırılır** (`GroupForm.tsx:89`) — alan gerçek bir seçim olur.
- Öğretmen adı `null` olabilir; listelerde `tr.units.emptyValue` gösterimi korunur.
- **Koddaki ADR-011 atıflarını temizle.** 12 yerde "tek öğretmen" yazan yorum ve test adı
  var; hepsi ADR-037'ye göre düzeltilir ya da silinir. Tam liste:
  `src/lib/api.ts:340` · `src/pages/takvim/{CalendarPage.tsx:40, filters.ts:8, WeekGrid.tsx:26,
  drag.test.ts:111, calendar.test.tsx:329}` · `src/pages/dersler/SessionForm.tsx:125` ·
  `src/pages/gruplar/GroupForm.tsx:87` · `src-tauri/src/{model.rs:52, commands.rs:255,
  repo/schedule.rs:363, repo/roster.rs:717, db/migrate.rs:224}`.
  Gün görünümünün tek sütun kalması **doğru** — o satırlar ADR-038'e atıfla kalır, silinmez.

### 0b. K-1 çakışma uyarısı gerçekten çalışsın — `DENETIM-FAZ1 > C5`

Bu bulgu Faz 1'de yazıldı, Faz 5'e atandı, üç faz boyunca kapanmadı. **Burada kapanıyor.**

- `repo/schedule.rs:364` civarındaki çakışma kontrolü `teacher_id` eşitliğine göre daraltılır.
- PRD `K-1`: aynı öğretmen aynı saatte iki derste → **kaydetmeden önce onay diyaloğu**,
  engelleme değil. Takvimde `!` rozeti kalır.
- Testi Rust'ta: aynı öğretmen çakışıyor · farklı öğretmen çakışmıyor · `teacher_id` boş
  olan seans uyarı üretmiyor.

### 0c. `Tanımlar → Genel` — işletme ayarları (E18, Faz 10'dan alındı)

`repo/setting.rs`'te `set` / `update_existing` **yazılmış ve testsiz duruyor**;
`list_settings` okuyor, **yazan komut ve ekran yok.**

- Yazan `#[tauri::command]` eklenir. **Yalnızca bilinen anahtarlar yazılabilir**
  (`update_existing` zaten var olmayan anahtarı reddediyor — bu davranışın testi olsun).
- Ekrana çıkan satırlar: çalışma saatleri (`day_start`, `day_end`), `slot_minutes`,
  `default_session_minutes`, `session_horizon_weeks`, `weekly_closed_days`, `row_density`,
  **`absence_excused_consumes_lesson`** ve **`absence_unexcused_consumes_lesson`**,
  `package_expiry_days`, `receipt_prefix`, `backup_warn_days`.
- Ekrana **çıkmaz**: `institution_name` (ADR-024 — okunmuyor, `config/kurum.json`'dan
  geliyor), `receipt_next_no` ve `last_backup_at` (program yazıyor, kullanıcı değil).
- İki devamsızlık satırı para politikasıdır — ekranda ne yaptığı Türkçe bir cümleyle yazılı
  olsun: *"Mazeretli devamsızlıkta ders hakkı düşmez."*
- Değişiklik anında kaydedilir ve bildirim çıkar; kaydedilmemiş form bırakılmaz.
- `session_horizon_weeks` değişince seans motoru etkilenir — kaydetmeden önce bunu söyle,
  yeniden üretimi `on_startup` zaten idempotent yapıyor.

### 0d. Takvim — dar istisna, **ADR-038**

Takvim dondurulmuş durumda (ADR-034) ve öyle kalıyor. İzin verilen **tek** iki değişiklik:

- `pages/takvim/filters.ts`'e **öğretmen filtre ekseni** (branş ekseninin birebir tekrarı).
- Ders bloğunun meta satırında öğretmen adı.

**Gün görünümü tek sütun kalır.** Öğretmen-başına-sütun düzeni, sürükleme jesti, kenarda
kaydırma — hepsi hâlâ kapsam dışı.

### 0e. K1 — seçim listelerinde arama

`docs/KULLANILABILIRLIK.md > K1`. Bu fazın kendi ihtiyacı: tahsilat ekranı uzun öğrenci
listesinden seçim yaptıracak.

- `src/ui/Field.tsx:206 > Select` yerel `<select>`; uzun listede kullanılamıyor.
- Aranabilir bir seçim komponenti **`src/ui/`'ya** eklenir (mevcut `Select` bozulmadan
  kalır — kısa listelerde yerel `<select>` doğru olan). Klavyeyle çalışır: yaz-filtrele,
  ok tuşlarıyla gez, `Enter` seç, `Esc` kapat.
- Arama **Türkçe** eşleşir: `lib/format.ts > normalizeTr` kullanılır, `toLocale*` yok
  (ADR-030'un ICU satırı). `ingilizce` yazınca `İngilizce` bulunur.
- Metinler `src/i18n/tr.ts`'e; `dev/` sözlüklerine değil.
- Öğrenci/grup seçen mevcut formlar buna geçirilir (`dersler/SessionForm`,
  `gruplar/GroupForm`, yeni para ekranları). Kısa listeler (branş, ödeme yöntemi, öğretmen)
  `Select` kalır.
- Komponentin testi olur: filtreleme, Türkçe eşleşme, klavye gezinmesi.
- Bitince `docs/KULLANILABILIRLIK.md`'de ✅ işaretle. Sahibinin eklediği başka madde varsa
  onları da §0'a al.

---

## 1. Fiyat tarifesi

- Branş + ders türü (birebir / grup) → birim ücret
- Tarife değişebilir; **geçerlilik başlangıç tarihi** tutulur
- Eski seansların ücreti değişmez (ADR-006)
- Tarife ekranı: mevcut tarife, geçmiş tarifeler, "şu tarihten itibaren geçerli" ile yeni
  tarife

## 2. Ders paketi, taksit planı ve paketin kapatılması

- Satış: öğrenci, branş, ders adedi, birim ücret, toplam, indirim
- **Paket süresizdir (S3 cevaplandı, 2026-07-26).** `package.valid_until` şemada duruyor
  ama **yazılmaz** (`NULL`); satış ekranında bitiş tarihi alanı **yok**. "Süresi geçmiş
  paket" durumu, uyarısı ve rapor satırı üretilmez. Aktif paket sorgusundaki
  `valid_until` koşulu yine de yazılır — ileride tarih girilirse tek yerden açılır.
- **Taksit planı zorunlu adımdır, atlanamaz** (R4.16). Peşin ödeme de bir plandır: tek
  taksit, vadesi satış günü. `installment` satırları burada doğuyor.
- Satış özeti kaydetmeden önce gösterilir (R5.10):
  *"8 ders · 2.000 TL · 2 taksit — ilk vade 01.03."*
- Ders hakkı ve bakiye **iki ayrı sayaç** olarak gösterilir, karıştırılmaz (R5.11)
- Aynı öğrencide birden fazla aktif paket olabilir — **en eskisinden** düşülür (R5.12).
  Bunu ADR olarak yaz.
- **Paketi kapatma akışı — ADR-035, kilitli.** Öğrenci ayrıldığında iki seçenek sunulur:
  **Avans bırak** (kullanılmayan hakların tutarı alacak olarak kalır) veya **İade et**
  (iade hareketi yazılır, bakiye kapanır). İkisi de `ledger_entry`'ye append-only satır
  yazar; kalan tutar paketin `unit_price` **snapshot'ından** hesaplanır (indirim tekrar
  hesaplanmaz). Kalan hak sıfırlanması bir `package_usage` satırıyla yazılır, sayaç
  geriye dönük silinmez.

> **`package.status`'a iş mantığı bağlama.** "Aktif paket" bir sorgudur, bir sütun değildir:
> `remaining > 0 AND (valid_until IS NULL OR valid_until >= :today)`.
> `status` yalnızca `'cancelled'` için bağlayıcıdır; `'exhausted'`/`'expired'` sadece rapor
> etiketidir. Denetimde çıkan senaryo: status güncellenmezse kalan hak eksiye düşüyor, yeni
> paket hiç kullanılmıyor ve o dersler için **borç da yazılmıyor** — öğrenci bedava ders alıyor.

## 3. Deftere yansıma

**ADR-015 ve ADR-014 KİLİTLİDİR. Bu bölüm tartışmaya açık değil.**
Kaynak: `docs/VERI-MODELI.md` §3 (adım adım tablo) ve §4 (iptal ve düzeltme tabloları).

- Paketsiz (`per_session`) öğrenci: seans işlendiğinde
  `ledger_entry(session_charge, −unit_price, attendance_id)`.
  Fiyat `resolve_unit_price()` ile **açıkça çözülür**; bulunamazsa hata verir, sessizce
  0 yazmaz (K-23).
- **Paket satışı deftere satır YAZMAZ.** `package` + `installment` satırları oluşur;
  satışta bakiye değişmez.
- Her taksidin **vadesi geldiğinde** `ledger_entry(installment_charge, −amount, installment_id)`.
  `accrue_due_installments(today)` **`repo/ops.rs > on_startup`'a** girer, **idempotent**,
  `today` parametredir (`date('now')` kullanılmaz — `VERI-MODELI §0`).
- **Paketli öğrencide ders işlemek deftere hiçbir satır yazmaz** — yalnızca
  `package_usage(delta = −1)`.
- İptal/iade senaryolarında defterin nasıl düzeltildiği (§4).

> ⚠️ Bu bölüm eskiden *"Paketli öğrenci: paket satışında borç, tahsilatta alacak"* diyordu.
> Bu, ADR-015'in gerekçesinde **açıkça elenen (a) alternatifidir** — dönemlik paket alan
> öğrenciyi gün 1'de tüm tutar kadar borçlu gösterir ve borçlu listesini kullanılamaz hâle
> getirir. Komut düzeltildi; eski hâline dönme.

## 4. Paket tüketimi — migration + fonksiyon burada, ekran Faz 6'da

Tüketimi tetikleyen şey **yoklama** (ADR-015) ve yoklama ekranı `/faz-06`'da. Bu fazda:

- **İlk iş: `003_package_usage_reversal_chain.sql`** — **ADR-036**, kararı verilmiş,
  tartışmaya açık değil. `package_usage` ADR-022'nin ters kayıt zinciri modeline geçer:
  `reverses_id` sütunu, iki kısmi UNIQUE indeks, üç tetikleyici; `ux_pkgusage_att`
  kaldırılır. `v_package_remaining` **yeniden yazılmaz.**
- ADR-036'nın **kanıt şartı önce yeşil olur**: yedi düzeltme dizisi testlenir (ADR'de
  liste hâlinde). *Bu testler geçmeden tüketim fonksiyonu yazılmaz.*
- `consume_package_credit(attendance_id, today)` ve düzeltmenin tersini yazan eşi **Rust'ta
  yazılır ve testlenir**. İmza şimdi sabitleniyor ki Faz 6 yalnızca **çağırsın**.
- Ekran bağlantısı yapılmaz, düğme konmaz — Faz 5B'nin "çalışmayan düğme koymaktansa
  durumu yaz" kararının aynısı.
- Şema Faz 2'de kapanmıştı; **bu, ADR-036'nın gerektirdiği tek migration.** Başka bir
  sütuna ihtiyaç duyarsan durup sor (`CLAUDE.md > Veri`).

---

## 5. Tahsilat alma — *(dikiş yeri: buradan öncesi bir oturuma sığar)*

- Öğrenci seç (**§0e'nin aranabilir seçimi**), tutar, tarih, yöntem (Nakit / Havale / Kart),
  açıklama
- Ödeme `ledger_entry`'ye **alacak** satırı olarak işlenir
- **Açık taksitlere mahsup** (`payment_allocation`) — tasarımın "Mahsup edildiği taksit"
  kolonunun kaynağı. Mahsup otomatik önerilir, **en eski vadeden başlayarak** (R4.6),
  elle değiştirilebilir. Mahsup toplamı ödemeyi aşamaz (K-9).
- Otomatik mahsup **bütün açık taksitleri** kapsar — vadesi gelmiş **ve gelmemiş**.
  Aksi hâlde avans birikir ve bakiye ile borçlu listesi birbirini tutmaz.
- Kısmi ödeme desteklenir
- Fazla ödeme → avans; ekranda açıkça yazılır (R4.7): *"420 TL avans olarak kalacak."*
- **Çift tık koruması zorunlu** (K-19): Kaydet ilk tıklamada kilitlenir ve makbuz numarası
  modal **açılırken** rezerve edilir. Şema indeksi bunu yakalayamaz — çift tık iki ayrı
  `payment` satırı üretir, ikisi de geçerlidir.
- **Tahsilat düzeltilmez, silinmez** — karar alındı, yeniden tartışılmıyor (ADR-014, R4.10).
  İptal akışı `VERI-MODELI.md §4`'te satır satır tanımlı: ters kayıt + `payment_allocation`
  satırlarının arşivlenmesi, tek transaction. **`payment.deleted_at` asla doldurulmaz**
  (makbuz numarası serbest kalır).

## 6. Borçlu listesi

**Kurs sahibinin ay sonu en çok kullanacağı ekran.** Hızlı ve net olmalı.

- Kaynak **`v_student_debt`** (ADR-018) — `v_student_overdue` değil. Denetimde çıkan hata:
  taksit tabanlı liste **ders başı ödeyen öğrencileri hiç göstermiyordu**.
- Tutara ve gecikme süresine göre sıralama; gecikme gün sayısı Rust'ta, `today` bind edilerek
- **Arşivlenmiş borçlu bu listede ve toplam alacakta görünür** (ADR-005 gerekçesi);
  Bugün ekranında görünmez
- Veli telefonu görünür ve kopyalanabilir (`formatPhone`, ADR-027)
- Satırdan tek tıkla tahsilat alma
- Toplam alacak üstte; altbilgi **görünen listeyi** toplar ve etiketi
  `Görünen listenin alacağı` (ADR-026)
- Filtreler: Gecikmiş · Bu ay vadesi gelen (`v_installment_open`) · Avansı olan
- Liste ADR-025'in iş bölümüne uyar: arama/filtre Rust'ta, çipler ve sıralama arayüzde,
  sayfalama `lib/paginate.ts`

## 7. Cari ekstre

Öğrenci detayı > `Ödemeler` sekmesini doldur. Muhasebe defteri gibi okunsun:

| Tarih | Açıklama | Borç | Alacak | Bakiye |

Tarih aralığı filtresi, yazdırma ve dışa aktarma (CSV'ye **BOM** — `CLAUDE.md > Windows`).

## 8. Makbuz PDF

- Ödeme kaydından yazdırılabilir makbuz
- **Makbuz numarası otomatik artar, elle düzeltilebilir (S5 cevaplandı, 2026-07-26).**
  Numara modal açılırken rezerve edilir (§5, K-19), alan düzenlenebilir, **aynı numara iki
  kez yazılamaz** — tekillik şemada zorlanır ve testi olur. Atlamasın.
- Kurum adı, adres, logo `config/kurum.json`'dan gelir (**ADR-024** — `tr.ts`'te kurum adı
  yok, Ayarlar'dan da okunmaz)
- **TÜRKÇE KARAKTER İÇİN GÖMÜLÜ FONT ZORUNLU.** Varsayılan PDF fontlarında `ğ ş İ ı ç ö ü`
  yok. Gömüldüğünü bir testle veya çıktı görseliyle doğrula.
- Platforma özel API kullanma — Windows'ta çalışacak (ADR-008)
- Tutarın yazıyla karşılığı ("Bin iki yüz elli TL") — Türkçe sayı yazımı, testli
- **Dönem sonu hesap özeti PDF'i kapsam dışı** (`YOL-HARITASI > Kapsam dışı`): ekstrenin
  dışa aktarması aynı işi görüyor.

## 9. Öğrenci detayı ve Faz 4'ten devralınan iş

- Aktif paketler ve **kalan ders hakkı** · güncel bakiye
- **Öğrenciler listesinin son kolonu.** Faz 4'te tasarımdaki `Tahsilat al` yerine geçici
  olarak `Aç` kondu, çünkü tahsilat yoktu. **Bu fazda tasarıma dön** (`EKRANLAR.md` E1).
  Arşiv görünümündeki `Geri al` kolonu **kalır** (E2).
- Bugün ekranının yan panelindeki borç bölümü "yakında" demeyi bırakır ve gerçek veriye
  bağlanır (Faz 5B'nin bilinçli boşluğu).
- `views::total_receivable` **Faz 10'un özet ekranına** kalır; burada ona dokunma.

## 10. Testler — bu fazda test pazarlık konusu değil

Rust tarafında en az:

- Kuruş aritmetiği; hiçbir yerde float yok (grep ile doğrula)
- Paket kullanımı **iki kez düşmüyor** (idempotency)
- Seans iptal edilince paket hakkı geri geliyor, **iki kez geri gelmiyor**
- `bakiye = SUM(ledger_entry)` her senaryoda doğru
- Tarife değişimi geçmiş seansları etkilemiyor
- Aynı anda iki aktif pakette **en eskisinden** düşme
- **ADR-035'in iki dalı**: avans bırakma ve iade sonrası bakiye + ekstre satırı
- `accrue_due_installments` idempotent; iki kez çalışınca ikinci borç yazmıyor
- Kısmi / tam / fazla ödeme sonrası bakiye ve mahsup dağılımı
- Mahsup ödemeyi aşmıyor (K-9); otomatik mahsup en eski vadeden başlıyor
- Tahsilat iptali: ters kayıt + mahsup arşivi, `payment.deleted_at` boş kalıyor
- Makbuz numarası tekrarsız ve atlamıyor
- Sayının yazıyla karşılığı (0, 1, 11, 100, 1001, 1.234.567 ve kuruşlu tutarlar)

Para ile ilgili yazdığın her fonksiyonun testi olacak. Testsiz fonksiyon bırakma.

---

Bitince test çıktısını ve örnek bir makbuz PDF'ini göster, sonra `/kapat`.

**Denetim oturumu bu fazdan sonra yapılır** — plandaki tek denetim bu (ADR-033).
