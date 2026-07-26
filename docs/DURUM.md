# Durum

**Son güncelleme:** 2026-07-26 · Faz 5C (takvim ekranı)
**Mevcut faz:** Faz 5C ✅ kod tamam, `npm run check` yeşil → sırada **push + CI + ilk
Windows testi**
**Sonraki oturumda ilk iş:** CI'ın `Test · windows-latest` işi yeşil mi ve artefakt
kutusunda **sıfır olmayan boyutta** bir `.msi` var mı. Üç fazın kodu (5B + 5C-K + 5C) ilk
kez Windows'ta derleniyor; kırılırsa hangi fazdan geldiği aramayla bulunacak.

> **Faz 5 bitti.** Takvim elde yazıldı (ADR-031), sürükleme Pointer Events üzerinde
> kuruldu (ADR-030), taşımanın kapsamı **ADR-032** ile netleşti. `npm run check` yeşil:
> **481 test** (293 TypeScript + 188 Rust). Faz 5C-K'de 411'di; **+70 test.**

---

## Faz 5C — takvim ekranı

### Ne yazıldı

| Katman | Dosya | İş |
|---|---|---|
| Saf geometri | `pages/takvim/calendarGrid.ts` | Aralık, şerit algoritması, saat cetveli, "şimdi" konumu, açılış kaydırması, tarih gezinmesi |
| Saf sürükleme | `pages/takvim/drag.ts` | 5px eşiği (**yarıçap**), 30 dk kilidi, sütun/saat kenetlemesi, K-2 hedef denetimi |
| Ekran | `CalendarPage.tsx` · `WeekGrid.tsx` · `MonthGrid.tsx` · `MoveDialog.tsx` · `filters.ts` | Ay/Hafta/Gün, branş çipleri, dört boş durum, sürükle-bırak, kapsam sorusu |
| Rust | `repo/schedule.rs` + iki komut | `closed_days_in_range` · `reschedule_sessions` (R3.8) |

Rust'a **iki fonksiyon** eklendi ve ikisi de gerekliydi (`faz-05c §3` "eksik olabilecek
tek şey" diyordu, ikisi de o listede değildi):

- **`closed_days_in_range`** — ızgara kapalı günleri **tek bir anlık görüntü** olarak
  görmeli. Gün gün `is_closed_day` sorulsaydı iki gün arasında ayar değişince hafta
  yarısı eski yarısı yeni kurala göre çizilirdi.
- **`reschedule_sessions`** — R3.8'in kapsam sorusunun arka tarafı. Gerekçesi ve bıraktığı
  iz **ADR-032**'de; özeti: şablon yerinde güncellenmiyor, eski seri kapanıp yenisi
  açılıyor, çünkü `weekday`'i değiştirmek geçmiş dersleri yeni şablona ait göstermek olurdu.

`session_rows_between` 5B'de aralıklı yazılmıştı ve takvim onu **ikinci bir sorgu
yazmadan** kullandı — 5B'nin o kararı burada karşılığını verdi.

### Gerçek veri iki hata yakaladı — ikisi de testten değil, ekrandan çıktı

**1 · Şerit hesabı gün başına yapılmıyordu.** `placeBlocks` bütün haftayı tek çağrıda
alıyordu ve algoritma **yalnızca zamanı görüyor**: Pazartesi 16:00 ile Çarşamba 16:00
çakışan iki ders sayıldı, ikisi de yarım genişlikte çizildi ve çakışma konturu aldı.
Uygulamayı `npm run seed` verisiyle ilk açışta ekran görüntüsünde görüldü. Denemenin tek
sütunu bu hatayı **gösteremezdi** — `DURUM > Kalan riskler §3`'ün tam olarak uyardığı şey.
Düzeltme çağıran tarafta (`WeekGrid` gün başına bir çağrı yapıyor); algoritmanın
sözleşmesi artık testte yazılı.

