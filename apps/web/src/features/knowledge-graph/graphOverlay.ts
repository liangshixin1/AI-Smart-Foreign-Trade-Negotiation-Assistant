import type { RoundEvaluation } from '@/features/training/types'
import type { GraphLearningEvidence } from '@/features/teacher-dashboard/api/teacherApi'

import type {
  AttemptScaffold,
  KnowledgeGraphNode,
  KnowledgeGraphView,
  KnowledgeInsights,
} from './types'

export type GraphLearningState = 'unobserved' | 'encountered' | 'developing' | 'stable' | 'review'
export type GraphEmphasis = 'baseline' | 'current_round' | 'history' | 'selected'
export type GraphOverlayAudience = 'student' | 'teacher'
export type GraphDisplayPhase = 'briefing' | 'compass' | 'replay' | 'profile' | 'teacher'
export type GraphApplicationState =
  | 'unknown'
  | 'applied_correctly'
  | 'applied_partially'
  | 'misapplied'
  | 'recalled_unused'
  | 'missed_required'
  | 'recommended_next'

export interface GraphVisualNodeOverlay {
  node_id: string
  learning_state: GraphLearningState
  emphasis: GraphEmphasis
  score?: number | null
  evidence_count: number
  affected_student_count?: number
  recommendation_count?: number
  learning_completion_count?: number
  application_state?: GraphApplicationState
}

export interface GraphVisualEdgeOverlay {
  edge_id: string
  emphasis: GraphEmphasis
}

export interface GraphVisualOverlay {
  audience: GraphOverlayAudience
  phase?: GraphDisplayPhase
  revision: string
  nodes: GraphVisualNodeOverlay[]
  edges: GraphVisualEdgeOverlay[]
}

export { briefingOverlay, liveCompassOverlay, sessionReplayOverlay } from './graphPhaseOverlay'

export function graphFromScaffold(scaffold: AttemptScaffold): KnowledgeGraphView {
  const nodes = uniqueNodes([
    ...(scaffold.scenario ? [scaffold.scenario] : []),
    ...scaffold.phenomena,
    ...scaffold.knowledge_points,
  ])
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = scaffold.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )
  return {
    graph_version: scaffold.graph_version,
    nodes,
    edges,
    node_count: nodes.length,
    edge_count: edges.length,
  }
}

export function attemptRoundOverlay(
  scaffold: AttemptScaffold,
  evaluations: RoundEvaluation[],
  activeRoundIndex = evaluations.length - 1,
): GraphVisualOverlay {
  const graph = graphFromScaffold(scaffold)
  const active = evaluations[activeRoundIndex]
  const currentIds = new Set(active?.recommendations.map((item) => item.node_id) ?? [])
  const historicalIds = new Set(
    evaluations
      .slice(0, Math.max(0, activeRoundIndex))
      .flatMap((evaluation) => evaluation.recommendations.map((item) => item.node_id)),
  )
  const occurrenceCount = recommendationOccurrences(evaluations, activeRoundIndex)
  scaffold.phenomena.forEach((node) => currentIds.add(node.id))
  if (active && scaffold.scenario) currentIds.add(scaffold.scenario.id)

  return {
    audience: 'student',
    revision: active?.id ?? `pending-${String(evaluations.length)}`,
    nodes: graph.nodes.map((node) => {
      const occurrences = occurrenceCount.get(node.id) ?? 0
      return {
        node_id: node.id,
        learning_state:
          occurrences >= 2 ? 'developing' : occurrences === 1 ? 'encountered' : 'unobserved',
        emphasis: currentIds.has(node.id)
          ? 'current_round'
          : historicalIds.has(node.id)
            ? 'history'
            : 'baseline',
        score: currentIds.has(node.id) ? (active?.score ?? null) : null,
        evidence_count: occurrences,
        recommendation_count: occurrences,
      }
    }),
    edges: graph.edges.map((edge) => ({
      edge_id: edge.id,
      emphasis: edgeEmphasis(edge.source, edge.target, currentIds, historicalIds),
    })),
  }
}

