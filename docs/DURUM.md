# Durum

**Son güncelleme:** 2026-07-26 · Faz 5B (kod oturumu)
**Mevcut faz:** Faz 5B ✅ tamamlandı → sırada **`/faz-05c`**
**Sonraki oturumda ilk iş:** `/faz-05c`'nin **ilk adımı kod değil karar** — "takvim
ızgarası hazır kütüphaneyle mi kurulsun?" ADR'si. Ölçmeden yazma.

> **Uygulama artık sabah açıldığında bir şey gösteriyor.** Bugün ekranı bağlandı: günün
> dersleri saat sırasıyla, "şimdi" çizgisi, yoklama bekleyen ders amber şeritle. Ders
> ekleme, erteleme, iptal ve silme arayüzü çalışıyor.
>
> **Kalan tek büyük ekran takvim** (5C) ve projenin kalan tek ciddi riski de o.

---

## Faz 5B — tamamlandı

`npm run check` yeşil: **388 test** (208 TypeScript + 180 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi. Faz 5A'da 342'ydi; **+46 test.**

**Migration eklenmedi.** Şema Faz 2'de kapandı ve bu faz onu doğruladı: seans yazma,
şablon üretimi ve Bugün projeksiyonunun hiçbiri yeni sütun istemedi.

### Fazın başında verilen karar: dört Rust eki yazıldı

`faz-05b.md` "arayüz fazı" diyordu ve yeni Rust mantığı gerekirse durup sormamı
istiyordu. Gerekti — 5A tablo CRUD'unu ve motoru yazmıştı ama ekranın istediği
**projeksiyonu ve yazma yolunu** yazmamıştı. Dördü de onaylandı ve `repo/schedule.rs`'e
girdi:

| Ne | Sözleşme | Neden 5A'da yoktu |
|---|---|---|
| `day_rows(day)` · `session_rows_between(from, to)` | Ekranın satırı: branş + grup/öğrenci adı, o günkü **canlı** üye sayısı, yoklama durumu | `academic::sessions_on` ham `session` satırı döndürüyor; ad da sayı da yok |
| `save_session(input, today)` | Tek seferlik **ya da** haftalık; tatile ders eklenmez (K-2) | `insert_session` tablo CRUD'u; K-2 ve süre doğrulaması hiçbir yerde birleşmiyordu |
| `template_preview` · `apply_template` | E6: kaynak haftayı **şablona çevirir** (ADR-028) | Hiç yoktu |
| `is_closed_day` · `local_now` · `has_schedule` | Komut yüzeyi | `is_closed_day` fonksiyonu vardı, komutu yoktu |

`session_rows_between` bilerek aralık alıyor: üye sayısı **satırın kendi gününe** göre
hesaplandığı için 5C'nin haftalık takvimi aynı fonksiyonu ikinci bir sorgu yazmadan
kullanabilir.

`has_schedule` sonradan gerekti ve gerekçesi R1.7'de yazılı: **boş bir gün listesi iki
ayrı durumu üretiyor** — "program hiç kurulmamış" ile "program var, bugün ders yok".
İkisi farklı cümle söylemek zorunda ve ayrımı başka hiçbir şey veremiyor.

### Üç kural, üç ayrı davranış

Fazın en çok karıştırılabilecek yeri buydu; PRD §7'nin ilkesi ekranda görünür hâle geldi:

| Kural | Davranış | Nerede |
|---|---|---|
| **K-2** tatil | **ENGELLER** | Tarih seçilir seçilmez sorulur; Kaydet kapanır. Son söz Rust'ta |
| **K-1** çakışma | **UYARIR** | Kaydetmeden önce çakışan dersin **adıyla** + "Yine de ekle" |
| Geçmiş tarih | Yalnızca söyler | Uyarı satırı; kaydetmeyi engellemez |

Çakışma kontrolü bilerek `save_session`'ın **içinde değil**: orada olsaydı kullanıcının
"Yine de ekle" onayı program tarafından geri alınabilir hâle gelirdi.

### Ekranlar

| Ne | Nerede |
|---|---|
| Bugün ekranı — saat sıralı liste, "şimdi" çizgisi, R1.2 amber satır | `src/pages/bugun/TodayPage.tsx` |
| Saf hesaplar (sıralama, çizgi koşulu, yoklama bekleyen) — testli | `src/pages/bugun/today.ts` |
| E3 ders ekle / düzenle (`Modal` 384px) | `src/pages/dersler/SessionForm.tsx` |
| Ertele · İptal et · Sil (kapsam üçlüsü) | `SessionActions.tsx` |
| E6 şablondan oluştur — önizleme + uygula | `TemplateModal.tsx` |
| Alan doğrulaması — Rust `validate_session`'ın ikizi | `dersler/validate.ts` (testli) |

`ui/Table`'a **`hideHeader`** eklendi: "şimdi" çizgisi listeyi ikiye böldüğü için iki
tablo çiziliyor ve başlık iki kez yazılmamalı. R1.2'nin istediği amber zemin + sol şerit
`Table.rowAttention` üzerinden geliyor — ikinci bir satır stili üretilmedi.

### Bu fazda alınan kararlar

**ADR-028 — "Şablondan oluştur" haftayı şablona çevirir, kopyalamaz.** Kopyalama N hafta
sonra takvimi yeniden boşaltır ve kullanıcıyı aynı işleme geri gönderirdi; şablon bir kez
tanımlanır, motor ufka kadar üretir. Önizleme onaydan **önce** kaç ders ve hangi tarihler
olduğunu söylüyor; şablonu zaten olan ders atlanıyor ve **sayılıyor**.

**ADR-029 — "Şimdi"nin tek kaynağı var.** `local_now` komutu; arayüz ekranda görünen
hiçbir hesap için `new Date()` çağırmıyor. `new Date()` yanlış saat dilimi vermez ama
**ikinci bir kaynaktır**: gece yarısını geçen bir oturumda başlık dünü, "şimdi" çizgisi
bugünü gösterirdi.

Üç küçük karar daha, ADR açılmadı çünkü yeni bir ilke değil mevcut kuralların uygulaması:

- **Düzenlemede dersin hedefi kilitli.** Grubu/öğrencisi devredilebilseydi o dersin
  yoklaması, borcu ve geçmişi başkasına geçerdi. Doğrusu iptal edip yenisini açmak;
  `academic::update_session` bu alanları zaten yazmıyor.
- **"Yoklama al" düğmesi konmadı.** Tasarımda var ama yoklama Faz 6'da. Faz 4'ün "Aç"
  kolonu kararıyla aynı: çalışmayan düğme koymaktansa durumun kendisi yazılı
  (`Yoklama girilmedi` / `Bekleniyor` / `6/6 katıldı`).
- **Yan panelin üç bölümü "yok" değil "yakında" diyor.** `student_debts` komutu çalışıyor
  ama faz komutu borç listesini Faz 8'e bağlamış; kontrol edilmemiş bir şeyi
  "borçlu öğrenci yok" diye sunmak yanlış olurdu (R1.6 bölümlerin **yerinde** kalmasını
  istiyor, boş cümle uydurulmasını değil).

### Gerçek uygulamada doğrulananlar

Ekran, `swiftc` ile derlenen CGEvent tıklayıcısıyla sürüldü (System Events'in `click at`
komutu WKWebView'a ulaşmıyor — kalıcı bellekte yazılı).

| Ne | Kanıt |
|---|---|
| **K-2 engelliyor** | Bugün Pazar = haftalık kapalı gün → tarih altında kırmızı uyarı, **Kaydet düğmesi kapalı**. Aynı cümle Rust'takiyle birebir aynı |
| **Saat sırası + "şimdi" çizgisi** | `00:15 → ŞİMDİ → 09:00 → 18:00`. Çizgi yalnızca hem geçmiş hem gelecek varken |
| **R1.2** | 00:15 dersi amber zemin + sol turuncu şerit + `Yoklama girilmedi`; başlıkta `3 ders · 1 yoklama bekliyor` |
| **İki ayrı boş durum** | Ders yokken `Bugün planlanmış ders yok · Program tanımlı; bugüne ders düşmemiş` — R1.7'nin yönlendirme metni değil, çünkü program var |
| **Kapsam sorusu** | Şablonsuz derste **tek** seçenek; şablona bağlıda **üç**, en dar başta, hiçbiri önceden seçili değil |
| **İptal ≠ silme** | "Sadece bu ders" → *"Ders iptal edildi; şablonda yerinde kalıyor."* Satır listede `İptal` rozetiyle kaldı, yoklama sayacı düştü |
| **Düzenleme** | Satıra tıklayınca `Dersi düzenle`; süre 90 dk doğru okundu (18:00–19:30), tekrar seçeneği gizli, hedef kilitli uyarısı yazılı |

Ekran görüntüsüyle **bir hata yakalandı ve düzeltildi:** ders tablosunun kolon başlıkları
grup detayının tablo etiketlerini ödünç alıyordu (`Seans geçmişi`, `Grup öğrencileri`).
Artık kendi başlıkları var: `Saat · Ders · Öğrenci · Yoklama · İşlem`.

Deneme için veritabanına elle eklenen seanslar sonrası `npm run seed -- --reset`
çalıştırıldı — geliştirme veritabanı temiz.

### Doğrulanmayanlar

| Ne | Neden |
|---|---|
| **E6 gerçek uygulamada** | Rust testleri var (önizleme, atlama, uygulama) ve modal derleniyor; ekranda sürülmedi. Tetikleyicisi boş takvim ve **takvim 5C'de** — 5C'nin ilk doğrulaması bu olmalı |
| **Haftalık tekrarla ders ekleme** | Rust testi var (`haftalik_ders_sablon_acar_ve_seanslari_uretir`, 16 seans). Arayüzden denenmedi: bugün kapalı gündü ve K-2 doğru şekilde engelledi |
| **Ertele diyaloğu** | Rust reddi testli (R3.13); modal ekranda açılmadı |

---

## Faz 5A — tamamlandı (özet)

Seans üretim motoru, tanımlar ve gruplar. `repo/schedule.rs`'in 5A yüzeyi:

| Fonksiyon | Sözleşme |
|---|---|
| `generate_sessions(today)` | Ufka kadar (`session_horizon_weeks`, 16) eksikleri üretir; **idempotent**, tatili atlar, iptal edilmişi diriltmez, **geçmişe üretmez** |
| `detect_conflicts` | Çakışan derslerin **adıyla** listesi; bitişik ders çakışma saymaz |
| `delete_sessions(id, scope)` | `Only` / `Following` / `All`; işlenmiş ders hiçbir kapsamda silinmez |
| `cancel_session` · `reschedule_session` | `status='cancelled'` (satır durur) · yoklaması alınmışı reddeder (R3.13) |
| `group_rows` · `group_detail` · `save_group` | Grup projeksiyonu; grup + haftalık program tek transaction, ardından üretim (R5.5) |
| `add_group_member` · `end_group_membership` · `group_capacity` | Kapasite **kontrol edilmez** (S2), çakışan açık kayıt **engellenir** (K-22) |

**Açılışta çalışıyor:** `repo::ops::on_startup(conn, today)` → `lib.rs`. Hata uygulamayı
açmayı engellemez. Faz 7/8'in vade tahakkuku aynı yere girecek.

**5A'nın üç kararı** (hâlâ geçerli, kod yorumlarında gerekçeleriyle):

1. **Şablona bağlı tek seans "silinince" arşivlenmiyor, İPTAL ediliyor.**
   `ux_session_series_slot` kısmi bir indeks (`WHERE deleted_at IS NULL`): arşivleme slotu
   boşaltır ve üretim dersi ertesi açılışta geri yazar. 5B'nin bildirimi bunu doğru
   anlatıyor ve gerçek uygulamada doğrulandı.
2. **Üretim geçmişe seans yazmıyor** (`max(series.starts_on, today)`) — olmamış bir ders
   icat etmek olurdu.
3. **Grup seansında `unit_price` boş kalıyor**, sıfır yazılmıyor: `resolve_unit_price`
   zincirinde sıfır "bu ders bedava" anlamına gelen sessiz bir yedek üretirdi (§5).

Ekranlar: `pages/tanimlar/` (branşlar, tatil günleri) · `pages/gruplar/` (liste, detay,
form). `paginate` ADR-025 gereği `lib/paginate.ts`'te ortak.

---

## Kapanmış fazlar (kısa)

| Faz | Ne kaldı geriye |
|---|---|
| **Faz 4** — Öğrenci & Veli | `repo/roster.rs` projeksiyonu, 11 komut, liste/detay/form ekranları. §0'da ADR-024 marka geçişi yapıldı; kimlik `src-tauri/tests/identity.rs` + `src/config/brand.test.ts` ile mühürlü |
| **Faz 4 denetimi** (yönetici) | 59 kontrol temiz, 10 bulgu, 0 çürütüldü. **Para tarafı canlı `sqlite3` ile kanıtlanmış temiz** — ADR-022 zincir paritesi dahil. ADR-026 buradan çıktı |
| **Faz 4.5** — denetim artıkları | Beş maddenin beşi de yapıldı: veli araması ikinci veliyi görüyor · bakiye altyazısı üç durumu ayırıyor · alt çubuk görünen listeyi topluyor (ADR-026) · telefon maskeli (ADR-027) · K-14 uyarısı borç tutarını yazıyor |

---

## CI — yeşil, ve kök neden `.npmrc`'ydi

CI #1–#3 hep `npm ci`'nin `EUSAGE`'ıyla düştü. **İlk iki teşhis yanlıştı** (Windows,
sonra `node-version: 22`). Doğru teşhis ölçülerek bulundu:

| Ne | Sonuç |
|---|---|
| CI'daki sürümler | `node v22.21.1`, `npm 10.9.4` — **yerelle birebir aynı** |
| Aynı kilit dosyası, yerelde npm 10 / 11 / 12 | üçü de **geçiyor** |
| Aynı kilit dosyası, `--legacy-peer-deps=false` | **CI'daki hatanın aynısı** ✅ |

Kök neden: makinenin `~/.npmrc`'sinde `legacy-peer-deps=true` var. Kilit dosyası o ayarla
üretildiği için geçersiz bir akran kenarı içeriyordu (`fdir` → `picomatch@2.3.2`) ve aynı
ayar `npm ci`'nin doğrulamasını da kapattığı için hata **yerelde hiç görünmüyordu.**

Düzeltme: proje köküne `.npmrc` (`legacy-peer-deps=false`) + kilit dosyası yeniden
üretildi. Gerekçe `CLAUDE.md > Stack`'te yazılı. **`Test · windows-latest`'in yeşil
olması şemanın Windows'ta kurulduğunun kanıtı** — testler gerçek migration'ları uyguluyor
(ADR-008: `.msi` indirilmiyor, sıfır olmayan boyutta üretilmesi yeterli).

---

## Doğrulanmayan / bilinçli ertelenenler

| Ne | Neden |
|---|---|
| **Birebir şablonun düzenleme ekranı yok** | Gruba bağlı şablonlar `GroupForm`'dan düzenleniyor; E6 birebir şablon da üretebiliyor ve onun tek yönetim yolu "Tüm seri" ile kaldırmak. Öğrenci detayının `Dersler` sekmesi Faz 6'da doluyor — doğru yeri orası (ADR-028'de not düşüldü) |
| Öğrenci detayında `Kayıtlar` sekmesi | `faz-04.md §3` sekmeleri sabitledi; `enrollment` **yazma** yolu grup detayından geldi, öğrenci tarafındaki okuma sekmesi hâlâ yok |
| `NoteList` / `NoteComposer` ayrı komponent | Tek ekranda kullanılan desen için `src/ui/`'ya çıkarmak erken soyutlama olurdu |
| Grup detayında not **silme** | Notun sahibi öğrenci, silme yolu orada. İkinci bir yol aynı kaydı iki ekrandan yönetmek olurdu |
| `search_students` komutu | Faz 2'den beri atıl; `student_list` aramayı da yapıyor. Faz 8/9'da kullanılmazsa kaldırılacak |
| `npm audit` 12 "high" | Hepsi eslint/vite geliştirme araç zincirinin bilinen uyarıları; teslim edilen pakete girmiyorlar |
| Gün değişince ekranın tazelenmesi | ADR-029'da kabul edilen sınır: zamanlayıcı eklemek, gece yarısı ekranın kullanıcının altından değişmesi demekti |

---

## Açık sorular — cevabını senden bekliyorum

`docs/PRD.md` §9'da gerekçeleriyle. **S1 (ADR-021), S2, S4 ve S8 cevaplandı.**
**Faz 5C'yi bekleten açık soru yok** — 5C'nin kendi kararı (takvim kütüphanesi) bir
ADR konusu, açık soru değil.

| # | Soru | Hangi faz |
|---|---|---|
| S3 | Paketlerin son kullanma tarihi var mı? | Faz 7 |
| S6 | Dönem ortasında ayrılanın kalan paket parası iade mi, alacak mı? | Faz 7 |
| S5 | Makbuz numarası otomatik mi artsın? | Faz 8 |
| S7 | "Devam oranı" hangi pencerede hesaplansın? | Faz 9 |
| S9 | Bilgisayarındaki Windows sürümü ne? | Faz 10 öncesi |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 |

> S7 için Faz 4 bir **varsayım** kullandı: devam oranı tüm işlenen dersler üzerinden
> hesaplanıyor ve kartın altında "Tüm işlenen dersler" yazıyor. Faz 9 pencereyi
> değiştirirse tek bir yer değişir (`StudentDetailPage > SummaryStrip`).

---

## Faz 6'ya devreden açık karar

`ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil olduğu için düzeltme zincirinin
üçüncü adımında ikinci `delta = −1` yazılamıyor. **Defter tarafı ADR-022 ile kapandı**;
bu, ders hakkı sayacının ayrı sorunu (ADR-015: iki ayrı sayaç). Seçenekler
`faz-06.md §3b`'de.

---

## Sonraki oturumun en büyük riski — takvim (5C)

**Windows artık boş bir varsayım değil**: CI yeşil, migration'lar orada uygulanıyor,
`.msi` üretiliyor. Kalan risk tek bir ekranda toplanıyor.

Takvim ızgarası projenin WebView2 farklarına **en duyarlı** parçası: sürükle-bırak, mutlak
konumlu bloklar, saat hesapları ve Segoe UI altında kolon genişlikleri. CI bunu
**çalıştırmıyor** — testler jsdom'da koşuyor, paket işi yalnızca derliyor. Yani 5C
bittiğinde elimizde "yeşil CI" olacak ama ekranın Windows'ta nasıl göründüğüne dair
hiçbir kanıt olmayacak. Kilometre taşı bu yüzden 5C'nin sonunda: **ilk gerçek Windows
testi**, Faz 10'a bırakılmıyor.

İkinci risk kararın kendisinde: **hazır kütüphane mi, elde mi.** `/faz-05c` bunu koddan
önce ADR olarak istiyor. Ölçülmesi gerekenler — paket boyutu, Türkçe yerelleştirme,
`tokens.css` ile uyum, sürükle-bırağın WebView2'de çalışıp çalışmadığı — tahminle
geçilirse yanlış tarafa dönmenin bedeli bir ekranın tamamı olur.
