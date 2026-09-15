<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：在学生首页展示知识学习概况及值得优先学习的条目。
逻辑：从学情数据中筛出需关注或被推荐的知识，最多展示四项；组合个人知识图，并通过带 profile 来源的链接进入学习。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 StudentKnowledgeProfileGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section class="progress" aria-labelledby="student-knowledge-progress-title">
    <header>
      <div>
        <p>知识学习进度</p>
        <h2 id="student-knowledge-progress-title">训练中的知识与策略</h2>
      </div>
      <RouterLink to="/student/knowledge-graph">打开知识图谱 →</RouterLink>
    </header>
    <p v-if="loading" class="state">正在整理你的训练证据…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="$emit('retry')">重试</button>
    </p>
    <template v-else-if="insights">
      <div class="metrics">
        <article>
          <strong>{{ insights.evidence_rounds }}</strong
          ><span>证据轮次</span>
        </article>
        <article>
          <strong>{{ insights.learning_completions }}</strong
          ><span>完成学习</span>
        </article>
        <article>
          <strong>{{ insights.learning_views }}</strong
          ><span>知识回访</span>
        </article>
      </div>
      <div v-if="focusItems.length" class="focus-list">
        <p>优先巩固</p>
        <RouterLink
          v-for="item in focusItems"
          :key="item.node_id"
          :to="learningRoute(item.node_id)"
        >
          <span>{{ item.knowledge_type ? typeLabel(item.knowledge_type) : '知识' }}</span>
          <strong>{{ item.label }}</strong>
          <small>{{ item.average_score ?? '-' }} 分 · {{ item.evidence_count }} 轮证据</small>
        </RouterLink>
      </div>
      <p v-else class="state">完成几轮谈判后，这里会给出基于证据的巩固路径。</p>
      <StudentKnowledgeProfileGraph :insights="insights" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { KnowledgeInsights } from '../types'
import StudentKnowledgeProfileGraph from './StudentKnowledgeProfileGraph.vue'

const props = defineProps<{
  insights: KnowledgeInsights | null
  loading: boolean
  error: string | null
}>()
defineEmits<{ retry: [] }>()

const focusItems = computed(() =>
  (props.insights?.knowledge_insights ?? [])
    .filter((item) => item.needs_attention || item.recommendation_count > 0)
    .slice(0, 4),
)

// [导读] 构造学习页地址，同时携带来源、返回位置及当前上下文；这样学习后可以回到原来的训练或评价。
function learningRoute(nodeId: string) {
  return {
    path: `/student/knowledge/${encodeURIComponent(nodeId)}`,
    query: { returnTo: '/student', source: 'profile' },
  }
}

// [导读] 将知识分类转换为中文标签，未知分类保留原值。
function typeLabel(type: string): string {
  return (
    {
      Concept: '概念',
      Correspondence: '函电',
      'Cross-cultural': '跨文化',
      Legal: '法律规则',
      Procedure: '业务流程',
      Risk: '风险管理',
      Strategy: '策略战术',
    }[type] ?? type
  )
}
</script>

<style scoped>
.progress {
  margin: var(--space-6) 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, #f8fcfa, var(--color-surface));
}
header,
.metrics,
.focus-list a {
  display: flex;
  align-items: center;
}
header {
  justify-content: space-between;
  gap: var(--space-4);
}
header p,
header h2,
.focus-list > p {
  margin: 0;
}
header p,
.focus-list > p {
  color: var(--color-primary);
  font-size: 0.74rem;
  font-weight: 800;
}
header h2 {
  margin-top: 2px;
  font-size: 1.15rem;
}
header a,
.focus-list a {
  color: var(--color-primary);
  font-weight: 750;
  text-decoration: none;
}
.metrics {
  gap: 1px;
  margin-top: var(--space-4);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-border);
}
.metrics article {
  display: grid;
  flex: 1;
  gap: 2px;
  padding: var(--space-3);
  background: var(--color-surface);
}
.metrics strong {
  font-size: 1.35rem;
}
.metrics span,
.state,
.focus-list small {
  color: var(--color-muted);
  font-size: 0.78rem;
}
.focus-list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.focus-list a {
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.focus-list a span {
  min-width: 4.5rem;
  color: #17628a;
  font-size: 0.72rem;
}
.focus-list a strong {
  flex: 1;
}
.state button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.error {
  color: var(--color-danger);
}
@media (max-width: 680px) {
  .focus-list a {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
