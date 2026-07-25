// `vitest/config` — `test` alanının tipi buradan geliyor; 'vite'ın defineConfig'i
// bilmediği bir alan olarak reddeder.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tauri, geliştirmede sabit bir port bekler — port meşgulse sessizce başka porta
// kaymak yerine hata vermeli, yoksa pencere boş açılır.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust tarafı kendi watcher'ına sahip; Vite'ın src-tauri'yi izlemesi
      // her cargo build'de gereksiz sayfa yenilemesi üretir.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'es2021',
    sourcemap: true,
  },
  test: {
    // Komponent davranış testleri gerçek DOM istiyor: odak tuzağı, Esc, klavye gezinmesi
    // ve toast'ın kendiliğinden kapanması saf fonksiyon testiyle doğrulanamaz.
    environment: 'jsdom',
    // Testler arası DOM temizliği — gerekçesi setup.ts içinde.
    setupFiles: ['./src/test/setup.ts'],
    css: {
      // CSS Modules sınıf adları testte olduğu gibi görünsün (`styles.row` → 'row'),
      // yoksa hepsi undefined olur ve sınıf iddiaları sessizce anlamsızlaşır.
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
})
