---
description: Faz 6 — Yoklama, devamsızlık ve telafi dersi
---

# Faz 6 — Yoklama & Telafi

> **Sıra değişti (2026-07-26).** Bu faz artık **para fazından sonra** geliyor
> (`/faz-07` → `/faz-06` → `/faz-10`). Sebebi `YOL-HARITASI.md`'de: tahsilat hiç yoktu ve
> yoklamanın paraya değdiği tek yer paket tüketimiydi, o da ayrıldı. **Takvim
> dondurulduğu için** (ADR-034) bu fazın açılışında takvim işi yok — 5C'den devreden
> "sürükleme jestini ekranda sür" maddesi **kapsam dışı.**

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/DENETIM-PARA.md`
(§0'ın kaynağı), `docs/KULLANILABILIRLIK.md`, `docs/KARARLAR.md` (**ADR-015**, **ADR-016**,
**ADR-022**, **ADR-036**, **ADR-040**, **ADR-044**).

> **Bu faz da Codex'te — ADR-042'nin devamı.** Prompt `docs/CODEX-DEVIR.md`'de; sınırlar
> aynı: migration yok, `docs/**` ve ADR yok, takvim yok, tek defter yolu, bölümlü commit.
> Claude Code'un işi Codex tıkandığında cevaplamak ve dönüşte denetlemek.

---

## 0. Para fazı denetiminin bıraktıkları — **ilk iş bu**

`docs/DENETIM-PARA.md`. Üç madde bu faza düştü; **P1 kodun geri kalanından önce yapılır**,
çünkü bu fazın kendisi onu tetikleyecek olan koddur.

### 0a. `charge_session` paketli öğrenciyi tanımıyor — **P1, ADR-044**

Bugün paketli bir öğrencinin dersi işlenirse hem `package_usage(delta = −1)` **hem**
`ledger_entry(session_charge)` yazılır; paketin taksitleri ayrıca tahakkuk ettiği için
**aynı ders iki kez faturalanır.** ADR-015'in ihlali. Zincir:
`resolve_unit_price` sadece `pricing_model='per_session'` kayıtlarına bakıyor → paketlide
bulamıyor → `session.unit_price` snapshot'ına düşüyor → o snapshot'ı yazan
`schedule::solo_unit_price` `pricing_model`'e **bakmıyor.**

Bu faz `charge_session`'ı **çağıran** faz. Çağrıyı yazmadan önce:

- `charge_session` öğrencinin o ders için **aktif paketi var mı** diye kendisi sorar,
  varsa `Ok(None)` döner. **Ayrım çağırana bırakılmaz** (ADR-044'ün gerekçesi).
- `schedule::solo_unit_price`'a `pricing_model = 'per_session'` filtresi eklenir —
  savunma iki katmanda.
- Testi: *paketli öğrencinin işlenen dersi deftere satır yazmaz, yalnızca hak düşer* ve
  *paketsizde tam tersi*. `cancel_session_financials` zaten simetrik ve savunmalı,
  **ona dokunma.**

### 0b. Depoya sızan üretilmiş dosya — **P3**

`output/pdf/ornek-makbuz.pdf` commit edilmiş. Depodan çıkar (`git rm --cached`),
`.gitignore`'a `output/` ekle.

### 0c. Kullanılabilirlik

`docs/KULLANILABILIRLIK.md`'nin en üstündeki açık maddelerle devam et. Ürün sahibi oraya
madde eklediyse onlar yapılır; liste boşsa bu bölüm atlanır.

---

## 1. Yoklama ekranı

Seans detayında:
- Grup dersinde o tarihte gruba kayıtlı tüm öğrenciler listelenir
  (katılım/ayrılma tarihine göre filtrelenmiş)
- Durumlar (PRD R2.1 · `VERI-MODELI.md §1.16`) — **şema değerleri parantez içinde, birebir**:
  **Geldi** (`present`) · **Mazeretli** (`excused`) · **Mazeretsiz** (`unexcused`) ·
  **İptal** (`cancelled`). Yoklama girilmemiş satır `pending`'dir, buton olarak gösterilmez.
- **"Hepsi geldi" toplu işareti** — en sık kullanılacak buton, en görünür yerde
- Öğrenci başına kısa not alanı
- Kaydetmeden önce **etki özeti** (R2.3): *"5 ders hakkı düşecek, 1.250 TL borç yazılacak."*

> ⚠️ Bu bölüm eskiden **"Geldi / Gelmedi / Mazeretli / Geç geldi"** diyordu. **"Geç geldi"
> şemada yok** — `attendance.status` CHECK'ine takılır ve Faz 6'nın ortasında migration
> gerektirirdi. **"Gelmedi"** de kullanılmaz: ADR-016 mazeretli/mazeretsiz ayrımını doğrudan
> para etkisine bağlıyor (mazeretlide hak düşmez, borç yazılmaz), ara terim bu ayrımı siler.

Bu ekran hızlı olmalı: kurs sahibi ders bitiminde 10 saniyede kapatabilmeli.

## 2. Seans durumu ve paket tüketiminin bağlanması

`planlandı → yapıldı / iptal`. Yoklama girilince otomatik "yapıldı".

**Paket mantığı burada kurulmaz — kurulmuş hâlde geliyor.** Para fazı (`/faz-07 §4`)
`consume_package_credit` fonksiyonunu ve düzeltmenin tersini yazan eşini yazdı ve testledi.
Bu fazın işi onları **çağırmak**: yoklama kaydedilirken tüketim, yoklama düzeltilirken
zincirin bir sonraki halkası. Yeni bir tüketim yolu yazma; ikinci bir yol iki sayaç
üretir.

## 3. Telafi dersi

- **Mazeretli** (`excused`) işaretlenen öğrenci için telafi seansı oluştur — telafi kısayolu
  ADR-016 gereği yalnızca bu durumda çıkar (mazeretsizde hak zaten düştü, borç yazıldı)
- İki kayıt birbirine bağlansın (`attendance` → telafi `session`, `makeup_for_attendance_id`)
- Telafi seansı işlendiğinde **ikinci kez borç yazılmaz, ikinci kez hak düşmez**
  (`is_makeup = 1` → tahakkuk atlar)
- Öğrenci detayında **"bekleyen telafi"** rozeti
- Telafi listesi: kime kaç telafi borçlu

## 3b. Yoklama düzeltme — karar verildi, uygula

`VERI-MODELI.md §4` "Yoklama düzeltilirse ne yazılır" bölümünü oku, orada tanımlı zinciri uygula:
düzeltme **ikinci bir `session_charge` yazmaz**, ters kaydın tersini yazar
(`ux_ledger_attendance` ikinciyi zaten reddeder).

> **Bu bölümün açık kararı kapandı — `ADR-036`.** `package_usage` da ADR-022'nin ters kayıt
> zinciri modeline geçti: eski `ux_pkgusage_att` `(attendance_id, delta)` indeksi kalktı,
> yerine `reverses_id` zinciri + iki kısmi UNIQUE indeks + üç tetikleyici geldi.
> Migration (`003_package_usage_reversal_chain.sql`) ve kanıt testleri **para fazında
> yazıldı** (`/faz-07 §4`) — bu fazda **şemaya dokunulmaz.**
>
> Bu fazın işi: düzeltme akışının her adımında zincirin **bir sonraki halkasını** yazmak.
> `Geldi → Mazeretli → Geldi` dizisi artık şema seviyesinde mümkün; senin işin ekranın da
> aynı diziyi doğru üretmesi ve kullanıcıya ne olduğunu söylemesi (R2.3'ün etki özeti
> düzeltmede de çıkar: *"1 ders hakkı geri verilecek, 250 TL borç silinecek."*).
>
> Defter tarafı için ADR-022'nin değişmezi, ders hakkı tarafı için ADR-036'nın değişmezi
> **bu fazın testlerinde de kontrol edilir** — ekran yolundan geçen bir düzeltme
> zincirinden sonra ikisi de tutmalı.

## 4. Öğrenci detayı > Dersler sekmesi

Faz 4'teki placeholder'ı doldur:
- Geçmiş dersler, tarih ve durumla
- Devam yüzdesi
- Son 3 ayın devamsızlık dağılımı
- Bekleyen telafiler

## 5. Devamsızlık raporu

Seçilen tarih aralığında en çok devamsızlık yapanlar. Grup ve branş filtresi.

## 6. Testler

- Devam yüzdesi hesabı
- Gruba sonradan katılan öğrencinin katılım öncesi seanslarda yoklamada görünmemesi
- Gruptan ayrılan öğrencinin ayrılma sonrası seanslarda görünmemesi
- Telafi bağlantısının çift sayılmaması

---

Bitince ekran görüntüleri göster, sonra `/kapat`.
