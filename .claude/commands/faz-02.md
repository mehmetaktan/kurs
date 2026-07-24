---
description: Faz 2 — Tauri iskeleti, SQLite şeması, migration, seed, Windows CI
---

# Faz 2 — İskelet & CI

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/KARARLAR.md`.

Bu fazda ekran yok. Çıktı: **çalışan bir iskelet + indirilebilir Windows kurulum dosyası.**

---

## 1. Proje kurulumu

Tauri 2 + React + TypeScript + Vite. Klasör yapısını kurduktan sonra `CLAUDE.md`'ye
ekle ki sonraki oturumlar bilsin.

## 2. Veritabanı

- `rusqlite` ile bağlantı
- Veritabanı **`app_data_dir` altında** — proje klasöründe değil (ADR-008)
- Uygulama ilk açılışta veritabanı yoksa oluştursun
- WAL modu aç, `foreign_keys = ON`

## 3. Migration sistemi

- Sıralı `.sql` dosyaları: `migrations/001_initial.sql`, `002_…`
- Uygulanmışları takip eden `schema_migration` tablosu
- Uygulama açılışta bekleyen migration'ları çalıştırsın
- `docs/VERI-MODELI.md`'deki şemayı `001_initial.sql` olarak yaz

## 4. Repository katmanı

- Her tablo için Rust'ta tipli CRUD fonksiyonları
- Frontend'e açılan `#[tauri::command]` fonksiyonları **ince** olsun; iş mantığı repository'de
- Hata tipi tek yerde tanımlansın ve frontend'e Türkçe mesaj + makine-okur kod olarak dönsün
  (kullanıcı ham SQLite hatası görmeyecek — `CLAUDE.md` > Arayüz)

## 5. Testler

Rust tarafında in-memory SQLite ile en az:
- Bir insert + geri okuma
- Soft delete sonrası kaydın listelerde görünmemesi, arşivde görünmesi
- `ledger_entry` toplamından bakiye hesabı

## 6. Seed

Tek komutla yüklenen gerçekçi Türkçe demo verisi:
- 12 öğrenci, gerçekçi Türkçe isimler, bazılarının 2 velisi, bazı kardeşler
- 3 branş, 2 grup
- Bir aylık geçmiş + iki haftalık gelecek seans
- Kısmi ödemeler, bir borçlu, bir alacaklı öğrenci

Seed **sadece geliştirmede** çalışsın; üretim derlemesine girmesin.

## 7. Script'ler

`package.json`'a: `dev`, `build`, `check` (lint + typecheck + test), `test`, `seed`.
Rust tarafı için de karşılıklarını ekle. Hepsini `CLAUDE.md` > Komutlar'a yaz.

## 8. GitHub Actions — **bu fazın en kritik parçası**

- Push'ta Windows `.msi` derlensin, artifact olarak yüklensin
- macOS build'i de ekle ama Windows öncelikli
- `check` adımı da CI'da koşsun
- Derleme süresini kısaltmak için cache kur

Bittiğinde bana **adım adım** anlat: GitHub deposunu nasıl bağlarım, ilk build'i
nasıl tetiklerim, `.msi`'yi nereden indiririm.

## 9. Doğrulama

Uygulama açıldığında "Kurs Takip" başlıklı bir pencere ve veritabanı bağlantısının
çalıştığını gösteren bir satır (ör. seed'lenmiş öğrenci sayısı) görünsün.

Uygulamayı çalıştır, ekran görüntüsü al, bana göster.

---

Bitince `/kapat`.
