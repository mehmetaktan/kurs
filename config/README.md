# config/

Müşteriye özel değerler. **Teslim öncesi düzenlenir, sonra yeniden derlenir** (ADR-024).

| Dosya | İçerik |
|---|---|
| `kurum.json` | Kurum adı ve makbuz başlığı bilgileri |

`kurum.json` **derleme zamanı** iki tarafa birden gömülür:

- TypeScript → `src/config/brand.ts` (Vite JSON import'u)
- Rust → `src-tauri/src/brand.rs` (`include_str!`)

Çalışma anında dosya okuması **yoktur**. Gerekçe ADR-024'te: çalışma anında okunan bir
config dosyası Windows'ta bir dosya yolu, bir kodlama, bir "kullanıcı dosyayı sildi" ve
bir "OneDrive senkronize etti" arıza sınıfı açardı.

## Alanlar

| Alan | Zorunlu | Nerede görünür |
|---|---|---|
| `institutionName` | evet, boş olamaz | Kenar çubuğunun 2. satırı, makbuz başlığı (PRD R4.11) |
| `receipt.address` | hayır | Makbuz — **boşsa basılmaz** |
| `receipt.phone` | hayır | Makbuz — **boşsa basılmaz** |

Bu dosya **ürün adını taşımaz.** `Kurs Takip`, `Aktansoft` ve `com.aktansoft.kurstakip`
Aktansoft'undur ve sabittir; değişkene bağlanmaz.

## Değiştirdikten sonra

```
npm run check      # kurum adının boş olmadığını doğrulayan testler burada
npm run build      # yeni .msi
```
