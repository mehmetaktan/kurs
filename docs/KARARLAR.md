# Kararlar

Bu dosyadaki kararlar **kilitlidir**. Yeni bir oturum bunları yeniden tartışmaz, uygular.
Bir kararı değiştirmek gerekiyorsa: eski ADR'yi `Durum: Değiştirildi` yap, yeni numaralı ADR ekle, gerekçesini yaz.

Format: her ADR'de **Karar / Gerekçe / Sonuç / Durum**.

---

## ADR-001 — Stack: Tauri 2 + React + TypeScript + Vite + SQLite

**Karar.** Masaüstü uygulaması Tauri 2 ile paketlenir. Arayüz React + TypeScript + Vite. Veri SQLite dosyasında.

**Gerekçe.** Tek kullanıcı, tek bilgisayar, internet bağımlılığı yok. Tauri çıktısı Electron'a göre ~10× küçük ve daha az RAM tüketiyor. SQLite tek dosya olduğu için yedekleme "dosyayı kopyala"ya indirgeniyor — teknik olmayan kullanıcı için kritik.

**Sonuç.** Rust toolchain kurulumu gerekiyor. Sunucu, hesap, giriş ekranı, senkronizasyon yok.

**Durum.** Kabul edildi.

> **Not (2026-07-25).** Gerekçedeki *"yedekleme dosyayı kopyalamaya indirgeniyor"* ifadesi
> **ADR-019** ile netleştirildi: WAL modunda çalışan bir veritabanının `.db` dosyasını
> kopyalamak boş yedek üretir. Sonuç kullanıcı açısından aynı (tek dosya), yöntem farklı.

---

## ADR-002 — Veri erişimi Rust komut katmanında

**Karar.** Frontend SQL yazmaz. Her veri işlemi Rust'ta bir `#[tauri::command]` fonksiyonu ve altındaki repository katmanı üzerinden yapılır. `tauri-plugin-sql` kullanılmaz.

**Gerekçe.** Para hesapları, transaction bütünlüğü ve ledger mantığı arayüz koduna dağılırsa test edilemez ve sessizce bozulur. Rust tarafında toplandığında in-memory SQLite ile test edilebilir hale gelir.

**Sonuç.** Daha fazla Rust kodu yazılır ve her yeni ekran için komut tanımlamak gerekir. Karşılığında iş mantığı tek yerde ve testli.

**Durum.** Kabul edildi.

---

## ADR-003 — Tutarlar kuruş cinsinden tam sayı

**Karar.** Bütün para alanları `i64` ve kuruş cinsinden saklanır. `1.234,56 ₺` → `123456`. Kayan noktalı sayı hiçbir yerde kullanılmaz.

**Gerekçe.** Float aritmetiği kuruş yuvarlama hataları üretir; kısmi ödeme ve paket bölüşümünde bu hatalar birikir ve bakiye tutmaz.

**Sonuç.** Biçimlendirme ve ayrıştırma tek bir yardımcı modülde toplanır (`src/lib/format.ts` + Rust karşılığı).

**Durum.** Kabul edildi.

---

## ADR-004 — Muhasebe cari hareket defteri (ledger) ile

**Karar.** Öğrenci bakiyesi bir sütunda saklanmaz. `ledger_entry` tablosuna borç ve alacak satırları yazılır; bakiye bu satırların toplamıdır.

**Gerekçe.** "Bu öğrenci neden 1.500 TL borçlu?" sorusunun cevabı verilebilir olmalı. Saklanan bakiye ilk tutarsızlıkta sessizce yanlışa döner ve geri dönüşü yoktur; defter kendini açıklar.

**Sonuç.** Her ders işleme, iptal, paket satışı ve tahsilat defterle satır yazar. Ekstre ekranı doğal olarak ortaya çıkar.

**Durum.** Kabul edildi.

---

## ADR-005 — Soft delete, hard delete yok

**Karar.** Kayıtlar silinmez, `deleted_at` damgalanır. Arayüzde "Sil" değil "Arşivle" denir ve geri alınabilir.

**Gerekçe.** Kullanıcı teknik değil ve tek başına çalışıyor; yanlışlıkla silinen bir öğrenciyi kurtaracak kimse yok. Ayrıca silinen öğrencinin geçmiş tahsilatları muhasebe kaydı olarak durmak zorunda.

**Sonuç.** Her sorguda `deleted_at IS NULL` filtresi. Arşivlenmişleri gösteren ayrı görünüm gerekir.

**Durum.** Kabul edildi.

---

## ADR-006 — Fiyat snapshot'ı

**Karar.** Seans ve paket kayıtlarına, oluşturuldukları andaki birim ücret kopyalanır. Tarife değişince geçmiş kayıtların tutarı değişmez.

**Gerekçe.** Eylül'de ücret zammı yapıldığında Mart ayının tahsilat raporu değişmemeli.

**Sonuç.** `price_rule` tablosu güncel tarifeyi tutar; geçmiş kayıtlar kendi tutarını taşır.

**Durum.** Kabul edildi.

---

## ADR-007 — Kod İngilizce, arayüz Türkçe

**Karar.** Kod, veritabanı tabloları, dosya ve değişken adları İngilizce. Kullanıcıya görünen tüm metinler Türkçe ve `src/i18n/tr.ts` içinde toplanır. JSX içinde çıplak Türkçe metin bulunmaz.

**Gerekçe.** Karışık adlandırma (`ogrenci.createdAt`) okunmuyor. Metinlerin tek dosyada olması yazım hatalarını ve terim tutarsızlığını tek yerden düzeltilebilir kılıyor.

**Sonuç.** Yeni metin eklerken önce `tr.ts`'e anahtar açılır.

**Durum.** Kabul edildi.

---

## ADR-008 — Hedef Windows, derleme CI'da

**Karar.** Ürün Windows'a teslim edilir. Geliştirme macOS'ta yapılır, Windows kurulum dosyası GitHub Actions'ta derlenir. CI, Faz 2'de kurulur — sona bırakılmaz.

**Gerekçe.** macOS'tan doğrudan Windows `.msi` üretilemiyor. Bu iş son haftaya bırakılırsa proje bitmişken teslim edilemez hale gelir. Erken kurulan CI, her push'ta test edilebilir bir kurulum dosyası üretir.

**Sonuç.** Platforma özel kod yazılmaz. İlk gerçek Windows testi Faz 5 sonunda yapılır, Faz 10'a bırakılmaz.

**Durum.** Kabul edildi.

> **Netleştirme (2026-07-25).** **Geliştirme döngüsünde hiçbir Windows makine yok** — ne
> fiziksel ne sanal. Geliştirici `.msi`'yi indirmez, kurmaz, açmaz; Windows'a dair her
> doğrulama `windows-latest` CI işiyle yapılır. Faz 5 sonundaki "ilk gerçek Windows testi"
> **kurs sahibinin kendi bilgisayarında** yapılır; ona gönderilecek paket CI artifact'idir.
> Bu, CI'ın ne zaman kurulacağını değil, kimin neyi doğruladığını netleştirir — karar aynı.

---

## ADR-009 — WhatsApp/SMS hatırlatma v2'ye ertelendi

**Karar.** MVP'de otomatik mesaj gönderimi yok. Veri modelinde `guardian.phone` ve `last_reminded_at` alanları hazır bırakılır, başka bir şey yapılmaz.

**Gerekçe.** SMS sağlayıcısı aylık ücret, API anahtarı yönetimi ve başlık başvurusu getiriyor; WhatsApp Business API onay süreci istiyor. İkisi de çekirdek değeri (kim ne kadar borçlu, bugün kimin dersi var) geciktirir.

**Sonuç.** v2'de en olası yol `wa.me` deep link — sıfır maliyet, onay süreci yok, kurs sahibinin kendi numarasından gider.

**Durum.** Kabul edildi.

---

## ADR-010 — Tasarım kaynağı Claude Design, DesignSync ile okunur

**Karar.** Görsel tasarımın tek kaynağı `Özel ders kursu yönetim arayüzü` adlı Claude Design projesi. Kod tarafına `DesignSync` aracıyla okunur; ayrı MCP sunucusu kurulmaz. Ayrıntı: `docs/TASARIM-KAYNAGI.md`.

**Gerekçe.** DesignSync bu projeyi doğrudan okuyabildiği doğrulandı (`list_files` çalışıyor). Ekstra bağımlılığa gerek yok.

**Sonuç.** Tasarımda olmayan ekranlar (tahsilat, yoklama, paket, raporlar) aynı görsel dilde bizim tarafımızdan tasarlanır ve `docs/TASARIM-SISTEMI.md`'ye uyar.

**Durum.** Kabul edildi.

---

## ADR-011 — MVP tek öğretmenli, şema çok öğretmenli

**Karar.** `teacher` tablosu kurulur ve tek satır içerir (kurs sahibi). Arayüzde takvimin öğretmen filtresi ve Gün görünümünün öğretmen-başına-sütun düzeni **kurulmaz**; Gün görünümü tek sütundur.

**Gerekçe.** Tasarımın tamamı öğretmen kavramı üzerine kurulu — ders bloğunun meta satırı, notun yazarı, çakışma kuralı, grubun sorumlusu. Kurs sahibi tek başına ders veriyor, ama tabloyu atlamak ikinci öğretmen çıktığında migration + veri taşıma demek. Tabloyu kurup arayüzü sadeleştirmek bedava; tersi pahalı.

**Sonuç.** Tek öğretmen olduğu için "aynı saatte iki ders" fiziksel olarak imkânsız — çakışma uyarısı önem kazanır ve kaydetmeden önce onay diyaloğu çıkar. `subject.color` kategori paletinin asıl kullanım yeri olur.

**Durum.** Kabul edildi.

---

## ADR-012 — Birebir ve grup dersi tek `session` tablosunda

**Karar.** Tek `session` tablosu; `student_id` ve `study_group_id` **dışlayıcı** (`CHECK ((student_id IS NOT NULL) <> (study_group_id IS NOT NULL))`). `kind` sütunu bu ikisinden `GENERATED ALWAYS AS ... STORED` ile türetilir, elle yazılmaz.

**Gerekçe.** Takvim, Bugün listesi, yoklama, telafi ve defter tahakkuku her iki tipi de aynı şekilde işliyor. Ayrı tablo her takvim sorgusunu `UNION ALL`'a, her indeksi iki kopyaya, her komutu iki kod yoluna çevirirdi. Dışlayıcı CHECK, "tipi grup ama grubu boş" kaydını fiziksel olarak imkânsız kılıyor — `type TEXT` sütunundan farkı bu.

