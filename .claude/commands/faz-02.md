---
description: Faz 2 — Tauri iskeleti, SQLite şeması, migration, seed, Windows CI
---

# Faz 2 — İskelet & CI

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/KARARLAR.md`, `docs/PRD.md`.

> `docs/VERI-MODELI.md` Faz 1 denetiminden sonra **düzeltildi** (bkz. `docs/DENETIM-FAZ1.md`).
> DDL'i birebir uygula; "yolda düzeltiriz" deme. Özellikle `§0`'daki **`'now'` kuralı**,
> `§1.19`'daki defter mühürleri ve `§1.23`'teki view zinciri denetim sonucudur.

Bu fazda ekran yok. Çıktı: **çalışan bir iskelet + indirilebilir Windows kurulum dosyası.**

---

## 1. Proje kurulumu

Tauri 2 + React + TypeScript + Vite. Klasör yapısını kurduktan sonra `CLAUDE.md`'ye
ekle ki sonraki oturumlar bilsin.

- **`rust-toolchain.toml`** ile Rust sürümü sabitlenir; CI aynı dosyayı kullanır.
  Tauri CLI sürümü `package.json`'da tam sürümle (caret'siz) kilitlenir.
  Gerekçe: CI yerelden farklı sürüm çekerse build yeşil görünüp çalışmayan `.msi` üretir.
- **`.gitattributes`** yazılır: `*.sql text eol=lf` (en azından).
  Gerekçe: `schema_migration.checksum` migration dosyasının SHA-256'sı. Windows CI checkout'unda
  dosya CRLF'e çevrilirse checksum tutmaz ve uygulama açılışta "migration değiştirilmiş" hatası
  verir — hata macOS'ta **hiç görünmez**.

## 2. Veritabanı

- `rusqlite`, **`features = ["bundled"]`** ile kurulur — sistem SQLite'ına bağlanılmaz.
  Şema `GENERATED ALWAYS AS ... STORED` kullanıyor (**SQLite 3.31+**), ayrıca kısmi indeks ve
  pencere fonksiyonu var. Windows'un sistem kütüphanesi bunları reddedebilir.
- Açılışta `sqlite_version()` loglansın — sürüm sorunu sessizce geçmesin.
- Veritabanı **`app_data_dir` altında** — proje klasöründe değil (ADR-008)
- Uygulama ilk açılışta veritabanı yoksa oluştursun
- WAL modu aç, `foreign_keys = ON`

> **WAL'ın bedeli var:** `.db` dosyasını kopyalayan yedek boş çıkar. **ADR-019** yedeklemeyi
> `VACUUM INTO` olarak tanımladı. Faz 2'de yedekleme yazılmıyor ama bu kararı bilerek WAL aç.

## 3. Migration sistemi

- Sıralı `.sql` dosyaları: `migrations/001_initial.sql`, `002_…`
- Uygulanmışları takip eden `schema_migration` tablosu
- Uygulama açılışta bekleyen migration'ları çalıştırsın
- `docs/VERI-MODELI.md`'deki şemayı `001_initial.sql` olarak yaz
- **`001_initial.sql` şemadan sonra başlangıç verisini de yazar** (seed değil — üretimde de
  gerekli, `VERI-MODELI.md §2` sonu):
  - `§1.2` tablosundaki 14 `setting` varsayılanı
  - tek satırlık `teacher` (ADR-011). Bu satır seed'e konursa kurs sahibinin gerçek
    makinesinde `teacher` tablosu **sonsuza kadar boş kalır**.

## 4. Repository katmanı

- Her tablo için Rust'ta tipli CRUD fonksiyonları
- Frontend'e açılan `#[tauri::command]` fonksiyonları **ince** olsun; iş mantığı repository'de
- Hata tipi tek yerde tanımlansın ve frontend'e Türkçe mesaj + makine-okur kod olarak dönsün
  (kullanıcı ham SQLite hatası görmeyecek — `CLAUDE.md` > Arayüz)

## 5. Testler

Rust tarafında in-memory SQLite ile, **gerçek migration'lar uygulanarak** en az:
- Bir insert + geri okuma
- Soft delete sonrası kaydın listelerde görünmemesi, arşivde görünmesi
- `ledger_entry` toplamından bakiye hesabı

Şemanın mühürleri gerçekten çalışıyor mu — **her biri hata vermeli**:
- `UPDATE ledger_entry SET amount = …` → `ledger_entry_is_immutable`
- `UPDATE ledger_entry SET deleted_at = …` → aynı hata (denetimde açık olan delik buydu)
- `INSERT INTO ledger_entry (… deleted_at) VALUES (…, '2026-01-01')` → `CHECK` ihlali
- `DELETE FROM ledger_entry` → `ledger_entry_is_immutable`
- Aynı satır için ikinci `reversal` → `ux_ledger_reverses` ihlali
- Tutarı yanlış `reversal` → `reversal_amount_mismatch`
- Kayıt aralığı dışında `attendance` → `attendance_outside_enrollment`

