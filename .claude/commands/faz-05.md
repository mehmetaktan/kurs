---
description: Faz 5A — Branş, tatil, grup ve seans üretim motoru (tamamlandı)
---

# Faz 5A — Ders & Takvim, birinci parça

> ## ✅ Bu faz 2026-07-26'da tamamlandı — bu dosya artık kaydı
>
> **Faz 5 üçe bölündü**, gerekçesi aşağıda. Sıradaki komutlar:
>
> | Komut | Kapsam |
> |---|---|
> | ~~`/faz-05`~~ | **5A** ✅ — seans motoru, Tanımlar (branş + tatil), Gruplar liste/detay |
> | `/faz-05b` | **5B** — Ders ekle/düzenle, şablondan oluştur, seans işlemleri, Bugün ekranı |
> | `/faz-05c` | **5C** — Takvim (önce "hazır kütüphane mi" ADR'si) + **ilk Windows testi** |
>
> **Neden üçe.** Tek oturuma sığmıyordu: 6 ekran, takvim komponent kütüphanesi, üretim
> motoru ve §7'nin test listesi. Kullanıcı takvimin en sona kalmasını ve oraya gelince
> hazır kütüphanelerin değerlendirilmesini istedi — ızgara dışındaki her şey mevcut
> komponentlerle kurulabildiği için bölünme ikiye değil üçe çıktı ve takvim kararı
> beklerken iş durmadı.
>
> `docs/YOL-HARITASI.md`'nin "Faz 5 sonu: kurs sahibine build gönderilir" kilometre taşı
> **5C sonuna** kaydı.
>
> Aşağıdaki §4 (takvim + Bugün) ve §5 (seans işlemleri arayüzü) **5B ve 5C'ye devretti**;
> bu dosyada olduğu gibi duruyorlar çünkü fazın özgün kapsamını gösteriyorlar.

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/VERI-MODELI.md`, `docs/EKRANLAR.md`,
`docs/KARARLAR.md` (**ADR-012**, **ADR-017**, **ADR-025**, **ADR-026**, **ADR-027**).

**Projenin en karmaşık fazı. Önce plan modunda çalış, planı onaylatmadan kod yazma.**
Faz büyükse ikiye bölmeyi öner — yarıda kalmaktansa bölünmüş olsun.

> **ADR-025 bu fazda bağlayıcı.** Gruplar listesi de bir liste ekranı: arama ve veri
> filtresi **Rust'ta** (`repo` katmanı, `search_name` orada), Türkçe sıralama ve
> sayfalama **arayüzde** (`sortTr.ts` + sayfa altındaki `filters.ts` kalıbı). SQL'de
> `ORDER BY` ile isim sıralama **yok** (ADR-020). Öğrenciler ekranındaki
> `src/pages/ogrenciler/filters.ts` bu kalıbın referansı — yeniden icat etme, oradan al.

---

## 1. Branş yönetimi

Basit CRUD: ad, renk (takvimde ayırt etmek için), **varsayılan süre** (`subject.default_min`;
boşsa `setting.default_session_minutes`, varsayılan 60).

> **PRD S4 cevaplandı (2026-07-25): varsayılan 60 dakika, değiştirilebilir.** İkisi de
> migration'da hazır — **şema değişmiyor, bu faz migration eklemiyor.** Takvim ızgarası
> 60 dakikalık dilime oturur; 90 dakikalık ders serbest, seansta tek tek girilir.

`search_name` **Rust'ta üretilir** (`§0 K9`) ve tekillik onun üzerindedir: `Matematik` ile
`matematik` aynı branştır. Listeleme `ORDER BY` ile değil, `sortTr` ile sıralanır (ADR-020).

## 2. Grup yönetimi

- Grup oluştur: ad, branş, kapasite, haftalık program, **öğretmen**
- Öğrenci ekle / çıkar, kapasite kontrolü — **onay iste, engelleme** (aşağıda)
- **Katılma ve ayrılma tarihi tutulur** — geçmiş yoklamalar bozulmayacak (VERI-MODELI.md)
- Grup listesi: doluluk oranı görünsün
- Grup detayının **Notlar** sekmesi: ayrı bir tablo **açılmaz**; grup üyelerinin
  `student_note` kayıtlarının birleşik akışı gösterilir, not eklerken öğrenci seçtirilir
- Aynı öğrenci + branş için **çakışan açık kayıt engellenir** (PRD K-22)

> **PRD S2 cevaplandı (2026-07-25): kapasite aşımında onay istenir, engellenmez.**
> `R5.6` · `K-8` · `EKRANLAR.md §309` ile aynı yön. Diyalog kaç kişilik gruba kaçıncı
> öğrencinin eklendiğini **söylesin** ("Bu grup 6 kişilik ve dolu. 7. öğrenci eklensin
> mi?"); kullanıcı onaylarsa kayıt yazılır. **Şemaya CHECK ya da trigger konmaz** —
> `group.capacity` bir hedeftir, kısıt değil. Grup listesindeki doluluk oranı aşımı
> görünür kılar. Aynı dil §6'daki çakışma uyarısıyla tutarlı: program ve kapasiteyle
> ilgili her şey uyarır, para ve geçmişle ilgili her şey engeller (PRD §7 genel ilke).

> **Öğretmen alanı (~~ADR-011~~ → ADR-037).** *2026-07-26 notu: bu faz bittikten sonra
> ADR-011 düştü — kurs **çok öğretmenli.** Aşağıdaki "tek öğretmen" varsayımı tarihsel
> kayıttır; öğretmen tanımlama ekranı `/faz-07 §0a`'da geldi.*
>
> `teacher` tablosu tek satır ve o satırı migration yazıyor.
> Ama `teacher_id`'yi **yazan** bir ekran yoksa 5 tablodaki alan NULL kalır ve K-1/R3.11
> çakışma uyarısı (`aynı öğretmen aynı saatte`) hiçbir zaman tetiklenmez — sessizce ölü doğar.
> Grup ve seans formlarında öğretmen alanı **varsayılanı tek öğretmen olan, gizli olmayan**
> bir alan olarak dursun. Filtre ve çoklu sütun görünümü kurulmaz; alan yazılır.

## 3. Seans oluşturma

- **Tekil seans:** birebir (öğrenci seç) veya grup (grup seç)
- **Seri oluşturma:** haftalık şablon `session_series` satırıdır — düz seans listesi değil
  (`VERI-MODELI.md §1.14`). Tasarımın "Bu ve sonraki dersler" davranışı buna dayanıyor.
  - Birden fazla gün seçilebilsin (Salı + Perşembe)
  - Kapalı günler (`closed_day`, `setting.weekly_closed_days`) atlanır
  - Üretmeden önce **önizleme** göster, onaydan sonra yaz
- **Üretim ufku:** seanslar `setting.session_horizon_weeks` (varsayılan 16) kadar ileriye
  üretilir ve her açılışta eksikler tamamlanır. Ufuk olmazsa takvim birkaç ay sonra sessizce
  boşalır ve Bugün ekranı yanlış boş-durum metnini gösterir.
  Üretim **idempotent**: `ux_session_series_slot`. İptal edilmiş seans yeniden üretilmez.
- Seans kaydına ücret snapshot'ı yazılsın (ADR-006). Tarife Faz 7'de gelecek;
  şimdilik alan dolsun, değer 0 olabilir.

## 3b. Tatil / kapalı gün yönetimi

`closed_day` CRUD'u **bu fazda** kurulur — Faz 10'a bırakılmaz. Takvim taralı sütunları,
"Tatil · ders bırakılamaz" etiketi ve PRD K-2 (sürüklemede hedef çıkmaz) buna dayanıyor.

## 4. Takvim

Tasarımdaki `Takvim` ekranını kur:
- Haftalık ızgara (ana görünüm)
- Aylık genel bakış
- Günlük liste
- Branş rengine göre ayrım, grup/birebir ayrımı görünür

Tasarımdaki `Bugün` ekranını da kur — kurs sahibi sabah bunu açacak:
bugünün dersleri saat sırasıyla, her birinde öğrenci/grup adı ve hızlı eylemler.

> **Bugün ekranı bu fazda yarım kalır, bu normaldir.** Üç bölümünden yalnızca "bugünün
> dersleri" doldurulabilir: borç listesi Faz 8'i (`v_student_debt`), "paketi bitmek üzere"
> Faz 7'yi, yedekleme şeridi Faz 10'u (`backup_log`) bekliyor. Bu bölümleri **kaldırma** —
> boş durum metniyle bırak (PRD R1.6), sonraki fazlar yerine veri koyacak.

## 5. Seans işlemleri

- **Ertele:** tarih/saat değiştir
- **İptal et:** sebep sor, kayıt silinmez durumu değişir
- **Sil:** tek seans mı, serinin kalanı mı, tüm seri mi — **net sor**, varsayılan en dar kapsam
- Geçmiş tarihli seansta düzenleme uyarısı

## 6. Çakışma kontrolü

Aynı saatte iki ders varsa **uyar, engelleme**. Kurs sahibi bilerek yapıyor olabilir.
Uyarı çakışan dersin adını söylesin.

## 7. Testler

Rust tarafında:
- Seri üretimi (tatil atlama dahil), üretilen seans sayısı ve tarihleri
- Çakışma tespiti
- Seri silme kapsamları
- Gruba sonradan katılan öğrencinin katılım öncesi seanslarda görünmemesi

## 8. Tarih/saat — karar zaten alındı, yeniden tartışma

**ADR-017 kilitli:** tarih/saat yerel duvar saati metni, UTC yok.
**`VERI-MODELI.md §0` `'now'` kuralı bağlayıcı:** SQL içinde çıplak `'now'` kullanılmaz;
"bugün" Rust'tan (`chrono::Local`) bind edilen bir parametredir. Takvim sorgularında,
"şimdi çizgisi"nde ve boş-durum hesaplarında bu kurala uy.

Bu bölüm eskiden "ADR yaz" diyordu; ADR Faz 1'de yazıldı.

---

## Faz sonu — İLK WINDOWS TESTİ

Bu faz bitince GitHub Actions'tan Windows `.msi`'yi indir. Bana:
- Kurs sahibine nasıl göndereceğimi
- Test etmesini isteyeceğim 5 maddelik listeyi
- SmartScreen uyarısı çıkarsa ne yapması gerektiğini

anlat. Bu testi Faz 10'a bırakmıyoruz.

Bitince `/kapat`.
