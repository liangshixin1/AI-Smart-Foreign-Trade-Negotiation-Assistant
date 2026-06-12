import type { PlatformModule } from '../features/platform/moduleCatalog'

export function ModuleCard({ module, index }: { module: PlatformModule; index: number }) {
  return (
    <article className={`module-card accent-${module.accent}`}>
      <div className="module-number">0{index + 1}</div>
      <span className="eyebrow">{module.eyebrow}</span>
      <h2>{module.title}</h2>
      <p>{module.description}</p>
      <ul>
        {module.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
      </ul>
    </article>
  )
}
