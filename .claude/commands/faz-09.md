---
description: Faz 9 — Dashboard ve raporlar
---

# Faz 9 — Dashboard & Raporlar

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md`.

Grafik yazmadan önce **`dataviz` skill'ini yükle.**

---

## 1. Dashboard

Tasarımdaki `Bugün` ekranını tam haline getir. Kurs sahibi programı açtığında
bunu görecek — üç saniyede günü anlamalı:

- **Bugünün dersleri**, saat sırasıyla, yoklama girilmiş mi işaretiyle
- Bu ay tahsil edilen / beklenen tutar
- Toplam alacak ve borçlu öğrenci sayısı
- Bu hafta devamsızlık yapanlar
- Bitmek üzere olan ders paketleri
- Bekleyen telafiler

Her kart tıklanınca ilgili ekrana gitsin.

## 2. Raporlar

- Aylık gelir grafiği (son 12 ay)
- Branş bazlı gelir dağılımı
- **Doluluk:** hangi saatler dolu, hangi saatler boş — kurs sahibi yeni öğrenciyi
  nereye yerleştireceğini buradan görecek
- Öğrenci bazlı özet tablo: ders sayısı, devam yüzdesi, tahsil edilen, bakiye
- Tarih aralığı filtresi tüm raporlarda ortak

## 3. Dışa aktarma

Excel / CSV. **UTF-8 BOM ekle** — yoksa Windows Excel'de Türkçe karakterler bozulur
(`CLAUDE.md` > Windows). Bir dosyayı gerçekten Excel'de açıp doğrula ya da
BOM'un yazıldığını testle kanıtla.

## 4. Grafikler

- Hafif bir kütüphane seç, gerekçesini yaz
- Renkler `docs/TASARIM-SISTEMI.md`'deki paletten
- Boş veri durumu her grafikte ele alınmış olsun (yeni kurulan programda hiç veri yok)

## 5. Testler

Rapor sorgularının doğruluğu: seed verisiyle beklenen toplamlar. Özellikle
aylık gelir toplamının `ledger_entry` ile tutarlılığı.

---

Bitince dashboard ekran görüntüsünü göster, sonra `/kapat`.
