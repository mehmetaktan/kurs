# AGENTS.md — dış kodlama ajanları için

Bu depo bir Tauri 2 + React + TypeScript + SQLite (rusqlite) masaüstü uygulamasıdır:
küçük bir özel ders kursu için öğrenci, ders ve **tahsilat** takibi. Tek kullanıcı, tek
bilgisayar, internet yok. Kullanıcı **teknik değil ve Windows kullanıyor**; geliştirme
macOS'ta yapılıyor.

## Önce oku — sırayla

1. **`CLAUDE.md`** — bu projenin anayasası. Değişmez kurallar, klasör haritası, hangi işin
   hangi katmanda olduğu orada. **Tamamını oku, atlama.**
2. **`docs/DURUM.md`** — nerede kalındığı ve senden önceki oturumun bıraktığı yüzey.
3. **Sana verilen görev dosyası** — `.claude/commands/faz-NN.md`. Slash komutu olarak
   çalıştırılamaz, ama içeriği senin şartnamendir; kapsamın orada madde madde yazılı.
4. `docs/KARARLAR.md` — görev dosyasının atıf yaptığı ADR'ler. **Kilitli kararlar
   tartışılmaz, uygulanır.**

## Değişmez kurallar — ihlali geri çevrilir

- **Para kuruş cinsinden `i64`. Float yasak.** Bakiye saklanmaz, `ledger_entry`
  toplamından hesaplanır. Fiyat değişimi geçmişi bozmaz: ücret snapshot'ı yazılır.
  **Para ile ilgili her fonksiyonun testi olur — pazarlık konusu değil.**
- **Frontend SQL yazmaz.** Veri erişimi `#[tauri::command]` + `src-tauri/src/repo/` üzerinden.
- **Hard delete yok.** `deleted_at` ile soft delete; kullanıcıya "Arşivle" denir.
- **Şema yalnızca sıralı migration dosyalarıyla değişir.** Sana kapsamında "migration
  yazma" dendiyse yazma: bir sütuna ihtiyaç duyarsan **dur ve sor.**
- **Arayüz metinlerinin tamamı `src/i18n/tr.ts`'te.** JSX'te çıplak Türkçe metin yok.
  Kod, tablo, dosya ve değişken adları İngilizce; yorumlar Türkçe.
- **"Şimdi" tek kaynaktan gelir:** `local_now` komutu. SQL'de çıplak `'now'` yok, arayüzde
  ekrana giden `new Date()` yok (ADR-029). Tarih/saat yerel duvar saati metnidir.
- **Windows'a teslim ediliyor:** dosya yolu string birleştirmeyle kurulmaz (Tauri path
  API), import'larda büyük/küçük harf tam eşleşir (macOS affeder, CI affetmez), her yerde
  UTF-8, CSV çıktısına BOM, **PDF'te Türkçe için gömülü font zorunlu** (varsayılan PDF
  fontlarında `ğ ş İ ı` yok), sistem font stack. Platforma özel API kullanma.
- **Kullanıcı teknik değil:** hata mesajları Türkçe ve **eylem önerir**, ham hata kodu
  gösterilmez. Her yıkıcı işlemde onay, her başarılı işlemde bildirim, her listede
  boş/yükleniyor/hata durumu.
- Türkçe sıralama ve arama `lib/sortTr.ts` ve `lib/format.ts > normalizeTr` ile yapılır.
  **`toLocale*` kullanma** — Windows'ta ICU verisi güvenilmez.

## Dokunma

| Yol | Neden |
|---|---|
| `docs/**` · `.claude/**` | Plan, ADR ve durum belgeleri proje yöneticisinde. **ADR yazma, plan değiştirme.** |
| `src-tauri/migrations/**` | Şema kapalı; değişiklik ayrı bir kararla gelir |
| `src/pages/takvim/**` | Takvim ekranı donduruldu (ADR-034) |
| `src/dev/**` | Üretime girmeyen vitrin; metinleri kendi sözlüğünde |

Bir kural sana yanlış geliyorsa **kendi kafana göre çözme**: dur, ne bulduğunu yaz ve sor.

## Kapı

```
npm run check      # typecheck + ESLint + clippy + rustfmt + testler + paket denetimi
```

**Her commit'ten önce yeşil olmalı.** Alt komutlar: `npm test` · `npm run test:web` ·
`npm run test:rust` · `npm run fmt` (Rust biçimleme; `check` yalnızca denetler).

`cargo` PATH'te olmayabilir — gerekirse `~/.cargo/bin`'i kendin ekle.

Commit'ler **küçük ve bölümlü** olsun (görev dosyasının her bölümü ayrı commit): bu
depoda geri alma yolu `git revert` ve bir bölüm geri alınırken ötekiler ayakta kalmalı.
