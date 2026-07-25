---
description: Faz 7 — Fiyat tarifesi ve ders paketi / kredi sistemi
---

# Faz 7 — Fiyatlandırma & Ders Paketi

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/PRD.md`, `docs/KARARLAR.md`
(özellikle ADR-003, ADR-004, ADR-006, **ADR-015**, ADR-016, **ADR-018**).

**Para mantığının temeli burada kuruluyor. Önce plan modunda çalış.**
Burada yapılan hata her raporda, her ekstrede çoğalır.

---

## 1. Fiyat tarifesi

- Branş + ders türü (birebir / grup) → birim ücret
- Tarife değişebilir; **geçerlilik başlangıç tarihi** tutulur
- Eski seansların ücreti değişmez (ADR-006)
- Tarife ekranı: mevcut tarife, geçmiş tarifeler, "şu tarihten itibaren geçerli" ile yeni tarife

## 2. Ders paketi ve taksit planı

- Satış: öğrenci, branş, ders adedi, birim ücret, toplam, indirim, geçerlilik bitişi
- **Taksit planı zorunlu adımdır, atlanamaz** (PRD R4.16). Peşin ödeme de bir plandır:
  tek taksit, vadesi satış günü. `installment` satırları burada doğuyor.
- Satış özeti kaydetmeden önce gösterilir (R5.10):
  *"8 ders · 2.000 TL · 2 taksit — ilk vade 01.03."*
- Seans "yapıldı" olduğunda paketten **bir hak** düşer; iptal edilirse **geri gelir**
- Ders hakkı ve bakiye **iki ayrı sayaç** olarak gösterilir, karıştırılmaz (R5.11)
- Aynı öğrencide birden fazla aktif paket olabilir — **en eskisinden** düşülür (R5.12).
  Bunu ADR olarak yaz.

> **`package.status`'a iş mantığı bağlama.** "Aktif paket" bir sorgudur, bir sütun değildir:
> `remaining > 0 AND (valid_until IS NULL OR valid_until >= :today)`.
> `status` yalnızca `'cancelled'` için bağlayıcıdır; `'exhausted'`/`'expired'` sadece rapor
> etiketidir. Denetimde çıkan senaryo: status güncellenmezse kalan hak eksiye düşüyor, yeni
> paket hiç kullanılmıyor ve o dersler için **borç da yazılmıyor** — öğrenci bedava ders alıyor.

## 3. Deftere yansıma

**ADR-015 ve ADR-014 KİLİTLİDİR. Bu bölüm tartışmaya açık değil.**
Kaynak: `docs/VERI-MODELI.md` §3 (adım adım tablo) ve §4 (iptal ve düzeltme tabloları).

- Paketsiz (`per_session`) öğrenci: seans işlendiğinde
  `ledger_entry(session_charge, −unit_price, attendance_id)`.
  Fiyat `resolve_unit_price()` ile **açıkça çözülür**; bulunamazsa hata verir, sessizce
  0 yazmaz (PRD K-23).
- **Paket satışı deftere satır YAZMAZ.** `package` + `installment` satırları oluşur;
  satışta bakiye değişmez.
- Her taksidin **vadesi geldiğinde** `ledger_entry(installment_charge, −amount, installment_id)`.
  `accrue_due_installments(today)` uygulama açılışında çalışır, **idempotent**, `today`
  parametredir (`date('now')` kullanılmaz — `VERI-MODELI.md §0`).
- **Paketli öğrencide ders işlemek deftere hiçbir satır yazmaz** — yalnızca
  `package_usage(delta = −1)`.
- İptal/iade senaryolarında defterin nasıl düzeltildiği (§4).

> ⚠️ Bu bölüm eskiden *"Paketli öğrenci: **paket satışında borç**, tahsilatta alacak"* diyordu.
> Bu, ADR-015'in gerekçesinde **açıkça elenen (a) alternatifidir** — dönemlik paket alan
> öğrenciyi gün 1'de tüm tutar kadar borçlu gösterir ve borçlu listesini kullanılamaz hâle
> getirir. Komut düzeltildi; eski hâline dönme.

## 4. Öğrenci detayında

- Aktif paketler ve **kalan ders hakkı**
- Güncel bakiye
- Yaklaşan paket bitişi uyarısı

## 5. Testler — bu fazda test pazarlık konusu değil

Rust tarafında en az:
- Kuruş aritmetiği; hiçbir yerde float yok (grep ile doğrula)
- Paket kullanımı **iki kez düşmüyor** (idempotency)
- Seans iptal edilince paket hakkı geri geliyor, iki kez geri gelmiyor
- `bakiye = SUM(ledger_entry)` her senaryoda doğru
- Tarife değişimi geçmiş seansları etkilemiyor
- Paket süresi dolduğunda kalan hakların ne olduğu
- Aynı anda iki aktif pakette doğru olandan düşme

Para ile ilgili yazdığın her fonksiyonun testi olacak. Testsiz fonksiyon bırakma.

---

Bitince test çıktısını göster, sonra `/kapat`.
