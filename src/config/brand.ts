/**
 * İki ayrı kimlik (ADR-024) — karıştırılmaz.
 *
 * **Ürün kimliği Aktansoft'undur ve sabittir.** Ürün adı `tr.app.brand`'te, uygulama
 * kimliği `tauri.conf.json`'da, yayıncı `Cargo.toml`'da. Hiçbiri buradan gelmez ve
 * hiçbiri ayarlardan düzenlenmez.
 *
 * **Kurum kimliği müşteriye aittir ve değişkendir.** Tek kaynağı `config/kurum.json`;
 * bu dosya onun tipli sarmalayıcısı. Aynı JSON'u Rust tarafı `include_str!` ile gömüyor
 * (`src-tauri/src/brand.rs`) — makbuz (Faz 8) ve kenar çubuğu aynı metni göstermek
 * zorunda. Çalışma anında dosya okuması YOK: gerekçe ADR-024'te.
 *
 * `src/i18n/tr.ts` içinde kurum adı BULUNMAZ — orası ürün metinlerinin envanteri.
 */
import kurum from '../../config/kurum.json'

export interface Institution {
  /** Kenar çubuğunun 2. satırı ve makbuz başlığı (PRD R4.11). */
  name: string
  /** Makbuz alt bilgisi. Boşsa makbuza BASILMAZ — PRD bunları istemiyor. */
  receipt: {
    address: string
    phone: string
  }
}

export const institution: Institution = {
  name: kurum.institutionName,
  receipt: {
    address: kurum.receipt.address,
    phone: kurum.receipt.phone,
  },
}

/**
 * Uygulama sürümü — `package.json`'dan geliyor, elle yazılmıyor.
 *
 * `vite.config.ts` derleme anında `__APP_VERSION__` sabitini basıyor. Elle yazılan sürüm
 * numarası kayar ve kimse fark etmez: Faz 3 sonunda `tr.app.version` `'Sürüm 1.0'`
 * diyordu, gerçek sürüm `0.1.0`'dı. `package.json` ↔ `tauri.conf.json` ↔ `Cargo.toml`
 * üçlüsünün eşitliğini `src/config/brand.test.ts` ve `src-tauri/tests/identity.rs`
 * koruyor.
 */
export const APP_VERSION: string = __APP_VERSION__
