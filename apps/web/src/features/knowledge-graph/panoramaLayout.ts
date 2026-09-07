import { stageIdForNode, stageSequence, type GraphPosition } from './graphPresentation'
import type { KnowledgeGraphNode, KnowledgeGraphView } from './types'

const CENTER = { x: 1000, y: 800 }
const START_ANGLE = degrees(-70)
const ARC_LENGTH = degrees(320)
const MIN_STAGE_SPAN = degrees(24)
const KNOWLEDGE_TYPES = new Set(['knowledge_point', 'knowledge_resource', 'strategy'])

export interface PanoramaLayoutResult {
  positions: Map<string, GraphPosition>
  stageAngles: Map<string, number>
  stageSpans: Map<string, number>
  servedStageCounts: Map<string, number>
}

export function panoramaLayout(graph: KnowledgeGraphView): PanoramaLayoutResult {
  const positions = new Map<string, GraphPosition>()
  const stages = graph.nodes
    .filter((node) => node.type === 'stage')
    .sort((left, right) => stageSequence(left) - stageSequence(right))
  const stageByCode = new Map(stages.map((node) => [stageIdForNode(node) ?? node.id, node.id]))
  const phenomenonStage = phenomenonStageMap(graph, stageByCode)
  const knowledgePhenomena = knowledgePhenomenonMap(graph)
  const knowledgeStages = knowledgeStageMap(knowledgePhenomena, phenomenonStage)
  const exclusiveByStage = exclusiveKnowledgeByStage(graph, knowledgeStages)
  const stagePhenomena = groupedPhenomena(graph, phenomenonStage, stages)
  const stageSpans = allocateStageSpans(stages, stagePhenomena, exclusiveByStage)
  const stageAngles = allocateStageAngles(stages, stageSpans)

  stages.forEach((stage) => {
    const angle = stageAngles.get(stage.id) ?? 0
    positions.set(stage.id, pointOnEllipse(angle, 520, 390))
    positionStageSector(
      graph,
      stage,
      angle,
      stageSpans.get(stage.id) ?? degrees(32),
      stagePhenomena.get(stage.id) ?? [],
      exclusiveByStage.get(stage.id) ?? [],
      knowledgePhenomena,
      knowledgeStages,
      positions,
    )
  })

  positionSharedKnowledge(graph, knowledgeStages, stageAngles, positions)
  positionUnassigned(graph, positions)
  return {
    positions,
    stageAngles,
    stageSpans,
    servedStageCounts: new Map(
      [...knowledgeStages].map(([nodeId, stageIds]) => [nodeId, stageIds.size]),
    ),
  }
}

export function knowledgeStageMembership(graph: KnowledgeGraphView): Map<string, Set<string>> {
  const stages = graph.nodes.filter((node) => node.type === 'stage')
  const stageByCode = new Map(stages.map((node) => [stageIdForNode(node) ?? node.id, node.id]))
  return knowledgeStageMap(knowledgePhenomenonMap(graph), phenomenonStageMap(graph, stageByCode))
}

function positionStageSector(
  graph: KnowledgeGraphView,
  stage: KnowledgeGraphNode,
  stageAngle: number,
  stageSpan: number,
  phenomena: KnowledgeGraphNode[],
  exclusiveKnowledge: KnowledgeGraphNode[],
  knowledgePhenomena: Map<string, Set<string>>,
  knowledgeStages: Map<string, Set<string>>,
  positions: Map<string, GraphPosition>,
): void {
  const phenomenonIds = new Set(phenomena.map((node) => node.id))
  const owned = assignExclusiveKnowledge(exclusiveKnowledge, phenomenonIds, knowledgePhenomena)
  const weights = phenomena.map((phenomenon) => {
    const ownedCount = owned.get(phenomenon.id)?.length ?? 0
    const sharedCount = linkedKnowledgeIds(phenomenon.id, knowledgePhenomena).filter(
      (id) => (knowledgeStages.get(id)?.size ?? 0) > 1,
    ).length
    return 1 + ownedCount * 0.55 + sharedCount * 0.15
  })
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1
  const usableSpan = stageSpan * 0.88
  let cursor = stageAngle - usableSpan / 2

  phenomena.forEach((phenomenon, index) => {
    const wedge = (usableSpan * (weights[index] ?? 1)) / totalWeight
    const angle = cursor + wedge / 2
    positions.set(phenomenon.id, pointOnEllipse(angle, 700, 525))
    positionExclusiveKnowledge(owned.get(phenomenon.id) ?? [], cursor, wedge, positions)
    cursor += wedge
  })

  const scenarios = graph.nodes
    .filter((node) => node.type === 'scenario' && nodeStageId(node, graph) === stage.id)
    .sort(compareNodes)
  scenarios.forEach((scenario, index) => {
    const angle = spreadAngle(stageAngle, stageSpan * 0.7, index, scenarios.length)
    positions.set(scenario.id, pointOnEllipse(angle, 610, 455))
  })
}

