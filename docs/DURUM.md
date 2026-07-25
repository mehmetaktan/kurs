# Durum

**Son güncelleme:** 2026-07-25 · Faz 4.5 (kod oturumu)
**Mevcut faz:** Faz 4.5 ✅ tamamlandı → sırada **Faz 5**
**Sonraki oturumda ilk iş:** **push et ve CI'ya bak** — üç commit hâlâ uzakta yok

> Öğrenci ve veli modülü çalışıyor: liste, arama, filtre, form, detay, notlar, arşivleme.
> Marka geçişi (ADR-024) uygulandı ve teste bağlandı.
>
> **Faz 4 denetiminin beş artığı da kapandı** (aşağıda). Üçü gerçek uygulamada gözle
> doğrulandı, Faz 4'te alınamayan **iki ekran görüntüsü de alındı.**
>
> **CI hâlâ kırmızı bilinen son durumda.** Nedeni bulundu — Windows'la ilgisi yok,
> `npm ci` sürüm çakışmasıydı. Düzeltmesi yapıldı ama **doğrulanmadı**: `.nvmrc` dahil
> **üç commit hâlâ push edilmedi**, fark ancak push sonrası görülür. İlk iş budur.

---

## Faz 4.5 (Faz 4 artıkları) — tamamlandı

`npm run check` yeşil: **288 test** (164 TypeScript + 124 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi. Faz 4'te 265'ti; **+23 test.**

Beş maddenin beşi de yapıldı, hiçbiri sonraki faza devretmedi.

| # | Ne | Nerede |
|---|---|---|
| 1 | **Veli araması ikinci veliyi de görüyor** | `repo/roster.rs > guardian_index` + `matches_search` |
| 2 | **Bakiye kartının altyazısı üç durumu ayırıyor** | `roster.rs > StudentDetail.has_ledger` + `StudentDetailPage > balanceCaption` |
| 3 | **Alt çubuk görünen listeyi topluyor** (ADR-026) | `StudentsPage` → `totalReceivableKurus(visible)` + `tr.footer.receivable` |
| 4 | **Telefon alanı maskeli** | `lib/format.ts` (`maskPhone` · `editPhone` · `backspacePhone`) + `ui/PhoneInput` |
| 5 | **K-14 uyarısı borç tutarını yazıyor** | `tr.students.archive.debtWarningPrefix/Suffix` |

### 1 — Veli araması

`student_rows` artık `enrollment_tags` kalıbıyla ikinci bir eşleme daha çekiyor:
`guardian_index` = (öğrenci, veli adı, veli telefonu), **bütün canlı bağlar**.
`matches_search` bu listeye bakıyor. `PRIMARY_GUARDIAN_SQL` ile aynı canlılık koşulları
kullanıldı — çözülmüş bir bağ ekranda görünmediği gibi aramada da eşleşmiyor, testi var.

**Satırın görünümü değişmedi:** `StudentRow.guardian_name` / `guardian_phone` hâlâ
birincil veli. Değişen yalnızca aramanın kapsamı.

Testin kör noktası da kapandı: `arama_veli_adini_ve_telefonunu_da_kapsar` yalnızca tek
velili öğrencilerle çalışıyordu. İki yeni test geldi (`arama_ikinci_veliyi_de_bulur`,
`cozulmus_veli_bagi_aramada_eslesmez`) ve `save_with_guardians` yardımcısı eklendi.

### 2 — Bakiye kartı

Ölçüt `daysOverdue` değil **`hasLedger`**. `views::has_ledger_entries` ham `ledger_entry`
üzerinde bir **varlık** sorgusu — para hesabı değil, o yüzden view'a gerek yok; ters
kaydı olan satırlar da sayılıyor (bakiyeye etkileri sıfırlansa da ekstrede duracaklar).

| Durum | Altyazı |
|---|---|
| Defter boş | `Henüz hareket yok` |
| Gecikmiş borç var | `N gün gecikmiş` (değişmedi) |
| Borç var vadesi gelmemiş · bakiye kapalı · avans | **`Vadesi geçmiş borç yok`** (yeni) |

Üçü için tek yeni metin yeterli: kullanıcının bu kartta aradığı tek uyarı gecikme.

### 3 — ADR-026

`totalReceivableKurus` fonksiyonu değişmedi, **çağrıldığı liste değişti**: `rows` yerine
`visible` (çip süzgecinden geçmiş, sayfalama öncesi). Etiket `Toplam alacak` →
**`Görünen listenin alacağı`**. `views::total_receivable`'a dokunulmadı — Faz 9'un kaynağı.

### 4 — Telefon maskesi → **ADR-027**

Saf fonksiyonlar `lib/format.ts`'te, testleri `format.test.ts`'te; `ui/PhoneInput`
yalnızca imleci geri koyuyor. `formatPhone` **gösterim** için (`0 532 111 22 33`),
maske **girdi** için (`0532 111 22 33` — formun placeholder'ı ve hata mesajı da bu
yazımı örnek veriyor).

Aynı değerin iki biçimi olması Faz 5 ve Faz 8'i bağladığı için **ADR-027**'ye yazıldı;
aşağısı özeti. Dört karar ve gerekçeleri:

- **Baştaki sıfır zorla eklenmiyor.** Eklenseydi `0532 111 22 33` içindeki sıfır
  silinemezdi: silinir silinmez maske geri koyardı ve alan kilitlenirdi. Bunun yerine
  **gruplama baştaki sıfıra bakıyor** — `0532 111 22 33` ya da `532 111 22 33`. Doğrulama
  ikisini de kabul ediyor (10–13 hane).
- **Ülke kodu yalnızca yapıştırmada atılıyor** (`+90…` 12 hanede, `0090…` 14 hanede) ve
  orada başa `0` konuyor. Eşik olmasaydı `90…` yazmaya başlayan kullanıcının rakamları
  gözünün önünde silinirdi.
- **11 haneyi aşan girdi kırpılmıyor**, artanı sona ekleniyor. Sessizce rakam yutmak,
  yanlış bir numarayı doğru göstermek olurdu; uzunluğu doğrulama söylüyor.
- **İmleç rakam sayısıyla taşınıyor**, karakterle değil — ortadan düzenlemede sona
  atlamıyor. Ayıraç üstünde `Backspace` bir **rakam** siliyor (`backspacePhone`); yoksa
  maske boşluğu anında geri koyar ve tuş çalışmıyormuş gibi görünürdü.

`Input` bu iş için `forwardRef`'e çevrildi (`SearchInput`'ta zaten olan kalıp).

