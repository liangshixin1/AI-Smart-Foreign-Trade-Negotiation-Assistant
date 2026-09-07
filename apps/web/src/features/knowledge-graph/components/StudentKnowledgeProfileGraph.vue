<template>
  <div class="profile-graph">
    <p v-if="loading" class="state">正在生成你的知识状态图…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="reload">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="我的知识地图"
      title="从训练证据看当前学习位置"
      description="外圈表示基于训练证据的学习状态；完成学习资源不等同于已经掌握。"
      content-base="/student/knowledge/"
      empty-text="完成一轮训练或打开学习资源后，这里会形成你的个人知识路径。"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { insightOverlay } from '../graphOverlay'
import { useStudentKnowledgeGraph } from '../composables/useStudentKnowledgeGraph'
import type { KnowledgeInsights } from '../types'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

const props = defineProps<{ insights: KnowledgeInsights }>()
const { graph, loading, error, reload } = useStudentKnowledgeGraph()
const overlay = computed(() =>
  insightOverlay(graph.value ?? emptyGraph(), props.insights, 'student'),
)

function emptyGraph() {
  return {
    graph_version: props.insights.graph_version,
    nodes: [],
    edges: [],
    node_count: 0,
    edge_count: 0,
  }
}
</script>

<style scoped>
.profile-graph {
  margin-top: var(--space-4);
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
