import { onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'
import type { LearningContent, LearningContentInput } from '../types'

export function useStudentLearningContent(nodeId: string) {
  const auth = useAuthStore()
  const content = ref<LearningContent | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    try {
      content.value = await knowledgeGraphLearningApi.studentContent(auth.accessToken, nodeId)
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : '学习内容加载失败。'
    } finally {
      loading.value = false
    }
  }
  onMounted(load)
  return { content, loading, error, reload: load }
}

export function useTeacherLearningContent(nodeId: string) {
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

  function apply(value: LearningContent): void {
    content.value = value
    Object.assign(form, {
      title: value.title,
      summary: value.summary,
      markdown_body: value.markdown_body,
      status: value.status,
    })
  }
  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    message.value = null
    try {
      apply(await knowledgeGraphLearningApi.teacherContent(auth.accessToken, nodeId))
    } catch (cause: unknown) {
      message.value = cause instanceof Error ? cause.message : '教学内容加载失败。'
    } finally {
      loading.value = false
    }
  }
  async function save(): Promise<void> {
    if (!auth.accessToken) return
    saving.value = true
    message.value = null
    try {
      apply(await knowledgeGraphLearningApi.updateTeacherContent(auth.accessToken, nodeId, form))
      message.value = form.status === 'published' ? '内容已保存并发布。' : '草稿已保存。'
    } catch (cause: unknown) {
      message.value = cause instanceof Error ? cause.message : '教学内容保存失败。'
    } finally {
      saving.value = false
    }
  }
  async function uploadAsset(kind: 'video' | 'slides', file: File): Promise<void> {
    if (!auth.accessToken) return
    saving.value = true
    message.value = null
    try {
      apply(
        await knowledgeGraphLearningApi.uploadTeacherAsset(auth.accessToken, nodeId, kind, file),
      )
      message.value = kind === 'video' ? '讲解视频上传成功。' : '教学 PPTX 上传成功。'
    } catch (cause: unknown) {
      message.value = cause instanceof Error ? cause.message : '教学资源上传失败。'
    } finally {
      saving.value = false
    }
  }
  async function deleteAsset(kind: 'video' | 'slides'): Promise<void> {
    if (!auth.accessToken) return
    saving.value = true
    message.value = null
    try {
      apply(await knowledgeGraphLearningApi.deleteTeacherAsset(auth.accessToken, nodeId, kind))
      message.value = kind === 'video' ? '讲解视频已删除。' : '教学 PPTX 已删除。'
    } catch (cause: unknown) {
      message.value = cause instanceof Error ? cause.message : '教学资源删除失败。'
    } finally {
      saving.value = false
    }
  }
  onMounted(load)
  return { content, form, loading, saving, message, reload: load, save, uploadAsset, deleteAsset }
}
