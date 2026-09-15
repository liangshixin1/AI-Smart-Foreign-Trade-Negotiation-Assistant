<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：在学生评价页切换逐轮回放与知识缺口视图。
逻辑：分别加载本次训练的支持库和图谱，再按轮次与视图模式生成 overlay；知识缺口依据明确评价证据，不能把普通灰色节点解释为不会。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 KnowledgeGraphPhaseView；状态入口 useAttemptScaffold、useStudentKnowledgeGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section class="evaluation-graph">
    <p v-if="loading || graphLoading" class="state">正在还原完整训练轨迹…</p>
    <p v-else-if="error || graphError" class="state error" role="alert">
      {{ error || graphError }} <button type="button" @click="reloadAll">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="scaffold && graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="训练后复盘"
      :title="viewMode === 'replay' ? '这次谈判经过了哪些知识节点' : '哪些知识仍需要补上'"
      :description="description"
      size="large"
      content-base="/student/knowledge/"
    >
      <template #actions>
        <div class="toolbar">
          <div class="view-switch" aria-label="选择复盘方式">
            <button
              v-for="item in views"
              :key="item.value"
              type="button"
              :class="{ active: viewMode === item.value }"
              @click="viewMode = item.value"
            >
              {{ item.label }}
            </button>
          </div>
          <div v-if="viewMode === 'replay'" class="round-picker" aria-label="选择评价轮次">
            <button
              v-for="(_, index) in evaluations"
              :key="index"
              type="button"
              :class="{ active: activeRoundIndex === index }"
              @click="activeRoundIndex = index"
            >
              第 {{ index + 1 }} 轮
            </button>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="semantic-legend">
          <span><i class="correct" />正确运用</span>
          <span><i class="partial" />部分运用</span>
          <span><i class="unused" />已提示未采用</span>
          <span><i class="missed" />应出现但缺失/误用</span>
        </div>
        <article v-if="activeEvaluation && viewMode === 'replay'" class="round-summary">
          <div>
            <span>第 {{ activeRoundIndex + 1 }} 轮</span
            ><strong>{{ activeEvaluation.score }} 分</strong>
          </div>
          <p>{{ activeEvaluation.detailed_evaluation }}</p>
          <small>下一步：{{ activeEvaluation.next_step_suggestion }}</small>
        </article>
      </template>
    </KnowledgeGraphPhaseView>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { RoundEvaluation } from '@/features/training/types'

import { useAttemptScaffold } from '../composables/useAttemptScaffold'
import { useStudentKnowledgeGraph } from '../composables/useStudentKnowledgeGraph'
import { sessionReplayOverlay } from '../graphOverlay'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

type ViewMode = 'replay' | 'gap'
const props = defineProps<{ attemptId: string; evaluations: RoundEvaluation[] }>()
const views: Array<{ value: ViewMode; label: string }> = [
  { value: 'replay', label: '逐轮回放' },
  { value: 'gap', label: '知识缺口' },
]
const viewMode = ref<ViewMode>('replay')
const activeRoundIndex = ref(Math.max(0, props.evaluations.length - 1))
const { scaffold, loading, error, reload } = useAttemptScaffold(props.attemptId)
const {
  graph,
  loading: graphLoading,
  error: graphError,
  reload: reloadGraph,
} = useStudentKnowledgeGraph(props.attemptId)
const overlay = computed(() =>
  graph.value && scaffold.value
    ? sessionReplayOverlay(
        graph.value,
        scaffold.value,
        props.evaluations,
        activeRoundIndex.value,
        viewMode.value === 'gap',
      )
    : {
        audience: 'student' as const,
        phase: 'replay' as const,
        revision: '',
        nodes: [],
        edges: [],
      },
)
const activeEvaluation = computed(() => props.evaluations[activeRoundIndex.value])
const description = computed(() =>
  viewMode.value === 'replay'
    ? '完整阶段地图保持原位；橙色是当前轮次，较淡路径是此前轮次，点击节点可回到学习内容。'
    : '只把评价证据明确标记为误用、未采用或必须缺失的节点作为缺口；其他灰色节点不等于不会。',
)

watch(
  () => props.evaluations.length,
  (length) => {
    activeRoundIndex.value = Math.max(0, length - 1)
  },
)

// [导读] 并行重新读取支持库和图谱，避免只刷新其中一份后继续使用旧数据。
async function reloadAll(): Promise<void> {
  await Promise.all([reload(), reloadGraph()])
}
</script>

<style scoped>
.evaluation-graph {
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
.toolbar,
.view-switch,
.round-picker,
.semantic-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.toolbar {
  justify-content: flex-end;
}
.view-switch button,
.round-picker button {
  min-height: 32px;
  padding: 0 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  background: var(--color-surface);
  cursor: pointer;
}
.view-switch button.active,
.round-picker button.active {
  border-color: var(--color-primary);
  color: white;
  background: var(--color-primary);
}
.semantic-legend {
  color: var(--color-muted);
  font-size: 0.72rem;
}
.semantic-legend span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.semantic-legend i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.correct {
  background: #2f9270;
}
.partial {
  background: #d6a243;
}
.unused {
  border: 2px dashed #9a721e;
  background: #e2b354;
}
.missed {
  border: 2px dashed #c34f47;
  background: #fff4f2;
}
.round-summary {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid #d99427;
  background: #fff9ed;
}
.round-summary div {
  display: flex;
  justify-content: space-between;
}
.round-summary p,
.round-summary small {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
}
</style>
