<template>
  <section class="phase-view" :class="[`phase-${overlay.phase ?? 'profile'}`, `size-${size}`]">
    <header class="phase-header">
      <div>
        <p>{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <slot name="actions" />
    </header>
    <p v-if="description" class="description">{{ description }}</p>
    <KnowledgeGraphOverlayLegend
      v-if="showLegend"
      :audience="overlay.audience"
      :phase="overlay.phase"
    />
    <div class="map-frame">
      <KnowledgeGraphCanvas
        :graph="graph"
        :layout-graph="graph"
        :visible-types="visibleTypes"
        mode="panorama"
        :selected-node-id="selectedId"
        :overlay="overlay"
        :show-controls="showControls"
        @select="selectNode"
      />
    </div>
    <slot name="footer" />
    <GraphNodeDialog
      :node="selectedNode"
      :neighbors="neighbors"
      :content-base="contentBase"
      :content-action-label="contentActionLabel"
      @close="selectedId = null"
      @select="selectNode"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
    size?: 'compass' | 'regular' | 'large'
    showLegend?: boolean
    showControls?: boolean
    contentBase?: string
    contentActionLabel?: string
    selectedNodeId?: string | null
  }>(),
  {
    description: '',
    size: 'regular',
    showLegend: true,
    showControls: true,
    contentBase: '',
    contentActionLabel: '查看学习内容',
    selectedNodeId: null,
  },
)
const emit = defineEmits<{ select: [nodeId: string] }>()
const selectedId = ref<string | null>(props.selectedNodeId)
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
  return props.graph.nodes.filter((node) => ids.has(node.id)).slice(0, 18)
})

watch(
  () => props.selectedNodeId,
  (value) => {
    selectedId.value = value
  },
)

function selectNode(nodeId: string): void {
  selectedId.value = nodeId
  emit('select', nodeId)
}
</script>

<style scoped>
.phase-view {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: #fbfdfc;
}
.phase-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.phase-header p,
.phase-header h3,
.description {
  margin: 0;
}
.phase-header p {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.phase-header h3 {
  margin-top: 3px;
  font-size: 1.12rem;
}
.description {
  max-width: 76ch;
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.55;
}
.map-frame {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #dae8e2;
  border-radius: var(--radius-md);
  background: radial-gradient(circle at center, #f4faf7 0, #fbfdfc 72%);
}
.map-frame :deep(.canvas-shell) {
  min-height: 460px;
}
.size-large .map-frame :deep(.canvas-shell) {
  min-height: 620px;
}
.size-compass {
  gap: var(--space-2);
  padding: var(--space-3);
}
.size-compass .map-frame :deep(.canvas-shell) {
  min-height: 205px;
}
.phase-compass .map-frame {
  background: radial-gradient(circle at center, #edf6f2 0, #f9fcfa 75%);
}
@media (max-width: 760px) {
  .phase-view {
    padding: var(--space-3);
  }
  .phase-header {
    flex-direction: column;
  }
  .size-large .map-frame :deep(.canvas-shell) {
    min-height: 480px;
  }
}
</style>
