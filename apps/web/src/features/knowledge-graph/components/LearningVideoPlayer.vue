<template>
  <section class="viewer">
    <header>
      <div>
        <span>讲解视频</span><strong>{{ asset.filename }}</strong>
      </div>
      <a v-if="objectUrl" :href="objectUrl" :download="asset.filename">下载原文件</a>
    </header>
    <p v-if="loading" class="state">正在加载视频…</p>
    <div v-else-if="error" class="state error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </div>
    <div v-show="!loading && !error" class="player-frame">
      <video
        ref="videoElement"
        class="video-js vjs-big-play-centered"
        controls
        preload="metadata"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

import { useLearningAssetFile } from '../composables/useLearningAssetFile'
import type { LearningAsset } from '../types'

const props = defineProps<{
  nodeId: string
  asset: LearningAsset
  audience: 'student' | 'teacher'
}>()
const videoElement = ref<HTMLVideoElement | null>(null)
let player: ReturnType<typeof videojs> | null = null
const { objectUrl, loading, error, reload } = useLearningAssetFile(
  props.nodeId,
  'video',
  props.audience,
)

watch(objectUrl, async (source) => {
  if (!source) return
  await nextTick()
  if (!videoElement.value) return
  if (player) {
    player.src({ src: source, type: props.asset.content_type })
    return
  }
  player = videojs(videoElement.value, {
    controls: true,
    fluid: true,
    language: 'zh-CN',
    sources: [{ src: source, type: props.asset.content_type }],
  })
})

onBeforeUnmount(() => {
  player?.dispose()
  player = null
})
</script>

<style scoped>
.viewer {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
header div {
  display: grid;
  gap: 0.15rem;
}
header span {
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 800;
}
header strong {
  word-break: break-all;
}
header a {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 750;
}
.player-frame {
  background: #111916;
}
.state {
  padding: var(--space-8);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
</style>
