<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：将图谱转换成可逐级展开的文字目录，辅助阅读阶段、现象与知识关系。
逻辑：先计算节点所属阶段，再按现象的直接邻居收集知识和策略，最后按类型与中文短名排序；选择时发送节点编号。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <details class="outline">
    <summary>使用文字目录浏览图谱</summary>
    <div class="stage-list">
      <details v-for="group in groups" :key="group.stage.id">
        <summary>
          <span>{{ String(stageSequence(group.stage)).padStart(2, '0') }}</span>
          {{ group.stage.short_label }}
          <small>{{ group.phenomena.length }} 个现象</small>
        </summary>
        <div class="stage-content">
          <button
            class="open-node stage-node"
            type="button"
            @click="emit('select', group.stage.id)"
          >
            <i class="stage" />查看主题说明
          </button>
          <details
            v-for="phenomenon in group.phenomena"
            :key="phenomenon.node.id"
            class="phenomenon-group"
          >
            <summary>
              <i class="phenomenon" />{{ phenomenon.node.short_label }}
              <small>{{ phenomenon.knowledgeCount }} 个知识点</small>
            </summary>
            <div class="phenomenon-content">
              <button
                class="open-node phenomenon-node"
                type="button"
                @click="emit('select', phenomenon.node.id)"
              >
                查看现象说明
              </button>
              <section v-for="typeGroup in phenomenon.types" :key="typeGroup.type">
                <h4>
                  {{ typeGroup.label }} <span>{{ typeGroup.nodes.length }}</span>
                </h4>
                <div class="node-list">
                  <button
                    v-for="node in typeGroup.nodes"
                    :key="node.id"
                    type="button"
                    @click="emit('select', node.id)"
                  >
                    <i :class="knowledgeMarker(node)" />{{ node.short_label }}
                  </button>
                </div>
              </section>
              <p v-if="phenomenon.knowledgeCount === 0" class="empty">暂无关联知识点</p>
            </div>
          </details>
        </div>
      </details>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { nodeStageAssignments, stageSequence } from '../graphPresentation'
import type { KnowledgeGraphNode, KnowledgeGraphView } from '../types'

const props = defineProps<{ graph: KnowledgeGraphView }>()
const emit = defineEmits<{ select: [nodeId: string] }>()

const TYPE_LABELS: Record<string, string> = {
  Concept: '概念',
  Correspondence: '函电',
  'Cross-cultural': '跨文化',
  Legal: '法律规则',
  Procedure: '业务流程',
  Risk: '风险管理',
  Strategy: '策略战术',
  Resource: '知识资源',
}
const TYPE_ORDER = Object.keys(TYPE_LABELS)

const groups = computed(() => {
  const assignments = nodeStageAssignments(props.graph)
  const byId = new Map(props.graph.nodes.map((node) => [node.id, node]))
  return props.graph.nodes
    .filter((node) => node.type === 'stage')
    .sort((left, right) => stageSequence(left) - stageSequence(right))
    .map((stage) => ({
      stage,
      phenomena: props.graph.nodes
        .filter((node) => node.type === 'phenomenon' && assignments.get(node.id) === stage.id)
        .sort(compareLabels)
        .map((node) => phenomenonGroup(node, byId)),
    }))
})

// [导读] 从现象的直接连线收集知识邻居，再分类型排序，构成目录中的一个现象分组。
function phenomenonGroup(phenomenon: KnowledgeGraphNode, byId: Map<string, KnowledgeGraphNode>) {
  const relatedIds = new Set<string>()
  props.graph.edges.forEach((edge) => {
    if (edge.source === phenomenon.id) relatedIds.add(edge.target)
    if (edge.target === phenomenon.id) relatedIds.add(edge.source)
  })
  const knowledgeNodes = [...relatedIds]
    .map((id) => byId.get(id))
    .filter((node): node is KnowledgeGraphNode => node !== undefined && isKnowledgeNode(node))
  const types = [...new Set(knowledgeNodes.map(knowledgeType))]
    .sort((left, right) => typeOrder(left) - typeOrder(right))
    .map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      nodes: knowledgeNodes.filter((node) => knowledgeType(node) === type).sort(compareLabels),
    }))
  return { node: phenomenon, types, knowledgeCount: knowledgeNodes.length }
}