### 5 — K-14

`debtWarning` ikiye bölündü ve araya `formatLira(row.debtKurus)` girdi. Cümlenin ikinci
yarısı korundu (Faz 1 denetimi A8 / `VERI-MODELI §1.23`) — PRD'nin örneğinden daha
bilgilendirici:

> *Mehmet Aslan listeden kalkacak. Geçmiş dersleri, ödemeleri ve borcu olduğu gibi kalır;
> istediğinizde geri alabilirsiniz. **Bu öğrencinin 1.000,00 ₺ borcu var**; arşivlense de
> toplam alacakta sayılmaya devam eder.*

### Gerçek uygulamada doğrulananlar

Erişilebilirlik izni geri geldi; ekran `swiftc` ile derlenen bir CGEvent tıklayıcısıyla
sürüldü (System Events'in `click at` komutu WKWebView'a ulaşmıyor, tuş vuruşları ulaşıyor).

| Ne | Kanıt |
|---|---|
| **§1** | `0532 700` (Elif'in **ikinci** velisi Ali Yılmaz'ın numarası) arandı → Elif Yılmaz çıktı; satırda gösterilen telefon hâlâ birincil velinin (`0 532 214 88 10`) |
| **§2** | Elif Yılmaz — bakiye `0,00 ₺`, altyazı **`Vadesi geçmiş borç yok`**. Eski kodda burada "Henüz hareket yok" yazıyordu. Gecikme dalı da duruyor: Mehmet Aslan `30 gün gecikmiş` |
| **§3** | `Tümü` → `4.915,00 ₺` · `Borçlu` (6 kişi) → `4.915,00 ₺` · `Arşivlenmiş` (1 kişi) → `300,00 ₺`. Faz 4'teki rakam her çipte `5.215,00 ₺` idi; aradaki 300 ₺ tam olarak arşivli borçlu (§1.23 korunuyor) |
| **§4** | `05321112` yazıldı → alanda `0532 111 2` göründü, imleç sonda kaldı |
| **§5** | Arşivleme onayında tutar yazılı (yukarıdaki cümle) |

