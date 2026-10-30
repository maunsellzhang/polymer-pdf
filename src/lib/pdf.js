import { PDFDocument, EncryptedPDFError } from 'pdf-lib'

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024
export const MAX_FILES = 50

/** Inspect bytes rather than trusting a file extension or MIME type. */
export function detectFileKind(bytes) {
  if (bytes.length === 0) throw new Error('文件内容为空，请重新选择文件。')
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  if (header.includes('%PDF-')) return 'pdf'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg'
  throw new Error('不支持该文件，请选择有效的 PDF、PNG 或 JPG。')
}

/** Validate a document before adding it to the export queue. */
export async function inspectDocument(bytes) {
  const kind = detectFileKind(bytes)
  try {
    if (kind === 'pdf') {
      const document = await PDFDocument.load(bytes, { updateMetadata: false })
      if (document.getPageCount() === 0) throw new Error('PDF 中没有可合并的页面。')
      return { kind, pageCount: document.getPageCount() }
    }
    const document = await PDFDocument.create()
    const image = kind === 'png' ? await document.embedPng(bytes) : await document.embedJpg(bytes)
    return { kind, pageCount: 1, width: image.width, height: image.height }
  } catch (error) {
    if (error instanceof EncryptedPDFError)
      throw new Error('该 PDF 已加密，请先解除密码保护再导入。')
    if (error.message === 'PDF 中没有可合并的页面。') throw error
    throw new Error('无法读取文件，文件可能已损坏或格式不完整。')
  }
}

/** Fit images on an A4 page without changing their aspect ratio. */
export function imagePlacement(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('图片尺寸无效。')
  const pageSize = width > height ? [841.89, 595.28] : [595.28, 841.89]
  const scale = Math.min((pageSize[0] - 48) / width, (pageSize[1] - 48) / height)
  return {
    pageSize,
    x: (pageSize[0] - width * scale) / 2,
    y: (pageSize[1] - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  }
}

/** Copy every PDF page and embed images in the chosen document order. */
export async function mergeDocuments(entries, onProgress = () => {}) {
  if (!entries.length) throw new Error('请先添加需要合并的文件。')
  if (entries.some((entry) => entry.status !== 'ready' || !entry.bytes)) {
    throw new Error('请等待文件读取完成，并移除有错误的文件后再导出。')
  }
  const merged = await PDFDocument.create()
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (entry.kind === 'pdf') {
      const source = await PDFDocument.load(entry.bytes, { updateMetadata: false })
      const pages = await merged.copyPages(source, source.getPageIndices())
      pages.forEach((page) => merged.addPage(page))
    } else {
      const image =
        entry.kind === 'png'
          ? await merged.embedPng(entry.bytes)
          : await merged.embedJpg(entry.bytes)
      const { pageSize, ...placement } = imagePlacement(image.width, image.height)
      merged.addPage(pageSize).drawImage(image, placement)
    }
    onProgress(index + 1, entries.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  merged.setTitle('合并文档')
  merged.setCreator('聚合 PDF')
  merged.setProducer('聚合 PDF / pdf-lib')
  return merged.save()
}

/** Produce a portable PDF filename without Windows path or device names. */
export function normalizePdfName(name) {
  let base = String(name ?? '')
    .trim()
    .replace(/\.pdf$/i, '')
  base = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '')
  base = Array.from(base).slice(0, 120).join('') || '合并文档'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `文档_${base}`
  return `${base}.pdf`
}

export function formatFileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
