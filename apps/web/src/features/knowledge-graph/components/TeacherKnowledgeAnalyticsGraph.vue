<template>
  <section class="teacher-graph">
    <p v-if="loading" class="state">正在加载图谱学情视图…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="reload">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="图谱化学情"
      :title="insights.scope === 'classroom' ? '班级知识风险分布' : '学生知识状态路径'"
      :description="modeDescription"
      size="large"
      content-base="/teacher/knowledge-content/"
      content-action-label="查看与维护教学资源"
    >
      <template #actions>
        <div class="mode-switch" aria-label="选择图谱学情视角">
          <button
            v-for="item in modes"
            :key="item.value"
            type="button"
            :class="{ active: mode === item.value }"
            :aria-pressed="mode === item.value"
            @click="mode = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </template>
      <template #footer>
        <div class="explanation">
          <span>节点大小表示受影响学生数或证据次数</span>
          <span>点击节点可查看关系并进入教学资源</span>
        </div>
      </template>
    </KnowledgeGraphPhaseView>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useTeacherKnowledgeGraph } from '../composables/useTeacherKnowledgeGraph'
import { insightOverlay } from '../graphOverlay'
import type { KnowledgeInsights } from '../types'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

type AnalysisMode = 'performance' | 'phenomenon' | 'knowledge' | 'gap'

const props = defineProps<{ insights: KnowledgeInsights }>()
const modes: { value: AnalysisMode; label: string }[] = [
  { value: 'performance', label: '综合表现' },
  { value: 'phenomenon', label: '局面风险' },
  { value: 'knowledge', label: '知识掌握' },
  { value: 'gap', label: '教学缺口' },
]
const mode = ref<AnalysisMode>('performance')
const { graph, loading, error, reload } = useTeacherKnowledgeGraph()
const overlay = computed(() =>
  insightOverlay(graph.value ?? emptyGraph(), props.insights, 'teacher', mode.value),
)
const modeDescription = computed(
  () =>
    ({
      performance: '节点填色表示平均表现；红色低于 70 分，橙色为发展区间，绿色表示相对稳定。',
      phenomenon: '突出学生或班级真实遇到的商务现象，保留其上级阶段与下游知识作为关系背景。',
      knowledge: '突出评价证据映射到的知识与策略；节点越大，涉及的学生或证据越多。',
      gap: '突出“反复被推荐但学习完成不足”或“学习后仍需关注”的节点，支持教师安排补救教学。',
    })[mode.value],
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
.teacher-graph {
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
.mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.mode-switch button {
  min-height: 32px;
  padding: 0 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  background: var(--color-surface);
  cursor: pointer;
}
.mode-switch button.active {
  border-color: var(--color-primary);
  color: white;
  background: var(--color-primary);
}
.explanation {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: 0.72rem;
}
</style>
