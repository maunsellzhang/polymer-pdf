import test from 'node:test'
import assert from 'node:assert/strict'
import { DocumentWorkspace } from '../src/lib/workspace.js'
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from '../src/lib/pdf.js'

const details = async () => ({ kind: 'pdf', pageCount: 2 })
const file = (name = 'test.pdf', size = 5) => ({
  name,
  size,
  arrayBuffer: async () => new ArrayBuffer(size),
})

test('removing a file during an asynchronous read never adds it back', async () => {
  let resolveRead
  const workspace = new DocumentWorkspace({ inspect: details })
  const pending = workspace.add([
    {
      name: 'pending.pdf',
      size: 2,
      arrayBuffer: () =>
        new Promise((resolve) => {
          resolveRead = resolve
        }),
    },
  ])
  workspace.remove(workspace.snapshot().selectedId)
  resolveRead(new ArrayBuffer(2))
  await pending
  assert.deepEqual(workspace.snapshot(), { entries: [], selectedId: null })
})

test('clearing while inspection is pending does not revive a file or leak an image URL', async () => {
  let resolveInspection
  let started
  const inspecting = new Promise((resolve) => {
    started = resolve
  })
  let created = 0
  const workspace = new DocumentWorkspace({
    inspect: () => {
      started()
      return new Promise((resolve) => {
        resolveInspection = resolve
      })
    },
    createUrl: () => {
      created++
      return 'blob:unused'
    },
  })
  const pending = workspace.add([file()])
  await inspecting
  workspace.clear()
  resolveInspection({ kind: 'png', pageCount: 1 })
  await pending
  assert.equal(workspace.snapshot().entries.length, 0)
  assert.equal(created, 0)
})

test('selection stays on a remaining file and image URLs are released exactly once', async () => {
  const revoked = []
  let nextUrl = 0
  const workspace = new DocumentWorkspace({
    inspect: async () => ({ kind: 'png', pageCount: 1 }),
    createUrl: () => `blob:${++nextUrl}`,
    revokeUrl: (url) => revoked.push(url),
  })
  await workspace.add([file('first.png'), file('second.png')])
  const entries = workspace.snapshot().entries
  workspace.remove(entries[0].id)
  assert.equal(workspace.snapshot().selectedId, entries[1].id)
  workspace.dispose()
  workspace.dispose()
  assert.deepEqual(revoked, ['blob:1', 'blob:2'])
  await workspace.add([file()])
  assert.equal(workspace.snapshot().entries.length, 0)
})

test('a failed import stays visible without blocking successful files from being read', async () => {
  const workspace = new DocumentWorkspace({
    inspect: async (bytes) => {
      if (bytes.length === 1) throw new Error('bad document')
      return { kind: 'pdf', pageCount: 1 }
    },
  })
  await workspace.add([file('bad.pdf', 1), file('good.pdf', 2)])
  const entries = workspace.snapshot().entries
  assert.equal(entries[0].status, 'error')
  assert.equal(entries[0].error, 'bad document')
  assert.equal(entries[1].status, 'ready')
})

test('oversized files are rejected before reading and the combined budget is bounded', async () => {
  let reads = 0
  const oversized = {
    name: 'large.pdf',
    size: MAX_FILE_BYTES + 1,
    arrayBuffer: async () => {
      reads++
      return new ArrayBuffer(1)
    },
  }
  const workspace = new DocumentWorkspace({ inspect: details })
  assert.match((await workspace.add([oversized]))[0], /50 MB/)
  assert.equal(reads, 0)
  const large = {
    name: 'valid.pdf',
    size: MAX_FILE_BYTES,
    arrayBuffer: async () => new ArrayBuffer(1),
  }
  const notices = await workspace.add(
    Array.from({ length: MAX_TOTAL_BYTES / MAX_FILE_BYTES + 1 }, () => large),
  )
  assert.equal(workspace.snapshot().entries.length, 4)
  assert.match(notices[0], /200 MB/)
})
