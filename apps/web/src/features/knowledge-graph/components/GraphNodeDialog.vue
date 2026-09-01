<template>
  <div v-if="node" class="backdrop" role="presentation" @click.self="emit('close')">
    <section
      ref="dialog"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="graph-node-title"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <header>
        <div>
          <span :class="['node-kind', node.type]">{{ typeLabel(node.type) }}</span>
          <h2 id="graph-node-title">{{ node.short_label }}</h2>
          <p v-if="node.label !== node.short_label" class="formal-name">{{ node.label }}</p>
        </div>
        <button class="close" type="button" aria-label="关闭节点详情" @click="emit('close')">
          ×
        </button>
      </header>

      <NodeShortNameEditor
        v-if="editableDisplay"
        :node="node"
        :saving="displaySaving"
        :error="displayError"
        @save="forwardDisplaySave"
        @restore="forwardDisplayRestore"
      />

      <p class="summary">{{ summary }}</p>
      <RouterLink
        v-if="hasLearningContent"
        class="content-link"
        :to="`${contentBase}${encodeURIComponent(node.id)}`"
      >
        {{ contentActionLabel }} →
      </RouterLink>

      <dl>
        <div v-for="entry in displayProperties" :key="entry[0]">
          <dt>{{ propertyLabel(entry[0]) }}</dt>
          <dd>{{ entry[1] }}</dd>
        </div>
      </dl>

      <section v-if="neighbors.length" class="relations" aria-label="直接关联节点">
        <h3>
          直接关联 <span>{{ neighbors.length }}</span>
        </h3>
        <div>
          <button
            v-for="neighbor in neighbors"
            :key="neighbor.id"
            type="button"
            @click="emit('select', neighbor.id)"
          >
            <i :class="neighbor.type" aria-hidden="true" />
            {{ neighbor.short_label }}
          </button>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { KnowledgeGraphNode, KnowledgeNodeType } from '../types'
import NodeShortNameEditor from './NodeShortNameEditor.vue'

const props = withDefaults(
  defineProps<{
    node: KnowledgeGraphNode | null
    neighbors: KnowledgeGraphNode[]
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
  close: []
  select: [nodeId: string]
  'save-display': [nodeId: string, shortNameZh: string, expectedRevision: number]
  'restore-display': [nodeId: string, expectedRevision: number]
}>()
const dialog = ref<HTMLElement | null>(null)

const TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  stage: '一级主题',
  scenario: '训练场景',
  phenomenon: '现象',
  knowledge_point: '知识点',
  knowledge_resource: '知识资源',
  strategy: '策略战术',
}
const PROPERTY_LABELS: Record<string, string> = {
  StageID: '主题编号',
  Sequence: '流程顺序',
  StageNameZH: '主题名称',
  StageNameEN: '英文名称',
  DescriptionZH: '中文说明',
  DescriptionEN: '英文原文',
  OBETeachingOutcomeZH: '成果导向目标',
  OBETeachingOutcomeEN: '成果目标原文',
  ScenarioID: '场景编号',
  CourseUnit: '对应课程关卡',
  TrainingMode: '训练模式',
  Background_KeyConstraints: '背景与关键约束',
  StudentRole: '学生角色',
  CounterpartyRole: '谈判对手',
  StudentTask: '学生任务',
  CoreOutcome: '核心学习成果',
  PhenomenonID: '现象编号',
  PhenomenonNameZH: '现象名称',
  PhenomenonNameEN: '英文名称',
  Risk: '风险等级',
  Frequency: '出现频率',
  ResourceNameZH: '知识名称',
  ResourceNameEN: '英文名称',
  DefinitionZH: '中文精讲',
  DefinitionEN: '英文原文',
  KnowledgeID: '知识点编号',
  KnowledgeNameZH: '知识点名称',
  KnowledgeNameEN: '英文名称',
  KnowledgeTypeCode: '知识点类型',
  HomeStageID: '归属主题',
  StrategyNameZH: '策略名称',
  StrategyNameEN: '英文名称',
  PhenomenonDescription: '现象描述',
  TeacherRecognitionPoint: '识别重点',
  BusinessConsequence: '业务后果',
  ResourceID: '知识编号',
  Category: '知识类型',
  Definition_Content: '知识说明',
  StrategyID: '策略编号',
  ApplicableConditions: '适用条件',
  RecommendedActions: '建议行动',
  ExampleExpression: '示例表达',
  DiscouragedActions: '避免做法',
  ExpectedImpact: '预期效果',
}
const HIDDEN_PROPERTIES = new Set([
  'ShortNameZH',
  'PhenomenonNameZH',
  'ResourceNameZH',
  'KnowledgeNameZH',
  'StrategyNameZH',
  'StageNameZH',
  'ScenarioName',
  'ResourceName',
  'StrategyName',
  '标题（必填）',
  '策略名称（必填）',
  '案例名称（必填）',
  '教师希望学生识别什么（必填）',
  '学生会看到/听到什么（必填）',
  'description',
  'MarkdownContent',
])
const SUMMARY_KEYS: Record<KnowledgeNodeType, string[]> = {
  stage: ['DescriptionZH', 'OBETeachingOutcomeZH'],
  scenario: ['Background_KeyConstraints', 'StudentTask'],
  phenomenon: ['DescriptionZH', 'BusinessConsequence', 'PhenomenonDescription'],
  knowledge_resource: ['DefinitionZH', 'Definition_Content', 'Summary'],
  strategy: ['DefinitionZH', 'RecommendedActions', 'ExpectedImpact'],
  knowledge_point: ['DefinitionZH', 'Summary'],
}

