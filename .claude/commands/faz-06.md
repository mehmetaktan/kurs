---
description: Faz 6 — Yoklama, devamsızlık ve telafi dersi
---

# Faz 6 — Yoklama & Telafi

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`.

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

## 2. Seans durumu

`planlandı → yapıldı / iptal`. Yoklama girilince otomatik "yapıldı".
Yapıldı olan seans Faz 7'de paketten düşecek — o bağlantı noktasını hazırla ama
paket mantığını burada kurma.

## 3. Telafi dersi

- **Mazeretli** (`excused`) işaretlenen öğrenci için telafi seansı oluştur — telafi kısayolu
  ADR-016 gereği yalnızca bu durumda çıkar (mazeretsizde hak zaten düştü, borç yazıldı)
- İki kayıt birbirine bağlansın (`attendance` → telafi `session`, `makeup_for_attendance_id`)
- Telafi seansı işlendiğinde **ikinci kez borç yazılmaz, ikinci kez hak düşmez**
  (`is_makeup = 1` → tahakkuk atlar)
- Öğrenci detayında **"bekleyen telafi"** rozeti
- Telafi listesi: kime kaç telafi borçlu

## 3b. Yoklama düzeltme — denetimden gelen açık nokta

`VERI-MODELI.md §4` "Yoklama düzeltilirse ne yazılır" bölümünü oku, orada tanımlı zinciri uygula:
düzeltme **ikinci bir `session_charge` yazmaz**, ters kaydın tersini yazar
(`ux_ledger_attendance` ikinciyi zaten reddeder).

> **Karar senden bekleniyor.** Defter tarafı **tümüyle kapandı** — yazma tarafı Faz 1'de,
> okuma tarafı **ADR-022** ile (zincir paritesi, `002_ledger_effective_parity.sql`).
> Ama `package_usage` tarafında `ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil
> olduğu için düzeltme zinciri **iki adımda tıkanıyor**: Geldi → Mazeretli → Geldi dizisinde
> ikinci `delta=−1` yazılamıyor.
>
> İki seçenek: (a) indekse `cycle` sütunu eklemek, (b) `package_usage`'ı da ters-kayıt zinciri
> modeline geçirmek. **(b) lehine yeni bir gerekçe var:** ADR-022 defter tarafında tam olarak
> bu modeli seçti; ders hakkını da aynı modele geçirmek iki sayacı tek bir zihinsel modelde
> birleştirir ve `v_package_remaining` için ADR-022'nin değişmezinin eşi yazılabilir hâle gelir
> (`SUM(delta)` ile kalan hak asla ayrışmaz). (a) daha ucuz ama iki farklı düzeltme dili bırakır.
>
> Kararı ver, **ADR yaz**, migration'ı bu fazda aç. Para/defter kararı olduğu için doğrulamayı
> en güçlü modelle yap (CLAUDE.md ajan kuralı). Bu tek satır bu fazın en riskli parçası —
> önce onu çöz, sonra ekrana geç.

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
