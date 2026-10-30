import { inspectDocument, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from './pdf.js'
import { moveEntry } from './queue.js'

let nextId = 0

/** Own imported buffers and URLs, including imports removed before reading finishes. */
export class DocumentWorkspace {
  constructor({
    inspect = inspectDocument,
    createUrl = URL.createObjectURL,
    revokeUrl = URL.revokeObjectURL,
  } = {}) {
    this.items = []
    this.selectedId = null
    this.listeners = new Set()
    this.inspect = inspect
    this.createUrl = createUrl
    this.revokeUrl = revokeUrl
    this.disposed = false
  }

  snapshot() {
    return { entries: this.items.map((entry) => ({ ...entry })), selectedId: this.selectedId }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify() {
    const state = this.snapshot()
    this.listeners.forEach((listener) => listener(state))
  }

  async add(files) {
    if (this.disposed) return []
    const notices = []
    const pending = []
    let totalBytes = this.items.reduce((sum, entry) => sum + entry.size, 0)
    for (const file of files) {
      if (this.items.length >= MAX_FILES) {
        notices.push('一次最多添加 50 个文件，请分批处理。')
        break
      }
      if (file.size > MAX_FILE_BYTES) {
        notices.push(`${file.name} 超过单文件 50 MB 限制。`)
        continue
      }
      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        notices.push(`${file.name} 未添加：文件总大小不能超过 200 MB。`)
        continue
      }
      const entry = {
        id: `document-${++nextId}`,
        name: file.name,
        size: file.size,
        status: 'loading',
        pageCount: 0,
      }
      this.items.push(entry)
      pending.push({ entry, file })
      totalBytes += file.size
      this.selectedId ??= entry.id
    }
    this.notify()
    for (const { entry, file } of pending) {
      if (!this.items.includes(entry) || this.disposed) continue
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (!this.items.includes(entry) || this.disposed) continue
        const details = await this.inspect(bytes)
        if (!this.items.includes(entry) || this.disposed) continue
        Object.assign(entry, details, { bytes, status: 'ready' })
        if (details.kind !== 'pdf') entry.previewUrl = this.createUrl(file)
      } catch (error) {
        if (!this.items.includes(entry) || this.disposed) continue
        entry.status = 'error'
        entry.error = error.message || '文件读取失败，请重新选择。'
        entry.bytes = null
        entry.pageCount = 0
      }
      this.notify()
    }
    return notices
  }

  select(id) {
    if (!this.items.some((entry) => entry.id === id)) return
    this.selectedId = id
    this.notify()
  }

  move(id, offset) {
    this.items = moveEntry(this.items, id, offset)
    this.notify()
  }

  remove(id) {
    const index = this.items.findIndex((entry) => entry.id === id)
    if (index < 0) return
    const [entry] = this.items.splice(index, 1)
    if (entry.previewUrl) this.revokeUrl(entry.previewUrl)
    entry.bytes = null
    if (this.selectedId === id)
      this.selectedId = this.items[Math.min(index, this.items.length - 1)]?.id ?? null
    this.notify()
  }

  clear() {
    for (const entry of this.items) {
      if (entry.previewUrl) this.revokeUrl(entry.previewUrl)
      entry.bytes = null
    }
    this.items = []
    this.selectedId = null
    this.notify()
  }

  dispose() {
    this.disposed = true
    this.clear()
    this.listeners.clear()
  }
}
