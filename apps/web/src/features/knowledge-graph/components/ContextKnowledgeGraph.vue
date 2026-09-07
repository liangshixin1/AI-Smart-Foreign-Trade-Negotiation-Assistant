<template>
  <section class="context-graph" :class="`size-${size}`">
    <header>
      <div>
        <p>{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <slot name="actions" />
    </header>
    <p v-if="description" class="description">{{ description }}</p>
    <KnowledgeGraphOverlayLegend :audience="overlay.audience" />
    <div v-if="graph.node_count" class="graph-frame">
      <KnowledgeGraphCanvas
        :graph="graph"
        :visible-types="visibleTypes"
        mode="context"
        :selected-node-id="selectedId"
        :overlay="overlay"
        @select="selectedId = $event"
      />
    </div>
    <div v-else class="empty">
      <strong>尚未形成可视化证据</strong>
      <span>{{ emptyText }}</span>
    </div>
    <slot name="footer" />
    <GraphNodeDialog
      :node="selectedNode"
      :neighbors="neighbors"
      :content-base="contentBase"
      :content-action-label="contentActionLabel"
      @close="selectedId = null"
      @select="selectedId = $event"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GraphVisualOverlay } from '../graphOverlay'
import type { KnowledgeGraphView, KnowledgeNodeType } from '../types'
import GraphNodeDialog from './GraphNodeDialog.vue'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas.vue'
import KnowledgeGraphOverlayLegend from './KnowledgeGraphOverlayLegend.vue'

const props = withDefaults(
  defineProps<{
    graph: KnowledgeGraphView
    overlay: GraphVisualOverlay
    eyebrow: string
    title: string
    description?: string
    size?: 'compact' | 'regular' | 'large'
    emptyText?: string
    contentBase?: string
    contentActionLabel?: string
  }>(),
  {
    description: '',
    size: 'regular',
    emptyText: '完成训练后，这里会出现与你真实表达对应的知识关系。',
    contentBase: '',
    contentActionLabel: '查看学习内容',
  },
)

const selectedId = ref<string | null>(null)
const visibleTypes = computed<KnowledgeNodeType[]>(() => [
  ...new Set(props.graph.nodes.map((node) => node.type)),
])
const selectedNode = computed(
  () => props.graph.nodes.find((node) => node.id === selectedId.value) ?? null,
)
const neighbors = computed(() => {
  if (!selectedId.value) return []
  const ids = new Set<string>()
  props.graph.edges.forEach((edge) => {
    if (edge.source === selectedId.value) ids.add(edge.target)
    if (edge.target === selectedId.value) ids.add(edge.source)
  })
  return props.graph.nodes.filter((node) => ids.has(node.id)).slice(0, 16)
})
</script>

<style scoped>
.context-graph {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, #f8fcfa, var(--color-surface));
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
header p,
header h3,
.description {
  margin: 0;
}
header p {
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
header h3 {
  margin-top: 2px;
  font-size: 1.05rem;
}
.description {
  color: var(--color-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}
.graph-frame {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #dce8e2;
  border-radius: var(--radius-md);
  background: #f7faf8;
}
.graph-frame :deep(.canvas-shell) {
  min-height: 390px;
}
.size-compact {
  padding: var(--space-3);
}
.size-compact .graph-frame :deep(.canvas-shell) {
  min-height: 250px;
}
.size-large .graph-frame :deep(.canvas-shell) {
  min-height: 520px;
}
.size-compact :deep(.controls) {
  transform: scale(0.86);
  transform-origin: top right;
}
.empty {
  display: grid;
  gap: var(--space-1);
  min-height: 150px;
  place-content: center;
  padding: var(--space-5);
  color: var(--color-muted);
  text-align: center;
}
.empty strong {
  color: var(--color-ink);
}
</style>
