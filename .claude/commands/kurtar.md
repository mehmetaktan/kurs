---
description: Bağlam kayboldu / işler karıştı — durum tespiti yap, düzeltme yapma
---

Bağlam kayboldu. Durum tespiti yap. **Kod yazma, dosya değiştirme.**

1. Oku: `docs/DURUM.md`, `docs/YOL-HARITASI.md`, `docs/KARARLAR.md`
2. Çalıştır: `git log --oneline -20`, `git status`
3. Kod varsa kontrolleri çalıştır (`CLAUDE.md` > Komutlar) ve sonucu raporla

Şunları raporla:
- Hangi fazdayız, son commit ne yaptı
- Çalışma ağacında commit edilmemiş iş var mı, ne
- `docs/DURUM.md` ile kodun uyuşmadığı bir yer var mı
- `docs/KARARLAR.md`'deki bir kararın ihlal edildiği bir yer var mı
  (özellikle: frontend'de SQL, float ile para, hard delete, JSX'te çıplak Türkçe metin)
- Bir sonraki adım ne olmalı

Düzeltme önerilerini **liste halinde** sun ama uygulama. Ben seçeceğim.
