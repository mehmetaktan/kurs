# Kullanılabilirlik listesi

Hiçbir faz "kullanılabilirlik"i sahiplenmiyordu ve ürün sahibinin şikâyeti haklı çıktı
(2026-07-26). Bu dosya o boşluğu kapatıyor: **her kod oturumu bu listenin en üstündeki
maddelerle başlar (§0)**, ayrı bir kullanılabilirlik oturumu açılmaz.

Kural: madde **davranışla** yazılır ("uzun listede arayarak seçebilmeli"), tasarım
tarifiyle değil. Yapılan madde silinmez, ✅ işaretlenir — hangi oturumda kapandığı yazılır.

## Sıradaki oturumda (`/faz-07 §0`)

| # | Madde | Kanıt / neden |
|---|---|---|
| K1 | **Seçim listelerinde arama.** `src/ui/Field.tsx:206 > Select` düpedüz yerel `<select>`; uzun listede tek harf atlamasından başka yolu yok. 6 ekranda kullanılıyor, en acısı öğrenci/grup seçimi | Ürün sahibi: *"ne selectbox'larda arama var ne kullanılabilirlik iyi"*. Para fazı zaten uzun öğrenci listesinden seçim yapacak (tahsilat), o yüzden §0 |

## Ürün sahibinin ekleyeceği maddeler

> Buraya sen yaz — tek satır yeter, "şu ekranda şunu yapmak zor" biçiminde. Bir sonraki kod
> oturumu §0'da bunlarla başlar. Sıralama önemli: en üsttekiler önce yapılır.

- …

## Kapananlar

| # | Madde | Nerede |
|---|---|---|
| — | (henüz yok) | |