**Faz 4'ten devreden iki ekran görüntüsü de alındı:** arşivleme onay diyaloğu ve
kaydetmeden kapatma uyarısı. İkisi de `ConfirmDialog` üzerinde, yıkıcı eylem kırmızı ve
alt satırında ne olacağını yazıyor. Denemede yapılan değişiklik **kaydedilmedi** —
geliştirme veritabanı olduğu gibi duruyor.

### Bu oturumda değişen belgeler

`KARARLAR.md` (**ADR-027** — telefonun iki biçimi) · `YOL-HARITASI.md` (4.5 satırı ✅) ·
`faz-05.md` + `faz-08.md` (ADR-026/027 okuma listesine) · `faz-08.md` ayrıca: `Toplam
alacak` devri **kapandı** olarak işaretlendi, `Aç` kolonu devri duruyor.

### Bir sonraki yönetici oturumuna not

`faz-10.md:46` ayar ekranında *"Kurs adı, logo, adres, telefon…"* diyor. **ADR-024'ten
sonra kurum adı ayarlardan düzenlenmiyor** — `config/kurum.json`'dan geliyor ve derleme
anında gömülüyor. O satır ya ADR-024'e göre yeniden yazılmalı ya da "hangi alan
ayarlarda, hangisi config'te" ayrımını açıkça söylemeli. Bu oturumda dokunulmadı: kod
oturumuydu ve satır Faz 10'a kadar bir şeyi bloklamıyor.

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

> **Bu paragraf tarihî.** Aynı ekran Faz 4.5'te ADR-026 ile değişti: rakam artık görünen
> listeyi topluyor ve etiketi `Görünen listenin alacağı`. Aradaki 300 ₺ kaybolmadı,
> `Arşivlenmiş` çipine taşındı — §1.23 hâlâ geçerli.

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

**Dört commit push edilmedi:** `9b913d1` (Faz 3 denetimi), `b7d1598` (Faz 4),
`0097616` (Faz 4 denetimi) ve bu oturumunki (Faz 4.5). `.nvmrc` düzeltmesi `b7d1598`'in
içinde, yani uzakta **hâlâ yok** — `git log origin/main..HEAD` dördünü de listeler.

```
git push
```

| # | Ne | Kim |
|---|---|---|
| 1 | `git push` | **sen** |
| 2 | CI — `.nvmrc` düzeltmesi işe yaradı mı, `Test · windows-latest` yeşil mi | sen bakarsın |
| 3 | `/faz-05` — projenin en karmaşık fazı, temiz sayfayla | kod oturumu |

Actions sayfasında bakılacak tek şey: `Test · windows-latest` yeşil mi. **Windows
makine gerekmiyor, `.msi` indirilmez, kurulmaz** (ADR-008); asıl kanıt testlerin gerçek
migration'ları Windows'ta uygulaması. Artefakt kutusunda sıfır olmayan boyutta bir `.msi`
listelenmesi yeterli.

Hâlâ kırmızıysa **Faz 5'e başlamadan** çözülmeli — biriken doğrulanmamış kod artık
dört faz ve Faz 5 WebView2'ye en duyarlı olanı.

---

## Doğrulanmayan / bilinçli ertelenenler

| Ne | Neden |
|---|---|
| `NoteList` / `NoteComposer` ayrı komponent olarak | Notlar `StudentDetailPage` içinde kuruldu. Tek ekranda kullanılan bir desen için `src/ui/`'ya komponent çıkarmak erken soyutlama olurdu; ikinci bir ekran not gösterirse çıkarılır |
| Öğrenci detayında `Kayıtlar` sekmesi | `faz-04.md §3` sekmeleri `Bilgiler / Dersler / Ödemeler / Notlar` olarak sabitledi. `enrollment` ekranı Faz 5'te grup modülüyle geliyor |
| `npm audit` 12 "high" | Hiçbiri Faz 3–4'te eklenenlerden değil; eslint/vite geliştirme araç zincirinin bilinen uyarıları, teslim edilen pakete girmiyorlar |

**Faz 4'ten devreden iki ekran görüntüsü Faz 4.5'te alındı** (arşivleme onayı ve
kaydetmeden kapatma uyarısı) — bu tablodan düştüler.

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
