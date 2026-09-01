<template>
  <section class="explorer">
    <header class="toolbar">
      <div class="legend" aria-label="节点类型筛选">
        <label v-for="item in availableFilters" :key="item.type" :class="item.type">
          <input v-model="visibleTypes" type="checkbox" :value="item.type" />
          <i aria-hidden="true" />{{ item.label }}
          <span>{{ countFor(item.type) }}</span>
        </label>
      </div>
      <label class="search">
        <span>查找节点</span>
        <input v-model.trim="query" type="search" placeholder="输入主题、场景、现象、知识或策略" />
      </label>
    </header>
    <nav v-if="knowledgeTypeOptions.length" class="knowledge-type-nav" aria-label="知识点类型筛选">
      <span>知识点类型</span>
      <label v-for="item in knowledgeTypeOptions" :key="item.type">
        <input v-model="visibleKnowledgeTypes" type="checkbox" :value="item.type" />
        {{ item.label }} <small>{{ item.count }}</small>
      </label>
    </nav>
    <nav v-if="stageOptions.length" class="stage-nav" aria-label="一级主题筛选">
      <button
        :class="{ active: selectedStageId === null }"
        type="button"
        @click="selectedStageId = null"
      >
        全部主题
      </button>
      <button
        v-for="stage in stageOptions"
        :key="stage.id"
        :class="{ active: selectedStageId === stage.id }"
        type="button"
        @click="selectedStageId = stage.id"
      >
        {{ stage.short_label }}
      </button>
    </nav>
    <div class="content">
      <KnowledgeGraphCanvas
        :graph="filteredGraph"
        :visible-types="visibleTypes"
        @select="selectedId = $event"
      />
    </div>
    <footer class="graph-hint">
      <span aria-hidden="true">↗</span>
      选择一个节点，查看它与一级主题、训练场景、教学现象、知识资源和策略战术的联系。
    </footer>
    <GraphNodeDialog
      :node="selectedNode"
      :neighbors="neighbors"
      :content-base="props.contentBase"
      :content-action-label="props.contentActionLabel"
      :editable-display="props.editableDisplay"
      :display-saving="props.displaySaving"
      :display-error="props.displayError"
      @close="selectedId = null"
      @select="selectedId = $event"
      @save-display="forwardDisplaySave"
      @restore-display="forwardDisplayRestore"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { KnowledgeGraphView, KnowledgeNodeType, KnowledgePointType } from '../types'
import GraphNodeDialog from './GraphNodeDialog.vue'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas.vue'

const props = withDefaults(
  defineProps<{
    graph: KnowledgeGraphView
    contentBase?: string
    contentActionLabel?: string
    editableDisplay?: boolean
    displaySaving?: boolean
    displayError?: string | null
  }>(),
  {
    contentBase: '',
    contentActionLabel: '查看学习内容',
    editableDisplay: false,
    displaySaving: false,
    displayError: null,
  },
)
const emit = defineEmits<{
  'save-display': [nodeId: string, shortNameZh: string, expectedRevision: number]
  'restore-display': [nodeId: string, expectedRevision: number]
}>()
const filters: { type: KnowledgeNodeType; label: string }[] = [
  { type: 'stage', label: '一级主题' },
  { type: 'scenario', label: '训练场景' },
  { type: 'phenomenon', label: '现象' },
  { type: 'knowledge_point', label: '知识点' },
  { type: 'knowledge_resource', label: '知识资源' },
  { type: 'strategy', label: '策略战术' },
]
const visibleTypes = ref<KnowledgeNodeType[]>(filters.map((item) => item.type))
const visibleKnowledgeTypes = ref<KnowledgePointType[]>([
  'Concept',
  'Correspondence',
  'Cross-cultural',
  'Legal',
  'Procedure',
  'Risk',
  'Strategy',
])
const query = ref('')
const selectedId = ref<string | null>(null)
const selectedStageId = ref<string | null>(null)
const KNOWLEDGE_TYPE_LABELS: Record<KnowledgePointType, string> = {
  Concept: '概念',
  Correspondence: '函电',
  'Cross-cultural': '跨文化',
  Legal: '法律规则',
  Procedure: '业务流程',
  Risk: '风险管理',
  Strategy: '策略战术',
}
const availableFilters = computed(() => filters.filter((item) => countFor(item.type) > 0))
const knowledgeTypeOptions = computed(() =>
  (Object.entries(KNOWLEDGE_TYPE_LABELS) as [KnowledgePointType, string][])
    .map(([type, label]) => ({
      type,
      label,
      count: props.graph.nodes.filter((node) => node.knowledge_type === type).length,
    }))
    .filter((item) => item.count > 0),
)

const stageOptions = computed(() =>
  props.graph.nodes
    .filter((node) => node.type === 'stage')
    .sort(
      (left, right) =>
        Number(left.properties.Sequence ?? 0) - Number(right.properties.Sequence ?? 0),
    ),
)

