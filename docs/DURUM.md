# Durum

**Son güncelleme:** 2026-07-25 · Faz 3 sonrası yönetici denetimi
**Mevcut faz:** Faz 3 ✅ tamamlandı, denetimi ✅ yapıldı → sırada **Faz 4**
**Sonraki oturumda ilk iş:** önce **sen push edeceksin**, sonra `/faz-04`

> Kod tarafında açık iş yok. `npm run check` Faz 3 sonunda tam yeşildi:
> **197 test** (89 Rust + 108 TypeScript) + typecheck + ESLint + clippy + rustfmt +
> paket denetimi. Bu oturumda koda dokunulmadı.
>
> Bekleyen iki şey var ve ikisi de **Faz 4 kodundan önce** sırada:
> **(1)** depo hâlâ GitHub'a gitmedi — üç fazlık kod Windows'ta hiç koşmadı,
> **(2)** marka geçişi (ADR-024) — uygulama kimliği veritabanının klasörünü belirliyor.

---

## Sıradaki beş adım

| # | Ne | Kim | Neden bu sırada |
|---|---|---|---|
| 1 | `gh repo create … --push` | **sen** | Üç fazlık doğrulanmamış kod birikti |
| 2 | CI #1 yeşil mi? | sen bakarsın | Mevcut kodun Windows **temel çizgisi** |
| 3 | `/faz-04` **§0**: marka + kimlik (ADR-024) | kod oturumu | Kimlik, gerçek veri oluşmadan değişmeli |
| 4 | CI #2 yeşil mi? | kod oturumu | Rename bir şey kırdı mı |
| 5 | Faz 4 asıl işi: öğrenci ve veli modülü | kod oturumu | — |

Push'un marka geçişinden önce olmasının sebebi: iki ayrı CI çalışması **iki ayrı veri
noktası** verir. Rename sonrası bir şey kırılırsa nedeninin rename mi yoksa eski kod mu
olduğu belli olur; tek koşuda bu ayrım kaybolur.

```
gh auth login          # interaktif — sohbete `! gh auth login` yazarak da çalıştırabilirsin
gh repo create kurs-takip --private --source=. --remote=origin --push
```

Push ile workflow kendiliğinden başlar; ilk çalışma ~15–25 dk (Rust derlemesi önbelleksiz).

