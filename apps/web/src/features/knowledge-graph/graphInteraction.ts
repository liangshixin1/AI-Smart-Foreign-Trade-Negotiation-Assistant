import type { Core, NodeSingular } from 'cytoscape'

import type { KnowledgeGraphNode, KnowledgeGraphView } from './types'

export interface RenderedPoint {
  x: number
  y: number
}

export function progressiveFocusNodeIds(graph: KnowledgeGraphView, seedId: string): Set<string> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const seed = byId.get(seedId)
  if (!seed) return new Set()
  const selected = new Set<string>([seedId])
  if (seed.type === 'stage') {
    addLinkedGraphNodes(graph, byId, new Set([seedId]), new Set(['phenomenon']), selected)
    return selected
  }
  if (seed.type === 'phenomenon') {
    addLinkedGraphNodes(graph, byId, new Set([seedId]), new Set(['stage']), selected)
    addLinkedGraphNodes(
      graph,
      byId,
      new Set([seedId]),
      new Set(['knowledge_point', 'knowledge_resource', 'strategy']),
      selected,
    )
    return selected
  }
  if (isKnowledgeNode(seed)) {
    const phenomena = new Set<string>()
    addLinkedGraphNodes(graph, byId, new Set([seedId]), new Set(['phenomenon']), phenomena)
    phenomena.forEach((id) => selected.add(id))
    addLinkedGraphNodes(graph, byId, phenomena, new Set(['stage']), selected)
    return selected
  }
  graph.edges.forEach((edge) => {
    if (edge.source === seedId) selected.add(edge.target)
    if (edge.target === seedId) selected.add(edge.source)
  })
  return selected
}

export function nearestInteractiveNode(
  core: Core,
  mode: 'teaching' | 'panorama' | 'context',
  renderedPosition: RenderedPoint,
  minimumRadius = 18,
  permittedIds?: Set<string>,
): NodeSingular | null {
  let nearest: NodeSingular | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  core
    .nodes()
    .filter(
      (node) =>
        (mode === 'panorama' || node.data('nodeType') !== 'stage') &&
        (!permittedIds || permittedIds.has(node.id())),
    )
    .forEach((node) => {
      const position = node.renderedPosition()
      const distance = Math.hypot(renderedPosition.x - position.x, renderedPosition.y - position.y)
      const nodeRadius = Math.max(node.renderedWidth(), node.renderedHeight()) / 2 + 6
      if (distance <= Math.max(minimumRadius, nodeRadius) && distance < nearestDistance) {
        nearest = node
        nearestDistance = distance
      }
    })
  return nearest
}

export function shouldActivateImmediately(
  graph: KnowledgeGraphView,
  currentNodeId: string | null,
  candidateNodeId: string,
): boolean {
  if (!currentNodeId || currentNodeId === candidateNodeId) return true
  return progressiveFocusNodeIds(graph, currentNodeId).has(candidateNodeId)
}

export function withinFocusCorridor(
  core: Core,
  graph: KnowledgeGraphView,
  seedId: string,
  position: RenderedPoint,
): boolean {
  const focusedIds = progressiveFocusNodeIds(graph, seedId)
  const nearNode = core
    .nodes()
    .toArray()
    .some((node) => {
      if (!focusedIds.has(node.id())) return false
      const rendered = node.renderedPosition()
      return Math.hypot(position.x - rendered.x, position.y - rendered.y) <= 46
    })
  if (nearNode) return true
  return core
    .edges()
    .toArray()
    .some((edge) => {
      if (
        !focusedIds.has(edge.source().id()) ||
        !focusedIds.has(edge.target().id()) ||
        edge.data('edgeType') === 'STAGE_FLOW'
      ) {
        return false
      }
      return (
        pointToSegmentDistance(
          position,
          edge.source().renderedPosition(),
          edge.target().renderedPosition(),
        ) <= 20
      )
    })
}

export function pointToSegmentDistance(
  point: RenderedPoint,
  start: RenderedPoint,
  end: RenderedPoint,
): number {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared),
  )
  return Math.hypot(point.x - (start.x + ratio * deltaX), point.y - (start.y + ratio * deltaY))
}

function addLinkedGraphNodes(
  graph: KnowledgeGraphView,
  byId: Map<string, KnowledgeGraphNode>,
  sourceIds: Set<string>,
  targetTypes: Set<string>,
  destination: Set<string>,
): void {
  graph.edges.forEach((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) return
    if (sourceIds.has(source.id) && targetTypes.has(target.type)) destination.add(target.id)
    if (sourceIds.has(target.id) && targetTypes.has(source.type)) destination.add(source.id)
  })
}

function isKnowledgeNode(node: KnowledgeGraphNode): boolean {
  return ['knowledge_point', 'knowledge_resource', 'strategy'].includes(node.type)
}
