---
description: Faz 5C — Takvim ekranı ve ilk Windows testi
---

# Faz 5C — Takvim

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md` (**§2 Takvim**),
`docs/TASARIM-SISTEMI.md`, `docs/KARARLAR.md` (**ADR-001**, **ADR-011**, **ADR-017**,
**ADR-020**, **ADR-024**, **ADR-030**, **ADR-031**).

**Faz 5'in son parçası.** Kütüphane kararı bu oturumda **verilmez** — `/faz-05c-karar`
oturumunda verildi ve `ADR-031`'de yazılı. Bu oturum kararı **uygular**; yeniden
tartışmaz. ADR-031 "elde" diyorsa `src/dev/` altındaki deneme ızgarası başlangıç
noktasıdır.

---

## 0. Riskin doğru çerçevesi

Bu bölüm **ADR-030**'un özeti; gerekçesi orada. "WebView2 farkları" diye tek bir risk
yok, karıştırılırsa yanlış yere önlem alınır:

| | |
|---|---|
| macOS (geliştirme) | **WKWebView** — WebKit |
| Windows (teslim) | **WebView2** — Chromium |

Geliştirme **daha katı** motorda yapılıyor. WKWebView'da çalışan bir yerleşim
Chromium'da büyük ihtimalle çalışır; tersi doğru değil. Yani CSS/JS semantiği
bu projede beklenenden **daha az** risk.

Gerçek Windows bilinmeyenleri motor semantiği değil, şunlar:

1. **Segoe UI metrikleri** — SF Pro'dan farklı genişlik. Kolon genişlikleri ve blok
   içindeki metnin kırpılması buna bağlı. Sabit `px` kolon genişliği kurma.
2. **DPI ölçekleme** — §1'deki dikey sığma sorunu buradan geliyor.
3. **Kaydırma çubuğu genişliği** — Windows'ta klasik çubuk ızgaradan yer çalar;
   ızgaranın toplam genişlik hesabı buna dayanıklı olmalı.
4. **ICU verisi** — `toLocale*` çağrısı yapma. Gün/ay adları `tr.calendar`'dan gelir
   (`toLocaleDateString('tr')` yasak, `tr.ts`'te gerekçesi yazılı).

## 1. Takvim ekranı

- **Haftalık ızgara** (ana görünüm)
- **Aylık genel bakış**
- **Günlük liste** — ADR-011: tek sütun, öğretmen başına sütun **yok**
- Branş rengine göre ayrım (`subject.color`, 5 renkli kategori paleti), grup/birebir ayrımı
- **Öğretmen filtresi kurulmaz** (ADR-011: tek öğretmen)

Dört ayrı boş durum (`EKRANLAR §149`): ilk kullanım · hafta tamamen tatil · filtre
sonuçsuz · gün boş. Tek bir "kayıt yok" hepsini anlatmaz.

### Izgara dikey olarak sığmıyor — bu bir tasarım kısıtı, sonradan fark edilmesin

`EKRANLAR §122`: 08:00–22:00 = 28 yarım saat. Rahat yoğunlukta **28 × 30px = 840px**
sadece ızgara (sıkı yoğunlukta 616px). Buna gün başlığı satırı, sayfa başlığı ve
uygulama kabuğu eklenecek.

`src-tauri/tauri.conf.json` pencereye `minHeight: 700` izni veriyor. Windows tarafında
tipik bir 1080p dizüstü, Windows'un o panel için **önerdiği** ölçeklemede (%125–%150)
864–720 CSS px yükseklik verir; görev çubuğu ve pencere çerçevesi düşünce ızgaraya
kalan yer 840px'in belirgin biçimde altındadır. Geliştirme makinesinde bu hiç görünmez.

Bunun sonucu:

- Izgara **dikey kaydırır**; sayfa değil ızgaranın kendisi (gün başlıkları yapışkan kalır).
- Ekran açıldığında **"şimdi" çizgisi görünür alana kaydırılır.** Kullanıcı sabah
  uygulamayı açtığında 08:00'i değil, içinde bulunduğu saati görmeli.
- Yoğunluk anahtarı (`--calendar-slot-height`) çalışmaya devam eder; ızgara sabit piksel
  varsaymaz.

## 2. Sürükle-bırak

- **Pointer Events ile kurulur** (`pointerdown` / `pointermove` / `setPointerCapture`) —
  **ADR-030**, kilitli. HTML5 sürükle-bırak (`draggable` + `dragstart`/`drop`)
  **kullanılmaz**: `dragstart`'ın eşiğini tarayıcı belirlediği için R3.7'nin 5px kuralı
  o API üzerinde kırılgan değil, **kurulamaz**.
- 30 dk'ya kilitli, 5px altındaki hareket **tıklama** sayılır (R3.7)
- Tatil/kapalı güne **bırakılamaz**; hedef göstergesi bile çıkmaz (K-2)
- Taşıma sonrası kapsam sorulur: **"Sadece bu ders"** / **"Bu ve sonraki dersler"** (R3.8)
- Taşıma bildirimi **geri alınabilir** (R3.12)
- Yoklaması alınmış geçmiş ders **taşınamaz** (R3.13) — Rust zaten reddediyor

## 3. 5A/5B'den devralınan yüzey

`session_conflicts` · `reschedule_session` · `delete_sessions` · `cancel_session` ·
`group_list` hazır. **Tarih aralığına göre birleşik ders satırı da hazır:** Faz 5B
`repo/schedule.rs`'e `session_rows_between(from, to)` yazdı ve üye sayısını satırın
**kendi gününe** göre hesaplıyor — haftalık ızgara için ikinci bir sorgu yazma.

Eksik olabilecek tek şey branş **rengi**; satırda yoksa `repo/schedule.rs`'e eklenir,
yeni bir dosya açılmaz.

`/faz-05c-karar`'da açılmış bir kalıntı varsa (ör. `Display.tsx`'teki `toLocaleUpperCase`
kararı) burada kapanır.

## 4. Testler

- Şerit (lane) algoritması: çakışan iki ders yan yana bölünür, üç ders üçe
- 30 dk kilidi ve 5px eşiği
- Kapalı gün sütununun hedef kabul etmemesi
- "Şimdi" çizgisinin konumu (saat **parametre**, `Date.now()` değil — ADR-029)
- **Açılışta "şimdi"ye kaydırma**: verilen saat için hesaplanan kaydırma konumu — saf
  fonksiyon, jsdom'da test edilebilir kalsın
- **Yoğunluk**: slot yüksekliği değişince blok konumlarının takip etmesi

## 5. Doğrulanmayanların kapanması

Faz 5B üç akışı ekranda süremedi çünkü tetikleyicileri takvimdi. Bu fazda sürülür:

| Ne | Neden şimdi |
|---|---|
| **E6 şablondan oluştur** | Tetikleyicisi boş takvim — artık takvim var |
| **Haftalık tekrarla ders ekleme** | 5B'de bugün kapalı gündü ve K-2 doğru şekilde engelledi; açık bir günle denenir |
| **Ertele diyaloğu** | Sürükle-bırak zaten aynı yolu kullanıyor |

---

## Faz sonu — PUSH, CI ve İLK WINDOWS TESTİ

`c5773e2` (Faz 5B) ve `/faz-05c-karar`'ın commit'i **hâlâ yerelde**; push bu fazın
sonuna bırakıldı. Sıra:

1. `npm run check` yeşil → commit
2. **Push et** ve CI'ı bekle. Üç fazın kodu (5B + 5C-K + 5C) ilk kez Windows'ta
   derlenecek; bir şey kırılırsa hangi fazdan geldiğini aramak gerekebilir.
3. `Test · windows-latest` yeşil mi ve artefakt kutusunda **sıfır olmayan boyutta**
   bir `.msi` var mı — kanıt bu.

Sonra bana:
- Kurs sahibine `.msi`'yi nasıl göndereceğimi
- Test etmesini isteyeceğim 5 maddelik listeyi — **en az ikisi §0'daki Windows
  bilinmeyenlerini yoklasın**: takvimin bir günü ekrana sığıyor mu, para tutarı
  `1.234,56` biçiminde mi görünüyor
- SmartScreen uyarısı çıkarsa ne yapması gerektiğini

anlat. Bu testi Faz 10'a bırakmıyoruz.

> **Windows makine yok**, doğrulama CI'da yapılıyor. `.msi` indirilip kurulmuyor;
> kanıt `Test · windows-latest` işinin yeşil olması ve artefakt kutusunda sıfır olmayan
> boyutta bir `.msi` listelenmesi. Ekranın Windows'ta **nasıl göründüğü** CI'dan
> öğrenilemez — o yüzden kurs sahibine gönderiliyor.

Bitince `/kapat`.
