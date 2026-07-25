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
