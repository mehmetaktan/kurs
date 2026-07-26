# Yol Haritası

**Bir oturum = bir faz.** Her faz kendi slash komutuyla çalışır.

Plan 2026-07-26'da ürün sahibinin kararıyla **kısaltıldı**: para fazı yoklamanın önüne
geçti, Faz 7+8 birleşti, Faz 9 kırpılıp Faz 10'a katıldı, takvim donduruldu (ADR-034).
Denetim oturumu artık yalnızca para fazından sonra yapılıyor, ölçüm/araştırma oturumu
açılmıyor (ADR-033).

---

## Kalan plan — iki faz

| Sıra | Faz | Komut | Ne çıkar |
|---|---|---|---|
| **1** | **Yoklama & Telafi** — yoklama girişi, devamsızlık, telafi dersi, **paket tüketiminin bağlanması** · **Codex'te** (ADR-042) | `/faz-06` | Ders sonrası rutini kapanır. İlk madde `DENETIM-PARA > P1` (ADR-044) |
| **2** | **Teslim** — özet ekranı (kırpılmış Faz 9), yedekleme, hata dayanıklılığı, kurulum, kılavuz, **tek `.msi` ve elle Windows testi** | `/faz-10` | Kurs sahibinin kullandığı hâl |

**Para fazı bitti (2026-07-27)** ve plandaki **tek zorunlu denetim yapıldı** —
`docs/DENETIM-PARA.md`. Üç bulgudan ikisi Faz 6'ya, biri ürün sahibinin cevabına bağlandı.

### Neden Faz 6 yine Codex'te

Devir denendi ve tuttu (ADR-042): dış ajan sınırlara uydu, sekiz bölümlü commit geldi,
denetimde tek gerçek hata çıktı ve o da devirden değil, **altındaki eski bir varsayımdan**
doğdu. Aynı kalıp Faz 6'da sürüyor; prompt `docs/CODEX-DEVIR.md`'de.

**Denetim** planda tekti ve para fazından sonra yapıldı. Faz 6 ve Faz 10 kendi
kapanışlarındaki kontrol listesiyle yeter (ADR-033) — devredilen iş yine de diff'ten
okunur.

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

588 test (345 TypeScript + 243 Rust), `npm run check` yeşil, Windows `.msi` CI'da üretiliyor.

Ayrıntı git geçmişinde (`git log --oneline`) ve ADR'lerde; `docs/DURUM.md` yalnızca
**son durumu** tutar, oturum arşivi değildir.

---

## Bağımlılıklar

```
… 4 ──> 5A ──> 5B ──> 5C (donduruldu)
         │
         └──> 7+8 (para) ✅ ──> 6 (yoklama) ──> 10 (teslim)
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
| Faz 10 · teslim kapısı | **Projenin tek elle Windows testi.** Ara `.msi` denemeleri kaldırıldı; tek paket orada üretilir ve orada kurulur |
| Faz 10 sonu | Kurulum dosyası + kullanım kılavuzu + otomatik yedekleme |

---

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu · Mobil arayüz · Muhasebe/e-fatura entegrasyonu
- **Takvim ekranının geliştirilmesi** (ADR-034): sürükleme jestinin ekranda doğrulanması,
  kenarda kendiliğinden kaydırma, şeritlerin boşluğa genişlemesi
- Dönem sonu hesap özeti PDF'i — cari ekstrenin dışa aktarması aynı işi görüyor
