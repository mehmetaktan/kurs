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
