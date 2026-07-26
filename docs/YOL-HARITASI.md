# Yol Haritası

**Bir oturum = bir faz.** Her faz kendi slash komutuyla çalışır.

Plan 2026-07-26'da ürün sahibinin kararıyla **kısaltıldı**: para fazı yoklamanın önüne
geçti, Faz 7+8 birleşti, Faz 9 kırpılıp Faz 10'a katıldı, takvim donduruldu (ADR-034).
Denetim oturumu artık yalnızca para fazından sonra yapılıyor, ölçüm/araştırma oturumu
açılmıyor (ADR-033).

---

## Kalan plan — üç faz

| Sıra | Faz | Komut | Ne çıkar |
|---|---|---|---|
| **1** | **Para** — fiyat tarifesi, paket/taksit, tahsilat, borçlu listesi, ekstre, makbuz PDF (eski 7 + 8) · **sürüyor: §0 ✅ ve §4 ✅, sırada §1** | `/faz-07` | Program ilk kez **para takip ediyor**. §0'da önce **öğretmen ve işletme ayarları** (ADR-037) |
| **2** | **Yoklama & Telafi** — yoklama girişi, devamsızlık, telafi dersi, **paket tüketiminin bağlanması** | `/faz-06` | Ders sonrası rutini kapanır; ADR-015'in ders hakkı sayacı ekrana bağlanır |
| **3** | **Teslim** — özet ekranı (kırpılmış Faz 9), yedekleme, hata dayanıklılığı, kurulum, kılavuz | `/faz-10` | Kurs sahibinin kullandığı hâl |

**Sıra 1 sığmazsa** bölünür ama **yeni komut açılmaz**. İki dikiş yeri var:
`/faz-07 §1` (öncesi §0 — öğretmenler, ayarlar, çakışma uyarısı, aranabilir seçim) ve
`/faz-07 §5` (öncesi tarife + paket + tahakkuk, sonrası tahsilat + ekstre + makbuz).
Aynı komutla devam edilir, arada denetim veya karar oturumu **yok**.

> **Birinci oturum (2026-07-26) §0'ı bitirdi ve §4'ü öne aldı**: ADR-036'nın migration'ı,
> yedi kanıt dizisi ve tüketim fonksiyonu (ADR-040) yazıldı. Sıradaki oturum §1'den
> (fiyat tarifesi) devam eder; ikinci dikişe (§5) daha varılmadı.

### Sıra 1'in §0'ı neden var

Kurs sahibi bugün programında **hiçbir işletme değerini değiştiremiyor**: öğretmenin adı
migration'dan gelen `'Öğretmen'`, çalışma saatleri sabit, devamsızlık politikası sabit.
Sonuncusu para mantığının doğrudan girdisi — kullanıcının değiştiremediği bir politikayı
sabit sayıp üstüne defter kurmak, sonra değiştirmek pahalı. Ayrıntı: **ADR-037**, hata
analizi: **ADR-039**.

**Denetim** yalnızca Sıra 1'den sonra (para mantığı — `CLAUDE.md`'nin kendi istisnası).
Sıra 2 ve 3 kendi kapanışlarındaki kontrol listesiyle yeter.

### Neden para yoklamadan önce

Uygulamanın adı "ders ve **tahsilat** takip" ve tahsilat hiç yok. Yoklamanın paraya
değdiği tek yer paket tüketimi (ADR-015): o fonksiyon `/faz-07`'de **yazılır ve Rust'ta
testlenir**, ekran bağlantısı `/faz-06`'da yapılır. Bu ayrım rework üretmiyor — tüketim
fonksiyonunu yoklama kaydı çağıracak, imzası şimdi sabitleniyor.

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
| Para §0 | Öğretmenler, işletme ayarları, çakışma uyarısı, aranabilir seçim (`/faz-07`) | ADR-040, ADR-041; `DENETIM-FAZ1 > C5` kapandı |
| Para §4 | `package_usage` ters kayıt zinciri + tüketim fonksiyonu (`/faz-07`) | `003_*.sql`; ADR-036'nın kanıt şartı yeşil |

536 test (320 TypeScript + 216 Rust), `npm run check` yeşil, Windows `.msi` üretiliyor.

Ayrıntı git geçmişinde (`git log --oneline`) ve ADR'lerde; `docs/DURUM.md` yalnızca
**son durumu** tutar, oturum arşivi değildir.

---

## Bağımlılıklar

```
… 4 ──> 5A ──> 5B ──> 5C (donduruldu)
         │
         └──> 7+8 (para) ──> 6 (yoklama) ──> 10 (teslim)
```

- **Para fazı 5A'ya bağlı**, 5B/5C'ye değil: seansları motor üretiyor, takvim değil.
- **Yoklama para fazına bağlı**: paket tüketimi fonksiyonu orada yazılıyor.
- **Teslim her şeye bağlı**; özet ekranı yoklama + tahsilat verisini gösterir.

---

## Kritik kilometre taşları

| Ne zaman | Ne |
|---|---|
| Faz 5A sonu ✅ | **CI ilk kez tümüyle yeşil** (2026-07-26). Şemanın Windows'ta kurulduğu kanıtlı — testler gerçek migration'ları uyguluyor |
| Faz 5C sonu ✅ | **İlk gerçek Windows testi.** `.msi` kurs sahibine gönderiliyor; 5 maddelik test listesi Segoe UI metrikleri, DPI ölçekleme, kaydırma çubuğu ve ICU verisini yokluyor |
| **Para fazı sonu** | **Para mantığının testleri yeşil.** Buradan sonra şema değişikliği pahalı. Denetim burada yapılır |
| Faz 10 sonu | Kurulum dosyası + kullanım kılavuzu + otomatik yedekleme |

---

## Kapsam dışı (v2)

- WhatsApp / SMS hatırlatma (ADR-009)
- Çoklu kullanıcı, giriş ekranı, yetkilendirme
- Bulut senkronizasyonu · Mobil arayüz · Muhasebe/e-fatura entegrasyonu
- **Takvim ekranının geliştirilmesi** (ADR-034): sürükleme jestinin ekranda doğrulanması,
  kenarda kendiliğinden kaydırma, şeritlerin boşluğa genişlemesi
- Dönem sonu hesap özeti PDF'i — cari ekstrenin dışa aktarması aynı işi görüyor
