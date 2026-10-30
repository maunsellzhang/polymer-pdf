<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps({ entry: Object })
const canvas = ref(null)
const stage = ref(null)
const stageWidth = ref(800)
const pageNumber = ref(1)
const zoom = ref(0)
const loading = ref(false)
const error = ref('')
const pageCount = computed(() => props.entry?.pageCount || 1)
let loadingTask = null
let pdf = null
let rendering = null
let documentGeneration = 0
let renderGeneration = 0
let observer = null
const assetRoot = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href

async function renderPage() {
  const generation = ++renderGeneration
  const document = pdf
  const previous = rendering
  previous?.cancel()
  if (previous) await previous.promise.catch(() => {})
  if (generation !== renderGeneration || !document) return
  loading.value = true
  error.value = ''
  try {
    const page = await document.getPage(pageNumber.value)
    await nextTick()
    if (generation !== renderGeneration || document !== pdf || !canvas.value) return
    const natural = page.getViewport({ scale: 1 })
    const scale = zoom.value
      ? zoom.value / 100
      : Math.max(0.05, (stageWidth.value - 56) / natural.width)
    const viewport = page.getViewport({ scale })
    if (
      !Number.isFinite(viewport.width * viewport.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0
    )
      throw new Error('Invalid page size')
    const outputScale = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(12000000 / (viewport.width * viewport.height)),
      16384 / viewport.width,
      16384 / viewport.height,
    )
    const surface = canvas.value
    surface.width = Math.max(1, Math.floor(viewport.width * outputScale))
    surface.height = Math.max(1, Math.floor(viewport.height * outputScale))
    surface.style.width = `${viewport.width}px`
    surface.style.height = `${viewport.height}px`
    rendering = page.render({
      canvasContext: surface.getContext('2d'),
      viewport,
      transform: [outputScale, 0, 0, outputScale, 0, 0],
    })
    await rendering.promise
  } catch (reason) {
    if (generation === renderGeneration && reason.name !== 'RenderingCancelledException')
      error.value = '此页面暂时无法预览，请尝试重新导入文件。'
  } finally {
    if (generation === renderGeneration) loading.value = false
  }
}

watch(
  () => props.entry?.bytes,
  async (bytes) => {
    const generation = ++documentGeneration
    renderGeneration += 1
    rendering?.cancel()
    rendering = null
    pdf = null
    const previous = loadingTask
    loadingTask = null
    if (previous) await previous.destroy().catch(() => {})
    if (generation !== documentGeneration) return
    pageNumber.value = 1
    error.value = ''
    loading.value = false
    if (!bytes || props.entry?.kind !== 'pdf') return
    loading.value = true
    try {
      // PDF.js transfers its buffer to the worker; keep the export buffer intact.
      loadingTask = getDocument({
        data: bytes.slice(),
        cMapUrl: `${assetRoot}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assetRoot}standard_fonts/`,
        wasmUrl: `${assetRoot}wasm/`,
        isEvalSupported: false,
      })
      const document = await loadingTask.promise
      if (generation !== documentGeneration) return
      pdf = document
      await renderPage()
    } catch {
      if (generation === documentGeneration) {
        error.value = 'PDF 预览失败，请尝试重新导入文件。'
        loading.value = false
      }
    }
  },
  { immediate: true },
)

watch([pageNumber, zoom, stageWidth], renderPage)

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    stageWidth.value = entry.contentRect.width
  })
  if (stage.value) observer.observe(stage.value)
})

onBeforeUnmount(() => {
  documentGeneration += 1
  renderGeneration += 1
  observer?.disconnect()
  rendering?.cancel()
  loadingTask?.destroy().catch(() => {})
})
</script>

<template>
  <section class="preview-panel panel" aria-labelledby="preview-title">
    <div class="panel-heading preview-heading">
      <div>
        <h2 id="preview-title">文档预览</h2>
        <p>{{ entry?.name || '选择一个文件查看内容' }}</p>
      </div>
      <label v-if="entry?.status === 'ready' && entry.kind === 'pdf'" class="zoom-select"
        >显示比例
        <select v-model.number="zoom" aria-label="预览显示比例">
          <option :value="0">适应宽度</option>
          <option :value="75">75%</option>
          <option :value="100">100%</option>
          <option :value="125">125%</option>
          <option :value="150">150%</option>
        </select>
      </label>
    </div>
    <div ref="stage" class="preview-stage" :aria-busy="loading || entry?.status === 'loading'">
      <div v-if="!entry" class="preview-empty">
        <div class="paper-illustration" aria-hidden="true">
          <span>PDF</span><i></i><i></i><i></i>
        </div>
        <h3>让文档井然有序</h3>
        <p>添加文件，在这里确认每一页的内容。</p>
        <span class="local-note">所有处理均在本机完成</span>
      </div>
      <div v-else-if="entry.status === 'error'" class="preview-empty">
        <h3>文件读取失败</h3>
        <p>{{ entry.error }}</p>
      </div>
      <div v-else-if="entry.status === 'loading'" class="preview-empty">
        <div class="spinner"></div>
        <p>正在读取文件…</p>
      </div>
      <template v-else>
        <div v-if="loading" class="preview-loading" role="status">
          <span class="spinner"></span>正在渲染第 {{ pageNumber }} 页
        </div>
        <p v-if="error" class="preview-error" role="alert">{{ error }}</p>
        <canvas
          v-if="entry.kind === 'pdf'"
          ref="canvas"
          v-show="!error"
          class="pdf-canvas"
          role="img"
          :aria-label="`${entry.name} 第 ${pageNumber} 页`"
        ></canvas>
        <img v-else :src="entry.previewUrl" :alt="entry.name" class="image-preview" />
      </template>
    </div>
    <nav class="page-navigation" aria-label="PDF 翻页">
      <button
        class="button small"
        :disabled="!entry || entry.status !== 'ready' || pageNumber <= 1"
        @click="pageNumber--"
      >
        ← 上一页
      </button>
      <span>{{ entry?.status === 'ready' ? `${pageNumber} / ${pageCount} 页` : '等待文件' }}</span>
      <button
        class="button small"
        :disabled="!entry || entry.status !== 'ready' || pageNumber >= pageCount"
        @click="pageNumber++"
      >
        下一页 →
      </button>
    </nav>
  </section>
</template>
