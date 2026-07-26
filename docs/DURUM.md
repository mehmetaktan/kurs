# Durum

**Son güncelleme:** 2026-07-26 · ikinci yönetici oturumu — ADR-011 düştü, §0 büyüdü
**Sıradaki iş:** `/faz-07` — **§0 önce** (öğretmenler + işletme ayarları), sonra para
**Kalan plan:** üç faz — `/faz-07` → `/faz-06` (yoklama) → `/faz-10` (teslim)

> Bu dosya **son durumu** tutar, oturum arşivi değildir. Geçmiş `git log`'da, gerekçeler
> `docs/KARARLAR.md`'de. Faz 5 ve öncesinin ayrıntısı 2026-07-26'da buradan çıkarıldı —
> `519f1f7` ve öncesindeki sürümlerde duruyor.

---

## Bu oturumda ne değişti (yönetici, kod yazılmadı)

Ürün sahibi sordu: *"öğretmen tanımlamaları yok — projeyi yönetirken yanlış mı yapıyorsun?"*
Sorulunca ortaya çıktı ki **kursta birden fazla öğretmen var** ve bu hiç sorulmamıştı.

| Karar | Nerede |
|---|---|
| **ADR-011 düştü — MVP çok öğretmenli.** `Tanımlar → Öğretmenler` sekmesi, `Tanımlar → Genel` (işletme ayarları) ve gerçek çakışma uyarısı `/faz-07 §0`'a girdi. **Şema değişmiyor, migration yok** | **ADR-037** |
| **Takvime dar istisna** — öğretmen filtre ekseni + meta satırında ad. Gün görünümü tek sütun kalır; dondurma bunun dışında geçerli | **ADR-038** |
| **Plan ekran envanterinden çıkmaz.** `EKRANLAR.md` referans oldu, plan kaynağı olmaktan çıktı; `/kapat`'a iki kontrol eklendi | **ADR-039** |
| Öğretmen **hakedişi kapsam dışı kaldı** — sahibi çok öğretmen dedi, hakediş istemedi | `PRD.md §1` |

**Ölçülen hata, kayda geçsin.** İki hasar somut:

1. **`teacher` tablosunun tek satırı `'Öğretmen'` ve üç faz boyunca onu değiştirecek ekran
   yoktu.** Gruplar listesinin `Öğretmen` kolonunda `Öğretmen` yazıyor.
2. **`DENETIM-FAZ1 > C5` sessizce öldü.** *"`teacher_id`'yi yazan ekran yok → çakışma
   uyarısı ölü doğuyor"* bulgusu Faz 5'e atanmıştı; 5A, 5B, 5C geçti, madde kapanmadı ve
   bu dosyanın borç tablosuna **hiç girmedi** — takip bir denetim arşivinde duruyordu.

Mekanizma ADR-039'da: plan `EKRANLAR.md`'den türetildiği için tanımlar/ayarlar "bir satır"
sayılıp sona atıldı, takvim öne geçti. Bir önceki oturumun ölçtüğü israfla (6 kod yazmayan
oturum) aynı aileden.

**`DENETIM-FAZ1 > C` bölümü tarandı:** C1, C3, C4, C6, C7, C8 kod üzerinde kapanmış çıktı;
C2 ve C9 faz komutlarında yazılı; açık olan tek madde C5'ti. **A ve B taranmadı** — borçta.

---

## Nerede duruyoruz

