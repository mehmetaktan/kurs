---
description: Faz 5 — Branş, grup, seans, takvim ve seri ders oluşturma
---

# Faz 5 — Ders & Takvim

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/EKRANLAR.md`.

**Projenin en karmaşık fazı. Önce plan modunda çalış, planı onaylatmadan kod yazma.**
Faz büyükse ikiye bölmeyi öner — yarıda kalmaktansa bölünmüş olsun.

---

## 1. Branş yönetimi

Basit CRUD: ad, renk (takvimde ayırt etmek için), varsayılan süre.

## 2. Grup yönetimi

- Grup oluştur: ad, branş, kapasite, haftalık program
- Öğrenci ekle / çıkar, kapasite kontrolü
- **Katılma ve ayrılma tarihi tutulur** — geçmiş yoklamalar bozulmayacak (VERI-MODELI.md)
- Grup listesi: doluluk oranı görünsün

## 3. Seans oluşturma

- **Tekil seans:** birebir (öğrenci seç) veya grup (grup seç)
- **Seri oluşturma:** "her Salı 16:00, 12 hafta" → 12 seans üret
  - Birden fazla gün seçilebilsin (Salı + Perşembe)
  - Resmî tatil / seçilen tarihleri atlama seçeneği
  - Üretmeden önce **önizleme** göster, onaydan sonra yaz
- Seans kaydına ücret snapshot'ı yazılsın (ADR-006). Tarife Faz 7'de gelecek;
  şimdilik alan dolsun, değer 0 olabilir.

## 4. Takvim

Tasarımdaki `Takvim` ekranını kur:
- Haftalık ızgara (ana görünüm)
- Aylık genel bakış
- Günlük liste
- Branş rengine göre ayrım, grup/birebir ayrımı görünür

Tasarımdaki `Bugün` ekranını da kur — kurs sahibi sabah bunu açacak:
bugünün dersleri saat sırasıyla, her birinde öğrenci/grup adı ve hızlı eylemler.

## 5. Seans işlemleri

- **Ertele:** tarih/saat değiştir
- **İptal et:** sebep sor, kayıt silinmez durumu değişir
- **Sil:** tek seans mı, serinin kalanı mı, tüm seri mi — **net sor**, varsayılan en dar kapsam
- Geçmiş tarihli seansta düzenleme uyarısı

## 6. Çakışma kontrolü

Aynı saatte iki ders varsa **uyar, engelleme**. Kurs sahibi bilerek yapıyor olabilir.
Uyarı çakışan dersin adını söylesin.

## 7. Testler

Rust tarafında:
- Seri üretimi (tatil atlama dahil), üretilen seans sayısı ve tarihleri
- Çakışma tespiti
- Seri silme kapsamları
- Gruba sonradan katılan öğrencinin katılım öncesi seanslarda görünmemesi

## 8. Tarih/saat kararı

Tarih ve saatleri veritabanında nasıl sakladığını (yerel saat / UTC / metin biçimi)
`docs/KARARLAR.md`'ye ADR olarak yaz. Yaz saati ve Windows sistem saati farklarında
ne olacağını açıkla.

---

## Faz sonu — İLK WINDOWS TESTİ

Bu faz bitince GitHub Actions'tan Windows `.msi`'yi indir. Bana:
- Kurs sahibine nasıl göndereceğimi
- Test etmesini isteyeceğim 5 maddelik listeyi
- SmartScreen uyarısı çıkarsa ne yapması gerektiğini

anlat. Bu testi Faz 10'a bırakmıyoruz.

Bitince `/kapat`.
