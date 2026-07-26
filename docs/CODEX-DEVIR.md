# Codex devri

ADR-042 ile başladı ve sürüyor: `/faz-07` **bitti ve denetlendi**
(`docs/DENETIM-PARA.md`), sıradaki devir **`/faz-06` — Yoklama & Telafi**.

---

# Sıradaki prompt — `/faz-06`

```
Bu depoda /faz-06'yı (Yoklama & Telafi) yazacaksın. /faz-07 bitti ve denetlendi;
denetimin bu faza düşen üç maddesi §0'da duruyor ve İLK İŞ ONLAR.

Başlamadan önce sırayla oku:
- AGENTS.md — kurallar, dokunulmayacak yollar ve kapı
- CLAUDE.md — projenin anayasası, tamamını oku
- docs/DENETIM-PARA.md — para fazı denetiminin bulguları; P1 kritik
- .claude/commands/faz-06.md — şartnamen, §0'dan başla
- docs/VERI-MODELI.md §1.16 ve §4 — yoklama durumları ve "yoklama düzeltilirse
  ne yazılır" zinciri. SATIR SATIR OKU
- docs/DURUM.md — nerede kalındı
- docs/KARARLAR.md'de ADR-015, ADR-016, ADR-022, ADR-036, ADR-040, ADR-044

İLK MADDE — P1, ADR-044. Bugün paketli bir öğrencinin dersi işlenirse hem
package_usage(delta=-1) hem ledger_entry(session_charge) yazılıyor; paketin
taksitleri ayrıca tahakkuk ettiği için aynı ders İKİ KEZ faturalanıyor. Sebep:
resolve_unit_price yalnızca pricing_model='per_session' kayıtlarına bakıyor,
bulamayınca session.unit_price snapshot'ına düşüyor, o snapshot'ı yazan
schedule::solo_unit_price ise pricing_model'e bakmıyor. Bu fazı yazarken
charge_session'ı ÇAĞIRACAKSIN, yani mayına basacaksın. Önce düzelt:
charge_session öğrencinin aktif paketi var mı diye KENDİSİ sorsun ve paketliyse
Ok(None) dönsün — ayrımı çağırana bırakma; ayrıca solo_unit_price'a
pricing_model='per_session' filtresi ekle. Testi: paketli öğrencinin işlenen
dersi deftere satır yazmaz yalnızca hak düşer; paketsizde tam tersi.
cancel_session_financials zaten simetrik ve savunmalı — ona dokunma.

Bu kararlar KİLİTLİ, uygulanır — yeniden tartışılmaz, ADR yazılmaz:
- Yoklama durumları şemadaki dört değerdir: present, excused, unexcused,
  cancelled. Girilmemiş satır pending'dir. "Geç geldi" ve "Gelmedi" YOK.
- Mazeretli/mazeretsiz ayrımı doğrudan para etkisidir (ADR-016) ve politikası
  Tanımlar → Genel'deki iki ayardan okunur, koda gömülmez.
- Paket tüketimi BURADA KURULMAZ, kurulmuş hâlde geliyor: consume_package_credit
  ve restore_package_credit yazıldı ve testlendi (ADR-040). İkisi de yön belirtir
  ve idempotenttir. Senin işin onları ÇAĞIRMAK. İkinci bir tüketim yolu yazma.
- Yoklama düzeltmesi ikinci bir session_charge yazmaz; ters kaydın tersini yazar
  (ADR-022) ve ders hakkı tarafında zincirin bir sonraki halkasını yazar
  (ADR-036). Geldi → Mazeretli → Geldi dizisi şema seviyesinde mümkün; ekranın
  da aynı diziyi doğru üretmesi lazım.
- Telafi kısayolu YALNIZCA excused durumunda çıkar; telafi seansı işlendiğinde
  ikinci kez borç yazılmaz ve ikinci kez hak düşmez (is_makeup = 1).

Migration yazma: şema kapalı, ADR-036'nın 003_*.sql'i son değişiklikti.
attendance, package_usage, session, ledger_entry tabloları ve v_package_remaining
hazır. Bir sütuna ihtiyacın olursa dur ve sor.

ledger_entry'ye ikinci bir yazma yolu açma — repo/finance.rs'in
insert_ledger_entry / insert_reversal / charge_session / reverse_session_charge
fonksiyonlarını çağır.

Ayrıca §0'da: output/pdf/ornek-makbuz.pdf depoya commit edilmiş; git rm --cached
ile çıkar ve .gitignore'a output/ ekle.

Sırayla çalış ve HER BÖLÜMÜ AYRI COMMIT ET: §0 denetim düzeltmeleri → §1 yoklama
ekranı → §2 seans durumu ve paket tüketiminin bağlanması → §3 telafi dersi →
§3b yoklama düzeltme → §4 öğrenci detayı Dersler sekmesi → §5 devamsızlık
raporu. Her commit'ten önce `npm run check` yeşil olacak.

Para ve ders hakkı mantığına dokunan her fonksiyonun testi olacak. §6'daki test
listesine ek olarak: ekran yolundan geçen bir düzeltme zincirinden sonra HEM
defter (ADR-022) HEM ders hakkı (ADR-036) değişmezleri tutmalı.

Bitince `npm run check` çıktısını ve ekran görüntülerini göster.
```

