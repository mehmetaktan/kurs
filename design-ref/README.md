# design-ref

Claude Design projesinden **olduğu gibi** indirilen tasarım dosyaları.
Bu klasör bir arşivdir — **elle düzenlenmez.** Kaynak değişirse yeniden indirilir.

| Dosya | Ekran | Durum |
|---|---|---|
| `Bugun.dc.html` | Bugün — açılış ekranı | ✅ indirildi |
| `Takvim.dc.html` | Takvim (hafta / gün) | ✅ indirildi |
| `Öğrenciler.dc.html` | Öğrenci listesi | ✅ indirildi |
| `Öğrenci detayı.dc.html` | Öğrenci detayı | ✅ indirildi |
| `support.js` | Claude Design çalışma zamanı (DCLogic, `sc-if`, `sc-for`) | ⬜ indirilmedi |
| `.thumbnail` | Önizleme görseli | ⬜ indirilmedi |

## `support.js` neden indirilmedi

Bizim yazacağımız kodun parçası değil — Claude Design'ın kendi render motoru.
`.dc.html` dosyalarını **tarayıcıda açıp görmek** istenirse gerekir; okumak için gerekmez.
İhtiyaç olursa (muhtemelen Faz 3'te) tek komutla alınır:

```
DesignSync method=get_file projectId=72c14fc2-ca95-4d98-a373-eee21c94e3af path="support.js"
```

## Dosyalar nasıl okunur

`.dc.html` dosyaları iki bölümden oluşur:

1. **Şablon** — `<x-dc>` içindeki HTML. Tüm stiller satır içi (`style="..."`).
   Tasarım token'ları buradan çıkarıldı → `docs/TASARIM-SISTEMI.md`
2. **Mantık** — sondaki `<script type="text/x-dc">` içindeki `class Component extends DCLogic`.
   `renderVals()` şablona veri üretir. **Örnek veri ve iş kuralları burada** —
   `docs/EKRANLAR.md` ve `docs/VERI-MODELI.md`'nin bir kısmı bu bloklardan çıkarıldı.

Özel etiketler: `sc-if` (koşullu), `sc-for` (liste), `style-hover` / `style-focus`
(pseudo-state), `helmet` (global stil). `data-props` özniteliği ekranın önizleme
varyantlarını tanımlar — **boş durum senaryoları burada gizli.**