**Sonuç.** İki nullable yabancı anahtar taşınır. Karşılığında tek kod yolu ve tek indeks seti.

**Durum.** Kabul edildi.

---

## ADR-013 — `group_member` yerine `enrollment`

**Karar.** Ayrı bir `group_member` tablosu yoktur. `enrollment` hem gruba katılım aralığını (`start_on` / `end_on`) hem tarifeyi taşır. Birebir kayıtlarda `study_group_id` NULL'dur.

**Gerekçe.** Tasarımın "Kayıtlar" sekmesi zaten bu tabloyu gösteriyor: kurs/grup, tarife, başlangıç, taksit durumu. Katılım aralığını iki ayrı tabloda tutmak, ikisinin çelişme ihtimalini yaratır ve "hangisi doğru?" sorusunu doğurur.

**Sonuç.** "Kaç dersten sorumlu" bir alan değil, `enrollment` aralığına göre bir seans sayımıdır. Aralık dışı yoklama `trg_attendance_within_enrollment` tetikleyicisiyle veritabanı seviyesinde reddedilir. Gruptan ayrılıp dönen öğrenci = çakışmayan iki `enrollment` satırı.

**Durum.** Kabul edildi.

---

## ADR-014 — Bakiye işareti ve defterin değişmezliği

**Karar.** `ledger_entry.amount` işaretlidir: `(+)` öğrencinin lehine, `(−)` aleyhine. `bakiye = SUM(amount)`; **negatif = borçlu**. Yazılan satır güncellenmez ve silinmez; düzeltme yalnızca `reversal` satırıyla yapılır. İki tetikleyici (`trg_ledger_immutable`, `trg_ledger_no_delete`) bunu mühürler.

**Gerekçe.** Tasarımın Öğrenciler ve Öğrenci detayı ekranları negatifi borç olarak gösteriyor (`balance:-1200` → kırmızı). Bugün ekranı aynı borcu pozitif tutuyor — tasarımın kendi içindeki tutarsızlığı; iki detaylı ekranın konvansiyonu seçildi. Değiştirilebilen defter satırı, ADR-004'ün "defter kendini açıklar" vaadini bozar.

**Sonuç.** Bugün ekranı `ABS(bakiye)` gösterir. Arayüzde eksi işareti U+2212 (`−`), ASCII tire değil. `ledger_entry.deleted_at` sütunu şema tekdüzeliği için vardır ama her zaman NULL kalır.

**Durum.** Kabul edildi.

---

## ADR-015 — Paket satışı deftere taksit taksit, vadesi geldikçe yansır

**Karar.** Paket satıldığında deftere borç yazılmaz; `package` ve `installment` satırları oluşur. Her taksidin **vadesi geldiğinde** bir `installment_charge` satırı yazılır. Paketli öğrencide **ders işlemek deftere hiçbir satır yazmaz** — yalnızca `package_usage(delta=−1)` eklenir.

**Gerekçe.** İki alternatif elendi. (a) Satışta tek kalem tam tutar: dönemlik paket alan öğrenci gün 1'de tüm tutar kadar borçlu görünür, borçlu listesi kullanılamaz hâle gelir. (b) Ders başına tahakkuk (hasılatı teslimde tanımak): muhasebe açısından daha doğru ama paketi alıp hiç ödemeyen öğrenci bakiye 0 görünür — borçlu listesi yalan söyler; ayrıca "12 gün gecikti" hesaplanamaz.

**Sonuç.** Para (`ledger_entry`) ve ders hakkı (`package_usage`) iki ayrı sayaçtır. Tasarımdaki "Bakiye" ve "Kalan ders" kutularının ayrı olmasının sebebi budur. Vade tahakkuku uygulama açılışında idempotent bir fonksiyonla çalışır. Ertelenmiş gelir raporu gerekirse aynı şemadan üretilebilir (`kalan ders × unit_price`) — bu seçim veri kaybettirmiyor.

**Durum.** Kabul edildi.

---

## ADR-016 — Devamsızlık politikası

**Karar.** Mazeretli devamsızlıkta ders hakkı düşmez, borç yazılmaz, telafi hakkı doğar. Mazeretsiz devamsızlıkta ders hakkı düşer ve borç yazılır. Bu davranış `setting.absence_excused_consumes_lesson` ve `setting.absence_unexcused_consumes_lesson` anahtarlarından okunur; koda sabitlenmez.

**Gerekçe.** Tasarımda "Mazeretli" ve "Mazeretsiz" ayrı iki durum ve ders geçmişinde "Telafi planla" düğmesi var — ayrımın bir sonucu olması gerekiyor, yoksa iki durum tutmanın anlamı yok.

**Sonuç.** Telafi seansı (`is_makeup = 1`) işlendiğinde ikinci kez borç yazılmaz ve ikinci kez hak düşmez; asıl dersin hakkı zaten düşmemişti.

**Durum.** Kabul edildi.

---

## ADR-017 — Tarih ve saat yerel duvar saati metni olarak saklanır

**Karar.** `starts_at` / `ends_at` gibi alanlar `'YYYY-MM-DD HH:MM'` metni olarak, yerel duvar saatiyle saklanır. UTC'ye çevrilmez, zaman dilimi taşınmaz.

**Gerekçe.** Tek makine, tek ülke, sunucu yok. UTC'ye çevirirsek yaz saati uygulaması değiştiğinde 16:00'daki ders 15:00'e kayar — kurs sahibinin gözünde program kendiliğinden bozulmuş olur. Metin biçimi sıralanabilir ve karşılaştırılabilir olduğu için indeksleme de sorun değil.

**Sonuç.** `session.session_date` sütunu `substr(starts_at, 1, 10)` ile türetilir ve takvim sorgularında kullanılır. Uygulama başka bir zaman dilimine taşınırsa saatler olduğu gibi kalır — istenen davranış budur.

**Durum.** Kabul edildi.

> **Uygulama notu (2026-07-25 denetimi).** SQLite'ın `datetime('now')` fonksiyonu `TZ` ortam
> değişkeninden bağımsız olarak **daima UTC** döner — yani bu kararın şemadaki ilk uygulaması
> kararın tersiydi. Kural: **SQL içinde `'now'` çıplak kullanılmaz.** Kullanıcıya görünen hiçbir
> hesap SQLite saatini okumaz; tarih Rust'tan `chrono::Local` ile bind edilir. Yalnızca denetim
> sütunlarının `DEFAULT`'unda `'localtime'` ile kullanılır. Ayrıntı: `docs/VERI-MODELI.md §0`.

---

## ADR-018 — Borçlu listesinin tek kaynağı defterdir

**Karar.** *"Kim ne kadar borçlu?"* sorusu **yalnızca `ledger_entry`'den** cevaplanır. Borç tutarı bakiyenin negatif kısmıdır. Vade, borç satırının kendi vadesidir: taksit borcunda `installment.due_on`, ders başı borcunda `entry_date` (ders günü). Borçlu listesi, Bugün ekranındaki borç bölümü ve menüdeki borç rozeti `v_student_debt` zincirinden okur. Eski `v_student_overdue` view'ı, daralan görevini yansıtan `v_installment_open` adıyla yeniden yazılır: yalnızca taksit/vade ekranları (E14 "Bu ay vadesi gelen" çipi, paket detayındaki `2/4 ödendi`). Vade filtresi de içinden çıkarılır — "bugün" Rust'tan bind edilir.

**Gerekçe.** ADR-004 bakiyeyi zaten deftere bağlamıştı; borçlu listesini `installment` tablosuna bağlamak **ikinci bir borç tanımı** yarattı. Ders başı (`per_session`) ödeyen öğrenci hiç `installment` satırı üretmediği için aylarca ödemese bile borçlu listesinde hiç görünmüyordu — aynı öğrenci Öğrenciler ekranında kırmızı `−1.000 TL`, Bugün ekranında yoktu. PRD §0 bu sorunun yanlış cevaplanmasını "uygulama başarısızdır" olarak tanımlıyor. Ters yönde de bozuktu: mahsup edilmemiş (avans) tahsilat bakiyeyi sıfırlarken view hâlâ borç gösteriyordu.

**Sonuç.** İki rakip view yerine defter tabanlı tek zincir: `v_ledger_effective` (ters kayıtları netler) → `v_open_charge` (her borç kendi vadesiyle) → `v_student_debt` (FIFO yaşlandırma). `installment` tablosu vade ve mahsup ekranlarında yerinde kalır. Tahsilat iptal edilirse ilgili `payment_allocation` satırları arşivlenir, taksit kendiliğinden yeniden açılır.

**Durum.** Kabul edildi.

---

## ADR-019 — Yedekleme `VACUUM INTO` ile alınır, dosya kopyalanmaz

**Karar.** Yedek `VACUUM INTO 'hedef.db'` ile üretilir; veritabanı dosyası kopyalanmaz. Geri yükleme hedefteki `-wal` ve `-shm` dosyalarını da temizleyen tek bir işlemdir ve **işlemden önce mevcut veritabanının otomatik kopyasını alır**. Yedek doğrulaması "dosya bozuk mu" değil, "beklenen tablolar ve makul satır sayıları var mı" sorusudur.

**Gerekçe.** Şema `PRAGMA journal_mode = WAL` kullanıyor. WAL'da commit edilmiş veri, checkpoint olana kadar ana `.db` dosyasında değil `.db-wal` dosyasında durur. "Şimdi yedekle" düğmesi tanımı gereği uygulama açıkken basılır; yalnızca `.db` kopyalanırsa yedek **boş çıkar**. Daha kötüsü `PRAGMA integrity_check` bu dosyayı `ok` der — dosya bozuk değil, geçerli ve boş. Aynı arıza ters yönde de var: geri yüklemede eski `-wal` yerinde kalırsa SQLite onu uygular ve kullanıcı yedeği geri yükler, ekranda hiçbir şey değişmez. Kullanıcı teknik değil, tek başına çalışıyor ve verisini kurtaracak kimsesi yok; bu senaryonun sonu tam veri kaybı.

**Sonuç.** Kullanıcı açısından hiçbir şey değişmiyor — yedek hâlâ tek bir dosya. ADR-001'in gerekçesindeki "dosyayı kopyala" ifadesi bu ADR ile netleşti. Faz 2'de WAL kararı verilirken yedekleme yöntemi biliniyor olacak; Faz 10 bunu uygular.

**Durum.** Kabul edildi.

---

