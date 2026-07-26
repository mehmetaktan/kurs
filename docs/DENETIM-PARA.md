# Para fazı denetimi — `/faz-07`, Codex çıktısı

**Tarih:** 2026-07-27 · **Kapsam:** `17766f9..4288405`, 8 commit, 45 dosya, +6.685 satır
**Yöntem:** `docs/CODEX-DEVIR.md`'nin 14 maddelik listesi + para mantığının kod okumasıyla
izlenmesi. Bu dosya **arşivdir**; kapanmamış bulgular `docs/DURUM.md`'nin borç tablosuna
geçer (ADR-039).

`npm run check` yeşil: 345 TypeScript + 243 Rust + 1 doc-test (536'dan 588'e).

---

## Bulgular

### P1 — Paketli öğrencinin işlenen dersi deftere borç yazıyor ⛔ **kritik**

`charge_session` paketli/paketsiz ayrımı yapmıyor. Zincir: `resolve_unit_price` yalnızca
`pricing_model='per_session'` kayıtlarına bakar → paketlide bulamaz → `session.unit_price`
snapshot'ına düşer → o snapshot'ı yazan `schedule::solo_unit_price` (Faz 5A)
`pricing_model`'e bakmadığı için **dolu**. Sonuç: `package_usage(−1)` **ve**
`ledger_entry(session_charge)` birlikte doğar, paketin taksitleri de ayrıca tahakkuk
eder — aynı ders iki kez faturalanır. ADR-015 ihlali.

**Bugün canlı değil:** `charge_session` üretimden çağrılmıyor, çağrıyı Faz 6 yazacak.
**Kararı ADR-044**, düzeltmesi `/faz-06 §0`. Faz 6'nın ilk maddesi budur.

### P2 — Makbuz numarası vazgeçilen tahsilatta atlıyor ⚠️ **ürün sorusu**

`reserve_receipt_no` sayacı modal **açılırken** artırıyor (K-19'un istediği bu) ama modal
kapatılırsa numara serbest kalmıyor. `/faz-07 §8` ise *"atlamasın"* diyordu. İki şart
birbiriyle çelişik ve teknik bir tercihle çözülemez: makbuz numarasında boşluk olmasının
kabul edilebilir olup olmadığı **muhasebe kararıdır.** Ürün sahibine soruldu, cevabı
`docs/PRD.md §9`'a S11 olarak girer; cevap gelene kadar mevcut davranış kalır.

### P3 — `output/pdf/ornek-makbuz.pdf` depoya commit edilmiş 🧹 **temizlik**

Örnek çıktı üretilen bir dosya, kaynak değil; `.gitignore`'da `output/` yok. Düzeltmesi
`/faz-06 §0`: dosya depodan çıkarılır, `output/` yok sayılanlara eklenir.

---

## Doğrulananlar — hepsi temiz

| Kontrol | Sonuç |
|---|---|
| İkinci defter yolu | **Yok.** `INSERT INTO ledger_entry` tek yerde (`insert_ledger_entry`) |
| ADR-015 · paket satışı | `sell_package` yalnızca `package` + `installment` yazıyor, defter satırı yok |
| ADR-014 · tahsilat iptali | Ters kayıt + mahsup arşivi; **`payment.deleted_at` dolmuyor**; çift iptal reddediliyor |
| K-9 · mahsup sınırı | Hem taksidin açık tutarı hem ödeme toplamı kontrol ediliyor; aynı taksit iki kez mahsup edilemiyor |
| R4.6 · otomatik mahsup | `ORDER BY due_on, seq` — en eski vadeden; **vade filtresi yok**, gelecek taksitler de kapsanıyor |
| Tahakkuk idempotency | `accrued_entry_id IS NULL` süzgeci; `today` bind ediliyor, `date('now')` yok; `entry_date = due_on` (borç gerçek vadesinde görünüyor) |
| Float | Para kodunda yok. `receipt.rs`'teki `f32` PDF **sayfa geometrisi**, tutar değil |
| ADR-006 · snapshot | `fiyat_degisimi_eski_satiri_kapatir_gecmis_fiyati_degistirmez` testi var |
| K-23 · fiyat bulunamazsa | Sessizce 0 yazmıyor; `price_not_found` + eylem öneren Türkçe mesaj. Belirsiz kayıtta ayrıca `ambiguous_enrollment` |
| K-19 · çift tık | Numara modal açılırken rezerve; `disabled={saving}` |
| PDF · gömülü font | `include_str!` ile derlemede gömülü; testte `FontFile2` aranıyor (**ADR-043**) |
| ADR-025 · liste iş bölümü | `lib/paginate.ts` kullanılıyor |
| ADR-007 · metinler | Yeni ekranlarda JSX'te çıplak Türkçe yok |
| Kapsam | `docs/**`, `.claude/**`, `migrations/**`, `pages/takvim/**` **hiç dokunulmamış** |
| Commit disiplini | §1 · §2 · §3 · §5 · §6 · §7 · §8 · §9 — **sekiz ayrı commit**, istendiği gibi |

Test kapsamı `/faz-07 §10`'un listesini karşılıyor: 23 Rust para testi, adları senaryoyu
söylüyor (paket kapatmanın iki dalı, kısmi/tam/fazla ödeme, mahsup sınırı, ekstre CSV'sinin
BOM'u, makbuz verisinin birincil veliyi okuması).

---

## Devir hakkında — ADR-042'nin sonucu

Dış ajan **sınırlara uydu**: migration yok, belge yok, ADR yok, takvim yok, tek defter
yolu, bölümlü commit. Tek gerçek hata (P1) devirden değil, **Faz 5A'dan devralınan bir
eksikle** kesişmesinden doğdu: `solo_unit_price` paketli kayıttan fiyat yazıyordu ve
şartnamede bu yazılı değildi. Ders: devredilen bölümün *altındaki* varsayımlar da
şartnameye girmeli.
