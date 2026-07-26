# Tasarım Sistemi

`design-ref/` altındaki 4 ekrandan çıkarıldı. **Faz 3'te CSS değişkenlerine dönüştü:
`src/styles/tokens.css`.** Yeni ekran tasarlarken buradaki değerlerin dışına çıkılmaz;
yeni görsel dil icat edilmez. Bileşen dosyalarında hardcoded hex/px bulunmaz — hepsi
token'dan okunur.

Karakteri tek cümleyle: **sıcak gri kağıt üzerinde ince çizgili, ikonsuz, yoğun bir masaüstü
arayüzü.** Renk yalnızca durum bildirir; dekoratif renk yok.

---

## 1. Renk

Tasarım nötr sıcak gri (bej-gri) bir eksende kurulu. Saf `#fff` yalnızca kart ve girdi
yüzeyinde, saf siyah hiç yok. Bu bilinçli: uzun süre bakılan bir ekran.

### 1.1 Yüzeyler

| Token | Hex | Nerede |
|---|---|---|
| `surface-canvas` | `#fbfaf8` | Uygulama zemini; koyu düğme üzerindeki metin de bu |
| `surface-raised` | `#faf9f6` | Özet şerit, takvim başlık satırı |
| `surface-bar` | `#f7f6f3` | Alt bilgi çubuğu, takvim açıklama şeridi |
| `surface-sidebar` | `#f2f1ee` | Kenar çubuğu, boş durum ikon dairesi |
| `surface-card` | `#ffffff` | Kart, girdi, açılır liste, **birebir** ders bloğu |
| `surface-muted` | `#efedea` | İkincil düğme zemini |
| `surface-hover` | `#eae8e3` | Menü öğesi hover |
| `surface-selected` | `#e5e2dc` | Aktif menü, avatar, seçili filtre çipi, ikincil düğme hover |
| `surface-block` | `#e8e3db` | **Grup** ders bloğu |
| `surface-row-hover` | `#f4f2ef` | Tablo satırı hover |

### 1.2 Kenarlıklar

| Token | Hex | Nerede |
|---|---|---|
| `border-strong` | `#dcd9d3` | Girdi kenarı, bölüm alt çizgisi, kaydırma çubuğu |
| `border-default` | `#e2dfd9` | Kenar çubuğu ayracı, düğme kenarı, klavye tuşu rozeti |
| `border-subtle` | `#e7e5e0` | Tablo satır ayracı, başlık alt çizgisi |
| `border-faint` | `#edeae5` | En ince ayraç (çekmece, not kutusu) |
| `border-block` | `#d8d3ca` | Takvim ders bloğu kenarı |
| `border-focus` | `#b3ada3` | Girdi odaklandığında |
| `grid-minor` / `grid-major` | `#f2efea` / `#e7e3dc` | Takvim 30 dk / 60 dk çizgileri |

### 1.3 Metin

| Token | Hex | Kullanım |
|---|---|---|
| `text-primary` | `#2f2d2a` | Başlık, öğrenci adı, tutar |
| `text-secondary` | `#4a4741` | Tablo hücresi, menü öğesi |
| `text-tertiary` | `#736f68` | Saat, tarih, açıklama |
| `text-quaternary` | `#8f8a80` | Takvim bloğu meta satırı |
| `text-muted` | `#9a958d` | Kolon başlığı, etiket, yardım metni |
| `text-placeholder` | `#a8a39a` | Girdi placeholder |
| `text-disabled` | `#b0aaa0` | "Bekleniyor", klavye ipucu |
| `text-empty` | `#cfcabf` | Boş değer tiresi (`—`) |
| `text-on-dark` | `#fbfaf8` | Koyu düğme / toast üzerinde |
| `text-on-dark-muted` | `#c9c5bd` | Koyu düğme alt satırı |

### 1.4 Eylem

| Token | Hex |
|---|---|
| `action-primary` | `#2f2d2a` |
| `action-primary-hover` | `#1f1d1b` |
| `action-primary-text` | `#fbfaf8` |

