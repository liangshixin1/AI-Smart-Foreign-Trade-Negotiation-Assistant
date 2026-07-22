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
