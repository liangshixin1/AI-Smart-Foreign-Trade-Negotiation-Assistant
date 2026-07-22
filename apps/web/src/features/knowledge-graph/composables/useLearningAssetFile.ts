import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'

import { knowledgeGraphLearningApi } from '../api/knowledgeGraphLearningApi'

export function useLearningAssetFile(
  nodeId: string,
  kind: 'video' | 'slides',
  audience: 'student' | 'teacher',
) {
  const auth = useAuthStore()
  const blob = ref<Blob | null>(null)
  const arrayBuffer = ref<ArrayBuffer | null>(null)
  const objectUrl = ref<string | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  function release(): void {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
    blob.value = null
    arrayBuffer.value = null
  }

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = null
    release()
    try {
      const result =
        audience === 'student'
          ? await knowledgeGraphLearningApi.studentAsset(auth.accessToken, nodeId, kind)
          : await knowledgeGraphLearningApi.teacherAsset(auth.accessToken, nodeId, kind)
      blob.value = result.blob
      if (kind === 'slides') arrayBuffer.value = await result.blob.arrayBuffer()
      objectUrl.value = URL.createObjectURL(result.blob)
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : '教学资源加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  onBeforeUnmount(release)
  return { blob, arrayBuffer, objectUrl, loading, error, reload: load }
}