Birincil düğme koyu ve **ekranda tektir.** Her ekranda tek bir "Yeni ders" / "Yeni öğrenci" /
"Tahsilat al" düğmesi bu rengi taşır; geri kalan her şey ikincil.

### 1.5 Durum renkleri

| Rol | Ana renk | Zemin | Kenar | Nerede |
|---|---|---|---|---|
| **Başarı / aktif** | `#5f8f6b` | — | — | Aktif öğrenci noktası, "Geldi", ödenmiş taksit |
| **Uyarı / dikkat** | `#b57314` | `#f9f1e4` `#faf3e8` `#f2e0c4` `#f0d49a` | `#e6c893` | Yoklama girilmedi, paketi bitiyor, "Mazeretli" |
| **Uyarı vurgusu** | `#d59029` | — | — | Sol iç gölge şeridi, "şimdi" çizgisi |
| **Uyarı koyu metin** | `#8a5710` / `#7a4e10` | — | — | Amber düğme ve etiket metni |
| **Hata / borç** | `#a83a2b` | `#f4ddd7` | — | Borç tutarı, menüdeki borç rozeti, "Mazeretsiz" |
| **Çakışma** | `#cf7a4a` | — | — | Takvimde `!` rozeti ve blok konturu |
| **Nötr / pasif** | `#b0aaa0` | `#efece6` | `#e2dfd9` | Pasif öğrenci halkası, "İptal", tatil rozeti |

**Kural:** Kırmızı yalnızca **para** için. Devamsızlık, çakışma ve gecikme farklı tonlar
kullanıyor; hepsi kırmızı olsaydı hiçbiri fark edilmezdi.

### 1.6 Kategori paleti

Tasarımda öğretmen ayırt etmek için kullanılıyor. Paletin asıl kullanım yeri **branş**
rengidir (`subject.color`) — ders bloğunun rengini branş belirler. **ADR-037 ile
öğretmen rengi de aynı paletten seçilir** (`teacher.color`, `Tanımlar → Öğretmenler`);
takvimde blok rengi değil, meta satırındaki nokta olarak görünür — iki eksen aynı anda
renklendirilmez:

| Hex | Ton |
|---|---|
| `#5f8f6b` | yeşil |
| `#6a86a8` | mavi |
| `#b57314` | amber |
| `#9079a6` | mor |
| `#8a8079` | gri |

Hepsi düşük doygunlukta; zeminle aynı sıcaklıkta. Doygun renk eklenmez.

### 1.7 Örtü ve efektler

| Token | Değer | Nerede |
|---|---|---|
| `scrim-modal` | `rgba(31,29,27,.30)` | Modal arkası |
| `scrim-drawer` | `rgba(31,29,27,.28)` | Çekmece arkası |
| `scrim-soft` | `rgba(251,250,248,.74)` | Takvim boş durum örtüsü (içerik seçilir kalır) |
| `shade-past` | `rgba(120,110,95,.05)` | Takvimde geçmiş saat gölgesi |
| `drop-target` | `rgba(181,115,20,.09)` + `1.5px dashed #b57314` | Sürükleme hedefi |
| `hatch-closed` | `repeating-linear-gradient(45deg, #efece6 0 6px, #e5e1d9 6px 12px)` | Tatil sütunu |

---

## 2. Tipografi

### 2.1 Font yığını

```css
font-family: "Helvetica Neue", Helvetica, "Segoe UI", Arial, sans-serif;
-webkit-font-smoothing: antialiased;
text-rendering: optimizeLegibility;
```

> **Windows notu.** Bu yığın Windows'ta **Segoe UI**'ye düşer — tasarımın macOS'taki
> Helvetica Neue görünümünden bir tık daha geniş. Kabul edilebilir; sistem fontu kullanmak
> (CLAUDE.md kuralı) font paketi dağıtmaktan daha güvenli. Kolon genişlikleri Faz 3'te
> Windows'ta doğrulanır.
>
> **PDF ayrıdır.** Makbuzda gömülü font zorunlu (ğ/ş/İ/ı) — Faz 8.

### 2.2 Ölçek

