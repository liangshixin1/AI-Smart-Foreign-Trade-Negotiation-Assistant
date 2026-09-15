<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：教师学情面板，汇总证据覆盖情况、知识薄弱项及现象统计。
逻辑：先判断是否已有训练或学习证据，再截取重点条目并组合教师分析图；重试通过 retry 事件交给父页面。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 TeacherKnowledgeAnalyticsGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section class="insights" aria-labelledby="knowledge-insight-title">
    <header>
      <div>
        <p>知识图谱学情</p>
        <h2 id="knowledge-insight-title">从阶段下钻到现象、知识与策略证据</h2>
      </div>
      <button v-if="error" type="button" @click="$emit('retry')">重试</button>
    </header>
    <p v-if="loading" class="state">正在聚合每轮图谱证据与学习行为…</p>
    <p v-else-if="error" class="state error" role="alert">{{ error }}</p>
    <p v-else-if="!hasEvidence" class="state">
      暂无图谱学情；完成一轮训练评价或学习一项知识后会在此形成证据。
    </p>
    <template v-else-if="insights">
      <div class="summary">
        <article>
          <strong>{{ insights.evidence_rounds }}</strong
          ><span>证据轮次</span>
        </article>
        <article>
          <strong>{{ insights.students_with_evidence }}</strong
          ><span>涉及学生</span>
        </article>
        <article>
          <strong>{{ insights.learning_views }}</strong
          ><span>内容回访</span>
        </article>
        <article>
          <strong>{{ insights.learning_completions }}</strong
          ><span>完成学习</span>
        </article>
        <article>
          <strong>{{ insights.average_score ?? '-' }}</strong
          ><span>正式评价均分</span>
        </article>
      </div>

      <TeacherKnowledgeAnalyticsGraph :insights="insights" />

      <section v-if="insights.stage_insights.length" class="block stages">
        <div class="section-heading">
          <h3>阶段表现</h3>
          <span>按真实轮次证据聚合</span>
        </div>
        <div class="stage-strip">
          <article
            v-for="stage in insights.stage_insights"
            :key="stage.node_id"
            :class="{ attention: stage.needs_attention }"
          >
            <span>{{ stage.label }}</span>
            <strong>{{ stage.average_score ?? '-' }}</strong>
            <small>{{ stage.evidence_count }} 轮证据</small>
          </article>
        </div>
      </section>

      <div class="drilldown">
        <section class="block">
          <div class="section-heading">
            <h3>需优先巩固的知识与策略</h3>
            <span>可进入教学内容</span>
          </div>
          <ul class="knowledge-list">
            <li v-for="item in visibleKnowledge" :key="item.node_id">
              <div>
                <span>{{ typeLabel(item.knowledge_type) }}</span>
                <b :class="{ attention: item.needs_attention }">{{ item.average_score ?? '-' }}</b>
              </div>
              <RouterLink :to="`${contentBase}${encodeURIComponent(item.node_id)}`">
                {{ item.label }}
              </RouterLink>
              <p>
                {{ item.evidence_count }} 轮证据 · 被建议 {{ item.recommendation_count }} 次 ·
                学习完成 {{ item.content_completion_count }} 次
              </p>
            </li>
          </ul>
        </section>

        <section class="block">
          <div class="section-heading">
            <h3>高频或薄弱现象</h3>
            <span>观察提示依赖</span>
          </div>
          <ul class="phenomenon-list">
            <li v-for="item in visiblePhenomena" :key="item.node_id">
              <div>
                <small>{{ item.stage_label ?? '未归属阶段' }}</small
                ><b>{{ item.average_score ?? '-' }}</b>
              </div>
              <strong>{{ item.label }}</strong>
              <p>
                {{ item.evidence_count }} 轮 · 展开提示 {{ item.scaffold_reveal_count }} 次 · 采用
                {{ item.scaffold_use_count }} 次
              </p>
            </li>
          </ul>
        </section>
      </div>

      <details v-if="insights.weak_units.length" class="unit-evidence">
        <summary>查看关卡级兼容统计（{{ insights.weak_units.length }}）</summary>
        <ul>
          <li v-for="unit in insights.weak_units" :key="unit.unit_id">
            <strong>{{ unit.unit_title }}</strong>
            <span>{{ unit.attempt_count }} 次完成 · 平均 {{ unit.average_score ?? '-' }} 分</span>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { KnowledgeInsights } from '../types'
