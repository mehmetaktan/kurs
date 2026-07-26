# Durum

**Son güncelleme:** 2026-07-26 · yönetici oturumu — para fazının kalanı Codex'e devredildi (ADR-042)
**Sıradaki iş:** **Codex** `/faz-07` §1–§10'u yazar (`docs/CODEX-DEVIR.md`'deki prompt);
Claude Code'un işi dönüşteki **para fazı denetimi**
**Kalan plan:** `/faz-07` (para, Codex'te) → `/faz-06` (yoklama) → `/faz-10` (teslim)

> Bu dosya **son durumu** tutar, oturum arşivi değildir. Geçmiş `git log`'da, gerekçeler
> `docs/KARARLAR.md`'de.

---

## Nerede duruyoruz

`npm run check` yeşil: **536 test** (320 TypeScript + 216 Rust) + typecheck + ESLint +
clippy + rustfmt + paket denetimi.

| Çalışıyor | Nerede |
|---|---|
| Öğrenci & veli · branş · tatil · gruplar | `pages/ogrenciler/` · `pages/gruplar/` · `pages/tanimlar/` |
| Seans üretim motoru — ufka kadar, idempotent, açılışta | `repo/schedule.rs` · `repo/ops.rs` |
| Bugün ekranı, ders ekle/düzenle, ertele/iptal/sil, şablon | `pages/bugun/` · `pages/dersler/` |
| Takvim — ay/hafta/gün, sürükle-bırak (**donduruldu**, ADR-034) | `pages/takvim/` |
| **Öğretmenler ve işletme ayarları** (bu oturum) | `pages/tanimlar/TeachersTab · GeneralTab` |
| **Ders hakkı sayacı** — zincir modeli + tüketim fonksiyonu (bu oturum) | `migrations/003_*` · `repo/finance.rs` |

---

## Bu oturumda ne bitti

**§0 — kurs sahibi kendi programını tanımlayabiliyor** (ADR-037/038, `KULLANILABILIRLIK`
K1 ve K2 ✅):

- `Tanımlar → Öğretmenler` — ekle/düzenle/arşivle. Migration'ın `'Öğretmen'` satırı artık
  düzenlenebilir. **Tek adayı otomatik seçen satır kaldırıldı**; öğretmen gerçek bir seçim.
  `is_active` ile arşiv ayrı: pasif listede kalır, seçim kutularında çıkmaz.
- `Tanımlar → Genel` — 11 işletme ayarı, anında kayıt. Yazan komut **beyaz listeden**
  geçiyor (`EDITABLE_KEYS`); programın kendi üç satırı ekranda da yok, komutta da yazılamaz.
  İki devamsızlık satırı ADR-016'nın para politikası ve para fazının girdisi.
- **K-1 çakışma uyarısı `teacher_id`'ye daraldı** — `DENETIM-FAZ1 > C5` **kapandı** (üç faz
  boyunca açıktı). Aynı öğretmen çakışır, farklı öğretmen çakışmaz, öğretmensiz seans uyarı
  üretmez.
