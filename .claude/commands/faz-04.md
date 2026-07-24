---
description: Faz 4 — Öğrenci ve veli modülü
---

# Faz 4 — Öğrenci & Veli

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md`, `docs/VERI-MODELI.md`.

Sadece bu modül. Ders, yoklama, tahsilat bu fazda yok.

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
