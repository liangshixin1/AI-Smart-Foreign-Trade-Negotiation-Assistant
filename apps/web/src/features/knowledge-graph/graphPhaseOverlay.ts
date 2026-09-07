import type { RoundEvaluation } from '@/features/training/types'

import type { GraphApplicationState, GraphVisualOverlay } from './graphOverlay'
import type { AttemptScaffold, KnowledgeGraphView, KnowledgeInsights } from './types'

/** 训练前：保留完整拓扑，仅突出本关场景链和个人复习重点。 */
export function briefingOverlay(
  graph: KnowledgeGraphView,
  scaffold: AttemptScaffold,
  insights?: KnowledgeInsights | null,
): GraphVisualOverlay {
  const focusIds = scaffoldNodeIds(scaffold)
  includePathConnectors(graph, focusIds)
  const reviewIds = new Set(
    insights?.knowledge_insights
      .filter((item) => item.needs_attention)
      .slice(0, 5)
      .map((item) => item.node_id) ?? [],
  )
  return fullGraphOverlay(graph, {
    audience: 'student',
    phase: 'briefing',
    revision: `${graph.graph_version}:briefing:${scaffold.attempt_id}`,
    currentIds: focusIds,
    reviewIds,
  })
}

/** 训练中：维持全图空间位置，只让当前一轮的导航链获得完整视觉权重。 */
export function liveCompassOverlay(
  graph: KnowledgeGraphView,
  scaffold: AttemptScaffold,
  evaluations: RoundEvaluation[],
): GraphVisualOverlay {
  const latest = evaluations.at(-1)
  const currentIds = new Set(latest?.recommendations.slice(0, 2).map((item) => item.node_id) ?? [])
  relevantPhenomena(graph, scaffold, currentIds, 1).forEach((nodeId) => currentIds.add(nodeId))
  includePathConnectors(graph, currentIds)
  const historyIds = new Set(
    evaluations.slice(0, -1).flatMap((item) => item.recommendations.map((value) => value.node_id)),
  )
  includePathConnectors(graph, historyIds)
  return fullGraphOverlay(graph, {
    audience: 'student',
    phase: 'compass',
    revision: latest?.id ?? `${graph.graph_version}:compass:pending`,
    currentIds,
    historyIds,
    applicationStates: recommendationStates(latest),
  })
}

/** 训练后：按轮回放实际触达路径，或只显示需要补强的差距节点。 */
export function sessionReplayOverlay(
  graph: KnowledgeGraphView,
  scaffold: AttemptScaffold,
  evaluations: RoundEvaluation[],
  activeRoundIndex: number,
  gapView = false,
): GraphVisualOverlay {
  const active = evaluations[activeRoundIndex]
  const currentIds = new Set(active?.recommendations.map((item) => item.node_id) ?? [])
  scaffold.phenomena.forEach((node) => currentIds.add(node.id))
  if (scaffold.scenario) currentIds.add(scaffold.scenario.id)
  includePathConnectors(graph, currentIds)
  const historyIds = new Set(
    evaluations
      .slice(0, Math.max(0, activeRoundIndex))
      .flatMap((item) => item.recommendations.map((value) => value.node_id)),
  )
  includePathConnectors(graph, historyIds)
  const states = recommendationStates(active)
  if (gapView) {
    currentIds.clear()
    evaluations.forEach((evaluation) => {
      evaluation.recommendations.forEach((item) => {
        const state = item.application_state ?? 'recommended_next'
        if (['misapplied', 'recalled_unused', 'missed_required'].includes(state)) {
          currentIds.add(item.node_id)
          states.set(item.node_id, state)
        }
      })
    })
    includePathConnectors(graph, currentIds)
  }
  return fullGraphOverlay(graph, {
    audience: 'student',
    phase: 'replay',
    revision: `${active?.id ?? 'empty'}:${gapView ? 'gap' : 'round'}`,
    currentIds,
    historyIds,
    applicationStates: states,
  })
}

interface FullGraphOverlayOptions {
  audience: 'student' | 'teacher'
  phase: 'briefing' | 'compass' | 'replay' | 'profile' | 'teacher'
  revision: string
  currentIds: Set<string>
  historyIds?: Set<string>
  reviewIds?: Set<string>
  applicationStates?: Map<string, GraphApplicationState>
}

function fullGraphOverlay(
  graph: KnowledgeGraphView,
  options: FullGraphOverlayOptions,
): GraphVisualOverlay {
  const historyIds = options.historyIds ?? new Set<string>()
  const reviewIds = options.reviewIds ?? new Set<string>()
  const applicationStates = options.applicationStates ?? new Map<string, GraphApplicationState>()
  return {
    audience: options.audience,
    phase: options.phase,
    revision: options.revision,
    nodes: graph.nodes.map((node) => {
      const applicationState = applicationStates.get(node.id) ?? 'unknown'
      const review =
        reviewIds.has(node.id) || ['misapplied', 'missed_required'].includes(applicationState)
      return {
        node_id: node.id,
        learning_state: review
          ? 'review'
          : applicationState === 'applied_correctly'
            ? 'developing'
            : applicationState === 'applied_partially'
              ? 'encountered'
              : 'unobserved',
        emphasis: options.currentIds.has(node.id)
          ? 'current_round'
          : historyIds.has(node.id)
            ? 'history'
            : 'baseline',
        evidence_count: applicationState === 'unknown' ? 0 : 1,
        application_state: applicationState,
      }
    }),
    edges: graph.edges.map((edge) => ({
      edge_id: edge.id,
      emphasis: edgeEmphasis(edge.source, edge.target, options.currentIds, historyIds),
    })),
  }
}

function recommendationStates(
  evaluation: RoundEvaluation | undefined,
): Map<string, GraphApplicationState> {
  return new Map(
    evaluation?.recommendations.map((item) => [
      item.node_id,
      item.application_state ?? 'recommended_next',
    ]) ?? [],
  )
}

function scaffoldNodeIds(scaffold: AttemptScaffold): Set<string> {
  return new Set([
    ...(scaffold.scenario ? [scaffold.scenario.id] : []),
    ...scaffold.phenomena.map((node) => node.id),
    ...scaffold.knowledge_points.map((node) => node.id),
  ])
}

function relevantPhenomena(
  graph: KnowledgeGraphView,
  scaffold: AttemptScaffold,
  selectedIds: Set<string>,
  limit: number,
): string[] {
  const phenomenonIds = new Set(scaffold.phenomena.map((node) => node.id))
  const linked = new Set<string>()
  graph.edges.forEach((edge) => {
    if (selectedIds.has(edge.source) && phenomenonIds.has(edge.target)) linked.add(edge.target)
    if (selectedIds.has(edge.target) && phenomenonIds.has(edge.source)) linked.add(edge.source)
  })
  const ordered = linked.size ? [...linked] : scaffold.phenomena.map((node) => node.id)
  return ordered.slice(0, limit)
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

function nodeType(graph: KnowledgeGraphView, nodeId: string): string | undefined {
  return graph.nodes.find((node) => node.id === nodeId)?.type
}

function edgeEmphasis(
  source: string,
  target: string,
  current: Set<string>,
  history: Set<string>,
): 'baseline' | 'current_round' | 'history' {
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
