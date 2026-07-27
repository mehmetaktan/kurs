<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" height="96" alt="Kurs Takip logosu">
</p>

<h1 align="center">Kurs Takip</h1>

<p align="center">
  Özel ders kursları için öğrenci, ders, yoklama ve tahsilat takip programı.
</p>

<p align="center">
  <a href="https://github.com/mehmetaktan/kurs/releases/latest"><strong>Windows için indir</strong></a>
</p>

<p align="center">
  <a href="https://github.com/mehmetaktan/kurs/actions/workflows/ci.yml">
    <img src="https://github.com/mehmetaktan/kurs/actions/workflows/ci.yml/badge.svg" alt="CI durumu">
  </a>
  <a href="https://github.com/mehmetaktan/kurs/releases/latest">
    <img src="https://img.shields.io/github/v/release/mehmetaktan/kurs?label=s%C3%BCr%C3%BCm" alt="En son sürüm">
  </a>
</p>

Kurs Takip, küçük özel ders kurslarının günlük işlerini tek bir yerde yönetmesi için
geliştirilmiş masaüstü uygulamasıdır. İnternet bağlantısı ve kullanıcı hesabı
gerektirmez; bilgiler yalnızca kullanılan bilgisayarda saklanır.

## Özellikler

- Öğrenci, veli, öğretmen, branş ve grup kayıtları
- Birebir ve grup dersleri için tekrar eden ders planları
- Günlük, haftalık ve aylık takvim görünümleri
- Ders erteleme, iptal etme ve telafi dersi oluşturma
- Yoklama alma, devamsızlık notları ve öğrenci ders geçmişi
- Fiyat tarifeleri, ders paketleri ve taksitli satışlar
- Tahsilat kaydı, otomatik borç mahsuplaştırma ve borçlu öğrenci listesi
- Öğrenci cari ekstresi, Excel uyumlu CSV çıktısı ve PDF makbuz
- Günlük özetler ile devamsızlık ve telafi raporları
- Günlük otomatik yedek, elle yedekleme ve güvenli geri yükleme
- Kursun çalışma saatleri ve tatil günleri için özelleştirilebilir ayarlar

## İndirme ve kurulum

En güncel 64-bit Windows kurulum dosyasını
[son sürüm sayfasından](https://github.com/mehmetaktan/kurs/releases/latest)
indirebilirsiniz. İndirdiğiniz `.msi` dosyasını açıp kurulum adımlarını izlemeniz
yeterlidir. Kurulum paketi WebView2'yi çevrimdışı kurabilecek şekilde hazırlanmıştır.

Adım adım yardım için [kurulum kılavuzunu](https://github.com/mehmetaktan/kurs/blob/main/docs/KURULUM.md)
inceleyebilirsiniz.

## Verileriniz sizde kalır

Kurs Takip çevrimdışı çalışır. Öğrenci ve ödeme bilgileri bir bulut servisine
gönderilmez; uygulamanın yerel SQLite veritabanında tutulur.

## Geliştirme

Proje [Tauri 2](https://tauri.app/), React, TypeScript ve SQLite ile geliştirilmiştir.

Gerekli sürümler `.nvmrc` ve `rust-toolchain.toml` dosyalarında sabitlenmiştir.

```bash
npm install
npm run dev
```

Tüm kalite kontrollerini ve testleri çalıştırmak için:

```bash
npm run check
```

Windows kurulum paketi GitHub Actions üzerinde derlenir.

Kurs sahibi için
[kurulum kılavuzu](https://github.com/mehmetaktan/kurs/blob/main/docs/KURULUM.md) ve
[kullanım kılavuzu](https://github.com/mehmetaktan/kurs/blob/main/docs/KULLANIM-KILAVUZU.md)
depoda bulunur.
