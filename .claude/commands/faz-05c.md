---
description: Faz 5C — Takvim ekranı ve ilk Windows testi
---

# Faz 5C — Takvim

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md` (**§2 Takvim**),
`docs/TASARIM-SISTEMI.md`, `docs/KARARLAR.md` (**ADR-001**, **ADR-011**, **ADR-017**,
**ADR-020**, **ADR-024**).

**Faz 5'in son parçası ve en riskli ekranı.** Sürükle-bırak, ızgara yerleşimi ve saat
hesapları WebView2 farklarına en duyarlı olan yer.

---

## 0. Önce karar: hazır kütüphane mi, elde mi

**Kod yazmadan önce bu soruyu bir ADR olarak cevapla.** Karar oturum içinde uydurulmaz.

Ölçütler:

1. **Çevrimdışı çalışmak zorunda** — CDN yok, lisans sunucusu yok, telemetri yok
   (ADR-001: sunucu, hesap, giriş yok).
2. **Tasarım sistemine oturmalı.** `EKRANLAR §2` ızgarayı bire bir tarif ediyor:
   08:00–22:00 · 30 dk = 30px (rahat) / 22px (sıkı) · şerit (lane) algoritması ·
   7 blok varyantı · taralı tatil sütunu · 30 dk'ya kilitli sürükleme + 5px eşiği ·
   `#d59029` şimdi çizgisi. Kütüphanenin CSS'iyle güreşmek ızgarayı yazmaktan pahalı
   olabilir — bu **ölçülecek**, varsayılmayacak. Somut ölç: bir günlük görünümü
   token'larla kaç satır CSS geçersiz kılmadan kurabiliyorsun?
3. **Lisans.** Ürün kurs sahibine teslim ediliyor ve ADR-024 "ürün Aktansoft'un" diyor.
   Ticari bir komponentin dağıtım şartı okunmadan aday listesine bile girmez.
   Kullanıcının `~/.npmrc`'sinde bir **Bryntum** deneme jetonu var — aday, ama şartları
   okunmadan değil.
4. **Paket boyutu.** ADR-001 Tauri'yi Electron'a tercih ederken gerekçe kurulum dosyası
   boyutuydu; 2 MB'lik bir takvim kütüphanesi o kararı kısmen geri alır.
5. **Türkçe.** Gün/ay adları `tr.calendar`'dan gelmeli; `toLocaleDateString('tr')`
   kullanılmıyor (ICU verisi eksik Windows'ta İngilizce döner — `tr.ts`'te yazılı).

Kararı `docs/KARARLAR.md`'ye ADR olarak yaz, sonra kod.

## 1. Takvim ekranı

- **Haftalık ızgara** (ana görünüm)
- **Aylık genel bakış**
- **Günlük liste** — ADR-011: tek sütun, öğretmen başına sütun **yok**
- Branş rengine göre ayrım (`subject.color`, 5 renkli kategori paleti), grup/birebir ayrımı
- **Öğretmen filtresi kurulmaz** (ADR-011: tek öğretmen)

Dört ayrı boş durum (`EKRANLAR §149`): ilk kullanım · hafta tamamen tatil · filtre
sonuçsuz · gün boş. Tek bir "kayıt yok" hepsini anlatmaz.

## 2. Sürükle-bırak

- 30 dk'ya kilitli, 5px altındaki hareket **tıklama** sayılır (R3.7)
- Tatil/kapalı güne **bırakılamaz**; hedef göstergesi bile çıkmaz (K-2)
- Taşıma sonrası kapsam sorulur: **"Sadece bu ders"** / **"Bu ve sonraki dersler"** (R3.8)
- Taşıma bildirimi **geri alınabilir** (R3.12)
- Yoklaması alınmış geçmiş ders **taşınamaz** (R3.13) — Rust zaten reddediyor

## 3. 5A/5B'den devralınan yüzey

`session_conflicts` · `reschedule_session` · `delete_sessions` · `cancel_session` ·
`group_list` hazır. Takvimin ihtiyacı olan tek yeni sorgu muhtemelen **tarih aralığına
göre seans listesi**: `repo::academic::sessions_between` var, ekranın istediği birleşik
satır (branş rengi, grup adı, üye sayısı, yoklama durumu) için `repo/schedule.rs`'e bir
projeksiyon eklenir — `group_rows` kalıbı.

## 4. Testler

- Şerit (lane) algoritması: çakışan iki ders yan yana bölünür, üç ders üçe
- 30 dk kilidi ve 5px eşiği
- Kapalı gün sütununun hedef kabul etmemesi
- "Şimdi" çizgisinin konumu (saat **parametre**, `Date.now()` değil — test edilebilir kalsın)

---

## Faz sonu — İLK WINDOWS TESTİ

Bu faz bitince GitHub Actions'tan Windows `.msi`'yi indir. Bana:
- Kurs sahibine nasıl göndereceğimi
- Test etmesini isteyeceğim 5 maddelik listeyi
- SmartScreen uyarısı çıkarsa ne yapması gerektiğini

anlat. Bu testi Faz 10'a bırakmıyoruz.

> **Windows makine yok**, doğrulama CI'da yapılıyor. `.msi` indirilip kurulmuyor;
> kanıt `Test · windows-latest` işinin yeşil olması ve artefakt kutusunda sıfır olmayan
> boyutta bir `.msi` listelenmesi.

Bitince `/kapat`.
