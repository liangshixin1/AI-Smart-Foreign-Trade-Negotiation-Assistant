/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：统一节点归属阶段、显示标签及视图模式等呈现规则。
 * 为什么与边界：将不同图谱版本的显示兼容集中处理，避免画布和目录对同一节点给出不同归属。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type { KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeGraphView } from './types'

export type GraphViewMode = 'teaching' | 'panorama' | 'context'

export interface GraphPosition {
  x: number
  y: number
}

export function relationshipLabel(type: string): string {
  return (
    {
      INVOLVES: '涉及',
      CONTAINS_SCENARIO: '训练场景',
      CONTAINS_PHENOMENON: '教学现象',
      REQUIRES_KNOWLEDGE: '需要知识',
      HANDLED_BY: '可用策略',
      EXPOSES: '呈现',
      ADDRESSES: '应对',
      SUPPORTS: '支持',
      STAGE_FLOW: '教学流程',
    }[type] ?? type
  )
}

function stageGridPosition(index: number): GraphPosition {
  const row = Math.floor(index / 3)
  const column = row % 2 === 0 ? index % 3 : 2 - (index % 3)
  return { x: 360 + column * 620, y: 270 + row * 490 }
}

export function stageIdForNode(node: KnowledgeGraphNode): string | null {
  if (node.type === 'stage') {
    const value = node.properties.StageID
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
    return node.id.split(':').at(-1) ?? node.id
  }
  const value = node.properties.StageID ?? node.properties.HomeStageID
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function stageSequence(node: KnowledgeGraphNode): number {
  const raw = node.properties.Sequence ?? node.properties.Seq
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  const match = stageIdForNode(node)?.match(/\d+/)
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER
}

export function stageNodeIdByCode(graph: KnowledgeGraphView): Map<string, string> {
  return new Map(
    graph.nodes
      .filter((node) => node.type === 'stage')
      .map((node) => [stageIdForNode(node) ?? node.id, node.id]),
  )
}

export function nodeStageAssignments(graph: KnowledgeGraphView): Map<string, string> {
  const stageNodes = stageNodeIdByCode(graph)
  const assignments = new Map<string, string>()
  const phenomenonStages = new Map<string, string>()

  graph.nodes.forEach((node) => {
    const stageCode = stageIdForNode(node)
    const stageNodeId = stageCode ? stageNodes.get(stageCode) : undefined
    if (stageNodeId) assignments.set(node.id, stageNodeId)
    if (node.type === 'phenomenon' && stageNodeId) phenomenonStages.set(node.id, stageNodeId)
  })

  // 聚焦单个主题时，共享知识点可能归属其他主题。此处仅为视觉分组寻找当前可见现象，
  // 不修改知识点在 Neo4j 中的 HomeStageID。
  graph.edges.forEach((edge) => {
    const phenomenonId = phenomenonStages.has(edge.source)
      ? edge.source
      : phenomenonStages.has(edge.target)
        ? edge.target
        : null
    if (!phenomenonId) return
    const otherId = phenomenonId === edge.source ? edge.target : edge.source
    if (!assignments.has(otherId)) {
      const stageNodeId = phenomenonStages.get(phenomenonId)
      if (stageNodeId) assignments.set(otherId, stageNodeId)
    }
  })
  return assignments
}

export function isCrossStageEdge(
  edge: KnowledgeGraphEdge,
  assignments: Map<string, string>,
): boolean {
  const sourceStage = assignments.get(edge.source)
  const targetStage = assignments.get(edge.target)
  return Boolean(sourceStage && targetStage && sourceStage !== targetStage)
}

export function teachingPositions(graph: KnowledgeGraphView): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>()
  const assignments = nodeStageAssignments(graph)
  const stages = graph.nodes
    .filter((node) => node.type === 'stage')
    .sort((left, right) => stageSequence(left) - stageSequence(right))
  const focused = stages.length === 1

  stages.forEach((stage, stageIndex) => {
    const center = focused ? { x: 600, y: 430 } : stageGridPosition(stageIndex)
    positions.set(stage.id, center)
    const children = graph.nodes.filter(
      (node) => node.id !== stage.id && assignments.get(node.id) === stage.id,
    )
    const scenarios = children.filter((node) => node.type === 'scenario')
    const phenomena = children.filter((node) => node.type === 'phenomenon')
    const knowledge = children.filter(
      (node) => node.type !== 'scenario' && node.type !== 'phenomenon',
    )

    scenarios.forEach((node, index) => {
      positions.set(node.id, {
        x: center.x - (focused ? 120 : 80) + index * (focused ? 240 : 160),
        y: center.y - (focused ? 225 : 175),
      })
    })
    phenomena.forEach((node, index) => {
      positions.set(node.id, {
        x: center.x - (focused ? 300 : 205) + (index % 2) * (focused ? 140 : 110),
        y: center.y - (focused ? 145 : 105) + Math.floor(index / 2) * (focused ? 98 : 78),
      })
    })
    knowledge.forEach((node, index) => {
      positions.set(node.id, {
        x: center.x + (focused ? -15 : 35) + (index % 4) * (focused ? 92 : 76),
        y: center.y - (focused ? 155 : 118) + Math.floor(index / 4) * (focused ? 76 : 60),
      })
    })
  })

  const unassigned = graph.nodes.filter((node) => node.type !== 'stage' && !positions.has(node.id))
  unassigned.forEach((node, index) => {
    const angle = (index / Math.max(unassigned.length, 1)) * Math.PI * 2
    positions.set(node.id, {
      x: 980 + Math.cos(angle) * 760,
      y: 760 + Math.sin(angle) * 640,
    })
  })
  return positions
}

export function connectedNodeIds(graph: KnowledgeGraphView, nodeId: string): Set<string> {
  const ids = new Set<string>([nodeId])
  graph.edges.forEach((edge) => {
    if (edge.source === nodeId) ids.add(edge.target)
    if (edge.target === nodeId) ids.add(edge.source)
  })
  return ids
}
