# Tasarım Kaynağı

## Proje

| Alan | Değer |
|---|---|
| Ad | Özel ders kursu yönetim arayüzü |
| `projectId` | `72c14fc2-ca95-4d98-a373-eee21c94e3af` |
| Tip | `PROJECT_TYPE_PROJECT` (design system değil) |
| Paylaşım linki | https://claude.ai/design/p/72c14fc2-ca95-4d98-a373-eee21c94e3af |

## Nasıl okunur

`DesignSync` aracı bu projeyi doğrudan okuyabiliyor — **ayrı bir MCP sunucusu kurmaya gerek yok.**

```
DesignSync method=list_files  projectId=72c14fc2-ca95-4d98-a373-eee21c94e3af
DesignSync method=get_file    projectId=...  path="Takvim.dc.html"
```

Erişim yoksa oturumda bir kez `/design-login` çalıştırılır.

`get_file` dosya başına 256 KiB ile sınırlı. Dosyalar okununca `design-ref/` altına
olduğu gibi kaydedilir; sonraki oturumlar tekrar indirmez, yereldekini okur.

> `list_projects` bu projeyi **listelemez** — o metot yalnızca "design system" tipindeki
> projeleri döndürüyor. `projectId` doğrudan verildiğinde okuma çalışıyor. Bu normal,
> hata değil.

## Mevcut ekranlar

**Faz 1'de indirildi — tekrar indirmeye gerek yok, `design-ref/` altından okunur.**

| Dosya | Ekran | design-ref |
|---|---|---|
| `Bugun.dc.html` | Bugün — açılış ekranı | ✅ |
| `Takvim.dc.html` | Takvim | ✅ |
| `Öğrenciler.dc.html` | Öğrenci listesi | ✅ |
| `Öğrenci detayı.dc.html` | Öğrenci detayı | ✅ |
| `support.js` | Claude Design çalışma zamanı (DCLogic, `sc-if`, `sc-for`) | ⬜ gerekirse |
| `.thumbnail` | Önizleme görseli | ⬜ gerekmiyor |

`support.js` bizim kodumuzun parçası değil — yalnızca `.dc.html` dosyalarını tarayıcıda
**render etmek** için gerekir. Ayrıntı ve indirme komutu: `design-ref/README.md`.

## Faz 1'de tasarımdan çıkarılanlar

| Belge | İçerik |
|---|---|
| `docs/TASARIM-SISTEMI.md` | Renk, tipografi, aralık, yarıçap, gölge, ikon dili, 32 komponent |
| `docs/EKRANLAR.md` | 4 ekranın envanteri + tasarlanacak 20 ekran |

## Boşluk analizi

Tasarımda **4 ekran** var; MVP'de **20 ekran daha** gerekiyor. Tam liste ve her birinin
hangi komponentlerle kurulacağı: **`docs/EKRANLAR.md` → Bölüm 2.**

Bu ekranlar tasarlanırken `docs/TASARIM-SISTEMI.md`'deki token'lar ve Faz 3'te kurulan
komponentler kullanılır; yeni görsel dil icat edilmez.

> **Tasarımdan gelen bağlayıcı not.** `Öğrenci detayı.dc.html` içindeki HTML yorumu, özet
> şerit kolon oranlarının **Grup detayı** ekranında da aynen kullanılmasını şart koşuyor:
> `minmax(240px,1.5fr) minmax(190px,1fr) minmax(190px,1fr) minmax(200px,1.15fr)`, 14px boşluk.

> **Tasarımda olmayan, eklenmesi önerilen:** menüde **Raporlar** öğesi (Faz 9). Tasarımın
> kenar çubuğunda 6 öğe var, Raporlar yok. Karar `docs/PRD.md` S8'de bekliyor.