function positionExclusiveKnowledge(
  nodes: KnowledgeGraphNode[],
  wedgeStart: number,
  wedgeSpan: number,
  positions: Map<string, GraphPosition>,
): void {
  const slots = Math.max(1, Math.ceil(nodes.length / 2))
  nodes.sort(compareNodes).forEach((node, index) => {
    const lane = index % 2
    const slot = Math.floor(index / 2)
    const angle = wedgeStart + wedgeSpan * ((slot + 0.5) / slots)
    positions.set(node.id, pointOnEllipse(angle, lane === 0 ? 850 : 955, lane === 0 ? 650 : 735))
  })
}

function positionSharedKnowledge(
  graph: KnowledgeGraphView,
  knowledgeStages: Map<string, Set<string>>,
  stageAngles: Map<string, number>,
  positions: Map<string, GraphPosition>,
): void {
  const tiers = new Map<number, Array<{ node: KnowledgeGraphNode; anchor: number }>>()
  graph.nodes.filter(isKnowledgeNode).forEach((node) => {
    const served = knowledgeStages.get(node.id) ?? new Set<string>()
    if (served.size < 2) return
    const anchor = normalizeToProcessArc(
      circularMean([...served].map((id) => stageAngles.get(id) ?? 0)),
    )
    const tier = tiers.get(served.size) ?? []
    tier.push({ node, anchor })
    tiers.set(served.size, tier)
  })

  tiers.forEach((items, stageCount) => {
    const ordered = items.sort(
      (left, right) => left.anchor - right.anchor || compareNodes(left.node, right.node),
    )
    const angles = spreadAnchoredAngles(
      ordered.map((item) => item.anchor),
      sharedMinimumGap(stageCount),
    )
    const factor = sharedRadiusFactor(stageCount)
    ordered.forEach((item, index) => {
      positions.set(
        item.node.id,
        pointOnEllipse(angles[index] ?? item.anchor, 520 * factor, 390 * factor),
      )
    })
  })
}

function allocateStageSpans(
  stages: KnowledgeGraphNode[],
  stagePhenomena: Map<string, KnowledgeGraphNode[]>,
  exclusiveByStage: Map<string, KnowledgeGraphNode[]>,
): Map<string, number> {
  const loads = stages.map(
    (stage) =>
      (stagePhenomena.get(stage.id)?.length ?? 0) +
      (exclusiveByStage.get(stage.id)?.length ?? 0) * 0.7,
  )
  const flexibleArc = Math.max(0, ARC_LENGTH - MIN_STAGE_SPAN * stages.length)
  const totalLoad = loads.reduce((sum, value) => sum + value, 0) || stages.length
  return new Map(
    stages.map((stage, index) => [
      stage.id,
      MIN_STAGE_SPAN + flexibleArc * ((loads[index] ?? 1) / totalLoad),
    ]),
  )
}

function allocateStageAngles(
  stages: KnowledgeGraphNode[],
  spans: Map<string, number>,
): Map<string, number> {
  let cursor = START_ANGLE
  return new Map(
    stages.map((stage) => {
      const span = spans.get(stage.id) ?? ARC_LENGTH / Math.max(stages.length, 1)
      const pair: [string, number] = [stage.id, cursor + span / 2]
      cursor += span
      return pair
    }),
  )
}

