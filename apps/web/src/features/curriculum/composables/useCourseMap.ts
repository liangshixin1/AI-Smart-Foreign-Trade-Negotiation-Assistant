/* [组件导读]
 * 业务名词：课程由章节和小节组成；小节是训练入口，一次实际作答会形成独立的 Attempt（训练记录）。
 * 用途：读取当前学生的课程路线并暴露加载与失败状态。
 * 为什么与边界：课程完成状态来自服务端版本与进度关联，前端只负责读取和触发重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { onMounted, ref } from 'vue'

import { curriculumApi } from '@/features/curriculum/api/curriculumApi'
import type { CourseMap } from '@/features/curriculum/types'
import { useAuthStore } from '@/features/auth/stores/auth'

export function useCourseMap() {
  const auth = useAuthStore()
  const data = ref<CourseMap | null>(null)
  const loading = ref(true)
  const error = ref('')

  async function load(): Promise<void> {
    if (!auth.accessToken) return
    loading.value = true
    error.value = ''
    try {
      data.value = await curriculumApi.map(auth.accessToken)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '课程路线加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { data, loading, error, reload: load }
}
