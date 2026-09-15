<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：教师查看单次训练时，用图谱回放每轮评价对应的学习证据。
逻辑：selectedRoundId 与父页面双向同步，replayOverlay 根据当前轮次生成高亮；尚未选择时默认采用最后一条证据。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 KnowledgeGraphPhaseView；状态入口 useTeacherKnowledgeGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
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

// [导读] 解释历史证据使用的映射方式；未知方式保留原始值以便追踪。
function mappingLabel(value: string): string {
  return value === 'fixed_candidates_llm_selected'
    ? '固定图谱候选 + 评价 Agent 选择'
    : `映射方式：${value}`
}
// [导读] 提供节点和连线均为空的合法图结构，让加载完成前的派生计算也能安全读取这些字段。
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
