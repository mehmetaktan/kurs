---
description: Faz 7 — Fiyat tarifesi ve ders paketi / kredi sistemi
---

# Faz 7 — Fiyatlandırma & Ders Paketi

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/KARARLAR.md`
(özellikle ADR-003, ADR-004, ADR-006).

**Para mantığının temeli burada kuruluyor. Önce plan modunda çalış.**
Burada yapılan hata her raporda, her ekstrede çoğalır.

---

## 1. Fiyat tarifesi

- Branş + ders türü (birebir / grup) → birim ücret
- Tarife değişebilir; **geçerlilik başlangıç tarihi** tutulur
- Eski seansların ücreti değişmez (ADR-006)
- Tarife ekranı: mevcut tarife, geçmiş tarifeler, "şu tarihten itibaren geçerli" ile yeni tarife

## 2. Ders paketi

- Satış: öğrenci, branş, ders adedi, toplam tutar, geçerlilik bitişi
- Seans "yapıldı" olduğunda paketten **bir hak** düşer
- Seans iptal edilirse hak **geri gelir**
- Paket bitince veya süresi dolunca uyarı
- Aynı öğrencide birden fazla aktif paket olabilir — hangisinden düşüleceği kuralı
  belirlensin ve `docs/KARARLAR.md`'ye ADR olarak yazılsın (öneri: en eski geçerlilik önce)

## 3. Deftere yansıma

`docs/VERI-MODELI.md`'de tarif edilen mantığı uygula:
- Paketsiz öğrenci: seans yapıldığında `ledger_entry`'ye **borç** satırı
- Paketli öğrenci: paket satışında borç, tahsilatta alacak; ders işleme hakkı düşürür
- İptal/iade senaryolarında defterin nasıl düzeltildiği

Her senaryo için satır satır ne yazıldığını koda yorum olarak değil,
`docs/VERI-MODELI.md`'ye açıklama olarak ekle.

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
