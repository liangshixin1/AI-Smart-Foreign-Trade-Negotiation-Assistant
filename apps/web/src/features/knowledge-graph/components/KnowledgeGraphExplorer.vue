<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：学生和教师共用的图谱浏览器，提供阶段、节点类型、知识分类与文字搜索筛选。
逻辑：先由 computed 生成筛选子图，再交给画布和文字目录；底图仍传给布局计算。节点详情及教师短名编辑通过弹窗和事件连接。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 GraphNodeDialog、KnowledgeGraphCanvas、KnowledgeGraphOutline。
为什么：筛选只生成展示子图，保留原图可用于稳定布局和恢复筛选；显示短名编辑不改变节点身份。
[/组件导读] -->
<template>
  <section class="explorer">
    <header class="toolbar">
      <div class="view-switch" aria-label="图谱查看模式">
        <button
          v-for="item in viewModes"
          :key="item.value"
          type="button"
          :class="{ active: viewMode === item.value }"
          :aria-pressed="viewMode === item.value"
          @click="viewMode = item.value"
        >
          <strong>{{ item.label }}</strong>
        </button>
      </div>
      <div class="toolbar-actions">
        <span class="visible-count">当前 {{ filteredGraph.node_count }} 个节点</span>
        <label class="search">
          <span>查找节点</span>
          <input v-model.trim="query" type="search" placeholder="输入主题、场景、现象或知识" />
        </label>
        <button
          type="button"
          class="filter-toggle"
          :class="{ active: showFilters }"
          :aria-expanded="showFilters"
          @click="showFilters = !showFilters"
        >
          筛选 <span v-if="hiddenFilterCount">{{ hiddenFilterCount }}</span>
        </button>
      </div>
    </header>

    <Transition name="filters">
      <section v-if="showFilters" class="filter-panel" aria-label="图谱筛选条件">
        <div class="filter-group">
          <strong>节点层级</strong>
          <label v-for="item in availableFilters" :key="item.type" :class="item.type">
            <input v-model="visibleTypes" type="checkbox" :value="item.type" />
            <i aria-hidden="true" />{{ item.label }}
            <span>{{ countFor(item.type) }}</span>
          </label>
        </div>
        <div v-if="knowledgeTypeOptions.length" class="filter-group knowledge-types">
          <strong>知识点类型</strong>
          <label v-for="item in knowledgeTypeOptions" :key="item.type">
            <input v-model="visibleKnowledgeTypes" type="checkbox" :value="item.type" />
            {{ item.label }} <span>{{ item.count }}</span>
          </label>
        </div>
      </section>
    </Transition>

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
        <span>{{ stageOrder(stage) }}</span
        >{{ stage.short_label }}
      </button>
    </nav>

    <div class="content">
      <KnowledgeGraphCanvas
        :graph="filteredGraph"
        :layout-graph="props.graph"
        :visible-types="visibleTypes"
        :mode="viewMode"
        :selected-node-id="selectedId"
        @select="selectedId = $event"
      />
    </div>

    <KnowledgeGraphOutline :graph="filteredGraph" @select="selectedId = $event" />

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
import { computed, ref, watch } from 'vue'

import { stageSequence, type GraphViewMode } from '../graphPresentation'
import type {
  KnowledgeGraphNode,
  KnowledgeGraphView,
  KnowledgeNodeType,
  KnowledgePointType,
} from '../types'
import GraphNodeDialog from './GraphNodeDialog.vue'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas.vue'
import KnowledgeGraphOutline from './KnowledgeGraphOutline.vue'

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
  { type: 'phenomenon', label: '教学现象' },
  { type: 'knowledge_point', label: '知识点' },
  { type: 'knowledge_resource', label: '知识资源' },
  { type: 'strategy', label: '策略战术' },
]
const viewModes: { value: GraphViewMode; label: string }[] = [
  { value: 'teaching', label: '教学地图' },
  { value: 'panorama', label: '关系全景' },
]
const KNOWLEDGE_TYPE_LABELS: Record<KnowledgePointType, string> = {
  Concept: '概念',
  Correspondence: '函电',
  'Cross-cultural': '跨文化',
  Legal: '法律规则',
  Procedure: '业务流程',
  Risk: '风险管理',
  Strategy: '策略战术',
}

const visibleTypes = ref<KnowledgeNodeType[]>(
  filters.filter((item) => item.type !== 'scenario').map((item) => item.type),
)
const visibleKnowledgeTypes = ref<KnowledgePointType[]>(
  Object.keys(KNOWLEDGE_TYPE_LABELS) as KnowledgePointType[],
)
const viewMode = ref<GraphViewMode>('teaching')
const showFilters = ref(false)
const query = ref('')
const selectedId = ref<string | null>(null)
const selectedStageId = ref<string | null>(null)