// [导读] 判断节点是否属于知识点、旧版知识资源或策略，供目录过滤。
function isKnowledgeNode(node: KnowledgeGraphNode): boolean {
  return ['knowledge_point', 'knowledge_resource', 'strategy'].includes(node.type)
}
// [导读] 优先使用节点的知识分类；旧数据依次退回策略类型、属性分类或通用资源。
function knowledgeType(node: KnowledgeGraphNode): string {
  if (node.knowledge_type) return node.knowledge_type
  if (node.type === 'strategy') return 'Strategy'
  const propertyType = node.properties.KnowledgeTypeCode ?? node.properties.Type
  return typeof propertyType === 'string' && propertyType ? propertyType : 'Resource'
}
// [导读] 将分类转成固定排序位置；未知分类排在已知分类之后。
function typeOrder(type: string): number {
  const index = TYPE_ORDER.indexOf(type)
  return index === -1 ? TYPE_ORDER.length : index
}
// [导读] 按中文短名比较两个节点，用于目录内的稳定阅读顺序。
function compareLabels(left: KnowledgeGraphNode, right: KnowledgeGraphNode): number {
  return left.short_label.localeCompare(right.short_label, 'zh-CN')
}
// [导读] 把分类转换为知识或策略的样式标记，不改变节点本身的类型。
function knowledgeMarker(node: KnowledgeGraphNode): string {
  return knowledgeType(node) === 'Strategy' ? 'strategy' : 'knowledge'
}
</script>

<style scoped>
.outline {
  border-top: 1px solid var(--color-border);
  color: var(--color-muted);
  background: #fbfcfb;
}
.outline > summary {
  padding: var(--space-3) var(--space-4);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 750;
  cursor: pointer;
}
.stage-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4);
}
.stage-list > details {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.stage-list summary {
  padding: 10px 12px;
  color: var(--color-ink);
  font-size: 0.78rem;
  font-weight: 750;
  cursor: pointer;
}
.stage-list > details > summary > span {
  margin-right: 5px;
  color: var(--color-primary);
  font-size: 0.65rem;
}
.stage-list summary small {
  display: block;
  margin: 3px 0 0 19px;
  color: var(--color-muted);
  font-weight: 500;
}
.stage-content {
  display: grid;
  gap: 5px;
  max-height: 390px;
  padding: 0 8px 8px;
  overflow: auto;
}
.open-node,
.node-list button {
  width: 100%;
  border: 0;
  border-radius: 6px;
  color: var(--color-muted);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.open-node:hover,
.open-node:focus-visible,
.node-list button:hover,
.node-list button:focus-visible {
  color: var(--color-ink);
  outline: none;
  background: var(--color-primary-soft);
}
.open-node {
  padding: 7px 8px;
}
.stage-node {
  color: var(--color-primary);
  font-weight: 700;
}
.phenomenon-group {
  border-top: 1px solid #edf1ef;
}
.phenomenon-group > summary {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 7px;
  padding: 9px 8px;
}
.phenomenon-group > summary small {
  grid-column: 2;
  margin: 2px 0 0;
}
.phenomenon-content {
  padding: 0 5px 8px 17px;
}
.phenomenon-node {
  margin-bottom: 5px;
  font-size: 0.72rem;
}
.phenomenon-content section + section {
  margin-top: 8px;
}
h4 {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 5px 0;
  color: var(--color-ink);
  font-size: 0.68rem;
}
h4 span {
  color: var(--color-muted);
  font-weight: 500;
}
.node-list {
  display: grid;
  gap: 2px;
}
.node-list button {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 6px 8px;
}
i {
  display: inline-block;
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6f8796;
}
i.stage {
  border-radius: 2px;
  background: #0f5961;
}
i.phenomenon {
  background: #d8a64d;
}
i.strategy {
  background: #176b4d;
}
.empty {
  margin: 5px 8px;
  font-size: 0.7rem;
}
@media (max-width: 820px) {
  .stage-list {
    grid-template-columns: 1fr;
  }
}
</style>
