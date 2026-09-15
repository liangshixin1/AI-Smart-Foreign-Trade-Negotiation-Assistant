/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：带身份读取视频或幻灯片，并提供 Blob、二进制数据及临时对象地址。
 * 为什么与边界：受控附件不能直接当公开地址加载；临时 URL 在重新读取与卸载时撤销。nodeId 在调用时固定，复用组件切节点需检查外层是否重建实例。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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

  // [导读] 撤销旧对象 URL 并清理二进制引用，防止重复加载媒体积累浏览器内存。
  function release(): void {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
    blob.value = null
    arrayBuffer.value = null
  }

  // [导读] 先释放旧文件，再按角色调用受控下载；PPTX 另转 ArrayBuffer，视频使用临时 URL。
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
