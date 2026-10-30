<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import FileDrop from './components/FileDrop.vue'
import FileList from './components/FileList.vue'
import PdfPreview from './components/PdfPreview.vue'
import { DocumentWorkspace } from './lib/workspace.js'
import { formatFileSize, mergeDocuments, normalizePdfName } from './lib/pdf.js'

const workspace = new DocumentWorkspace()
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`
const state = shallowRef(workspace.snapshot())
const unsubscribe = workspace.subscribe((snapshot) => {
  state.value = snapshot
})
const entries = computed(() => state.value.entries)
const selected = computed(() => entries.value.find((entry) => entry.id === state.value.selectedId))
const totalPages = computed(() => entries.value.reduce((sum, entry) => sum + entry.pageCount, 0))
const totalSize = computed(() => entries.value.reduce((sum, entry) => sum + entry.size, 0))
const hasErrors = computed(() => entries.value.some((entry) => entry.status === 'error'))
const importing = computed(() => entries.value.some((entry) => entry.status === 'loading'))
const exporting = ref(false)
const exportName = ref('合并文档.pdf')
const progress = ref('')
const notices = ref([])
const result = ref('')
const exportError = ref('')
const canExport = computed(
  () => entries.value.length > 0 && !hasErrors.value && !importing.value && !exporting.value,
)
let disposed = false
let importGeneration = 0
const downloadUrls = new Map()

async function addFiles(files) {
  if (exporting.value) return
  const generation = importGeneration
  notices.value = []
  result.value = ''
  exportError.value = ''
  const messages = await workspace.add(files)
  if (!disposed && generation === importGeneration)
    notices.value = [...new Set([...notices.value, ...messages])]
}

function clearFiles() {
  if (exporting.value) return
  importGeneration += 1
  workspace.clear()
  notices.value = []
  result.value = ''
  exportError.value = ''
}

async function exportPdf() {
  if (!canExport.value) return
  exporting.value = true
  result.value = ''
  exportError.value = ''
  progress.value = '正在准备文档…'
  try {
    const bytes = await mergeDocuments(entries.value, (done, total) => {
      progress.value = `正在合并 ${done} / ${total} 个文件…`
    })
    const name = normalizePdfName(exportName.value)
    exportName.value = name
    if (window.polymerDesktop) {
      const response = await window.polymerDesktop.savePdf(bytes, name)
      if (response.error) throw new Error(response.error)
      result.value = response.saved
        ? `已保存 ${name}，共 ${totalPages.value} 页。`
        : '已取消保存，文件仍保留在队列中。'
    } else {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.append(link)
      link.click()
      link.remove()
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url)
        downloadUrls.delete(url)
      }, 60000)
      downloadUrls.set(url, timer)
      result.value = `已生成 ${name}，共 ${totalPages.value} 页，下载已开始。`
    }
  } catch (error) {
    exportError.value = error.message || '合并失败，请检查文件后重试。'
  } finally {
    exporting.value = false
    progress.value = ''
  }
}

function preventNavigation(event) {
  event.preventDefault()
}
function confirmLeave(event) {
  if (entries.value.length || exporting.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('dragover', preventNavigation)
  window.addEventListener('drop', preventNavigation)
  window.addEventListener('beforeunload', confirmLeave)
})
onBeforeUnmount(() => {
  disposed = true
  unsubscribe()
  workspace.dispose()
  window.removeEventListener('dragover', preventNavigation)
  window.removeEventListener('drop', preventNavigation)
  window.removeEventListener('beforeunload', confirmLeave)
  for (const [url, timer] of downloadUrls) {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
})
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <img :src="logoUrl" alt="" />
      <div>
        <h1>聚合 PDF</h1>
        <span>预览 · 排序 · 合并</span>
      </div>
    </div>
    <div class="privacy-badge"><span aria-hidden="true">●</span> 本地处理，文件不会上传</div>
  </header>
  <main class="workspace">
    <div class="intro">
      <div>
        <span class="eyebrow">YOUR DOCUMENT WORKSPACE</span>
        <h2>把零散的文件，合成一份。</h2>
        <p>添加 PDF 或图片，确认顺序后即可导出。</p>
      </div>
      <span class="version">v1.0.0</span>
    </div>
    <FileDrop :disabled="exporting" @files="addFiles" />
    <div v-if="notices.length" class="notice" role="alert">
      <p v-for="notice in notices" :key="notice">{{ notice }}</p>
    </div>
    <div class="editor-grid">
      <FileList
        :entries="entries"
        :selected-id="state.selectedId"
        :busy="exporting"
        @select="workspace.select($event)"
        @move="(id, offset) => workspace.move(id, offset)"
        @remove="workspace.remove($event)"
        @clear="clearFiles"
      />
      <PdfPreview :entry="selected" />
    </div>
    <section class="export-bar panel" aria-label="导出合并 PDF">
      <div class="export-summary">
        <strong>{{ entries.length }} 个文件 <span>·</span> {{ totalPages }} 页</strong
        ><small>{{ formatFileSize(totalSize) }} / 200 MB</small>
      </div>
      <label class="filename-field"
        >导出文件名<input
          v-model="exportName"
          :disabled="exporting"
          maxlength="160"
          placeholder="合并文档.pdf"
          aria-label="导出文件名"
          @keydown.enter="exportPdf"
      /></label>
      <button class="button primary export-button" :disabled="!canExport" @click="exportPdf">
        {{ exporting ? '正在合并…' : '合并并下载 PDF' }} <span aria-hidden="true">↓</span>
      </button>
      <p v-if="hasErrors" class="export-hint error-text">请移除读取失败的文件后再导出。</p>
      <p v-else-if="importing" class="export-hint" role="status">正在读取文件，请稍候。</p>
      <p v-if="progress || result" class="export-hint success-text" role="status">
        {{ progress || result }}
      </p>
      <p v-if="exportError" class="export-hint error-text" role="alert">{{ exportError }}</p>
    </section>
  </main>
  <footer class="app-footer">
    聚合 PDF · 文件仅在当前窗口内处理，关闭后不会保留。<span>PDF / PNG / JPG</span>
  </footer>
</template>
