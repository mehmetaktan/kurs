---
description: Faz 3 — Tasarım token'ları, komponent kütüphanesi, uygulama kabuğu
---

# Faz 3 — Tasarım Sistemi & Uygulama Kabuğu

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/TASARIM-SISTEMI.md`, `docs/EKRANLAR.md`,
`design-ref/` altındaki tasarım dosyaları.

**Önce plan modunda çalış.** Planı onaylatmadan kod yazma.

---

## 0. Önce: defter view'ı düzeltilir (ADR-022) — devir borcu

Faz 2'den devredilen tek açık iş. **Arayüze başlamadan önce bitir**; borçlu listesini okuyan
ilk ekran yazılmadan şema doğru olmalı.

`src-tauri/migrations/002_ledger_effective_parity.sql`:

```sql
DROP VIEW v_ledger_effective;
CREATE VIEW v_ledger_effective AS
WITH RECURSIVE chain(head_id, cur_id, depth) AS (
  SELECT l.id, l.id, 0 FROM ledger_entry l
  WHERE l.deleted_at IS NULL AND l.kind <> 'reversal'
  UNION ALL
  SELECT c.head_id, r.id, c.depth + 1
  FROM chain c
  JOIN ledger_entry r ON r.reverses_id = c.cur_id AND r.deleted_at IS NULL
),
depth_of AS (SELECT head_id, MAX(depth) AS n FROM chain GROUP BY head_id)
SELECT l.* FROM ledger_entry l
JOIN depth_of d ON d.head_id = l.id
WHERE d.n % 2 = 0;
```

`001_initial.sql` **elle düzeltilmez** — checksum mührü bunun için var. `v_open_charge` ve
`v_student_debt` yeniden yazılmaz; SQLite view referanslarını sorgu anında çözer.
`docs/VERI-MODELI.md §1.23` bu tanımı zaten içeriyor — belge ile DDL birebir aynı olmalı.

Testler:

1. `views.rs` içindeki `bilinen_acik_karar_ters_kaydin_tersi_bakiye_ile_borcu_ayristirir`
   testi **artık geçerli değil** — adı ve iddiası tersine çevrilir: üç adımlık zincirden sonra
   borçlu listesi 250 ₺ göstermeli.
2. Yeni test — **tahsilat iptalinin geri alınması**: tahsilat → ters kayıt → ters kaydın tersi
   yazıldığında öğrenci borçlu listesinde **çıkmamalı** (eski tanımda yanlışlıkla çıkıyordu).
3. Yeni test — **şema değişmezi** (`VERI-MODELI.md §6`): her senaryo kurulumunun sonunda
   `SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus`. Bu testi seed verisinin
   üzerinde de çalıştır.
4. Zincir uzunluğu 4'te bakiye ve borç yeniden sıfıra dönmeli.

`package_usage` tarafındaki düzeltme zinciri **bu fazın işi değil** — ADR-022 kapsam dışı
bıraktı; kararı 2026-07-26'da **ADR-036** verdi (aynı modelin ikizi), uygulaması
`/faz-07 §4`.

---

## 1. Token'lar

Tasarım token'larını tek kaynakta topla (CSS değişkenleri veya tema dosyası).
Bileşen dosyalarında hardcoded hex veya px bulunmayacak.

## 2. Komponentler

Tasarımda tespit edilenler + şunlar (tasarımda yoksa aynı görsel dile uygun üret):

`Button` `Input` `Select` `Textarea` `Checkbox` `DatePicker` `TimePicker`
`Table` `Modal` `Drawer` `Card` `Badge` `Tabs` `Toast` `ConfirmDialog`
`EmptyState` `LoadingState` `ErrorState` `Pagination` `SearchInput`

Her komponent varyantlarıyla ve disabled/hata durumlarıyla birlikte.

## 3. Uygulama kabuğu

- Sol menü + üst bar + routing
- Menü öğeleri `docs/EKRANLAR.md`'den
- Sayfalar şimdilik boş placeholder olabilir
- Klavye ile tam gezinilebilir, görünür focus halkası

## 4. Türkçe altyapı — **sıfırdan değil, üzerine**

Faz 2 bu modüllerin çekirdeğini kurdu ve testledi; **yeniden yazma, genişlet.** Mevcut:

- `src/i18n/tr.ts` — metin sözlüğü (ADR-007)
- `src/lib/format.ts` — kuruş ↔ metin, Rust `money.rs` ile davranışı eşitlenmiş durumda
- `src/lib/sortTr.ts` — `Intl.Collator('tr')` (ADR-020)

Eklenecekler:
- Tarih: `25.07.2026`, saat `14:30`, gün adları Türkçe
- Telefon: `0 5XX XXX XX XX`

> **Kuruş fonksiyonlarının davranışı iki tarafta aynı kalmalı.** Faz 2 denetimi `parseKurus`
> ile `parse_kurus` arasında gerçek bir ayrışma buldu (`'1.2,3.4'` → Rust hata, TS `1234`).
> `format.ts`'e dokunan her değişiklikte Rust karşılığı ve bozuk girdi listesi birlikte güncellenir.

Yeni her fonksiyonun testi yazılır; `npm run check` vitest'i zaten koşuyor.

## 5. Showcase

`/dev/komponentler` adresinde tüm komponentleri tüm varyantlarıyla gösteren bir sayfa.
Bu sayfa proje boyunca referansımız olacak; her yeni komponent buraya eklenir.

Üretim derlemesinde bu rota yer almasın.

---

Bitince showcase sayfasının ve ana kabuğun ekran görüntüsünü göster, sonra `/kapat`.
