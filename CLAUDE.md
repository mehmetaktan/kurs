# Kurs Takip

Küçük bir özel ders kursu için öğrenci, ders ve tahsilat takip programı.
Kurs sahibi tek başına, tek bilgisayarda kullanıyor. Hem birebir hem grup dersleri var.

> **Kullanıcı teknik değil ve Windows kullanıyor. Geliştirme macOS'ta yapılıyor.**
> Bu iki cümle projedeki kararların yarısını açıklar.

## Oturum protokolü

| Komut | Ne zaman |
|---|---|
| `/durum` | Her oturumun başında |
| `/faz-NN` | O oturumda çalışılacak faz — **kod oturumu** |
| `/yonetici` | Plan, kural ve doküman oturumu — **kod yazılmaz** |
| `/kapat` | Her oturumun sonunda — DURUM.md güncellenir + commit |
| `/kurtar` | Bağlam kaybolduğunda / işler karıştığında |

**Bir oturum = bir faz.** Faz bitmeden yeni faza geçme, faz ortasında oturum şişerse `/kapat` çalıştır ve yeni oturumda devam et.

Bir faz oturuma sığmıyorsa **bölünür ama yeni komut açılmaz**: `/kapat` çalıştırılır, aynı
komutla ikinci oturumda devam edilir. Dikiş yeri faz komutunda yazılıdır.

