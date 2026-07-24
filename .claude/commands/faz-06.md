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
- Durumlar: **Geldi / Gelmedi / Mazeretli / Geç geldi**
- **"Hepsi geldi" toplu işareti** — en sık kullanılacak buton, en görünür yerde
- Öğrenci başına kısa not alanı

Bu ekran hızlı olmalı: kurs sahibi ders bitiminde 10 saniyede kapatabilmeli.

## 2. Seans durumu

`planlandı → yapıldı / iptal`. Yoklama girilince otomatik "yapıldı".
Yapıldı olan seans Faz 7'de paketten düşecek — o bağlantı noktasını hazırla ama
paket mantığını burada kurma.

## 3. Telafi dersi

- Gelmeyen öğrenci için telafi seansı oluştur
- İki kayıt birbirine bağlansın (`attendance` → telafi `session`)
- Öğrenci detayında **"bekleyen telafi"** rozeti
- Telafi listesi: kime kaç telafi borçlu

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