const availableFilters = computed(() => filters.filter((item) => countFor(item.type) > 0))
const hiddenFilterCount = computed(
  () =>
    availableFilters.value.filter((item) => !visibleTypes.value.includes(item.type)).length +
    knowledgeTypeOptions.value.filter((item) => !visibleKnowledgeTypes.value.includes(item.type))
      .length,
)
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
    .sort((left, right) => stageSequence(left) - stageSequence(right)),
)

const stageNeighborhood = computed(() => {
  if (!selectedStageId.value) return null
  const ids = new Set<string>([selectedStageId.value])
  const firstHop = props.graph.edges.filter(
    (edge) => edge.source === selectedStageId.value || edge.target === selectedStageId.value,
  )
  firstHop.forEach((edge) => {
    ids.add(edge.source)
    ids.add(edge.target)
  })
  const phenomenonIds = new Set(
    props.graph.nodes
      .filter((node) => node.type === 'phenomenon' && ids.has(node.id))
      .map((node) => node.id),
  )
  props.graph.edges.forEach((edge) => {
    if (phenomenonIds.has(edge.target) || phenomenonIds.has(edge.source)) {
      ids.add(edge.source)
      ids.add(edge.target)
    }
  })
  return ids
})

const filteredGraph = computed<KnowledgeGraphView>(() => {
  const keyword = query.value.toLocaleLowerCase('zh-CN')
  const stageScopedNodes = stageNeighborhood.value
    ? props.graph.nodes.filter((node) => stageNeighborhood.value?.has(node.id))
    : props.graph.nodes
  const scopedNodes = stageScopedNodes
    .filter((node) => visibleTypes.value.includes(node.type))
    .filter(
      (node) =>
        node.type !== 'knowledge_point' ||
        !node.knowledge_type ||
        visibleKnowledgeTypes.value.includes(node.knowledge_type),
    )
  if (!keyword) return graphFromNodes(scopedNodes)

  const directMatchedIds = new Set(
    scopedNodes.filter((node) => searchableText(node).includes(keyword)).map((node) => node.id),
  )
  const matchedIds = new Set(directMatchedIds)
  props.graph.edges.forEach((edge) => {
    if (directMatchedIds.has(edge.source) || directMatchedIds.has(edge.target)) {
      matchedIds.add(edge.source)
      matchedIds.add(edge.target)
    }
  })
  return graphFromNodes(scopedNodes.filter((node) => matchedIds.has(node.id)))
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
  return props.graph.nodes.filter((node) => ids.has(node.id)).slice(0, 16)
})

// [导读] 只保留两个端点都在所选节点集合中的边，同时重算数量，避免筛选后产生悬空连线。
function graphFromNodes(nodes: KnowledgeGraphNode[]): KnowledgeGraphView {
  const ids = new Set(nodes.map((node) => node.id))
  const edges = props.graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  return { ...props.graph, nodes, edges, node_count: nodes.length, edge_count: edges.length }
}
// [导读] 合并短名、全名和字符串属性并统一大小写，供搜索匹配。
function searchableText(node: KnowledgeGraphNode): string {
  const properties = Object.values(node.properties)
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
  return [node.short_label, node.label, properties].join(' ').toLocaleLowerCase('zh-CN')
}
// [导读] 统计某种节点类型的数量，供筛选器决定是否显示及标注数量。
function countFor(type: KnowledgeNodeType): number {
  return props.graph.nodes.filter((node) => node.type === type).length
}
// [导读] 把有效阶段顺序格式化为两位数字；无有效顺序时显示占位符。
function stageOrder(node: KnowledgeGraphNode): string {
  const order = stageSequence(node)
  return Number.isFinite(order) && order < 100 ? String(order).padStart(2, '0') : '—'
}
// [导读] 把短名和期望版本随保存事件传给上层；期望版本用于后端识别并发修改。
function forwardDisplaySave(nodeId: string, shortNameZh: string, expectedRevision: number): void {
  emit('save-display', nodeId, shortNameZh, expectedRevision)
}
// [导读] 将恢复默认短名的请求及期望版本传给上层，由上层执行实际保存。
function forwardDisplayRestore(nodeId: string, expectedRevision: number): void {
  emit('restore-display', nodeId, expectedRevision)
}

watch([selectedStageId, query, viewMode], () => {
  selectedId.value = null
})
</script>

<style scoped src="./KnowledgeGraphExplorer.css"></style>
