<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：从多轮评价推荐中整理最多六项后续学习入口。
逻辑：按 node_id 去重累计出现次数，再按频次、最近轮次和置信度排序；跳转携带训练编号、评价来源和返回地址。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useRoute。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section v-if="items.length" class="learning-path" aria-labelledby="learning-path-title">
    <header>
      <div>
        <p>从评价回到学习</p>
        <h2 id="learning-path-title">把下一步建议变成可执行的知识补给</h2>
      </div>
      <span>{{ items.length }} 项</span>
    </header>
    <ul>
      <li v-for="item in items" :key="item.node_id">
        <div>
          <span :class="item.node_type">
            {{ item.node_type === 'strategy' ? '策略' : '知识' }}
          </span>
          <small v-if="item.occurrences > 1">连续 {{ item.occurrences }} 轮建议</small>
        </div>
        <strong>{{ item.title }}</strong>
        <p>{{ item.reason }}</p>
        <RouterLink :to="learningRoute(item.node_id)">立即学习 →</RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import type { GraphRecommendation, RoundEvaluation } from '@/features/training/types'

const route = useRoute()
const props = defineProps<{ evaluations: RoundEvaluation[] }>()

interface LearningPathItem extends GraphRecommendation {
  occurrences: number
  roundIndex: number
}

const items = computed(() => {
  const selected = new Map<string, LearningPathItem>()
  props.evaluations.forEach((evaluation, roundIndex) => {
    evaluation.recommendations.forEach((recommendation) => {
      const previous = selected.get(recommendation.node_id)
      selected.set(recommendation.node_id, {
        ...recommendation,
        occurrences: (previous?.occurrences ?? 0) + 1,
        roundIndex,
      })
    })
  })
  return [...selected.values()]
    .sort(
      (left, right) =>
        right.occurrences - left.occurrences ||
        right.roundIndex - left.roundIndex ||
        right.confidence - left.confidence,
    )
    .slice(0, 6)
})

// [导读] 构造学习页地址，同时携带来源、返回位置及当前上下文；这样学习后可以回到原来的训练或评价。
function learningRoute(nodeId: string) {
  return {
    path: `/student/knowledge/${encodeURIComponent(nodeId)}`,
    query: {
      returnTo: route.fullPath,
      source: 'evaluation',
      attemptId: String(route.params.attemptId),
    },
  }
}
</script>

<style scoped>
.learning-path {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
header,
li > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
header p,
header h2,
li p {
  margin: 0;
}
header p {
  color: var(--color-primary);
  font-size: 0.74rem;
  font-weight: 800;
}
header h2 {
  margin-top: 2px;
  font-size: 1.1rem;
}
header > span {
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-weight: 800;
}
ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
li {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-left: 3px solid #3380a6;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-canvas);
}
li > div span {
  color: #17628a;
  font-size: 0.72rem;
  font-weight: 800;
}
li > div span.strategy {
  color: var(--color-primary);
}
li small,
li p {
  color: var(--color-muted);
  font-size: 0.78rem;
}
li a {
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 750;
}
@media (max-width: 760px) {
  ul {
    grid-template-columns: 1fr;
  }
}
</style>
