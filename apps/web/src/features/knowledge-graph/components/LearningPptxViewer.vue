<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：通过 VueOfficePptx 在学习页面预览受控的 PPTX 附件。
逻辑：useLearningAssetFile 负责鉴权下载并提供二进制数据和临时地址；本组件维护渲染成功或失败状态并提供重试入口。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useLearningAssetFile。
为什么：文件读取与文稿渲染分开，才能区分无权下载、网络失败和 PPTX 渲染失败。
[/组件导读] -->
<template>
  <section class="viewer">
    <header>
      <div>
        <span>教学演示文稿</span><strong>{{ asset.filename }}</strong>
      </div>
      <a v-if="objectUrl" :href="objectUrl" :download="asset.filename">下载 PPTX</a>
    </header>
    <p v-if="loading" class="state">正在解析 PPTX…</p>
    <div v-else-if="error || renderError" class="state error" role="alert">
      <p>{{ error || 'PPTX 在线预览失败，可下载原文件后查看。' }}</p>
      <button v-if="error" type="button" @click="reload">重试</button>
    </div>
    <div v-else-if="arrayBuffer" class="slides-frame">
      <VueOfficePptx :src="arrayBuffer" @rendered="rendered = true" @error="renderError = true" />
      <p v-if="!rendered" class="rendering">正在生成幻灯片画面…</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VueOfficePptx from '@vue-office/pptx'

import { useLearningAssetFile } from '../composables/useLearningAssetFile'
import type { LearningAsset } from '../types'

const props = defineProps<{
  nodeId: string
  asset: LearningAsset
  audience: 'student' | 'teacher'
}>()
const rendered = ref(false)
const renderError = ref(false)
const { arrayBuffer, objectUrl, loading, error, reload } = useLearningAssetFile(
  props.nodeId,
  'slides',
  props.audience,
)
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
  border-bottom: 1px solid var(--color-border);
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
.slides-frame {
  position: relative;
  max-height: min(72vh, 780px);
  overflow: auto;
  padding: var(--space-4);
  background: #eef2f0;
}
.rendering,
.state {
  padding: var(--space-8);
  text-align: center;
}
.rendering {
  position: absolute;
  inset: 0;
  margin: 0;
  background: rgb(255 255 255 / 88%);
}
.error {
  color: var(--color-danger);
}
</style>
