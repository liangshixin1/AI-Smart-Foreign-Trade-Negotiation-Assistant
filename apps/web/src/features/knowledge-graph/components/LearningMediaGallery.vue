<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：从节点附件中选择视频和幻灯片，组织页面内的媒体预览。
逻辑：用 computed 找到两类附件；对应播放器以异步组件按需加载，避免每个学习页面都加载完整媒体库。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：媒体依赖较大，只在有附件时加载，降低纯文字学习页面的初始化成本。
[/组件导读] -->
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
