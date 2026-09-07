<template>
  <section class="attempt-graph">
    <p v-if="loading" class="state">正在还原本次训练的图谱证据链…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="reload">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="回放同步图谱"
      title="对话、评价与知识证据同轮对齐"
      :description="activeDescription"
      size="large"
      content-base="/teacher/knowledge-content/"
      content-action-label="查看与维护教学资源"
    >
      <template #actions>
        <div class="round-picker" aria-label="选择证据轮次">
          <button
            v-for="(item, index) in evidence"
            :key="item.id"
            type="button"
            :class="{ active: selectedRoundId === item.round_evaluation_id }"
            @click="selectedRoundId = item.round_evaluation_id"
          >
            第 {{ index + 1 }} 轮
          </button>
        </div>
      </template>
      <template #footer>
        <article v-if="activeEvidence" class="evidence-summary">
          <div>
            <span>本轮映射分</span><strong>{{ activeEvidence.score }}</strong>
          </div>
          <p>{{ activeEvidence.evidence_summary }}</p>
          <small>{{ mappingLabel(activeEvidence.mapping_method) }}</small>
        </article>
      </template>
    </KnowledgeGraphPhaseView>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import type { GraphLearningEvidence } from '@/features/teacher-dashboard/api/teacherApi'

import { useTeacherKnowledgeGraph } from '../composables/useTeacherKnowledgeGraph'
import { replayOverlay } from '../graphOverlay'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

const props = defineProps<{ attemptId: string; evidence: GraphLearningEvidence[] }>()
const selectedRoundId = defineModel<string | null>('selectedRoundId', { default: null })
const { graph, loading, error, reload } = useTeacherKnowledgeGraph(props.attemptId)
const overlay = computed(() =>
  replayOverlay(graph.value ?? emptyGraph(), props.evidence, selectedRoundId.value),
)
const activeEvidence = computed(
  () =>
    props.evidence.find((item) => item.round_evaluation_id === selectedRoundId.value) ??
    props.evidence.at(-1),
)
const activeDescription = computed(() => {
  const index = props.evidence.findIndex((item) => item.id === activeEvidence.value?.id)
  return index >= 0
    ? `当前显示第 ${String(index + 1)} 轮：橙色为本轮证据，较淡节点为此前已经出现的轨迹。点击上方对话轮次也会同步切换。`
    : '本次训练尚未形成图谱学习证据。'
})

watch(
  () => props.evidence,
  (items) => {
    if (!selectedRoundId.value && items.length) {
      selectedRoundId.value = items.at(-1)?.round_evaluation_id ?? null
    }
  },
  { immediate: true },
)

function mappingLabel(value: string): string {
  return value === 'fixed_candidates_llm_selected'
    ? '固定图谱候选 + 评价 Agent 选择'
    : `映射方式：${value}`
}
function emptyGraph() {
  return { graph_version: '', nodes: [], edges: [], node_count: 0, edge_count: 0 }
}
</script>

<style scoped>
.attempt-graph {
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
.round-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.round-picker button {
  min-height: 32px;
  padding: 0 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  background: var(--color-surface);
  cursor: pointer;
}
.round-picker button.active {
  border-color: var(--color-primary);
  color: white;
  background: var(--color-primary);
}
.evidence-summary {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid #d99427;
  background: #fff9ed;
}
.evidence-summary div {
  display: flex;
  justify-content: space-between;
}
.evidence-summary p,
.evidence-summary small {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
}
</style>