## ADR-020 — Türkçe sıralama uygulama katmanında, SQL'de değil

**Karar.** Türkçe metin kolonlarında (`student.full_name`, `guardian.full_name`, `study_group.name`, `subject.name`, `teacher.full_name`, tarife adları) SQL'de `ORDER BY` **yazılmaz**. Bu kolonlara göre sıralama tek yerde, `src/lib/sortTr.ts` içindeki tek bir `Intl.Collator('tr')` ile yapılır; repository katmanı bu listeleri sırasız döndürür. Yasak yalnızca Türkçe metin kolonları içindir — tarih, tutar, sayı ve `sort_order` kolonlarında `ORDER BY` serbest ve gereklidir.

**Gerekçe.** SQLite'ta `localeCompare('tr')` karşılığı yok; `COLLATE NOCASE` ASCII-only. `ORDER BY full_name` yazılırsa Ç/Ö/Ş/Ü/İ ile başlayan her öğrenci listenin en altına, Z'den sonraya düşer — ilk açılışta gözle görülür ve teknik olmayan kullanıcıya "program bozuk" dedirtir. Alternatif olan Rust'a kayıtlı özel collation reddedildi: `CREATE TABLE`/`CREATE INDEX` içine yazılan özel bir collation adı, `.db` dosyasını **başka hiçbir araçla açılamaz** hale getirir — ADR-019'un yedek doğrulaması ve olası bir kurtarma işlemi bundan zarar görür.

**Sonuç.** ~100 öğrenci ölçeğinde maliyet ölçülemez. Arama tarafı ayrı bir mekanizmadır ve şemada kalır: `student`, `subject` ve `study_group` tablolarında Rust'ta üretilen `search_name` sütunu (`§0 K8`).

**Durum.** Kabul edildi.

---

## ADR-021 — Veri içe aktarma yok

**Karar.** MVP'de Excel/CSV içe aktarma özelliği yazılmaz. Kurs sahibi verisini sıfırdan girer.

**Gerekçe.** PRD §9 S1 kurs sahibine soruldu, cevap: aktarılacak dijital veri yok (2026-07-25). Varsayım doğrulandığı için soru kapandı.

