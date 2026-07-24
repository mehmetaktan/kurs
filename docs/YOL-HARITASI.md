# Yol Haritası

**Bir oturum = bir faz.** Her faz kendi slash komutuyla çalıştırılır: `/faz-01` … `/faz-10`.

| # | Faz | Komut | Durum |
|---|---|---|---|
| 0 | Kuruluş iskeleti — git, CLAUDE.md, kararlar, komutlar | — | ✅ Tamamlandı |
| 1 | Plan — tasarım okuma, PRD, veri modeli, ekran envanteri | `/faz-01` | ✅ Tamamlandı |
| 2 | İskelet & CI — Tauri projesi, şema, migration, seed, Windows build | `/faz-02` | ⬜ |
| 3 | Tasarım sistemi — token'lar, komponentler, uygulama kabuğu | `/faz-03` | ⬜ |
| 4 | Öğrenci & Veli — CRUD, arama, detay sayfası | `/faz-04` | ⬜ |
| 5 | Ders & Takvim — branş, grup, seans, seri ders | `/faz-05` | ⬜ |
| 6 | Yoklama & Telafi | `/faz-06` | ⬜ |
| 7 | Fiyatlandırma & Ders Paketi | `/faz-07` | ⬜ |
| 8 | Tahsilat & Makbuz | `/faz-08` | ⬜ |
| 9 | Dashboard & Raporlar | `/faz-09` | ⬜ |
| 10 | Yedekleme & Teslim | `/faz-10` | ⬜ |

## Bağımlılıklar

```
1 ──> 2 ──> 3 ──> 4 ──> 5 ──> 6
                        │
                        └────> 7 ──> 8 ──> 9 ──> 10
```

- **Faz 3, Faz 2'ye bağlı**: komponentler gerçek veriyle bağlanabilmeli.
- **Faz 7, Faz 5'e bağlı**: paket mantığı seans olmadan test edilemez.
- **Faz 9, Faz 6 + 8'e bağlı**: dashboard hem yoklama hem tahsilat verisini gösterir.

## Kritik kilometre taşları

| Ne zaman | Ne |
|---|---|
| Faz 2 sonu | GitHub Actions'tan indirilebilir bir Windows `.msi` çıkıyor olmalı |
| Faz 5 sonu | **İlk gerçek Windows testi.** Kurs sahibine build gönderilir. Faz 10'a bırakılmaz. |
| Faz 7 sonu | Para mantığının testleri yeşil. Buradan sonra şema değişikliği pahalı. |
| Faz 10 sonu | Kurulum dosyası + kullanım kılavuzu + otomatik yedekleme |

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (bkz. ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu
- Mobil arayüz
- Muhasebe/e-fatura entegrasyonu
