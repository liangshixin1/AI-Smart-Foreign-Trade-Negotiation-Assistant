<template>
  <section class="panel" aria-labelledby="kg-import-title">
    <header class="hero">
      <div>
        <span class="eyebrow">PHASE 1 · 教师案例 DSL</span>
        <h2 id="kg-import-title">从备课表到可审核教学图谱</h2>
        <p>系统隐藏 Neo4j 建模复杂度；本周演示环境只发布经人工批准的变更集。</p>
      </div>
      <button type="button" class="secondary" :disabled="busy" @click="downloadTemplate">
        下载 DSL 2.0 模板
      </button>
    </header>

    <div class="workflow" aria-label="发布流程">
      <span>① 上传校验</span><i /> <span>② 教学预览</span><i /> <span>③ 人工评审</span><i />
      <span>④ 演示发布</span>
    </div>

    <div class="upload-card">
      <label>
        <strong>选择教学案例表</strong>
        <span>仅支持系统 DSL 2.0 `.xlsx`，最大 5 MB。</span>
        <input type="file" accept=".xlsx" :disabled="busy" @change="selectFile" />
      </label>
      <button type="button" class="primary" :disabled="!file || busy" @click="uploadSelected">
        {{ busy ? '正在处理…' : '上传并校验' }}
      </button>
    </div>

    <p v-if="message" class="notice" :class="{ error: failed }" role="status">
      {{ message }}
    </p>

    <section v-if="job" class="result" aria-labelledby="validation-title">
      <div class="result-heading">
        <div>
          <span class="eyebrow">导入任务 {{ job.id.slice(0, 8) }}</span>
          <h3 id="validation-title">
            {{ job.error_count ? '校验未通过' : '工作簿校验通过' }}
          </h3>
        </div>
        <div class="metrics">
          <span
            ><strong>{{ job.error_count }}</strong
            >阻断</span
          >
          <span
            ><strong>{{ job.warning_count }}</strong
            >警告</span
          >
        </div>
      </div>
      <div v-if="issues.length" class="issues">
        <article v-for="issue in issues" :key="issueKey(issue)" :class="issue.severity">
          <strong>{{ issue.severity === 'error' ? '需修正' : '建议检查' }}</strong>
          <p>{{ location(issue) }}｜{{ issue.message }}</p>
        </article>
      </div>
    </section>

    <section v-if="changeSet" class="change-set" aria-labelledby="change-set-title">
      <div>
        <span class="eyebrow">确定性编译结果</span>
        <h3 id="change-set-title">变更集摘要</h3>
      </div>
      <div class="summary-grid">
        <span
          ><strong>{{ count('case_count') }}</strong
          >教学案例</span
        >
        <span
          ><strong>{{ count('node_count') }}</strong
          >语义节点</span
        >
        <span
          ><strong>{{ count('relationship_count') }}</strong
          >可追溯关系</span
        >
        <span
          ><strong>{{ count('reused_node_count') }}</strong
          >复用节点</span
        >
        <span
          ><strong>{{ count('conflict_count') }}</strong
          >冲突</span
        >
      </div>
      <div class="review-actions">
        <button
          v-if="changeSet.status === 'review_ready'"
          type="button"
          class="primary"
          :disabled="busy"
          @click="submitReview"
        >
          确认教学链并提交评审
        </button>
        <template v-if="changeSet.status === 'in_review'">
          <button type="button" class="primary" :disabled="busy" @click="decide('approve')">
            批准变更集
          </button>
          <input v-model.trim="rejectionReason" placeholder="驳回原因（驳回时必填）" />
          <button
            type="button"
            class="danger"
            :disabled="busy || !rejectionReason"
            @click="decide('reject', rejectionReason)"
          >
            驳回
          </button>
        </template>
        <button
          v-if="changeSet.status === 'approved'"
          type="button"
          class="primary"
          :disabled="busy"
          @click="publish"
        >
          发布至隔离演示环境
        </button>
        <span class="state">当前状态：{{ statusLabel(changeSet.status) }}</span>
      </div>
    </section>

    <TeachingPreviewPanel :cases="preview" />

    <footer v-if="activePublication" class="publication">
      <div>
        <span class="live-dot" />
        <strong>演示环境已激活 {{ activePublication.graph_version }}</strong>
        <p>存储后端：{{ activePublication.storage_backend }}；未接入学生正式数据。</p>
      </div>
      <button type="button" class="danger" :disabled="busy" @click="rollback">回滚演示版本</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import TeachingPreviewPanel from '@/features/technician/components/TeachingPreviewPanel.vue'
