# Yol Haritası

**Bir oturum = bir faz.** Her faz kendi slash komutuyla çalışır.

Plan 2026-07-26'da ürün sahibinin kararıyla **kısaltıldı**: para fazı yoklamanın önüne
geçti, Faz 7+8 birleşti, Faz 9 kırpılıp Faz 10'a katıldı, takvim donduruldu (ADR-034).
Denetim oturumu artık yalnızca para fazından sonra yapılıyor, ölçüm/araştırma oturumu
açılmıyor (ADR-033).

---

## Kalan plan — tek teslim kapısı

| Sıra | İş | Kaynak | Ne çıkar |
|---|---|---|---|
| **1** | **Gerçek Windows teslim testi** — WebView2'siz Windows 10/11, tek `.msi`, elle | `docs/WINDOWS-TESLIM-KONTROLU.md` | Yeşil kanıt sonrası v1 teslim edilir |

**Faz 6 ile Faz 10'un kod ve belge işleri bitti (2026-07-27).** Son kapı gerçek hedef
bilgisayardaki Windows testidir; çalıştırılmadan teslim edilmiş sayılmaz.

---

## Tamamlananlar

| # | Faz | Ne kaldı geriye |
|---|---|---|
| 0–1 | Kuruluş + plan (`/faz-01`, denetim) | PRD, veri modeli, ekran envanteri, tasarım sistemi |
| 2 | İskelet & CI (`/faz-02`) | Tauri + SQLite + migration + seed + Windows CI tanımı |
| 3 | Tasarım sistemi (`/faz-03`, denetim) | Token'lar, komponent kütüphanesi, uygulama kabuğu; ADR-024 marka |
| 4 · 4.5 | Öğrenci & Veli (`/faz-04`, `/faz-04b`, denetim) | `repo/roster.rs`, liste/detay/form; ADR-025/026/027 |
| 5A | Seans üretim motoru, branş, tatil, grup (`/faz-05`) | `repo/schedule.rs`; **CI ilk kez tümüyle yeşil** |
| 5B | Ders ekle/düzenle, seans işlemleri, Bugün ekranı (`/faz-05b`, denetim) | ADR-028, ADR-029 |
| 5C-K | Takvim kütüphanesi ölçümü + para biçimleme (`/faz-05c-karar`, denetim) | ADR-031; ICU bağımsızlığı (`format.ts`) |
| 5C | Takvim ekranı (`/faz-05c`) | ADR-032; **donduruldu — ADR-034** |
| Para §0 | Öğretmenler, işletme ayarları, çakışma uyarısı, aranabilir seçim (`/faz-07`) | ADR-041; `DENETIM-FAZ1 > C5` kapandı |
| Para §4 | `package_usage` ters kayıt zinciri + tüketim fonksiyonu (`/faz-07`) | `003_*.sql`; ADR-036'nın kanıt şartı yeşil; ADR-040 |
| **Para §1–§10** | Tarife, paket/taksit, defter, tahsilat, borçlu, ekstre, makbuz PDF (`/faz-07`, **Codex**) | ADR-043, ADR-044; **denetlendi** — `docs/DENETIM-PARA.md` |
| **Faz 6** | Yoklama, telafi, öğrenci ders geçmişi ve devamsızlık raporu (`/faz-06`, **Codex**) | Paket/defter etkileri testli; Takvim dondurması korundu |
| **Faz 10 kodu** | Özetler, raporlar, yedekleme/geri yükleme, hata dayanıklılığı, yardım, v1 yayın hattı ve kılavuzlar (`/faz-10`, **Codex**) | Windows elle testi ayrı teslim kapısında bekliyor |

697 test (404 TypeScript + 293 Rust) + 1 doc-test, `npm run check` yeşil.

Ayrıntı git geçmişinde (`git log --oneline`) ve ADR'lerde; `docs/DURUM.md` yalnızca
**son durumu** tutar, oturum arşivi değildir.

---

## Bağımlılıklar

```
… 4 ──> 5A ──> 5B ──> 5C (donduruldu)
         │
         └──> 7+8 (para) ✅ ──> 6 (yoklama) ✅ ──> 10 (kod) ✅ ──> Windows teslim testi
```

- **Para fazı 5A'ya bağlı**, 5B/5C'ye değil: seansları motor üretiyor, takvim değil.
- **Yoklama para fazına bağlı**: paket tüketimi fonksiyonu orada yazılıyor.
- **Teslim her şeye bağlı**; özet ekranı yoklama + tahsilat verisini gösterir.

---

## Kritik kilometre taşları

| Ne zaman | Ne |
|---|---|
| Faz 5A sonu ✅ | **CI ilk kez tümüyle yeşil** (2026-07-26). Şemanın Windows'ta kurulduğu kanıtlı — testler gerçek migration'ları uyguluyor |
| **Para fazı sonu ✅** | **Para mantığının testleri yeşil** (2026-07-27). Buradan sonra şema değişikliği pahalı. Plandaki tek zorunlu denetim burada yapıldı |
| Faz 10 kodu ✅ | Kurulum/yayın hattı + kullanım kılavuzu + otomatik yedekleme hazır |
| Faz 10 · teslim kapısı | **Projenin tek elle Windows testi.** Tek paket üretilir, gerçek hedefte kurulur; henüz bekliyor |

---

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu · Mobil arayüz · Muhasebe/e-fatura entegrasyonu
- **Takvim ekranının geliştirilmesi** (ADR-034): sürükleme jestinin ekranda doğrulanması,
  kenarda kendiliğinden kaydırma, şeritlerin boşluğa genişlemesi
- Dönem sonu hesap özeti PDF'i — cari ekstrenin dışa aktarması aynı işi görüyor
