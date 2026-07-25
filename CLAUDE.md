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
| `docs/DURUM.md` | Nerede kaldık — her oturum sonunda güncellenir |
| `docs/KARARLAR.md` | Kilitli kararlar + ADR'ler. **Buradaki kararlar yeniden tartışılmaz.** |
| `docs/YOL-HARITASI.md` | 10 fazlık plan ve bağımlılıklar |
| `docs/TASARIM-KAYNAGI.md` | Claude Design projesi nasıl okunur |
| `docs/PRD.md` | Ürün gereksinimleri (Faz 1) |
| `docs/VERI-MODELI.md` | SQLite şeması ve gerekçeleri (Faz 1) |
| `docs/EKRANLAR.md` | Ekran envanteri (Faz 1) |
| `docs/TASARIM-SISTEMI.md` | Renk, tipografi, spacing, komponentler (Faz 1) |
| `docs/DENETIM-FAZ1.md` | Faz 1 denetimi — 25 bulgu, kanıtları ve düzeltmeleri |

## Stack

Tauri 2 + React + TypeScript + Vite + SQLite (rusqlite, `bundled`)

Sürümler kilitli: Rust `rust-toolchain.toml`'da, Tauri CLI `package.json`'da caret'siz.
CI aynı dosyaları okur — yerelde çalışan sürüm CI'da da çalışır.

## Klasör yapısı (Faz 3)

```
kurs/
├── .github/workflows/ci.yml   Windows + macOS test & paket
├── scripts/verify-bundle.mjs  üretim paketinde /dev sayfası kalmadığını doğrular
├── src/                       React arayüzü
│   ├── i18n/tr.ts             BÜTÜN Türkçe metinler (ADR-007)
│   ├── styles/                tokens.css (TEK kaynak) · base.css · density.css
│   ├── ui/                    komponent kütüphanesi — ekranlar buradan alır
│   ├── shell/                 AppShell · SidebarNav · PageHeader · routes.ts
│   ├── pages/                 ekranlar (Faz 3'te placeholder)
│   ├── dev/                   /dev/komponentler · /dev/durum — ÜRETİME GİRMEZ
│   ├── test/setup.ts          vitest + jsdom temizliği
│   └── lib/                   api.ts · format.ts (kuruş, tarih, telefon) ·
│                              sortTr.ts (ADR-020) · router.ts (ADR-023)
└── src-tauri/
    ├── migrations/            şemanın tek kaynağı — sıralı, checksum'lı, elle düzeltilmez
    ├── capabilities/          Tauri 2 yetki dosyaları
    ├── src/
    │   ├── lib.rs             AppState + Tauri kurulumu
    │   ├── commands.rs        #[tauri::command] — İNCE katman
    │   ├── db/                bağlantı, pragma, migration + checksum
    │   ├── repo/              iş mantığı: setting · people · academic · finance · views · ops
    │   ├── model.rs           tablo satır tipleri
    │   ├── money.rs           kuruş biçimleme (ADR-003)
    │   ├── text.rs            Türkçe küçültme, search_name (K9)
    │   ├── clock.rs           yerel tarih — SQLite saati OKUNMAZ (§0)
    │   ├── error.rs           tek hata tipi + Türkçe mesajlar (PRD §8)
    │   └── seed.rs            demo verisi — yalnızca `seed` özelliğiyle
    └── tests/                 crud · seals · views · seed_data
```

Repository katmanı `search_name` ve `phone_digits`'i **kendisi üretir**; çağıran boş
bırakır. `ledger_entry`'nin `update`/`archive` fonksiyonu **yoktur** — append-only (K5).

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

### Dil
- Kod, veritabanı, dosya ve değişken adları: **İngilizce**
- Arayüz metinleri: **Türkçe**, tamamı `src/i18n/tr.ts` içinde. JSX'te çıplak metin yok.

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
- macOS: `~/Library/Application Support/com.aydinozelders.kurstakip/kurs.db`
- Windows: `%APPDATA%\com.aydinozelders.kurstakip\kurs.db`