**Sonuç.** Faz 4 planlandığı gibi kalır, bölünmesi gerekmiyor. **Dışa** aktarma kapsamda kalır (cari ekstre CSV, BOM'lu UTF-8 — R4.15). İleride gerçek bir aktarım ihtiyacı doğarsa ayrı bir ADR ile açılır.

**Durum.** Kabul edildi.

---

## ADR-022 — Ters kayıt zinciri uçtan uca netlenir (zincir paritesi)

**Karar.** `v_ledger_effective` "ters kaydedilmiş satırı ve ters kaydın kendisini at" kuralıyla değil, **ters kayıt zincirinin uzunluğuna** göre tanımlanır: her zincir, ters kaydı olmayan (`kind <> 'reversal'`) bir **başlık satırından** başlar; zincir **tek** uzunluktaysa başlık satırı geçerlidir, **çift** uzunluktaysa zincir tümüyle düşer. Uygulama Faz 3'te `002_ledger_effective_parity.sql` migration'ıyla gelir; `ledger_entry` tablosuna, kısmi UNIQUE indekslere ve kullanıcı akışına dokunulmaz.

Bu tanımın getirdiği ve testle çivilenen değişmez:

> **Her öğrenci için `SUM(v_ledger_effective.amount) = v_student_balance.balance_kurus`.**

**Gerekçe.** Eski tanım zincirin en fazla **iki** halkalı olacağını varsayıyordu (borç + tersi). `VERI-MODELI.md §4`'ün yoklama düzeltme akışı ise üç halkalı bir zincir üretiyor (Geldi → Mazeretli → Geldi) ve şema buna izin veriyor. Sonuç: aynı öğrenci Öğrenci detayında **−250 ₺ borçlu**, borçlu listesinde **borçsuz** görünüyordu — ADR-018'in ortadan kaldırmak için yazıldığı arızanın aynısı, bu kez tek bir view'ın içinde.

Denetimde `sqlite3` ile sekiz senaryo çalıştırıldı ve **ikinci, o güne kadar görülmemiş bir arıza** çıktı: iptal edilmiş bir tahsilatın iptalini geri almak (tahsilat → ters kayıt → ters kaydın tersi) borcu olmayan öğrenciyi borçlu listesine **yanlışlıkla sokuyordu**. İki arızanın kök sebebi aynı: zincir uzunluğu varsayımı. Parite tanımı ikisini birden kapatıyor ve doğruluğu tek bir değişmeze indirgiyor — bakiye ile borçlu listesi artık **yapı gereği** aynı deftere bakıyor.

Elenen iki seçenek: (a) düzeltmenin üçüncü adımında yeni bir `session_charge` yazmak — `ux_ledger_attendance` gevşetilmeliydi, yani aynı yoklamanın iki kez ücretlendirilmesini engelleyen mühür bir view hatası uğruna feda edilirdi (PRD K-4/K-5). (b) ters kaydın tersini yasaklamak — muhasebede meşru bir işlem şema seviyesinde yasaklanır, kullanıcı yoklamayı iptal edip yeniden girmek zorunda kalır, telafi bağlantıları ve paket kullanım satırları arşivlenmiş bir yoklamayı işaret ederdi.

**Sonuç.** View içinde bir `WITH RECURSIVE` bulunur. Zincirler doğrusaldır: `ux_ledger_reverses` bir satırın en fazla bir kez ters kaydedilmesini garanti eder, dallanma imkânsızdır. Döngü de imkânsızdır — `reverses_id` var olan bir satırı işaret etmek zorundadır (yabancı anahtar) ve `trg_ledger_immutable` her `UPDATE`'i reddeder (K5), dolayısıyla zincir daima geriye doğru gider. `~100` öğrenci ölçeğinde maliyet ölçülemez.

Ters kayıt satırları hâlâ `v_ledger_effective`'te görünmez (geçerli olan daima başlık satırıdır), dolayısıyla `v_open_charge`'ın vade mantığı — taksitte `installment.due_on`, ders başında ders günü — olduğu gibi korunur. `package_usage` tarafındaki düzeltme zinciri bu ADR'nin **kapsamı dışındadır**; ders hakkı ayrı bir sayaçtır (ADR-015) ve kararı Faz 6'ya aittir (`faz-06.md §3b`).

**Durum.** Kabul edildi.

---

## ADR-023 — Yönlendirme kendi hash router'ımızla, kütüphanesiz

**Karar.** Sayfa yönlendirmesi `src/lib/router.ts` içindeki ~120 satırlık hash tabanlı çözümle yapılır: `parseHash`, `matchRoute`, `resolveRoute`, `useRoute`, `navigate`. Yönlendirme kütüphanesi (react-router-dom) kurulmaz. Rota ve menü tablosu tek yerde, `src/shell/routes.ts` içinde durur.

**Gerekçe.** İhtiyaç 7 üst düzey sayfa ve `/ogrenciler/:id` biçiminde birkaç detay rotası. Bunun için gereken tek şey desen eşleştirmesi; iç içe yerleşim, veri yükleyici, kod bölme ya da sunucu tarafı render yok ve olmayacak (masaüstü, tek pencere, çevrimdışı).

Hash seçilmesinin ayrı bir sebebi var: uygulama `tauri://localhost` üzerinden tek bir `index.html` ile servis ediliyor. History API kullanılsaydı `/ogrenciler/42` adresinde yenileme yapıldığında WebView2 o yolda bir dosya arar ve boş pencere açardı. Hash'te bu arıza sınıfı yok, geri/ileri tuşları da çalışmaya devam ediyor.

Kütüphane tarafında ise bakım yükü var: react-router 7 "framework mode"a doğru evriliyor, SPA kullanımı ikincil hâle geliyor. Kilitli bir sürümde kalmak da sürüm yükseltmelerinde kırılma riskini ileri bir tarihe atmak demek. Aynı muhakemeyle ikon kütüphanesi de kurulmadı (`TASARIM-SISTEMI.md` §5).

**Sonuç.** Kütüphanenin bedava verdiği güvence testle satın alınıyor: `src/lib/router.test.ts` desen eşleştirmesini, sondaki eğik çizgiyi, yüzde kodlamasını, boş parametrenin reddini ve rota sırasını çiviliyor. Sıra bağlayıcı — sabit yollar parametreli yollardan **önce** yazılır, yoksa `/ogrenciler/yeni` adresi `:id = 'yeni'` olarak eşleşir; bu da testte yazılı.

Bir yan etkisi: "içeriğe atla" bağlantısı `<a href="#icerik">` olamıyor, çünkü hash'i yazmak rotayı değiştirir. Onun yerine odağı programla taşıyan bir düğme kullanılıyor (`AppShell`).

İhtiyaç büyürse (iç içe yerleşim, geçiş animasyonu, rota bazlı kod bölme) bu karar yeniden değerlendirilir; rota tablosu tek dosyada olduğu için geçiş maliyeti düşük.

**Durum.** Kabul edildi.

---

## ADR-024 — Ürün kimliği Aktansoft'un, kurum kimliği derleme zamanı config dosyasından

**Karar.** İki ayrı kimlik var ve karıştırılmaz.

**Ürün kimliği — sabit, Aktansoft'a ait.** Değişkene bağlanmaz, ayarlardan düzenlenmez:

| Ne | Değer | Nerede |
|---|---|---|
| Ürün adı | `Kurs Takip` | `tauri.conf.json > productName`, pencere başlığı, `.msi` adı, Başlat menüsü |
| Uygulama kimliği | `com.aktansoft.kurstakip` | `tauri.conf.json > identifier` **ve** `src-tauri/src/db/mod.rs > APP_IDENTIFIER` |
| Yayıncı / geliştirici | `Aktansoft` | `Cargo.toml > authors`, `bundle > publisher`, telif satırı |
| Kenar çubuğu 1. satır | `Kurs Takip` | `tr.app.brand` — bugünkü `DersTakip` değeri **yanlış**, hiçbir yerde karşılığı olmayan ayrı bir ad |

**Kurum kimliği — müşteriye ait, derleme öncesi düzenlenir.** Tek kaynağı depodaki
`config/kurum.json` dosyasıdır:

```json
{
  "institutionName": "Aydın Özel Ders",
  "receipt": { "address": "", "phone": "" }
}
```

`institutionName` kenar çubuğunun ikinci satırında ve makbuz başlığında (PRD R4.11)
görünür. `receipt.address` / `receipt.phone` PRD'nin **istemediği** alanlardır; boş
bırakıldıklarında makbuza **basılmazlar**. Faz 8'de gerçek bir makbuzun bunları istediği
görülürse dosya biçimi yeniden açılmasın diye şimdiden yer ayrıldı; boş varsayılan
davranışı değiştirmez.

Dosya **iki taraftan da derlemeye gömülür**: TypeScript `src/config/brand.ts` üzerinden
tipli okur, Rust `include_str!` ile derleme anında gömer (Faz 8 makbuzu aynı kaynağı
okumak zorunda). Çalışma anında dosya okuması **yoktur**.

**Gerekçe.** Bugün kodda dört farklı ad dolaşıyordu: `Kurs Takip` (ürün), `DersTakip`
(kenar çubuğu), `Aydın Özel Ders` (kurum, hem `tr.ts`'te hem `setting` tablosunda) ve
`com.aydinozelders` (uygulama kimliği). Kurum adının uygulama kimliğine sızmış olması
asıl sorun: `%APPDATA%\com.aydinozelders.kurstakip\kurs.db` yolu **müşteri adını taşıyor**,
yani ikinci bir müşteride ya yanlış klasör adı kullanılacak ya veritabanı taşınacak.

Kurum kimliğinin derleme zamanına alınmasının bedeli bilinerek kabul edildi: **kurs sahibi
kurum adını kendi değiştiremez.** Değişiklik yeniden derleme ve yeni bir `.msi` gerektirir.
Karşılığında teslim edilen pakette müşteriye özel tek bir metin dosyası düzenlenir ve
mühürlü migration'a dokunulmaz. Tek müşteri, geliştiriciye doğrudan erişim ve yılda bir
değişmeyecek bir ad göz önüne alındığında takas makul.

Çalışma anı yerine derleme anı gömme, ADR-008'in doğrudan sonucu: çalışma anında okunan
bir config dosyası Windows'ta bir dosya yolu, bir kodlama (BOM'lu UTF-8), bir "kullanıcı
dosyayı sildi" ve bir "OneDrive klasörü senkronize etti" arıza sınıfı açardı. Gömülü
metinde bunların hiçbiri yok.

**Sonuç.** Üç şey bunun peşinden gelir:

1. **`setting.institution_name` satırı artık okunmaz.** Migration `001_initial.sql`
   mühürlü ve checksum'lı olduğu için satır **yerinde kalır**; uygulama onu okumaz,
   `app_status.institution_name` alanı config'ten döner. `VERI-MODELI.md §1.2` ve
   `crud.rs`'teki testi bu notla işaretlenir. Bu, ADR-018'in "tek kaynak" disiplininin
   ayarlara uygulanmış hâli: iki yerde duran bir değer er geç ikiye ayrılır.
2. **`EKRANLAR.md E18` (Tanımlar → Genel) kapsamından kurum adı çıkar.** O ekranda
   çalışma saatleri, satır yoğunluğu, devamsızlık politikası ve makbuz öneki kalır —
   hepsi kurs sahibinin gerçekten değiştirdiği, işletmeye dair değerler.
3. **`APP_IDENTIFIER` ile `tauri.conf.json > identifier` eşitliği teste bağlanır.** Bugün
   yalnızca bir yorum satırı koruyor. İkisi ayrışırsa seed binary'si ile uygulama **farklı
   klasörlere** yazar; kurs sahibi verisinin kaybolduğunu sanır, oysa veri başka bir
   `%APPDATA%` klasöründedir. Sessiz ve teşhisi zor bir arıza — kimlik değişikliği tam da
   bu riski canlı hâle getirdiği için mühür aynı fazda atılır.

Kimlik değişikliği **kurs sahibinin makinesinde gerçek veri oluşmadan önce** yapılmak
zorunda; sonrasında maliyeti bir veri taşıma işi ve bir destek görüşmesidir. Bu yüzden
Faz 4'ün §0'ıdır, Faz 10'a bırakılmaz.

**Durum.** Kabul edildi.

---

## ADR-025 — Liste ekranlarının iş bölümü: arama Rust'ta, sıralama ve sayfalama arayüzde

**Karar.** Her liste ekranı (Öğrenciler, Gruplar, Borçlular, Raporlar…) aynı dört parçaya
bölünür ve parçalar **her zaman aynı katmanda** durur:

| İş | Katman | Nerede |
|---|---|---|
| Arama, veri filtresi (branş, grup, tarih aralığı) | **Rust** | `repo::<modül>` |
| Ekranın istediği birleşik satır (bakiye, kalan ders, veli, sayaçlar) | **Rust** | `repo/roster.rs` gibi ayrı bir *projeksiyon* modülü |
| Çipler ve sayıları | Arayüz | `pages/<modül>/filters.ts` |
| **Sıralama ve sayfalama** | **Arayüz** | `lib/sortTr.ts` + `pages/<modül>/filters.ts` |

**Gerekçe — sıralama ve sayfalama neden ayrılamaz.** ADR-020 Türkçe metin kolonlarında
SQL `ORDER BY` yasağı koyuyor: SQLite'ta `localeCompare('tr')` karşılığı yok, `ORDER BY
full_name` yazılırsa Ç/Ö/Ş/Ü/İ ile başlayan her öğrenci Z'den sonraya düşer. Buradan
doğrudan çıkan sonuç şu: **sıralanmamış bir listeyi sayfalamak yanlış sayfa üretir.**
`LIMIT/OFFSET`'i Rust'a koymak, kullanıcının 2. sayfada göreceği isimlerin ekranda
uygulanan sıralamayla hiçbir ilgisi olmaması demekti. İkisi aynı katmanda durmak zorunda
ve o katman ADR-020 gereği arayüz.

Bedeli kabul edildi: liste **tümüyle** belleğe alınıyor. Tek kullanıcılı bir özel ders
kursunda öğrenci sayısı iki, en kötü üç hanelidir; ölçülebilir bir maliyeti yok. Sayı
binleri bulursa bu karar yeniden açılır — o zaman doğru çözüm sayfalamayı Rust'a taşımak
değil, sıralama anahtarını (`sort_key`) yazma anında üretip sütuna yazmaktır; `search_name`
(K9) için zaten kurulu olan kalıp budur.

**Gerekçe — arama neden Rust'ta.** `search_name` sütunu orada ve `İ/ı` sorunu **yazma
anında** çözülmüş oluyor (K9). Aramayı arayüze almak, aynı normalleştirmenin ikinci bir
kopyasını doğururdu; `format.ts` ↔ `text.rs` paritesi zaten üç fonksiyonla taşınıyor,
dördüncüsünü eklemenin karşılığı yok.

Tek istisna **veli adı**: `guardian` tablosunda `search_name` sütunu yok (§1.6) ve
SQLite'ın `lower()`'ı Türkçe harfleri hiç küçültmüyor. Bu yüzden veli adı eşleşmesi
SQL'de değil, `text::search_name`'in **kendisiyle** Rust içinde süzülüyor. Sütun eklemek
bir migration ister ve §1.8'in "iki haneli bir tabloda arama indeksinin kazancı yok"
gerekçesi burada da geçerli.

**Gerekçe — projeksiyon modülü neden ayrı.** `repo/people.rs` tabloların CRUD'u;
`repo/roster.rs` ekranın istediği satır. İkisi aynı dosyada dursaydı `insert_student`'ın
yanında bir bakiye sorgusu belirir ve tablo katmanı ekrana bağlanırdı. Ayrım, Faz 5'te
`Gruplar`, Faz 8'de `Borçlular` için de aynı biçimde kurulur.

**Sonuç.** Testler de bu bölünmeyi izler ve **çakışmaz**: arama, filtre, arşivleme ve
veli ilişkisi `src-tauri/tests/roster.rs`'te; Türkçe sıralama ve sayfalama
`src/pages/ogrenciler/filters.test.ts`'te. Faz 4'ün kabul listesi "sayfalama Rust'ta
test edilsin" diyordu; ADR-020 buna izin vermediği için testi karşı tarafa taşındı.

Form doğrulaması bu bölünmenin dışındadır ve **bilerek iki yerdedir**: arayüzdeki kopya
anında geri bildirim için, Rust'taki son söz. İkisi aynı `code` uzayını kullanır
(`student.fullName`, `guardians.0.phone`), böylece Rust'tan dönen hata jenerik bir kutuya
değil doğru girdinin altına yerleşir.

**Durum.** Kabul edildi.

---

## ADR-026 — Liste ekranlarının özet rakamı görünen listeyi toplar

**Karar.** Bir liste ekranının alt çubuğundaki para özeti **ekranda o an görünen
satırların** toplamıdır. Her süzgeçle birlikte değişir — arama, veri filtresi (branş,
grup) ve çipler (Borçlular, Arşivlenmiş…) arasında ayrım yapılmaz. Etiketi bunu açıkça
söyler: **"Görünen listenin alacağı"**, çıplak "Toplam alacak" değil.

Kurs geneli, süzgeçten bağımsız rakamların yeri **liste ekranı değil, Dashboard'dur**
(Faz 9). `repo::views::total_receivable` orada kullanılır.

Bu, ADR-025'in dört parçalı iş bölümüne eklenen **beşinci satırdır**:

| İş | Katman | Kural |
|---|---|---|
| Özet para rakamı | Arayüz | ADR-025'in son adımından (sayfalama öncesi süzülmüş liste) hesaplanır |

**Gerekçe.** Faz 4 denetiminde çıktı: `StudentsPage`'in alt çubuğu Rust'tan gelen
süzülmüş listeyi topluyordu, ama çipler yalnızca arayüzde uygulandığı için rakam
**çiplere kördü**. Sonuç, kimsenin bilerek seçmeyeceği bir ara durum: "Branş: Matematik"
seçince rakam değişiyor, "Borçlular" çipine basınca değişmiyor. Aynı ekranda biri
diğerini açıklamayan iki sayı — teknik olmayan bir kullanıcının hangisine güveneceğini
bilemeyeceği tam olarak bu.

Görünen listeyi toplamanın seçilme sebebi, alt çubuğun **ne olduğu**: bir liste altbilgisi
o listeyi tarif eder. `11 öğrenci gösteriliyor · 12 kayıt` satırının yanında duran para
rakamının başka bir kümeyi toplaması, altbilginin kendi içinde tutarsız olması demekti.

Elenen seçenek — rakamı süzgeçten tümüyle bağımsız kılmak — reddedilmedi, **taşındı**:
kurs geneli toplam alacak gerçek bir ihtiyaç, ama yeri bir liste altbilgisi değil
Dashboard. Orada hiçbir süzgeç yok, dolayısıyla tutarsızlık da doğmuyor.

**Sonuç.** Üç şey bunun peşinden gelir:

1. **`views::total_receivable` ölü kalmaz.** Bugün yalnızca testte çağrılıyor, ekrandaki
   rakam TypeScript'te ikinci kez hesaplanıyor — aynı para kavramının iki tanımı. Rust
   tarafı Faz 9'un tek kaynağı olur; liste altbilgisi ise ADR-025'in süzülmüş listesinden
   türer ve bu **ikinci bir tanım değildir**, çünkü farklı bir soruyu cevaplar.
2. **Arşivlenmiş borçlu görünürlüğü değişmez.** `VERI-MODELI §1.23` "borçlu listesi,
   toplam alacak, cari ekstre → arşivlenmiş sayılır" diyor ve bu korunur: arşivli öğrenci
   "Arşivlenmiş" çipinde görünür ve o listenin toplamına girer, Dashboard'un kurs geneli
   rakamına da girer. Değişen tek şey, varsayılan görünümde **görünmeyen** bir satırın
   toplama sessizce eklenmemesi.
3. **Kural bütün liste ekranları için bağlayıcı** — Gruplar (Faz 5), Borçlular (Faz 8),
   Raporlar (Faz 9). Bir liste altbilgisinde para rakamı varsa, etiketi hangi kümeyi
   topladığını yazacak.

**Durum.** Kabul edildi.

---

## ADR-027 — Telefonun iki biçimi var ve ikisi de veri değil

**Karar.** Telefon numarasının **saklanan** hâli kullanıcının yazdığı ham metindir.
Biçimleme yalnızca sunumdur ve **iki ayrı biçim** vardır, ikisi de `src/lib/format.ts`
içinde durur:

| Fonksiyon | Nerede | Çıktı |
|---|---|---|
| `formatPhone` | **Gösterim** — liste kolonu, detay kartı, çekmece, arama sonucu | `0 532 111 22 33` |
| `maskPhone` (+ `editPhone` / `backspacePhone`) | **Girdi alanı** — `ui/PhoneInput` | `0532 111 22 33` |

Aramanın ve saklamanın gördüğü değer ikisi de değil: `text::phone_digits` **Rust'ta**
üretilen `phone_digits` sütunudur. Maske boşluk koyar, `phone_digits` boşlukları atar —
maske veriyi değiştirmez.

**Gerekçe — neden iki biçim.** Girdi alanı formun kendi yazımını izlemek zorunda:
`tr.students.form.phonePlaceholder` ve doğrulama hatasının örneği `0532 111 22 33`
diyor. Kullanıcının yazdığı biçimden farklı bir biçime *yazarken* zorlamak, alanın
kendi placeholder'ını yalanlaması olurdu. Gösterimde ise sıfır ayrı duruyor
(`0 532 …`) çünkü orada tablo kolonu hizalanıyor ve numara okunmak için değil,
**taranmak** için orada.

**Gerekçe — neden maske veri değil.** Numara Rust'a giderken `check_phone`'dan geçiyor
(10–13 hane) ve `phone_digits` orada üretiliyor. Maskeyi veri saymak, aynı
normalleştirmenin arayüzde ikinci bir kopyasını doğururdu — `format.ts` ↔ `text.rs`
paritesi zaten üç fonksiyonla taşınıyor (ADR-025'in aynı gerekçesi).

**Gerekçe — maskenin üç kuralı ve neden böyle.** Üçü de "kullanıcı kilitlenmesin"
kaygısından çıktı:

1. **Baştaki sıfır zorla eklenmez.** Eklenseydi `0532 111 22 33` içindeki sıfır
   silinemezdi: silinir silinmez maske geri koyar ve tuş çalışmıyormuş gibi görünürdü.
   Bunun yerine **gruplama baştaki sıfıra bakar** — `0532 111 22 33` ya da
   `532 111 22 33`. Doğrulama ikisini de kabul ediyor.
2. **11 haneyi aşan girdi kırpılmaz**, artanı sona eklenir. Sessizce rakam yutmak,
   yanlış bir numarayı doğru göstermek demekti; uzunluğu doğrulama söyler.
3. **İmleç rakam sayısıyla taşınır**, karakterle değil. Ayıraç üstünde `Backspace` bir
   **rakam** siler.

Ülke kodu (`+90…` / `0090…`) yalnızca numara o uzunluğa **ulaşınca** atılır — eşik
olmasaydı `90…` yazmaya başlayan kullanıcının rakamları gözünün önünde silinirdi.

**Sonuç.** Telefon alanı olan her ekran `ui/PhoneInput` kullanır, çıplak `Input`
kullanmaz — Faz 5'in grup/veli ekranları ve Faz 8'in tahsilat formu dahil. Faz 8'in
makbuz PDF'i `formatPhone`'u kullanır, `maskPhone`'u değil. Yeni bir biçim gerekirse
üçüncü bir fonksiyon değil, bu tabloya bir satır eklenir ve gerekçesi yazılır.

**Durum.** Kabul edildi.

---

## ADR-028 — "Şablondan oluştur" haftayı şablona çevirir, kopyalamaz

**Karar.** E6 "Şablondan oluştur", seçilen kaynak haftanın derslerini okur ve her biri
için bir **`session_series` açar**; seansları `generate_sessions` ufka kadar üretir.
Dersleri ileri haftalara tek tek **kopyalamaz**.

Kaynak haftadan ayıklananlar ve nedenleri:

| Ayıklanan | Neden |
|---|---|
| İptal edilmiş ders (`status='cancelled'`) | O hafta yapılmamış bir ders; şablona aday değil |
| Telafi dersi (`is_makeup`) | Tanımı gereği tek seferlik, haftalık tekrarı yok (ADR-016) |
| Arşivlenmiş öğrencinin dersi | Program ekranları canlı kayıtla ilgilenir (§1.23) |
| Aynı hedefin aynı gün + saatteki ikinci satırı | Aynı şablonu iki kez yazmak olurdu |

`apply_from` tarihinde hâlâ geçerli bir şablonu olan slot **atlanır ve raporda sayılır**.

**Gerekçe — neden kopyalama değil.** Kopyalanan hafta N hafta sonra biter ve takvim
yeniden boşalır; kullanıcı aynı işlemi tekrar etmek zorunda kalır. Bu, `VERI-MODELI
§1.14`'ün ufuk gerekçesinin elle yapılan hâlidir: *"takvim birkaç ay sonra sessizce
boşalır ve Bugün ekranı yanlış boş-durum metnini gösterir."* Üretim motoru zaten
idempotent, tatil-duyarlı ve testli; ikinci bir üretim yolu açmak "tatile ders düşmez"
kuralının iki ayrı yerde doğrulanması demekti.

**Gerekçe — neden önizleme zorunlu.** İşlem tek tıkla 16 haftalık program üretiyor ve
geri alması ders ders silmek demek. Önizleme kaç dersin ve **hangi tarihlerin**
oluşacağını onaydan **önce** söylüyor (`TemplateSlot.first_on`).

**Gerekçe — neden atlama sayılıyor.** Sessizce atlansaydı kullanıcı önizlemede dört ders
görüp üç ders eklendiğini fark eder ve programın kaybettiğini sanardı. Atlanan satır
listede **gizlenmiyor** da: `Zaten programda` rozetiyle duruyor.

**Sonuç.** Faz 5C'de takvimin boş-durumu bu modalı açar; ikinci bir "kopyala" yolu
açılmaz. Üretilen şablonlar grup formundakilerle **aynı tablodadır** — gruba bağlı
olanlar `GroupForm`'dan düzenlenebilir. Birebir şablonların düzenleme ekranı **yok**;
bugünkü tek yönetim yolu "Tüm seri" ile kaldırmak (bkz. `docs/DURUM.md` > ertelenenler).

**Durum.** Kabul edildi.

---

## ADR-029 — "Şimdi"nin tek kaynağı var; arayüz saati kendi okumaz

**Karar.** Kullanıcıya görünen **"bugün" ve "şimdi"** değerleri tek bir yerden gelir:
`local_now` komutu (`chrono::Local`, `'YYYY-MM-DD HH:MM'`; tarih ilk 10 karakter).
Arayüz, ekranda gösterilen hiçbir tarih/saat hesabı için `new Date()` çağırmaz.

İki istisna var ve **ikisi de "şimdi" üretmiyor**:

- `lib/format.ts` ile `ui/Picker.tsx` içindeki `Date.UTC` aritmetiği — **verilen** bir
  tarihi ayrıştırmak, biçimlemek ve ay ızgarasını kurmak için.
- `DatePicker`'ın `today` prop'u boş geldiğinde düştüğü `new Date()` — yalnızca hangi
  ayın açılacağını seçer. Çağıranların hepsi `today`'i veriyor.

**Gerekçe.** `VERI-MODELI §0` SQLite saatini yasaklıyordu çünkü `datetime('now')` daima
UTC dönüyor. Arayüzün `new Date()`'i doğru saat dilimini verir — yani aynı hata değil,
ama **ikinci bir kaynaktır.** Bugün ekranının başlığı `local_now`'dan, listesi
`day_sessions`'tan gelirken "şimdi" çizgisi `new Date()`'ten gelseydi, gece yarısını
geçen bir oturumda başlık dünü, çizgi bugünü gösterirdi. Aynı çatlak Faz 6'nın yoklama
damgasında ve Faz 9'un "bu ay" penceresinde de açılırdı.

Yan fayda testlerde: `pages/bugun/today.test.ts` "şimdi"yi sabit veriyor. `new Date()`
kullanılsaydı testin sonucu makinenin saatine bağlanır ve gece yarısı düşerdi — §0'ın
Rust tarafında zaten kabul edilmiş gerekçesinin aynısı.

**Sonuç.** 5C'nin takvim "şimdi" göstergesi, Faz 6'nın `marked_at` damgası ve Faz 9'un
rapor pencereleri aynı komuttan okur. Kabul edilen sınır: uzun süre açık kalan bir
pencerede gün değişirse ekran **kendiliğinden tazelenmez**; kullanıcı bir işlem
yaptığında liste zaten yeniden yükleniyor. Zamanlayıcı eklemek, gece yarısı ekranın
kullanıcının altından değişmesi demekti.

**Durum.** Kabul edildi.

---

## ADR-030 — Sürükleme Pointer Events ile kurulur; HTML5 sürükle-bırak kullanılmaz

**Karar.** Arayüzde sürüklenerek yapılan her işlem — Faz 5C'nin takvim bloklarından
başlayarak — `pointerdown` / `pointermove` / `pointerup` + `setPointerCapture` üzerine
kurulur. HTML5 sürükle-bırak API'si (`draggable` özniteliği, `dragstart` · `dragover` ·
`drop` olayları) **kullanılmaz.** Bu, takvim kütüphanesi adayları için de bir **eleme**
ölçütüdür (`/faz-05c-karar` ölçüt 6): sürüklemeyi HTML5 DnD ile kuran bir kütüphane
ölçülmeden elenir.

**Gerekçe — asıl neden bir gereksinim, tercih değil.** `PRD` **R3.7** dersin taşınmasını
30 dakikaya kilitliyor ve **5 pikselin altındaki hareketi tıklama sayıyor.** HTML5 DnD'de
`dragstart`'ın ne kadar hareketten sonra ateşleneceğini **tarayıcı belirler**; uygulama o
eşiği ne okuyabilir ne değiştirebilir. Yani R3.7 bu API üzerinde uygulanamaz — kırılgan
olur değil, **kurulamaz.** Pointer Events'te eşik bizim aritmetiğimiz: ilk `pointerdown`
noktasıyla `pointermove` arasındaki mesafe.

İkinci sebep: `setPointerCapture` sürüklenen bloğun, işaretçi kendi sınırlarının dışına
çıksa bile olayları almasını **garanti eder.** Takvimde sürükleme tanımı gereği bloğun
dışına çıkar — başka bir güne, başka bir saate. HTML5 DnD'de bu, hedef elemanların
`dragover`'ında `preventDefault` çağırmakla kurulur ve bırakma noktasının hassas
koordinatı güvenilir gelmez.

**Gerekçe — "WebView2 farkları" korkusunun doğru adresi.** Bu ADR bir çerçeve
düzeltmesiyle birlikte alındı. Tauri macOS'ta **WKWebView (WebKit)**, Windows'ta
**WebView2 (Chromium)** kullanıyor: geliştirme **daha katı** motorda yapılıyor. WKWebView'da
çalışan bir yerleşimin Chromium'da çalışması beklenir; tersi doğru değil. Dolayısıyla
CSS/JS **semantiği** bu projede sanıldığından az risk taşıyor.

Gerçek Windows bilinmeyenleri motorun kendisi değil, dördü de somut olan şunlar:

| Bilinmeyen | Nerede vurur |
|---|---|
| **Segoe UI metrikleri** | Kolon genişlikleri, blok içinde metnin kırpılması. Sabit `px` kolon kurulmaz |
| **DPI ölçekleme** | 08:00–22:00 ızgarası rahat yoğunlukta 840px; tipik 1080p dizüstü önerilen ölçeklemede bunu vermiyor. Izgara dikey kaydırır ve açılışta "şimdi"ye kayar |
| **Kaydırma çubuğu genişliği** | Windows'ta klasik çubuk ızgaradan yer çalar; genişlik hesabı buna dayanıklı olmalı |
| **ICU verisi** | `toLocale*` çağrısı yapılmaz — gün/ay adları `tr.calendar`'dan, para ayıracı elle (bkz. `tr.ts`, `format.ts`) |

**Sonuç.** Sürükleme mantığı — eşik, 30 dk yuvarlaması, hedef geçerliliği — saf
fonksiyonlarda kalır ve jsdom'da test edilir; Pointer Events bunu mümkün kılıyor, çünkü
girdi sıradan koordinat çiftleri. HTML5 DnD'de aynı testler `DataTransfer` taklidi
gerektirirdi. Faz 6'nın telafi dersi taşıması ve ileride çıkacak her sürükleme aynı
kalıbı kullanır.

**Durum.** Kabul edildi.

---

## ADR-031 — Takvim ızgarası elde yazılır; hazır takvim kütüphanesi kullanılmaz

**Karar.** Faz 5C'nin hafta/gün ızgarası **elde yazılır**; incelenen üç hazır takvim
kütüphanesinin üçü de eleme ölçütlerinden en az birinde kaldı.

**Kararın belirleyici cümlesi tek bir ölçütte toplanıyor: sürükleme eşiği.** Boyut ve
lisans genelde bu kararın tartışıldığı iki eksen; ikisini de **geçen** bir aday çıktı
(FullCalendar: MIT ve +75.7 KB gzip, eşiğin altında; ölçüt 4'ü de geçti) ve yine de
elendi. **Ölçüt 6'ya kadar gelebilen iki adayın ikisi de orada düştü**, her biri farklı
bir yerinden — Bryntum o ölçüte hiç ulaşmadı, daha ucuz olan 1 ve 2'de elendi:

| Aday | 5px eşiği nerede kırılıyor |
|---|---|
| FullCalendar | `interaction/index.js:1249` · `dragging.minDistance = ev.isTouch ? 0 : options.eventDragMinDistance` — **dokunmatik girdide eşik sıfıra çivili**, ayarlanamıyor |
| react-big-calendar | `lib/Selection.js:59` · `var clickTolerance = 5` — modül kapsamında sabit, dışarıdan **verilemiyor**; üstelik karşılaştırma `\|dx\|≤5 && \|dy\|≤5` yani kare, PRD R3.7'nin istediği yarıçap değil (7px'lik çapraz hareket hâlâ tıklama sayılıyor) |

Bu tesadüf değil, **ADR-030'un öngördüğü şeyin ta kendisi**: R3.7 sürüklemeyi 30 dakikaya
kilitleyip 5 pikselin altını tıklama sayıyor, ve bu bir *görünüm* ayarı değil bir
*davranış sözleşmesi*. Kütüphaneler eşiği ya kendi sabitlerinde tutuyor ya da girdi
türüne göre kendileri değiştiriyor. Eşiği bizim aritmetiğimiz yapan tek yol, sürüklemeyi
bizim yazmamız.

---

### 1. Eşikler ve ölçülen değerler

Eşikler `/faz-05c-karar §0` gereği **ölçümden önce** yazıldı ve bu bölüm o tabloyu
değiştirmeden yanına ölçümü koyuyor. Eşik ölçümden sonra yazılırsa karar değil, çıkan
sonucun gerekçelendirmesi olur.

Ölçümün dayandığı mevcut durum (adaylardan bağımsız): `dist` JS **327.98 KB ham /
97.5 KB gzip**, CSS 43.63 KB / 7.69 KB gzip.

| # | Ölçüt | **Eşik (önce yazıldı)** | Bryntum 7.3.4 | FullCalendar 6.1.21 | react-big-calendar 1.20.0 | **Elde** |
|---|---|---|---|---|---|---|
| 1 | Çevrimdışı | ağ çağrısı **0** | **Image beacon + 45 gün kill switch** ❌ | 1 `fetch` (JSON feed) ❌ | **0** ✅ | **0** ✅ |
| 2 | Lisans | teslime izin: evet | **paket indirilemiyor (403)** ❌ | MIT ✅ | MIT ✅ | — ✅ |
| 3 | Paket boyutu | gzip artışı **≤ 100 KB** | ölçülmedi | **+75.7 KB** ✅ | ~54.5 KB gzip (minifiye edilmemiş ESM) | **+0 KB** ✅ |
| 4 | Tasarım uyumu | geçersiz kılma **≤ 30 satır**, `!important` **0** | ölçülmedi | **8 satır / 0 `!important`** ✅ | ölçülmedi¹ | **0 satır / 0 `!important`** ✅ |
| 5 | Türkçe | geçersiz kılınamayan ICU çağrısı **0** | ölçülmedi | **3 yol** ❌ | **0** ✅ | **0** ✅ |
| 6 | Sürükleme | HTML5 DnD **0**, eşik **tam 5px ayarlanabilir** | ölçülmedi | dokunmatikte **0'a çivili** ❌ | **modül sabiti, ayarlanamıyor** ❌ | ADR-030 doğrudan ✅ |
| 7 | Kaydırma + yoğunluk | 28 × `--calendar-slot-height`, **sapma 0px** | ölçülmedi | **840px / 616px** ✅² | ölçülmedi¹ | **840px / 616px, sapma 0** ✅ |

¹ `/faz-05c-karar §2`'nin kendi kuralı: *"Ucuz ölçütte elenen aday pahalı ölçüte hiç
girmez."* Ölçüt 5 ve 6 paket kaynağında okunuyor, 4 ve 7 kurulum ve deneme istiyor.
FullCalendar'ın denemesi elenme kararından önce başlamıştı ve tamamlandı; sayıları
tabloda duruyor çünkü **kararın FullCalendar'ın zayıf olduğu yerlerde verilmediğini**
onlar gösteriyor.

² Yoğunluk yarısı ölçüldü ve tuttu: tek satırlık bir geçersiz kılma
(`height: var(--calendar-slot-height)`) ile 840px → 616px. Kaydırma yarısı **ölçülemedi
ve bu kütüphaneyle ilgili değil**: iki deneme de sayfayı kabuğun kaydırma alanına
(`PageContent` → `.content { overflow: auto }`) sarmadan doğrudan `main`'e bağladı, o
yüzden ikisi de kırpıldı. Kabukta hata yok; `/faz-05c`'ye not olarak yazıldı.

**Ölçümün kendi sınırı da yazılsın:** tarayıcı aracının `resize_window`'u bu ortamda
pencereyi fiilen küçültmedi (`innerHeight` 700 istendiğinde 956 kaldı). 700px koşulu iki
tarafta da kabı sınırlayarak taklit edildi — CSS açısından eşdeğer, ama literal bir
pencere küçültme testi **değil**. Gerçek doğrulama `/faz-05c`'nin sonundaki Windows
testine kalıyor.

**Elde yazılanın ölçüt 7 ölçümü gerçek tarayıcıda alındı:** rahat yoğunlukta ızgara
**840px** (28 × 30), `data-density="tight"` yazıldığında **616px** (28 × 22), blok
yükseklikleri de dilim cinsinden takip ediyor (90 dk = 90px → 66px). 700px'lik pencerede
kırpılmıyor, kendi kabında kaydırıyor. Sapma her iki yoğunlukta da **0px** — çünkü
ızgarada tek bir sabit piksel yok, her şey dilim sayısı × `--calendar-slot-height`.

---

### 2. Elenen adaylar

**Bryntum Calendar 7.3.4 — ölçüt 2 ve 1.**

Ölçüt 2'nin gerekçesi bir *tedarik* olgusudur, lisans şartı değil, ve ADR'ye böyle
yazılması önemli: kullanıcının `~/.npmrc`'sindeki jeton `@bryntum/calendar` tarball'ına
**403** veriyor — *"only has access for trial packages … It is not allowed to install
licensed package"*. Elde edilebilen tek şey `@bryntum/calendar-trial` ve ölçüt 2'nin
kendi cümlesi *"deneme jetonu lisans değildir"* diyor. **Ölçütün adını taşıdığı belge
pakette hiç yok**: LICENSE/EULA dosyası bulunmuyor, `package.json` `"license":
"Commercial"` diyor ve README bir URL veriyor. Yani "lisans teslime izin vermiyor"
denemez — denenmemiştir; denebilecek olan şudur: **teslim edeceğimiz yayını hiç
görmedik ve göremiyoruz.**

Ölçüt 1'de bulunanlar, jeton bir gün lisansa dönse bile ayrıca tartışılmayı hak ediyor:

- Lisans doğrulaması `https://bryntum.com/verify/` adresine **`new Image()` beacon'ıyla**
  gidiyor ve dönen görüntünün genişliğine bakıp `blockTrial()` çağırabiliyor.
- Ağ'a hiç çıkmasa da çalışan ikinci bir kapatma var: `isExpired` getter'ı
  `blocked || Date.now() - trialStartTime > 45 gün`, tarih `localStorage`'da.
- `postinstall.js` **her `npm install`/`npm ci`'de** `spawnSync('node', …)` ile başka bir
  paketin `build.js`'ini proje kökünde çalıştırıyor. CI'da da çalışır.

> **Bu ADR'nin en pahalı dersi ölçüt 1'in kendisiyle ilgili.** Ölçütün grep listesi
> (`fetch` · `XMLHttpRequest` · `sendBeacon`) Bryntum'un ağ çıkışını **kaçırıyordu** —
> çıkış bir `Image().src`. Liste karşıt doğrulamada genişletildi ve bundan sonra
> **`new Image()` · `.src =` · `document.createElement('script')` · dinamik `import()` ·
> `new Worker` · `new WebSocket` · `EventSource`** de taranır. Bir eleme ölçütü, aradığı
> şeyin bilinen bütün taşıyıcılarını saymıyorsa ölçüt değil, ritüeldir.

**FullCalendar 6.1.21 — ölçüt 5 ve 6.** Lisans (MIT) ve boyut (+75.7 KB gzip, eşik
+100 KB) ölçütlerini **geçti**; kararı bu ikisi vermedi.

- **Ölçüt 5.** Çizim yolunda dışarıdan geçersiz kılınamayan üç ICU çağrısı kaldı:
  `internal-common.js:6184` modül düzeyinde `createFormatter({weekday:'long'})` →
  `:6210` gün başlığının `aria-label`'ı (`dayHeaderContent` yalnızca **iç içeriği**
  değiştiriyor, öznitelik yine basılıyor); `:5460` gezinme bağlantısının
  `aria-label`/`title`'ı; ve `index.js:96` `new Intl.NumberFormat` → hafta numarası
  rakamları, hiçbir seçenekle değiştirilemiyor. Dördüncüsü ayrı bir sınıf:
  `index.js:77` `codes[i].toLocaleLowerCase()` — **argümansız**, yani sistem yereline
  bağlı; Türkçe bir Windows'ta `I` → `i` değil `ı` döner ve yerel kodu eşleşmesi bozulur.
  Bu, projenin `normalizeTr`'de elle özel durum yazmasının tam olarak nedeni.
  Varsayılan ayarlarla ekranda **gözle görünen** Türkçe olmayan metin kalmıyor
  (`navLinks: false`); kalan ekran okuyucuya gidiyor. Yani "pratikte Türkçe kalır"
  savunulabilir, "ölçüt 5'i geçti" savunulamaz — ölçüt ikili ve sayım 0 değil.
