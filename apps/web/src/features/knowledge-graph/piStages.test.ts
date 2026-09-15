import { describe, expect, it } from 'vitest'
import { buildGraphElements } from './graphElements'
import { stageSequence, teachingPositions } from './graphPresentation'
import { panoramaLayout } from './panoramaLayout'
import type { KnowledgeGraphNode, KnowledgeGraphView } from './types'

describe('PI ten-stage layout', () => {
  const nodes = Array.from({ length: 10 }, (_, i) => ({
    id: `stage:S${String(i + 1)}`,
    type: 'stage',
    source_type: 'Stage',
    label: `阶段${String(i + 1)}`,
    short_label: `阶段${String(i + 1)}`,
    properties: { StageID: `S${String(i + 1)}`, Seq: i + 1 },
  })) as KnowledgeGraphNode[]
  const graph = {
    nodes: [...nodes].reverse(),
    edges: [],
    node_count: 10,
    edge_count: 0,
    graph_version: 'pi-3.1',
  } as KnowledgeGraphView

  it('does not place S10 on an existing teaching stage', () => {
    const positions = teachingPositions(graph)
    expect(new Set([...positions.values()].map((p) => `${String(p.x)},${String(p.y)}`)).size).toBe(
      10,
    )
    expect(positions.get('stage:S10')).toEqual({ x: 1600, y: 1740 })
  })

  it('sorts S10 numerically and produces nine forward process links', () => {
    const layout = panoramaLayout(graph)
    const ordered = [...nodes].sort((a, b) => stageSequence(a) - stageSequence(b))
    const angles = ordered.map((n) => layout.stageAngles.get(n.id))
    expect(angles).toEqual([...angles].sort((a, b) => (a ?? 0) - (b ?? 0)))
    const elements = buildGraphElements(graph, ['stage'], 'panorama', layout.positions, graph)
    const links = elements.filter((e) => e.data.edgeType === 'STAGE_FLOW')
    expect(links).toHaveLength(9)
    expect(links.some((e) => e.data.source === 'stage:S9' && e.data.target === 'stage:S10')).toBe(
      true,
    )
    expect(links.some((e) => e.data.source === 'stage:S10')).toBe(false)
  })
})
