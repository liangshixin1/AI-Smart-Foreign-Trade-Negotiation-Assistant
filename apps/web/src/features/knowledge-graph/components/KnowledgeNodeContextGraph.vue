<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：在学习内容页展示当前节点处于哪一段知识关系中。
逻辑：按 audience 选择学生或教师图谱接口，再以 nodeId 裁剪局部关系并生成高亮；挂载和节点切换会触发重新读取。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 ContextKnowledgeGraph；状态入口 useAuthStore。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section class="node-context">
    <p v-if="loading" class="state">正在定位当前内容在业务流程中的位置…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="load">重试</button>
    </p>
    <ContextKnowledgeGraph
      v-else-if="graph"
      :graph="focusGraph"
      :overlay="overlay"
      eyebrow="图谱中的位置"
      title="当前内容在业务流程中的位置"
      description="当前节点以橙色标出；连线保留它跨阶段复用的现象与上级业务主题。"
      :content-base="audience === 'student' ? '/student/knowledge/' : '/teacher/knowledge-content/'"
      :content-action-label="audience === 'student' ? '查看学习内容' : '查看与维护教学资源'"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import { nodeContextGraph, nodeContextOverlay } from '../graphOverlay'
import type { KnowledgeGraphView } from '../types'
import ContextKnowledgeGraph from './ContextKnowledgeGraph.vue'

const props = defineProps<{ nodeId: string; audience: 'student' | 'teacher' }>()
const auth = useAuthStore()
const graph = ref<KnowledgeGraphView | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const focusGraph = computed(() =>
  graph.value ? nodeContextGraph(graph.value, props.nodeId) : emptyGraph(),
)
const overlay = computed(() => nodeContextOverlay(focusGraph.value, props.nodeId, props.audience))

// [导读] 按访问角色读取图谱并更新加载状态，节点局部裁剪在 computed 中完成。
async function load(): Promise<void> {
  if (!auth.accessToken) return
  loading.value = true
  error.value = null
  try {
    graph.value =
      props.audience === 'student'
        ? await knowledgeGraphLearningApi.studentGraph(auth.accessToken)
        : await knowledgeGraphLearningApi.teacherGraph(auth.accessToken)
  } catch (cause: unknown) {
    error.value = cause instanceof Error ? cause.message : '内容位置加载失败。'
  } finally {
    loading.value = false
  }
}

// [导读] 提供节点和连线均为空的合法图结构，让加载完成前的派生计算也能安全读取这些字段。
function emptyGraph(): KnowledgeGraphView {
  return { graph_version: '', nodes: [], edges: [], node_count: 0, edge_count: 0 }
}

watch(() => props.nodeId, load)
onMounted(load)
</script>

<style scoped>
.node-context {
  margin-top: var(--space-6);
}
.state {
  color: var(--color-muted);
}
.state button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.error {
  color: var(--color-danger);
}
</style>
