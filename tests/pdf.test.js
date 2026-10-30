import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  inspectDocument,
  mergeDocuments,
  normalizePdfName,
  imagePlacement,
} from '../src/lib/pdf.js'
import { moveEntry } from '../src/lib/queue.js'

const pngBytes = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN2UAAAAASUVORK5CYII=',
    'base64',
  ),
)

async function createPdf(sizes) {
  const document = await PDFDocument.create()
  sizes.forEach((size) => document.addPage(size))
  return document.save()
}

test('merging keeps every page, original dimensions and selected document order', async () => {
  const first = await createPdf([
    [200, 300],
    [400, 500],
  ])
  const second = await createPdf([[600, 700]])
  const entries = [
    { id: 'a', status: 'ready', kind: 'pdf', bytes: first },
    { id: 'b', status: 'ready', kind: 'pdf', bytes: second },
  ]
  const progress = []
  const result = await PDFDocument.load(
    await mergeDocuments(moveEntry(entries, 'b', -1), (done, total) =>
      progress.push([done, total]),
    ),
  )
  assert.deepEqual(
    result.getPages().map((page) => page.getSize()),
    [
      { width: 600, height: 700 },
      { width: 200, height: 300 },
      { width: 400, height: 500 },
    ],
  )
  assert.deepEqual(progress, [
    [1, 2],
    [2, 2],
  ])
  assert.equal((await PDFDocument.load(first)).getPageCount(), 2)
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['a', 'b'],
  )
})

test('validates PDFs and PNGs and combines them into one readable PDF', async () => {
  const pdf = await createPdf([[320, 480]])
  assert.deepEqual(await inspectDocument(pdf), { kind: 'pdf', pageCount: 1 })
  const image = await inspectDocument(pngBytes)
  assert.equal(image.kind, 'png')
  assert.equal(image.pageCount, 1)
  const result = await PDFDocument.load(
    await mergeDocuments([
      { status: 'ready', kind: 'pdf', bytes: pdf },
      { status: 'ready', kind: 'png', bytes: pngBytes },
    ]),
  )
  assert.equal(result.getPageCount(), 2)
  assert.deepEqual(result.getPage(1).getSize(), { width: 595.28, height: 841.89 })
})

test('invalid, empty and corrupt files fail with actionable messages', async () => {
  await assert.rejects(inspectDocument(new Uint8Array()), /内容为空/)
  await assert.rejects(inspectDocument(new TextEncoder().encode('not a PDF')), /不支持/)
  await assert.rejects(inspectDocument(new TextEncoder().encode('%PDF-1.7\ncorrupted')), /已损坏/)
  await assert.rejects(mergeDocuments([]), /请先添加/)
  await assert.rejects(mergeDocuments([{ status: 'error' }]), /移除有错误/)
})

test('image placement preserves orientation, aspect ratio and margins', () => {
  const wide = imagePlacement(1200, 600)
  assert.deepEqual(wide.pageSize, [841.89, 595.28])
  assert.equal(wide.width / wide.height, 2)
  assert.ok(wide.x >= 23.99 && wide.y >= 23.99)
  const tall = imagePlacement(600, 1200)
  assert.deepEqual(tall.pageSize, [595.28, 841.89])
  assert.throws(() => imagePlacement(0, 100), /尺寸无效/)
})

test('export names preserve Chinese and remove path or reserved filename characters', () => {
  assert.equal(normalizePdfName(' 合同.PDF '), '合同.pdf')
  assert.equal(normalizePdfName(''), '合并文档.pdf')
  assert.equal(normalizePdfName('CON.pdf'), '文档_CON.pdf')
  assert.equal(normalizePdfName('../one\\two:three.pdf'), '_one_two_three.pdf')
  assert.equal(normalizePdfName('x'.repeat(200)).length, 124)
})

test('reordering at boundaries cannot remove or duplicate documents', () => {
  const entries = [{ id: 'a' }, { id: 'b' }]
  assert.equal(moveEntry(entries, 'a', -1), entries)
  assert.equal(moveEntry(entries, 'b', 1), entries)
  assert.equal(moveEntry(entries, 'missing', 1), entries)
  assert.deepEqual(
    moveEntry(entries, 'a', 1).map((entry) => entry.id),
    ['b', 'a'],
  )
})
