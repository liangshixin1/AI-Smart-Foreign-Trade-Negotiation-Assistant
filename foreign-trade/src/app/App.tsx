import { ModuleCard } from '../components/ModuleCard'
import { StatusPanel } from '../components/StatusPanel'
import { platformModules } from '../features/platform/moduleCatalog'
import './app.css'

export default function App() {
  return (
    <main>
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="/modern/" aria-label="外贸谈判智能平台首页">
          <span className="brand-mark">N</span>
          <span>NEGOTIA <small>智能谈判平台</small></span>
        </a>
        <div className="nav-links">
          <a href="#architecture">架构模块</a>
          <a href="/">进入现有系统</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">MODERNIZATION FOUNDATION · 2026</span>
          <h1>让复杂业务，<br /><em>回归清晰边界。</em></h1>
          <p className="hero-intro">以 React + TypeScript 承载现代交互，以可测试的 Flask 应用内核编排业务能力。新旧系统并行运行，持续迁移，而不是冒险推倒重来。</p>
          <div className="hero-actions">
            <a className="primary-action" href="/">进入谈判训练 <span>→</span></a>
            <a className="text-action" href="#architecture">查看模块边界</a>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-core"><span>AI</span><small>NEGOTIATION<br />ENGINE</small></div>
          <span className="node node-one">KNOWLEDGE</span>
          <span className="node node-two">ASSESSMENT</span>
          <span className="node node-three">SCENARIO</span>
        </div>
      </section>

      <StatusPanel />

      <section className="architecture" id="architecture">
        <header>
          <span className="eyebrow">BOUNDED CONTEXTS</span>
          <h2>按业务能力拆分，而非按页面堆积</h2>
          <p>每个模块拥有自己的状态、接口适配与演进节奏，公共层只保留真正稳定的基础能力。</p>
        </header>
        <div className="module-grid">
          {platformModules.map((module, index) => <ModuleCard key={module.title} module={module} index={index} />)}
        </div>
      </section>

      <footer><span>NEGOTIA PLATFORM</span><p>渐进式现代化架构基线</p><span>REFACTOR / 01</span></footer>
    </main>
  )
}
