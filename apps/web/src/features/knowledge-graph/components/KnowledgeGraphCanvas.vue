<template>
  <div class="canvas-shell" :class="`mode-${mode}`">
    <div ref="container" class="canvas" role="img" :aria-label="ariaLabel" />
    <div v-if="showControls" class="controls" aria-label="图谱视图控制">
      <button type="button" title="放大" aria-label="放大图谱" @click="zoomBy(1.2)">＋</button>
      <button type="button" title="缩小" aria-label="缩小图谱" @click="zoomBy(0.8)">－</button>
      <button type="button" title="适应画布" @click="fit">适应</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import cytoscape from 'cytoscape'
import type { Core, NodeSingular } from 'cytoscape'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { buildGraphElements } from '../graphElements'
import { contextPositions } from '../contextLayout'
import {
  nearestInteractiveNode,
  progressiveFocusNodeIds,
  shouldActivateImmediately,
  withinFocusCorridor,
} from '../graphInteraction'
import { knowledgeGraphStylesheet } from '../graphStyles'
import { panoramaLayout } from '../panoramaLayout'
import type { GraphViewMode } from '../graphPresentation'
import type { GraphVisualOverlay } from '../graphOverlay'
import type { KnowledgeGraphView, KnowledgeNodeType } from '../types'

const props = withDefaults(
  defineProps<{
    graph: KnowledgeGraphView
    layoutGraph?: KnowledgeGraphView
    visibleTypes: KnowledgeNodeType[]
    mode?: GraphViewMode
    selectedNodeId?: string | null
    overlay?: GraphVisualOverlay | null
    showControls?: boolean
  }>(),
  {
    layoutGraph: (rawProps: { graph: KnowledgeGraphView }) => rawProps.graph,
    mode: 'teaching',
    selectedNodeId: null,
    overlay: null,
    showControls: true,
  },
)
const emit = defineEmits<{ select: [nodeId: string] }>()
const container = ref<HTMLElement | null>(null)
let instance: Core | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let hasFittedOnFirstReveal = false
let reducedMotion = false
let semanticBaseZoom = 1
let proximityNodeId: string | null = null
let pendingNodeId: string | null = null
let pendingFocusTimer: number | null = null
let highlightTimer: number | null = null
let previousRevision = ''
let previousCurrentIds = new Set<string>()
const TAKEOVER_DELAY_MS = 180

const ariaLabel = computed(
  () =>
    `${props.mode === 'teaching' ? '九阶段教学地图' : '知识关系全景'}，共 ${String(props.graph.node_count)} 个节点、${String(props.graph.edge_count)} 条关系。可缩放并选择节点查看详情。`,
)

function createInstance(): void {
  if (!container.value) return
  instance = cytoscape({
    container: container.value,
    elements: [],
    minZoom: 0.22,
    maxZoom: 2.6,
    style: knowledgeGraphStylesheet,
  })
  const core = instance
  core.on('tap', 'node', (event) => {
    emit('select', (event.target as NodeSingular).id())
  })
  core.on('mouseover', 'node', (event) => {
    const node = event.target as NodeSingular
    if (container.value) container.value.style.cursor = 'pointer'
    node.addClass('is-hovered')
    requestProximityFocus(node.id())
  })
  core.on('mouseout', 'node', (event) => {
    const node = event.target as NodeSingular
    node.removeClass('is-hovered')
    if (pendingNodeId === node.id()) cancelPendingFocus()
  })
  core.on('mousemove', (event) => {
    if (event.target !== core) return
    const interactionGraph = props.layoutGraph
    const permittedIds = proximityNodeId
      ? progressiveFocusNodeIds(interactionGraph, proximityNodeId)
      : undefined
    const nearbyPermitted = nearestInteractiveNode(
      core,
      props.mode,
      event.renderedPosition,
      proximityNodeId ? 34 : 18,
      permittedIds,
    )
    if (nearbyPermitted) {
      requestProximityFocus(nearbyPermitted.id())
      return
    }
    if (
      proximityNodeId &&
      props.mode === 'panorama' &&
      withinFocusCorridor(core, interactionGraph, proximityNodeId, event.renderedPosition)
    ) {
      return
    }
    const nearby = nearestInteractiveNode(core, props.mode, event.renderedPosition, 18)
    if (nearby) {
      requestProximityFocus(nearby.id())
      return
    }
    cancelPendingFocus()
    proximityNodeId = null
    if (container.value) container.value.style.cursor = 'default'
    applyFocus(props.selectedNodeId)
  })
  core.on('tap', (event) => {
    if (event.target !== core) return
    const nearby = nearestInteractiveNode(core, props.mode, event.renderedPosition, 22)
    if (nearby) emit('select', nearby.id())
  })
  core.on('zoom', updateSemanticZoom)
}

