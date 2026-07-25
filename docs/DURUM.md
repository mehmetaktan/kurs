# Durum

**Son güncelleme:** 2026-07-25
**Mevcut faz:** Faz 2 kod olarak tamamlandı + yönetici denetimi yapıldı → sırada **Faz 3**
**Sonraki oturumda ilk iş:** `/faz-03` — ilk maddesi ADR-022 migration'ı (`faz-03.md §0`)

> Faz 2'nin 3 kabul kriterinden **1'i sağlandı** (macOS'ta açılıyor); 2 ve 3 CI'da doğrulanacak
> ve depo GitHub'a gidene kadar bekliyor. Bu Faz 3'ü **bloklamıyor** — Faz 3 ekranları macOS'ta
> geliştirilecek. Push yapıldığında Actions sayfasına bakmak yeterli.

---

## Faz 2 (İskelet & CI) — tamamlandı

`npm run check` yeşil: **107 test** (85 Rust + 22 TypeScript). Uygulama macOS'ta açılıyor;
veritabanı `app_data_dir` altında, SQLite 3.53.2 `bundled`, WAL açık, yabancı anahtarlar açık.

| Ne | Durum |
|---|---|
| `001_initial.sql` | 21 tablo + `schema_migration`, 6 view, 6 trigger, 37 indeks — `VERI-MODELI.md`'den birebir, sıfır sapma |
| Başlangıç verisi | 15 `setting` + tek `teacher` — migration'da, seed'de değil |
| Migration çalıştırıcı | SHA-256 checksum, `include_str!` ile derlemeye gömülü; değiştirilmiş migration açılışta Türkçe mesajla durduruyor |
| Repository | `Record` trait'i ile 21 tabloya tipli `get`/`list`/`archive`/`restore`/`count`; `ledger_entry`'de `update`/`archive` **yok** (K5) |
| `search_name` · `phone_digits` | Repository üretiyor, çağırana bırakılmıyor |
| CI | `.github/workflows/ci.yml` — Test + Paket, `windows-latest` ve `macos-latest` |

### Faz 2 kendi denetimi — 9 bulgu, 5 gerçek

- **`INSERT OR REPLACE` defter mührünü deliyordu.** Örtük `DELETE`, `recursive_triggers`
  kapalıyken `trg_ledger_no_delete`'i hiç ateşlemiyor — defter satırı izsiz kayboluyordu.
  Düzeltme: `PRAGMA recursive_triggers = ON` + 4 regresyon testi (negatif kontrol yapıldı).
- `group_members_on` arşivli öğrenciyi yoklama listesinde bırakıyordu.
- Seed hedef bakiyeyi tutturamayınca sessizce vazgeçiyordu; hedefler mutlak kuruş yerine
  ödeme biçimine bağlandı (mutlak hedefler gerçek tarihe bağlıydı, testler sabit `TODAY`
  kullandığı için yeşil geçiyordu).
- **`parseKurus` ile `parse_kurus` ayrışıyordu:** `'1.2,3.4'` Rust'ta hata, TS'te `1234`.
  TS Rust'ın sırasına çekildi, bozuk girdi listesi iki tarafta eşitlendi, vitest `check`'e
  ve CI'a bağlandı.

## Faz 2 yönetici denetimi (bu oturum)

**Kararlara uygunluk: 7/7 temiz.** Frontend'de SQL yok (ADR-002) · float yok (ADR-003) ·
saklanan bakiye sütunu yok (ADR-004) · `DELETE FROM`/`DROP TABLE` yok (ADR-005) · platforma
özel API yok (ADR-008) · JSX'te çıplak Türkçe yok (ADR-007) · Türkçe metin kolonunda
`ORDER BY` yok (ADR-020).

### Devredilen karar cevaplandı → **ADR-022**

Faz 2'nin sorduğu soru (`v_ledger_effective` üç halkalı zinciri okuyamıyor) `sqlite3` ile
sekiz senaryo çalıştırılarak karara bağlandı. Seçenek 1 — **zincir paritesi** — onaylandı.

Denetim sırasında **ikinci bir arıza** çıktı, Faz 2'nin raporunda yoktu:

| Senaryo | Zincir | Bakiye | Eski tanım | ADR-022 |
|---|---|---|---|---|
| Geldi → Mazeretli → Geldi | 3 | −250 ₺ | **borç yok** ❌ | 250 ₺ ✅ |
| **Tahsilat iptali geri alınır** | 3 | 0 | **250 ₺ borç** ❌ | borç yok ✅ |

İkincisi ters yönde aynı hata: borcu olmayan öğrenciyi borçlu listesine sokuyor. Parite
tanımı ikisini birden kapatıyor ve doğruluğu test edilebilir tek bir değişmeze indiriyor:

> her öğrenci için `SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus`

Uygulaması **Faz 3'ün ilk maddesi**: `002_ledger_effective_parity.sql` + 4 test
(`faz-03.md §0`). `001_initial.sql` elle düzeltilmez — checksum mührü bunun için var.

---

## Açık işler

### 1. GitHub'a push — senin elinde, Faz 2'nin son iki kriteri buna bağlı

**Depo henüz GitHub'a gitmedi** (`git remote` boş), o yüzden hiçbir CI çalışması olmadı.
Kabul kriteri 2 ve 3 bu yüzden ⏳. CI yerelde sınandı: YAML parse edildi, macOS paketlemesi
gerçekten çalıştırıldı ve bir hata yakalandı (dmg adımı `.app`'i tüketiyor, artifact yolu
`*.app` arıyordu → macOS işi hep kırmızı olurdu; düzeltildi).

```
gh auth login
gh repo create kurs-takip --private --source=. --remote=origin --push
```

`gh auth login` interaktif — sohbete `! gh auth login` yazarak buradan da çalıştırabilirsin.
Push ile birlikte workflow kendiliğinden başlar; ilk çalışma ~15–25 dk (Rust derlemesi
önbelleksiz).

> **Windows makine yok — hiçbir aşamada gerekmiyor** (ADR-008 netleştirmesi).
> `.msi` **indirilmez, kurulmaz.** Actions sayfasında bakılacak tek şey: `Test · windows-latest`
> yeşil mi (asıl kanıt bu — testler gerçek migration'ları uyguluyor) ve Artifacts kutusunda
> sıfır olmayan boyutta bir `.msi` listeleniyor mu. `.msi`'yi gerçekten kurup açmak Faz 5
> sonunda **kurs sahibinin bilgisayarında** olacak; gönderilecek paket CI artifact'idir.

### 2. Faz 6'ya devredilen açık karar — ders hakkı tarafı

`ux_pkgusage_att` `(attendance_id, delta)` üzerinde tekil olduğu için düzeltme zincirinin
üçüncü adımında ikinci `delta = −1` yazılamıyor. **Defter tarafı ADR-022 ile kapandı**;
bu, ders hakkı sayacının ayrı sorunu (ADR-015: iki ayrı sayaç). Seçenekler ve ADR-022'nin
getirdiği yeni gerekçe `faz-06.md §3b`'de.

### 3. Bilinçli ertelenenler

| Ne | Neden |
|---|---|
| `design-ref/support.js` indirilmedi | Claude Design'ın render motoru, bizim kodumuz değil. Komut `design-ref/README.md`'de |
| Takvimde öğretmen filtresi + Gün görünümü çoklu sütun | ADR-011 — tek öğretmen. Şema hazır, arayüz sadeleşti |

---

## Açık sorular — cevabını senden bekliyorum

`docs/PRD.md` §9'da gerekçeleriyle. **S1 cevaplandı (ADR-021).** Hiçbiri Faz 3'ü bloklamıyor;
her birinin varsayılan varsayımı var.

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

## Faz 3'ün riski

Tasarım token'ları ve komponent kütüphanesi düşük riskli. Asıl dikkat iki yerde:

1. **ADR-022 migration'ı arayüzden önce bitmeli.** Borçlu listesini okuyan ilk ekran
   yazılmadan şema doğru olmalı; yanlış şemanın üstüne kurulan ekran iki kez yazılır.
2. **`format.ts` ile `money.rs` ayrışmaya devam edebilir.** Faz 2 bir ayrışma buldu;
   tarih ve telefon biçimleyicileri eklenirken aynı tuzak var. Her iki tarafın bozuk girdi
   listesi birlikte güncellenir.