Tasarımın tamamı **13px gövde** üzerine kurulu. 14px yok denecek kadar az; sıçrama
13 → 15 → 17 → 19 → 30 şeklinde.

| Token | px | Ağırlık | Satır y. | Harf ar. | Kullanım |
|---|---|---|---|---|---|
| `text-display` | 30 | 600 | 1 | −.02em | Özet kartlarındaki büyük sayı (bakiye, devam oranı) |
| `text-title-lg` | 19 | 600 | — | −.01em | Öğrenci detayı adı |
| `text-title` | 17 | 600 | — | — | Sayfa başlığı ("Bugün", "Öğrenciler"), özet kart alt değeri |
| `text-title-sm` | 16 | 600 | — | — | Çekmece başlığı |
| `text-subtitle` | 15 | 600 | — | −.01em | Takvim tarih aralığı, modal başlığı, boş durum başlığı |
| `text-body` | **13** | 400 / 600 | — | — | **Varsayılan.** Tablo hücresi, menü, düğme, girdi |
| `text-control` | 12.5 | 400 / 600 | — | — | Segment düğmesi, filtre çipi, geri bağlantısı |
| `text-meta` | 12 | 400 / 600 | — | — | Kolon başlığı, açıklama, rozet |
| `text-caption` | 11 | 400 / 600 | — | .02em (büyük harfte) | Kart etiketi (BAKİYE), saat cetveli, açıklama şeridi |
| `text-micro` | 10 / 9.5 | 400 / 600 | — | — | Takvim bloğu içi (dar sütunda) |

**Ağırlıklar:** yalnızca **400** ve **600**. `700` sadece iki yerde — bugünün takvim
sütun başlığı ve çakışma `!` rozeti. Başka yerde kullanılmaz.

**Prose:** `line-height: 1.55` + `text-wrap: pretty` (boş durum ve modal açıklamaları).

### 2.3 Sayı kuralı — pazarlıksız

**Her sayı `font-variant-numeric: tabular-nums` ile yazılır.** Tutar, tarih, saat, telefon,
sayaç, oran. Tasarımda istisnasız uygulanmış; alt alta gelen rakamlar hizalı olmazsa liste
okunamaz.

Para biçimi: `1.234,56 ₺` (Türkçe ayraçlar). Negatif için **U+2212 (`−`)**, ASCII tire değil:
`−1.200 TL`.

---

## 3. Aralık (spacing)

Tasarım katı bir 4/8 ızgarası kullanmıyor — tek sayılı değerler yaygın (7, 9, 11, 13, 17).
Bu, yoğun bir arayüzde optik hizalama tercihi. Faz 3'te **gözlenen değerler token'lanır**,
en yakın 4'e yuvarlanmaz.

| Token | px | Tipik kullanım |
|---|---|---|
| `space-0.5` | 2 | Etiket altı boşluk |
| `space-1` | 4 | Satır içi mikro boşluk |
| `space-1.5` | 6 | Nokta ↔ metin |
| `space-2` | 8 | Menü öğesi dikey dolgu |
| `space-2.5` | 10 | Düğme grubu boşluğu |
| `space-3` | 12 | Tablo hücre boşluğu, menü yatay dolgu |
| `space-3.5` | 14 | Kart ızgarası boşluğu |
| `space-4` | 16 | Düğme yatay dolgu |
| `space-4.5` | 18 | Kenar çubuğu dolgusu |
| `space-5` | 20 | Çekmece içi dolgu |
| `space-5.5` | 22 | İçerik üst dolgusu |
| `space-6` | 24 | Çekmece yatay dolgu, takvim yatay dolgu |
| `space-6.5` | 26 | Sekme arası, yan sütun bölüm arası |
| `space-7` | **28** | **Ana içerik yatay dolgusu** |
| `space-8` | 32 | İki kolonlu düzen arası |

**Satır yoğunluğu.** Üç ekranda birden `rahat / sıkı` seçeneği var → gerçek bir kullanıcı
ayarı (`setting.row_density`):