function clearProximityFocus(): void {
  cancelPendingFocus()
  proximityNodeId = null
  if (container.value) container.value.style.cursor = 'default'
  applyFocus(props.selectedNodeId)
}

function requestProximityFocus(nodeId: string): void {
  if (nodeId === proximityNodeId) {
    cancelPendingFocus()
    return
  }
  const interactionGraph = props.layoutGraph
  if (
    props.mode !== 'panorama' ||
    shouldActivateImmediately(interactionGraph, proximityNodeId, nodeId)
  ) {
    activateProximityFocus(nodeId)
    return
  }
  schedulePendingFocus(nodeId)
}

function activateProximityFocus(nodeId: string): void {
  cancelPendingFocus()
  proximityNodeId = nodeId
  if (container.value) container.value.style.cursor = 'pointer'
  applyFocus(nodeId)
}

function schedulePendingFocus(nodeId: string): void {
  if (pendingNodeId === nodeId && pendingFocusTimer !== null) return
  cancelPendingFocus()
  const ownerWindow = container.value?.ownerDocument.defaultView
  if (!ownerWindow) {
    activateProximityFocus(nodeId)
    return
  }
  pendingNodeId = nodeId
  pendingFocusTimer = ownerWindow.setTimeout(() => {
    if (pendingNodeId === nodeId) activateProximityFocus(nodeId)
  }, TAKEOVER_DELAY_MS)
}

function cancelPendingFocus(): void {
  const ownerWindow = container.value?.ownerDocument.defaultView
  if (pendingFocusTimer !== null && ownerWindow) ownerWindow.clearTimeout(pendingFocusTimer)
  pendingFocusTimer = null
  pendingNodeId = null
}

function syncGraph(): void {
  if (!instance) createInstance()
  if (!instance) return
  cancelPendingFocus()
  proximityNodeId = null
  const layoutGraph = props.layoutGraph
  const positions =
    props.mode === 'context' ? contextPositions(props.graph) : panoramaLayout(layoutGraph).positions
  const nextCurrentIds = new Set(
    props.overlay?.nodes
      .filter((item) => item.emphasis === 'current_round')
      .map((item) => item.node_id) ?? [],
  )
  const newlyCurrentIds = new Set(
    [...nextCurrentIds].filter((nodeId) => !previousCurrentIds.has(nodeId)),
  )
  instance.batch(() => {
    instance?.elements().remove()
    instance?.add(
      buildGraphElements(
        props.graph,
        props.visibleTypes,
        props.mode,
        positions,
        layoutGraph,
        props.overlay,
      ),
    )
  })
  runLayout()
  applyFocus(props.selectedNodeId)
  pulseNewNodes(newlyCurrentIds)
  previousCurrentIds = nextCurrentIds
  previousRevision = props.overlay?.revision ?? ''
}

function runLayout(): void {
  if (!instance) return
  if (props.mode === 'teaching') {
    instance.one('layoutstop', captureSemanticBaseZoom)
    instance
      .layout({
        name: 'preset',
        fit: true,
        padding: 72,
        animate: !reducedMotion,
        animationDuration: 320,
      })
      .run()
  } else {
    instance.one('layoutstop', captureSemanticBaseZoom)
    instance
      .layout({
        name: 'preset',
        animate: !reducedMotion,
        animationDuration: 360,
        fit: true,
        padding: props.mode === 'context' ? 34 : 76,
      })
      .run()
  }
  nextFrame(updateSemanticZoom)
}

function captureSemanticBaseZoom(): void {
  if (!instance) return
  semanticBaseZoom = instance.zoom()
  updateSemanticZoom()
}

