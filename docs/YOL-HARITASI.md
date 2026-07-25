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
| Faz 2 sonu | GitHub Actions'tan indirilebilir bir Windows `.msi` **ve** `windows-latest` üzerinde yeşil Rust testleri. Testler gerçek migration'ları uyguladığı için bu, şemanın Windows'ta kurulduğunun kanıtıdır — Faz 5'i beklemeden. → Kod ve CI tanımı hazır; **yeşil çalışma depo GitHub'a gidince doğrulanır.** Faz 3'te de yapılmadı: depo hâlâ yerel. **Faz 4'ten önce halledilmeli** — biriken doğrulanmamış kod her fazda büyüyor. |
| Faz 5 sonu | **İlk gerçek Windows testi.** Kurs sahibine build gönderilir. Faz 10'a bırakılmaz. |
| Faz 7 sonu | Para mantığının testleri yeşil. Buradan sonra şema değişikliği pahalı. |
| Faz 10 sonu | Kurulum dosyası + kullanım kılavuzu + otomatik yedekleme |

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (bkz. ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu
- Mobil arayüz
- Muhasebe/e-fatura entegrasyonu
