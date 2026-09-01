<template>
  <section class="insights" aria-labelledby="knowledge-insight-title">
    <header>
      <div>
        <p>知识图谱学情</p>
        <h2 id="knowledge-insight-title">从训练证据定位待加强环节</h2>
      </div>
      <button v-if="error" type="button" @click="$emit('retry')">重试</button>
    </header>
    <p v-if="loading" class="state">正在聚合现象、知识资源与策略表现…</p>
    <p v-else-if="error" class="state error" role="alert">{{ error }}</p>
    <p v-else-if="!insights?.weak_units.length" class="state">
      暂无知识图谱学情；学生完成正式评价后会在此形成证据。
    </p>
    <template v-else>
      <div class="summary">
        <span
          ><strong>{{ insights.completed_attempts }}</strong> 次完成训练</span
        >
        <span
          ><strong>{{ insights.average_score ?? '-' }}</strong> 平均分</span
        >
        <span
          ><strong>{{ attentionCount }}</strong> 个待加强小节</span
        >
      </div>
      <ul>
        <li v-for="unit in insights.weak_units" :key="unit.unit_id">
          <div>
            <strong>{{ unit.unit_title }}</strong>
            <span :class="{ attention: unit.needs_attention }">
              {{ unit.needs_attention ? '需要关注' : '已有证据' }}
            </span>
          </div>
          <p>{{ unit.attempt_count }} 次训练 · 平均 {{ unit.average_score ?? '-' }} 分</p>
          <dl>
            <div>
              <dt>现象</dt>
              <dd>{{ unit.phenomenon_ids.length }}</dd>
            </div>
            <div>
              <dt>知识</dt>
              <dd>{{ unit.knowledge_resource_ids.length }}</dd>
            </div>
            <div>
              <dt>策略</dt>
              <dd>{{ unit.strategy_ids.length }}</dd>
            </div>
          </dl>
          <div v-if="Object.keys(unit.knowledge_type_breakdown).length" class="type-breakdown">
            <span v-for="(count, type) in unit.knowledge_type_breakdown" :key="type">
              {{ typeLabel(type) }} {{ count }}
            </span>
          </div>
          <p class="scaffold-usage">
            展开提示 {{ unit.scaffold_reveal_count }} 次 · 采用 {{ unit.scaffold_use_count }} 次
            <template v-if="scopeIsClassroom">
              · {{ unit.students_using_scaffolds }} 名学生使用
            </template>
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { KnowledgeInsights } from '../types'

const props = defineProps<{
  insights: KnowledgeInsights | null
  loading: boolean
  error: string | null
}>()
defineEmits<{ retry: [] }>()

const attentionCount = computed(
  () => props.insights?.weak_units.filter((item) => item.needs_attention).length ?? 0,
)
const scopeIsClassroom = computed(() => props.insights?.scope === 'classroom')
function typeLabel(type: string): string {
  return (
    {
      Concept: '概念',
      Correspondence: '函电',
      'Cross-cultural': '跨文化',
      Legal: '法律',
      Procedure: '流程',
      Risk: '风险',
      Strategy: '策略',
      LegacyResource: '知识',
    }[type] ?? type
  )
}
</script>

<style scoped>
.insights {
  margin: var(--space-6) 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fafcfb;
}
header,
li > div,
.summary,
dl {
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
  font-size: 0.75rem;
  font-weight: 800;
}
header h2 {
  font-size: 1.05rem;
}
button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.state {
  color: var(--color-muted);
}
.error,
.attention {
  color: var(--color-danger);
}
.summary {
  justify-content: flex-start;
  margin: var(--space-4) 0;
  color: var(--color-muted);
  font-size: 0.78rem;
}
.summary strong {
  color: var(--color-ink);
  font-size: 1rem;
}
ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
li span,
li p,
dt {
  color: var(--color-muted);
  font-size: 0.72rem;
}
.scaffold-usage {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.type-breakdown {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin: var(--space-2) 0;
}
.type-breakdown span {
  padding: 3px 6px;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
dl {
  justify-content: flex-start;
  margin: var(--space-3) 0 0;
}
dl div {
  display: flex;
  gap: 3px;
}
dd {
  margin: 0;
  font-weight: 750;
}
@media (max-width: 800px) {
  ul {
    grid-template-columns: 1fr;
  }
}
</style>
