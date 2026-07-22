<template>
  <div class="canvas-shell">
    <div ref="container" class="canvas" role="img" :aria-label="ariaLabel" />
    <div class="controls" aria-label="图谱视图控制">
      <button type="button" title="放大" @click="zoomBy(1.2)">＋</button>
      <button type="button" title="缩小" @click="zoomBy(0.8)">－</button>
      <button type="button" title="适应画布" @click="fit">适应</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { KnowledgeGraphView, KnowledgeNodeType } from '../types'

const props = defineProps<{
  graph: KnowledgeGraphView
  visibleTypes: KnowledgeNodeType[]
}>()
const emit = defineEmits<{ select: [nodeId: string] }>()
const container = ref<HTMLElement | null>(null)
let instance: Core | null = null
let resizeObserver: ResizeObserver | null = null

const ariaLabel = computed(
  () =>
    `知识图谱，共 ${String(props.graph.node_count)} 个节点、${String(props.graph.edge_count)} 条关系`,
)

function elements(): ElementDefinition[] {
  const visible = new Set(
    props.graph.nodes
      .filter((node) => props.visibleTypes.includes(node.type))
      .map((node) => node.id),
  )
  const nodes: ElementDefinition[] = props.graph.nodes
    .filter((node) => visible.has(node.id))
    .map((node) => ({ data: { id: node.id, label: node.label, nodeType: node.type } }))
  const edges: ElementDefinition[] = props.graph.edges
    .filter((edge) => visible.has(edge.source) && visible.has(edge.target))
    .map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: relationshipLabel(edge.type),
      },
    }))
  return [...nodes, ...edges]
}

function relationshipLabel(type: string): string {
  return (
    {
      INVOLVES: '涉及',
      REQUIRES_KNOWLEDGE: '需要知识',
      HANDLED_BY: '可用策略',
      SUPPORTS: '支持',
    }[type] ?? type
  )
}

function render(): void {
  if (!container.value) return
  instance?.destroy()
  instance = cytoscape({
    container: container.value,
    elements: elements(),
    minZoom: 0.25,
    maxZoom: 2.4,
    wheelSensitivity: 0.2,
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          width: 32,
          height: 32,
          'font-size': 10,
          'text-wrap': 'wrap',
          'text-max-width': '92px',
          'text-valign': 'bottom',
          'text-margin-y': 7,
          'background-color': '#688078',
          color: '#17211d',
        },
      },
      {
        selector: 'node[nodeType="phenomenon"]',
        style: { 'background-color': '#d19a38', width: 44, height: 44 },
      },
      { selector: 'node[nodeType="knowledge_resource"]', style: { 'background-color': '#2f78a8' } },
      { selector: 'node[nodeType="strategy"]', style: { 'background-color': '#176b4d' } },
      {
        selector: 'edge',
        style: {
          width: 1.2,
          label: 'data(label)',
          'font-size': 8,
          color: '#6d7b75',
          'line-color': '#c4cec9',
          'target-arrow-color': '#9eaaa4',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.8,
          'text-background-padding': '2px',
        },
      },
      { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#17211d' } },
    ],
    layout: {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 48,
      idealEdgeLength: () => 86,
      nodeRepulsion: () => 5400,
    },
  })
  instance.on('tap', 'node', (event) => {
    emit('select', (event.target as NodeSingular).id())
  })
}

function zoomBy(factor: number): void {
  if (!instance) return
  instance.zoom({
    level: instance.zoom() * factor,
    renderedPosition: { x: instance.width() / 2, y: instance.height() / 2 },
  })
}
function fit(): void {
  instance?.fit(undefined, 48)
}

watch(
  () => [props.graph, props.visibleTypes] as const,
  async () => {
    await nextTick()
    render()
  },
  { deep: true },
)

onMounted(() => {
  render()
  if (container.value) {
    resizeObserver = new ResizeObserver(() => instance?.resize())
    resizeObserver.observe(container.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  instance?.destroy()
})
</script>

<style scoped>
.canvas-shell {
  position: relative;
  min-height: 620px;
  overflow: hidden;
  background: #f8faf9;
}
.canvas {
  position: absolute;
  inset: 0;
}
.controls {
  position: absolute;
  z-index: 1;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-soft);
}
.controls button {
  min-width: 38px;
  height: 38px;
  padding: 0 var(--space-2);
  border: 0;
  border-right: 1px solid var(--color-border);
  color: var(--color-ink);
  background: var(--color-surface);
  cursor: pointer;
}
.controls button:last-child {
  border-right: 0;
}
@media (max-width: 760px) {
  .canvas-shell {
    min-height: 520px;
  }
}
</style>
