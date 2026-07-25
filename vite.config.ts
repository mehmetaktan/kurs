import { defineConfig } from 'vite'
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
})
