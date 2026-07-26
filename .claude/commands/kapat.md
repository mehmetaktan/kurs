---
description: Oturum sonu — DURUM.md güncelle, kontrolleri çalıştır, commit at
---

Oturumu kapat. Sırayla:

1. `git status` ve `git diff --stat` ile bu oturumda ne değiştiğini gör.

2. Kod yazıldıysa kontrolleri çalıştır (`CLAUDE.md` > Komutlar). Kırmızı varsa
   **kapatmadan önce düzelt**. Düzeltemiyorsan DURUM.md'ye açıkça yaz.

3. `docs/DURUM.md`'yi baştan yaz — eklemeli değil, güncel durumu yansıtacak şekilde:
   - Son güncelleme tarihi, mevcut faz, sonraki oturumda ilk iş
   - Bu oturumda tamamlananlar
   - Yarım kalan / bilinçli ertelenen işler (neden ertelendiğiyle birlikte)
   - Açık sorular — özellikle benden cevap bekleyenler
   - Bir sonraki oturumun en büyük riski

   > **Kısa tut — dosya 150 satırı geçmesin.** DURUM.md **son durumdur**, oturum arşivi
   > değil: kapanmış bir fazın ayrıntısı bir sonraki oturumun işine yaramıyorsa çıkar.
   > Geçmiş `git log`'da, gerekçeler ADR'lerde duruyor. Bir oturum eklerken bir öncekinin
   > detayını sil; büyüyen DURUM.md okunmayan DURUM.md'dir.

4. **Sahiplik kontrolü — ADR-039.** Tek soruyla cevapla ve cevabı DURUM.md'ye yaz:
   *"Bu faz bitince kurs sahibi hangi işi baştan sona yapabiliyor, ve yapamadığı ne kaldı?"*
   Yapamadığı bir şey plandaki hiçbir faza ait değilse **plan eksiktir** — maddeyi
   `docs/KULLANILABILIRLIK.md`'ye ya da ilgili faz komutuna yaz, kendi kafana göre çözme.

5. **Kapanmamış denetim bulguları borç tablosuna geçer — ADR-039.** Bu fazın komutunda
   veya bir denetim dosyasında (`docs/DENETIM-*.md`) bu faza atanmış ama kapanmamış bulgu
   varsa, DURUM.md'nin *"Bilinçli ertelenenler"* tablosuna **hangi faza kaydığıyla** yaz.
   Denetim dosyaları arşivdir, takip yüzeyi değil: `DENETIM-FAZ1 > C5` tam olarak burada
   üç faz boyunca kayboldu.

6. Bu oturumda mimari bir karar aldıysan `docs/KARARLAR.md`'ye ADR ekle.
   Numarayı sıradan devam ettir. Mevcut bir kararı değiştirdiysen eskisini
   `Durum: Değiştirildi` yap, silme.

7. Faz tamamlandıysa `docs/YOL-HARITASI.md`'de o satırı ✅ yap.

8. Yeni bir komut/script eklendiyse `CLAUDE.md` > Komutlar bölümünü güncelle.

9. Değişiklikleri anlamlı bir mesajla commit et.

10. Bana **en fazla 5 madde** özet ver ve bir sonraki oturumun en büyük riskini söyle.

Özeti uzun tutma — asıl kayıt `docs/DURUM.md`'de olmalı, sohbette değil.
