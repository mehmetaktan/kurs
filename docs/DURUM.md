# Durum

**Son güncelleme:** 2026-07-25 · Faz 4 denetimi (yönetici oturumu)
**Mevcut faz:** Faz 4 ✅ tamamlandı, denetimi ✅ yapıldı → sırada **Faz 4.5**, sonra Faz 5
**Sonraki oturumda ilk iş:** **push et ve CI'ya bak**, sonra `/faz-04b`

> Öğrenci ve veli modülü çalışıyor: liste, arama, filtre, form, detay, notlar, arşivleme.
> Marka geçişi (ADR-024) uygulandı ve teste bağlandı.
>
> **CI ilk kez çalıştı ve kırmızı geldi.** Nedeni bulundu — Windows'la ilgisi yok,
> `npm ci` sürüm çakışmasıydı. Düzeltmesi yapıldı ama **doğrulanmadı**: `.nvmrc` dahil
> **iki commit hâlâ push edilmedi**, fark ancak push sonrası görülür. İlk iş budur.
>
> **Denetim sonucu: para tarafı temiz, Faz 5'i bloklayan bulgu yok.** Beş düzeltme
> `/faz-04b` (Faz 4.5, kısa oturum) olarak ayrıldı — Faz 5 projenin en karmaşık fazı,
> artıklar oraya yüklenmedi.

---

## Faz 4 denetimi (2026-07-25, yönetici — kod yazılmadı)

Altı boyut paralel denetlendi, her bulgu ayrı bir ajanla **çürütülmeye çalışıldı**.
Model dağılımı CLAUDE.md disiplinine göre karışıktı: mekanik ADR taraması Haiku, kapsam
ve belge Sonnet, **para ve defter Opus** (CLAUDE.md burada tasarrufu yasaklıyor).

**59 kontrol temiz, 10 bulgu, 0 çürütüldü** — ama önem dereceleri karşıt doğrulamada
düşürüldü: 3 "high" iddiadan biri medium'a, ikisi low'a indi.

### Para tarafı — kanıtlanmış temiz

Denetimin en önemli çıktısı bu. Opus ajanı `sqlite3` ile canlı doğrulama yaptı:

