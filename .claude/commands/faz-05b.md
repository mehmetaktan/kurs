---
description: Faz 5B — Ders ekle/düzenle, seans işlemleri ve Bugün ekranı
---

# Faz 5B — Seans işlemleri ve Bugün ekranı

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md` (**§1.14**, **§1.15**, **§4**),
`docs/EKRANLAR.md` (**§1 Bugün**, **E3**, **E6**), `docs/KARARLAR.md`
(**ADR-011**, **ADR-012**, **ADR-017**, **ADR-018**, **ADR-025**).

**Faz 5A bitti** — motor ve veri hazır. Bu faz **arayüz fazı**: 5A'nın yazdığı Rust
fonksiyonlarına ekran bağlıyor. Yeni bir Rust mantığı yazma ihtiyacı doğarsa dur ve sor;
büyük ihtimalle fonksiyon zaten var.

> **Takvim ızgarası bu fazda YOK** (Faz 5C). Bugün ekranı düz bir liste, ızgara
> gerektirmiyor — bu yüzden takvim kararını beklemeden kurulabiliyor.

---

## 5A'dan devralınanlar — hazır olan Rust yüzeyi

| Komut | Ne yapar |
|---|---|
| `session_conflicts(startsAt, endsAt, ignoreSessionId)` | Çakışan derslerin **adıyla** listesi. Boş dizi = çakışma yok |
| `cancel_session(sessionId, reason)` | `status='cancelled'`, satır durur (§4) |
| `delete_sessions(sessionId, scope)` | `only` / `following` / `all` — `DeleteReport` döner |
| `reschedule_session(sessionId, startsAt, durationMin)` | Yoklaması alınmış dersi **reddeder** (R3.13) |
| `default_session_minutes(subjectId)` | Branşın süresi, yoksa genel ayar (PRD S4) |
| `group_list` · `group_detail` · `list_subjects` · `student_list` | Seçicilerin kaynağı |

`generate_sessions` her açılışta `repo::ops::on_startup` içinden çalışıyor; bu fazda elle
çağrılmasına gerek yok.

## 1. E3 — Ders ekle / düzenle

`Modal` (384px). Alanlar: tür (birebir/grup) `SegmentedControl` · branş `Select` ·
grup veya öğrenci `Select` · tarih · saat · süre · **tekrar** (tek seferlik / haftalık).

- Süre varsayılanı `default_session_minutes(subjectId)` — ikinci bir varsayılan **yazma**.
- **Tatil gününe kaydetme engellenir** (PRD K-2). Kapalı gün bilgisi `closed_day` +
  `setting.weekly_closed_days`; 5A'da `is_closed_day` var, komut açman gerekebilir.
- **Çakışma engellemez, uyarır** (K-1 / R3.11): kaydetmeden önce `Modal` içinde uyarı +
  **"Yine de ekle"**. Uyarı çakışan dersin **adını** söyler — `Conflict.label` hazır.
- "Haftalık" seçilirse `session_series` yazılır ve seanslar üretilir. Grup formundaki
  haftalık program satırı kalıbı (`GroupForm`) referans.

## 2. E6 — Şablondan oluştur

`Modal`. Kaynak hafta seçimi + **önizleme listesi** + "Şu tarihten itibaren uygula".
Önizleme onaydan **önce** gösterilir (`faz-05.md §3`): kaç ders, hangi tarihler.

## 3. Seans işlemleri

- **Ertele:** tarih/saat değiştir. Yoklaması alınmışsa Rust reddediyor; mesajı göster.
- **İptal et:** sebep sor, kayıt silinmez durumu değişir.
- **Sil:** tek seans mı, serinin kalanı mı, tüm seri mi — **net sor**, varsayılan en dar
  kapsam (`ModalOption` üçlüsü). `DeleteReport` ne olduğunu söylüyor: `cancelled` alanı
  doluysa ders **iptal edildi**, arşivlenmedi — bildirim bunu doğru anlatmalı.
- Geçmiş tarihli seansta düzenleme uyarısı.

> **Neden şablona bağlı tek ders "silinince" iptal oluyor.** `ux_session_series_slot`
> kısmi bir indeks (`deleted_at IS NULL`): arşivleme slotu boşaltır ve üretim dersi
> ertesi açılışta geri yazar. 5A bunu `delete_sessions` içinde çözdü; arayüz yalnızca
> sonucu doğru anlatmakla yükümlü.

## 4. Bugün ekranı (EKRANLAR §1)

Kurs sahibi sabah bunu açacak: bugünün dersleri saat sırasıyla, her birinde öğrenci/grup
adı ve hızlı eylemler.

> **Bu ekran bu fazda da yarım kalır, bu normaldir.** Üç bölümünden yalnızca "bugünün
> dersleri" doldurulabilir: borç listesi Faz 8'i (`v_student_debt`), "paketi bitmek üzere"
> Faz 7'yi, yedekleme şeridi Faz 10'u (`backup_log`) bekliyor. Bu bölümleri **kaldırma** —
> boş durum metniyle bırak (PRD R1.6), sonraki fazlar yerine veri koyacak.

- R1.1 — saat sırası + geçmiş/gelecek arasında **"şimdi" çizgisi** (yalnızca ikisi de varsa)
- R1.2 — yoklaması girilmemiş geçmiş ders **amber zemin + sol şerit** (`Table.rowAttention`)
- R1.7 — hiç program yoksa boş liste değil **yönlendirme**: "Haftalık ders programı henüz
  oluşturulmadı" + **Ders ekle**

**"Bugün" Rust'tan gelir** (§0 `'now'` kuralı): `chrono::Local`, SQLite saati değil.

## 5. Testler

Rust tarafı 5A'da yazıldı (41 test). Bu fazda **arayüz testleri**:
- Bugün ekranının saat sıralaması ve "şimdi" çizgisinin **yalnızca** hem geçmiş hem
  gelecek ders varken çıkması
- Kapsam diyaloğunun varsayılanının en dar seçenek olması
- Çakışma uyarısının dersin adını göstermesi

Yeni bir Rust fonksiyonu yazıldıysa testi de Rust'ta olur (CLAUDE.md).

## 6. Değişmezler

- **Migration eklenmez.** Şema Faz 2'de kapandı; gerekirse dur ve sor.
- Bütün metinler `src/i18n/tr.ts` (ADR-007). JSX'te çıplak metin yok.
- Tarih/saat: ADR-017 kilitli, SQL'de çıplak `'now'` yok.

Bitince `/kapat`. Sonraki: **`/faz-05c`** — takvim (önce "hazır kütüphane mi" kararı).
