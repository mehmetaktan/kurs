# Durum

**Son güncelleme:** 2026-07-25
**Mevcut faz:** Faz 3 tamamlandı → sırada **Faz 4** (Öğrenci ve veli modülü)
**Sonraki oturumda ilk iş:** `/faz-04`

> Faz 2'den devreden tek açık iş (ADR-022 migration'ı) **kapandı.** Şema artık doğru;
> borçlu listesini okuyan ekranlar bunun üstüne kurulabilir.
>
> **Depo hâlâ GitHub'a gitmedi** — Faz 2'nin iki kabul kriteri ve Windows doğrulaması
> bu yüzden bekliyor. Bu, Faz 4'ün en büyük riski (aşağıda).

---

## Faz 3 (Tasarım sistemi & kabuk) — tamamlandı

`npm run check` yeşil: **197 test** (89 Rust + 108 TypeScript) + typecheck + ESLint +
clippy + rustfmt + **yeni paket denetimi**.

| Ne | Nerede |
|---|---|
| Token'lar | `src/styles/tokens.css` — TEK kaynak; renk, tipografi, aralık, yarıçap, gölge, sabit ölçüler |
| Komponentler | `src/ui/` — 28 komponent, varyantları ve disabled/hata durumlarıyla |
| Kabuk | `src/shell/` — `AppShell` · `SidebarNav` (7 öğe) · `PageHeader` · `StatusBar` · `routes.ts` |
| Yönlendirme | `src/lib/router.ts` — hash tabanlı, kütüphanesiz (**ADR-023**) |
| Türkçe altyapı | `src/lib/format.ts` — tarih, saat, telefon, arama normalleştirmesi |
| Showcase | `/dev/komponentler` ve `/dev/durum` — üretim paketine **girmiyor** |

### §0 — ADR-022 migration'ı (devir borcu kapandı)

`src-tauri/migrations/002_ledger_effective_parity.sql`. DDL `VERI-MODELI.md §1.23` ile
**birebir aynı** (`diff` ile doğrulandı). `001_initial.sql`'e dokunulmadı.

Dört test yazıldı ve **negatif kontrolü yapıldı** — migration kaydı `migrate.rs`'ten
geçici olarak çıkarıldığında üçü düşüyor, geri konduğunda geçiyor:

| Test | İddia |
|---|---|
| `yoklama_duzeltme_zinciri_borcu_borclu_listesinde_gosterir` | Uzunluk 3 → borçlu listesi 250 ₺ gösterir (**eski test tersine çevrildi**) |
| `tahsilat_iptalinin_geri_alinmasi_borc_yaratmaz` | Uzunluk 3, ters yön → borcu olmayan öğrenci listede çıkmaz |
| `parite_degismezi_karisik_zincirlerde_korunur` | Uzunluk 1–4 bir arada + avanslı öğrenci → değişmez korunur |
| `zincir_uzunlugu_dortte_bakiye_ve_borc_sifira_doner` | Uzunluk 4 → ikisi de sıfır |

Değişmez `tests/common/mod.rs` içinde `assert_ledger_invariant` olarak duruyor ve
**seed verisinin tamamı üzerinde de** koşuyor (`seed_parite_degismezini_korur`).

Uçtan uca kanıt: `npm run seed` sonrası uygulama açıldı, `migration: [1, 2]` uygulandı ve
kenar çubuğundaki **Ödemeler rozeti 7 borçlu** gösterdi — bu sayı `v_student_debt`'ten,
yani yeni view'dan geliyor.

### Bu oturumda bulunan iki gerçek hata (düzeltildi)

- **`ModalOption` başlık ve ipucu yan yana akıyordu.** `<span>` satır içi olduğu için
  `margin-top` hiç uygulanmıyor, tasarımın iki satırlı düğmesi tek satıra düşüyordu.
  Ekran görüntüsüne bakarken görüldü — testler bunu yakalamaz, `display: block` eklendi.
- **Showcase tablosunda "Son ders" ham ISO yazıyordu** (`2026-05-02`). Referans sayfası
  doğru kullanımı göstermek zorunda; `formatDate` eklendi.

### Yeni kapı: `npm run verify:bundle`