export function insightFocusGraph(
  graph: KnowledgeGraphView,
  insights: KnowledgeInsights,
): KnowledgeGraphView {
  const knowledgeIds = new Set(
    [...insights.knowledge_insights]
      .sort(insightPriority)
      .slice(0, insights.scope === 'classroom' ? 16 : 12)
      .map((item) => item.node_id),
  )
  const phenomenonIds = new Set(
    [...insights.phenomenon_insights]
      .sort(insightPriority)
      .slice(0, insights.scope === 'classroom' ? 10 : 8)
      .map((item) => item.node_id),
  )
  const stageIds = new Set(insights.stage_insights.map((item) => item.node_id))
  if (!knowledgeIds.size && !phenomenonIds.size && !stageIds.size) return emptyGraph(graph)

  const selected = new Set([...knowledgeIds, ...phenomenonIds, ...stageIds])
  graph.edges.forEach((edge) => {
    if (knowledgeIds.has(edge.source) && nodeType(graph, edge.target) === 'phenomenon') {
      selected.add(edge.target)
    }
    if (knowledgeIds.has(edge.target) && nodeType(graph, edge.source) === 'phenomenon') {
      selected.add(edge.source)
    }
  })
  graph.edges.forEach((edge) => {
    const sourceType = nodeType(graph, edge.source)
    const targetType = nodeType(graph, edge.target)
    if (selected.has(edge.source) && sourceType === 'phenomenon' && targetType === 'stage') {
      selected.add(edge.target)
    }
    if (selected.has(edge.target) && targetType === 'phenomenon' && sourceType === 'stage') {
      selected.add(edge.source)
    }
  })
  return graphFromNodeIds(graph, selected)
}

export function insightOverlay(
  graph: KnowledgeGraphView,
  insights: KnowledgeInsights,
  audience: GraphOverlayAudience,
  mode: 'performance' | 'phenomenon' | 'knowledge' | 'gap' = 'performance',
): GraphVisualOverlay {
  const knowledge = new Map(insights.knowledge_insights.map((item) => [item.node_id, item]))
  const phenomena = new Map(insights.phenomenon_insights.map((item) => [item.node_id, item]))
  const stages = new Map(insights.stage_insights.map((item) => [item.node_id, item]))
  const nodes = graph.nodes.map((node): GraphVisualNodeOverlay => {
    const knowledgeItem = knowledge.get(node.id)
    const phenomenonItem = phenomena.get(node.id)
    const stageItem = stages.get(node.id)
    const score =
      knowledgeItem?.average_score ??
      phenomenonItem?.average_score ??
      stageItem?.average_score ??
      null
    const evidenceCount =
      knowledgeItem?.evidence_count ??
      phenomenonItem?.evidence_count ??
      stageItem?.evidence_count ??
      0
    const needsAttention =
      knowledgeItem?.needs_attention ??
      phenomenonItem?.needs_attention ??
      stageItem?.needs_attention ??
      false
    const completionCount = knowledgeItem?.content_completion_count ?? 0
    const recommendationCount = knowledgeItem?.recommendation_count ?? 0
    const gap =
      recommendationCount > completionCount ||
      ((knowledgeItem?.content_view_count ?? 0) > 0 && needsAttention)
    return {
      node_id: node.id,
      learning_state: learningState(
        score,
        evidenceCount,
        completionCount,
        knowledgeItem?.content_view_count ?? 0,
        needsAttention,
      ),
      emphasis: modeEmphasis(node, mode, needsAttention, gap),
      score,
      evidence_count: evidenceCount,
      affected_student_count:
        knowledgeItem?.student_count ??
        phenomenonItem?.student_count ??
        stageItem?.student_count ??
        0,
      recommendation_count: recommendationCount,
      learning_completion_count: completionCount,
    }
  })
  const emphasizedIds = new Set(
    nodes.filter((node) => node.emphasis === 'current_round').map((node) => node.node_id),
  )
  return {
    audience,
    phase: audience === 'teacher' ? 'teacher' : 'profile',
    revision: `${insights.graph_version}:${mode}:${String(insights.evidence_rounds)}:${String(insights.learning_completions)}`,
    nodes,
    edges: graph.edges.map((edge) => ({
      edge_id: edge.id,
      emphasis:
        emphasizedIds.has(edge.source) || emphasizedIds.has(edge.target)
          ? 'current_round'
          : 'baseline',
    })),
  }
}