function phenomenonStageMap(
  graph: KnowledgeGraphView,
  stageByCode: Map<string, string>,
): Map<string, string> {
  const result = new Map<string, string>()
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const stageNodeIds = new Set(stageByCode.values())
  graph.nodes
    .filter((node) => node.type === 'phenomenon')
    .forEach((node) => {
      const code = stageIdForNode(node)
      const stageId = code ? stageByCode.get(code) : undefined
      if (stageId) result.set(node.id, stageId)
    })
  graph.edges.forEach((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (stageNodeIds.has(edge.source) && target?.type === 'phenomenon' && !result.has(target.id)) {
      result.set(target.id, edge.source)
    }
    if (stageNodeIds.has(edge.target) && source?.type === 'phenomenon' && !result.has(source.id)) {
      result.set(source.id, edge.target)
    }
  })
  return result
}

function knowledgePhenomenonMap(graph: KnowledgeGraphView): Map<string, Set<string>> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const result = new Map<string, Set<string>>()
  graph.edges.forEach((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    const knowledge =
      source && isKnowledgeNode(source) ? source : target && isKnowledgeNode(target) ? target : null
    const phenomenon =
      source?.type === 'phenomenon' ? source : target?.type === 'phenomenon' ? target : null
    if (!knowledge || !phenomenon) return
    const ids = result.get(knowledge.id) ?? new Set<string>()
    ids.add(phenomenon.id)
    result.set(knowledge.id, ids)
  })
  return result
}

function knowledgeStageMap(
  knowledgePhenomena: Map<string, Set<string>>,
  phenomenonStage: Map<string, string>,
): Map<string, Set<string>> {
  return new Map(
    [...knowledgePhenomena].map(([knowledgeId, phenomenonIds]) => [
      knowledgeId,
      new Set([...phenomenonIds].map((id) => phenomenonStage.get(id)).filter(isString)),
    ]),
  )
}

function groupedPhenomena(
  graph: KnowledgeGraphView,
  phenomenonStage: Map<string, string>,
  stages: KnowledgeGraphNode[],
): Map<string, KnowledgeGraphNode[]> {
  return new Map(
    stages.map((stage) => [
      stage.id,
      graph.nodes
        .filter((node) => node.type === 'phenomenon' && phenomenonStage.get(node.id) === stage.id)
        .sort(compareNodes),
    ]),
  )
}

function exclusiveKnowledgeByStage(
  graph: KnowledgeGraphView,
  membership: Map<string, Set<string>>,
): Map<string, KnowledgeGraphNode[]> {
  const result = new Map<string, KnowledgeGraphNode[]>()
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  membership.forEach((stageIds, nodeId) => {
    if (stageIds.size !== 1) return
    const stageId = [...stageIds][0]
    const node = byId.get(nodeId)
    if (!stageId || !node) return
    const list = result.get(stageId) ?? []
    list.push(node)
    result.set(stageId, list)
  })
  return result
}

function assignExclusiveKnowledge(
  nodes: KnowledgeGraphNode[],
  phenomenonIds: Set<string>,
  knowledgePhenomena: Map<string, Set<string>>,
): Map<string, KnowledgeGraphNode[]> {
  const result = new Map<string, KnowledgeGraphNode[]>()
  nodes.sort(compareNodes).forEach((node) => {
    const candidates = [...(knowledgePhenomena.get(node.id) ?? [])]
      .filter((id) => phenomenonIds.has(id))
      .sort(
        (left, right) =>
          (result.get(left)?.length ?? 0) - (result.get(right)?.length ?? 0) ||
          left.localeCompare(right),
      )
    const owner = candidates[0]
    if (!owner) return
    const list = result.get(owner) ?? []
    list.push(node)
    result.set(owner, list)
  })
  return result
}

function linkedKnowledgeIds(
  phenomenonId: string,
  knowledgePhenomena: Map<string, Set<string>>,
): string[] {
  return [...knowledgePhenomena]
    .filter(([, phenomena]) => phenomena.has(phenomenonId))
    .map(([knowledgeId]) => knowledgeId)
}

