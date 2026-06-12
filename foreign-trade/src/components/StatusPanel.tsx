import { usePlatformHealth } from '../features/platform/usePlatformHealth'

export function StatusPanel() {
  const { data, loading, error } = usePlatformHealth()
  const healthy = data?.status === 'ok'

  return (
    <section className="status-panel" aria-live="polite">
      <div className={`status-indicator ${healthy ? 'is-ready' : ''}`} />
      <div>
        <span className="status-label">SYSTEM STATUS</span>
        <strong>{loading ? '正在连接应用内核…' : error ? '开发服务独立运行' : healthy ? '核心服务运行正常' : '部分能力降级'}</strong>
        <p>{error ?? (data ? `${data.environment} · ${Object.keys(data.checks).length} 项启动检查` : '正在读取健康状态')}</p>
      </div>
    </section>
  )
}
