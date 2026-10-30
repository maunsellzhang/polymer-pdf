<script setup>
import { ref } from 'vue'

defineProps({ disabled: Boolean })
const emit = defineEmits(['files'])
const input = ref(null)
const dragging = ref(false)

function choose(event) {
  emit('files', Array.from(event.target.files || []))
  event.target.value = ''
}

function drop(event, disabled) {
  dragging.value = false
  if (!disabled) emit('files', Array.from(event.dataTransfer.files))
}
</script>

<template>
  <section
    class="file-drop"
    :class="{ 'is-dragging': dragging && !disabled }"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="drop($event, disabled)"
  >
    <div class="drop-symbol" aria-hidden="true">＋</div>
    <div class="drop-copy">
      <strong>把文件拖到这里，开始整理</strong>
      <span>支持 PDF、PNG、JPG · 单文件不超过 50 MB</span>
    </div>
    <button class="button primary" :disabled="disabled" @click="input.click()">添加文件</button>
    <input
      ref="input"
      class="file-input"
      type="file"
      multiple
      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
      aria-label="选择 PDF 或图片文件"
      :disabled="disabled"
      @change="choose"
    />
  </section>
</template>
