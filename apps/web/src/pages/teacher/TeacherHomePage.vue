<template>
  <RoleWorkspaceLayout
    title="教师教学工作区"
    description="查看班级学情、明确风险原因，并维护内测学生名册。"
  >
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="classroom">
      <header class="section">
        <div>
          <h2>{{ classroom.name }}</h2>
          <span>{{ classroom.student_count }} 名学生</span>
        </div>
        <RouterLink class="graph-link" to="/teacher/knowledge-graph">查看教学知识图谱 →</RouterLink>
      </header>
      <section v-if="overview" class="metrics">
        <article>
          <strong>{{ overview.student_count }}</strong
          ><span>学生总数</span>
        </article>
        <article>
          <strong>{{ overview.active_students_7d }}</strong
          ><span>7 日活跃</span>
        </article>
        <article>
          <strong>{{ overview.completed_attempts }}</strong
          ><span>已完成训练</span>
        </article>
        <article>
          <strong>{{ overview.average_score ?? '-' }}</strong
          ><span>平均分</span>
        </article>
        <article>
          <strong>{{ overview.attention_count }}</strong
          ><span>需要关注</span>
        </article>
      </section>
      <section v-if="overview?.weak_dimensions.length" class="weaknesses">
        <div>
          <p>共性薄弱维度</p>
          <h3>依据正式评价维度与证据聚合</h3>
        </div>
        <ul>
          <li v-for="item in overview.weak_dimensions" :key="item.dimension_key">
            <strong>{{ item.label }}</strong>
            <span>平均 {{ item.average_score }} 分 · {{ item.evidence_count }} 条证据</span>
          </li>
        </ul>
      </section>
      <KnowledgeInsightPanel
        :insights="knowledgeInsights"
        :loading="knowledgeLoading"
        :error="knowledgeError"
        @retry="loadKnowledgeInsights"
      />
      <section class="tools">
        <form @submit.prevent="createStudent">
          <input v-model="form.student_no" placeholder="学号" required /><input
            v-model="form.display_name"
            placeholder="姓名"
            required
          /><input v-model="form.email" type="email" placeholder="邮箱" required /><input
            v-model="form.initial_password"
            type="password"
            placeholder="初始密码（8位以上）"
            required
          /><button>新增学生</button>
        </form>
        <label class="import"
          >批量导入 CSV <input type="file" accept=".csv,text/csv" @change="importCsv"
        /></label>
        <small>CSV 表头：student_no,display_name,email,initial_password</small>
        <div class="filters">
          <input v-model="search" type="search" placeholder="按姓名、学号或邮箱搜索" />
          <select v-model="riskFilter" aria-label="风险状态">
            <option value="all">全部风险状态</option>
            <option value="attention">需要关注</option>
            <option value="normal">正常</option>
          </select>
          <select v-model="progressFilter" aria-label="完成率">
            <option value="all">全部完成率</option>
            <option value="not-started">未开始</option>
            <option value="in-progress">学习中</option>
            <option value="completed">已完成路线</option>
          </select>
          <select v-model="sortBy" aria-label="排序">
            <option value="last-active">最后活跃优先</option>
            <option value="completion">完成率从高到低</option>
            <option value="score">平均表现从高到低</option>
          </select>
        </div>
      </section>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>学生</th>
              <th>完成小节</th>
              <th>最近得分</th>
              <th>最后活跃</th>
              <th>状态/风险</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in filteredStudents" :key="student.id">
              <td>
                <template v-if="editingId === student.id">
                  <input v-model="editForm.display_name" aria-label="姓名" />
                  <input v-model="editForm.email" type="email" aria-label="邮箱" />
                </template>
                <template v-else>
                  <strong>{{ student.display_name }}</strong
                  ><small>{{ student.student_no }} · {{ student.email }}</small>
                </template>
              </td>
              <td>
                <strong>{{ student.completion_rate }}%</strong>
                <small>{{ student.current_unit_title ?? '尚未开始' }}</small>
              </td>
              <td>{{ student.latest_score ?? '-' }}</td>
              <td>{{ formatDate(student.last_active_at) }}</td>
              <td>
                <span v-if="student.risk_reasons.length" class="risk">{{
                  student.risk_reasons.join('、')
                }}</span
                ><span v-else>正常</span>
              </td>
              <td class="actions">
                <template v-if="editingId === student.id">
                  <button @click="saveStudent(student.id)">保存</button>
                  <button @click="editingId = null">取消</button>
                </template>
                <template v-else>
                  <RouterLink :to="`/teacher/students/${student.id}`">查看详情</RouterLink>
                  <button @click="startEdit(student)">编辑</button>
                  <button class="danger" @click="removeStudent(student.id)">移出</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import { teacherApi } from '@/features/teacher-dashboard/api/teacherApi'
