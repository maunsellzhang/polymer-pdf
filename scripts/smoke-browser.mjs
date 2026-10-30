import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { preview } from 'vite'

const directory = await mkdtemp(join(tmpdir(), 'polymer-pdf-'))
const server = process.env.SMOKE_URL ? null : await preview({ preview: { port: 4175 } })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: process.env.HEADED !== '1',
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

try {
  for (const [name, sizes] of [
    [
      'first.pdf',
      [
        [595, 842],
        [842, 595],
      ],
    ],
    ['second.pdf', [[420, 595]]],
  ]) {
    const document = await PDFDocument.create()
    sizes.forEach((size, index) => document.addPage(size).drawText(`${name}: page ${index + 1}`))
    await writeFile(join(directory, name), await document.save())
  }
  await writeFile(join(directory, 'invalid.pdf'), '%PDF-1.7\ninvalid')
  await writeFile(join(directory, 'empty.pdf'), '')
  await page.goto(process.env.SMOKE_URL || server.resolvedUrls.local[0])
  const add = page.getByRole('button', { name: '添加文件', exact: true })
  const exportButton = page.getByRole('button', { name: '合并并下载 PDF' })
  const input = page.getByLabel('选择 PDF 或图片文件', { exact: true })
  const settled = () => page.locator('.preview-stage[aria-busy=false]').waitFor()
  assert.equal(await exportButton.isDisabled(), true)
  const chooserPromise = page.waitForEvent('filechooser')
  await add.click()
  await (
    await chooserPromise
  ).setFiles([join(directory, 'first.pdf'), join(directory, 'second.pdf')])
  await page.getByRole('img', { name: 'first.pdf 第 1 页', exact: true }).waitFor()
  await settled()
  await page.getByRole('button', { name: '下一页 →', exact: true }).click()
  await settled()
  assert.equal(await page.getByRole('button', { name: '下一页 →', exact: true }).isDisabled(), true)
  for (const value of ['75', '100', '125', '150', '0']) {
    await page.getByLabel('预览显示比例').selectOption(value)
    await settled()
  }
  await page.getByRole('button', { name: '← 上一页', exact: true }).click()
  await page.getByRole('button', { name: '上移 second.pdf', exact: true }).click()
  for (let index = 0; index < 6; index++) {
    await page
      .getByRole('button', { name: `预览 ${index % 2 ? 'first' : 'second'}.pdf`, exact: true })
      .click()
  }
  await settled()
  assert.deepEqual(await page.locator('.file-description strong').allTextContents(), [
    'second.pdf',
    'first.pdf',
  ])
  await page.getByLabel('导出文件名', { exact: true }).fill('验证合并')
  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  assert.equal(download.suggestedFilename(), '验证合并.pdf')
  const output = join(directory, 'merged.pdf')
  await download.saveAs(output)
  const document = await PDFDocument.load(await readFile(output))
  assert.deepEqual(
    document.getPages().map((sheet) => sheet.getSize()),
    [
      { width: 420, height: 595 },
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ],
  )
  await input.setInputFiles([join(directory, 'invalid.pdf'), join(directory, 'empty.pdf')])
  await page.getByText('请移除读取失败的文件后再导出。', { exact: true }).waitFor()
  assert.equal(await exportButton.isDisabled(), true)
  await page.getByRole('button', { name: '移除 invalid.pdf', exact: true }).click()
  await page.getByRole('button', { name: '移除 empty.pdf', exact: true }).click()
  assert.equal(await exportButton.isEnabled(), true)
  await page.getByRole('button', { name: '下移 second.pdf', exact: true }).click()
  await page.getByRole('button', { name: '移除 second.pdf', exact: true }).click()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await input.setInputFiles(join(directory, 'first.pdf'))
  await page.getByRole('img', { name: 'first.pdf 第 1 页', exact: true }).waitFor()
  await settled()
  await page.setViewportSize({ width: 390, height: 844 })
  await settled()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await exportButton.scrollIntoViewIfNeeded()
  assert.equal(await exportButton.isVisible(), true)
  await page.getByRole('button', { name: '清空', exact: true }).click()
  assert.equal(await exportButton.isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log(
    'Browser smoke passed: preview, page/zoom controls, reorder, download, errors, clear/reimport and mobile layout.',
  )
} finally {
  await context.close()
  await browser.close()
  await server?.close()
  await rm(directory, { recursive: true, force: true })
}
