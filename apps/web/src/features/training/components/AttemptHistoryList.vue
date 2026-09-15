<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：显示学生历史训练及继续训练、重开或查看评价的入口。
逻辑：useAttemptHistory 负责请求；根据状态选择按钮文案和目标地址，场景生成失败的记录引导回小节准备页。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useAttemptHistory。
为什么：展示组件共用训练状态，避免各界面各自修改完成或评价结果；状态是否可操作由后端再次核对。
[/组件导读] -->
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
          <strong>{{ item.unit_title }}</strong
          ><span v-if="item.training_mode === 'document_review'">{{
            item.workspace_kind === 'lc_correction' ? '信用证审改模式' : '旧版文本审阅'
          }}</span>
          <span>{{ statusLabel(item.status) }} · {{ formatDate(item.updated_at) }}</span>
        </div>
        <b v-if="item.overall_score !== null">{{ Math.round(item.overall_score) }} 分</b>
        <RouterLink :to="attemptTarget(item)">
          {{ attemptAction(item.status) }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useAttemptHistory } from '../composables/useAttemptHistory'
import type { AttemptHistoryItem, AttemptStatus } from '../types'

const { items, loading, error, reload } = useAttemptHistory()

// [导读] 把接口状态码映射为面向使用者的中文文案；未知值按函数中的兜底分支处理。
function statusLabel(status: AttemptStatus): string {
  if (status === 'completed') return '已完成'
  if (status === 'generating_scenario') return '场景生成中'
  if (status === 'generation_failed') return '场景生成失败'
  if (status === 'evaluation_failed') return '评价待重试'
  if (status === 'evaluating' || status === 'submitted') return '评价中'
  return '进行中'
}

// [导读] 按训练状态决定去评价页、失败重开准备页还是原训练工作台。
function attemptTarget(item: AttemptHistoryItem): string {
  if (item.status === 'completed') return `/student/attempts/${item.id}/evaluation`
  if (item.status === 'generation_failed') return `/student/units/${item.unit_id}`
  return `/student/attempts/${item.id}`
}

// [导读] 把历史训练状态转换成对应的操作按钮文案。
function attemptAction(status: AttemptStatus): string {
  if (status === 'completed') return '查看评价'
  if (status === 'generation_failed') return '重新开始'
  return '继续训练'
}

// [导读] 将接口日期转换为中文界面使用的日期文本；具体是否保留时间由本函数的格式选项决定。
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