Ve `§1.23` view zinciri (ADR-018) — bu testler Faz 8'i değil **Faz 2'yi** bağlar:
- Ders başı borcu olan öğrenci `v_student_debt`'te **çıkar** (eski view'da çıkmıyordu)
- Ters kaydedilmiş borç çıkmaz; avanslı öğrenci borçlu görünmez
- Arşivlenmiş öğrencinin bakiyesi `v_student_balance`'ta kaybolmaz (`is_live = 0`)
- FIFO vade: 4×250 borç + 600 ödeme → borç 400, en eski vade **3. dersin günü**

## 6. Seed

Tek komutla yüklenen gerçekçi Türkçe demo verisi:
- 12 öğrenci, gerçekçi Türkçe isimler, bazılarının 2 velisi, bazı kardeşler
- 3 branş, 2 grup
- Bir aylık geçmiş + iki haftalık gelecek seans
- Kısmi ödemeler, bir borçlu, bir alacaklı öğrenci

Seed **sadece geliştirmede** çalışsın; üretim derlemesine girmesin.
`setting` varsayılanları ve `teacher` satırı seed'e **girmez** — onlar §3'teki başlangıç verisi.

Seed'e denetimden çıkan kenar durumlar da girsin, sonraki fazlar bunlarla test edecek:
avanslı bir öğrenci (mahsup edilmemiş fazla ödeme), ters kaydedilmiş bir ders, arşivlenmiş
ama borçlu bir öğrenci, iki aktif paketi olan bir öğrenci.

## 7. Script'ler

`package.json`'a: `dev`, `build`, `check` (lint + typecheck + test), `test`, `seed`.
Rust tarafı için de karşılıklarını ekle. Hepsini `CLAUDE.md` > Komutlar'a yaz.

## 8. GitHub Actions — **bu fazın en kritik parçası**

- Push'ta Windows `.msi` derlensin, artifact olarak yüklensin
- macOS build'i de ekle ama Windows öncelikli
- `check` adımı da CI'da koşsun
- Derleme süresini kısaltmak için cache kur
- **Rust testleri `windows-latest` üzerinde de koşsun.** Bu maddenin gerekçesi ayrı ve önemli:
  testler gerçek migration'ları uyguladığı için, `windows-latest`'te geçen bir test **şemanın
  Windows'ta kurulduğunun kanıtıdır** — kimsenin Windows makinesine dokunmasına gerek kalmadan.
  `bundled` özelliği unutulmuşsa ya da SQLite sürümü yetersizse hata **burada** çıkar,
  Faz 5'te kurs sahibinin bilgisayarında değil.

Bittiğinde bana **adım adım** anlat: GitHub deposunu nasıl bağlarım, ilk build'i
nasıl tetiklerim, `.msi`'yi nereden indiririm.

## 9. Doğrulama — fazın kabul kriteri

Üçü birden sağlanmadan bu faz kapanmaz:

1. Uygulama macOS'ta açılıyor: "Kurs Takip" başlıklı pencere + veritabanı bağlantısının
   çalıştığını gösteren bir satır (ör. seed'lenmiş öğrenci sayısı). Ekran görüntüsü al, göster.
2. **CI'da `windows-latest` iş akışı yeşil** — migration'lar ve şema mühürlerinin testleri dahil.
3. GitHub Actions'ın **Paket · windows-latest** işi yeşil ve çalışmanın Artifacts kutusunda
   sıfır olmayan boyutlu bir `.msi` paketi listeleniyor. **İndirmeye gerek yok** — kontrol
   Actions sayfasında gözle yapılır.

> **Geliştirme döngüsünde Windows makine yok.** Ne `.msi` indirilir ne kurulur; Windows'a
> dair her doğrulama CI'da yapılır. `.msi`'yi gerçekten kurup açmak ADR-008 gereği Faz 5
> sonunda **kurs sahibinin makinesinde** olacak — geliştiricinin işi değil.
>
> Madde 2 o testin yerini tutmaz ama şema ve derleme sınıfındaki hataları Faz 5'i
> beklemeden yakalar: testler gerçek migration'ları uyguladığı için Windows'ta geçen bir
> test, şemanın Windows'ta kurulduğunun kanıtıdır. Madde 3 ise yalnızca "paketleme adımı
> çöküyor mu" sorusunu cevaplar.
>
> `docs/DURUM.md`'deki "Windows'ta açılan bir `.msi` olmadan tamamlanmış sayılmaz" ifadesi
> bu üç maddeyle değiştirildi.

---

Bitince `/kapat`.