---

# Tamamlanan devir — `/faz-07` (§1–§10)

Kararı ve sınırları **ADR-042**'de. Bu dosya devrin **uygulama yüzeyi**: Codex'e verilecek
prompt ve dönüşte denetlenecekler.

Devredilen: fiyat tarifesi · paket/taksit satışı · deftere yansıma · tahsilat · borçlu
listesi · cari ekstre · makbuz PDF · öğrenci detayının para bölümü ve testleri.
**§0 ve §4 bitti**, onlara dokunulmuyor.

## Codex'e verilecek prompt

```
Bu depoda /faz-07'yi (para fazı) yazacaksın: §1'den §10'a kadar. §0 ve §4 bitti,
onlara dokunma.

Başlamadan önce sırayla oku:
- AGENTS.md — kurallar, dokunulmayacak yollar ve kapı
- CLAUDE.md — projenin anayasası, tamamını oku
- docs/DURUM.md — nerede kalındı, neyin hazır olduğu
- .claude/commands/faz-07.md — şartnamen. "Buradan aşağısı Codex'in" başlığından
  itibaren §1–§10'un tamamı senin; her maddenin altındaki uyarılar denetimden
  geliyor, atlama
- docs/VERI-MODELI.md §3 ve §4 — defterin ve iptal/düzeltme akışlarının adım adım
  tabloları. SATIR SATIR OKU, para mantığının kaynağı bu
- docs/PRD.md — R4 ve R5 gereksinimleri
- docs/EKRANLAR.md — ekranların içeriği (sırası değil)
- docs/KARARLAR.md'de ADR-003, ADR-004, ADR-006, ADR-014, ADR-015, ADR-016,
  ADR-018, ADR-020, ADR-024, ADR-025, ADR-026, ADR-035, ADR-040, ADR-041, ADR-042

Bu kararlar KİLİTLİ, uygulanır — yeniden tartışılmaz, ADR yazılmaz:
- Paket satışı deftere satır YAZMAZ. Borç, her taksidin VADESİ GELDİĞİNDE
  ledger_entry(installment_charge) olarak doğar (ADR-015). Satışta bakiye değişmez.
- Paketli öğrencide ders işlemek deftere hiçbir satır yazmaz — yalnızca
  package_usage(delta = -1). Paketsiz öğrencide ledger_entry(session_charge).
- Tahsilat düzeltilmez, silinmez (ADR-014): iptal ters kayıtla olur ve
  payment.deleted_at ASLA doldurulmaz.
- "Aktif paket" bir sorgudur, package.status sütunu değil.
- Paket süresizdir: package.valid_until yazılmaz, satış ekranında bitiş tarihi yok.
- Paket kapatma iki dallıdır (ADR-035): avans bırak / iade et. Kalan tutar paketin
  unit_price snapshot'ından hesaplanır, indirim yeniden hesaplanmaz.

Migration yazma: §1–§9 şema değişikliği gerektirmiyor. price_rule, package,
installment, payment, payment_allocation, ledger_entry tabloları ile
v_student_debt, v_installment_open, v_student_balance, v_package_remaining
view'ları hazır; makbuz numarası tekilliği ux_receipt kısmi UNIQUE indeksinde
zaten zorlanıyor. Bir sütuna ihtiyacın olursa dur ve sor.

ledger_entry'ye ikinci bir yazma yolu açma — src-tauri/src/repo/finance.rs'in
insert_ledger_entry / insert_reversal fonksiyonlarını çağır. İki yol iki bakiye
demektir. Repo katmanı büyük ölçüde yazılmış ve testli (insert_price_rule,
insert_package, insert_installment, due_unaccrued_installments, insert_payment,
insert_payment_allocation, views::student_debts, consume_package_credit); senin
işin komut yüzeyi, ekranlar ve iş akışı. Tablo katmanını yeniden icat etme.

accrue_due_installments(today) repo/ops.rs > on_startup'a girer, idempotenttir ve
today PARAMETREDİR — SQL'de date('now') kullanma.

Sırayla çalış ve HER BÖLÜMÜ AYRI COMMIT ET: §1 tarife → §2 paket/taksit satışı →
§3 deftere yansıma → §5 tahsilat → §6 borçlu listesi → §7 cari ekstre → §8 makbuz
PDF → §9 öğrenci detayı. Her commit'ten önce `npm run check` yeşil olacak. Tek
büyük commit atma: main üzerinde çalışıyorsun, geri alma yolu git revert ve bir
bölüm geri alınırken ötekiler ayakta kalmalı.

Para ile ilgili yazdığın her fonksiyonun testi olacak — bu pazarlık konusu değil.
§10'daki test listesinin tamamı senin. Testsiz fonksiyon bırakma.

Bitince `npm run check` çıktısını ve örnek bir makbuz PDF'ini göster.
```

