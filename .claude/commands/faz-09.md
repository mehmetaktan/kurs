---
description: (Kırpıldı) Faz 9 artık /faz-10'un içinde — orayı çalıştır
---

# Faz 9 kırpıldı — `/faz-10`'u çalıştır

2026-07-26'da ürün sahibinin kararıyla **Faz 9 ayrı bir faz olmaktan çıktı**. Sebep: proje
bitmesi gerekiyor ve dashboard/rapor katmanı, çalışan bir programın üstüne sonradan
eklenebilecek tek parça.

**Kalan (`/faz-10 §0`):** iki şey.

1. Bugün ekranının özet şeridi — bu ay tahsil edilen, toplam alacak ve borçlu sayısı,
   bekleyen telafi, bitmek üzere olan paket. Kaynağı hazır (`views::total_receivable`,
   `v_student_debt`, `v_package_remaining`); yeni sorgu değil, mevcut komutların ekrana
   bağlanması.
2. **E17 Raporlar sayfası** (`EKRANLAR.md > E17`) — Faz 3'ten beri placeholder duran 7.
   menü öğesi. `StatCard` şeridi + üç basit tablo. Menü öğesi **kaldırılmıyor**: E17'nin
   istediği kapsam zaten mütevazı.

**Kapsam dışına çıkan:** aylık gelir **grafiği**, branş bazlı dağılım grafiği, doluluk ısı
haritası, grafik kütüphanesi seçimi. `EKRANLAR.md > E17` grafiği zaten istemiyordu ("sayı ve
tablo dili hâkim") — bu komut onunla çelişiyordu, çelişki bu kırpmayla kapandı. Grafik
gerektiği gün ayrı bir iş olarak konuşulur; `dataviz` skill'i o zaman devreye girer.

**Kalan tek zorunluluk kapsamda:** dışa aktarmada **UTF-8 BOM** (`CLAUDE.md > Windows`).
O, ekstrenin dışa aktarmasıyla birlikte `/faz-07 §7`'de karşılanıyor.
