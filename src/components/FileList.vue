<script setup>
import { formatFileSize } from '../lib/pdf.js'

defineProps({ entries: { type: Array, required: true }, selectedId: String, busy: Boolean })
defineEmits(['select', 'move', 'remove', 'clear'])
</script>

<template>
  <section class="file-panel panel" aria-labelledby="file-list-title">
    <div class="panel-heading">
      <div>
        <h2 id="file-list-title">
          合并队列 <span class="count-badge">{{ entries.length }}</span>
        </h2>
        <p>按从上到下的顺序合并</p>
      </div>
      <button class="text-button" :disabled="busy || !entries.length" @click="$emit('clear')">
        清空
      </button>
    </div>
    <ol v-if="entries.length" class="file-list">
      <li
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="file-item"
        :class="{ selected: selectedId === entry.id, 'has-error': entry.status === 'error' }"
      >
        <button
          class="file-select"
          :aria-pressed="selectedId === entry.id"
          :aria-label="`预览 ${entry.name}`"
          @click="$emit('select', entry.id)"
        >
          <span class="file-order">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="file-kind" :class="entry.kind">{{
            entry.kind === 'pdf' ? 'PDF' : entry.kind ? 'IMG' : '…'
          }}</span>
          <span class="file-description"
            ><strong>{{ entry.name }}</strong
            ><span
              >{{ formatFileSize(entry.size) }} ·
              {{
                entry.status === 'loading'
                  ? '正在读取'
                  : entry.status === 'error'
                    ? '读取失败'
                    : `${entry.pageCount} 页`
              }}</span
            ></span
          >
        </button>
        <p v-if="entry.error" class="file-error" role="alert">{{ entry.error }}</p>
        <div class="file-actions">
          <button
            :disabled="busy || index === 0"
            :aria-label="`上移 ${entry.name}`"
            @click="$emit('move', entry.id, -1)"
          >
            ↑ 上移
          </button>
          <button
            :disabled="busy || index === entries.length - 1"
            :aria-label="`下移 ${entry.name}`"
            @click="$emit('move', entry.id, 1)"
          >
            ↓ 下移
          </button>
          <button
            class="remove-button"
            :disabled="busy"
            :aria-label="`移除 ${entry.name}`"
            @click="$emit('remove', entry.id)"
          >
            移除
          </button>
        </div>
      </li>
    </ol>
    <div v-else class="queue-empty">
      <span aria-hidden="true">▤</span><strong>还没有文件</strong>
      <p>添加文档后，可以预览、排序和移除。</p>
    </div>
    <div class="queue-note">PDF 保留原始页面尺寸；图片等比例放入 A4 页面。</div>
  </section>
</template>
