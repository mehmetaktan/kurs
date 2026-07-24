# Durum

**Son güncelleme:** 2026-07-25
**Mevcut faz:** Faz 1 tamamlandı → sırada **Faz 2**
**Sonraki oturumda ilk iş:** `/faz-02` (Tauri iskeleti, migration, seed, Windows CI)

---

## Bu oturumda tamamlananlar (Faz 1 — Plan)

### Tasarım okundu ve arşivlendi

- `design-ref/` altına 4 ekran olduğu gibi indirildi: `Bugun`, `Takvim`, `Öğrenciler`,
  `Öğrenci detayı`. **Sonraki oturumlar tekrar indirmez.**
- `design-ref/README.md` — dosyaların nasıl okunacağı (`sc-if`, `sc-for`, `data-props`)
- `support.js` ve `.thumbnail` **indirilmedi** (aşağıda, "bilinçli ertelenen")

### Yazılan belgeler

| Dosya | İçerik |
|---|---|
| `docs/VERI-MODELI.md` | 21 tablo + 3 view, tam DDL, trigger'lar, defter yürüyüşü, 3 senaryo SQL'i |
| `docs/PRD.md` | 5 rutin, 18 koruyucu kural, geri alınabilirlik tablosu, 10 açık soru |
| `docs/EKRANLAR.md` | 4 tasarlanmış ekranın envanteri + tasarlanacak 20 ekran |
| `docs/TASARIM-SISTEMI.md` | Renk, tipografi, aralık, yarıçap, gölge, ikon dili, 32 komponent |
| `docs/KARARLAR.md` | **ADR-011…ADR-017** eklendi |
| `docs/TASARIM-KAYNAGI.md` | Güncellendi — indirme durumu ve boşluk analizi `EKRANLAR.md`'ye taşındı |
| `docs/YOL-HARITASI.md` | Faz 1 ✅ |

### Alınan kararlar (hepsi KARARLAR.md'de kilitli)

| ADR | Karar |
|---|---|
| 011 | MVP tek öğretmenli, şema çok öğretmenli. Takvimde öğretmen filtresi ve Gün görünümü çoklu sütunu **kurulmaz** |
| 012 | Birebir + grup tek `session` tablosunda, dışlayıcı FK + türetilmiş `kind` |
| 013 | `group_member` yok — `enrollment` hem katılım aralığını hem tarifeyi taşır |
| 014 | Bakiye `SUM(amount)`, **negatif = borçlu**; defter append-only, trigger'la mühürlü |
| 015 | Paket deftere **taksit taksit, vadesi geldikçe** yansır; ders işlemek deftere yazmaz |
| 016 | Mazeretli affedilir (hak düşmez, borç yazılmaz, telafi hakkı doğar); mazeretsiz düşer |
| 017 | Tarih/saat yerel duvar saati metni; UTC yok (yaz saati programı kaydırmasın) |

### Tasarımdan çıkan, planda olmayan bulgular

1. **`teacher` tablosu eksikti** — tasarımın tamamı öğretmen kavramı üzerine kurulu
2. **Taksit sistemi var** (`2/4 ödendi`, "Mahsup edildiği taksit") → 2 yeni tablo
3. **Haftalık şablon ayrı varlık olmak zorunda** ("Bu ve sonraki dersler")
4. **Tatil/kapalı gün yönetimi var**, sürükle-bırak reddediyor
5. **Yedekleme durumu açılış ekranının verisi**, Faz 10 detayı değil
6. **Tasarım bakiye işaretinde kendi içinde çelişiyor** — ADR-014 ile çözüldü
7. **İkon seti yok** — her şey tipografik. Faz 3'te ikon kütüphanesi kurulmayacak
8. **Menüde "Raporlar" yok** — Faz 9'un nereye oturacağı açık (PRD S8)

---

## Yarım kalan / bilinçli ertelenen