- **Ölçüt 6.** İç sürükleme temiz: `dataTransfer` 0, `draggable` özniteliği 0, HTML5 DnD
  yok — `ThirdPartyDraggable` bile `PointerDragging`'e iniyor. Eşik de gerçek bir pisagor
  karşılaştırması (`distanceSq >= minDistance*minDistance`) ve `eventDragMinDistance`
  varsayılanı zaten 5. **Ama** `index.js:1249` `dragging.minDistance = ev.isTouch ? 0 :
  options.eventDragMinDistance`: dokunmatik girdide eşik sıfır, ayar yok. Dokunmatik
  ekranlı bir Windows dizüstünde R3.7 yoktur.
- İki yan bulgu: `@fullcalendar/core` bağımlılığı olarak **`preact ~10.12.1`** getiriyor —
  React 19'un yanına ikinci bir VDOM çalışma zamanı paketleniyor. Ve kütüphanenin kendi
  CSS'i `font-family: fcicons!important` içeriyor; ölçüt 4'ün `!important` sıfır
  toleransı, kütüphane bir özelliği `!important` ile kilitlediğinde bizi de oraya sürükler.
- **Ölçüt 4'ü de geçti ve bu kararı zorlaştıran bir sayı, kolaylaştıran değil:** gerçek
  geçersiz kılma **8 satır** (dilim yüksekliği, 30 dk çizgi rengi, blok köşe yarıçapı,
  blok iç dolgusu, başlık/cetvel dolgusu — hepsi FullCalendar'ın hiç `--fc-*` değişkeni
  sunmadığı yerler), artı 13 satır `--fc-*` ataması ki o kütüphanenin **resmi tema
  API'si**, dövüş değil. `!important` hiç gerekmedi. Yani "kütüphanenin CSS'iyle
  boğuşulur" korkusu bu adayda **doğrulanmadı**; karar ölçüt 5 ve 6'da verildi.
