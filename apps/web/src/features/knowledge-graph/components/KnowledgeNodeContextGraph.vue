<template>
  <section class="node-context">
    <p v-if="loading" class="state">正在定位该知识在业务流程中的位置…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="load">重试</button>
    </p>
    <ContextKnowledgeGraph
      v-else-if="graph"
      :graph="focusGraph"
      :overlay="overlay"
      eyebrow="图谱中的位置"
      title="这个知识会在哪些商务局面中用到"
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
    error.value = cause instanceof Error ? cause.message : '知识位置加载失败。'
  } finally {
    loading.value = false
  }
}

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
