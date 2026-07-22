<template>
  <section class="uploader" :class="{ populated: asset }">
    <header>
      <span class="icon" aria-hidden="true">{{ kind === 'video' ? '▶' : '▤' }}</span>
      <div>
        <h3>{{ kind === 'video' ? '讲解视频' : '教学 PPTX' }}</h3>
        <p>{{ helper }}</p>
      </div>
    </header>
    <div v-if="asset" class="current">
      <strong>{{ asset.filename }}</strong>
      <span>{{ formatBytes(asset.size_bytes) }} · 已上传</span>
    </div>
    <p v-if="localError" class="error" role="alert">{{ localError }}</p>
    <footer>
      <label class="select" :class="{ disabled: busy }">
        {{ asset ? '替换文件' : '选择并上传' }}
        <input :accept="accept" type="file" :disabled="busy" @change="selectFile" />
      </label>
      <template v-if="asset">
        <button
          v-if="!confirming"
          type="button"
          class="remove"
          :disabled="busy"
          @click="confirming = true"
        >
          删除
        </button>
        <template v-else>
          <button type="button" class="remove confirm" :disabled="busy" @click="remove">
            确认删除
          </button>
          <button type="button" class="cancel" :disabled="busy" @click="confirming = false">
            取消
          </button>
        </template>
      </template>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { LearningAsset } from '../types'

const props = defineProps<{
  kind: 'video' | 'slides'
  asset: LearningAsset | null
  busy: boolean
}>()
const emit = defineEmits<{
  upload: [kind: 'video' | 'slides', file: File]
  remove: [kind: 'video' | 'slides']
}>()

const confirming = ref(false)
const localError = ref<string | null>(null)
const accept = computed(() =>
  props.kind === 'video' ? '.mp4,.webm,.ogv,video/mp4,video/webm,video/ogg' : '.pptx',
)
const helper = computed(() =>
  props.kind === 'video'
    ? 'MP4 / WebM / OGV，最大 100 MB'
    : '仅 PPTX，最大 30 MB；旧版 PPT 请先另存为 PPTX',
)

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function selectFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const suffix = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const allowed = props.kind === 'video' ? ['.mp4', '.webm', '.ogv'] : ['.pptx']
  const limit = props.kind === 'video' ? 100 * 1024 * 1024 : 30 * 1024 * 1024
  if (!allowed.includes(suffix)) {
    localError.value = props.kind === 'video' ? '请选择 MP4、WebM 或 OGV。' : '请选择 PPTX 文件。'
    return
  }
  if (file.size > limit) {
    localError.value = `文件超过 ${String(limit / 1024 / 1024)} MB 限制。`
    return
  }
  localError.value = null
  emit('upload', props.kind, file)
}

function remove(): void {
  confirming.value = false
  emit('remove', props.kind)
}
</script>

<style scoped>
.uploader {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
}
.uploader.populated {
  border-style: solid;
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}
header,
footer,
.current {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
h3,
p {
  margin: 0;
}
header p,
.current span {
  color: var(--color-muted);
  font-size: 0.78rem;
}
.current {
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: white;
}
footer {
  flex-wrap: wrap;
}
.select,
button {
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
}
.select {
  color: white;
  border-color: var(--color-primary);
  background: var(--color-primary);
}
.select input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.disabled,
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.remove {
  color: var(--color-danger);
}
.confirm {
  color: white;
  border-color: var(--color-danger);
  background: var(--color-danger);
}
.error {
  color: var(--color-danger);
  font-size: 0.8rem;
}
</style>