- Ölçüt 1'de tek `fetch` var (`internal-common.js:4643`, `requestJson`) ve yalnızca
  JSON-feed olay kaynağı yapılandırılırsa çalışır — telemetri değil, lisans doğrulaması
  değil. Eşik ikili yazıldığı için bu da bir başarısızlık olarak kaydedildi; ama karar
  **buna dayanmıyor**, 5 ve 6'ya dayanıyor. Eşiği ölçümden sonra yumuşatmak §0
  disiplinini bozardı, o yüzden yumuşatılmadı — sadece ağırlığı burada yazıldı.

**react-big-calendar 1.20.0 — ölçüt 6.** Havuzda yoktu; **karşıt doğrulama sırasında
çıktı** ve ölçüldü. Üç ölçütte en iyi aday: ağ çağrısı **0** (ölçüt 1'i lafzıyla geçen
tek aday), gerçek bir MIT `LICENSE` dosyası, ve dist'te **`Intl.`/`toLocale` 0** — çünkü
biçimlendirme enjekte edilebilir bir `localizer` sözleşmesinden geçiyor, yani
`tr.calendar`'ı saran kendi localizer'ımızla çizim yolunda ICU sıfırlanabilirdi. HTML5
DnD de yok (`dataTransfer` 0, `draggable=` 0, `'dragstart'` 0; eklentideki
`onDropFromOutside`/`onDragOver` kütüphanenin **bize açtığı kanca adları**, kendi
kullanımı değil). Elenmesinin tek sebebi eşiğin `var clickTolerance = 5` olarak modül
kapsamında çivili olması, Chebyshev geometrisi ve `!isTouch` ile dokunmatikte tamamen
kapanması. Ek yük olarak `dependencies` içinde moment + moment-timezone + luxon + dayjs +
globalize + lodash + lodash-es birlikte duruyor; dist'e yalnızca kullanılan giriyor ama
`npm ci` hepsini indirir.