## Dönüşte denetlenecekler

Denetim ayrı bir oturum değil: **para fazı sonrasındaki zorunlu denetim** (ADR-033) artık
`/faz-07`'nin tamamını okur. Diff'te özellikle bakılacaklar:

| Ne | Nasıl bakılır |
|---|---|
| İkinci defter yolu | `insert_ledger_entry` / `insert_reversal` dışında `INSERT INTO ledger_entry` var mı |
| ADR-015 ihlali | Paket satışında `ledger_entry` yazılıyor mu — **yazılmamalı**; borç vade tahakkukundan doğmalı |
| Kuruş aritmetiği | `f64`/`f32` grep'i; yuvarlama yapılan yer var mı; indirim hesabı tam sayıda mı |
| Fiyat snapshot'ı | Tarife değişince eski seans/paket tutarı oynuyor mu (ADR-006) |
| `resolve_unit_price` | Fiyat bulunamayınca sessizce 0 mı yazıyor — **hata vermeli** (K-23) |
| Tahakkuk idempotency | `accrue_due_installments` iki kez koşunca ikinci borç yazıyor mu; `today` bind mi |
| Mahsup | Toplam ödemeyi aşıyor mu (K-9); otomatik mahsup en eski vadeden mi başlıyor; vadesi gelmemiş taksitleri de kapsıyor mu |
| Makbuz numarası | Rezervasyon modal **açılırken** mi (K-19); tekrarsız ve atlamıyor mu |
| `payment.deleted_at` | İptal akışında dolduruluyor mu — **doldurulmamalı** |
| PDF Türkçe | Gömülü font kanıtı: test mi, çıktı görseli mi |
| Arayüz iş bölümü | Arama/filtre Rust'ta, çipler ve sıralama arayüzde, sayfalama `lib/paginate.ts` (ADR-025) |
| Metinler | `src/i18n/tr.ts`'te mi; JSX'te çıplak Türkçe kalmış mı; kurum adı `tr.ts`'e sızmış mı (ADR-024) |
| Kapsam taşması | `docs/**`, `.claude/**`, `migrations/**`, `pages/takvim/**` diff'te görünüyor mu |
| Commit disiplini | Bölümler ayrı mı, yoksa tek yığın mı geldi (revert edilebilirlik) |
