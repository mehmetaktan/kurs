/**
 * Vitest kurulum dosyası.
 *
 * `globals: false` tuttuğumuz için (her test dosyası `describe`/`it`'i vitest'ten
 * açıkça alıyor) Testing Library kendi otomatik temizliğini kaydedemiyor — global bir
 * `afterEach` bulamıyor. Temizlik yapılmazsa her test önceki testin DOM'unun üstüne
 * çiziyor ve sorgular "birden fazla öğe bulundu" diye patlıyor.
 */
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