const summary = computed(() => {
  if (!props.node) return ''
  for (const key of SUMMARY_KEYS[props.node.type]) {
    const value = props.node.properties[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return '暂无补充说明。'
})
const displayProperties = computed(() => {
  if (!props.node) return []
  return Object.entries(props.node.properties)
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        !HIDDEN_PROPERTIES.has(entry[0]) &&
        entry[1] !== null &&
        ['string', 'number', 'boolean'].includes(typeof entry[1]),
    )
    .slice(0, 12)
})
const hasLearningContent = computed(
  () =>
    Boolean(props.contentBase) &&
    Boolean(
      props.node && ['knowledge_point', 'knowledge_resource', 'strategy'].includes(props.node.type),
    ),
)

function typeLabel(type: KnowledgeNodeType): string {
  return TYPE_LABELS[type]
}
function propertyLabel(key: string): string {
  return PROPERTY_LABELS[key] ?? key
}
function forwardDisplaySave(shortNameZh: string, expectedRevision: number): void {
  if (props.node) emit('save-display', props.node.id, shortNameZh, expectedRevision)
}
function forwardDisplayRestore(expectedRevision: number): void {
  if (props.node) emit('restore-display', props.node.id, expectedRevision)
}

watch(
  () => props.node?.id,
  async (nodeId) => {
    if (!nodeId) return
    await nextTick()
    dialog.value?.focus()
  },
)
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: var(--space-6);
  background: rgb(11 28 21 / 48%);
  backdrop-filter: blur(3px);
}
.dialog {
  width: min(760px, 100%);
  max-height: min(84vh, 820px);
  padding: var(--space-6);
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 40%);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-surface);
  box-shadow: 0 24px 80px rgb(13 38 29 / 28%);
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
h2 {
  margin: var(--space-2) 0 0;
  font-size: clamp(1.45rem, 3vw, 2rem);
}
.formal-name,
.summary {
  color: var(--color-muted);
}
.formal-name {
  margin: 4px 0 0;
  font-size: 0.82rem;
}
.summary {
  margin: var(--space-5) 0 var(--space-3);
  line-height: 1.7;
}
.close {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-muted);
  background: var(--color-surface);
  font-size: 1.5rem;
  cursor: pointer;
}
.node-kind {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 999px;
  color: white;
  background: #688078;
  font-size: 0.7rem;
}
.node-kind.scenario {
  background: #6f5aa8;
}
.node-kind.stage {
  background: #0f4c5c;
}
.node-kind.phenomenon {
  background: #b47a16;
}
.node-kind.knowledge_resource {
  background: #2f78a8;
}
.node-kind.knowledge_point {
  background: #2f78a8;
}
.node-kind.strategy {
  background: #176b4d;
}
.content-link {
  display: inline-flex;
  margin-bottom: var(--space-3);
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 750;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-4) 0 0;
}
dl div {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: #f4f7f5;
}
dt {
  color: var(--color-muted);
  font-size: 0.7rem;
}
dd {
  margin: 5px 0 0;
  font-size: 0.84rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.relations {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
.relations h3 {
  margin: 0 0 var(--space-3);
  font-size: 0.9rem;
}
.relations h3 span {
  color: var(--color-muted);
  font-weight: 500;
}
.relations > div {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.relations button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-ink);
  background: var(--color-surface);
  cursor: pointer;
}
.relations i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #688078;
}
.relations i.scenario {
  background: #6f5aa8;
}
.relations i.stage {
  border-radius: 2px;
  background: #0f4c5c;
}
.relations i.phenomenon {
  background: #d19a38;
}
.relations i.knowledge_resource {
  background: #2f78a8;
}
.relations i.strategy {
  background: #176b4d;
}
@media (max-width: 620px) {
  .backdrop {
    align-items: end;
    padding: var(--space-3);
  }
  .dialog {
    max-height: 90vh;
    padding: var(--space-5);
  }
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
