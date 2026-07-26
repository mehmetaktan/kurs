# Kullanılabilirlik listesi

Hiçbir faz "kullanılabilirlik"i sahiplenmiyordu ve ürün sahibinin şikâyeti haklı çıktı
(2026-07-26). Bu dosya o boşluğu kapatıyor: **her kod oturumu bu listenin en üstündeki
maddelerle başlar (§0)**, ayrı bir kullanılabilirlik oturumu açılmaz.

Kural: madde **davranışla** yazılır ("uzun listede arayarak seçebilmeli"), tasarım
tarifiyle değil. Yapılan madde silinmez, ✅ işaretlenir — hangi oturumda kapandığı yazılır.

> **Bu dosya `docs/YOL-HARITASI.md` ile birlikte sıralamanın kaynağıdır — ADR-039.**
> `docs/EKRANLAR.md` değil: envanterde her ekran bir satır, oysa burada satırlar
> *"programı kullanamıyorum"* ile *"daha güzel görünürdü"* arasında ayrılır.

## Sıradaki oturumda

> Şu an açık madde yok. Ürün sahibinin yazacağı satırlar bir sonraki kod oturumunun
> §0'ı olur.

## Ürün sahibinin ekleyeceği maddeler

> Buraya sen yaz — tek satır yeter, "şu ekranda şunu yapmak zor" biçiminde. Bir sonraki kod
> oturumu §0'da bunlarla başlar. Sıralama önemli: en üsttekiler önce yapılır.

- …

## Kapananlar

| # | Madde | Nerede kapandı |
|---|---|---|
| K1 | **Seçim listelerinde arama.** `Select` düpedüz yerel `<select>`ti; uzun listede tek harf atlamasından başka yol yoktu | ✅ `/faz-07 §0e` (2026-07-26). `src/ui/SearchSelect.tsx` — yaz-filtrele, ok tuşları, `Enter`/`Esc`, **Türkçe eşleşme** (`normalizeTr`; `ingilizce` → `İngilizce`). 12 testi var. `SessionForm`'un öğrenci/grup alanı buna geçti; branş, öğretmen ve ödeme yöntemi gibi **kısa listeler `Select` kaldı** — orada yerel `<select>` doğru olan |
| K2 | **Kurs sahibi kendi öğretmenlerini ve çalışma düzenini programa giremiyor.** Öğretmenin adı migration'dan gelen `'Öğretmen'`; çalışma saatleri, ders süresi ve devamsızlık politikası sabit | ✅ `/faz-07 §0a`–`§0d` (2026-07-26), **ADR-037**. `Tanımlar → Öğretmenler` (ekle/düzenle/arşivle, pasif ayrı), `Tanımlar → Genel` (11 işletme ayarı, ikisi para politikası), takvimde öğretmen filtre ekseni ve meta satırı (ADR-038), K-1 çakışma uyarısı `teacher_id`'ye daraldı (`DENETIM-FAZ1 > C5` kapandı) |
