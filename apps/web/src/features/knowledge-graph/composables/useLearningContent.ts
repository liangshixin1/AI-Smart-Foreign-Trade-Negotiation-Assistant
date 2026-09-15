/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：分别管理学生学习正文与教师编辑表单、发布状态和附件操作。
 * 为什么与边界：generation 是请求代次；只允许当前节点的请求回写，避免切节点后旧响应覆盖新页面。附件响应只更新元数据，保留未保存的正文表单。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { LearningContent, LearningContentInput } from '../types'

export function useStudentLearningContent(nodeId: MaybeRefOrGetter<string>) {
  const auth = useAuthStore()
  const content = ref<LearningContent | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  let generation = 0
  // [导读] 每次加载递增 generation；只让最新请求更新页面，防止较慢的旧节点响应覆盖当前节点。
  async function load(): Promise<void> {
    const current = ++generation
    content.value = null
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      const value = await knowledgeGraphLearningApi.studentContent(
        auth.accessToken,
        toValue(nodeId),
      )
      if (current === generation) content.value = value
    } catch (cause: unknown) {
      if (current !== generation) return
      error.value = cause instanceof Error ? cause.message : '学习内容加载失败。'
    } finally {
      if (current === generation) loading.value = false
    }
  }
  watch(() => toValue(nodeId), load, { immediate: true })
  return { content, loading, error, reload: load }
}

export function useTeacherLearningContent(nodeId: MaybeRefOrGetter<string>) {
  const auth = useAuthStore()
  const content = ref<LearningContent | null>(null)
  const form = reactive<LearningContentInput>({
    title: '',
    summary: '',
    markdown_body: '',
    status: 'draft',
  })
  const loading = ref(true)
  const saving = ref(false)
  const message = ref<string | null>(null)

  // [导读] 同时回填正文与表单，适用于加载或明确保存后的同步；附件更新不应调用它覆盖未保存输入。
  function apply(value: LearningContent): void {
    content.value = value
    Object.assign(form, {
      title: value.title,
      summary: value.summary,
      markdown_body: value.markdown_body,
      status: value.status,
    })
  }
  let generation = 0
  // [导读] 每次加载递增 generation；只让最新请求更新页面，防止较慢的旧节点响应覆盖当前节点。
  async function load(): Promise<void> {
    const current = ++generation
    content.value = null
    saving.value = false
    if (!auth.accessToken) return
    loading.value = true
    message.value = null
    try {
      const value = await knowledgeGraphLearningApi.teacherContent(
        auth.accessToken,
        toValue(nodeId),
      )
      if (current === generation) apply(value)
    } catch (cause: unknown) {
      if (current !== generation) return
      message.value = cause instanceof Error ? cause.message : '教学内容加载失败。'
    } finally {
      if (current === generation) loading.value = false
    }
  }
  // [导读] 保存发起时记录请求代次，节点切换后忽略旧回执，避免把另一节点内容写入当前表单。
  async function save(): Promise<void> {
    if (!auth.accessToken) return
    const current = generation
    saving.value = true
    message.value = null
    try {
      const value = await knowledgeGraphLearningApi.updateTeacherContent(
        auth.accessToken,
        toValue(nodeId),
        { ...form },
      )
      if (current !== generation) return
      apply(value)
      message.value = form.status === 'published' ? '内容已保存并发布。' : '草稿已保存。'
    } catch (cause: unknown) {
      if (current !== generation) return
      message.value = cause instanceof Error ? cause.message : '教学内容保存失败。'
    } finally {
      if (current === generation) saving.value = false
    }
  }
  // [导读] 上传回执只更新 content 元数据，保留 form 中未保存的正文；同时检查请求代次。
  async function uploadAsset(kind: 'video' | 'slides', file: File): Promise<void> {
    if (!auth.accessToken) return
    const current = generation
    saving.value = true
    message.value = null
    try {
      const value = await knowledgeGraphLearningApi.uploadTeacherAsset(
        auth.accessToken,
        toValue(nodeId),
        kind,
        file,
      )
      if (current !== generation) return
      content.value = value
      message.value = kind === 'video' ? '讲解视频上传成功。' : '教学 PPTX 上传成功。'
    } catch (cause: unknown) {
      if (current !== generation) return
      message.value = cause instanceof Error ? cause.message : '教学资源上传失败。'
    } finally {
      if (current === generation) saving.value = false
    }
  }
  // [导读] 删除成功后只更新附件所属内容元数据，避免删除附件导致正在编辑的文字丢失。
  async function deleteAsset(kind: 'video' | 'slides'): Promise<void> {
    if (!auth.accessToken) return
    const current = generation
    saving.value = true
    message.value = null
    try {
      const value = await knowledgeGraphLearningApi.deleteTeacherAsset(
        auth.accessToken,
        toValue(nodeId),
        kind,
      )
      if (current !== generation) return
      content.value = value
      message.value = kind === 'video' ? '讲解视频已删除。' : '教学 PPTX 已删除。'
    } catch (cause: unknown) {
      if (current !== generation) return
      message.value = cause instanceof Error ? cause.message : '教学资源删除失败。'
    } finally {
      if (current === generation) saving.value = false
    }
  }
  watch(() => toValue(nodeId), load, { immediate: true })
  return { content, form, loading, saving, message, reload: load, save, uploadAsset, deleteAsset }
}