| | rahat | sıkı |
|---|---|---|
| Tablo satırı dikey dolgu | `13px` | `9px` |
| Takvim 30 dk yüksekliği | `30px` | `22px` |

---

## 4. Köşe yarıçapı ve gölge

### Yarıçap

| px | Nerede |
|---|---|
| 3 | Açıklama şeridindeki renk örneği |
| 4 | Klavye tuşu rozeti (`Ctrl K`, `Esc`) |
| 6 | Menü öğesi, küçük düğme, kaydırma çubuğu, küçük takvim bloğu |
| **7** | **Düğme, girdi, takvim bloğu** — en yaygın |
| 8 | Segment kabı, modal içi seçenek düğmesi, toast |
| 9 | Not kutusu, menü sayı rozeti |
| 10 | Özet kartı |
| 12 | Modal, boş durum kartı, durum hapı |
| 16 | Filtre çipi |
| 50% | Avatar, durum noktası, ikon dairesi |

### Gölge

Gölge **nadir ve derin**. Yalnızca katman değiştiren öğelerde; kartlarda gölge yok, kenarlık var.

| Token | Değer | Nerede |
|---|---|---|
| `shadow-modal` | `0 24px 60px -30px rgba(0,0,0,.5)` | Modal |
| `shadow-overlay` | `0 18px 44px -26px rgba(0,0,0,.35)` | Takvim boş durum kartı |
| `shadow-drawer` | `-16px 0 40px -24px rgba(0,0,0,.3)` | Sağ çekmece |
| `shadow-toast` | `0 10px 30px -14px rgba(0,0,0,.55)` | Toast |
| `shadow-drag` | `0 14px 28px -10px rgba(0,0,0,.5)` | Sürüklenen ders bloğu |

**İç gölge (accent olarak):**

| Değer | Anlam |
|---|---|
| `inset 3px 0 0 #d59029` | "Yoklama girilmedi" — satırın/bloğun sol şeridi |
| `inset 0 -2px 0 #2f2d2a` | Aktif sekme alt çizgisi |

---

## 5. İkonlar

**İkon seti yok. Kütüphane kurulmayacak.**

Tasarım tamamen tipografik işaretler kullanıyor:

| İşaret | Anlam |
|---|---|
| `‹` `›` | Önceki / sonraki |
| `＋` (U+FF0B) | Ekle |
| `✕` / `×` | Kapalı / kapat |
| `⌕` | Ara (boş durum) |
| `✓` | Tamamlandı |
| `↵` | Enter ipucu |
| `←` `→` | Geri / sekme kısayolu |
| `▾` | Açılır liste oku |
| `!` | Çakışma (turuncu daire içinde) |
| `—` | Boş değer |

**Durum göstergesi ikon değil, noktadır:**

- 7px dolu daire → aktif durum (yeşil/turuncu/kırmızı)
- 7px **içi boş halka** (`1.5px` kenarlık) → pasif / iptal
- 5–8px renkli daire → kategori (branş) işareti

Bu, ikon kütüphanesi bağımlılığını, lisans sorununu ve Windows'ta ikon fontu yükleme
riskini sıfırlar.

---

## 6. Komponent envanteri

Varyantlar tasarımda **fiilen gözlemlenenlerdir**.

> **Faz 3 durumu.** Token'lar `src/styles/tokens.css`'te, komponentler `src/ui/`,
> kabuk `src/shell/` altında. Aşağıdaki tablolarda ✅ yazılanlar yazıldı ve
> `/dev/komponentler` sayfasında bütün varyantlarıyla duruyor.
>
> **Takvim komponentleri (23–27) Faz 5'e, `NoteList`/`NoteComposer` (22) Faz 4'e
> bırakıldı** — ikisi de kendi ekranının veri modeline bağlı; boşlukta yazılırsa ekran
> gelince yeniden yazılır. Faz 3 ayrıca tasarımda olmayan üç komponent üretti:
> `DatePicker`, `TimePicker`, `Pagination` (faz komutunun listesinde vardı).

### Yerleşim

