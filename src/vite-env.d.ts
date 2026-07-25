/// <reference types="vite/client" />

/**
 * `package.json > version` — `vite.config.ts` derleme anında basıyor (ADR-024 §e).
 * Arayüz bunu `src/config/brand.ts` üzerinden okur, doğrudan değil.
 */
declare const __APP_VERSION__: string