- Takvime öğretmen filtre ekseni + ders bloğunda öğretmen adı (ADR-038'in dar istisnası).
  **Gün görünümü tek sütun kaldı**, geometriye dokunulmadı.
- `src/ui/SearchSelect.tsx` — Türkçe eşleşen aranabilir seçim (**ADR-041**). `Select`
  bozulmadan kaldı; hangisinin nerede kullanılacağı ADR'de tabloya bağlandı.
- 13 ADR-011 atfının hepsi temizlendi.

**§4'ün kapısı — ADR-036 uygulandı:**

- `003_package_usage_reversal_chain.sql`: `reverses_id`, `ux_pkgusage_att` kalktı,
  `ux_pkgusage_head` + `ux_pkgusage_reverses` geldi, üç tetikleyici.
- **Kanıt şartı yeşil** — yedi dizinin hepsi, `Geldi → Mazeretli → Geldi` dahil (eski
  şemada bu satır *yazılamıyordu*). `v_package_remaining` yeniden yazılmadı, gerekmedi.
- Migration **gerçek geliştirme veritabanının kopyasına da uygulandı** (11 mevcut satır):
  indeksler kuruldu, kalan haklar değişmedi. Fresh in-memory testi bu riski göstermezdi.
- `consume_package_credit(attendance_id, today)` + `restore_package_credit` yazıldı ve
  testlendi — **ADR-040**. İmza `/faz-06` için sabit; ekran bağlantısı yapılmadı.

---

## Para fazının kalanı Codex'te — ADR-042

`/faz-07`'nin **§1'den §10'a** kadarı dış bir kodlama ajanına verildi: fiyat tarifesi ·
paket/taksit satışı · deftere yansıma · tahsilat · borçlu listesi · cari ekstre · makbuz
PDF · öğrenci detayının para bölümü. Sebep kapasite değil, **aracın gerçek bir iş
üzerinde denenmesi** — bu yüzden faz bölünmedi, araya oturum sokulmadı.

Çalışma dalı `main`. Sınırlar: migration yok, `docs/**` ve ADR yok, takvim yok
(ADR-034), `ledger_entry`'ye ikinci yazma yolu yok. Prompt ve dönüşteki denetim listesi
**`docs/CODEX-DEVIR.md`**'de; kurallar ayrıca kökteki **`AGENTS.md`**'de (Codex
`CLAUDE.md`'yi kendiliğinden okumaz).

**Claude Code'un bu fazdaki işi:** Codex tıkanır veya bir kararı zorlarsa yönetici
oturumunda cevaplamak, ve faz bitince **para fazı denetimini** yapmak — ADR-033'ün
plandaki tek zorunlu denetimi, artık `/faz-07`'nin tamamını kapsıyor.

§0 ve §4 **bitti**, Codex'in kapsamı dışında. §4'ün kalan tek işi Faz 6'nın
`consume_package_credit`'i çağırması.

### Sahiplik kontrolü (ADR-039)

*Bugün kurs sahibi ne yapabiliyor?* Öğrencisini, grubunu, **öğretmenlerini ve çalışma
düzenini** tanımlıyor; dersini planlıyor, taşıyor, iptal ediyor; takvimi öğretmene göre
süzüyor.

*Yapamadığı ne?* **Para takibi** (bu fazın kalanı), yoklama (Faz 6), yedekleme ve özet
ekranı (Faz 10). Üçü de plandaki bir faza ait — **plan eksik değil.**

### Bu fazın en büyük riski

**Para mantığının testini kısmak.** Kalan iş iki fazın birleşimi ve projenin en pahalı
yanlış olan yeri: defter, tahakkuk, mahsup. Risk "yetişmez" değil, *yetiştirmeye çalışıp
testi ertelemek*. Testsiz fonksiyon bırakılmaz (`CLAUDE.md > Para`).

İkinci risk: **§2'nin ADR-035 dalları.** Paket kapatmanın iki yolu (avans bırak / iade et)
`ledger_entry`'ye append-only satır yazıyor ve kalan tutar paketin `unit_price`
**snapshot'ından** hesaplanıyor — indirim yeniden hesaplanmaz. Bu satır yanlış yazılırsa
hata her ekstrede çoğalır.

**Devre özgü üçüncü risk: tek yığın commit.** `main` üzerinde çalışılıyor, geri alma yolu
`git revert`. Bölümler ayrı commit'lenmezse denetimde çıkan bir hata için tek seçenek
fazın tamamını geri almak olur. Prompt bunu yazıyor; denetimde ilk bakılacaklardan biri.

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
| Bugün ekranının yan panelinde borç bölümü "yakında" diyor | `/faz-07 §9` (bu faz, §5 dikişinden sonra) |
| Öğrenciler listesinin son kolonu `Aç` — tasarımda `Tahsilat al` | `/faz-07 §9` (aynı yer) |
| `search_students` komutu atıl (`student_list` aramayı da yapıyor) | Para fazında kullanılmazsa kaldırılır |
| `DENETIM-FAZ1` **A ve B bölümleri taranmadı** (C bölümü tarandı ve kapandı) | Para fazı denetimi — yalnızca doğrulama, kod değil |
| **Arşivlenen branş/öğretmen ekrandan geri alınamıyor.** `restore_*` komutları var, arşiv görünümü yok. Öğrencide var (E2), tanımlarda yok | Faz 10 (teslim öncesi tarama) |
| `student_note.teacher_id` hep `NULL` — notun yazarı ayırt edilmiyor | Faz 6 (notlar sekmesiyle) |
| Öğrenci detayında `Kayıtlar` sekmesi yok | Faz 6 (`Dersler` sekmesiyle) |
| Birebir şablonun düzenleme ekranı yok; tek yol "Tüm seri" ile kaldırmak | Faz 6, öğrenci detayı (ADR-028) |
| `npm audit` 12 "high" — hepsi eslint/vite geliştirme zinciri, pakete girmiyor | Faz 10 |
| `checkout@v4` / `setup-node@v4` Node 20 hedefliyor, GitHub Node 24'e zorluyor | Faz 10 |
| Gün değişince ekran kendiliğinden tazelenmiyor | ADR-029'da kabul edilen sınır — kapatılmayacak |

**Takvimden devreden maddeler borç değil, kapsam dışı** (ADR-034): sürükleme jestinin
ekranda doğrulanması, kenarda kaydırma, şeritlerin genişlemesi.
