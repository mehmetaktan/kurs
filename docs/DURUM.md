# Durum

**Son güncelleme:** 2026-07-25
**Mevcut faz:** Faz 1 tamamlandı + **denetlendi ve düzeltildi** → sırada **Faz 2**
**Sonraki oturumda ilk iş:** `/faz-02` (Tauri iskeleti, migration, seed, Windows CI)

---

## Faz 1 (Plan) — tamamlandı

- `design-ref/` altına 4 ekran indirildi: `Bugun`, `Takvim`, `Öğrenciler`, `Öğrenci detayı`.
  **Sonraki oturumlar tekrar indirmez.** `support.js` ve `.thumbnail` bilinçli olarak alınmadı.
- Yazılan belgeler: `VERI-MODELI.md` (21 tablo + view'lar), `PRD.md`, `EKRANLAR.md`,
  `TASARIM-SISTEMI.md`, `KARARLAR.md` (ADR-011…017)
- Tasarımdan çıkan ve planda olmayan 8 bulgu — en kritiği `teacher` tablosu; ayrıca taksit
  sistemi, haftalık şablon, tatil yönetimi, yedekleme kaydı

## Faz 1 denetimi (yönetici oturumu) — tamamlandı

Şema Faz 2'de gerçek SQL'e dönüşmeden önce çok yönlü ve karşıt-doğrulamalı denetimden geçti.
6 denetçi + her bulgu için ayrı bir çürütücü; SQL iddiaları `sqlite3` ile **çalıştırılarak**
sınandı. **30 bulgu, hiçbiri çürütülmedi** (birkaçının şiddeti düşürüldü) → 25 ayrı sorun.

Tam rapor kanıtlarıyla: **`docs/DENETIM-FAZ1.md`**

### Denetim sonucu düzeltilenler

| Nerede | Ne değişti |
|---|---|
| `VERI-MODELI.md §0` | `'now'` kuralı (SQLite `'now'` **UTC** döner, ADR-017'nin tersi) · K7–K9 yapısal kararları · tüm `DEFAULT`'lar `localtime` |
| `VERI-MODELI.md §1.19` | Defter mührü kapatıldı: sütunsuz trigger + `CHECK (deleted_at IS NULL)` · `ux_ledger_payment` · `ux_ledger_reverses` · `trg_ledger_reversal_valid` · tahsilat mühürleri |
| `VERI-MODELI.md §1.23` | **Borçlu listesi defter tabanlı oldu** (ADR-018): `v_ledger_effective` → `v_open_charge` → `v_student_debt`. Arşivli borçlu artık kaybolmuyor; `package.status`'a iş mantığı bağlı değil |
| `VERI-MODELI.md §4` | İki yeni bölüm: yoklama düzeltmesi · tahsilat iptali |
| `VERI-MODELI.md §5` | Tahakkuk `INSERT...SELECT` olmaktan çıktı — sessizce ücretlendirilmeyen ders sorunu |
| `VERI-MODELI.md §1.4/1.8/1.14/1.3/1.9` | `search_name` · seans üretim ufku · `teacher` başlangıç satırı · çakışan kayıt yasağı |
| `KARARLAR.md` | **ADR-018** borçlu listesi · **ADR-019** yedekleme `VACUUM INTO` · **ADR-020** Türkçe sıralama · **ADR-021** içe aktarma yok |
| `PRD.md` | K-19…K-23 koruyucu kuralları · **S1 cevaplandı** |
| `EKRANLAR.md` | Bugün ekranı borç satırının kaynağı düzeltildi |
| Faz komutları | `faz-02`, `faz-05`, `faz-06`, `faz-07`, `faz-08`, `faz-10` gerçekle hizalandı |

### En ağır üç bulgu (hepsi düzeltildi)

1. **Borçlu listesi ders başı ödeyenleri hiç göstermiyordu.** `v_student_overdue` yalnızca
   `installment`'tan besleniyordu; ders başı borcu `ledger_entry`'de doğuyor. PRD'nin dört
   ana sorusundan biri yanlış cevaplanıyordu.
2. **Defterin değişmezlik mührü delikti.** `deleted_at` korumasızdı → tek UPDATE ile bakiye
   izsiz değişiyor, üstelik taksit bir daha tahakkuk etmiyordu (borç kalıcı kayboluyordu).
3. **Yedekleme çalışmıyordu.** WAL'da `.db` kopyalayan yedek boş çıkıyor ve `integrity_check`
   buna "ok" diyor; geri yükleme de bayat `-wal` yüzünden sessizce hiçbir şey yapmıyordu.

### Denetlendi, sorun çıkmadı

Trigger'lar, dışlayıcı `CHECK`, `GENERATED ... STORED` sütunları, kısmi UNIQUE indeksler ve
şema kuruluş sırası **çalıştırılarak** doğrulandı — hepsi doğru. Şemanın iskeleti sağlamdı;
sorunlar mühürlerde ve iki view'daydı.

---

## Faz 6'ya devredilen tek açık karar

`package_usage` tarafında yoklama düzeltme zinciri **iki adımda tıkanıyor**
(`ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil). Geldi → Mazeretli → Geldi
dizisinde ikinci `delta=−1` yazılamıyor. Seçenekler ve karar `faz-06.md §3b`'de yazılı.
Faz 2'de DDL **olduğu gibi** yazılır.

## Yarım kalan / bilinçli ertelenen

| Ne | Neden |
|---|---|
| `design-ref/support.js` indirilmedi | Claude Design'ın render motoru, bizim kodumuz değil. Komut `design-ref/README.md`'de |
| `CLAUDE.md > Komutlar` hâlâ boş | Faz 2'de `pnpm`/`cargo` komutları belirlenince doldurulacak |
| Takvimde öğretmen filtresi + Gün görünümü çoklu sütun | ADR-011 — tek öğretmen. Şema hazır, arayüz sadeleşti |

---

## Açık sorular — cevabını senden bekliyorum

`docs/PRD.md` §9'da gerekçeleriyle. **S1 cevaplandı (ADR-021).** Kalanların hiçbiri Faz 2'yi
bloklamıyor; her birinin varsayılan varsayımı var.

| # | Soru | Hangi faz |
|---|---|---|
| S2 | Grup kapasitesi aşımı engellensin mi, uyarı mı? | Faz 5 |
| S4 | Standart ders süresi kaç dakika? | Faz 5 — şemada yeri açıldı (`subject.default_min`) |
| S3 | Paketlerin son kullanma tarihi var mı? | Faz 7 |
| S6 | Dönem ortasında ayrılanın kalan paket parası iade mi, alacak mı? | Faz 7 |
| S5 | Makbuz numarası otomatik mi artsın? | Faz 8 |
| S7 | "Devam oranı" hangi pencerede hesaplansın? | Faz 9 |
| S8 | Raporlar 7. menü öğesi mi olsun? | Faz 9 |
| S9 | Bilgisayarındaki Windows sürümü ne? | **Faz 10 öncesi** |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 |

---

## Faz 2'nin riski

Denetim üç riskten ikisini adıyla `faz-02.md`'ye yazdı: `rusqlite` **`bundled`** özelliği
(şema SQLite **3.31+** istiyor) ve `rust-toolchain.toml` ile sürüm sabitleme. Üçüncüsü —
migration'ların gerçekten çalışması — artık `sqlite3` ile doğrulanmış durumda.

Yeni önlem: **Rust testleri `windows-latest` üzerinde de koşacak.** Testler gerçek
migration'ları uyguladığı için Windows'ta geçen bir test, şemanın Windows'ta kurulduğunun
kanıtı olur — kimsenin Windows makinesine dokunmasına gerek kalmadan.

`faz-02.md §9` fazın kabul kriterini üç maddeye bağladı. `.msi`'nin gerçek bir Windows
makinesinde kurulup açılması Faz 2'nin değil, **ADR-008 gereği Faz 5 sonunun** işi.
