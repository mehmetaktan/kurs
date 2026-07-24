---
description: Faz 1 — Tasarımı oku, PRD ve veri modelini yaz (kod yok)
---

# Faz 1 — Plan

**Bu oturumda uygulama kodu YAZMA.** Sadece `docs/` altındaki plan dokümanları ve
`design-ref/` altına indirilen tasarım dosyaları.

Önce oku: `CLAUDE.md`, `docs/KARARLAR.md`, `docs/TASARIM-KAYNAGI.md`.
KARARLAR.md'deki kararlar kilitli — yeniden tartışma, uygula.

---

## A. Tasarımı oku

`docs/TASARIM-KAYNAGI.md`'deki `projectId` ile `DesignSync` aracını kullan.
Erişim hatası alırsan bir kez `/design-login` gerektiğini söyle ve dur.

1. `list_files` ile dosyaları listele
2. Her ekranı `get_file` ile oku
3. Hepsini `design-ref/` altına olduğu gibi kaydet (sonraki oturumlar tekrar indirmesin)

Çıkar:

**`docs/EKRANLAR.md`** — her ekran için:
- Ekran adı ve amacı (kurs sahibi bu ekranı ne zaman açar)
- İçindeki bölümler ve bileşenler
- Gösterdiği veri alanları
- Kullanıcının burada yapabildiği işler
- Boş durumda ne görünmeli

**`docs/TASARIM-SISTEMI.md`** — tasarımdan çıkardığın:
- Renk paleti, hex değerleriyle ve rolleriyle (birincil, yüzey, metin, uyarı, hata, başarı)
- Tipografi ölçeği (boyut, ağırlık, satır yüksekliği)
- Spacing skalası
- Border-radius, gölge değerleri
- İkon seti
- Tespit ettiğin komponent listesi ve varyantları

Bittiğinde bulgularını bana özetle — özellikle tasarımda gördüğün ama benim
anlatmadığım şeyleri.

---

## B. PRD

**`docs/PRD.md`** yaz. Merkeze özellik listesini değil, **kurs sahibinin rutinini** al:

- **Her sabah:** bugün kimin dersi var, hangi saatte, nerede
- **Her ders sonrası:** yoklama, gelmeyen için telafi
- **Hafta içi:** yeni öğrenci kaydı, program değişikliği, ders erteleme
- **Ay sonu:** kim ne kadar borçlu, tahsilat alma, makbuz verme
- **Dönem başı:** paket satışı, grup oluşturma, tarife güncelleme

Her rutin için: hangi ekran çözüyor, kaç tıkla bitiyor, hangi bilgi eksikse iş durur.

Ayrıca:
- Kullanıcının **yapmaması gerekeni yapmasını** engelleyen kurallar (aynı saate iki ders,
  kapasite aşımı, olmayan paketten düşme)
- Hangi hatalar geri alınabilir olmalı
- Bana sormam gereken açık sorular

---

## C. Veri modeli

**`docs/VERI-MODELI.md`** — tam SQLite şeması, CREATE TABLE ifadeleriyle.

Başlangıç tabloları (eksik gördüğünü ekle ve gerekçesini yaz):

```
student, guardian, student_guardian, subject, study_group, group_member,
session, attendance, price_rule, package, package_usage, payment,
ledger_entry, setting, schema_migration
```

Zorunlu kurallar:
- Her tabloda `created_at`, `updated_at`, `deleted_at`
- Tutarlar `INTEGER`, kuruş cinsinden
- `session` tablosu hem birebir hem grup dersini taşır — ayrımı nasıl kurduğunu ve
  neden tek tablo seçtiğini açıkla
- Gruba sonradan katılan veya ayrılan öğrenci, katılım aralığı dışındaki seansların
  yoklamasında görünmemeli — bunu şema nasıl garanti ediyor
- `ledger_entry`: seans işlenince borç, tahsilat alınınca alacak satırı.
  **Paket satışının deftere nasıl yansıdığını adım adım anlat** (peşin alınan para
  ile henüz verilmemiş ders arasındaki ilişki)
- Seans iptal edilirse defterde ve paket hakkında ne olur
- `guardian.phone` ve `last_reminded_at` alanları dursun (ADR-009)

Her tablo için: alanlar, tipler, indeksler, yabancı anahtarlar, kısıtlar ve
**"bu tablo neden var"** cümlesi.

Sonunda: 3 örnek senaryonun bu şemada nasıl sonuçlandığını SQL ile göster
1. Birebir ders veren, ders başı ödeyen öğrenci — bir ay sonra bakiyesi
2. 8 derslik paket alan, 3 ders işleyen öğrenci — kalan hakkı ve bakiyesi
3. Grup dersine dönem ortasında katılan öğrenci — kaç dersten sorumlu

---

## D. Boşluk analizi

`docs/EKRANLAR.md`'ye **"Tasarlanacak ekranlar"** başlığı ekle.
Tasarımda 4 ekran var; MVP'de gereken diğerlerini listele ve her biri için
hangi mevcut komponentlerle kurulacağını yaz. Yeni görsel dil icat etme.

---

## Sıra ve onay

1. **A**'yı bitir, bulguları özetle
2. **C**'yi (veri modeli) **taslak olarak sun ve ONAYIMI AL**
3. Onay gelmeden `docs/` altına hiçbir dosya yazma
4. Onay sonrası A, B, C, D çıktılarının hepsini yaz
5. `/kapat` çalıştır

Veri modeli 10 fazın temeli. Acele etme, alternatifleri göster, tercih ettiğinin
gerekçesini yaz.
