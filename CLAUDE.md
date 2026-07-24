# Kurs Takip

Küçük bir özel ders kursu için öğrenci, ders ve tahsilat takip programı.
Kurs sahibi tek başına, tek bilgisayarda kullanıyor. Hem birebir hem grup dersleri var.

> **Kullanıcı teknik değil ve Windows kullanıyor. Geliştirme macOS'ta yapılıyor.**
> Bu iki cümle projedeki kararların yarısını açıklar.

## Oturum protokolü

| Komut | Ne zaman |
|---|---|
| `/durum` | Her oturumun başında |
| `/faz-NN` | O oturumda çalışılacak faz — **kod oturumu** |
| `/yonetici` | Plan, kural ve doküman oturumu — **kod yazılmaz** |
| `/kapat` | Her oturumun sonunda — DURUM.md güncellenir + commit |
| `/kurtar` | Bağlam kaybolduğunda / işler karıştığında |

**Bir oturum = bir faz.** Faz bitmeden yeni faza geçme, faz ortasında oturum şişerse `/kapat` çalıştır ve yeni oturumda devam et.

### İki mod

- **Kod oturumu** (`/faz-NN`): uygulama kodu yazılır. Kararlar sorgulanmaz, uygulanır.
  Plan bir yerde tıkanırsa çözümü kendi kafana göre uydurma — `docs/DURUM.md`'ye yaz ve sor.
- **Yönetici oturumu** (`/yonetici`): kod yazılmaz. Plan, kurallar, ADR'ler, faz komutları
  ve doküman tutarlılığı yönetilir. Koda yalnızca denetim için bakılır.

> Yeni bir slash komutu eklendiğinde Claude Code'un **yeniden başlatılması gerekir** —
> komut listesi oturum açılışında taranıyor. "Unknown command" hatasının nedeni budur.

## Belgeler

| Dosya | İçerik |
|---|---|
| `docs/DURUM.md` | Nerede kaldık — her oturum sonunda güncellenir |
| `docs/KARARLAR.md` | Kilitli kararlar + ADR'ler. **Buradaki kararlar yeniden tartışılmaz.** |
| `docs/YOL-HARITASI.md` | 10 fazlık plan ve bağımlılıklar |
| `docs/TASARIM-KAYNAGI.md` | Claude Design projesi nasıl okunur |
| `docs/PRD.md` | Ürün gereksinimleri (Faz 1) |
| `docs/VERI-MODELI.md` | SQLite şeması ve gerekçeleri (Faz 1) |
| `docs/EKRANLAR.md` | Ekran envanteri (Faz 1) |
| `docs/TASARIM-SISTEMI.md` | Renk, tipografi, spacing, komponentler (Faz 1) |

## Stack

Tauri 2 + React + TypeScript + Vite + SQLite (rusqlite)

## Değişmez kurallar

### Mimari
- Frontend SQL yazmaz. Veri erişimi Rust'ta `#[tauri::command]` + repository katmanı üzerinden.
- İş mantığı — özellikle para — Rust tarafında, saf ve test edilebilir fonksiyonlarda.

### Para
- Tutarlar **kuruş cinsinden `i64`**. Float yasak.
- Bakiye saklanmaz; `ledger_entry` toplamından hesaplanır.
- Fiyat değişimi geçmişi bozmaz: seans/paket kaydına ücret snapshot'ı yazılır.
- Para ile ilgili her fonksiyonun testi olur. Bu pazarlık konusu değil.

### Veri
- Hard delete yok. `deleted_at` ile soft delete; kullanıcıya "Arşivle" denir.
- Her tabloda `created_at`, `updated_at`, `deleted_at`.
- Şema yalnızca sıralı migration dosyalarıyla değişir; elle DDL çalıştırılmaz.

### Dil
- Kod, veritabanı, dosya ve değişken adları: **İngilizce**
- Arayüz metinleri: **Türkçe**, tamamı `src/i18n/tr.ts` içinde. JSX'te çıplak metin yok.

### Windows (macOS'ta geliştirip Windows'a teslim ediyoruz)
- Dosya yolu string birleştirmeyle kurulmaz → Tauri path API
- Veritabanı `app_data_dir` altında (`%APPDATA%`), proje klasöründe değil
- Import'larda büyük/küçük harf tam eşleşmeli (macOS affeder, CI affetmez)
- Her yerde UTF-8. CSV/Excel çıktısına BOM eklenir.
- Sistem font stack; makinede kurulu font varsayma
- PDF'te Türkçe için **gömülü font zorunlu** (varsayılan PDF fontlarında ğ/ş/İ/ı yok)
- Platforma özel API kullanma; zorunluysa önce ADR yaz

### Arayüz
- Kullanıcı teknik değil: hata mesajları Türkçe ve **eylem önerir**. Ham hata kodu gösterme.
- Her yıkıcı işlemde onay diyaloğu, her başarılı işlemde bildirim.
- Her listede boş / yükleniyor / hata durumu olur.
- Türkçe sıralama ve arama: `İ/ı` sorunu çözülmüş olmalı (`localeCompare('tr')`).

## Komutlar

<!-- Faz 2'de doldurulacak: dev, build, check, test, seed -->