> **Havuz üçle sınırlıydı ve dördüncü aday bilerek kaydedildi.** `/faz-05c-karar §1`'in
> üç aday sınırı oyalanmaya karşı bir disiplin; ölçülmüş bir bulguyu ADR'den saklamanın
> gerekçesi değil. react-big-calendar tam da havuz kuralının kaçırabileceği şeyi
> gösterdi: "en popüler kütüphane"yi temsilci seçmek, ölçütleri daha iyi geçen bir adayı
> gölgede bırakabiliyor.

---

### 3. Elde yazmanın ölçülen tarafı ve kabul edilen bedeli

Deneme `src/dev/` altında duruyor (`calendarGrid.ts` · `CalendarSpike.tsx` ·
`CalendarSpike.module.css`) ve `/faz-05c`'nin ızgarasının başlangıcıdır — silinmez,
`src/pages/takvim/`e taşınır.

Ölçülenler: ızgara 840px/616px sapmasız, blok konumu ve yüksekliği dilim cinsinden,
çakışan iki ders yan yana iki şeritte, taralı tatil sütunu, yapışkan gün başlığı, dar
blokta meta satırının gizlenmesi (`EKRANLAR §140`) — hepsi yalnızca `tokens.css` ve
`density.css` değişkenleriyle, **geçersiz kılınan tek satır CSS olmadan**. Şerit
algoritması 40 satır ve **11 testi ilk koşuda geçti**; zincirleme çakışmada (A–B, B–C
çakışıyor ama A–C çakışmıyor) A ile C'nin aynı şeridi paylaşmaması dahil.

**Bedel kabul edildi ve küçümsenmiyor.** Karşıt doğrulamanın dürüst tahmini elde yazmak
için **6–9 iş günü**, kütüphane bağlamak için 1–2 gün + CSS'iyle boğuşmak için ~1 gün.
Pahalı olan üç parça:

1. **Şerit yerleşiminin ince hâli.** Denemedeki sürüm eşit genişlikte şeritler veriyor;
   olgun bir yerleşim bloğu sağdaki boş alana **genişletir** (FullCalendar bunu
   `SegHierarchy` diye ayrı bir altsistemde taşıyor). `EKRANLAR §122` yalnızca şerit
   istiyor, genişletme istemiyor — kapsam burada tutulacak.
2. **Sürükleme sırasında kenarda kendiliğinden kaydırma.** Hiç kimsenin bütçelemediği
   parça; FullCalendar'ın `AutoScroller`'ı bunun için var.
3. **Windows kaydırma çubuğu geometrisi.** ADR-030'un bilinmeyenler tablosunda zaten
   yazılı, ve **Windows makinemiz yok** — her deneme bir CI turu.