**2 · `/dev/durum` metinleri üretim paketine sızıyordu.** `/faz-05c §3`'ün 8. notu
kapıya `/dev/durum` işaretçileri eklenmesini istiyordu; eklendi ve kapı **hemen kırmızı
yandı**. Sebep sayfanın kendisi değil: `tr.status` bloğu `i18n/tr.ts` içindeydi ve o dosya
her ekrandan statik `import` ediliyor, yani içindeki her dize pakete giriyor — komponent
ölü dal elenmesiyle çıksa bile. Metinler `src/dev/status.tr.ts`'e taşındı (Showcase'in
`showcase.tr.ts` deseninin aynısı) ve paket temizlendi. **Kapıya bir işaretçi eklemek
bir bulgu üretti** — liste eksikken kapı "temiz" diyordu.

### Fazın çözdüğü üç devir notu

| Not | Ne yapıldı |
|---|---|
| **6 · aralık dışı ders görünmezdi** | `DAY_START_MIN`/`DAY_END_MIN` sabit değil; `gridRange` görünen derslere göre **tam saate yuvarlayarak genişliyor**. Hepsi aralık içindeyse varsayılan 08:00–22:00 aynen kalıyor. Gece yarısını aşan ders gün sonunda kırpılıyor, ertesi güne sarkmıyor |
| **7 · `toMinutes` ikizi** | Üçüncü ayrıştırıcı doğmadı: `formatTime` + `timeToMinutes` zinciri kullanılıyor. Bozuk saat artık `NaN` dilim üretmiyor — satır `Layout.unreadable`'a düşüyor ve ekranda **uyarı olarak yazılıyor**, adı düğme; tıklayınca ders açılıp saati düzeltilebiliyor. Sessizce kaybolan ders yok |
| **8 · kapı dev sayfasını görmüyordu** | `FORBIDDEN` listesi `/dev/durum` işaretçileriyle genişledi (yukarıdaki 2. bulgu buradan çıktı) ve `DEV_ROUTES` yorumu kuralı yazılı hâle getirdi: buraya eklenen her sayfanın kapıda kendine özgü bir işaretçisi olmak zorunda |

Deneme rotası ve dosyaları **silindi** (`/dev/takvim-denemesi`, `CalendarSpike.*`,
`dev/calendarGrid.*`); testleri `pages/takvim/calendarGrid.test.ts`'e taşındı ve
büyüdü (11 → 30).

### Bu fazda alınan üç küçük karar (ADR açılmadı — mevcut kuralların uygulaması)

- **Kaydırmayı ızgaranın kendisi yapıyor, sayfa değil.** `PageContent`'e `fill` seçeneği
  eklendi: kabuk kaydırıcısını kapatıp boyu çocuğa veriyor. Devir notu 4'ün iki ucu da
  karşılandı — sarmalayıcı atlanmadı (iki deneme de o yüzden kırpılmıştı) ama gün
  başlıkları `sticky` kalabiliyor ve açılışta ızgara "şimdi"ye kayabiliyor.
- **Bildirim eylem taşıyabiliyor.** `ToastProvider` isteğe bağlı bir düğme alıyor ve
  eylemli bildirim 2200 ms yerine 6000 ms duruyor: 2200 ms bir düğmeyi fark edip
  tıklamaya yetmiyor. Bugün tek kullanıcısı R3.12'nin "Geri al"ı.
- **`tr.calendar` ikiye ayrıldı.** Gün/ay adları `tr.dates`'e geçti, `tr.calendar` takvim
  ekranının metni oldu. Aynı ad altında bir sözlük ile bir ekranın metni duruyordu.

### Sürükleme (ADR-030) — nerede ne duruyor

