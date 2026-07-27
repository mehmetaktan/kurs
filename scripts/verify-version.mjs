import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const cargo = await readFile(new URL('src-tauri/Cargo.toml', root), 'utf8')
const tauri = JSON.parse(await readFile(new URL('src-tauri/tauri.conf.json', root), 'utf8'))
const cargoVersion = cargo.match(/^version = "([^"]+)"$/m)?.[1]
const expectedConfigSource = '../package.json'

if (cargoVersion !== pkg.version) {
  throw new Error(
    `Sürüm uyuşmuyor: package.json=${pkg.version}, src-tauri/Cargo.toml=${cargoVersion ?? 'yok'}`,
  )
}
if (tauri.version !== expectedConfigSource) {
  throw new Error(
    `Tauri sürümü package.json'dan okunmalı: beklenen ${expectedConfigSource}, bulunan ${tauri.version}`,
  )
}

const releaseTag = process.env.RELEASE_TAG
if (releaseTag && releaseTag !== `v${pkg.version}`) {
  throw new Error(`Yayın etiketi v${pkg.version} olmalı; bulunan ${releaseTag}`)
}

console.log(`Sürüm doğrulandı: ${pkg.version}`)
