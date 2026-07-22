<template>
  <section class="explorer">
    <header class="toolbar">
      <div class="legend" aria-label="节点类型筛选">
        <label v-for="item in filters" :key="item.type" :class="item.type">
          <input v-model="visibleTypes" type="checkbox" :value="item.type" />
          <i aria-hidden="true" />{{ item.label }}
          <span>{{ countFor(item.type) }}</span>
        </label>
      </div>
      <label class="search">
        <span>查找节点</span>
        <input v-model.trim="query" type="search" placeholder="输入现象、知识或策略" />
      </label>
    </header>
    <div class="content">
      <KnowledgeGraphCanvas
        :graph="filteredGraph"
        :visible-types="visibleTypes"
        @select="selectedId = $event"
      />
      <aside aria-live="polite">
        <template v-if="selectedNode">
          <span :class="['node-kind', selectedNode.type]">{{ typeLabel(selectedNode.type) }}</span>
          <h2>{{ selectedNode.label }}</h2>
          <p>{{ textProperty(selectedNode, 'description', '暂无补充说明。') }}</p>
          <RouterLink
            v-if="props.contentBase && selectedNode.type !== 'phenomenon'"
            class="content-link"
            :to="`${props.contentBase}${encodeURIComponent(selectedNode.id)}`"
          >
            {{ props.contentActionLabel }} →
          </RouterLink>
          <dl>
            <div v-for="entry in displayProperties" :key="entry[0]">
              <dt>{{ entry[0] }}</dt>
              <dd>{{ entry[1] }}</dd>
            </div>
          </dl>
          <h3>直接关联 {{ neighbors.length }}</h3>
          <button
            v-for="node in neighbors"
            :key="node.id"
            type="button"
            @click="selectedId = node.id"
          >
            {{ node.label }}
          </button>
        </template>
        <template v-else>
          <p class="empty">选择一个节点，查看它与教学现象、知识资源和策略战术的联系。</p>
        </template>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { KnowledgeGraphNode, KnowledgeGraphView, KnowledgeNodeType } from '../types'
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas.vue'

const props = withDefaults(
  defineProps<{
    graph: KnowledgeGraphView
    contentBase?: string
    contentActionLabel?: string
  }>(),
  { contentBase: '', contentActionLabel: '查看学习内容' },
)
const filters: { type: KnowledgeNodeType; label: string }[] = [
  { type: 'phenomenon', label: '现象' },
  { type: 'knowledge_resource', label: '知识资源' },
  { type: 'strategy', label: '策略战术' },
]
const visibleTypes = ref<KnowledgeNodeType[]>(filters.map((item) => item.type))
const query = ref('')
const selectedId = ref<string | null>(null)

const filteredGraph = computed<KnowledgeGraphView>(() => {
  const keyword = query.value.toLocaleLowerCase('zh-CN')
  if (!keyword) return props.graph
  const matched = props.graph.nodes.filter((node) =>
    node.label.toLocaleLowerCase('zh-CN').includes(keyword),
  )
  const connectedIds = new Set(matched.map((node) => node.id))
  props.graph.edges.forEach((edge) => {
    if (connectedIds.has(edge.source) || connectedIds.has(edge.target)) {
      connectedIds.add(edge.source)
      connectedIds.add(edge.target)
    }
  })
  const nodes = props.graph.nodes.filter((node) => connectedIds.has(node.id))
  const edges = props.graph.edges.filter(
    (edge) => connectedIds.has(edge.source) && connectedIds.has(edge.target),
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
const displayProperties = computed(() =>
  selectedNode.value
    ? Object.entries(selectedNode.value.properties)
        .filter(
          (entry): entry is [string, string | number | boolean] =>
            entry[1] !== null && entry[0] !== 'description',
        )
        .slice(0, 8)
    : [],
)

function countFor(type: KnowledgeNodeType): number {
  return props.graph.nodes.filter((node) => node.type === type).length
}
function typeLabel(type: KnowledgeNodeType): string {
  return filters.find((item) => item.type === type)?.label ?? type
}
function textProperty(node: KnowledgeGraphNode, key: string, fallback: string): string {
  const value = node.properties[key]
  return typeof value === 'string' ? value : fallback
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
.legend .phenomenon i {
  background: #d19a38;
}
.legend .knowledge_resource i {
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
.content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
}
aside {
  padding: var(--space-5);
  overflow: auto;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
}
aside h2 {
  margin: var(--space-2) 0;
  font-size: 1.2rem;
}
aside h3 {
  margin-top: var(--space-6);
  font-size: 0.85rem;
}
aside p,
.empty {
  color: var(--color-muted);
  font-size: 0.82rem;
}
.node-kind {
  padding: 3px 7px;
  border-radius: 999px;
  color: white;
  background: #688078;
  font-size: 0.68rem;
}
.node-kind.phenomenon {
  background: #b47a16;
}
.node-kind.knowledge_resource {
  background: #2f78a8;
}
.node-kind.strategy {
  background: #176b4d;
}
dl {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-5);
}
dl div {
  display: grid;
  gap: 2px;
}
dt {
  color: var(--color-muted);
  font-size: 0.68rem;
}
dd {
  margin: 0;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}
aside button {
  width: 100%;
  padding: var(--space-2);
  border: 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-primary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.content-link {
  display: inline-flex;
  margin: var(--space-2) 0 var(--space-3);
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 750;
}
@media (max-width: 800px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .content {
    grid-template-columns: 1fr;
  }
  aside {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }
}
</style>
