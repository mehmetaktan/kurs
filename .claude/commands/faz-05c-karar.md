---
description: Faz 5C-K — Takvim kütüphanesi kararı (ADR-031) ve para biçimleme düzeltmesi
---

# Faz 5C-K — Karar oturumu

Önce oku: `CLAUDE.md`, `docs/DURUM.md`, `docs/EKRANLAR.md` (**§2 Takvim**),
`docs/TASARIM-SISTEMI.md`, `docs/KARARLAR.md` (**ADR-001**, **ADR-003**, **ADR-011**,
**ADR-014**, **ADR-020**, **ADR-024**, **ADR-030**).

**Bu oturum takvim ekranını yazmaz.** İki çıktısı var: `ADR-031` ve `§4`'teki para
düzeltmesi. Deneme kodu yazılır ama üretime girmez.

> **Neden ayrı oturum.** `/faz-05c` ilk adım olarak bir ADR istiyordu. ADR araştırma
> ister; aynı oturumda hem ölçüp hem ekran yazmak ikisinden birini yarım bırakır —
> ya karar aceleye gelir ya ekran tükenmiş bir bağlamla yazılır. Karar burada verilir,
> `/faz-05c` onu **uygular**.

---

## 0. Eşikleri ÖNCE yaz

Ölçüme başlamadan `docs/KARARLAR.md`'de ADR-031 taslağını aç ve **her ölçütün geçme
eşiğini sayıyla yaz.** Eşik ölçümden sonra yazılırsa bu bir karar değil, çıkan sonucun
gerekçelendirilmesi olur.

Eşiği yazılamayan ölçüt ölçüt değildir; ya sayıya çevir ya listeden çıkar.

## 1. Aday havuzu — en fazla üç

Havuzu ararken iki farklı sınıf var ve karıştırılmamalı:

- **Tam takvim komponenti** — ızgarayı, blokları ve sürüklemeyi kendi çizer.
  Kullanıcının `~/.npmrc`'sindeki **Bryntum** deneme jetonu bu sınıfın adayı.
- **Yardımcı katman** — yalnız tarih matematiği ya da sürükleme; ızgara yine bizim.

Üçten fazla aday inceleme değil oyalanmadır. Elenen adayın **neden** elendiği ADR'ye
tek satır olarak yazılır.

**"Elde yazmak" da bir adaydır** ve §3'te diğerleriyle aynı denemeden geçer. Onun
lehine olan tek şey `EKRANLAR §2`'nin ızgarayı zaten bire bir tarif etmiş olması;
aleyhine olan şey sürükle-bırak, şerit algoritması ve erişilebilirliğin bize kalması.

## 2. Yedi ölçüt ve nasıl ölçüleceği

