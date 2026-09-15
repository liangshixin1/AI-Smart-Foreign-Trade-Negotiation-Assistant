/* [组件导读]
 * 业务名词：课程由章节和小节组成；小节是训练入口，一次实际作答会形成独立的 Attempt（训练记录）。
 * 用途：从当前路由读取小节详情与训练准备信息。
 * 为什么与边界：小节编号和实际训练编号不同，先获取小节约束再创建训练，避免在准备页自行推导后端规则。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
