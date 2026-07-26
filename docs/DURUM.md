# Durum

**Son güncelleme:** 2026-07-27 · **para fazı bitti ve denetlendi** (`docs/DENETIM-PARA.md`)
**Sıradaki iş:** **Codex** `/faz-06`'yı yazar (prompt `docs/CODEX-DEVIR.md`'de) —
**ilk madde denetimin P1 bulgusu**, ADR-044
**Kalan plan:** `/faz-06` (yoklama, Codex'te) → `/faz-10` (teslim)

> Bu dosya **son durumu** tutar, oturum arşivi değildir. Geçmiş `git log`'da, gerekçeler
> `docs/KARARLAR.md`'de.

---

## Nerede duruyoruz

`npm run check` yeşil: **588 test** (345 TypeScript + 243 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi.

| Çalışıyor | Nerede |
|---|---|
| Öğrenci & veli · branş · tatil · gruplar | `pages/ogrenciler/` · `pages/gruplar/` · `pages/tanimlar/` |
| Seans üretim motoru — ufka kadar, idempotent, açılışta | `repo/schedule.rs` · `repo/ops.rs` |
| Bugün ekranı, ders ekle/düzenle, ertele/iptal/sil, şablon | `pages/bugun/` · `pages/dersler/` |
| Takvim — ay/hafta/gün, sürükle-bırak (**donduruldu**, ADR-034) | `pages/takvim/` |
| Öğretmenler ve işletme ayarları | `pages/tanimlar/TeachersTab · GeneralTab` |
| Ders hakkı sayacı — zincir modeli + tüketim fonksiyonu | `migrations/003_*` · `repo/finance.rs` |
| **Para: tarife · paket/taksit · tahsilat · borçlu · ekstre · makbuz PDF** | `pages/odemeler/` · `pages/tanimlar/PriceRulesTab` · `repo/finance.rs` · `receipt.rs` |

---

## Para fazı bitti — `/faz-07` (ADR-042, Codex)

Program **ilk kez para takip ediyor**: fiyat tarifesi (tarihli geçmişle) · paket ve
taksit satışı · vade tahakkuku · tahsilat ve otomatik mahsup · borçlu listesi · cari
ekstre (yazdırma + BOM'lu CSV) · gömülü fontlu makbuz PDF · öğrenci ve Bugün ekranlarının
paraya bağlanması. 8 commit (`3d80e44..4288405`), 45 dosya, 588 test.

**Denetim yapıldı — `docs/DENETIM-PARA.md`.** Dış ajan sınırlara uydu: migration yok,
belge yok, ADR yok, takvim yok, tek defter yolu, bölümlü commit. Doğrulananlar: ADR-015'in
satış kuralı, ADR-014'ün iptal zinciri (`payment.deleted_at` boş kalıyor), K-9'un mahsup
sınırı, en eski vadeden mahsup, tahakkuk idempotency'si, float yokluğu, gömülü font.

Denetimin yazdığı iki karar: **ADR-043** (makbuz PDF yığını — `printpdf`, base64 gömülü
Noto Sans, tek `opener` yetkisi), **ADR-044** (ders ücreti paketli öğrencide yazılmaz).

## Sıradaki iş — `/faz-06` yine Codex'te

Devir sürüyor (ADR-042'nin kalıbı): prompt `docs/CODEX-DEVIR.md`'nin başında, sınırlar
aynı — migration yok, `docs/**` ve ADR yok, takvim yok, tek defter yolu, bölümlü commit.
Kurallar kökteki `AGENTS.md`'de (Codex `CLAUDE.md`'yi kendiliğinden okumaz).

**Faz 6'nın ilk maddesi denetimin P1 bulgusu — ADR-044.** `charge_session` paketli
öğrenciyi tanımıyor; bu fazın kendisi o fonksiyonu çağıracak, yani düzeltilmezse mayına
basılacak. Ayrıntı `docs/DENETIM-PARA.md` ve `/faz-06 §0a`.

**Claude Code'un işi:** Codex tıkandığında yönetici oturumunda cevaplamak, dönüşte
denetlemek. Faz 6 sonrası ayrı denetim oturumu **zorunlu değil** (ADR-033) — zorunlu olan
tekti ve yapıldı; yine de devredilen iş diff'ten okunur.

### Sahiplik kontrolü (ADR-039)

*Bugün kurs sahibi ne yapabiliyor?* Öğrencisini, grubunu, **öğretmenlerini ve çalışma
düzenini** tanımlıyor; dersini planlıyor, taşıyor, iptal ediyor; takvimi öğretmene göre
süzüyor.

Artık **parasını da takip ediyor**: tarife giriyor, paket ve taksit satıyor, tahsilat
alıyor, borçlusunu görüyor, ekstre ve makbuz basıyor.

*Yapamadığı ne?* **Yoklama** (Faz 6), yedekleme ve özet ekranı (Faz 10). İkisi de plandaki
bir faza ait — **plan eksik değil.**

### Sıradaki fazın en büyük riski

**P1'in atlanması.** Faz 6 `charge_session`'ı çağıran fazdır; düzeltme yapılmadan çağrı
yazılırsa paketli her öğrenci işlenen her ders için ikinci kez borçlanır ve hata
**sessizdir** — ekranda değil, ay sonu ekstrede görünür. Prompt bunu ilk madde yapıyor,
denetimde ilk bakılacak yer burası.

İkinci risk: **ikinci bir tüketim yolu.** `consume_package_credit` / `restore_package_credit`
yazılı ve testli (ADR-040); yoklama ekranının kendi sayaç mantığını kurması iki sayaç
üretir. ADR-036'nın zincir değişmezi ancak tek yol varken korunur.

---

## Ürün sahibinden beklenen tek şey

**Kullanılabilirlik maddeleri.** `docs/KULLANILABILIRLIK.md` şu an boş — yazılan her
satır bir sonraki kod oturumunun §0'ı olur.

> **Windows testi kapatıldı — ürün sahibinin kararı (2026-07-26).** `.msi` kurma ve elle
> test etme işi **teslim fazına** ertelendi (`/faz-10 §8`), tek `.msi` orada üretilecek.
> Bu madde bir daha oturum açılışında sorulmaz; Windows kanıtı o güne kadar **CI**
> (`.github/workflows/ci.yml` Windows işi yeşil).

## Açık sorular

`docs/PRD.md` §9'da. **Sıradaki fazı bekleten açık soru yok.**
S9 (Windows sürümü) ve S10 (kod imzalama sertifikası) Faz 10 öncesi cevaplanır.

---

## Bilinçli ertelenenler — hâlâ borç

> **ADR-039:** kapanmamış denetim bulgusu bu tabloya girer. Denetim dosyaları arşivdir,
> takip yüzeyi değil.

| Ne | Nereye bağlı |
|---|---|
| **`charge_session` paketli öğrenciyi tanımıyor — çift faturalama** (`DENETIM-PARA > P1`) | **`/faz-06 §0a`** — ADR-044, o fazın ilk maddesi |
| **Makbuz numarası vazgeçilen tahsilatta atlıyor** (`DENETIM-PARA > P2`) | Ürün sahibinin cevabını bekliyor — `PRD §9 > S11` |
| `output/pdf/ornek-makbuz.pdf` depoya commit edilmiş (`DENETIM-PARA > P3`) | `/faz-06 §0b` — `.gitignore`'a `output/` |
| `search_students` komutu atıl (`student_list` aramayı da yapıyor) | Faz 10 (teslim öncesi tarama) |
| `DENETIM-FAZ1` **A ve B bölümleri taranmadı** (C bölümü tarandı ve kapandı) | Faz 10 (teslim öncesi tarama) |
| **Arşivlenen branş/öğretmen ekrandan geri alınamıyor.** `restore_*` komutları var, arşiv görünümü yok. Öğrencide var (E2), tanımlarda yok | Faz 10 (teslim öncesi tarama) |
| `student_note.teacher_id` hep `NULL` — notun yazarı ayırt edilmiyor | Faz 6 (notlar sekmesiyle) |
| Öğrenci detayında `Kayıtlar` sekmesi yok | Faz 6 (`Dersler` sekmesiyle) |
| Birebir şablonun düzenleme ekranı yok; tek yol "Tüm seri" ile kaldırmak | Faz 6, öğrenci detayı (ADR-028) |
| `npm audit` 12 "high" — hepsi eslint/vite geliştirme zinciri, pakete girmiyor | Faz 10 |
| `checkout@v4` / `setup-node@v4` Node 20 hedefliyor, GitHub Node 24'e zorluyor | Faz 10 |
| Gün değişince ekran kendiliğinden tazelenmiyor | ADR-029'da kabul edilen sınır — kapatılmayacak |

**Takvimden devreden maddeler borç değil, kapsam dışı** (ADR-034): sürükleme jestinin
ekranda doğrulanması, kenarda kaydırma, şeritlerin genişlemesi.