| Ne | Kanıt |
|---|---|
| Bakiye projeksiyonu | `roster.rs` kendi `SUM`'ını yazmıyor; `v_student_balance` / `v_student_debt` view'larına `LEFT JOIN` ile bağlanıyor (satır 115-116). Ham `ledger_entry` üzerinde toplama yok |
| **ADR-022 paritesi** | Üç halkalı zincir `sqlite3 :memory:`'de kuruldu: bakiye −25.000, `SUM(v_ledger_effective)` −25.000, borç 25.000 → tutarlı. Ters yön de sınandı |
| Değişmez kapsamı | `assert_ledger_invariant` **sekiz** yerde, ikisi Faz 4'ün yeni dosyasında. Faz 4 hiç migration eklemedi, yeni view yok, kapsam dışına çıkan yol açılmadı |
| Bakiye ↔ borç çelişemez | İkisi de aynı `v_ledger_effective`'ten türüyor; `balanceKurus < 0` ile `debtKurus > 0` matematiksel olarak eşdeğer. ADR-018'in istediği tam buydu |
| Kuruş disiplini | Uçtan uca `i64`; ekranda tek aritmetik `Math.max(0, debtKurus)` tam sayı toplaması. `formatKurus` girdiyi `Number.isInteger` ile reddediyor |
| Arşivleme paraya dokunmuyor | `archive_student` yalnızca `repo::archive::<Student>` çağırıyor; şema seviyesinde de `trg_ledger_immutable` kapatıyor |
| ADR-015 iki sayaç | Kalan ders `v_package_remaining`'den, defterle bağı yok; `package.status`'e güvenilmiyor |
| Gecikme hesabı | Saf tarih farkı, `julianday('now')` yok, `today` bind ediliyor (§0'a uygun) |

**ADR uyum taraması 8/8 temiz** (ADR-002/003/004/005/007/008/020 + K5).

### Ayakta kalan bulgular ve nereye gittiler

| # | Bulgu | Önem | Nereye |
|---|---|---|---|
| 1 | **Veli araması yalnızca birincil veliyi görüyor** (`roster.rs:159`) — ikinci veli adıyla/telefonuyla arayınca öğrenci bulunamıyor, mükerrer kayıt riski. Testin de aynı kör noktası var | medium | **Faz 4.5 §1** |
| 2 | **Bakiye kartı altyazısı** (`StudentDetailPage.tsx:294`) — `daysOverdue !== null` ikili dalı yüzünden borcunu tamamen ödemiş, defteri dolu öğrencide de "Henüz hareket yok" yazıyor | medium | **Faz 4.5 §2** |
| 3 | **"Toplam alacak" çiplere kör** (`filters.ts:118`) — Rust süzgecine tepki veriyor, çiplere vermiyor | low | **ADR-026** + Faz 4.5 §3 |
| 4 | **Telefon alanı maskesiz** (`StudentForm.tsx:255`) — `faz-04.md §2` "maskeli" diyordu, tarih yapıldı telefon yapılmadı | medium | **Faz 4.5 §4** |
| 5 | **K-14 uyarısı borç tutarını yazmıyor** (`tr.ts:323`) | low | **Faz 4.5 §5** |
| 6 | **ADR-025 bağlı faz komutlarında yazılı değildi** — faz-05/08/09 `KARARLAR.md`'yi bile okutmuyordu | medium | ✅ **düzeltildi** |
| 7 | **`faz-04.md §6` hâlâ Rust'ta sayfalama testi istiyordu** — ADR-025 ile çelişiyordu | low | ✅ **düzeltildi** |
| 8 | **`faz-08.md` "Aç" kolonu devrini bilmiyordu** | medium | ✅ **düzeltildi** |
| 9 | **`CLAUDE.md`'de kimlik geçişi hâlâ gelecek zamanla yazılıydı** | low | ✅ **düzeltildi** |
| 10 | **`views::total_receivable` atıl** — aynı para kavramının ikinci tanımı | low | **ADR-026** ile Faz 9'a bağlandı |

### Verilen karar: ADR-026 — özet rakamlar

Liste ekranının alt çubuğundaki para özeti **görünen satırları** toplar ve etiketi bunu
söyler ("Görünen listenin alacağı"). Kurs geneli, süzgeçten bağımsız rakamların yeri
**Dashboard** (Faz 9) — `views::total_receivable` orada kullanılır ve atıl kalmaz.

Bugünkü ara durum kimsenin bilerek seçmeyeceği türdendi: "Branş: Matematik" seçince rakam
değişiyor, "Borçlular" çipine basınca değişmiyor. `VERI-MODELI §1.23`'ün "arşivlenmiş
sayılır" kuralı **korunuyor** — arşivli öğrenci kendi çipinde görünür ve o listenin
toplamına girer.

### Bu denetimde değişen belgeler

`KARARLAR.md` (ADR-026) · `.claude/commands/faz-04b.md` (**yeni**) ·
`faz-05.md` + `faz-09.md` (ADR-025 bağlayıcı notu + `KARARLAR.md` okuma listesine) ·
`faz-08.md` (ADR-025 + "Aç" kolonu ve toplam alacak devri) ·
`faz-04.md §6` (ADR-025 ile çelişen satır düzeltildi) · `CLAUDE.md` (bayat kimlik notu) ·
`YOL-HARITASI.md`.

---

## Faz 4 (Öğrenci & Veli) — tamamlandı

`npm run check` yeşil: **265 test** (144 TypeScript + 121 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi.

### §0 — Marka geçişi (ADR-024)

Öğrenci modülü kodundan **önce** yapıldı; gerekçesi ADR-024'te: `identifier`
veritabanının `%APPDATA%` klasörünü belirliyor ve kurs sahibinin makinesinde gerçek veri
oluştuktan sonra maliyeti bir veri taşıma işi olurdu.

| Ne | Nerede |
|---|---|
| `com.aydinozelders.kurstakip` → `com.aktansoft.kurstakip` | `tauri.conf.json` + `db/mod.rs > APP_IDENTIFIER` |
| Yayıncı `Aktansoft` | `Cargo.toml > authors` + `bundle.publisher` |
| Kurum adı derleme zamanı config'e taşındı | `config/kurum.json` → `src/config/brand.ts` (TS) + `src-tauri/src/brand.rs` (`include_str!`) |
| `tr.app.institution` **silindi**, `brand` `'DersTakip'` → `'Kurs Takip'` | `src/i18n/tr.ts` |
| `app_status.institution_name` artık `setting`'ten değil config'ten | `commands.rs` |
| Sürüm tek kaynağa bağlandı | `package.json` → Vite `define` → `APP_VERSION` → kenar çubuğu |

Ürün adı `Kurs Takip`, pencere başlığı ve CI artefakt yolları **değişmedi**.

`setting.institution_name` satırı `001_initial.sql`'de **duruyor ama okunmuyor** —
migration mühürlü. `crud.rs`'teki test silinmedi, notla işaretlendi: migration'ın
başlangıç verisini yazdığını hâlâ kanıtlıyor.

**Yeni mühür: `src-tauri/tests/identity.rs`.** `APP_IDENTIFIER` ↔ `tauri.conf.json >
identifier` eşitliğini artık bir yorum değil test koruyor; ürün adı, yayıncı ve
`Cargo.toml` ↔ `tauri.conf.json` sürüm eşitliği de aynı dosyada. **Negatif kontrolü
yapıldı:** sabit geçici olarak bozuldu, iki test düştü, geri alındı. TS ayağı
`src/config/brand.test.ts`'te — `package.json` ↔ `tauri.conf.json` sürümü, kurum adının
`tr.ts`'te bulunmadığı ve elle yazılmış sürüm numarası olmadığı.

`npm run seed -- --reset` yeni klasörde sıfırdan kurdu:
`…/com.aktansoft.kurstakip/kurs.db`, `migration: [1, 2]`, 12 öğrenci.

### Modül

| Ne | Nerede |
|---|---|
| Ekran projeksiyonu — bakiye, kalan ders, veli, sayaçlar | `src-tauri/src/repo/roster.rs` |
| 11 yeni komut | `commands.rs` — liste, detay, kaydet, arşivle/geri al, aktif/pasif, veli ara, not ekle/sil, branş/grup listesi |
| Liste ekranı | `src/pages/ogrenciler/StudentsPage.tsx` |
| Detay ekranı | `StudentDetailPage.tsx` — özet şerit + 4 sekme |
| Form + veli yönetimi | `StudentForm.tsx` + `GuardianFields.tsx` |
| Çip / sıralama / sayfalama | `filters.ts` (testli) |
| Alan doğrulaması | `validate.ts` (testli) — Rust ikizi `roster::validate_student` |

Öğrenci ve velisi **tek transaction'da** yazılıyor: veli doğrulaması düşerse öğrenci de
yazılmıyor. Aksi hâlde velisiz bir öğrenci oluşup listedeki telefon kolonu sessizce boş
kalırdı; testi var (`gecersiz_veli_ogrenciyi_de_yazdirmaz`).

Ekranlarda gerçek veri doğrulandı: Türkçe sıralama doğru (Ahmet · Ayşe · Burak · Elif ·
Işıl · İrem · Mehmet…), çip sayıları tutuyor, alt çubuk `Toplam alacak 5.215,00 ₺`
gösteriyor. Bu rakam görünen 6 borçlunun toplamından **300 ₺ fazla** — arşivlenmiş
borçlu da sayılıyor (§1.23), yani kural ekranda kanıtlandı.

### Verilen karar: ADR-025 — liste ekranlarının iş bölümü

Arama ve veri filtresi **Rust'ta**, çipler + **Türkçe sıralama ve sayfalama arayüzde**.

Faz 4'ün kabul listesi sayfalamanın Rust tarafında test edilmesini istiyordu; **ADR-020
buna izin vermiyor.** Türkçe sıralama SQL'de yapılamadığı için sıralanmamış bir listeyi
`LIMIT/OFFSET` ile bölmek yanlış sayfa üretirdi. İkisi aynı katmanda durmak zorunda ve o
katman arayüz. Sayfalama tam olarak uygulandı, testi `filters.test.ts`'te. Bedeli
bilinerek kabul edildi: liste tümüyle belleğe alınıyor — iki haneli öğrenci sayısında
ölçülemez.

Kural Faz 5 (Gruplar), Faz 8 (Borçlular) ve Faz 9 (Raporlar) için de bağlayıcı.

Bir yan bulgu ADR'ye yazıldı: **veli adı araması SQL'de kurulamıyor.** `guardian`
tablosunda `search_name` sütunu yok (§1.6) ve SQLite'ın `lower()`'ı Türkçe harfleri hiç
küçültmüyor — `'Ç'` `'Ç'` kalıyor. Süzme `text::search_name`'in kendisiyle Rust içinde
yapılıyor; sütun eklemek migration ister ve §1.8'in "iki haneli tabloda arama indeksinin
kazancı yok" gerekçesi burada da geçerli.

### Bu oturumda alınan iki küçük karar

- **Listenin son kolonu "Tahsilat al" değil "Aç"** (arşiv görünümünde "Geri al", E2).
  Tahsilat Faz 8'de; çalışmayan bir düğme koymaktansa bugün gerçekten çalışan eylem
  kondu. **Faz 8 bu kolonu devralır.**
- **Detay ekranında `PageHeader` yok.** Tasarımda (EKRANLAR §4) ekran doğrudan
  `← Öğrenciler` ile başlıyor ve ad kimlik bloğunda duruyor. Kabuğun başlığı da konsaydı
  ad iki kez, 100px arayla yazıyordu — ilk ekran görüntüsünde görüldü, düzeltildi.

### Yan kazanç: `Ctrl K` artık gerçek sonuç veriyor

Faz 3'ten devreden `tr.search.notReady` placeholder'ı kalktı. Panel öğrenci sonuçlarını
`student_list` üzerinden gösteriyor, `Enter` ilk sonucu açıyor. Gruplar ve Dersler
grupları Faz 5'te aynı listeye eklenecek — sonuç listesi şimdiden gruplu.

---

## CI — ilk çalışma kırmızı, nedeni bulundu, düzeltmesi doğrulanmadı

**CI #1 (Faz 3 commit'i) düştü.** Windows'la ilgisi yok: `Test · macos-latest` işi
`npm ci` adımında öldü ve Windows işi hiç başlamadı.

```
npm error `npm ci` can only install packages when your package.json and
package-lock.json are in sync.
npm error Invalid: lock file's picomatch@2.3.2 does not satisfy picomatch@4.0.5
```

**Teşhis.** `npm ci` yerelde **geçiyor** (npm 10.9.4, Node 22.21.1). Fark CI'nın
`node-version: 22` yazmasıydı: kayan bir aralık, her Node yayınında farklı bir npm
getiriyor ve npm 11, npm 10'un ürettiği lock ağacını yeniden hesaplayıp reddediyor.
Yani lock dosyası bozuk değil — **Node sürümü hiçbir yerde sabitlenmemişti.**

**Düzeltme.** `.nvmrc` (`22.21.1`) eklendi; CI'daki iki `setup-node` adımı artık
`node-version-file: .nvmrc` okuyor. `rust-toolchain.toml` ile aynı disiplin: yerel ve CI
aynı dosyayı okur. `CLAUDE.md > Stack` bunu yazıyor.

**Doğrulanmadı.** Düzeltmenin işe yaradığı ancak push sonrası görülür.

### Sonraki oturumun ilk işi — ve sonrasının sırası

**İki commit push edilmedi:** `9b913d1` (Faz 3 denetimi) ve `b7d1598` (Faz 4). `.nvmrc`
düzeltmesi ikincisinin içinde, yani uzakta **hâlâ yok**.

```
git push
```

| # | Ne | Kim |
|---|---|---|
| 1 | `git push` | **sen** |
| 2 | CI #2 — `.nvmrc` düzeltmesi işe yaradı mı, `Test · windows-latest` yeşil mi | sen bakarsın |
| 3 | `/faz-04b` — Faz 4.5, beş düzeltme, **kısa oturum** | kod oturumu |
| 4 | CI #3 — yeşil onay | kod oturumu |
| 5 | `/faz-05` — projenin en karmaşık fazı, temiz sayfayla | kod oturumu |

Actions sayfasında bakılacak tek şey: `Test · windows-latest` yeşil mi. **Windows
makine gerekmiyor, `.msi` indirilmez, kurulmaz** (ADR-008); asıl kanıt testlerin gerçek
migration'ları Windows'ta uygulaması. Artefakt kutusunda sıfır olmayan boyutta bir `.msi`
listelenmesi yeterli.

Hâlâ kırmızıysa **Faz 4.5'e başlamadan** çözülmeli — biriken doğrulanmamış kod artık
üç faz.

> `/faz-04b` **yeni bir slash komutu**: kullanılabilmesi için Claude Code'un yeniden
> başlatılması gerekir (`CLAUDE.md` > Oturum protokolü). "Unknown command" hatasının
> nedeni budur.

---

## Doğrulanmayan / bilinçli ertelenenler

| Ne | Neden |
|---|---|
| **Onay diyaloglarının ekran görüntüsü** (`Arşivle`, `Kaydetmeden kapat`) | macOS erişilebilirlik izni oturum ortasında düştü, `osascript` tıklaması `-25211` vermeye başladı. İkisi de Faz 3'te görsel olarak doğrulanmış `ConfirmDialog` üzerine kurulu ve mantıkları testli — ama **gözle görülmediler.** Sistem Ayarları → Gizlilik → Erişilebilirlik'te Terminal'e izin verilirse sonraki oturumda alınabilir |
| `NoteList` / `NoteComposer` ayrı komponent olarak | Notlar `StudentDetailPage` içinde kuruldu. Tek ekranda kullanılan bir desen için `src/ui/`'ya komponent çıkarmak erken soyutlama olurdu; ikinci bir ekran not gösterirse çıkarılır |
| Öğrenci detayında `Kayıtlar` sekmesi | `faz-04.md §3` sekmeleri `Bilgiler / Dersler / Ödemeler / Notlar` olarak sabitledi. `enrollment` ekranı Faz 5'te grup modülüyle geliyor |
| `npm audit` 12 "high" | Hiçbiri Faz 3–4'te eklenenlerden değil; eslint/vite geliştirme araç zincirinin bilinen uyarıları, teslim edilen pakete girmiyorlar |

**Yapışkan tablo başlığı artık doğrulandı** — Faz 3'ten devreden tek belirsizlik buydu.
Öğrenciler tablosu kabuğun `.content` kabında kaydırılıyor ve başlık yerinde kalıyor.
Tabloya kendi `overflow-x` sarmalayıcısı **konmadı**: konsaydı o sarmalayıcı kaydırma kabı
olur ve yapışkanlık kırılırdı (gerekçe `Students.module.css` başında, kolon genişliği
hesabıyla birlikte).

---

## Açık sorular — cevabını senden bekliyorum

`docs/PRD.md` §9'da gerekçeleriyle. **S1 (ADR-021) ve S8 cevaplandı.**
**S2 ve S4 Faz 5'i doğrudan etkiliyor** — sıradaki oturumda karşına çıkacak.

| # | Soru | Hangi faz |
|---|---|---|
| **S2** | Grup kapasitesi aşımı engellensin mi, uyarı mı? | **Faz 5** |
| **S4** | Standart ders süresi kaç dakika? | **Faz 5** |
| S3 | Paketlerin son kullanma tarihi var mı? | Faz 7 |
| S6 | Dönem ortasında ayrılanın kalan paket parası iade mi, alacak mı? | Faz 7 |
| S5 | Makbuz numarası otomatik mi artsın? | Faz 8 |
| S7 | "Devam oranı" hangi pencerede hesaplansın? | Faz 9 |
| S9 | Bilgisayarındaki Windows sürümü ne? | Faz 10 öncesi |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 |

> S7 için Faz 4 bir **varsayım** kullandı: devam oranı tüm işlenen dersler üzerinden
> hesaplanıyor ve kartın altında "Tüm işlenen dersler" yazıyor — sayı belirsiz kalmasın
> diye. Faz 9 pencereyi değiştirirse tek bir yer değişir
> (`StudentDetailPage > SummaryStrip`).

---

## Faz 6'ya devreden açık karar

`ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil olduğu için düzeltme zincirinin
üçüncü adımında ikinci `delta = −1` yazılamıyor. **Defter tarafı ADR-022 ile kapandı**;
bu, ders hakkı sayacının ayrı sorunu (ADR-015: iki ayrı sayaç). Seçenekler
`faz-06.md §3b`'de.

---

## Faz 5'in en büyük riski

**Windows'ta hâlâ tek bir satır çalıştırılmadı — ve artık dört fazlık kod var.**

Risk Faz 4'te değişmedi; **büyüdü ve bir kere gerçekleşti.** CI #1'in düşmesi, hiç
çalıştırılmamış bir doğrulama zincirinin sessizce bozuk kalabildiğinin kanıtı. Üstelik o
arıza `npm ci`'deydi — yani asıl aradığımız Windows sorunlarına **daha sıra bile
gelmedi**: satır sonu, dosya yolu, import büyük/küçük harfi, WebView2 davranışı ve Segoe
UI altında kolon genişlikleri hâlâ denenmemiş durumda.

Faz 5 takvimi getiriyor: sürükle-bırak, ızgara yerleşimi ve saat hesapları — WebView2
farklarına en duyarlı ekran. Push edilmeden başlanırsa bir Windows hatası bugün bir
migration, bir tasarım sistemi ve bir öğrenci modülünün altında; Faz 5'ten sonra bir de
takvimin altında olacak.

`docs/YOL-HARITASI.md` zaten "Faz 5 sonu: kurs sahibine build gönderilir" diyor. O tarihe
yeşil bir CI olmadan varılamaz.
