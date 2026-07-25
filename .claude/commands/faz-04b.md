---
description: Faz 4.5 — Faz 4 denetiminden kalan dört düzeltme (kısa oturum)
---

# Faz 4.5 — Faz 4 artıkları

**Kısa oturum.** Dört düzeltme, yeni özellik yok. Faz 5'in en karmaşık faz olması ve
komutunun "büyükse ikiye böl" diye uyarması yüzünden bu artıklar oraya yüklenmedi.

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/KARARLAR.md` (**ADR-025**, **ADR-026**).

Hepsi Faz 4 denetiminin (2026-07-25) karşıt doğrulamadan geçmiş bulguları. Sıra
önemliden önemsize; oturum şişerse alttan kes, `docs/DURUM.md`'ye yaz.

---

## 1. Veli araması ikinci veliyi de görsün

**Bulgu.** `src-tauri/src/repo/roster.rs:159` `matches_search` yalnızca `row.guardian_name`
ve `row.guardian_phone`'a bakıyor — bunlar `StudentRow`'un **birincil** veli alanları.
İkinci veli (çoğunlukla baba) adıyla ya da numarasıyla aranınca öğrenci bulunamıyor.

**Neden önemli.** Somut senaryo: annesi birincil kayıtlı öğrenciyi babası arıyor. Kurs
sahibi babanın numarasını arama kutusuna yazıyor, ekran "sonuç yok" diyor, öğrencinin
kayıtlı olmadığını sanıp **ikinci bir öğrenci kaydı açıyor**. Mükerrer öğrenci, ardından
mükerrer defter. Arama kutusunun kendisi veli adı arayacağını söylüyor
(`faz-04.md §1`, `tr.students.searchPlaceholder`).

**Yapılacak.** `student_rows` zaten `enrollment_tags` kalıbıyla ek eşleme çekiyor; aynı
kalıpla öğrenci → **bütün veliler** eşlemesi alınsın ve `matches_search` bu listeye baksın.
**Ekranda gösterilen alan birincil kalmaya devam etsin** — değişen yalnızca aramanın
kapsamı, satırın görünümü değil.

**Test kör noktası da düzeltilecek.** `tests/roster.rs`'teki
`arama_veli_adini_ve_telefonunu_da_kapsar` yalnızca tek velili öğrencilerle çalışıyor.
İkinci velili bir vektör eklenmeli: ikinci velinin adıyla **ve** telefonuyla arama.

---

## 2. Bakiye kartının altyazısı üç durumu ayırsın

**Bulgu.** `src/pages/ogrenciler/StudentDetailPage.tsx:294-299` altyazıyı tek bir
`daysOverdue !== null` dalına bağlıyor:

```
caption={daysOverdue !== null ? `${daysOverdue} ...` : tr...balanceEmptyCaption}
```

`daysOverdue` yalnızca **gecikmiş** borçta doluyor. Sonuç: borcunu tamamen ödemiş,
defterinde onlarca hareket olan öğrencinin kartında da **"Henüz hareket yok"** yazıyor.
Avans vermiş öğrencide de aynı.

**Neden önemli.** Kurs sahibi teknik değil. Bir rakamın altında onu yalanlayan bir cümle
okursa ya rakama ya uygulamaya güveni gider — ve bu, her gün açılan öğrenci detay ekranı.

**Yapılacak.** Üçüncü dal: ölçüt `daysOverdue` değil, **defterde satır olup olmadığı**.
`StudentDetail`'e bir `hasLedger` (ya da hareket sayısı) taşınsın.

| Durum | Altyazı |
|---|---|
| Defter boş | "Henüz hareket yok" |
| Gecikmiş borç var | "N gün gecikmiş" (bugünkü davranış) |
| Borç var, vadesi gelmemiş / bakiye kapalı / avans | Yeni metin — `tr.ts`'e eklenecek |

---

## 3. `Toplam alacak` görünen listeyi toplasın (ADR-026)

**Bulgu.** `src/pages/ogrenciler/filters.ts:118` alt çubuğun rakamını Rust'tan gelen
`rows` üzerinden hesaplıyor; çipler ise yalnızca `visible`'a uygulanıyor. Rakam
arama/branş/grup süzgecine tepki veriyor ama **çiplere kör**.

**Yapılacak (ADR-026).** Rakam `visible` üzerinden hesaplansın, etiket
**"Görünen listenin alacağı"** olsun (`tr.ts`). `views::total_receivable`'a
**dokunulmaz** — Faz 9 Dashboard'unun kaynağı olarak duruyor, ADR-026 §Sonuç/1.

> Bu, `VERI-MODELI §1.23`'ün "arşivlenmiş sayılır" kuralını **bozmaz**: arşivli öğrenci
> "Arşivlenmiş" çipinde görünür ve o listenin toplamına girer. Değişen tek şey,
> görünmeyen bir satırın toplama sessizce eklenmemesi.

---

## 4. Telefon alanı maskeli olsun

**Bulgu.** `faz-04.md §2` "telefon ve tarih alanları maskeli" diyordu. Tarih yapıldı
(`DatePicker` + `parseDateTr`), telefon yapılmadı: `StudentForm.tsx:255` ve
`GuardianFields.tsx:120` düz `Input`, `onChange` doğrudan `patch()` çağırıyor.

**Yapılacak.** Yazarken biçimlendiren bir sarmalayıcı — `0532 214 88 10`. `formatPhone`
zaten var (`lib/format.ts`) ama yalnızca **görüntüleme** için kullanılıyor.

Dikkat edilecekler:
- İmleç konumu: ortadan düzenlemede imleç sona atlamamalı.
- Silme çalışmalı — boşluk silinince rakam da silinmeli, kullanıcı kilitlenmemeli.
- Yapıştırma (`+90 532...`, `0090...`) kabul edilmeli.
- Kayıt hâlâ `phone_digits` normalizasyonundan geçiyor; **maske görsel, veri değil.**
- Testi `format.ts`'in test dosyasına, ortak vektörlerle.

---

## 5. K-14: arşivleme uyarısı borç tutarını yazsın

**Bulgu.** `src/i18n/tr.ts:323` — `debtWarning` borcun **varlığını** söylüyor, tutarını
yazmıyor. `PRD K-14`'ün örnek cümlesi tutarı içeriyordu.

Küçük bir iş ve **bağlayıcı kural zaten karşılanmış** (onay diyaloğu var, yıkıcı ton var,
geri alma var) — bu yüzden listenin sonunda. Mevcut cümlenin ikinci yarısı
("arşivlense de toplam alacakta sayılmaya devam eder") **korunacak**: o cümle Faz 1
denetimi A8'in ve `VERI-MODELI §1.23`'ün karşılığı, PRD'nin örneğinden daha bilgilendirici.

**Yapılacak.** `formatLira(row.debtKurus)` ile birleştir:
*"Bu öğrencinin 1.200,00 ₺ borcu var; arşivlense de toplam alacakta sayılmaya devam eder."*

---

## Bitirirken

`npm run check` yeşil olacak. Yeni test eklendiği için sayı artacak — DURUM.md'ye yaz.

Ekran görüntüsü alınacak **iki şey** var ve ikisi de Faz 4'te alınamamıştı
(macOS erişilebilirlik izni düşmüştü): **arşivleme onay diyaloğu** ve **kaydetmeden
kapatma uyarısı**. Bu oturumda alınabiliyorsa alınsın — alınamıyorsa DURUM.md'de
"doğrulanmadı" olarak kalmaya devam etsin, uydurma.

Sonra `/kapat`.
