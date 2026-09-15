<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：教师查看单个学生的学习进度、能力证据、知识概况与训练列表。
逻辑：按路由 studentId 请求个人详情，知识分析由独立组合函数加载；训练记录链接通向单次训练回放。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout；状态入口 useAuthStore、useRoute、useKnowledgeInsights。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout title="学生学情详情" description="从风险结论追溯到每一次真实训练。">
    <RouterLink to="/teacher">← 返回班级总览</RouterLink>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="detail">
      <section class="summary">
        <div>
          <span>学生</span><strong>{{ detail.student.display_name }}</strong>
        </div>
        <div>
          <span>学号</span><strong>{{ detail.student.student_no }}</strong>
        </div>
        <div>
          <span>已完成</span><strong>{{ detail.student.completed_units }} 节</strong>
        </div>
        <div>
          <span>最近得分</span><strong>{{ detail.student.latest_score ?? '-' }}</strong>
        </div>
      </section>
      <section class="competencies">
        <header>
          <h2>能力维度与薄弱点</h2>
          <p>由正式评价维度、分数和引用证据聚合，不使用自由文本猜测。</p>
        </header>
        <p v-if="!detail.competencies.length" class="empty">完成正式评价后显示能力表现。</p>
        <ul v-else>
          <li
            v-for="item in detail.competencies"
            :key="item.dimension_key"
            :class="{ weak: item.needs_attention }"
          >
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.needs_attention ? '需要关注' : '表现稳定' }}</span>
            </div>
            <b>{{ item.average_score }}<small>/100 平均</small></b>
            <p>{{ item.attempt_count }} 次评价 · {{ item.evidence_count }} 条证据</p>
            <div class="trend" :aria-label="`${item.label}历次得分`">
              <i
                v-for="point in item.trend"
                :key="point.attempt_id"
                :style="{ height: `${Math.max(8, point.score)}%` }"
                :title="`${point.score}分`"
              />
            </div>
          </li>
        </ul>
      </section>
      <KnowledgeInsightPanel
        :insights="knowledgeInsights"
        :loading="knowledgeLoading"
        :error="knowledgeError"
        @retry="loadKnowledgeInsights"
      />
      <h2>训练时间线</h2>
      <p v-if="!detail.attempts.length" class="empty">该学生还没有开始训练。</p>
      <ol v-else class="timeline">
        <li v-for="attempt in detail.attempts" :key="attempt.id">
          <div>
            <strong>{{ attempt.unit_title }}</strong>
            <span>{{ formatDate(attempt.created_at) }} · {{ statusLabel(attempt.status) }}</span>
          </div>
          <b>{{ attempt.overall_score ?? '-' }}<small v-if="attempt.overall_score">/100</small></b>
          <RouterLink :to="`/teacher/attempts/${attempt.id}`">查看完整证据</RouterLink>
        </li>
      </ol>
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import { useAuthStore } from '@/features/auth/stores/auth'
import { teacherApi } from '@/features/teacher-dashboard/api/teacherApi'
import type { StudentDetail } from '@/features/teacher-dashboard/types'
import {
  KnowledgeInsightPanel,
  useKnowledgeInsights,
} from '@/features/knowledge-graph/teacherInsights'

const auth = useAuthStore()
const route = useRoute()
const detail = ref<StudentDetail | null>(null)
const error = ref<string | null>(null)
const studentId = String(route.params.studentId)
const {
  insights: knowledgeInsights,
  loading: knowledgeLoading,
  error: knowledgeError,
  load: loadKnowledgeInsights,
} = useKnowledgeInsights('student', () => studentId)
// [导读] 将接口日期转换为中文界面使用的日期文本；具体是否保留时间由本函数的格式选项决定。
function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}
// [导读] 把接口状态码映射为面向使用者的中文文案；未知值按函数中的兜底分支处理。
function statusLabel(status: string) {
  return { in_progress: '进行中', evaluating: '评价中', completed: '已完成' }[status] ?? status
}
onMounted(async () => {
  if (!auth.accessToken) return
  try {
    detail.value = await teacherApi.studentDetail(auth.accessToken, studentId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
})
</script>

<style scoped>
.error {
  color: var(--color-danger);
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin: var(--space-6) 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-border);
  gap: 1px;
}
.summary div {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface);
}
.summary span,
.timeline span,
small,
.empty {
  color: var(--color-muted);
}
.timeline {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}
.competencies {
  margin: var(--space-6) 0;
  padding: var(--space-5) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.competencies header h2,
.competencies header p,
.competencies li p {
  margin: 0;
}
.competencies header p,
.competencies li p {
  color: var(--color-muted);
}
.competencies ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
.competencies li {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-canvas);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}
.competencies li:hover {
  box-shadow: 0 8px 22px rgb(25 52 42 / 8%);
  transform: translateY(-2px);
}
.competencies li.weak {
  border-left-color: var(--color-danger);
}
.competencies li > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}
.competencies li > div span {
  color: var(--color-muted);
  font-size: 0.78rem;
}
.trend {
  display: flex;
  align-items: end;
  gap: 3px;
  height: 36px;
}
.trend i {
  flex: 1;
  max-width: 14px;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  animation: trend-in 350ms ease-out both;
}
.timeline li {
  display: grid;
  grid-template-columns: 1fr 90px auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fafcfb;
}
.timeline a {
  color: var(--color-primary);
  font-weight: 700;
}
@keyframes trend-in {
  from {
    height: 0;
    opacity: 0;
  }
}
.timeline li div {
  display: grid;
  gap: var(--space-1);
}
@media (max-width: 760px) {
  .summary {
    grid-template-columns: repeat(2, 1fr);
  }
  .timeline li {
    grid-template-columns: 1fr auto;
  }
  .competencies ul {
    grid-template-columns: 1fr;
  }
}
</style>
