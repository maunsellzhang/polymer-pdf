import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'))
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  const destination = resolve(projectRoot, 'public/pdfjs', directory)
  await mkdir(destination, { recursive: true })
  await cp(resolve(pdfRoot, directory), destination, { recursive: true })
}

// Keep dependency notices with both the website and the packaged desktop app.
const notices = [await readFile(resolve(projectRoot, 'LICENSE'), 'utf8')]
for (const [name, license] of [
  ['vue', 'LICENSE'],
  ['@vue/shared', 'LICENSE'],
  ['@vue/reactivity', 'LICENSE'],
  ['@vue/runtime-core', 'LICENSE'],
  ['@vue/runtime-dom', 'LICENSE'],
  ['pdfjs-dist', 'LICENSE'],
  ['pdf-lib', 'LICENSE.md'],
  ['@pdf-lib/standard-fonts', 'LICENSE.md'],
  ['@pdf-lib/upng', 'LICENSE'],
  ['pako', 'LICENSE'],
  ['tslib', 'LICENSE.txt'],
]) {
  const root = dirname(require.resolve(`${name}/package.json`))
  notices.push(`${name}\n${await readFile(resolve(root, license), 'utf8')}`)
}
await writeFile(resolve(projectRoot, 'public/THIRD-PARTY-NOTICES.txt'), notices.join('\n\n---\n\n'))
