<template>
  <section class="live-support" aria-label="训练知识罗盘">
    <p v-if="loading" class="state">正在定位当前谈判阶段…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="reload">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="谈判罗盘"
      title="你现在位于…"
      :description="description"
      :size="expanded ? 'regular' : 'compass'"
      :show-legend="expanded"
      :show-controls="expanded"
      content-base="/student/knowledge/"
    >
      <template #actions>
        <button type="button" class="expand-button" @click="expanded = !expanded">
          {{ expanded ? '收起地图' : '查看完整地图' }}
        </button>
      </template>
    </KnowledgeGraphPhaseView>

    <div v-if="latestRecommendations.length" class="turn-cards" aria-live="polite">
      <RouterLink
        v-for="item in latestRecommendations"
        :key="item.node_id"
        :to="learningRoute(item.node_id)"
        :class="['turn-card', { intercultural: isIntercultural(item.node_id) }]"
      >
        <div>
          <span>{{ stateLabel(item.application_state) }}</span>
          <strong>{{ item.title }}</strong>
        </div>
        <p>{{ item.contextual_how || item.reason }}</p>
        <small v-if="item.evidence_excerpt">“{{ item.evidence_excerpt }}”</small>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { RoundEvaluation } from '@/features/training/types'

import { useStudentKnowledgeGraph } from '../composables/useStudentKnowledgeGraph'
import { liveCompassOverlay } from '../graphOverlay'
import type { AttemptScaffold } from '../types'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

const props = defineProps<{ scaffold: AttemptScaffold; evaluations: RoundEvaluation[] }>()
const route = useRoute()
const expanded = ref(false)
const { graph, loading, error, reload } = useStudentKnowledgeGraph(String(route.params.attemptId))
const overlay = computed(() =>
  graph.value
    ? liveCompassOverlay(graph.value, props.scaffold, props.evaluations)
    : {
        audience: 'student' as const,
        phase: 'compass' as const,
        revision: '',
        nodes: [],
        edges: [],
      },
)
const latestRecommendations = computed(
  () => props.evaluations.at(-1)?.recommendations.slice(0, 3) ?? [],
)
const description = computed(() =>
  latestRecommendations.value.length
    ? '完整流程保持原位；本轮相关链条已点亮。'
    : '完整流程以低细节显示，首轮反馈后点亮当前位置。',
)

function isIntercultural(nodeId: string): boolean {
  return graph.value?.nodes.find((node) => node.id === nodeId)?.knowledge_type === 'Cross-cultural'
}

function stateLabel(state?: string): string {
  return (
    {
      applied_correctly: '已正确运用',
      applied_partially: '已部分运用',
      misapplied: '注意误用',
      recalled_unused: '已提示未采用',
      missed_required: '本轮遗漏',
      recommended_next: '下一步建议',
    }[state ?? 'recommended_next'] ?? '本轮建议'
  )
}

function learningRoute(nodeId: string) {
  return {
    path: `/student/knowledge/${encodeURIComponent(nodeId)}`,
    query: {
      returnTo: route.fullPath,
      source: 'training',
      attemptId: String(route.params.attemptId),
    },
  }
}
</script>

<style scoped>
.live-support {
  display: grid;
  gap: var(--space-3);
}
.state {
  color: var(--color-muted);
  font-size: 0.76rem;
}
.state button,
.expand-button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
  font-weight: 750;
}
.error {
  color: var(--color-danger);
}
.turn-cards {
  display: grid;
  gap: var(--space-2);
}
.turn-card {
  display: grid;
  gap: 4px;
  padding: var(--space-3);
  border: 1px solid #d7c18a;
  border-left: 4px solid #d49625;
  border-radius: var(--radius-sm);
  color: inherit;
  background: #fffaf0;
  text-decoration: none;
}
.turn-card.intercultural {
  border-color: #d9b2c2;
  border-left-color: #a85f7b;
  background: #fff7fa;
}
.turn-card div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}
.turn-card span,
.turn-card small {
  color: var(--color-muted);
  font-size: 0.67rem;
}
.turn-card strong {
  color: var(--color-ink);
  font-size: 0.78rem;
}
.turn-card p {
  margin: 0;
  color: #66583c;
  font-size: 0.72rem;
  line-height: 1.5;
}
</style>