Showcase'in üretim paketine girmediği garantisi kırılgandı — bir yerde **statik** `import`
etmek yeter ve kimse fark etmez, çünkü uygulama çalışmaya devam eder; sadece kurs
sahibine gönderilen pakette bir geliştirici sayfası taşınır.

`scripts/verify-bundle.mjs` bunu kapıya bağladı: derlenen `dist/` içinde 5 geliştirici
işaretçisi aranıyor, ayrıca kabuk metinlerinin **var olduğu** doğrulanıyor (boş bir
`dist`'e bakıp "temiz" demesin). Negatif kontrolü yapıldı: sızıntı varken çıkış kodu 1.

### Windows'a dönük iki bilinçli karar

- **`DatePicker` / `TimePicker` yerel `<input type="date">` KULLANMIYOR.** WebView2'de
  biçim Windows'un bölge ayarına bağlı; İngilizce Windows'ta kullanıcı `mm/dd/yyyy`
  görür ve 25 Temmuz yerine başka bir güne kaydeder. Ayrıştırma testli `format.ts`'te.
- **Gün/ay adları `toLocaleDateString('tr')` ile üretilmiyor**, `tr.ts`'te sabit liste.
  ICU verisi eksik kurulmuş bir Windows'ta İngilizce gün adı dönebilir. Aynı gerekçe
  `normalizeTr` için de geçerli (`'I'` → `'i'` riski).

### Parite disiplini sürdürüldü

| TS | Rust | Ortak vektörler |
|---|---|---|
| `formatKurus` / `parseKurus` | `money::format_kurus` / `parse_kurus` | Faz 2'den beri |
| `phoneDigits` | `text::phone_digits` | **bu fazda eklendi** |
| `normalizeTr` | `text::search_name` | **bu fazda eklendi** |

Rust tarafındaki test modülüne de ikizine işaret eden not düşüldü. Tarih/saat
biçimleyicisinin henüz Rust karşılığı **yok**; Faz 8 makbuz için yazınca vektörler
ortak listeye taşınacak (not `format.ts` başında).

---

## Bilinçli ertelenenler

| Ne | Neden |
|---|---|
| `CalendarGrid` `SessionBlock` `NowIndicator` `ClosedDayOverlay` `DropTarget` `Legend` `OverlayEmptyState` `Toolbar` | **Faz 5.** Hepsi takvim ekranının veri modeline bağlı; boşlukta yazılırsa ekran gelince yeniden yazılır. `TASARIM-SISTEMI §6`'da ⏭ ile işaretli |
| `NoteList` / `NoteComposer` | **Faz 4** — aynı gerekçe, öğrenci notlarıyla birlikte |
| Global arama sonuçları (`Ctrl K`) | Panel ve kısayol bağlandı, **sonuç kaynağı yok**: öğrenci/grup/ders listeleri Faz 4–5'te geliyor. Kısayolun hiçbir şey yapmaması, olmamasından kötü olurdu |
| Sayfa içerikleri | Placeholder — her biri hangi fazda dolacağını söylüyor (`routes.ts`) |
| `design-ref/support.js` | Claude Design'ın render motoru, bizim kodumuz değil |

## Doğrulanmayan tek şey

**Yapışkan tablo başlığı (`stickyHeader`).** Showcase'te gerçek bir kaydırma kabı içinde
tam sınanmadı; başlığın satırların üstünde kalıp kalmadığı gözle net görülmedi. Asıl
testi Faz 4'ün öğrenci listesi olacak — orada yapışkan başlık ekranın gereği.

## Bağımlılık notu

Üç geliştirme bağımlılığı eklendi, hepsi caret'siz kilitli: `jsdom`,
`@testing-library/react`, `@testing-library/dom` (üçüncüsü v16'da peer dependency,
zorunlu). `@testing-library/jest-dom` **kurulmadı** — kolaylık eşleştiricileri için
dördüncü bir bağımlılık taşımak yerine testler `textContent` / `getAttribute` okuyor.

`npm audit` 12 "high" gösteriyor; **hiçbiri bu fazda eklenenlerden değil** — eslint ve
vite geliştirme araç zincirinin bilinen uyarıları, teslim edilen pakete girmiyorlar.
Sürüm kilitleme disiplinini faz ortasında bozmamak için dokunulmadı. Ayrı bir turda
ele alınabilir; aciliyeti yok çünkü ikisi de yalnızca geliştirme makinesinde çalışıyor.

---

## Açık işler

### 1. GitHub'a push — senin elinde, artık geciken bir iş

**Depo hâlâ GitHub'a gitmedi** (`git remote` boş), hiçbir CI çalışması olmadı. Faz 2'nin
kabul kriteri 2 ve 3 bu yüzden hâlâ ⏳ — ve şimdi **iki fazlık doğrulanmamış kod** birikti.

```
gh auth login
gh repo create kurs-takip --private --source=. --remote=origin --push
```

`gh auth login` interaktif — sohbete `! gh auth login` yazarak buradan da çalıştırabilirsin.
Push ile workflow kendiliğinden başlar; ilk çalışma ~15–25 dk (Rust derlemesi önbelleksiz).

> **Windows makine yok — hiçbir aşamada gerekmiyor** (ADR-008). `.msi` **indirilmez,
> kurulmaz.** Actions sayfasında bakılacak tek şey: `Test · windows-latest` yeşil mi
> (asıl kanıt bu — testler gerçek migration'ları uyguluyor) ve Artifacts kutusunda sıfır
> olmayan boyutta bir `.msi` listeleniyor mu. `.msi`'yi gerçekten kurup açmak Faz 5
> sonunda **kurs sahibinin bilgisayarında** olacak.

### 2. Faz 6'ya devredilen açık karar — ders hakkı tarafı

`ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil olduğu için düzeltme zincirinin
üçüncü adımında ikinci `delta = −1` yazılamıyor. **Defter tarafı ADR-022 ile kapandı**;
bu, ders hakkı sayacının ayrı sorunu (ADR-015: iki ayrı sayaç). Seçenekler `faz-06.md §3b`'de.

---

## Açık sorular — cevabını senden bekliyorum

`docs/PRD.md` §9'da gerekçeleriyle. **S1 (ADR-021) ve S8 cevaplandı.** Hiçbiri Faz 4'ü
bloklamıyor; her birinin varsayılan varsayımı var.

| # | Soru | Hangi faz |
|---|---|---|
| S2 | Grup kapasitesi aşımı engellensin mi, uyarı mı? | Faz 5 |
| S4 | Standart ders süresi kaç dakika? | Faz 5 |
| S3 | Paketlerin son kullanma tarihi var mı? | Faz 7 |
| S6 | Dönem ortasında ayrılanın kalan paket parası iade mi, alacak mı? | Faz 7 |
| S5 | Makbuz numarası otomatik mi artsın? | Faz 8 |
| S7 | "Devam oranı" hangi pencerede hesaplansın? | Faz 9 |
| S9 | Bilgisayarındaki Windows sürümü ne? | **Faz 10 öncesi** |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 |

---

## Faz 4'ün en büyük riski

**Windows'ta hiç çalıştırılmamış iki fazlık kod birikti.** Faz 2 şemayı, Faz 3 arayüzün
tamamını yazdı; ikisi de yalnızca macOS'ta koştu. Faz 4 gerçek ekranları bunun üstüne
kuracak. Bir Windows sorunu (satır sonu, dosya yolu, import büyük/küçük harfi, WebView2
davranışı) bugün bir migration ve bir tasarım sistemi katmanının altında; Faz 4'ten sonra
bir de öğrenci modülünün altında olacak. **Push edilmezse hata ucuz olmaktan çıkar.**

İkinci risk daha küçük ama gerçek: kolon genişlikleri ve kaydırma çubuğu **Segoe UI**
altında doğrulanmadı. Tasarımın 13px yoğun tablosu Windows'ta bir tık geniş çizilir;
`Öğrenciler` tablosunun 8 kolonu taşarsa bu Faz 4'te görülür — ama yalnızca CI ekran
görüntüsü ya da kurs sahibinin bilgisayarı varsa. Şimdilik yalnızca `min-width: 1280px`
güvencesi var.