export function replayFocusGraph(
  graph: KnowledgeGraphView,
  evidence: GraphLearningEvidence[],
): KnowledgeGraphView {
  const evidenceIds = new Set(
    evidence.flatMap((item) => [
      ...item.phenomenon_node_keys,
      ...item.strategy_node_keys,
      ...item.knowledge_resource_node_keys,
      ...item.knowledge_point_node_keys,
    ]),
  )
  if (!evidenceIds.size) return emptyGraph(graph)
  const selected = new Set(evidenceIds)
  graph.edges.forEach((edge) => {
    if (evidenceIds.has(edge.source) && nodeType(graph, edge.target) === 'phenomenon') {
      selected.add(edge.target)
    }
    if (evidenceIds.has(edge.target) && nodeType(graph, edge.source) === 'phenomenon') {
      selected.add(edge.source)
    }
  })
  graph.edges.forEach((edge) => {
    if (selected.has(edge.source) && nodeType(graph, edge.source) === 'phenomenon') {
      selected.add(edge.target)
    }
    if (selected.has(edge.target) && nodeType(graph, edge.target) === 'phenomenon') {
      selected.add(edge.source)
    }
  })
  return graphFromNodeIds(graph, selected)
}

export function replayOverlay(
  graph: KnowledgeGraphView,
  evidence: GraphLearningEvidence[],
  activeRoundId: string | null,
): GraphVisualOverlay {
  const activeIndex = Math.max(
    0,
    evidence.findIndex((item) => item.round_evaluation_id === activeRoundId),
  )
  const active = evidence[activeIndex]
  const currentIds = evidenceNodeIds(active)
  const historicalIds = new Set(
    evidence.slice(0, activeIndex).flatMap((item) => [...evidenceNodeIds(item)]),
  )
  const scores = evidenceScores(evidence.slice(0, activeIndex + 1))
  const applicationStates = new Map(
    active?.node_evidence?.map((item) => [
      item.node_id,
      item.application_state as GraphApplicationState,
    ]) ?? [],
  )
  includePathConnectors(graph, currentIds)
  includePathConnectors(graph, historicalIds)
  return {
    audience: 'teacher',
    phase: 'replay',
    revision: active?.round_evaluation_id ?? 'empty',
    nodes: graph.nodes.map((node) => {
      const nodeScores = scores.get(node.id) ?? []
      const score = nodeScores.length
        ? Math.round((nodeScores.reduce((sum, item) => sum + item, 0) / nodeScores.length) * 10) /
          10
        : null
      return {
        node_id: node.id,
        learning_state: learningState(score, nodeScores.length, 0, 0, score !== null && score < 70),
        emphasis: currentIds.has(node.id)
          ? 'current_round'
          : historicalIds.has(node.id)
            ? 'history'
            : 'baseline',
        score,
        evidence_count: nodeScores.length,
        application_state: applicationStates.get(node.id) ?? 'unknown',
      }
    }),
    edges: graph.edges.map((edge) => ({
      edge_id: edge.id,
      emphasis: edgeEmphasis(edge.source, edge.target, currentIds, historicalIds),
    })),
  }
}

export function nodeContextGraph(graph: KnowledgeGraphView, nodeId: string): KnowledgeGraphView {
  if (!graph.nodes.some((node) => node.id === nodeId)) return emptyGraph(graph)
  const selected = new Set<string>([nodeId])
  graph.edges.forEach((edge) => {
    if (edge.source === nodeId) selected.add(edge.target)
    if (edge.target === nodeId) selected.add(edge.source)
  })
  const phenomena = new Set(
    graph.nodes
      .filter((node) => selected.has(node.id) && node.type === 'phenomenon')
      .map((node) => node.id),
  )
  graph.edges.forEach((edge) => {
    if (phenomena.has(edge.source)) selected.add(edge.target)
    if (phenomena.has(edge.target)) selected.add(edge.source)
  })
  return graphFromNodeIds(graph, selected)
}

export function nodeContextOverlay(
  graph: KnowledgeGraphView,
  nodeId: string,
  audience: GraphOverlayAudience,
): GraphVisualOverlay {
  const pathIds = new Set(graph.nodes.map((node) => node.id))
  return {
    audience,
    revision: `${graph.graph_version}:${nodeId}`,
    nodes: graph.nodes.map((node) => ({
      node_id: node.id,
      learning_state: node.id === nodeId ? 'encountered' : 'unobserved',
      emphasis: node.id === nodeId ? 'current_round' : 'history',
      evidence_count: 0,
    })),
    edges: graph.edges.map((edge) => ({
      edge_id: edge.id,
      emphasis: pathIds.has(edge.source) && pathIds.has(edge.target) ? 'current_round' : 'baseline',
    })),
  }
}

