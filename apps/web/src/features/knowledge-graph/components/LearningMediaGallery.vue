<template>
  <section v-if="video || slides" class="gallery" aria-label="教学媒体">
    <LearningVideoPlayer
      v-if="video"
      :key="video.updated_at"
      :node-id="nodeId"
      :asset="video"
      :audience="audience"
    />
    <LearningPptxViewer
      v-if="slides"
      :key="slides.updated_at"
      :node-id="nodeId"
      :asset="slides"
      :audience="audience"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

import type { LearningAsset } from '../types'

// 媒体库体积较大，仅在节点确实上传了对应文件时按需加载。
const LearningPptxViewer = defineAsyncComponent(() => import('./LearningPptxViewer.vue'))
const LearningVideoPlayer = defineAsyncComponent(() => import('./LearningVideoPlayer.vue'))

const props = defineProps<{
  nodeId: string
  assets: LearningAsset[]
  audience: 'student' | 'teacher'
}>()
const video = computed(() => props.assets.find((asset) => asset.kind === 'video') ?? null)
const slides = computed(() => props.assets.find((asset) => asset.kind === 'slides') ?? null)
</script>

<style scoped>
.gallery {
  display: grid;
  gap: var(--space-5);
  margin: var(--space-5) 0;
}
</style>