function nodeStageId(node: KnowledgeGraphNode, graph: KnowledgeGraphView): string | null {
  const stageCode = stageIdForNode(node)
  if (!stageCode) return null
  return (
    graph.nodes.find(
      (candidate) => candidate.type === 'stage' && stageIdForNode(candidate) === stageCode,
    )?.id ?? null
  )
}

function positionUnassigned(
  graph: KnowledgeGraphView,
  positions: Map<string, GraphPosition>,
): void {
  const remaining = graph.nodes.filter((node) => !positions.has(node.id)).sort(compareNodes)
  remaining.forEach((node, index) => {
    const angle = (index / Math.max(remaining.length, 1)) * Math.PI * 2
    const radius = 90 + Math.floor(index / 12) * 35
    positions.set(node.id, {
      x: CENTER.x + Math.cos(angle) * radius,
      y: CENTER.y + Math.sin(angle) * radius,
    })
  })
}

function sharedRadiusFactor(stageCount: number): number {
  if (stageCount >= 5) return 0.18
  if (stageCount === 4) return 0.34
  if (stageCount === 3) return 0.52
  return 0.72
}

function sharedMinimumGap(stageCount: number): number {
  if (stageCount >= 4) return degrees(12)
  if (stageCount === 3) return degrees(10)
  return degrees(6.8)
}

/**
 * 共享知识仍以关联阶段的几何重心为锚点，但在同一轨道内保留最小角距。
 * 这样既保留“靠近哪些阶段”的教学含义，也不会聚成难以辨认的节点团。
 */
function spreadAnchoredAngles(anchors: number[], requestedGap: number): number[] {
  if (anchors.length < 2) return [...anchors]
  const padding = degrees(4)
  const lower = START_ANGLE + padding
  const upper = START_ANGLE + ARC_LENGTH - padding
  const gap = Math.min(requestedGap, (upper - lower) / (anchors.length - 1))
  const placed = anchors.map((angle) => Math.min(upper, Math.max(lower, angle)))

  for (let index = 1; index < placed.length; index += 1) {
    const previous = placed[index - 1]
    const current = placed[index]
    if (previous === undefined || current === undefined) continue
    placed[index] = Math.max(current, previous + gap)
  }

  const averageDrift =
    placed.reduce((sum, angle, index) => sum + angle - (anchors[index] ?? angle), 0) / placed.length
  const centeredShift = Math.min(Math.max(averageDrift, 0), (placed[0] ?? lower) - lower)
  for (let index = 0; index < placed.length; index += 1) {
    placed[index] = (placed[index] ?? lower) - centeredShift
  }

  const overflow = Math.max(0, (placed.at(-1) ?? upper) - upper)
  if (overflow > 0) {
    for (let index = 0; index < placed.length; index += 1) {
      placed[index] = (placed[index] ?? lower) - overflow
    }
  }
  return placed
}

function normalizeToProcessArc(angle: number): number {
  const arcMiddle = START_ANGLE + ARC_LENGTH / 2
  let normalized = angle
  while (normalized - arcMiddle > Math.PI) normalized -= Math.PI * 2
  while (arcMiddle - normalized > Math.PI) normalized += Math.PI * 2
  return normalized
}

function pointOnEllipse(angle: number, radiusX: number, radiusY: number): GraphPosition {
  return { x: CENTER.x + Math.cos(angle) * radiusX, y: CENTER.y + Math.sin(angle) * radiusY }
}

function spreadAngle(center: number, span: number, index: number, count: number): number {
  return center - span / 2 + span * ((index + 0.5) / Math.max(count, 1))
}

function circularMean(angles: number[]): number {
  const vector = angles.reduce(
    (sum, angle) => ({ x: sum.x + Math.cos(angle), y: sum.y + Math.sin(angle) }),
    { x: 0, y: 0 },
  )
  return Math.atan2(vector.y, vector.x)
}

function compareNodes(left: KnowledgeGraphNode, right: KnowledgeGraphNode): number {
  return left.id.localeCompare(right.id, 'zh-CN', { numeric: true })
}

function isKnowledgeNode(node: KnowledgeGraphNode): boolean {
  return KNOWLEDGE_TYPES.has(node.type)
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string'
}

function degrees(value: number): number {
  return (value * Math.PI) / 180
}
