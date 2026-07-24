---
description: Faz 8 — Tahsilat, borçlu listesi, cari ekstre ve makbuz PDF
---

# Faz 8 — Tahsilat & Makbuz

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`.

---

## 1. Tahsilat alma

- Öğrenci seç, tutar, tarih, yöntem (Nakit / Havale / Kart), açıklama
- Ödeme `ledger_entry`'ye **alacak** satırı olarak işlenir
- Ödeme bir pakete bağlanabilir
- Kısmi ödeme desteklenir
- Fazla ödeme → alacaklı bakiye, sonraki döneme devreder
- Ödeme düzeltme ve silme: defter tutarlılığı bozulmayacak şekilde
  (silme değil düzeltme kaydı mı, yoksa soft delete mi — karar ver ve ADR yaz)

## 2. Borçlu listesi

**Kurs sahibinin ay sonu en çok kullanacağı ekran.** Hızlı ve net olmalı.
- Bakiyesi eksi olan öğrenciler
- Tutara ve gecikme süresine göre sıralama
- Veli telefonu görünür ve kopyalanabilir
- Satırdan tek tıkla tahsilat alma
- Toplam alacak tutarı üstte

## 3. Cari ekstre

Öğrenci detayı > `Ödemeler` sekmesini doldur.
Muhasebe defteri gibi okunsun:

| Tarih | Açıklama | Borç | Alacak | Bakiye |

Tarih aralığı filtresi, yazdırma ve dışa aktarma.

## 4. Makbuz PDF

- Ödeme kaydından yazdırılabilir makbuz
- Kurs adı, logo, adres **Ayarlar'dan** gelsin (Ayarlar iskeleti burada kurulabilir)
- **Makbuz numarası sıralı ve tekrarsız** — eşzamanlılık olmasa da atlamasın
- **TÜRKÇE KARAKTER İÇİN GÖMÜLÜ FONT KULLAN.** Varsayılan PDF fontlarında
  `ğ ş İ ı ç ö ü` yok. Gömüldüğünü bir testle veya çıktı görseliyle doğrula.
- Platform bağımlı API kullanma — Windows'ta çalışacak (ADR-008)
- Tutarın yazıyla karşılığı ("Bin iki yüz elli TL") — Türkçe sayı yazımı, testli

## 5. Dönem sonu hesap özeti

Bir öğrencinin seçilen aydaki tüm hareketleri, PDF olarak.

## 6. Testler

- Kısmi ödeme, fazla ödeme, tam ödeme sonrası bakiye
- Ödeme düzeltme/silme sonrası defter tutarlılığı
- Makbuz numarası tekrarsızlığı
- Sayının yazıyla karşılığı (0, 1, 11, 100, 1001, 1.234.567 ve kuruşlu tutarlar)

---

Bitince örnek bir makbuz PDF'i üret ve bana göster, sonra `/kapat`.
