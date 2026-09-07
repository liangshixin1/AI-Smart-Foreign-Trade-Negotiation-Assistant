<template>
  <section v-if="recommendations.length" class="focus" aria-label="本轮知识关系聚焦">
    <header><span>本轮关系聚焦</span><small>随对话更新</small></header>
    <div class="chain">
      <span class="phenomenon">{{ phenomenon?.short_label ?? '当前局面' }}</span>
      <i aria-hidden="true">→</i>
      <div>
        <RouterLink
          v-for="item in recommendedNodes"
          :key="item.node.id"
          :class="item.recommendation.node_type"
          :to="learningRoute(item.node.id)"
          :title="item.recommendation.reason"
        >
          {{ item.node.short_label }}
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import type { GraphRecommendation } from '@/features/training/types'

import type { KnowledgeGraphNode } from '../types'

const route = useRoute()
const props = defineProps<{
  phenomenon: KnowledgeGraphNode | null
  nodes: KnowledgeGraphNode[]
  recommendations: GraphRecommendation[]
}>()

const recommendedNodes = computed(() => {
  const byId = new Map(props.nodes.map((node) => [node.id, node]))
  return props.recommendations.flatMap((recommendation) => {
    const node = byId.get(recommendation.node_id)
    return node ? [{ node, recommendation }] : []
  })
})

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
.focus {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid #bcd8cc;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #f4fbf7, #fffaf1);
}
header,
.chain,
.chain > div {
  display: flex;
  align-items: center;
}
header {
  justify-content: space-between;
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
}
header small {
  color: var(--color-muted);
  font-weight: 600;
}
.chain {
  gap: var(--space-2);
}
.chain > div {
  flex-wrap: wrap;
  gap: 5px;
}
.chain i {
  color: var(--color-muted);
  font-style: normal;
}
.phenomenon,
a {
  padding: 0.3rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 750;
}
.phenomenon {
  color: #77500b;
  background: #fff0c9;
}
a {
  color: #17628a;
  background: #e8f5fc;
  text-decoration: none;
}
a.strategy {
  color: #17684e;
  background: #e1f4ec;
}
</style>