function updateSemanticZoom(): void {
  if (!instance) return
  const zoom = instance.zoom()
  const semanticNodes = instance.nodes().filter((node) => {
    const semanticTypes = ['knowledge_point', 'knowledge_resource', 'strategy']
    if (props.mode === 'panorama') semanticTypes.push('phenomenon')
    return semanticTypes.includes(String(node.data('nodeType')))
  })
  semanticNodes.removeClass('show-label')
  const threshold = props.mode === 'context' ? semanticBaseZoom * 0.72 : semanticBaseZoom * 1.3
  if (zoom >= threshold) semanticNodes.addClass('show-label')
}

function pulseNewNodes(nodeIds: Set<string>): void {
  if (!instance || reducedMotion || !nodeIds.size || previousRevision === '') return
  if (highlightTimer !== null) {
    container.value?.ownerDocument.defaultView?.clearTimeout(highlightTimer)
  }
  nodeIds.forEach((nodeId) => instance?.getElementById(nodeId).addClass('is-newly-emphasized'))
  highlightTimer =
    container.value?.ownerDocument.defaultView?.setTimeout(() => {
      nodeIds.forEach((nodeId) =>
        instance?.getElementById(nodeId).removeClass('is-newly-emphasized'),
      )
      highlightTimer = null
    }, 520) ?? null
}

function applyFocus(nodeId: string | null | undefined): void {
  if (!instance) return
  const all = instance.elements()
  all.removeClass('is-dimmed is-related is-focused')
  if (!nodeId) return
  const node = instance.getElementById(nodeId)
  if (!node.length) return
  const focusedIds =
    props.mode === 'panorama'
      ? progressiveFocusNodeIds(props.graph, node.id())
      : new Set([node.id()])
  if (props.mode !== 'panorama') {
    node
      .closedNeighborhood()
      .nodes()
      .forEach((item) => {
        focusedIds.add(item.id())
      })
  }
  all.addClass('is-dimmed')
  instance.nodes().forEach((item) => {
    if (!focusedIds.has(item.id())) return
    item.removeClass('is-dimmed').addClass('is-related')
  })
  instance.edges().forEach((edge) => {
    if (
      focusedIds.has(edge.source().id()) &&
      focusedIds.has(edge.target().id()) &&
      edge.data('edgeType') !== 'STAGE_FLOW'
    ) {
      edge.removeClass('is-dimmed').addClass('is-related')
    }
  })
  node.removeClass('is-related')
  node.addClass('is-focused')
}

function zoomBy(factor: number): void {
  if (!instance) return
  instance.zoom({
    level: instance.zoom() * factor,
    renderedPosition: { x: instance.width() / 2, y: instance.height() / 2 },
  })
}
function fit(): void {
  instance?.fit(undefined, 64)
  captureSemanticBaseZoom()
}

function nextFrame(callback: () => void): void {
  container.value?.ownerDocument.defaultView?.requestAnimationFrame(callback)
}

watch(
  () => [props.graph, props.layoutGraph, props.visibleTypes, props.mode, props.overlay] as const,
  async () => {
    await nextTick()
    syncGraph()
  },
  { deep: true },
)
watch(() => props.selectedNodeId, applyFocus)

onMounted(() => {
  const ownerWindow = container.value?.ownerDocument.defaultView
  reducedMotion =
    typeof ownerWindow?.matchMedia === 'function'
      ? ownerWindow.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  createInstance()
  syncGraph()
  if (container.value) {
    container.value.addEventListener('mouseleave', clearProximityFocus)
    const Observer = ownerWindow?.ResizeObserver
    if (Observer) {
      resizeObserver = new Observer(() => instance?.resize())
      resizeObserver.observe(container.value)
    }
    const VisibilityObserver = ownerWindow?.IntersectionObserver
    if (VisibilityObserver) {
      intersectionObserver = new VisibilityObserver((entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || hasFittedOnFirstReveal) return
        hasFittedOnFirstReveal = true
        nextFrame(() => {
          instance?.resize()
          fit()
        })
      })
      intersectionObserver.observe(container.value)
    }
  }
})
onBeforeUnmount(() => {
  cancelPendingFocus()
  if (highlightTimer !== null) {
    container.value?.ownerDocument.defaultView?.clearTimeout(highlightTimer)
  }
  container.value?.removeEventListener('mouseleave', clearProximityFocus)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  instance?.destroy()
})
</script>

<style scoped src="./KnowledgeGraphCanvas.css"></style>