| # | Komponent | Varyantlar / notlar |
|---|---|---|
| 1 | `AppShell` ✅ | 216px sabit kenar çubuğu + esnek ana alan. `height:100vh; overflow:hidden`, `min-width:1280px` |
| 2 | `SidebarNav` ✅ | öğe: varsayılan / hover / aktif; sağda opsiyonel sayı rozeti |
| 3 | `PageHeader` ✅ | başlık + alt başlık; sağda arama ve birincil eylem |
| 4 | `Toolbar` ⏭ Faz 5 | takvim üst çubuğu — gezinme, etiket, filtre, görünüm, eylem |
| 5 | `StatusBar` ✅ | alt bilgi çubuğu: solda sayaç, sağda toplam |

### Girdi ve eylem

| # | Komponent | Varyantlar |
|---|---|---|
| 6 | `Button` ✅ | **primary** (koyu) · **secondary** (`#efedea` + kenar) · **ghost** (şeffaf + kenar) · **warning** (`#f2e0c4`) · **icon** (32×32) · boyut: normal / küçük (`5px 10px`) |
| 7 | `SearchInput` ✅ | sağda `Ctrl K` veya `↵ aç` ipucu; odakta kenar `#b3ada3` |
| 8 | `Select` ✅ | yerel `<select>`, `appearance:none` + `▾` |
| 9 | `SegmentedControl` ✅ | Hafta/Gün; aktif koyu, pasif beyaz |
| 10 | `StepperGroup` ✅ | `‹ Bugün ›` — tek kapsayıcıda üç düğme |
| 11 | `FilterChip` ✅ | aktif / pasif; sağda opsiyonel sayı |
| 12 | `Textarea` ✅ | kenarlıksız, kart içinde; altında eylem satırı |
| 13 | `Kbd` ✅ | `Ctrl K`, `Esc`, `←`, `→` |

### Veri gösterimi

| # | Komponent | Varyantlar |
|---|---|---|
| 14 | `DataTable` ✅ (`Table`) | CSS Grid tabanlı (`<table>` değil); yapışkan başlık, satır hover, tıklanabilir satır, yoğunluk ayarı, sağa hizalı sayı kolonları |
| 15 | `StatCard` ✅ | etiket (11px büyük harf) + 30px değer + alt yazı; opsiyonel sağ eylem düğmesi; **boş varyantı `—`** |
| 16 | `StatusDot` ✅ | dolu / halka × yeşil, amber, kırmızı, gri |
| 17 | `Badge` ✅ | borç (kırmızı) · tatil (gri) · takvim etiketi (amber/gri) |
| 18 | `Tabs` ✅ | alt çizgi `inset 0 -2px 0`; başlıkta sayı |
| 19 | `Avatar` ✅ | baş harfler; 44 / 46 / 52px |
| 20 | `SectionHeader` ✅ | başlık + sağda meta; altında `1px solid #dcd9d3` |
| 21 | `Legend` ⏭ Faz 5 | takvim renk açıklaması şeridi |
| 22 | `NoteList` + `NoteComposer` ⏭ Faz 4 | yazar + tarih + gövde |

### Takvim

| # | Komponent | Notlar |
|---|---|---|
| 23 | `CalendarGrid` ⏭ Faz 5 | 56px saat cetveli + esnek sütunlar (min 128px); 08:00–22:00 (`480–1320` dk); 30 dk = 30px (rahat) / 22px (sıkı); çift katmanlı ızgara çizgisi |
| 24 | `SessionBlock` ⏭ Faz 5 | **grup** (`#e8e3db`) · **birebir** (`#fff`) · **telafi/tek seferlik** (kesikli kenar) · **yoklama eksik** (amber + sol şerit) · **geçmiş** (`opacity:.5`) · **çakışma** (turuncu kontur + `!`) · **sürüklenen** (gölge) · **küçük** (150px, grup/öğrenci detayında) |
| 25 | `NowIndicator` ⏭ Faz 5 | 1.5px `#d59029` çizgi + sol nokta + "şimdi" etiketi |
| 26 | `ClosedDayOverlay` ⏭ Faz 5 | 45° taralı; "ders bırakılamaz" hapı |
| 27 | `DropTarget` ⏭ Faz 5 | kesikli amber çerçeve; 30 dk'ya kilitlenir |