const stageNeighborhood = computed(() => {
  if (!selectedStageId.value) return null
  const ids = new Set<string>([selectedStageId.value])
  const firstHop = props.graph.edges.filter((edge) => edge.source === selectedStageId.value)
  firstHop.forEach((edge) => ids.add(edge.target))
  const phenomenonIds = new Set(
    firstHop.filter((edge) => edge.type === 'CONTAINS_PHENOMENON').map((edge) => edge.target),
  )
  props.graph.edges.forEach((edge) => {
    if (phenomenonIds.has(edge.target)) ids.add(edge.source)
    if (phenomenonIds.has(edge.source)) ids.add(edge.target)
  })
  return ids
})

const filteredGraph = computed<KnowledgeGraphView>(() => {
  const keyword = query.value.toLocaleLowerCase('zh-CN')
  const stageScopedNodes = stageNeighborhood.value
    ? props.graph.nodes.filter((node) => stageNeighborhood.value?.has(node.id))
    : props.graph.nodes
  const scopedNodes = stageScopedNodes.filter(
    (node) =>
      node.type !== 'knowledge_point' ||
      !node.knowledge_type ||
      visibleKnowledgeTypes.value.includes(node.knowledge_type),
  )
  if (!keyword) {
    const scopedIds = new Set(scopedNodes.map((node) => node.id))
    const edges = props.graph.edges.filter(
      (edge) => scopedIds.has(edge.source) && scopedIds.has(edge.target),
    )
    return {
      ...props.graph,
      nodes: scopedNodes,
      edges,
      node_count: scopedNodes.length,
      edge_count: edges.length,
    }
  }
  const matched = scopedNodes.filter((node) => {
    const propertyText = Object.values(node.properties)
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
    return [node.short_label, node.label, propertyText]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(keyword)
  })
  const connectedIds = new Set(matched.map((node) => node.id))
  props.graph.edges.forEach((edge) => {
    if (connectedIds.has(edge.source) || connectedIds.has(edge.target)) {
      connectedIds.add(edge.source)
      connectedIds.add(edge.target)
    }
  })
  const scopedIds = new Set(scopedNodes.map((node) => node.id))
  const nodes = scopedNodes.filter((node) => connectedIds.has(node.id))
  const edges = props.graph.edges.filter(
    (edge) =>
      scopedIds.has(edge.source) &&
      scopedIds.has(edge.target) &&
      connectedIds.has(edge.source) &&
      connectedIds.has(edge.target),
  )
  return { ...props.graph, nodes, edges, node_count: nodes.length, edge_count: edges.length }
})
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
  return props.graph.nodes.filter((node) => ids.has(node.id)).slice(0, 12)
})

function countFor(type: KnowledgeNodeType): number {
  return props.graph.nodes.filter((node) => node.type === type).length
}
function forwardDisplaySave(nodeId: string, shortNameZh: string, expectedRevision: number): void {
  emit('save-display', nodeId, shortNameZh, expectedRevision)
}
function forwardDisplayRestore(nodeId: string, expectedRevision: number): void {
  emit('restore-display', nodeId, expectedRevision)
}
</script>

<style scoped>
.explorer {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.legend {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.legend label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.75rem;
  cursor: pointer;
}
.legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #688078;
}
.legend .stage i {
  border-radius: 2px;
  background: #0f4c5c;
}
.legend .phenomenon i {
  background: #d19a38;
}
.legend .scenario i {
  border-radius: 3px;
  background: #6f5aa8;
}
.legend .knowledge_resource i {
  background: #2f78a8;
}
.legend .knowledge_point i {
  background: #2f78a8;
}
.legend .strategy i {
  background: #176b4d;
}
.legend span {
  color: var(--color-muted);
}
.search {
  display: grid;
  gap: 3px;
  color: var(--color-muted);
  font-size: 0.7rem;
}
.search input {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.knowledge-type-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border);
  background: #fbfcfb;
  color: var(--color-muted);
  font-size: 0.75rem;
}
.knowledge-type-nav > span {
  flex: 0 0 auto;
  font-weight: 700;
}
.knowledge-type-nav label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-surface);
}
.knowledge-type-nav small {
  color: var(--color-muted);
}
.content {
  min-width: 0;
}
.stage-nav {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border);
  background: #f7faf8;
}
.stage-nav button {
  flex: 0 0 auto;
  padding: 7px 11px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  background: var(--color-surface);
  cursor: pointer;
}
.stage-nav button.active {
  border-color: #0f4c5c;
  color: #fff;
  background: #0f4c5c;
}
.graph-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  background: var(--color-surface);
  font-size: 0.85rem;
}
.graph-hint span {
  display: inline-grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
@media (max-width: 800px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
