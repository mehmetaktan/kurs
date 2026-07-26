# Durum

**Son güncelleme:** 2026-07-26 · yönetici oturumu — para fazının ikinci dikişi Codex'e devredildi (ADR-042)
**Sıradaki iş:** `/faz-07` **aynı komutla devam** — §1 fiyat tarifesi, **§3'te dur**
**Kalan plan:** `/faz-07` (para, sürüyor) → `/faz-06` (yoklama) → `/faz-10` (teslim)

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

## Sıradaki oturum — `/faz-07` (aynı komut), kapsam **§1–§3**

Sıra: **§1 fiyat tarifesi** → §2 paket/taksit satışı (ADR-035 kapatma dalları) →
§3 vade tahakkuku (`accrue_due_installments` → `ops.rs > on_startup`) → **dur, `/kapat`**.

§4 **bitti**: migration, kanıt testleri ve tüketim fonksiyonu yazıldı. Kalan tek işi
Faz 6'nın onu çağırması.

### İkinci dikiş Codex'te — ADR-042

**§5–§9** (tahsilat · borçlu listesi · cari ekstre · makbuz PDF · öğrenci detayının para
bölümü) dış bir kodlama ajanına verildi. Sebep kapasite değil, **aracın gerçek bir iş
üzerinde denenmesi**; dilim öyle seçildi ki defterin *temeli* (§1–§3) bu akışta kalsın.
Çalışma dalı `main`, karşılığında commit'ler bölümlü (§5 · §6 · §7 · §8 ayrı).
Sınırlar — migration yok, `docs/**` ve ADR yok, takvim yok, ikinci defter yolu yok —
ADR-042'de ve `/faz-07`'nin §5 başlığının üstünde.

**§1–§3 oturumunun devir borcu:** bittiğinde buraya *§5'in güvenebileceği yüzey* tablosu
yazılır — fonksiyon/komut adı → ne yapar → testi nerede. Codex'in okuyacağı devir notu o
tablodur; olmadan tahsilat kendi defter yolunu yazar.

Denetim ayrıca açılmıyor: para fazı sonrasındaki **zorunlu denetim** (ADR-033) §1–§3 ile
§5–§9'u birlikte okuyacak.

### Sahiplik kontrolü (ADR-039)

*Bugün kurs sahibi ne yapabiliyor?* Öğrencisini, grubunu, **öğretmenlerini ve çalışma
düzenini** tanımlıyor; dersini planlıyor, taşıyor, iptal ediyor; takvimi öğretmene göre
süzüyor.

*Yapamadığı ne?* **Para takibi** (bu fazın kalanı), yoklama (Faz 6), yedekleme ve özet
ekranı (Faz 10). Üçü de plandaki bir faza ait — **plan eksik değil.**

### Bu oturumun en büyük riski

**Para mantığının testini kısmak.** Kalan iş iki fazın birleşimi ve projenin en pahalı
yanlış olan yeri: defter, tahakkuk, mahsup. Risk "yetişmez" değil, *yetiştirmeye çalışıp
testi ertelemek*. Dikişten bölünmek serbest, testi ertelemek değil (`CLAUDE.md > Para`).

İkinci risk: **§2'nin ADR-035 dalları.** Paket kapatmanın iki yolu (avans bırak / iade et)
`ledger_entry`'ye append-only satır yazıyor ve kalan tutar paketin `unit_price`
**snapshot'ından** hesaplanıyor — indirim yeniden hesaplanmaz. Bu satır yanlış yazılırsa
hata her ekstrede çoğalır.

Tıkanınca uydurma yok: buraya yaz ve **tek soruyla** sor (ADR-033).

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