### Geri bildirim

| # | Komponent | Notlar |
|---|---|---|
| 28 | `Modal` ✅ (+ `ConfirmDialog`) | 384px, ortalanmış; başlık + gövde + dikey seçenek düğmeleri + "Vazgeç" bağlantısı |
| 29 | `Drawer` ✅ | sağdan 396px; başlık / kaydırılan gövde / sabit eylem çubuğu |
| 30 | `EmptyState` ✅ | 46–52px ikon dairesi + başlık + açıklama + eylem(ler). **Üç bağlam:** ilk kullanım / filtre sonuçsuz / arama sonuçsuz |
| 31 | `OverlayEmptyState` ⏭ Faz 5 | takvim üstünde yarı saydam örtü içinde `EmptyState` |
| 32 | `Toast` ✅ | alt-orta, koyu, 2200 ms |

---

## 7. Etkileşim kuralları

| Kural | Kaynak |
|---|---|
| **Her liste 4 durum taşır:** dolu · ilk kullanım · filtre sonuçsuz · arama sonuçsuz. Üçü de **farklı metin** gösterir. | 4 ekranda da uygulanmış |
| **Sürükle-bırak 30 dk'ya kilitlenir**, 5px eşik altındaki hareket tıklama sayılır | `Takvim` `snap()` / `dist < 5` |
| **Tekrar eden ders taşınırken kapsam sorulur:** "Sadece bu ders" / "Bu ve sonraki dersler" | `Takvim` onay modalı |
| **Tatil sütununa bırakılamaz** — hedef göstergesi bile çıkmaz | `Takvim` `if (meta && !meta.holiday)` |
| **Çakışma engellenmez, işaretlenir** | `Takvim` `!` rozeti |
| **Geçmiş dersler soluk** (`opacity:.5`), yoklaması eksik olanlar **soluk değil** — dikkat çekmeye devam eder | `Takvim` `doneFaded` |
| Klavye: `←` `→` hafta/sekme · `Esc` kapat/geri · `Enter` ilk sonucu aç · `Ctrl K` arama | 3 ekran |
| Arama Türkçe küçültme + rakam normalizasyonu yapar | `Öğrenciler` `toLocaleLowerCase('tr-TR')` |
| Toast 2200 ms sonra kendiliğinden kapanır | `Takvim`, `Öğrenci detayı` |
| Liste satırının tamamı tıklanabilir; içindeki düğme `stopPropagation` yapar | `Öğrenciler` `onPay` |

---

## 8. Ölçüler (sabit)

| Öğe | px |
|---|---|
| Uygulama min genişliği | **1280** — responsive yok, masaüstü |
| Kenar çubuğu | 216 |
| Sağ çekmece | 396 |
| Modal | 384 |
| Boş durum kartı | max 370 |
| Takvim saat cetveli | 56 |
| Takvim sütunu | min 128 |
| Ana içerik max genişliği (Bugün) | 1320 |
| Bugün ekranı kolon oranı | `1.7fr` / `minmax(322px, 0.9fr)` |
| Özet şerit kolonları | `minmax(240px,1.5fr)` `minmax(190px,1fr)` `minmax(190px,1fr)` `minmax(200px,1.15fr)`, boşluk 14px |

> **Özet şerit kolon kuralı bağlayıcıdır.** Tasarım dosyasındaki HTML yorumu bunu açıkça
> söylüyor: aynı oranlar **Grup detayı** ekranında da aynen kullanılacak.

### Kaydırma çubuğu

```css
::-webkit-scrollbar { width: 11px; height: 11px }
::-webkit-scrollbar-thumb {
  background: #dcd9d3; border-radius: 6px; border: 3px solid #fbfaf8;
}
```

> Windows'ta varsayılan kaydırma çubuğu bu stilden daha kalın ve farklı görünür. WebView2
> `-webkit-scrollbar` kurallarını destekliyor; Faz 3'te doğrulanacak.