Eşik, 30 dk yuvarlaması ve kenetleme `drag.ts` içinde ve **DOM'suz**; ölçüm (`sütun
genişliği`, `dilim yüksekliği`) `WeekGrid`'de ve **ekrandan okunuyor** — Segoe UI
metrikleri ve DPI ölçeklemesi bilinmediği için sabit piksel yazılmadı. Dilim yüksekliği
sütunun boyundan türetiliyor, böylece yoğunluk anahtarı sürüklemeyi de kendiliğinden
takip ediyor; ikinci bir yerde `30px` yazılı değil.

5px karşılaştırması **yarıçap** (Öklid), kare değil: `|dx|≤5 && |dy|≤5` kuralında 4px
sağa + 4px aşağı (5.66px) hâlâ tıklama sayılırdı. `/faz-05c-karar` react-big-calendar'ı
tam olarak bunun için elemişti; kendi uygulamamız o hatayı tekrarlamıyor ve testi var.

### Doğrulananlar ve doğrulanmayanlar

Gerçek uygulama `npm run seed` verisiyle açıldı ve ekran görüntüsüyle yakalandı:

| Ne | Kanıt |
|---|---|
| Haftalık ızgara gerçek veriyle | 20.07–26.07 haftası; blok başlıkları, grup üye sayısı (`3`, `2`), birebir etiketi, branş rengi sol şeritte |
| Kapalı gün | Pazar sütunu taralı + `Tatil` etiketi, başlığı soluk |
| Branş çipleri | `Fizik 2 · İngilizce 1 · Matematik 5` — sayılar görünen haftadan |
| ⚠️ **Şerit hatası** | Yukarıdaki 1. bulgu; düzeltme sonrası ekran görüntüsüyle **doğrulandı** |
| Izgaranın kendi kaydırması | 08:00–20:00 arası kaydırıldı, gün başlıkları yerinde kaldı, açıklama şeridi altta sabit |

**Sürükleme jesti, kapsam diyaloğu, E6 ve haftalık tekrar ekranda sürülemedi.** Sebep
uygulama değil ortam: bu makinede **eşzamanlı çalışan ikinci bir otomasyon oturumu**
işaretçiyi ve ön plandaki pencereyi sürekli devralıyordu; gönderdiğim tıklamalar onun
tarayıcısına düştü. Israr etmek kullanıcının öteki işini bozacaktı, bırakıldı.

Yerine **jsdom arayüz testleri** yazıldı (`pages/takvim/calendar.test.tsx`, 15 test):
5px altı hareket dersi açıyor · şablona bağlı ders sürüklenince kapsam soruluyor ve
**soru sorulmadan hiçbir şey yazılmıyor** · şablonsuz ders sorulmadan taşınıyor ve
bildirim geri alınabiliyor · kapalı güne bırakılınca **hiçbir çağrı yapılmıyor** · dört
boş durumun dördü ayrı ayrı · ay/gün görünümünün sorduğu aralık. Rust tarafında da
`reschedule_sessions` kapsam kapsam testli (64 seans testi).

> Bu, ekranda sürmenin yerine geçmez ve öyle sayılmıyor. **Sürükleme jestinin gerçek
> ekranda çalıştığı hâlâ doğrulanmadı** — Faz 6 açılışında ilk iş bu olmalı, kurs
> sahibinin Windows testi de aynı şeye bakacak.

---

## Faz 5C-K denetimi (yönetici) — 7/7 kilitli kontrol temiz, üç bulgu

Kod yazılmadı. **Yedi kilitli kontrolün yedisi de temiz** (SQL · float para · saklanan
bakiye · hard delete · çıplak Türkçe · platform API · ADR-029). §4'ün iki ikizi kaynaktan
karşılaştırıldı ve tutuyor: `groupThousands` `money::format_kurus`'un döngüsünün aynısı
(aynı `(len − i) % 3` koşulu), `normalizeTr` de `text::search_name`'in — `I`/`İ` elde,
gerisi yerelden bağımsız. `upperTr`'nin Rust ikizi **yok ve gerekmiyor**: yalnızca ekran
etiketi, veri anahtarı değil.

Denetimin çıktısı aşağıdaki **6, 7 ve 8 numaralı devir notları**; üçü de `/faz-05c`
komutuna madde olarak yazıldı (§1, §3 ve §4'ün test listesi). Ağırlığı taşıyan tek madde
6: karar oturumu bunu göremezdi, çünkü deneme sabit üç blokla çalıştı — gerçek ders verisi
ızgaraya hiç girmedi.

Denetim **ADR açmadı**: üçü de mevcut kuralların uygulanması, yeni bir ilke değil.
Aralığın genişlemesi `EKRANLAR §122`'nin ihlali değil, tanımsız bıraktığı durumun
kapatılması.

---

## Faz 5C-K — takvim kütüphanesi kararı (ADR-031) + para biçimlemesi

Bu oturumda **üretim kodu iki dosyada değişti** (§4 düzeltmesi); geri kalanı ölçüm,
deneme ve belge. `npm run check` yeşil: **411 test** (231 TypeScript + 180 Rust).
Faz 5B'de 388'di; **+23 test.**

### Karar: elde yazılır

| Aday | Nerede elendi |
|---|---|
| **Bryntum Calendar 7.3.4** | Ölçüt 2 — lisanslı tarball'a **403** (*"only has access for trial packages"*); elde edilebilen tek şey deneme ve **deneme lisans değil**. Ölçüt 1 — deneme paketi `bryntum.com/verify/`e `new Image()` beacon'ı atıyor, `localStorage`'da 45 günlük yerel kapatma var, `postinstall.js` her `npm install`'da proje kökünde `spawnSync('node', …)` çalıştırıyor |
| **FullCalendar 6.1.21** | Ölçüt 5 — gün başlığının `aria-label`'ı ve hafta numarası dışarıdan **geçersiz kılınamayan** `Intl` çağrılarından geçiyor; ayrıca `index.js:77` argümansız `toLocaleLowerCase()` (Türkçe Windows'ta `I` → `ı`). Ölçüt 6 — `minDistance = ev.isTouch ? 0 : …` |
| **react-big-calendar 1.20.0** | Havuzda yoktu, **karşıt doğrulamada çıktı.** Ölçüt 1, 2 ve 5'te en iyi aday (ağ çağrısı 0, MIT, `Intl` 0). Ölçüt 6 — `var clickTolerance = 5` modül sabiti, dışarıdan verilemiyor; karşılaştırma kare (Chebyshev), yarıçap değil |
| **Elde** | Elenmedi. Izgara **840px / 616px, sapma 0px**; şerit algoritması 40 satır, **11 testi ilk koşuda geçti**; geçersiz kılınan CSS satırı **0** |

### Bu oturumun iki metodolojik dersi

**1 · Ölçüt 1'in grep listesi eksikti ve bunu ancak çürütme yakaladı.** Bryntum'un ağ
çıkışı `fetch`/`XHR`/`sendBeacon` değil, bir **`Image().src`**. Ölçüt lafzıyla
uygulansaydı Bryntum ölçüt 1'i *geçmiş* görünecekti. ADR-031 listeyi genişletti:
`new Image()` · `.src =` · `createElement('script')` · dinamik `import()` · `new Worker` ·
`new WebSocket` · `EventSource`. *Aradığı şeyin bilinen bütün taşıyıcılarını saymayan bir
eleme ölçütü ölçüt değil, ritüeldir.*

**2 · Üç adaylık havuz sınırı, ölçütleri daha iyi geçen bir adayı gölgede bırakabiliyor.**
react-big-calendar üç ölçütte FullCalendar'dan iyi çıktı ve havuza "en popüler kütüphane"
mantığıyla girmemişti. Ölçülüp ADR'ye yazıldı; sınır oyalanmaya karşı bir disiplin,
bulguyu saklamanın gerekçesi değil.

### §4 · Para biçimlemesi — B1 kapandı, iki ikiz artık aynı algoritmayı koşuyor

| Ne | Önce | Sonra |
|---|---|---|
| `formatKurus` binlik ayıracı | `lira.toLocaleString('tr-TR')` | `money.rs`'teki döngünün **birebir aynısı** (`groupThousands`) |
| `Avatar` baş harfleri | `toLocaleUpperCase('tr')` | yeni `upperTr` — `i→İ`, `ı→I` elle, gerisi `toUpperCase()` |
| `normalizeTr` | `ch.toLocaleLowerCase('tr')` | `ch.toLowerCase()` — Rust ikizi `search_name` de `char::to_lowercase` kullanıyordu, **asıl ayrışan taraf TS'ti** |

Artık `src/` içinde ekrana giden **tek bir `toLocale*` çağrısı yok**; ADR-030'un ICU
satırı ("`toLocale*` çağrısı yapılmaz") bir hedef değil, **doğru bir cümle.**

Testin kendisi de bir bulguya dönüştü: vitest Node'un tam ICU'suyla koşuyor, yani
"yeşil test" `Intl`'e bel bağlamadığımızın kanıtı **değildi**. Yeni `ICU bağımsızlığı`
bloğu `Number.prototype.toLocaleString` ile iki `String.prototype.toLocale*`'ı bilerek
bozuyor ve çıktının değişmediğini gösteriyor. İçinde bir **kontrol grubu** de var
(`taklit gerçekten ısırıyor`) — o olmasaydı, taklit hiç çalışmasa bile testler geçerdi.

`ui/Picker.tsx`'in `new Date()` yedeğine dokunulmadı: ADR-029'un istisna listesinde adıyla
yazılı, kapanmış karar.

### Denemeden çıkan iki yan bulgu

- **Import'ta büyük/küçük harf çakışması yakalandı.** `CalendarSpike.tsx` ile
  `calendarSpike.ts` yalnızca harf büyüklüğünde ayrılıyordu; macOS sessizce yanlış dosyayı
  çözdü, `tsc` TS1261 ile bağırdı. `CLAUDE.md > Windows`'un tam olarak uyardığı sınıf —
  dosya `calendarGrid.ts` oldu. **CI'a gitmeden yerelde yakalandı.**
- **Uygulama kabuğu tarayıcıda ölçülemiyor gibi görünmüştü;** neden vite'in eski modül
  grafiğiydi (yeniden adlandırılan dosyayı arıyordu), projede hata yok. Izgara ölçümü
  yine de **kabuktan bağımsız** bir sayfada alındı — yerleşim ölçerken Tauri'yi
  denklemden çıkarmak doğru olan. Harness iki dosyaydı ve ölçüm sonrası silindi.
- **Tarayıcı aracının pencere yeniden boyutlandırması bu ortamda çalışmıyor**
  (`innerHeight` 700 istendiğinde 956 kaldı). 700px koşulu kabı sınırlayarak taklit
  edildi; CSS açısından eşdeğer ama literal bir pencere testi değil. Gerçek doğrulama
  `/faz-05c` sonundaki Windows testinde.

### `/faz-05c`'ye devreden sekiz not

> 6–8 karar oturumundan değil, onu izleyen **yönetici denetiminden** çıktı; üçü de
> `/faz-05c` komutuna madde olarak yazıldı.

1. **Sürükleme bizim.** Hiçbir aday Pointer Events kullanmıyor (`setPointerCapture`
   üçünde de 0). ADR-030 baştan sona bizim uygulayacağımız bir şey.
2. **Kenarda kendiliğinden kaydırma bütçelenmedi.** Sürüklerken işaretçi ızgaranın
   kenarına gelince ızgaranın kayması ayrı bir iş (FullCalendar bunu `AutoScroller` diye
   ayrı tutuyor). `/faz-05c` bunu ya kapsama alır ya açıkça dışarıda bırakır.
3. **Şerit algoritması "genişletme" yapmıyor, gerekmiyor da.** Denemedeki sürüm eşit
   genişlikte şeritler veriyor; olgun bir yerleşim bloğu sağdaki boşluğa genişletir.
   `EKRANLAR §122` yalnızca şerit istiyor — kapsam orada tutulacak.
4. **Takvim sayfası `PageContent`'e sarılmalı.** Kaydırma alanı orada
   (`.content { overflow: auto }`); doğrudan `main`'e bağlanan bir sayfa kırpılır.
   İki deneme de (elde ve FullCalendar) bu tuzağa düştü ve ikisi de kırpıldı — kabukta
   hata yok, sarmalayıcı atlanmıştı. Denemenin kendi `.scroll` kabı **geçici**: gerçek
   ekranda kaydırmayı `PageContent` yapacak, açılışta "şimdi" çizgisine kaydırma da onun
   `scrollTop`'una yazılacak (`/faz-05c §4`'ün saf fonksiyon şartı burada karşılanır).
5. **`Date` → `'YYYY-MM-DD'` çevirisinde `toISOString()` kullanılmayacak.** FullCalendar
   denemesi bu hataya düştü ve bulgu bizim için de geçerli: `toISOString()` UTC'ye
   çevirir, İstanbul (+03:00) gibi dilimlerde tarihi **bir gün geriye** kaydırır. Daha
   kötüsü sessizdi — başlık karşılaştırması aynı hatayı yaptığı için ekran doğru
   görünüyordu. `lib/format.ts > dateToIso` doğru olanı yapıyor (`getUTC*`, girdisi
   `Date.UTC` ile kurulmuş); yeni yazılacak her yer ondan geçmeli, elde `Date` ayrıştırmamalı.
6. **08:00–22:00 dışındaki ders takvimde görünmez olurdu.** `EKRANLAR §122` aralığı
   sabitliyor ama **ders saatini hiçbir şey kısıtlamıyor** — ne `validate.ts` ne Rust; 5B'nin
   kendi ekran görüntüsünde 00:15'lik bir ders var. Denemenin `topSlots`'u böyle bir derste
   **negatif** çıkıyor (`(15−480)/30 = −15.5`) ve blok kırpılan alana düşüyor. Veritabanında
   var, ekranda yok — kullanıcı takvime bakıp "o gün boş" der. `DAY_START_MIN`/`DAY_END_MIN`
   parametreye çevrilir, varsayılan 08:00–22:00 kalır, aralık dışı ders varsa ızgara tam
   saate yuvarlanarak **genişler** (`/faz-05c §1` + §4 testi).
7. **`toMinutes` ikinci bir zaman ayrıştırıcısı.** `calendarGrid.ts` kendi sürümünü yazmış;
   doğrulayan ikizi `lib/format.ts > timeToMinutes` zaten var ve bozuk girdide `null`
   dönüyor. Denemede zararsızdı, ekranda değil: bozuk saat `NaN` dilim → blok sessizce
   kaybolur.
8. **Deneme rotası taşınınca silinmeli — kapı onu görmüyor.** `scripts/verify-bundle.mjs`'in
   `FORBIDDEN` listesi yalnızca Showcase'e özgü dizeler içeriyor; `/dev/takvim-denemesi`
   (ve zaten `/dev/durum`) statik `import` edilse **sızar ve kapı susar**. Rota kalacaksa
   listeye kendi işaretçisi eklenir.

---


## Faz 5B denetimi (yönetici) — üç bulgu + ADR-030

Bu oturumda kod yazılmadı. Çıktısı: **ADR-030**, `/faz-05c-karar` komutu, `/faz-05c`'nin
yeniden yazılmış hâli ve aşağıdaki üç bulgu.

**Yedi kilitli kontrolün yedisi de temiz:** frontend'de SQL yok (ADR-002), float para yok
(ADR-003), saklanan bakiye sütunu yok (ADR-004), hard delete yok (ADR-005), JSX'te çıplak
Türkçe yok (ADR-007), platforma özel API yok (ADR-008), SQL'de çıplak `'now'` yok (§0).
ADR-029 da tutuyor — `today` her ekrana prop olarak iniyor. `ui/Picker.tsx`'teki
`new Date()` yedeği denetimde işaretlendi ve **geri çekildi**: ADR-029 onu istisna
listesinde zaten adıyla yazmış ve gerekçesini vermiş. Kapanmış karar, yeniden açılmadı.

### B1 · Para biçimlemesi Windows'ta ikizinden ayrılabilir → ✅ **KAPANDI** (5C-K §4)

`src/lib/format.ts` içinde `formatKurus` binlik ayıracını `lira.toLocaleString('tr-TR')`
ile üretiyor; Rust ikizi `src-tauri/src/money.rs` aynı işi **elle** yapıyor. Projenin
kendi kuralı (`format.ts > normalizeTr` yorumu, `tr.ts:801`) "WebView2'de ICU verisi eksik
olabilir" diyor ve bu varsayımı `toLocaleLowerCase` ile `toLocaleDateString`'e uygulamış —
`toLocaleString`'e uygulamamış. ICU düşerse `1.234,56` yerine `1,234,56` çıkar.

**Test bunu yakalayamaz**: vitest Node'un tam ICU'suyla koşuyor. İki ikiz yalnızca
kullanıcının Windows ekranında ayrışır. Düzeltmesi `money.rs`'teki döngünün aynısı.

### B2 · Izgara varsayılan Windows dizüstünde dikey sığmıyor → `/faz-05c §1`

`EKRANLAR §122`: 08:00–22:00 = 28 yarım saat. Rahat yoğunlukta **28 × 30px = 840px**
sadece ızgara (sıkı: 616px); üstüne gün başlığı, sayfa başlığı ve kabuk binecek.
`tauri.conf.json` pencereye `minHeight: 700` izni veriyor ve tipik bir 1080p Windows
dizüstü, Windows'un önerdiği ölçeklemede 864–720 CSS px yükseklik veriyor.

Sonuç bir tasarım kısıtı: ızgara **dikey kaydırmak zorunda** ve açılışta **"şimdi"
çizgisine kaydırmalı**. Faz komutu bunu yazmıyordu; `/faz-05c §1`'e kısıt olarak,
`§4`'e de test maddesi olarak eklendi (kaydırma konumu **saf fonksiyon** kalacak).

### B3 · Faz 5B CI'ı hiç görmedi — bilerek bekliyor

`origin/main` = `b8648f1` (Faz 5A). `c5773e2` yerelde: 22 dosya, 3898 satır, Windows'ta
bir kez bile derlenmedi. **Karar: push 5C sonuna bırakıldı**, üç fazın kodu (5B + 5C-K +
5C) tek seferde CI'a gidecek. Bedeli kabul edildi: bir şey kırılırsa hangi fazdan geldiği
aramayla bulunacak.

### Çerçeve düzeltmesi: "WebView2 riski" kısmen ters kurulmuştu

macOS'ta Tauri **WKWebView (WebKit)**, Windows'ta **WebView2 (Chromium)** kullanıyor.
Geliştirme **daha katı** motorda yapılıyor — WKWebView'da çalışan yerleşim Chromium'da
büyük ihtimalle çalışır, tersi doğru değil. Yani CSS/JS semantiği beklenenden az risk.

Gerçek Windows bilinmeyenleri şunlar: **Segoe UI metrikleri** (kolon genişlikleri),
**DPI ölçekleme** (B2), **kaydırma çubuğu genişliği**, **ICU verisi** (B1). Sürükle-bırak
ise seçime bağlı ve bu oturumda **ADR-030** olarak kilitlendi: sürükleme Pointer Events
ile kurulur. Gerekçe zevk değil gereksinim — `dragstart`'ın eşiğini tarayıcı belirlediği
için **R3.7'nin 5px kuralı HTML5 DnD üzerinde kurulamaz.** ADR-030 aynı zamanda
`/faz-05c-karar`'ın 6. eleme ölçütünün dayanağı: sürüklemeyi HTML5 DnD ile kuran bir
kütüphane ölçülmeden elenir.

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
| **E6 gerçek uygulamada** | Rust testleri var (önizleme, atlama, uygulama) ve modal derleniyor; ekranda sürülmedi. Tetikleyicisi boş takvim ve **takvim 5C'de** |
| **Haftalık tekrarla ders ekleme** | Rust testi var (`haftalik_ders_sablon_acar_ve_seanslari_uretir`, 16 seans). Arayüzden denenmedi: bugün kapalı gündü ve K-2 doğru şekilde engelledi |
| **Ertele diyaloğu** | Rust reddi testli (R3.13); modal ekranda açılmadı |

Üçü de `/faz-05c §5`'e madde olarak yazıldı ve tetikleyicileri (takvim) 5C'de doğdu — ama
**hâlâ ekranda sürülmediler**: 5C'nin doğrulama bölümündeki ortam sorunu üçünü de
kapsıyor. Rust testleri ve jsdom testleri yerinde; eksik olan gerçek uygulama denemesi.

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

## Kalan riskler — ve nereye bağlandıkları

**Windows artık boş bir varsayım değil**: CI yeşil (Faz 5A'da), migration'lar orada
uygulanıyor, `.msi` üretiliyor. Kalan risk tek bir ekranda toplanıyor ve ikiye ayrılıyor.

**1 · Ekranın Windows'ta nasıl göründüğüne dair kanıt yok.** CI ızgarayı
**çalıştırmıyor** — testler jsdom'da koşuyor, paket işi yalnızca derliyor. Yeşil CI bu
boşluğu kapatmıyor. Ama boşluk motor semantiğinde değil (yukarıdaki çerçeve düzeltmesi);
**Segoe UI metrikleri, DPI ölçekleme, kaydırma çubuğu genişliği ve ICU verisi**nde.
Dördü de somut ve ikisi (B1, B2) zaten bulguya dönüştü. Kilometre taşı yerinde duruyor:
**ilk gerçek Windows testi 5C'nin sonunda**, Faz 10'a bırakılmıyor — kurs sahibine
gönderilecek 5 maddelik listenin en az ikisi bu dördünü yoklayacak.

**2 · Kararın kendisi: hazır kütüphane mi, elde mi.** ✅ **KAPANDI — `ADR-031`.**
Elde yazılır. Ölçüldü, tahmin edilmedi: yedi ölçütün eşikleri ölçümden **önce** yazıldı,
üç kütüphane adayı paket kaynağından tarandı, ızgara gerçek tarayıcıda ölçüldü.

Yerine geçen risk — **elde yazmanın maliyeti** — 5C ile ölçüldü: **tek oturum.** Dürüst
tahmin 6–9 iş günüydü; ADR-031 §4 "belirgin şekilde aşılırsa karar yeniden açılır" diyordu,
aşılmadı, karar kapalı kalıyor. Tahmini düşüren üç şey gerçekten düşürdü: Türkiye'de yaz
saati yok (takvimin klasik olarak en pahalı parçası bedava), veri projeksiyonu Rust'ta
zaten bitmişti, ve şerit algoritması denemede yazılıp testiyle geçmişti.

**Kenarda kendiliğinden kaydırma kapsam dışı bırakıldı** (devir notu 2). Sürüklerken
işaretçi ızgaranın kenarına gelince ızgaranın kayması yazılmadı; sürükleme ekranda
görünen aralıkta çalışıyor. Gerekçe: 700px'lik bir pencerede bile ızgara 8 saatlik bir
dilimi gösteriyor ve 30 dk'lık taşımaların hemen hepsi o dilimin içinde. Gerekirse
`drag.ts`'e dokunmadan `WeekGrid`'e eklenir — aritmetik zaten ayrı duruyor.

**3 · Denemenin gerçek veriyle karşılaşmamış olması.** ✅ **Karşılaştı ve iki hata
çıkardı** (şerit hesabı gün başına değildi; dev sayfası metinleri pakete sızıyordu).
Uyarı doğru çıktı ve doğru yerde durmuş: `npm run seed` verisiyle ilk açılış, hiçbir
testin yakalayamadığı bir yerleşim hatasını ilk ekran görüntüsünde gösterdi. Sınıfın
kalan üyeleri artık testli: aynı anda 6 çakışan ders, 15 dakikalık ders, gece yarısını
aşan ders, aralık dışı ders, tamamen tatil olan hafta.

**4 · Sürükleme jestinin gerçek ekranda çalıştığı doğrulanmadı.** Aritmetiği jsdom'da
testli, ekranda sürülemedi — bu makinede eşzamanlı çalışan ikinci bir otomasyon oturumu
işaretçiyi devraldığı için (ayrıntı yukarıda). **Faz 6'nın ilk işi bu olmalı**; kurs
sahibine gönderilen Windows testinin maddelerinden biri de aynı şeye bakıyor.