import { useKnowledgeGraphImport } from '@/features/technician/composables/useKnowledgeGraphImport'
import type { ValidationIssue } from '@/features/technician/types/knowledgeGraph'

const file = ref<File | null>(null)
const rejectionReason = ref('')
const {
  job,
  issues,
  changeSet,
  preview,
  activePublication,
  busy,
  message,
  failed,
  downloadTemplate,
  upload,
  submitReview,
  decide,
  publish,
  rollback,
} = useKnowledgeGraphImport()

function selectFile(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}
function uploadSelected(): void {
  if (file.value) void upload(file.value)
}
function count(key: string): number {
  return changeSet.value?.summary[key] ?? 0
}
function issueKey(issue: ValidationIssue): string {
  return `${issue.code}-${issue.sheet_name}-${String(issue.row_number)}-${issue.column_name ?? ''}`
}
function location(issue: ValidationIssue): string {
  const row = issue.row_number ? ` 第 ${String(issue.row_number)} 行` : ''
  const column = issue.column_name ? `，“${issue.column_name}”` : ''
  return `${issue.sheet_name}${row}${column}`
}
function statusLabel(status: string): string {
  return (
    {
      validation_failed: '校验未通过',
      review_ready: '校验通过，待确认',
      in_review: '技术评审中',
      approved: '已批准，待发布',
      rejected: '已驳回',
      published: '已发布',
    }[status] ?? status
  )
}
</script>

<style scoped>
.panel {
  display: grid;
  gap: var(--space-5);
  margin-bottom: var(--space-8);
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: white;
  box-shadow: var(--shadow-sm);
}
.hero,
.result-heading,
.publication,
.review-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.hero p,
.publication p {
  margin: var(--space-1) 0 0;
  color: var(--color-muted);
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}
h2,
h3 {
  margin: 0.2rem 0 0;
}
.workflow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: 0.86rem;
}
.workflow i {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.upload-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px dashed #8db5a5;
  border-radius: var(--radius-md);
  background: #f4faf7;
}
.upload-card label,
.upload-card label span {
  display: block;
}
.upload-card label span {
  margin: 0.25rem 0 var(--space-2);
  color: var(--color-muted);
  font-size: 0.85rem;
}
button,
input {
  min-height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.primary {
  color: white;
  border-color: var(--color-primary);
  background: var(--color-primary);
}
.danger {
  color: var(--color-danger);
  border-color: #e8b8b8;
}
.notice,
.result,
.change-set,
.publication {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: #f7faf8;
}
.notice.error,
.error p {
  color: var(--color-danger);
}
.metrics,
.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.metrics span,
.summary-grid span {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
}
.metrics strong,
.summary-grid strong {
  display: block;
  font-size: 1.35rem;
}
.issues {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.issues article {
  padding: var(--space-3);
  border-left: 3px solid #d8a429;
  background: #fffaf0;
}
.issues article.error {
  border-left-color: var(--color-danger);
  background: #fff5f5;
}
.issues p {
  margin: 0.25rem 0 0;
}
.change-set {
  display: grid;
  gap: var(--space-3);
}
.review-actions {
  justify-content: flex-start;
  flex-wrap: wrap;
}
.review-actions input {
  flex: 1;
  min-width: 220px;
}
.state {
  color: var(--color-muted);
  font-size: 0.85rem;
}
.live-dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  margin-right: var(--space-2);
  border-radius: 50%;
  background: #22a06b;
  box-shadow: 0 0 0 5px #dff5eb;
}
@media (max-width: 760px) {
  .hero,
  .result-heading,
  .publication,
  .upload-card {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .hero,
  .result-heading,
  .publication {
    display: grid;
  }
  .workflow {
    display: none;
  }
}
</style>