Karşı tarafta üç şey bedeli düşürüyor ve bunlar da yazılmalı: Türkiye 2016'dan beri sabit
UTC+3 ve yaz saati yok — takvim yazmanın klasik olarak en pahalı parçası bu projede
**bedava**; veri projeksiyonu Rust'ta zaten bitti (`repo/schedule.rs > day_rows` ·
`session_rows_between`), elde yazılacak olan **yalnızca çizim**; ve tek kişilik, teknik
olmayan bir kullanıcıda klavye/erişilebilirlik yükü gerçekten daha hafif.

**Asıl asimetri şu:** elde yazmanın bedeli önden ve görünür ödenir; kütüphanenin bedeli
sonradan ve görünmez ödenir — her sürüm yükseltmesinde ölçüt 4 yeniden açılır ve o hesap
hiçbir yere yazılmaz.

---

### 4. Kararı geri açacak şey

Bu ADR yeniden tartışılır, eğer:

1. **Sürükleme eşiğini fare ve dokunmatik için tek bir sayı olarak açan** bir aday
   çıkarsa. Kararın bütün ağırlığı burada; bu değişirse tablo baştan kurulur.
2. **FullCalendar** gün başlığı `aria-label`'ını ve hafta numarası biçimleyicisini
   dışarıdan geçersiz kılınabilir yaparsa **ve** `isTouch ? 0` çivisini kaldırırsa
   (ölçüt 5 ve 6'nın ikisi de kalkmalı; biri yetmez).
3. **react-big-calendar** `clickTolerance`'ı bir prop'a çıkarır ve karşılaştırmayı
   yarıçapa çevirirse. Diğer ölçütlerde zaten en iyi aday.
4. **Bryntum** için gerçekten bir lisans satın alınırsa **ve** lisanslı yayın
   denetlenebilir olursa — bugün onu hiç görmedik. `postinstall` betiği ve yerel süre
   kapatması ayrıca değerlendirilir.
5. Elde yazmanın gerçekleşen maliyeti yukarıdaki **6–9 iş gününü belirgin şekilde
   aşarsa.** Bu durumda `docs/DURUM.md`'ye yazılır ve karar yeniden açılır; sessizce
   sürüklenmez.

Yeniden açılırsa **eşikler önce yazılır** kuralı aynen geçerlidir, ve ölçüt 1'in
genişletilmiş taşıyıcı listesi (yukarıdaki kutu) kullanılır.

**Durum.** Kabul edildi.

---

### ADR-031 · Yöntem kaydı — eşikler ölçümden ÖNCE yazıldı

> **Bu blok karar verilmeden önce yazıldı ve sonrasında değiştirilmedi.**
> `/faz-05c-karar §0` gereği: eşik ölçümden sonra yazılırsa karar değil, çıkan sonucun
> gerekçelendirmesi olur. Aşağıdaki sayılar hiçbir adayın ölçüsüne bakılmadan belirlendi.
> Ölçüm sonuçları ve eşiklerin nasıl tuttuğu yukarıda, ADR-031 §1'de.

#### Eşikler

Mevcut durum — eşiklerin dayandığı tek ölçüm, adaylardan bağımsız:

| Ne | Değer |
|---|---|
| `dist` JS (ham / gzip) | **327.98 KB / 97.5 KB** — React + ReactDOM dahil, 10 ekranın tamamı |
| `dist` CSS (ham / gzip) | 43.63 KB / 7.69 KB |

| # | Ölçüt | **Eşik** | Eşiğin gerekçesi |
|---|---|---|---|
| 1 | Çevrimdışı | Yayınlanan paket kodunda `fetch(` · `XMLHttpRequest` · `sendBeacon` · lisans doğrulama çağrısı · telemetri: **0 tane** | ADR-001: sunucu yok, hesap yok, internet bağımlılığı yok. Bu ikili bir ölçüt; "az sayıda" diye bir şey yok |
| 2 | Lisans | LICENSE **tam metni** Aktansoft'un ürünü müşteriye teslim etmesine izin veriyor mu: **evet/hayır**. Deneme jetonu lisans **değildir** | Ürünü teslim edemiyorsak diğer altı ölçütü ölçmenin anlamı yok |
| 3 | Paket boyutu | `dist` JS gzip artışı **≤ 100 KB** (yani toplam ≤ 197.5 KB gzip) | Uygulamanın **tamamı** bugün 97.5 KB gzip. Tek bir ekranın kütüphanesi uygulamanın tamamı kadar kod getiriyorsa, o noktadan sonra "kütüphane uygulamanın kendisi" olur ve ADR-001'in kurulum boyutu gerekçesi maddi olarak aşınır. Eşik bilerek cömert: masaüstünde indirme maliyeti yok, asıl bedel açılışta ayrıştırma |
| 4 | Tasarım uyumu | Kütüphanenin kendi CSS'ini geçersiz kılan satır sayısı **≤ 30**; `!important` **0 tolerans** | 30 satır bu projedeki bir komponent CSS modülünün ortalama boyutu (`Table.module.css` 71, `Today.module.css` 140 satır). Bunun üstü tek bir ekran için ikinci bir tasarım sistemi bakmak demek. `!important` eşiğe bakılmadan eler: özgüllük savaşı bir kez başlarsa her sürüm yükseltmesinde tekrar açılır |
| 5 | Türkçe | Çizim yolunda **dışarıdan geçersiz kılınamayan** `toLocale*` / `Intl.DateTimeFormat` çağrısı: **0 tane** | ADR-030'un ICU satırı ve `tr.ts:801`: WebView2'de ICU verisi eksik kurulmuş olabilir. Gün/ay adları `tr.calendar`'dan gelmek zorunda |
| 6 | Sürükleme API'si | Sürükleme uygulamasında `draggable=` · `dragstart` · `dataTransfer`: **0 tane**; sürükleme eşiği **tam 5px** olarak ayarlanabilmeli | **ADR-030.** R3.7'nin 5px kuralı HTML5 DnD üzerinde kırılgan olmaz, **kurulamaz** — `dragstart` eşiğini tarayıcı belirler |
| 7 | Kaydırma + yoğunluk | 700px'lik pencerede ızgara kırpılmadan kaydırmalı; `data-density="tight"` yazıldığında ızgara toplam yüksekliği **28 × `--calendar-slot-height`** olmalı — 840px → 616px, **sapma 0px** | `DURUM.md > Faz 5B denetimi > B2`. Sabit piksel varsayan bir ızgara yoğunluk anahtarını sessizce kırar |

**Aday başına zaman kutusu: 45 dakika.** Bir gün sütunu bunu geçiyorsa eleme gerekçesi
zaten ortaya çıkmıştır (`/faz-05c-karar §3`); zorlamaya devam edilmez ve aşılan süre
ölçüm tablosuna yazılır.

**Ölçüt sırası maliyete göre:** önce 2 (LICENSE oku), sonra 1 · 5 · 6 (paket kaynağında
tarama), en son 3 · 4 · 7 (kurulum + deneme gerektirir). Ucuz ölçütte elenen aday pahalı
ölçüte hiç girmez.

---

## ADR-032 — "Bu ve sonraki dersler" şablonu güncellemez, yenisini açar

**Karar.** Takvimde bir ders sürüklenip **"Bu ve sonraki dersler"** seçildiğinde, dersin
bağlı olduğu `session_series` **yerinde güncellenmez.** Eski seri pivot günün bir gün
öncesinde kapatılır (`ends_on`), o günden sonraki **işlenmemiş** seansları arşivlenir ve
yeni gün/saat için **yeni bir seri** açılır. Sürüklenen dersin kendisi yeni seriye elle
yazılır, gerisini üretim motoru doldurur.

**Gerekçe.** Şablonun `weekday`/`start_time` alanlarını yerinde değiştirmek, o şablonun
**geçmiş** seanslarını da yeni günün serisine bağlı bırakırdı: "salı 16:00" diye
üretilmiş, yoklaması alınmış dersler birdenbire "perşembe 18:00" şablonuna ait görünürdü.
`session.series_id` bir aidiyet kaydı; geçmişi geriye dönük yeniden yorumlamak
`ADR-005`'in (hard delete yok) ve `ADR-006`'nın (fiyat snapshot'ı) aynı ailesinden bir
ihlal olurdu.

Desen zaten vardı: `delete_sessions(Following)` seriyi pivot öncesinde **kapatıyor** ve
geçmiş ona bağlı kalıyor. Buradaki tek fark, kapanan serinin yerine yenisinin açılması.
Bedeli açıkça yazılsın: **her "sonraki dersler" taşıması geride kapanmış bir seri satırı
bırakır.** Bu bir sızıntı değil, defterin kendisi — hangi programın ne zamana kadar
geçerli olduğunu okumanın tek yolu.

**Sürüklenen dersin kendisi neden elle yazılıyor.** Üretim motoru geçmişe seans yazmıyor
(`VERI-MODELI §1.14`, `generate_sessions` `max(starts_on, today)`) ve bu doğru bir kural.
Ama kullanıcı geçen haftanın dersini sürüklediğinde bıraktığı yerde hiçbir şey görmemesi
demek olurdu. Pivot seans `insert_from_series` ile doğrudan yazılıyor; `slot_exists`
motorla çakışmasını engelliyor.

**Kapsam iki değerli, üç değil.** `SessionScope` silmede `Only`/`Following`/`All` diyor;
`RescheduleScope` yalnızca `Only`/`Following`. "Tüm seri"yi taşımak geçmiş dersleri de
taşımak olurdu ve onların yoklaması alınmış olabilir (**R3.13** taşımayı zaten reddediyor).
Silmede üç seçenek anlamlı, taşımada iki.

**Geri alma yalnızca tek derste** (R3.12). "Sadece bu ders" taşımasının bildirimi
**"Geri al"** düğmesi taşıyor: dersi eski damgasına yazmak tek bir `UPDATE`. "Bu ve
sonraki dersler"in geri alınması ise kapanmış seriyi yeniden açmak ve arşivlenmiş
seansları diriltmek olurdu; başarısızlık hâli sorunun kendisinden daha kötü. O kapsamda
bildirim kaç dersin taşındığını söylüyor, geri alma sunmuyor — kullanıcının yolu dersi
tekrar sürüklemek.

**K-2 taşıma yolunda da geçerli.** `reschedule_session` artık tatil/kapalı günü
reddediyor. Kural `save_session`'da vardı, ertelemede yoktu: **formdan eklenemeyen bir
güne sürükleyerek taşınabiliyordu.** Takvim hedef göstergesini de çıkarmıyor (K-2'nin
arayüz tarafı), ama son söz Rust'ta.

**Durum.** Kabul edildi.