> **Karar oturumu açılmaz — ADR-033.** Bu kural eskiden tersiydi (*"araştırma gerektiren bir
> karar, kod oturumunun başında durmaz; kararı ölçüp veren oturum ayrıdır"*) ve `/faz-05c-karar`
> öyle doğdu: bir oturum üç takvim kütüphanesini ölçmeye harcandı, **ürün sahibine elinde
> hazır bir şey olup olmadığı hiç sorulmadı** — varmış, ve ölçümün elenme sebebi tam olarak
> o eksikti. Yeni sıra: (1) **ürün sahibine tek soruyla sor**, (2) cevabı varsa karar odur,
> (3) yoksa **en ucuz varsayımla** devam et ve varsayımı faz komutuna yaz, (4) ölçüm ancak
> sahibi "ölç" derse yapılır. Teknik kararlar sahibine sorulmaz — ADR'ye yazılır, kod oturumu
> uygular.
>
> **Denetim oturumu** da yalnızca **para fazından sonra** açılır; diğer fazlar kendi
> kapanışlarındaki kontrol listesiyle yeter.

> **Plan ekran envanterinden çıkmaz — ADR-039.** `docs/EKRANLAR.md` bir **referanstır**:
> bir ekran yapılırken içeriği oradan okunur, **sırası** oradan çıkarılmaz. Envanterde her
> ekran bir satır, oysa sahibinin işinde biri *"programı kullanamıyorum"*, diğeri *"daha
> güzel görünürdü"* demek. Bu fark kaybolduğu için tanımlar ve ayarlar en sona atıldı,
> takvim öne geçti — ve `DENETIM-FAZ1 > C5` bir arşiv dosyasında üç faz boyunca kayboldu.
> Sıranın kaynağı `docs/YOL-HARITASI.md` + `docs/KULLANILABILIRLIK.md`; `/kapat` iki
> kontrolle bunu tutuyor.

### İki mod

- **Kod oturumu** (`/faz-NN`): uygulama kodu yazılır. Kararlar sorgulanmaz, uygulanır.
  Plan bir yerde tıkanırsa çözümü kendi kafana göre uydurma — `docs/DURUM.md`'ye yaz ve sor.
- **Yönetici oturumu** (`/yonetici`): kod yazılmaz. Plan, kurallar, ADR'ler, faz komutları
  ve doküman tutarlılığı yönetilir. Koda yalnızca denetim için bakılır.

> Yeni bir slash komutu eklendiğinde Claude Code'un **yeniden başlatılması gerekir** —
> komut listesi oturum açılışında taranıyor. "Unknown command" hatasının nedeni budur.

## Belgeler

| Dosya | İçerik |
|---|---|
| `docs/DURUM.md` | Nerede kaldık — **son durum**, oturum arşivi değil. Her oturum sonunda güncellenir |
| `docs/KARARLAR.md` | Kilitli kararlar + ADR'ler. **Buradaki kararlar yeniden tartışılmaz.** |
| `docs/YOL-HARITASI.md` | Plan ve bağımlılıklar — **kalan iki faz**: `/faz-06` (yoklama) → `/faz-10` (teslim) |
| `docs/KULLANILABILIRLIK.md` | Ürün sahibinin kullanım şikâyetleri; **her kod oturumu buradan §0 ile başlar** |
| `docs/TASARIM-KAYNAGI.md` | Claude Design projesi nasıl okunur |
| `docs/PRD.md` | Ürün gereksinimleri (Faz 1) |
| `docs/VERI-MODELI.md` | SQLite şeması ve gerekçeleri (Faz 1) |
| `docs/EKRANLAR.md` | Ekran envanteri (Faz 1) |
| `docs/TASARIM-SISTEMI.md` | Renk, tipografi, spacing, komponentler (Faz 1) |
| `docs/DENETIM-FAZ1.md` | Faz 1 denetimi — 25 bulgu, kanıtları ve düzeltmeleri |
| `docs/DENETIM-PARA.md` | Para fazı denetimi — planın tek zorunlu denetimi (ADR-033), üç bulgu |
| `docs/CODEX-DEVIR.md` | `/faz-07 §5–§9`'un dış ajana devri (ADR-042): prompt + denetim listesi |
| `AGENTS.md` (kökte) | **Dış kodlama ajanlarının** giriş kapısı — Codex `CLAUDE.md`'yi okumaz, bunu okur |

## Stack

Tauri 2 + React + TypeScript + Vite + SQLite (rusqlite, `bundled`)

Sürümler kilitli: Rust `rust-toolchain.toml`'da, Node `.nvmrc`'de (tam sürüm, `22` gibi
kayan bir aralık değil), Tauri CLI `package.json`'da caret'siz. **npm ayarları da
kilitli: `.npmrc`.** CI aynı dosyaları okur — yerelde çalışan sürüm CI'da da çalışır.

> **`.npmrc` neden var (CI #1–#3'ün gerçek nedeni).** Makinenin genel `~/.npmrc`'sinde
> `legacy-peer-deps=true` varsa `npm install` akran bağımlılıklarını çözmeden bir kilit
> dosyası üretir ve aynı ayar `npm ci`'nin doğrulamasını da kapatır — hata yerelde **hiç
> görünmez.** CI'da o ayar olmadığı için `npm ci` iki faz boyunca `EUSAGE` ile düştü
> (`fdir`'ın akranı `picomatch ^3 || ^4`, kökteki `picomatch@2.3.2`'ye düşüyordu).
> Proje `.npmrc`'si makinenin ayarını dışarıda tutar; jetonlar ve özel kayıt defterleri
> etkilenmez — npm yapılandırmayı anahtar bazında birleştirir.
>
> Aynı sınıftan bir tuzak Node'da da var, o yüzden sürüm oraya da tam yazılır: her Node
> yayını farklı bir npm getirir.

## Klasör yapısı (para fazı §0)

```
kurs/
├── .github/workflows/ci.yml   Windows + macOS test & paket
├── scripts/verify-bundle.mjs  üretim paketinde /dev sayfası kalmadığını doğrular
├── config/kurum.json          müşteriye özel değerler — teslim öncesi düzenlenir (ADR-024)
├── src/                       React arayüzü
│   ├── config/brand.ts        kurum.json'un tipli sarmalayıcısı + APP_VERSION
│   ├── i18n/tr.ts             BÜTÜN Türkçe metinler (ADR-007) — kurum adı BURADA DEĞİL
│   ├── styles/                tokens.css (TEK kaynak) · base.css · density.css
│   ├── ui/                    komponent kütüphanesi — ekranlar buradan alır
│   │                          SearchSelect (uzun liste) ile Select (kısa liste)
│   │                          YAN YANA durur — ADR-041, biri ötekini elemez
│   ├── shell/                 AppShell · SidebarNav · PageHeader · GlobalSearch · routes.ts
│   ├── pages/
│   │   ├── bugun/             Faz 5B: TodayPage · today.ts (sıralama, "şimdi" çizgisi)
│   │   ├── dersler/           Faz 5B: SessionForm (E3) · SessionActions · TemplateModal (E6)
│   │   ├── ogrenciler/        Faz 4: liste · detay · form · veli · filters · validate
│   │   ├── gruplar/           Faz 5A: liste · detay · form · filters
│   │   ├── takvim/            Faz 5C: CalendarPage · WeekGrid · MonthGrid · MoveDialog ·
│   │   │                      calendarGrid.ts (geometri) · drag.ts (ADR-030) · filters.ts
│   │   │                      DONDURULDU (ADR-034) — üstüne iş yazılmaz; değişim
│   │   │                      gerekirse yalnızca bu klasör değişir, Rust yerinde kalır
│   │   └── tanimlar/          branşlar · tatil günleri · renk paleti (Faz 5A) ·
│   │                          öğretmenler · genel ayarlar (para fazı §0, ADR-037)
│   ├── dev/                   /dev/komponentler · /dev/durum — ÜRETİME GİRMEZ.
│   │                          Metinleri KENDİ sözlüğünde (showcase.tr.ts · status.tr.ts):
│   │                          tr.ts her ekrandan import ediliyor, oraya yazılan dize
│   │                          komponent elense bile pakete girer — kapı bunu yakaladı
│   ├── test/setup.ts          vitest + jsdom temizliği
│   └── lib/                   api.ts · format.ts (kuruş, tarih, telefon) ·
│                              sortTr.ts (ADR-020) · paginate.ts (ADR-025) ·
│                              router.ts (ADR-023)
└── src-tauri/
    ├── migrations/            şemanın tek kaynağı — sıralı, checksum'lı, elle düzeltilmez
    │                          003: package_usage ters kayıt zinciri (ADR-036)
    ├── capabilities/          Tauri 2 yetki dosyaları
    ├── src/
    │   ├── lib.rs             AppState + Tauri kurulumu
    │   ├── commands.rs        #[tauri::command] — İNCE katman
    │   ├── brand.rs           kurum.json derleme anında gömülü (ADR-024)
    │   ├── db/                bağlantı, pragma, migration + checksum
    │   ├── repo/              setting · people · roster · academic · schedule ·
    │   │                      finance · views · ops
    │   ├── model.rs           tablo satır tipleri
    │   ├── money.rs           kuruş biçimleme (ADR-003)
    │   ├── text.rs            Türkçe küçültme, search_name (K9)
    │   ├── clock.rs           yerel tarih — SQLite saati OKUNMAZ (§0)
    │   ├── error.rs           tek hata tipi + Türkçe mesajlar (PRD §8)
    │   └── seed.rs            demo verisi — yalnızca `seed` özelliğiyle
    └── tests/                 crud · seals · views · roster · schedule · identity ·
                                seed_data
```

Repository katmanı `search_name` ve `phone_digits`'i **kendisi üretir**; çağıran boş
bırakır. `ledger_entry`'nin `update`/`archive` fonksiyonu **yoktur** — append-only (K5).
**`package_usage` de öyle** (ADR-036): düzeltme ters kayıtla yazılır, satır arşivlenmez.
Tüketim `repo/finance.rs > consume_package_credit` / `restore_package_credit` üzerinden;
ikisi de **yön belirtir ve idempotenttir** (ADR-040) — Faz 6 yalnızca çağırır.

`repo/people.rs` tabloların CRUD'u, `repo/roster.rs` **ekranın istediği birleşik satır**
(bakiye, kalan ders, veli, işlenen ders). İkisi ayrı durur ki tablo katmanı ekrana
bağlanmasın. Aynı ayrım akademik tarafta da var: `repo/academic.rs` tablolar,
**`repo/schedule.rs`** projeksiyon + zaman mantığı: seans üretim motoru, grup satırı,
**gün/aralık ders satırı** (`day_rows` · `session_rows_between`), **kapalı gün aralığı**
(`closed_days_in_range`) ve seans yazma (`save_session`, `reschedule_sessions`,
şablondan oluşturma).

`repo/ops.rs > on_startup(today)` her açılışta çalışır ve eksik seansları üretir
(`VERI-MODELI §1.14`). Hata uygulamayı açmayı engellemez. Faz 7/8'in vade tahakkuku da
oraya girecek — "zamanın geçmesiyle kendiliğinden doğması gereken kayıtlar" tek yerde.

### Arama, sıralama ve sayfalama nerede

Aynı listenin üç işi üç ayrı yerde ve bu **bilinçli**:

| İş | Nerede | Neden |
|---|---|---|
| Arama, branş/grup filtresi | **Rust** (`repo::roster` · `repo::schedule`) | `search_name` sütunu orada; `İ/ı` yazma anında çözülmüş (K9) |
| Çipler | Arayüz (`pages/<modül>/filters.ts`) | Sayılarını göstermek için zaten tüm satırlar elde |
| Sıralama | **Arayüz** (`lib/sortTr.ts` + modülün `filters.ts`'i) | ADR-020: SQLite'ta `localeCompare('tr')` yok |
| Sayfalama | **Arayüz** (`lib/paginate.ts` — ortak) | Sıralanmamış listeyi sayfalamak yanlış sayfa üretir |

Sayfalama ortak bir dosyada çünkü ADR-025 **bütün** liste ekranları için bağlayıcı;
çipler ve sıralama modülde kalır, onlar ekranın kendi verisine bağlı.

## Değişmez kurallar

### Mimari
- Frontend SQL yazmaz. Veri erişimi Rust'ta `#[tauri::command]` + repository katmanı üzerinden.
- İş mantığı — özellikle para — Rust tarafında, saf ve test edilebilir fonksiyonlarda.

### Para
- Tutarlar **kuruş cinsinden `i64`**. Float yasak.
- Bakiye saklanmaz; `ledger_entry` toplamından hesaplanır.
- Fiyat değişimi geçmişi bozmaz: seans/paket kaydına ücret snapshot'ı yazılır.
- Para ile ilgili her fonksiyonun testi olur. Bu pazarlık konusu değil.

### Veri
- Hard delete yok. `deleted_at` ile soft delete; kullanıcıya "Arşivle" denir.
- Her tabloda `created_at`, `updated_at`, `deleted_at`.
- Şema yalnızca sıralı migration dosyalarıyla değişir; elle DDL çalıştırılmaz.
- Tarih/saat yerel duvar saati metni (ADR-017). **"Şimdi" tek kaynaktan gelir** —
  `local_now` komutu: SQL'de çıplak `'now'` yok (§0), arayüzde de ekrana giden bir
  `new Date()` yok (ADR-029).

### Dil
- Kod, veritabanı, dosya ve değişken adları: **İngilizce**
- Arayüz metinleri: **Türkçe**, tamamı `src/i18n/tr.ts` içinde. JSX'te çıplak metin yok.

### Marka (ADR-024)
İki ayrı kimlik var, karıştırılmaz:
- **Ürün — Aktansoft'un, sabit.** Ürün adı `Kurs Takip`, kimlik `com.aktansoft.kurstakip`,
  yayıncı `Aktansoft`. Değişkene bağlanmaz, ayarlardan düzenlenmez.
- **Kurum — müşterinin, değişken.** `config/kurum.json` içinde; derleme anında hem TS'e
  hem Rust'a gömülür. `tr.ts`'te kurum adı **bulunmaz** — orası ürün metinlerinin envanteri.
- `setting.institution_name` satırı migration'da duruyor ama **okunmuyor**.

### Windows (macOS'ta geliştirip Windows'a teslim ediyoruz)
- Dosya yolu string birleştirmeyle kurulmaz → Tauri path API
- Veritabanı `app_data_dir` altında (`%APPDATA%`), proje klasöründe değil
- Import'larda büyük/küçük harf tam eşleşmeli (macOS affeder, CI affetmez)
- Her yerde UTF-8. CSV/Excel çıktısına BOM eklenir.
- Sistem font stack; makinede kurulu font varsayma
- PDF'te Türkçe için **gömülü font zorunlu** (varsayılan PDF fontlarında ğ/ş/İ/ı yok)
- Platforma özel API kullanma; zorunluysa önce ADR yaz

### Arayüz
- Kullanıcı teknik değil: hata mesajları Türkçe ve **eylem önerir**. Ham hata kodu gösterme.
- Her yıkıcı işlemde onay diyaloğu, her başarılı işlemde bildirim.
- Her listede boş / yükleniyor / hata durumu olur.
- Türkçe sıralama ve arama: `İ/ı` sorunu çözülmüş olmalı (`localeCompare('tr')`).

### Ajan çalıştırma ve model seçimi

> **Hiçbir ajan modeli belirtilmeden çalıştırılmaz.** Model alanı boş bırakılırsa oturum
> modeli (Opus) miras alınır — boş yere Opus filosu tam olarak böyle doğar. Her `agent()`
> ve her `Agent` çağrısında `model` **açıkça** yazılır.

Yön **aşağıdan yukarı**: önce "Haiku yeter mi?" diye sor, yetmiyorsa Sonnet, Opus'u
**gerekçelendir**. Varsayılan Opus değil.

| Model | Ne için | Örnek |
|---|---|---|
| **Haiku** | Mekanik, dar, tek doğru cevabı olan iş | dosya/dizin listeleme, grep taraması, belgeden DDL çıkarma, sayma, biçim ve yazım kontrolü, "bu dosyada X geçiyor mu" |
| **Sonnet** | Sınırları belli, standart muhakeme | tek modülün CRUD'u, komponent yazımı, dar kapsamlı kod okuma, açık spesifikasyondan belge yazma, rutin denetim boyutu |
| **Opus** | Yanlış olmanın pahalı olduğu muhakeme | para/defter doğruluğu, şema tasarım takasları, karşıt doğrulama (bulgu çürütme), çok kaynaklı sentez, mimari karar ve ADR taslağı |

Kurallar:

- **Her ajandan önce tek satır gerekçe**: hangi model, neden. Gerekçe yazılamıyorsa model
  seçimi düşünülmemiş demektir.
- Bir workflow'da modeller **karışık** olur. Tek tip filo (hepsi Opus / hepsi Haiku) kokudur:
  ya para yakılıyordur ya kalite feda ediliyordur.
- `effort` de aynı mantıkla seçilir: mekanik aşamada `low`, asıl muhakemede `high`/`xhigh`.
- Ajan sayısı da aynı disipline tabi: 3 ajan işi görüyorsa 12 ajan çalıştırma.
- **Para mantığı istisnadır** — `ledger_entry`, taksit, paket ve bakiye ile ilgili denetim
  veya doğrulama her zaman en güçlü modelle yapılır. Burada tasarruf edilmez.

## Komutlar

Hepsi proje kökünden çalışır.

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Uygulamayı geliştirme kipinde açar (Vite + Tauri, canlı yenileme) |
| `npm run build` | Kurulum paketi üretir (macOS'ta `.app`/`.dmg`, Windows'ta `.msi`) |
| `npm run check` | **Kapı**: typecheck + lint (ESLint & clippy) + biçim + testler + paket denetimi |
| `npm test` | Bütün testler — önce vitest (arayüz), sonra cargo (Rust) |
| `npm run test:web` | Yalnızca arayüz testleri (vitest) |
| `npm run test:rust` | Yalnızca Rust testleri (`--all-features`) |
| `npm run seed` | Demo verisi yükler · `-- --reset` sıfırdan, `-- --db yol.db` başka dosyaya |
| `npm run fmt` | Rust kodunu biçimler (`check` bunu yalnızca **denetler**) |
| `npm run verify:bundle` | Üretim paketini derler ve `/dev` sayfalarının girmediğini doğrular |

`npm run check` commit öncesi çalıştırılır; CI de aynı adımları koşar.

**Seed üretime girmez.** `seed` bir Cargo özelliğidir ve varsayılan listede yoktur;
`npm run build` ile üretilen pakette demo verisi yükleyici bulunmaz.

Veritabanı `app_data_dir` altındadır (ADR-008), proje klasöründe değil:
- macOS: `~/Library/Application Support/com.aktansoft.kurstakip/kurs.db`
- Windows: `%APPDATA%\com.aktansoft.kurstakip\kurs.db`

> Kimlik Faz 4 §0'da `com.aydinozelders.kurstakip`'ten değiştirildi (ADR-024) ve
> `src-tauri/tests/identity.rs` ile `tauri.conf.json`'a çivilendi. Eski klasörde kalmış
> bir geliştirme veritabanı varsa taşınmaz — `npm run seed -- --reset` yeter.
