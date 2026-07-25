# Yol Haritası

**Bir oturum = bir faz.** Her faz kendi slash komutuyla çalıştırılır: `/faz-01` … `/faz-10`.

| # | Faz | Komut | Durum |
|---|---|---|---|
| 0 | Kuruluş iskeleti — git, CLAUDE.md, kararlar, komutlar | — | ✅ Tamamlandı |
| 1 | Plan — tasarım okuma, PRD, veri modeli, ekran envanteri | `/faz-01` | ✅ Tamamlandı |
| 1.5 | **Faz 1 denetimi** — şema, ADR ve faz komutlarının düzeltilmesi | `/yonetici` | ✅ Tamamlandı |
| 2 | İskelet & CI — Tauri projesi, şema, migration, seed, Windows build | `/faz-02` | ✅ Tamamlandı — CI doğrulaması GitHub'a push'a bağlı |
| 3 | Tasarım sistemi — token'lar, komponentler, uygulama kabuğu | `/faz-03` | ✅ Tamamlandı — ADR-022 migration'ı da bu fazda kapandı |
| 3.5 | **Faz 3 denetimi** — ADR uyumu, marka kararı (ADR-024) | `/yonetici` | ✅ Tamamlandı |
| 4 | Öğrenci & Veli — CRUD, arama, detay sayfası | `/faz-04` | ✅ Tamamlandı — §0 marka geçişi (ADR-024) uygulandı, ADR-025 eklendi |
| 4.4 | **Faz 4 denetimi** — 6 boyut, karşıt doğrulamalı; ADR-026 (özet rakamlar) | `/yonetici` | ✅ Tamamlandı |
| 4.5 | **Faz 4 artıkları** — veli araması · bakiye altyazısı · toplam alacak · telefon maskesi · K-14 | `/faz-04b` | ✅ Tamamlandı (beşi de; 288 test) |
| 5A | Ders & Takvim — branş, tatil, grup, **seans üretim motoru** | `/faz-05` | ✅ Tamamlandı (342 test); CI ilk kez yeşil |
| 5B | Ders ekle/düzenle, seans işlemleri, **Bugün ekranı** | `/faz-05b` | ✅ Tamamlandı (388 test); ADR-028 + ADR-029 eklendi |
| 5B.5 | **Faz 5B denetimi** — 7/7 kilitli kontrol temiz, 3 bulgu; **ADR-030** (Pointer Events) ve 5C'nin ikiye bölünmesi | `/yonetici` | ✅ Tamamlandı |
| 5C-K | **Takvim kütüphanesi kararı** — ölçüm, deneme, ADR-031 + para biçimleme düzeltmesi | `/faz-05c-karar` | ⬜ |
| 5C | **Takvim ekranı** — ADR-031'i uygular + push + **ilk Windows testi** | `/faz-05c` | ⬜ |
| 6 | Yoklama & Telafi | `/faz-06` | ⬜ |
| 7 | Fiyatlandırma & Ders Paketi | `/faz-07` | ⬜ |
| 8 | Tahsilat & Makbuz | `/faz-08` | ⬜ |
| 9 | Dashboard & Raporlar | `/faz-09` | ⬜ |
| 10 | Yedekleme & Teslim | `/faz-10` | ⬜ |

## Bağımlılıklar

```
1 ──> 2 ──> 3 ──> 4 ──> 5A ──> 5B ──> 5C-K ──> 5C ──> 6
                         │
                         └───────────────────────────> 7 ──> 8 ──> 9 ──> 10
```

- **Faz 3, Faz 2'ye bağlı**: komponentler gerçek veriyle bağlanabilmeli.
- **Faz 7, Faz 5A'ya bağlı**: paket mantığı seans olmadan test edilemez — ama seansları
  **motor** üretiyor, takvim değil. 5A bittiğine göre Faz 7 teknik olarak 5B/5C'yi
  beklemiyor; sıra yine de bozulmuyor çünkü yoklama (Faz 6) Bugün ekranından giriliyor.
- **Faz 9, Faz 6 + 8'e bağlı**: dashboard hem yoklama hem tahsilat verisini gösterir.

## Kritik kilometre taşları

| Ne zaman | Ne |
|---|---|
| Faz 2 sonu | GitHub Actions'tan indirilebilir bir Windows `.msi` **ve** `windows-latest` üzerinde yeşil Rust testleri. Testler gerçek migration'ları uyguladığı için bu, şemanın Windows'ta kurulduğunun kanıtıdır — Faz 5'i beklemeden. → Kod ve CI tanımı hazır; **yeşil çalışma depo GitHub'a gidince doğrulanır.** Faz 3'te de yapılmadı: depo hâlâ yerel. **Faz 4'ten önce halledilmeli** — biriken doğrulanmamış kod her fazda büyüyor. |
| **Faz 5A sonu** | **CI ilk kez tümüyle yeşil** (2026-07-26): `Test · windows-latest` geçti, `.msi` ve `.dmg` üretildi. Şemanın Windows'ta kurulduğu artık kanıtlı — Faz 2'nin kilometre taşı üç faz gecikmeyle kapandı. Nedeni `npm ci`'nin makine ayarına bağlı kilit dosyasıydı; ayrıntı `docs/DURUM.md`. |
| Faz 5C sonu | **İlk gerçek Windows testi.** Kurs sahibine build gönderilir. Faz 10'a bırakılmaz. (Faz 5 üçe bölününce bu taş 5C'ye kaydı.) CI ızgarayı **çalıştırmıyor** — jsdom testleri ile paket derlemesi bu boşluğu kapatmıyor. Boşluk motor semantiğinde değil (macOS'ta WKWebView, Windows'ta WebView2/Chromium — geliştirme daha katı motorda yapılıyor); **Segoe UI metrikleri, DPI ölçekleme, kaydırma çubuğu genişliği ve ICU verisi**nde. Ayrıntı `/faz-05c §0`. **Push da buraya bağlandı:** 5B, 5C-K ve 5C tek seferde CI'a gider. |
| Faz 7 sonu | Para mantığının testleri yeşil. Buradan sonra şema değişikliği pahalı. |
| Faz 10 sonu | Kurulum dosyası + kullanım kılavuzu + otomatik yedekleme |

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (bkz. ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu
- Mobil arayüz
- Muhasebe/e-fatura entegrasyonu
