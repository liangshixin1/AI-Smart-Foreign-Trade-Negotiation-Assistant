import { describe, expect, it } from 'vitest'

import { buildGraphElements } from './graphElements'
import { panoramaLayout } from './panoramaLayout'
import type { KnowledgeGraphNode, KnowledgeGraphView } from './types'

const graph = buildGraph()

describe('panoramaLayout', () => {
  it('produces deterministic positions for every node on an open nine-stage process ring', () => {
    const first = panoramaLayout(graph)
    const second = panoramaLayout(graph)
    expect(first.positions).toEqual(second.positions)
    expect(first.positions.size).toBe(graph.nodes.length)
    const orderedAngles = graph.nodes
      .filter((node) => node.type === 'stage')
      .map((node) => first.stageAngles.get(node.id) ?? 0)
    expect(orderedAngles).toEqual([...orderedAngles].sort((left, right) => left - right))
    const firstAngle = orderedAngles[0]
    const lastAngle = orderedAngles.at(-1)
    if (firstAngle === undefined || lastAngle === undefined) throw new Error('缺少阶段角度')
    expect(lastAngle - firstAngle).toBeLessThan((320 * Math.PI) / 180)
  })

  it('places exclusive learning nodes outward and increasingly shared nodes inward', () => {
    const layout = panoramaLayout(graph)
    expect(
      normalizedRadius(positionFor(layout.positions, 'knowledge:exclusive'), 850, 650),
    ).toBeCloseTo(1)
    const sharedRadii = ['shared2', 'shared3', 'shared4', 'shared5'].map((id) =>
      distanceFromCenter(positionFor(layout.positions, `knowledge:${id}`)),
    )
    const [sharedTwo, sharedThree, sharedFour, sharedFive] = sharedRadii
    if (
      sharedTwo === undefined ||
      sharedThree === undefined ||
      sharedFour === undefined ||
      sharedFive === undefined
    ) {
      throw new Error('缺少共享知识节点半径')
    }
    expect(sharedTwo).toBeGreaterThan(sharedThree)
    expect(sharedThree).toBeGreaterThan(sharedFour)
    expect(sharedFour).toBeGreaterThan(sharedFive)
    expect(layout.servedStageCounts.get('knowledge:shared5')).toBe(5)
  })

  it('keeps same-tier shared knowledge on a tidy collision-free orbit', () => {
    const layout = panoramaLayout(graph)
    const ids = ['shared2', 'shared2b', 'shared2c']
    const positions = ids.map((id) => positionFor(layout.positions, `knowledge:${id}`))
    positions.forEach((position) => {
      expect(normalizedRadius(position, 520 * 0.72, 390 * 0.72)).toBeCloseTo(1)
    })
    const angles = positions.map(angleFromCenter).sort((left, right) => left - right)
    expect(angles[1] ?? 0).toBeGreaterThan((angles[0] ?? 0) + degreesForTest(6))
    expect(angles[2] ?? 0).toBeGreaterThan((angles[1] ?? 0) + degreesForTest(6))
  })

  it('adds only the eight forward process links in panorama mode', () => {
    const layout = panoramaLayout(graph)
    const elements = buildGraphElements(
      graph,
      ['stage', 'phenomenon', 'knowledge_point'],
      'panorama',
      layout.positions,
      graph,
    )
    const processEdges = elements.filter((element) => element.data.edgeType === 'STAGE_FLOW')
    expect(processEdges).toHaveLength(8)
    expect(processEdges.some((edge) => edge.data.source === 'stage:S9')).toBe(false)
  })
})

function buildGraph(): KnowledgeGraphView {
  const stages = Array.from({ length: 9 }, (_, index) => stage(index + 1))
  const phenomena = Array.from({ length: 9 }, (_, index) => phenomenon(index + 1))
  const knowledge = [
    knowledgeNode('exclusive', 'S1'),
    knowledgeNode('shared2', 'S1'),
    knowledgeNode('shared2b', 'S1'),
    knowledgeNode('shared2c', 'S1'),
    knowledgeNode('shared3', 'S1'),
    knowledgeNode('shared4', 'S1'),
    knowledgeNode('shared5', 'S1'),
  ]
  const edges = stages.map((item, index) => {
    const target = phenomena[index]
    if (!target) throw new Error(`缺少第 ${String(index + 1)} 个教学现象`)
    return {
      id: `stage-phenomenon-${String(index + 1)}`,
      source: item.id,
      target: target.id,
      type: 'CONTAINS_PHENOMENON',
      properties: {},
    }
  })
  edges.push(relation('phenomenon:P1', 'knowledge:exclusive'))
  for (let stageIndex = 1; stageIndex <= 5; stageIndex += 1) {
    if (stageIndex <= 2)
      edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared2'))
    if (stageIndex <= 2)
      edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared2b'))
    if (stageIndex <= 2)
      edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared2c'))
    if (stageIndex <= 3)
      edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared3'))
    if (stageIndex <= 4)
      edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared4'))
    edges.push(relation(`phenomenon:P${String(stageIndex)}`, 'knowledge:shared5'))
  }
  return {
    graph_version: 'panorama-layout-test',
    nodes: [...stages, ...phenomena, ...knowledge],
    edges,
    node_count: stages.length + phenomena.length + knowledge.length,
    edge_count: edges.length,
  }
}

function positionFor(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  nodeId: string,
): { x: number; y: number } {
  const position = positions.get(nodeId)
  if (!position) throw new Error(`缺少节点坐标：${nodeId}`)
  return position
}

function angleFromCenter(position: { x: number; y: number }): number {
  return Math.atan2((position.y - 800) / 390, (position.x - 1000) / 520)
}

function degreesForTest(value: number): number {
  return (value * Math.PI) / 180
}

function stage(sequence: number): KnowledgeGraphNode {
  return {
    id: `stage:S${String(sequence)}`,
    type: 'stage',
    source_type: 'Stage',
    label: `阶段${String(sequence)}`,
    short_label: `阶段${String(sequence)}`,
    properties: { StageID: `S${String(sequence)}`, Sequence: sequence },
  }
}

function phenomenon(sequence: number): KnowledgeGraphNode {
  return {
    id: `phenomenon:P${String(sequence)}`,
    type: 'phenomenon',
    source_type: 'Phenomenon',
    label: `现象${String(sequence)}`,
    short_label: `现象${String(sequence)}`,
    properties: { StageID: `S${String(sequence)}` },
  }
}

function knowledgeNode(id: string, homeStageId: string): KnowledgeGraphNode {
  return {
    id: `knowledge:${id}`,
    type: 'knowledge_point',
    source_type: 'KnowledgePoint',
    label: id,
    short_label: id,
    knowledge_type: 'Legal',
    properties: { HomeStageID: homeStageId },
  }
}

function relation(source: string, target: string) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'REQUIRES_KNOWLEDGE',
    properties: {},
  }
}

function distanceFromCenter(position: { x: number; y: number }): number {
  return Math.hypot(position.x - 1000, position.y - 800)
}

function normalizedRadius(
  position: { x: number; y: number },
  radiusX: number,
  radiusY: number,
): number {
  return Math.hypot((position.x - 1000) / radiusX, (position.y - 800) / radiusY)
}
