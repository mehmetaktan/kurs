# Codex devri — `/faz-07 §5–§9`

Kararı ve sınırları **ADR-042**'de. Bu dosya devrin **uygulama yüzeyi**: Codex'e verilecek
prompt ve dönüşte neyin denetleneceği.

> ### ⚠️ Önkoşul — prompt bu satır yeşillenmeden verilmez
>
> **§1–§3 (tarife · paket/taksit satışı · vade tahakkuku) henüz yazılmadı.** §5 tahsilatı
> onların üstüne oturuyor: mahsup edilecek `installment` satırları §2'de doğuyor, defter
> yolu §3'te kuruluyor. Ayrıca `docs/DURUM.md`'ye §1–§3 oturumunun bırakacağı
> **"§5'in güvenebileceği yüzey" tablosu** gerekiyor — o tablo olmadan Codex kendi defter
> yolunu yazar, ki ADR-042'nin yasakladığı tam olarak budur.
>
> Sıra: bu akış `/faz-07` ile §1–§3'ü yazar ve `/kapat` çalıştırır → **sonra** aşağıdaki
> prompt Codex'e verilir.

## Codex'e verilecek prompt

```
Bu depoda /faz-07'nin §5–§9'unu yazacaksın: tahsilat alma, borçlu listesi, cari
ekstre, makbuz PDF ve öğrenci detayının para bölümü.

Başlamadan önce sırayla oku:
- AGENTS.md — kurallar, dokunulmayacak yollar ve kapı
- CLAUDE.md — projenin anayasası, tamamını oku
- docs/DURUM.md — nerede kalındı; "§5'in güvenebileceği yüzey" tablosu orada,
  defter satırını yazan fonksiyonların adları ve testleri o tabloda
- .claude/commands/faz-07.md — şartnamen. "Buradan aşağısı Codex'in" başlığının
  altındaki §5–§9 maddeleri ve §10'un test listesi
- docs/VERI-MODELI.md §3 ve §4 — defterin ve iptal/düzeltme akışlarının adım adım
  tabloları; satır satır oku
- docs/EKRANLAR.md — ekranların içeriği (sırası değil)
- docs/KARARLAR.md'de ADR-014, ADR-018, ADR-025, ADR-026, ADR-035, ADR-041, ADR-042

Kapsam §5, §6, §7, §8, §9 — bu kadar. §0–§4 yazıldı, üstüne yazma.

Migration yazma: §5–§9 şema değişikliği gerektirmiyor. payment,
payment_allocation, ledger_entry, installment tabloları ile v_student_debt,
v_installment_open, v_student_balance view'ları hazır; makbuz numarası tekilliği
ux_receipt kısmi UNIQUE indeksinde zaten zorlanıyor. Bir sütuna ihtiyacın olursa
dur ve sor.

ledger_entry'ye ikinci bir yazma yolu açma — src-tauri/src/repo/finance.rs'in
mevcut fonksiyonlarını çağır. İki yol iki bakiye demektir.

Sırayla çalış ve her bölümü ayrı commit et: §5 tahsilat → §6 borçlu listesi →
§7 cari ekstre → §8 makbuz PDF → §9 öğrenci detayı. Her commit'ten önce
`npm run check` yeşil olacak.

Para ile ilgili yazdığın her fonksiyonun testi olacak. §10'un listesinden sana
düşenler: kısmi / tam / fazla ödeme sonrası bakiye ve mahsup dağılımı; mahsup
ödemeyi aşmıyor; otomatik mahsup en eski vadeden başlıyor ve vadesi gelmemiş
taksitleri de kapsıyor; tahsilat iptali (ters kayıt + mahsup satırlarının
arşivlenmesi, payment.deleted_at boş kalıyor); makbuz numarası tekrarsız ve
atlamıyor; tutarın yazıyla Türkçe karşılığı (0, 1, 11, 100, 1001, 1.234.567 ve
kuruşlu tutarlar).

Bitince `npm run check` çıktısını ve örnek bir makbuz PDF'ini göster.
```

## Dönüşte denetlenecekler

Denetim ayrı bir oturum değil: **para fazı sonrasındaki zorunlu denetim** (ADR-033)
§1–§3 ile §5–§9'u birlikte okur. Diff'te özellikle bakılacaklar:

| Ne | Nasıl bakılır |
|---|---|
| İkinci defter yolu açılmış mı | `insert_ledger_entry` ve `insert_reversal` dışında `INSERT INTO ledger_entry` var mı |
| Kuruş aritmetiği | `f64`/`f32` grep'i; yuvarlama yapılan yer var mı |
| Mahsup toplamı ödemeyi aşıyor mu | K-9'un testi gerçekten sınırda mı, yoksa mutlu yolu mu deniyor |
| Makbuz numarası | rezervasyon modal **açılırken** mi yapılıyor (K-19), yoksa kaydederken mi |
| `payment.deleted_at` | iptal akışında dolduruluyor mu — **doldurulmamalı** |
| PDF Türkçe | gömülü font kanıtı: test mi, çıktı görseli mi |
| Arayüz iş bölümü | arama/filtre Rust'ta, çipler ve sıralama arayüzde, sayfalama `lib/paginate.ts` (ADR-025) |
| Metinler | `src/i18n/tr.ts`'te mi, JSX'te çıplak Türkçe kalmış mı |
| Kapsam taşması | `docs/**`, `.claude/**`, `migrations/**`, `pages/takvim/**` diff'te görünüyor mu |