import type { Classroom, Overview, Student, StudentInput } from '@/features/teacher-dashboard/types'
import { useAuthStore } from '@/features/auth/stores/auth'
import { confirmAction } from '@/shared/utils/confirmation'
import {
  KnowledgeInsightPanel,
  useKnowledgeInsights,
} from '@/features/knowledge-graph/teacherInsights'

const auth = useAuthStore()
const classroom = ref<Classroom | null>(null)
const {
  insights: knowledgeInsights,
  loading: knowledgeLoading,
  error: knowledgeError,
  load: loadKnowledgeInsights,
} = useKnowledgeInsights('classroom', () => classroom.value?.id ?? null)
const overview = ref<Overview | null>(null)
const students = ref<Student[]>([])
const error = ref<string | null>(null)
const search = ref('')
const riskFilter = ref<'all' | 'attention' | 'normal'>('all')
const progressFilter = ref<'all' | 'not-started' | 'in-progress' | 'completed'>('all')
const sortBy = ref<'last-active' | 'completion' | 'score'>('last-active')
const editingId = ref<string | null>(null)
const editForm = reactive({ display_name: '', email: '' })
const form = reactive<StudentInput>({
  student_no: '',
  display_name: '',
  email: '',
  initial_password: '',
})
const filteredStudents = computed(() => {
  // 筛选与排序只作用于当前班级快照，服务器仍是名册和学情的唯一事实来源。
  const keyword = search.value.trim().toLowerCase()
  const filtered = students.value.filter((student) => {
    const matchesKeyword =
      !keyword ||
      [student.display_name, student.student_no, student.email].some((value) =>
        value.toLowerCase().includes(keyword),
      )
    const matchesRisk =
      riskFilter.value === 'all' ||
      (riskFilter.value === 'attention' && student.risk_reasons.length > 0) ||
      (riskFilter.value === 'normal' && student.risk_reasons.length === 0)
    const matchesProgress =
      progressFilter.value === 'all' ||
      (progressFilter.value === 'not-started' && student.completed_units === 0) ||
      (progressFilter.value === 'in-progress' &&
        student.completed_units > 0 &&
        student.completed_units < student.total_units) ||
      (progressFilter.value === 'completed' && student.completed_units === student.total_units)
    return matchesKeyword && matchesRisk && matchesProgress
  })
  return [...filtered].sort((left, right) => {
    if (sortBy.value === 'completion') return right.completion_rate - left.completion_rate
    if (sortBy.value === 'score') return (right.latest_score ?? -1) - (left.latest_score ?? -1)
    return (
      Date.parse(right.last_active_at ?? '1970-01-01') -
      Date.parse(left.last_active_at ?? '1970-01-01')
    )
  })
})
async function load() {
  if (!auth.accessToken) return
  try {
    const list = await teacherApi.classrooms(auth.accessToken)
    classroom.value = list[0] ?? null
    if (classroom.value) {
      ;[overview.value, students.value] = await Promise.all([
        teacherApi.overview(auth.accessToken, classroom.value.id),
        teacherApi.students(auth.accessToken, classroom.value.id),
      ])
      await loadKnowledgeInsights()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}
async function createStudent() {
  if (!auth.accessToken || !classroom.value) return
  try {
    await teacherApi.create(auth.accessToken, classroom.value.id, { ...form })
    Object.assign(form, { student_no: '', display_name: '', email: '', initial_password: '' })
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '新增失败'
  }
}
async function importCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !auth.accessToken || !classroom.value) return
  const lines = (await file.text()).trim().split(/\r?\n/)
  // 首期模板约定四列且不允许字段内逗号；后端会再次校验每一行并返回明确错误。
  const rows = lines.slice(1).map((line) => {
    const [student_no, display_name, email, initial_password] = line.split(',').map((v) => v.trim())
    return {
      student_no: student_no ?? '',
      display_name: display_name ?? '',
      email: email ?? '',
      initial_password: initial_password ?? '',
    }
  })
  try {
    await teacherApi.importRows(auth.accessToken, classroom.value.id, rows)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导入失败'
  }
}
async function removeStudent(id: string) {
  if (!auth.accessToken || !classroom.value || !confirmAction('确认将该学生移出班级？')) return
  await teacherApi.remove(auth.accessToken, classroom.value.id, id)
  await load()
}
function startEdit(student: Student) {
  editingId.value = student.id
  editForm.display_name = student.display_name
  editForm.email = student.email
}
async function saveStudent(id: string) {
  if (!auth.accessToken || !classroom.value) return
  try {
    await teacherApi.update(auth.accessToken, classroom.value.id, id, { ...editForm })
    editingId.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '更新失败'
  }
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '无训练'
}
onMounted(load)
</script>
<style scoped>
.error,
.risk {
  color: var(--color-danger);
}
.section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.section > div {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.graph-link {
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 750;
  text-decoration: none;
}
.section h2 {
  margin: 0;
  font-size: 1.3rem;
}
.section span {
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: 0.8rem;
  font-weight: 700;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  margin-top: var(--space-5);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-border);
}
.metrics article {
  display: grid;
  gap: 4px;
  padding: var(--space-4);
  padding: var(--space-5, 20px);
  background: var(--color-surface);
  animation: metric-in 240ms ease-out both;
}
.metrics strong {
  color: var(--color-primary);
  font-size: 2rem;
  font-variant-numeric: tabular-nums;
}
.metrics span,
small {
  color: var(--color-muted);
}
.tools {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-8) 0 var(--space-5);
  padding: var(--space-5, 20px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fafcfb;
}
.tools form {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.filters input {
  flex: 1;
  min-width: 220px;
}
input,
button,
.import,
select {
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}
input:hover,
select:hover {
  border-color: #aebdb6;
}
.tools button {
  border-color: var(--color-primary);
  color: white;
  background: var(--color-primary);
  font-weight: 700;
}
.weaknesses {
  display: grid;
  grid-template-columns: minmax(200px, 0.35fr) 1fr;
  gap: var(--space-6);
  margin-top: var(--space-5);
  padding: var(--space-6) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.weaknesses p,
.weaknesses h3 {
  margin: 0;
}
.weaknesses p,
.weaknesses span {
  color: var(--color-muted);
  font-size: 0.82rem;
}
.weaknesses ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.weaknesses li {
  display: grid;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
}
button,
.import {
  cursor: pointer;
}
.import input {
  border: 0;
}
.table-wrap {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: var(--color-muted);
  background: #f5f8f6;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
}
tbody tr {
  transition: background 140ms ease;
}
tbody tr:hover {
  background: #f8faf9;
}
td:first-child {
  display: grid;
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}
.actions a,
.actions button {
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  color: var(--color-primary);
  background: transparent;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}
.danger {
  color: var(--color-danger);
}
@keyframes metric-in {
  from {
    opacity: 0;
  }
}
@media (max-width: 800px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
  }
  .weaknesses,
  .weaknesses ul {
    grid-template-columns: 1fr;
  }
}
</style>