import TeacherKnowledgeAnalyticsGraph from './TeacherKnowledgeAnalyticsGraph.vue'

const props = withDefaults(
  defineProps<{
    insights: KnowledgeInsights | null
    loading: boolean
    error: string | null
    contentBase?: string
  }>(),
  { contentBase: '/teacher/knowledge-content/' },
)
defineEmits<{ retry: [] }>()

const hasEvidence = computed(
  () =>
    Boolean(props.insights) &&
    ((props.insights?.evidence_rounds ?? 0) > 0 ||
      (props.insights?.learning_views ?? 0) > 0 ||
      (props.insights?.weak_units.length ?? 0) > 0),
)
const visibleKnowledge = computed(() => props.insights?.knowledge_insights.slice(0, 8) ?? [])
const visiblePhenomena = computed(() => props.insights?.phenomenon_insights.slice(0, 7) ?? [])

// [导读] 把知识分类代码转换成中文；缺失或未知分类显示通用名称。
function typeLabel(type: string | null): string {
  return (
    {
      Concept: '概念',
      Correspondence: '函电',
      'Cross-cultural': '跨文化',
      Legal: '法律规则',
      Procedure: '业务流程',
      Risk: '风险管理',
      Strategy: '策略战术',
    }[type ?? ''] ?? '知识资源'
  )
}
</script>

<style scoped>
.insights {
  margin: var(--space-6) 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: #fafcfb;
}
header,
.section-heading,
.knowledge-list li > div,
.phenomenon-list li > div,
.unit-evidence li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
header p,
header h2,
.section-heading h3,
li p {
  margin: 0;
}
header p {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
}
header h2 {
  font-size: 1.12rem;
}
button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.state,
.section-heading span,
li p,
li small,
.summary span {
  color: var(--color-muted);
  font-size: 0.76rem;
}
.error,
.attention {
  color: var(--color-danger) !important;
}
.summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  margin: var(--space-4) 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-border);
}
.summary article {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  background: var(--color-surface);
}
.summary strong {
  font-size: 1.25rem;
}
.block {
  min-width: 0;
  margin-top: var(--space-5);
}
.section-heading {
  margin-bottom: var(--space-3);
}
.section-heading h3 {
  font-size: 0.95rem;
}
.stage-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-2);
}
.stage-strip article {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  border-top: 3px solid var(--color-primary);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  background: var(--color-surface);
}
.stage-strip article.attention {
  border-top-color: var(--color-danger);
}
.stage-strip strong {
  font-size: 1.3rem;
}
.stage-strip small {
  color: var(--color-muted);
}
.drilldown {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: var(--space-5);
}
.knowledge-list,
.phenomenon-list,
.unit-evidence ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.knowledge-list li,
.phenomenon-list li {
  display: grid;
  gap: 4px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.knowledge-list li > div span {
  color: #17628a;
  font-size: 0.7rem;
  font-weight: 800;
}
.knowledge-list a {
  color: var(--color-ink);
  font-weight: 750;
  text-decoration: none;
}
.knowledge-list a:hover {
  color: var(--color-primary);
}
.phenomenon-list strong {
  font-size: 0.84rem;
}
.unit-evidence {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.unit-evidence summary {
  color: var(--color-muted);
  cursor: pointer;
  font-size: 0.8rem;
}
.unit-evidence ul {
  margin-top: var(--space-3);
}
.unit-evidence li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.78rem;
}
@media (max-width: 900px) {
  .summary {
    grid-template-columns: repeat(2, 1fr);
  }
  .drilldown {
    grid-template-columns: 1fr;
  }
}
</style>
