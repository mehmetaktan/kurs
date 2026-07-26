# Durum

**Son güncelleme:** 2026-07-26 · yönetici oturumu — plan kısaltıldı
**Sıradaki iş:** `/faz-07` — **para** (fiyat tarifesi, paket, tahsilat, ekstre, makbuz)
**Kalan plan:** üç faz — `/faz-07` → `/faz-06` (yoklama) → `/faz-10` (teslim)

> Bu dosya **son durumu** tutar, oturum arşivi değildir. Geçmiş `git log`'da, gerekçeler
> `docs/KARARLAR.md`'de. Faz 5 ve öncesinin ayrıntısı 2026-07-26'da buradan çıkarıldı —
> `519f1f7` ve öncesindeki sürümlerde duruyor.

---

## Bu oturumda ne değişti (yönetici, kod yazılmadı)

Ürün sahibi planın gidişine ve harcanan oturumlara itiraz etti; itiraz **haklı bulundu ve
plan değiştirildi.** Kararların hepsi sahibinin.

| Karar | Nerede |
|---|---|
| **Takvim donduruldu** — kod yerinde, üstüne iş yazılmaz; sahibi kendi kütüphanesini getirirse yalnızca ekran katmanı değişir | **ADR-034** |
| **Ölçüm/karar oturumu açılmaz** — karar sahibine tek soruyla gelir, cevap yoksa en ucuz varsayım. Denetim yalnızca para fazından sonra | **ADR-033** |
| **Faz 7 + 8 birleşti** (`/faz-08` → işaretçi), **Faz 9 kırpıldı** (`/faz-10 §0`'a indi), sıra değişti: para yoklamanın önüne geçti | `YOL-HARITASI.md` |
| **Ders hakkı sayacı ters kayıt zincirine geçiyor** — Faz 6'nın en riskli açık kararı kapandı; migration para fazında | **ADR-036** |
| **Paket kapatmada iki yol** — avans bırak / iade et, kullanıcı seçer (S6 cevabı) | **ADR-035** |
| Kullanılabilirlik artık bir dosyanın işi; her kod oturumu §0'da onunla başlıyor | `docs/KULLANILABILIRLIK.md` |

**Üç açık soru cevaplandı:** S3 paket süresiz · S5 makbuz numarası otomatik+düzeltilebilir ·
S6 avans/iade seçimli (PRD §9'da işaretlendi).

**Ölçülen israf, kayda geçsin:** yol haritasındaki adımların 6'sı kod yazmayan oturumdu
(5 denetim + plan) ve `/faz-05c-karar` sorulmamış bir soru yüzünden vardı. ADR-033 bunu
tekrarlanamaz hâle getiriyor.

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

**Yok olan:** para. Fiyat tarifesi, paket, taksit, tahsilat, borçlu listesi, ekstre, makbuz —
hiçbiri yazılmadı. Uygulamanın adındaki "tahsilat" henüz yok; sıradaki faz bu.

---

## Sıradaki oturum — `/faz-07`

Sırası şu: **§0 aranabilir seçim listesi** (uzun öğrenci listesinden seçim para ekranlarının
zorunlu girdisi) → **ADR-036 migration'ı ve kanıt testleri** → tarife → paket/taksit →
tahakkuk → tüketim fonksiyonu → *(dikiş)* → tahsilat → borçlu → ekstre → makbuz.

Sığmazsa dikişten bölünür, **aynı komutla** devam edilir; arada denetim veya karar oturumu
yok. Denetim yalnızca bu faz bittikten sonra.

### Bu fazın en büyük riski

**Kapsam ile para doğruluğu arasındaki gerilim.** `/faz-07` iki fazın birleşimi ve
projenin en pahalı yanlış olan yeri: defter, tahakkuk, mahsup. Risk "yetişmez" değil,
**yetiştirmeye çalışıp testi kısmak.** Üç sabit kural bunu tutuyor:

1. ADR-036'nın yedi düzeltme dizisi **yeşil olmadan** tüketim fonksiyonu yazılmaz.
2. Para ile ilgili her fonksiyonun testi olur — dikişten bölünmek serbest, testi
   ertelemek değil (`CLAUDE.md > Para`).
3. Tıkanınca uydurma yok: buraya yaz ve **tek soruyla** sor (ADR-033).

İkincil risk: bu oturumda kod yazılmadığı için **kontroller çalıştırılmadı.** Son yeşil
ölçüm `519f1f7`'de: 481 test. `src/` ve `src-tauri/` bu oturumda hiç değişmedi, dolayısıyla
sonuç geçerli sayılıyor — ama `/faz-07` işe `npm run check` ile başlamalı, varsayımla değil.

---

## Ürün sahibinden beklenen iki şey

1. **Windows testi.** `.msi` gönderildi; 5 maddelik liste Segoe UI metriklerini, DPI
   ölçeklemeyi, kaydırma çubuğunu ve ICU verisini yokluyor. Cevap gelince bulgular buraya
   ve ilgili faz komutuna girer. **Bu hâlâ tek gerçek Windows kanıtı** — CI ızgarayı
   çalıştırmıyor, jsdom testleri ve paket derlemesi bu boşluğu kapatmıyor.
2. **Kullanılabilirlik maddeleri.** `docs/KULLANILABILIRLIK.md` içinde boş bir liste
   bekliyor; oraya yazılan her satır bir sonraki kod oturumunun §0'ı olur.

---

## Açık sorular

`docs/PRD.md` §9'da gerekçeleriyle. **S1, S2, S3, S4, S5, S6, S8 cevaplandı.**
**Sıradaki fazı bekleten açık soru yok.**

| # | Soru | Hangi faz |
|---|---|---|
| S7 | "Devam oranı" hangi pencerede hesaplansın? | ~~Faz 9~~ → kapsam kırpıldı; Faz 4'ün varsayımı (tüm işlenen dersler, kartta yazılı) **kalıcı** kabul edildi. Faz 10'un özet şeridinde de aynı pencere kullanılır |
| S9 | Bilgisayarındaki Windows sürümü ne? | Faz 10 öncesi |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 — alınmazsa SmartScreen yönergesi `docs/KURULUM.md`'ye girer |

---

## Bilinçli ertelenenler — hâlâ borç

| Ne | Nereye bağlı |
|---|---|
| Öğrenci detayında `Kayıtlar` sekmesi yok | Faz 6 (`Dersler` sekmesiyle birlikte) |
| Birebir şablonun düzenleme ekranı yok; tek yönetim yolu "Tüm seri" ile kaldırmak | Faz 6, öğrenci detayı (ADR-028'de not) |
| Bugün ekranının yan panelinde borç bölümü "yakında" diyor | `/faz-07 §9` |
| Öğrenciler listesinin son kolonu `Aç` — tasarımda `Tahsilat al` | `/faz-07 §9` |
| `search_students` komutu atıl (`student_list` aramayı da yapıyor) | Para fazında kullanılmazsa kaldırılır |
| `npm audit` 12 "high" — hepsi eslint/vite geliştirme zinciri, pakete girmiyor | Faz 10 |
| Gün değişince ekran kendiliğinden tazelenmiyor | ADR-029'da kabul edilen sınır — kapanmadı, kapatılmayacak |
| `checkout@v4` / `setup-node@v4` Node 20 hedefliyor, GitHub Node 24'e zorluyor | Faz 10'da eylem sürümleri yükseltilir |

**Takvimden devreden maddeler artık borç değil, kapsam dışı** (ADR-034): sürükleme
jestinin ekranda doğrulanması, kenarda kendiliğinden kaydırma, şeritlerin boşluğa
genişlemesi.
