import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/auth'
import { curriculumApi } from '@/features/curriculum/api/curriculumApi'
import type { UnitDetail } from '@/features/curriculum/types'

export function useUnitDetail() {
  const route = useRoute()
  const auth = useAuthStore()
  const unit = ref<UnitDetail | null>(null)
  const loading = ref(true)
  const error = ref('')

  async function load(): Promise<void> {
    const unitId = typeof route.params.unitId === 'string' ? route.params.unitId : ''
    if (!auth.accessToken || !unitId) {
      error.value = '无法读取该小节。'
      loading.value = false
      return
    }
    try {
      unit.value = await curriculumApi.unit(unitId, auth.accessToken)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '小节加载失败。'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { unit, loading, error, reload: load }
}