function includePathConnectors(graph: KnowledgeGraphView, ids: Set<string>): void {
  graph.edges.forEach((edge) => {
    const sourceType = nodeType(graph, edge.source)
    const targetType = nodeType(graph, edge.target)
    if (ids.has(edge.source) && sourceType === 'phenomenon' && targetType === 'stage') {
      ids.add(edge.target)
    }
    if (ids.has(edge.target) && targetType === 'phenomenon' && sourceType === 'stage') {
      ids.add(edge.source)
    }
  })
}

function uniqueNodes(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  return [...new Map(nodes.map((node) => [node.id, node])).values()]
}

function emptyGraph(graph: KnowledgeGraphView): KnowledgeGraphView {
  return { ...graph, nodes: [], edges: [], node_count: 0, edge_count: 0 }
}

function graphFromNodeIds(graph: KnowledgeGraphView, ids: Set<string>): KnowledgeGraphView {
  const nodes = graph.nodes.filter((node) => ids.has(node.id))
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  return { ...graph, nodes, edges, node_count: nodes.length, edge_count: edges.length }
}

function nodeType(graph: KnowledgeGraphView, nodeId: string): string | undefined {
  return graph.nodes.find((node) => node.id === nodeId)?.type
}

function recommendationOccurrences(
  evaluations: RoundEvaluation[],
  activeRoundIndex: number,
): Map<string, number> {
  const counts = new Map<string, number>()
  evaluations.slice(0, activeRoundIndex + 1).forEach((evaluation) => {
    evaluation.recommendations.forEach((item) => {
      counts.set(item.node_id, (counts.get(item.node_id) ?? 0) + 1)
    })
  })
  return counts
}

function evidenceNodeIds(item: GraphLearningEvidence | undefined): Set<string> {
  if (!item) return new Set()
  return new Set([
    ...item.phenomenon_node_keys,
    ...item.strategy_node_keys,
    ...item.knowledge_resource_node_keys,
    ...item.knowledge_point_node_keys,
  ])
}

function evidenceScores(items: GraphLearningEvidence[]): Map<string, number[]> {
  const scores = new Map<string, number[]>()
  items.forEach((item) => {
    evidenceNodeIds(item).forEach((nodeId) => {
      scores.set(nodeId, [...(scores.get(nodeId) ?? []), item.score])
    })
  })
  return scores
}

function edgeEmphasis(
  source: string,
  target: string,
  current: Set<string>,
  history: Set<string>,
): GraphEmphasis {
  if (current.has(source) && current.has(target)) return 'current_round'
  if (
    (current.has(source) && history.has(target)) ||
    (history.has(source) && current.has(target))
  ) {
    return 'current_round'
  }
  if (history.has(source) && history.has(target)) return 'history'
  return 'baseline'
}

function learningState(
  score: number | null | undefined,
  evidenceCount: number,
  completionCount: number,
  viewCount: number,
  needsAttention: boolean,
): GraphLearningState {
  if (needsAttention) return 'review'
  if (score !== null && score !== undefined && score >= 82 && evidenceCount >= 2) {
    return 'stable'
  }
  if (evidenceCount > 0) return 'developing'
  if (viewCount > 0 || completionCount > 0) return 'encountered'
  return 'unobserved'
}

function modeEmphasis(
  node: KnowledgeGraphNode,
  mode: 'performance' | 'phenomenon' | 'knowledge' | 'gap',
  needsAttention: boolean,
  gap: boolean,
): GraphEmphasis {
  if (mode === 'performance') return needsAttention ? 'current_round' : 'baseline'
  if (mode === 'phenomenon') return node.type === 'phenomenon' ? 'current_round' : 'history'
  if (mode === 'knowledge') {
    return ['knowledge_point', 'knowledge_resource', 'strategy'].includes(node.type)
      ? 'current_round'
      : 'history'
  }
  return gap ? 'current_round' : 'history'
}

function insightPriority(
  left: { needs_attention: boolean; average_score: number | null; evidence_count: number },
  right: { needs_attention: boolean; average_score: number | null; evidence_count: number },
): number {
  return (
    Number(right.needs_attention) - Number(left.needs_attention) ||
    (left.average_score ?? 101) - (right.average_score ?? 101) ||
    right.evidence_count - left.evidence_count
  )
}
