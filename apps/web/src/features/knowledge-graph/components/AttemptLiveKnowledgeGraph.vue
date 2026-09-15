<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：把本次训练的固定支持库与最新一轮评价组合成局部知识图。
逻辑：graphFromScaffold 生成底图，attemptRoundOverlay 生成高亮层，再交给 ContextKnowledgeGraph 展示。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 ContextKnowledgeGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <ContextKnowledgeGraph
    :graph="graph"
    :overlay="overlay"
    eyebrow="对话情境图"
    title="本轮知识关系"
    :description="description"
    size="compact"
    content-base="/student/knowledge/"
  >
    <template #footer>
      <div class="round-state">
        <span v-if="latestEvaluation">第 {{ evaluations.length }} 轮已更新</span>
        <span v-else>等待首轮形成性评价</span>
        <b>{{ currentCount }} 个本轮重点</b>
      </div>
    </template>
  </ContextKnowledgeGraph>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { RoundEvaluation } from '@/features/training/types'

import { attemptRoundOverlay, graphFromScaffold } from '../graphOverlay'
import type { AttemptScaffold } from '../types'
import ContextKnowledgeGraph from './ContextKnowledgeGraph.vue'

const props = defineProps<{ scaffold: AttemptScaffold; evaluations: RoundEvaluation[] }>()
const graph = computed(() => graphFromScaffold(props.scaffold))
const overlay = computed(() => attemptRoundOverlay(props.scaffold, props.evaluations))
const latestEvaluation = computed(() => props.evaluations.at(-1))
const currentCount = computed(
  () => overlay.value.nodes.filter((node) => node.emphasis === 'current_round').length,
)
const description = computed(() =>
  latestEvaluation.value
    ? '高亮节点由最新一轮评价从本关固定候选中选出；浅色节点仍属于完整支持库。'
    : '图中先展示本关固定候选，首轮评价完成后会高亮当前最相关的知识与策略。',
)
</script>

<style scoped>
.round-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: 0.7rem;
}
.round-state b {
  color: #8b5a0a;
}
</style>
