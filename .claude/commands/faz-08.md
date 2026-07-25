---
description: Faz 8 — Tahsilat, borçlu listesi, cari ekstre ve makbuz PDF
---

# Faz 8 — Tahsilat & Makbuz

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/PRD.md`,
`docs/KARARLAR.md` (ADR-014, **ADR-018**, **ADR-025**).

> **Faz 4'ten devralınan iki iş — unutulmasın, ikisi de bu fazda kapanır:**
>
> 1. **Öğrenciler listesinin son kolonu.** Faz 4'te tasarımdaki `Tahsilat al` yerine
>    geçici olarak **`Aç`** kondu, çünkü tahsilat o fazda yoktu ve çalışmayan bir düğme
>    koymaktansa çalışan bir eylem konuldu. Bu fazda tasarıma döndür
>    (`EKRANLAR.md` E1 / öğrenci listesi kolonları). Arşiv görünümündeki `Geri al`
>    kolonu **kalır** (E2).
> 2. **`Toplam alacak` rakamının tanımı.** ADR-025 §"Özet rakamlar" kuralına uydur ve
>    `views::total_receivable`'ın ikinci tanımını ortadan kaldır — tek kaynak kalsın.

---

## 1. Tahsilat alma

- Öğrenci seç, tutar, tarih, yöntem (Nakit / Havale / Kart), açıklama
- Ödeme `ledger_entry`'ye **alacak** satırı olarak işlenir
- **Açık taksitlere mahsup** (`payment_allocation`) — tasarımın "Mahsup edildiği taksit"
  kolonunun kaynağı. Mahsup otomatik önerilir, **en eski vadeden başlayarak** (R4.6),
  elle değiştirilebilir. Mahsup toplamı ödemeyi aşamaz (K-9).
- Otomatik mahsup **bütün açık taksitleri** kapsar — vadesi gelmiş **ve gelmemiş**.
  Aksi hâlde avans birikir ve bakiye ile borçlu listesi birbirini tutmaz.
- Kısmi ödeme desteklenir
- Fazla ödeme → avans; ekranda açıkça yazılır (R4.7): *"420 TL avans olarak kalacak."*
- **Çift tık koruması zorunlu** (PRD K-19): Kaydet ilk tıklamada kilitlenir ve makbuz
  numarası modal **açılırken** rezerve edilir. Şema indeksi bunu yakalayamaz — çift tık
  iki ayrı `payment` satırı üretir, ikisi de geçerlidir.
- **Tahsilat düzeltilmez, silinmez** — karar alındı, yeniden tartışılmıyor (ADR-014, R4.10).
  İptal akışı `VERI-MODELI.md §4` "Tahsilat iptal edilirse defterde ve mahsupta ne olur"
  bölümünde satır satır tanımlı: ters kayıt + `payment_allocation` satırlarının arşivlenmesi,
  tek transaction. **`payment.deleted_at` asla doldurulmaz** (makbuz numarası serbest kalır).

## 2. Borçlu listesi

**Kurs sahibinin ay sonu en çok kullanacağı ekran.** Hızlı ve net olmalı.
- Kaynak **`v_student_debt`** (ADR-018) — `v_student_overdue` değil.
  Denetimde çıkan hata: taksit tabanlı liste **ders başı ödeyen öğrencileri hiç göstermiyordu**.
- Tutara ve gecikme süresine göre sıralama; gecikme gün sayısı Rust'ta, `today` bind edilerek
- **Arşivlenmiş borçlu bu listede ve toplam alacakta görünür** (ADR-005 gerekçesi);
  Bugün ekranında görünmez
- Veli telefonu görünür ve kopyalanabilir
- Satırdan tek tıkla tahsilat alma
- Toplam alacak tutarı üstte
- Filtreler: Gecikmiş · Bu ay vadesi gelen (`v_installment_open`) · Avansı olan

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