| # | Ölçüt | Nasıl ölçülür | Eleme koşulu |
|---|---|---|---|
| 1 | **Çevrimdışı** | Paket kaynağında `fetch` · `XMLHttpRequest` · `sendBeacon` · lisans doğrulama · telemetri taraması | Bir tanesi bile varsa **elenir** (ADR-001: sunucu yok, hesap yok) |
| 2 | **Lisans** | LICENSE dosyasının **tam metni** okunur — özet değil | Aktansoft'un ürünü müşteriye teslim etmesine izin vermiyorsa **elenir**. *Deneme jetonu lisans değildir* |
| 3 | **Paket boyutu** | Önce mevcut `dist` JS boyutu (gzip) ölçülür, sonra kütüphaneyle yeniden | Eşik §0'da yazılı. ADR-001 kurulum boyutu için Tauri'yi seçmişti; bu karar kısmen geri alınamaz |
| 4 | **Tasarım uyumu** | §3'teki deneme: `tokens.css` değişkenleriyle bir gün sütunu | Geçersiz kılınan kütüphane CSS satırı sayısı eşiği aşarsa **elenir**. `!important` gerekiyorsa eşiğe bakılmaz, **elenir** |
| 5 | **Türkçe** | Gün/ay adları dışarıdan enjekte edilebiliyor mu; kütüphane içeride `toLocale*` çağırıyor mu | İçeride `toLocale*` çağırıp dışarıdan geçersiz kılınamıyorsa **elenir** (`tr.ts` §801'in gerekçesi) |
| 6 | **Sürükleme API'si** | Kaynakta `draggable=` / `dragstart` (HTML5 DnD) mı, `pointerdown` / `setPointerCapture` mı | **HTML5 DnD ise elenir** — **ADR-030**. R3.7'nin 5px eşiği o API üzerinde *kurulamaz*: `dragstart` eşiğini tarayıcı belirler |
| 7 | **Kaydırma + yoğunluk** | 840px'lik ızgara 700px'lik pencerede kaydırmayla çalışıyor mu; `--calendar-slot-height` değişince ızgara takip ediyor mu | Sabit piksel varsayıp yoğunluk anahtarını kırıyorsa **elenir** |

Ölçüt 6 ve 7 Faz 5B denetiminde eklendi; 6'nın gerekçesi **ADR-030**'da, 7'ninki
`docs/DURUM.md > Faz 5B denetimi > B2`'de.

## 3. Deneme (spike) — tek gün sütunu

Her ayakta kalan aday **aynı** şeyi kurar, böylece ölçüm karşılaştırılabilir olur:

- 08:00–22:00, 30 dk = `var(--calendar-slot-height)`
- Üç ders bloğu; ikisi **çakışan** (şerit algoritmasını görmek için)
- Bir **taralı tatil sütunu**
- Renk, yazı tipi ve boşluklar `tokens.css`'ten — kütüphanenin kendi temasından değil

Kurallar:

- Deneme kodu `src/dev/` altında kalır. `npm run verify:bundle` üretime sızmadığını
  zaten denetliyor.
- **Aday başına zaman kutusu var.** Bir gün sütunu bir oturumun küçük bir dilimini
  geçiyorsa eleme gerekçesi zaten ortaya çıkmış demektir; zorlamaya devam etme.
- **"Elde" seçilirse bu deneme çöp değildir** — `/faz-05c`'nin ızgarasının başlangıcı
  olur. ADR'ye bunu not düş.

## 4. Kararla ilgisiz, bu oturumda kapanacak tek düzeltme: para biçimleme

Faz 5B denetiminde bulundu. Küçük ama para ve teslim platformunu ilgilendiriyor,
takvim kararını beklemesi için sebep yok.

**Sorun.** `src/lib/format.ts` içinde `formatKurus` binlik ayıracını
`lira.toLocaleString('tr-TR')` ile üretiyor. Rust ikizi `src-tauri/src/money.rs` aynı işi
**elle** yapıyor. Projenin kendi kuralı — `format.ts > normalizeTr` yorumu ve
`src/i18n/tr.ts:801` — "WebView2'de ICU verisi eksik kurulmuş olabilir" diyor ve bu
varsayımı `toLocaleLowerCase`'e ve `toLocaleDateString`'e uygulamış; `toLocaleString`'e
uygulamamış. ICU düşerse `1.234,56` yerine `1,234,56` çıkar.

**Test bunu yakalayamaz:** vitest, Node'un tam ICU'suyla koşuyor. İki ikiz yalnızca
Windows'ta, kullanıcının ekranında ayrışır.

Yap:

- `formatKurus`'un binlik ayıracını elle üret — `money.rs`'teki döngünün aynısı.
  Böylece iki ikiz aynı algoritmayı çalıştırır, aynı sonucu **aynı nedenle** verir.
- Testi ekle: çıktının `Intl`'e bağlı olmadığını gösteren bir vaka.
- `src/` içindeki diğer `toLocale*` çağrılarını tara. Bugün bilinen tek kalıntı
  `src/ui/Display.tsx` içindeki `toLocaleUpperCase('tr')` — bu para değil, bir **etiket**;
  düzeltilecek mi bırakılacak mı **karar ver ve gerekçesini koda yaz.**

`src/ui/Picker.tsx`'in `new Date()` yedeğine **dokunma.** Denetimde işaretlendi, sonra
ADR-029'un istisna listesinde zaten yazılı olduğu görüldü: "yalnızca hangi ayın
açılacağını seçer, çağıranların hepsi `today`'i veriyor." Kapanmış bir karar.

## 5. ADR-031'i yaz

`docs/KARARLAR.md`'ye, projenin ADR biçiminde. İçinde şunlar bulunmalı:

1. **Karar** — hangi yol, tek cümle.
2. **Eşikler ve ölçülen değerler** — §0'da yazılan eşik ile §2/§3'te çıkan sayı
   yan yana, tabloyla. Eşiği kaçıran aday burada görünür.
3. **Elenen adaylar** ve her biri için tek satır eleme gerekçesi.
4. **Kararı geri açacak şey** — hangi değişiklik olursa (yeni sürüm, lisans değişikliği,
   ölçütün geçersizleşmesi) bu ADR yeniden tartışılır.

Karar `docs/DURUM.md`'ye de bir satırla yazılır ki sonraki oturum ne uygulayacağını
tartışmadan bilsin.

---

Bitince `/kapat`. Sonraki oturum `/faz-05c`.
