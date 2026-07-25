---
description: Faz 4 — Öğrenci ve veli modülü
---

# Faz 4 — Öğrenci & Veli

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md`, `docs/VERI-MODELI.md`.

Sadece bu modül. Ders, yoklama, tahsilat bu fazda yok.

---

## 0. Marka geçişi (ADR-024) — öğrenci modülünden ÖNCE

> **Neden ilk iş:** `identifier` değiştiğinde veritabanının `%APPDATA%` klasörü değişir.
> Bugün maliyeti iki satır; kurs sahibinin makinesinde gerçek veri oluştuktan sonra
> maliyeti bir veri taşıma işi ve bir destek görüşmesi. Faz 10'a bırakılamaz.

Kararın tamamı `docs/KARARLAR.md > ADR-024`'te. Uygulanacaklar:

**a. Uygulama kimliği.** `com.aydinozelders.kurstakip` → `com.aktansoft.kurstakip`.
İki yerde: `src-tauri/tauri.conf.json > identifier` ve `src-tauri/src/db/mod.rs >
APP_IDENTIFIER`. **Ürün adı `Kurs Takip` olduğu gibi kalır** — `productName`, pencere
başlığı ve CI artefakt yolları değişmez.

**b. Yayıncı.** `Cargo.toml > authors` → `["Aktansoft"]`. `tauri.conf.json > bundle`
altına `publisher: "Aktansoft"` eklenir (Windows kurulum ekranında ve "Uygulamalar ve
özellikler" listesinde görünen ad).

**c. Kurum config'i.** `config/kurum.json` oluşturulur (biçimi ADR-024'te):

- TypeScript tarafı: `src/config/brand.ts` — JSON'u tipli olarak dışa verir.
- Rust tarafı: `include_str!` ile derleme anında gömülür. Çalışma anı dosya okuması
  **yok** (ADR-008 gerekçesi ADR-024'te).
- `src/i18n/tr.ts`: `app.institution` **silinir** (artık config'ten geliyor),
  `app.brand` `'DersTakip'` → `'Kurs Takip'` olur. `tr.ts` ürün metinlerinin envanteri;
  müşteri değişkeni orada durmaz.
- `src/shell/SidebarNav.tsx:26` kurum adını config'ten okur.
- `commands.rs > app_status.institution_name` artık `setting` tablosundan değil
  config'ten döner.

**d. `setting.institution_name` artık okunmaz.** Migration `001_initial.sql` **mühürlü,
elleme** — satır yerinde kalır. İşaretlenecek yerler: `docs/VERI-MODELI.md §1.2`
satırına "okunmuyor, ADR-024" notu ve `src-tauri/tests/crud.rs`'teki
`ayarlar_baslangic_verisinden_okunur` testine aynı notun yorumu. Test **silinmez**:
migration'ın başlangıç verisini yazdığını doğrulamaya devam ediyor.

**e. Sürüm metni tek kaynağa bağlanır.** `tr.app.version` bugün elle yazılmış
`'Sürüm 1.0 · Yerel'`; gerçek sürüm `0.1.0`. Sürüm numarası `package.json`/`tauri.conf`
üzerinden gelmeli, `'· Yerel'` ibaresi `tr.ts`'te kalmalı (kasıtlı bir mesaj, bkz.
`EKRANLAR.md`). Elle yazılmış sürüm numarası kayar ve kimse fark etmez.

**f. Yeni mühür — kimlik eşitliği testi.** `APP_IDENTIFIER` ile `tauri.conf.json >
identifier` eşitliğini bugün yalnızca bir **yorum satırı** koruyor. Bir test yazılır:
`tauri.conf.json` okunur, `identifier` alanı `db::APP_IDENTIFIER` ile karşılaştırılır.
Ayrışırlarsa seed binary'si ile uygulama farklı klasörlere yazar — sessiz ve teşhisi zor.
**Negatif kontrolü yap:** sabiti geçici olarak boz, testin düştüğünü gör, geri al.

Bittiğinde `npm run check` yeşil olmalı ve uygulama **yeni** `%APPDATA%` klasöründe
sıfırdan bir veritabanı kurmalı (`npm run seed -- --reset` ile doğrula).

---

## 1. Öğrenci listesi

Tasarımdaki `Öğrenciler` ekranını gerçek veriyle kur.
- Arama: ad, soyad, veli adı, telefon. **Türkçe karakter duyarlı** (`İ/ı`)
- Filtre: branş, durum (aktif / arşiv), grup
- Sıralama ve sayfalama
- Boş / yükleniyor / hata durumları Faz 3 komponentleriyle

## 2. Ekle / düzenle formu

- Alan bazlı validasyon, Türkçe hata mesajları, mesaj alanın altında
- Jenerik "bir hata oluştu" yasak
- Kaydetmeden çıkarken uyarı
- Telefon ve tarih alanları maskeli

## 3. Öğrenci detayı

Tasarımdaki `Öğrenci detayı` ekranını kur. Sekmeler:
`Bilgiler` `Dersler` `Ödemeler` `Notlar`

`Dersler` ve `Ödemeler` şimdilik "Yakında" placeholder'ı — Faz 6 ve 8'de dolacak.
`Notlar`: serbest metin, tarihli girişler.

## 4. Veli yönetimi

- Bir öğrencinin birden fazla velisi olabilir, biri **birincil**
- Bir veli birden fazla öğrenciye bağlanabilir (kardeşler) — mevcut veliyi arayıp bağla
- Veli telefonu zorunlu (v2'de hatırlatma için, ADR-009)

## 5. Arşivleme

- "Sil" değil **"Arşivle"** (ADR-005)
- Onay diyaloğu, ardından geri alma imkânı
- Arşivlenmiş öğrenci varsayılan listede görünmez, filtreyle görünür
- Arşivlenen öğrencinin geçmiş kayıtları bozulmaz

## 6. Testler

Rust tarafında: arama (Türkçe karakter dahil), filtre, sayfalama, arşivleme/geri alma,
veli ilişkisi (aynı veli iki öğrenciye bağlı).

---

Kurallar: metinler `tr.ts`'ten, yıkıcı işlemde `ConfirmDialog`, başarıda `Toast`.

Bitince ekran görüntüleri göster, sonra `/kapat`.
