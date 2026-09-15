/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：计算单节点附近局部知识图的布局坐标。
 * 为什么与边界：局部关系数量较少，单独布局便于阅读邻接关系；布局不会改变业务边的方向或含义。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type { GraphPosition } from './graphPresentation'
import type { KnowledgeGraphNode, KnowledgeGraphView } from './types'

const COLUMN_X = {
  stage: 90,
  scenario: 105,
  phenomenon: 330,
  knowledge: 610,
}

/**
 * 训练、评价和学情页面使用稳定的分层布局，避免小画布再次退化为力导向“毛线团”。
 * Stage/Scenario 位于左侧，现象居中，知识与策略位于右侧。
 */
export function contextPositions(graph: KnowledgeGraphView): Map<string, GraphPosition> {
  const positions = new Map<string, GraphPosition>()
  const stages = graph.nodes.filter((node) => node.type === 'stage')
  const scenarios = graph.nodes.filter((node) => node.type === 'scenario')
  const phenomena = graph.nodes.filter((node) => node.type === 'phenomenon')
  const knowledge = graph.nodes.filter((node) => isKnowledge(node))

  placeColumn(positions, stages, COLUMN_X.stage, 95)
  placeColumn(positions, scenarios, COLUMN_X.scenario, stages.length ? 270 : 95)
  placeColumn(positions, phenomena, COLUMN_X.phenomenon, 82)
  placeColumn(positions, knowledge, COLUMN_X.knowledge, 58)
  return positions
}

function placeColumn(
  positions: Map<string, GraphPosition>,
  nodes: KnowledgeGraphNode[],
  x: number,
  gap: number,
): void {
  const height = Math.max(360, (nodes.length - 1) * gap + 80)
  const start = (720 - height) / 2 + 48
  nodes.forEach((node, index) => {
    const offset = nodes.length > 8 && index % 2 ? 24 : 0
    positions.set(node.id, { x: x + offset, y: start + index * gap })
  })
}

function isKnowledge(node: KnowledgeGraphNode): boolean {
  return ['knowledge_point', 'knowledge_resource', 'strategy'].includes(node.type)
}