`npm run check` yeşil: **481 test** (293 TypeScript + 188 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi. CI dört işin dördünde yeşil, Windows `.msi` 2.6 MB.

| Çalışıyor | Nerede |
|---|---|
| Öğrenci & veli — liste, detay, form, arama, arşiv | `pages/ogrenciler/` · `repo/roster.rs` |
| Branş, tatil günleri, gruplar | `pages/tanimlar/` · `pages/gruplar/` · `repo/academic.rs` |
| Seans üretim motoru — ufka kadar, idempotent, açılışta çalışıyor | `repo/schedule.rs` · `repo/ops.rs` |
| Bugün ekranı, ders ekle/düzenle, ertele/iptal/sil, şablondan oluştur | `pages/bugun/` · `pages/dersler/` |
| Takvim — ay/hafta/gün, sürükle-bırak (**donduruldu**, ADR-034) | `pages/takvim/` |
| Şema — 2 migration, checksum mühürlü; defter tarafı ADR-022 ile kapalı | `src-tauri/migrations/` |

**Yok olan iki şey:**

1. **Para.** Tarife, paket, taksit, tahsilat, borçlu listesi, ekstre, makbuz — hiçbiri
   yazılmadı. Uygulamanın adındaki "tahsilat" henüz yok.
2. **Kurs sahibinin kendi programını tanımlaması.** Öğretmen ekleyemiyor, adını
   değiştiremiyor; çalışma saatleri, ders süresi ve **devamsızlık politikası** sabit.
   `repo/setting.rs`'te `set`/`update_existing` yazılı ama **yazan komut ve ekran yok**.

---

## Sıradaki oturum — `/faz-07`

Sırası şu: **§0** — öğretmenler (0a) → çakışma uyarısı (0b) → işletme ayarları (0c) →
takvim filtre ekseni (0d) → aranabilir seçim (0e) → *(dikiş §1)* → **ADR-036 migration'ı ve
kanıt testleri** → tarife → paket/taksit → tahakkuk → tüketim fonksiyonu → *(dikiş §5)* →
tahsilat → borçlu → ekstre → makbuz.

Sığmazsa iki dikişten birinde bölünür, **aynı komutla** devam edilir; arada denetim veya
karar oturumu yok. Denetim yalnızca bu faz bittikten sonra.

### Sahiplik kontrolü (ADR-039)

*Bu faz bitince kurs sahibi hangi işi baştan sona yapabiliyor?* Öğrencisini ve grubunu
tanımlar, **öğretmenlerini ve çalışma düzenini girer**, dersini planlar, **parasını takip
eder**: tarife, paket, taksit, tahsilat, borçlu listesi, ekstre, makbuz.

*Yapamadığı ne kalıyor?* Yoklama alamıyor (Faz 6 — paket tüketimi ekranı orada bağlanıyor),
yedek alamıyor ve özet ekranı yok (Faz 10). **İkisi de plandaki bir faza ait; plan eksik
değil.**

### Bu fazın en büyük riski

**§0 büyüdü ve para işini bastırabilir.** Beş alt maddesi var; hiçbiri zor değil ama
toplamı bir oturum eder. Kural: **§0 para mantığından çalmaz.** §1'e geçmeden oturum
şişerse `/kapat` çalıştır, aynı komutla devam et — §0'ı kısaltarak para işine yer açma,
tersi de yok.

**İkinci risk: kapsam ile para doğruluğu arasındaki gerilim.** `/faz-07` iki fazın birleşimi ve
projenin en pahalı yanlış olan yeri: defter, tahakkuk, mahsup. Risk "yetişmez" değil,
**yetiştirmeye çalışıp testi kısmak.** Üç sabit kural bunu tutuyor:

1. ADR-036'nın yedi düzeltme dizisi **yeşil olmadan** tüketim fonksiyonu yazılmaz.
2. Para ile ilgili her fonksiyonun testi olur — dikişten bölünmek serbest, testi
   ertelemek değil (`CLAUDE.md > Para`).
3. Tıkanınca uydurma yok: buraya yaz ve **tek soruyla** sor (ADR-033).

Üçüncü risk: iki yönetici oturumudur **kontroller çalıştırılmadı** (kod yazılmadı; `src/`
ve `src-tauri/` hiç değişmedi). Son yeşil ölçüm `519f1f7`'de: 481 test. `/faz-07` işe
`npm run check` ile başlamalı, varsayımla değil.

---

## Ürün sahibinden beklenen iki şey

1. **Windows testi.** `.msi` gönderildi; 5 maddelik liste Segoe UI metriklerini, DPI'ı,
   kaydırma çubuğunu ve ICU verisini yokluyor. **Tek gerçek Windows kanıtı bu** — CI
   ızgarayı çalıştırmıyor, jsdom ve paket derlemesi boşluğu kapatmıyor.
2. **Kullanılabilirlik maddeleri.** `docs/KULLANILABILIRLIK.md`'ye yazılan her satır bir
   sonraki kod oturumunun §0'ı olur.

---

## Açık sorular

`docs/PRD.md` §9'da gerekçeleriyle. **S1, S2, S3, S4, S5, S6, S8 cevaplandı.**
**Sıradaki fazı bekleten açık soru yok.**

| # | Soru | Hangi faz |
|---|---|---|
| S7 | "Devam oranı" hangi pencerede? | Kapandı: Faz 4'ün varsayımı (tüm işlenen dersler) kalıcı; Faz 10 özeti de aynı pencereyi kullanır |
| S9 | Bilgisayarındaki Windows sürümü ne? | Faz 10 öncesi |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 — alınmazsa SmartScreen yönergesi `docs/KURULUM.md`'ye girer |

---

## Bilinçli ertelenenler — hâlâ borç

> **ADR-039:** kapanmamış denetim bulgusu bu tabloya girer. Denetim dosyaları arşivdir;
> `DENETIM-FAZ1 > C5` tam olarak buraya yazılmadığı için üç faz kayboldu.

| Ne | Nereye bağlı |
|---|---|
| `student_note.teacher_id` hep `NULL` yazılıyor — notun yazarı ayırt edilmiyor, hepsi "Ofis" (`repo/roster.rs:717`). Çok öğretmenlilikle anlam kazandı ama ADR-037'nin kapsamında değil | Faz 6 (notlar sekmesiyle) |
| `DENETIM-FAZ1` **A ve B bölümleri kapanış açısından taranmadı** (C bölümü 2026-07-26'da tarandı ve kapandı). Düzeltmelerin çoğu Faz 2'de uygulanmış görünüyor ama doğrulanmadı | Para fazı denetimi (yalnızca doğrulama, kod değil) |
| Öğrenci detayında `Kayıtlar` sekmesi yok | Faz 6 (`Dersler` sekmesiyle birlikte) |
| Birebir şablonun düzenleme ekranı yok; tek yönetim yolu "Tüm seri" ile kaldırmak | Faz 6, öğrenci detayı (ADR-028'de not) |
| Bugün ekranının yan panelinde borç bölümü "yakında" diyor | `/faz-07 §9` |
| Öğrenciler listesinin son kolonu `Aç` — tasarımda `Tahsilat al` | `/faz-07 §9` |
| `search_students` komutu atıl (`student_list` aramayı da yapıyor) | Para fazında kullanılmazsa kaldırılır |
| `npm audit` 12 "high" — hepsi eslint/vite geliştirme zinciri, pakete girmiyor | Faz 10 |
| Gün değişince ekran kendiliğinden tazelenmiyor | ADR-029'da kabul edilen sınır — kapanmadı, kapatılmayacak |
| `checkout@v4` / `setup-node@v4` Node 20 hedefliyor, GitHub Node 24'e zorluyor | Faz 10'da eylem sürümleri yükseltilir |

**Takvimden devreden maddeler borç değil, kapsam dışı** (ADR-034): sürükleme jestinin
ekranda doğrulanması, kenarda kaydırma, şeritlerin genişlemesi. Filtre ekseni istisna (ADR-038).
