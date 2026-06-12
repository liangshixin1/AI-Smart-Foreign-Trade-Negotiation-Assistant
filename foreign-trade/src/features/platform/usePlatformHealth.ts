import { useEffect, useState } from 'react'
import { fetchPlatformHealth, type PlatformHealth } from '../../services/platform'

interface HealthState {
  data: PlatformHealth | null
  loading: boolean
  error: string | null
}

/** 将请求生命周期封装在功能模块中，页面只负责展示状态。 */
export function usePlatformHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ data: null, loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    fetchPlatformHealth(controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ data: null, loading: false, error: error instanceof Error ? error.message : '未知错误' })
      })
    return () => controller.abort()
  }, [])

  return state
}
