import { onMounted, ref } from 'vue'

import { knowledgeGraphApi } from '@/features/technician/api/knowledgeGraphApi'
import type {
  GraphChangeSet,
  GraphPublication,
  KnowledgeImportJob,
  TeachingCasePreview,
  ValidationIssue,
} from '@/features/technician/types/knowledgeGraph'
import { useAuthStore } from '@/features/auth/stores/auth'
import { saveBlob } from '@/shared/utils/download'

const RESTORABLE_STATUSES = new Set([
  'review_ready',
  'in_review',
  'approved',
  'rejected',
  'published',
])

export function canRestoreChangeSet(status: string): boolean {
  return RESTORABLE_STATUSES.has(status)
}

export function useKnowledgeGraphImport() {
  const auth = useAuthStore()
  const job = ref<KnowledgeImportJob | null>(null)
  const issues = ref<ValidationIssue[]>([])
  const changeSet = ref<GraphChangeSet | null>(null)
  const preview = ref<TeachingCasePreview[]>([])
  const activePublication = ref<GraphPublication | null>(null)
  const busy = ref(false)
  const message = ref('')
  const failed = ref(false)

  function token(): string {
    if (!auth.accessToken) throw new Error('登录会话已失效。')
    return auth.accessToken
  }

  async function run(action: () => Promise<void>): Promise<void> {
    busy.value = true
    message.value = ''
    try {
      await action()
      failed.value = false
    } catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
      failed.value = true
    } finally {
      busy.value = false
    }
  }

  async function downloadTemplate(): Promise<void> {
    await run(async () => {
      const blob = await knowledgeGraphApi.downloadTemplate(token())
      saveBlob(blob, '外贸谈判教学知识图谱DSL_教师模板_v2.xlsx')
      message.value = '模板已下载。'
    })
  }

  async function upload(file: File): Promise<void> {
    await run(async () => {
      job.value = await knowledgeGraphApi.upload(token(), file)
      issues.value = await knowledgeGraphApi.issues(token(), job.value.id)
      if (canRestoreChangeSet(job.value.status)) {
        changeSet.value = await knowledgeGraphApi.changeSet(token(), job.value.id)
        preview.value = await knowledgeGraphApi.preview(token(), job.value.id)
      } else {
        changeSet.value = null
        preview.value = []
      }
      message.value = job.value.idempotent_replay
        ? '该文件已处理，已恢复原导入结果。'
        : job.value.error_count
          ? '校验未通过，请根据单元格位置修正。'
          : '校验通过，请先审阅教学链再提交。'
    })
  }

  async function submitReview(): Promise<void> {
    const current = changeSet.value
    if (!current) return
    await run(async () => {
      changeSet.value = await knowledgeGraphApi.submitReview(token(), current.id)
      if (job.value) job.value = { ...job.value, status: changeSet.value.status }
      message.value = '已提交技术员评审。'
    })
  }

  async function decide(decision: 'approve' | 'reject', reason?: string): Promise<void> {
    const current = changeSet.value
    if (!current) return
    await run(async () => {
      changeSet.value = await knowledgeGraphApi.decide(token(), current.id, decision, reason)
      if (job.value) job.value = { ...job.value, status: changeSet.value.status }
      message.value = decision === 'approve' ? '变更集已批准。' : '变更集已驳回。'
    })
  }

  async function publish(): Promise<void> {
    const current = changeSet.value
    if (!current) return
    await run(async () => {
      activePublication.value = await knowledgeGraphApi.publish(token(), current.id)
      changeSet.value = { ...current, status: 'published' }
      if (job.value) job.value = { ...job.value, status: 'published' }
      message.value = '已发布到隔离的演示环境。'
    })
  }

  async function rollback(): Promise<void> {
    const current = activePublication.value
    if (!current) return
    await run(async () => {
      await knowledgeGraphApi.rollback(token(), current.id)
      activePublication.value = null
      if (changeSet.value) changeSet.value = { ...changeSet.value, status: 'approved' }
      if (job.value) job.value = { ...job.value, status: 'approved' }
      message.value = '演示版本已回滚。'
    })
  }

  onMounted(() =>
    run(async () => {
      activePublication.value = await knowledgeGraphApi.active(token())
    }),
  )

  return {
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
  }
}
