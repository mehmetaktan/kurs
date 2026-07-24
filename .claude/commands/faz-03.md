---
description: Faz 3 — Tasarım token'ları, komponent kütüphanesi, uygulama kabuğu
---

# Faz 3 — Tasarım Sistemi & Uygulama Kabuğu

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/TASARIM-SISTEMI.md`, `docs/EKRANLAR.md`,
`design-ref/` altındaki tasarım dosyaları.

**Önce plan modunda çalış.** Planı onaylatmadan kod yazma.

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

## 4. Türkçe altyapı

**`src/i18n/tr.ts`** — tüm arayüz metinleri. JSX'te çıplak metin bırakma (ADR-007).

**`src/lib/format.ts`** — ve Rust karşılıkları:
- Para: `i64` kuruş → `1.234,56 ₺` ve tersi
- Tarih: `25.07.2026`, saat `14:30`, gün adları Türkçe
- Sıralama ve arama: `localeCompare('tr')`, `İ/ı` doğru çalışmalı
  (`"İzmir"` ve `"ışık"` testleri yaz)
- Telefon: `0 5XX XXX XX XX`

Bu modülün testlerini yaz — özellikle kuruş↔metin dönüşümü ve Türkçe sıralama.

## 5. Showcase

`/dev/komponentler` adresinde tüm komponentleri tüm varyantlarıyla gösteren bir sayfa.
Bu sayfa proje boyunca referansımız olacak; her yeni komponent buraya eklenir.

Üretim derlemesinde bu rota yer almasın.

---

Bitince showcase sayfasının ve ana kabuğun ekran görüntüsünü göster, sonra `/kapat`.
