/* [组件导读]
 * 业务名词：变更集是待评审的图谱改动；发布版是通过评审后可读取的图数据，模型配置按生成场景、对话和评价分用途。
 * 用途：组织图谱模板下载、导入、校验、评审、发布与回滚的页面状态。
 * 为什么与边界：变更集是待审的图谱改动，发布才影响可读取版本；重复上传可能恢复已有结果，应按服务端状态恢复预览。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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

  // [导读] 统一管理异步动作的忙碌与错误状态，finally 确保失败后按钮不会永久锁定。
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

  // [导读] 恢复导入任务后按服务端状态决定能否读取变更集，避免把校验失败当作可发布。
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

  // [导读] 等待后端发布完成才更新本地状态；审批通过并不等于图存储已写入。
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

  // [导读] 等待后端回滚后将本地变更集恢复为可审批后发布状态，界面状态不能先行冒充成功。
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