> **Windows makine yok — hiçbir aşamada gerekmiyor** (ADR-008). `.msi` **indirilmez,
> kurulmaz.** Actions sayfasında bakılacak tek şey: `Test · windows-latest` yeşil mi
> (asıl kanıt bu — testler gerçek migration'ları uyguluyor) ve Artifacts kutusunda sıfır
> olmayan boyutta bir `.msi` listeleniyor mu. `.msi`'yi gerçekten kurup açmak Faz 5
> sonunda **kurs sahibinin bilgisayarında** olacak.

---

## Bu oturumda yapılanlar (yönetici — kod yazılmadı)

### ADR uyum denetimi: 7/7 temiz

Frontend'de SQL yok · `f64`/`parseFloat`/`toFixed` ile para yok · saklanan bakiye sütunu
yok · `DELETE FROM` yok · platforma özel API ya da elle kurulmuş dosya yolu yok · fiyat
snapshot'ı yerinde · `tr.ts` disiplini yerinde.

### Verilen karar: ADR-024 — marka

Uygulamanın adı ve geliştiricisi **Aktansoft**; kurum adı müşteriye ait bir değişken.
İki kimlik ayrıldı:

| | Değer | Nerede yaşıyor |
|---|---|---|
| **Ürün** (Aktansoft'un, sabit) | Ürün adı `Kurs Takip` · kimlik `com.aktansoft.kurstakip` · yayıncı `Aktansoft` | `tauri.conf.json` · `Cargo.toml` · `db/mod.rs` |
| **Kurum** (müşterinin, değişken) | `Aydın Özel Ders` | `config/kurum.json` — derleme anında TS'e ve Rust'a gömülür |

**Kabul edilen bedel:** kurs sahibi kurum adını kendi değiştiremez; değişiklik yeniden
derleme ve yeni bir `.msi` gerektirir. Buna bağlı olarak `setting.institution_name`
satırı **ölü veriye** döndü — migration mühürlü olduğu için silinemiyor, yerinde duruyor
ama kod onu sorgulamıyor. `EKRANLAR.md E18`'den (Tanımlar → Genel) kurum adı çıkarıldı.

**Neden Faz 10 değil de şimdi:** `identifier` veritabanının `%APPDATA%` klasörünü
belirliyor. Bugün iki satır; kurs sahibinin makinesinde gerçek veri oluştuktan sonra bir
veri taşıma işi ve bir destek görüşmesi.

### Denetimde çıkan üç kusur — hepsi `faz-04.md §0`'a yazıldı

| # | Kusur | Neden önemli |
|---|---|---|
| 1 | `SidebarNav.tsx:26` kurum adını `tr.ts`'ten okuyor | `app_status` zaten `institutionName` döndürüyor ama **yalnızca dev sayfası** kullanıyor. Aynı değer iki yerde: er geç ikiye ayrılır |
| 2 | `db/mod.rs:14` `APP_IDENTIFIER` ile `tauri.conf.json > identifier` eşitliğini **hiçbir test korumuyor** | Sadece bir yorum satırı var. Ayrışırlarsa seed binary'si ile uygulama farklı klasörlere yazar; kullanıcı verisinin kaybolduğunu sanır. Kimlik değişikliği bu riski **canlı** hâle getiriyor |
| 3 | `tr.app.version` elle yazılmış `'Sürüm 1.0'`, gerçek sürüm `0.1.0` | Elle yazılan sürüm kayar ve kimse fark etmez |

Ayrıca `tr.app.brand` bugün `'DersTakip'` — hiçbir yerde karşılığı olmayan ayrı bir ad.
`'Kurs Takip'` oluyor.

### Değişen belgeler

`KARARLAR.md` (ADR-024) · `CLAUDE.md` (Marka bölümü · klasör yapısı · DB yolu) ·
`EKRANLAR.md` (E18 · kenar çubuğu iki kimlik notu) · `VERI-MODELI.md`
(`setting.institution_name` "okunmuyor" işaretlendi, 3 yerde) · `PRD.md` (R4.11'in
kaynağı) · `YOL-HARITASI.md` · `.claude/commands/faz-04.md` (**§0** eklendi).

---

## Faz 3'ten devreden bilgi

<details>
<summary>Faz 3 ne bıraktı (özet — ayrıntı commit 667541f'de)</summary>

| Ne | Nerede |
|---|---|
| Token'lar | `src/styles/tokens.css` — TEK kaynak |
| Komponentler | `src/ui/` — 28 komponent |
| Kabuk | `src/shell/` — `AppShell` · `SidebarNav` (7 öğe) · `PageHeader` · `StatusBar` · `routes.ts` |
| Yönlendirme | `src/lib/router.ts` — hash tabanlı, kütüphanesiz (**ADR-023**) |
| Türkçe altyapı | `src/lib/format.ts` — tarih, saat, telefon, arama normalleştirmesi |
| Showcase | `/dev/komponentler` · `/dev/durum` — üretim paketine girmiyor, `verify:bundle` kapısıyla korunuyor |

**ADR-022 devir borcu kapandı.** `002_ledger_effective_parity.sql`, DDL `VERI-MODELI.md
§1.23` ile birebir. Dört test + negatif kontrol (migration çıkarılınca üçü düşüyor).
Değişmez `assert_ledger_invariant` seed verisinin tamamı üzerinde de koşuyor.

**Windows'a dönük iki bilinçli karar:** `DatePicker`/`TimePicker` yerel
`<input type="date">` kullanmıyor (WebView2'de biçim bölge ayarına bağlı, `mm/dd/yyyy`
riski); gün/ay adları `toLocaleDateString('tr')` ile değil `tr.ts`'teki sabit listeden
geliyor (eksik ICU riski).

**TS ↔ Rust parite disiplini:** `formatKurus`/`parseKurus`, `phoneDigits`/`phone_digits`,
`normalizeTr`/`search_name` aynı vektörlerle iki tarafta sınanıyor. Tarih/saat
biçimleyicisinin Rust karşılığı **yok**; Faz 8 makbuzunda yazılınca ortak listeye taşınacak.

</details>

### Bilinçli ertelenenler

| Ne | Neden |
|---|---|
| `CalendarGrid` `SessionBlock` `NowIndicator` `ClosedDayOverlay` `DropTarget` `Legend` `OverlayEmptyState` `Toolbar` | **Faz 5.** Hepsi takvim ekranının veri modeline bağlı; boşlukta yazılırsa ekran gelince yeniden yazılır. `TASARIM-SISTEMI §6`'da ⏭ ile işaretli |
| `NoteList` / `NoteComposer` | **Faz 4** — aynı gerekçe, öğrenci notlarıyla birlikte |
| Global arama sonuçları (`Ctrl K`) | Panel ve kısayol bağlandı, **sonuç kaynağı yok**: öğrenci/grup/ders listeleri Faz 4–5'te geliyor |
| Sayfa içerikleri | Placeholder — her biri hangi fazda dolacağını söylüyor (`routes.ts`) |
| `npm audit` 12 "high" | Hiçbiri projenin kendi bağımlılığı değil — eslint/vite geliştirme araç zincirinin bilinen uyarıları, teslim edilen pakete girmiyorlar. Sürüm kilitleme disiplinini faz ortasında bozmamak için dokunulmadı; ayrı bir turda ele alınabilir |

### Doğrulanmayan tek şey

**Yapışkan tablo başlığı (`stickyHeader`).** Showcase'te gerçek bir kaydırma kabı içinde
tam sınanmadı. Asıl testi **Faz 4'ün öğrenci listesi** olacak — orada yapışkan başlık
ekranın gereği.

---

## Açık işler

### 1. GitHub'a push — senin elinde, Faz 4'ten önce

Yukarıdaki "Sıradaki beş adım" tablosunda. Faz 2'nin kabul kriteri 2 ve 3 buna bağlı,
hâlâ ⏳.

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

## Bir sonraki oturumun en büyük riski

**Windows'ta hiç çalıştırılmamış üç fazlık kod birikti.** Faz 2 şemayı, Faz 3 arayüzün
tamamını yazdı; ikisi de yalnızca macOS'ta koştu. Faz 4 gerçek ekranları bunun üstüne
kuracak. Bir Windows sorunu (satır sonu, dosya yolu, import büyük/küçük harfi, WebView2
davranışı) bugün bir migration ve bir tasarım sistemi katmanının altında; Faz 4'ten sonra
bir de öğrenci modülünün altında olacak. **Push edilmezse hata ucuz olmaktan çıkar.**

Bu riskin bu oturumda **büyüyen** bir yanı var: marka geçişi `identifier`'ı değiştiriyor,
yani `%APPDATA%` klasörünü. Bu tam olarak Windows'a özgü bir yol davranışı ve macOS'ta
sınanamaz. Push edilmemiş bir depoda bu değişiklik **hiç doğrulanmadan** Faz 4'ün altına
gömülür.

İkinci risk daha küçük ama gerçek: kolon genişlikleri ve kaydırma çubuğu **Segoe UI**
altında doğrulanmadı. Tasarımın 13px yoğun tablosu Windows'ta bir tık geniş çizilir;
`Öğrenciler` tablosunun 8 kolonu taşarsa bu Faz 4'te görülür — ama yalnızca CI ekran
görüntüsü ya da kurs sahibinin bilgisayarı varsa. Şimdilik yalnızca `min-width: 1280px`
güvencesi var.
