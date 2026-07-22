<template>
  <section class="history" aria-labelledby="history-title">
    <header>
      <div>
        <p>训练证据</p>
        <h2 id="history-title">最近训练</h2>
      </div>
      <button v-if="error" type="button" @click="reload">重试</button>
    </header>
    <p v-if="loading">正在加载训练历史…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!items.length">完成第一轮练习后，这里会保留过程与评价。</p>
    <ul v-else>
      <li v-for="item in items.slice(0, 5)" :key="item.id">
        <div>
          <strong>{{ item.unit_title }}</strong>
          <span>{{ statusLabel(item.status) }} · {{ formatDate(item.updated_at) }}</span>
        </div>
        <b v-if="item.overall_score !== null">{{ Math.round(item.overall_score) }} 分</b>
        <RouterLink
          :to="
            item.status === 'completed'
              ? `/student/attempts/${item.id}/evaluation`
              : `/student/attempts/${item.id}`
          "
        >
          {{ item.status === 'completed' ? '查看评价' : '继续训练' }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useAttemptHistory } from '../composables/useAttemptHistory'
import type { AttemptStatus } from '../types'

const { items, loading, error, reload } = useAttemptHistory()

function statusLabel(status: AttemptStatus): string {
  if (status === 'completed') return '已完成'
  if (status === 'evaluation_failed') return '评价待重试'
  if (status === 'evaluating' || status === 'submitted') return '评价中'
  return '进行中'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(
    new Date(value),
  )
}
</script>

<style scoped>
.history {
  margin-top: var(--space-6);
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border);
}
header,
li,
li div {
  display: flex;
  align-items: center;
}
header,
li {
  justify-content: space-between;
  gap: var(--space-4);
}
header p,
header h2 {
  margin: 0;
}
header p,
li span {
  color: var(--color-muted);
  font-size: 0.82rem;
}
ul {
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
li {
  padding: var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-border);
  transition: background 150ms ease;
}
li:hover {
  background: #f8faf9;
}
li div {
  align-items: flex-start;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
a {
  color: var(--color-primary);
  font-weight: 700;
}
button {
  min-height: 36px;
}
@media (max-width: 680px) {
  li {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