| Ne | Neden |
|---|---|
| `design-ref/support.js` indirilmedi | Claude Design'ın kendi render motoru, bizim kodumuzun parçası değil. Yalnızca `.dc.html`'leri **tarayıcıda açmak** için gerekir. Faz 3'te gerekirse tek komutla alınır — komut `design-ref/README.md`'de yazılı. |
| `design-ref/.thumbnail` indirilmedi | Sadece önizleme görseli, bilgi taşımıyor |
| `CLAUDE.md > Komutlar` hâlâ boş | Faz 2'de `pnpm`/`cargo` komutları belirlenince doldurulacak |
| Takvimde öğretmen filtresi + Gün görünümü çoklu sütun | ADR-011 — tek öğretmen. Şema hazır, arayüz sadeleşti |
| Faz 1 taslak dosyası (scratchpad) | `docs/VERI-MODELI.md`'ye dönüştü, artık gerekmiyor |

---

## Açık sorular — cevabını senden bekliyorum

Hepsi `docs/PRD.md` §9'da, gerekçeleriyle. **Faz 2'yi bloklayan yok**; her birinin
varsayılan bir varsayımı var, ama ilgili faz başlamadan cevaplanmalı:

| # | Soru | Hangi faz |
|---|---|---|
| S1 | Şu an Excel/defter kullanıyor musun? (içe aktarma gerekir mi) | **Faz 4** |
| S2 | Grup kapasitesi aşımı engellensin mi, uyarı mı? | Faz 5 |
| S4 | Standart ders süresi kaç dakika? (tasarımda 60 ve 90 var) | Faz 5 |
| S3 | Paketlerin son kullanma tarihi var mı? | Faz 7 |
| S6 | Dönem ortasında ayrılanın kalan paket parası iade mi, alacak mı? | Faz 7 |
| S5 | Makbuz numarası otomatik mi artsın? | Faz 8 |
| S7 | "Devam oranı" hangi pencerede hesaplansın? | Faz 9 |
| S8 | Raporlar 7. menü öğesi mi olsun? | Faz 9 |
| S9 | Bilgisayarındaki Windows sürümü ne? | **Faz 10 öncesi** |
| S10 | Kod imzalama sertifikası alınacak mı? | Faz 10 |

**En acili S1.** Cevap "evet" ise Faz 4'ün kapsamı büyür ve bunu şimdiden bilmek gerekir.

---

## Bir sonraki oturumun (Faz 2) en büyük riski

**Windows CI'ın ilk kurulumu.** ADR-008 gereği GitHub Actions'ta Windows `.msi` üretilecek;
macOS'ta doğrulanamayan tek şey bu. Riskin üç ayağı:

1. **Rust toolchain + Tauri 2 sürüm uyuşmazlığı** — CI'da yerelden farklı sürüm çekilirse
   build yeşil görünüp çalışmayan bir `.msi` üretebilir. Sürümler `rust-toolchain.toml` ile
   sabitlenmeli.
2. **`app_data_dir` yolu** — veritabanı `%APPDATA%` altında olmalı, proje klasöründe değil.
   macOS'ta test edilirse fark edilmez; Windows'ta ilk çalıştırmada patlar.
3. **Migration'ların gerçekten çalışması** — `docs/VERI-MODELI.md`'deki şema 21 tablo,
   2 generated column, 4 trigger ve 3 view içeriyor. `GENERATED ALWAYS AS ... STORED` ve
   kısmi UNIQUE indeksler modern SQLite gerektiriyor; `rusqlite`'ın **bundled** özelliği
   açık olmalı, yoksa Windows'un sistem SQLite'ı bunları reddedebilir.

**Faz 2'nin çıktısı, GitHub Actions'tan indirilip Windows'ta açılan bir `.msi` olmadan
tamamlanmış sayılmaz.** "Build yeşil" yeterli değil.

İkincil risk: şema bu fazda gerçek SQL'e dönüşüyor. Buradan sonra tablo değişikliği
migration + veri taşıma demek — `docs/VERI-MODELI.md` §1'deki DDL birebir uygulanmalı,
"yolda düzeltiriz" denmemeli.
