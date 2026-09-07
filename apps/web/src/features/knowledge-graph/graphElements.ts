import type { ElementDefinition } from 'cytoscape'

import {
  isCrossStageEdge,
  nodeStageAssignments,
  relationshipLabel,
  stageSequence,
  teachingPositions,
  type GraphPosition,
  type GraphViewMode,
} from './graphPresentation'
import { knowledgeStageMembership } from './panoramaLayout'
import type { GraphVisualOverlay } from './graphOverlay'
import type { KnowledgeGraphView, KnowledgeNodeType } from './types'

export function buildGraphElements(
  graph: KnowledgeGraphView,
  visibleTypes: KnowledgeNodeType[],
  mode: GraphViewMode,
  panoramaPositions: Map<string, GraphPosition>,
  layoutGraph: KnowledgeGraphView = graph,
  overlay: GraphVisualOverlay | null = null,
): ElementDefinition[] {
  const visibleIds = new Set(
    graph.nodes.filter((node) => visibleTypes.includes(node.type)).map((node) => node.id),
  )
  const assignments = nodeStageAssignments(layoutGraph)
  const positions = mode === 'teaching' ? teachingPositions(graph) : null
  const teachingStageCount = graph.nodes.filter((node) => node.type === 'stage').length
  const servedStages = knowledgeStageMembership(layoutGraph)
  const nodeOverlay = new Map(overlay?.nodes.map((item) => [item.node_id, item]) ?? [])
  const edgeOverlay = new Map(overlay?.edges.map((item) => [item.edge_id, item]) ?? [])
  const nodes: ElementDefinition[] = graph.nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => {
      const resolvedPosition = positions?.get(node.id) ?? panoramaPositions.get(node.id)
      const visual = nodeOverlay.get(node.id)
      return {
        data: {
          id: node.id,
          label:
            node.type === 'stage'
              ? `${String(stageSequence(node)).padStart(2, '0')} · ${node.short_label || node.label}`
              : node.short_label || node.label,
          formalLabel: node.label,
          stageSequenceLabel:
            node.type === 'stage' ? String(stageSequence(node)).padStart(2, '0') : '',
          nodeType: node.type,
          knowledgeType: node.knowledge_type ?? '',
          viewMode: mode,
          stageId: assignments.get(node.id) ?? '',
          sharedCount: isKnowledgeNode(node.type) ? (servedStages.get(node.id)?.size ?? 0) : 0,
          focusedView:
            mode === 'teaching' && teachingStageCount === 1 && node.type === 'stage' ? 'yes' : 'no',
          overlayAudience: overlay?.audience ?? '',
          overlayPhase: overlay?.phase ?? '',
          learningState: visual?.learning_state ?? 'unobserved',
          overlayEmphasis: visual?.emphasis ?? 'baseline',
          applicationState: visual?.application_state ?? 'unknown',
          score: visual?.score ?? -1,
          evidenceCount: visual?.evidence_count ?? 0,
          affectedStudentCount: visual?.affected_student_count ?? 0,
          overlaySize: overlaySize(visual?.affected_student_count ?? visual?.evidence_count ?? 0),
        },
        ...(resolvedPosition ? { position: resolvedPosition } : {}),
      }
    })
  const edges: ElementDefinition[] = graph.edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge) => {
      const knowledgeId = servedStages.has(edge.source)
        ? edge.source
        : servedStages.has(edge.target)
          ? edge.target
          : null
      const sharedCount = knowledgeId ? (servedStages.get(knowledgeId)?.size ?? 0) : 0
      const visual = edgeOverlay.get(edge.id)
      return {
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: relationshipLabel(edge.type),
          edgeType: edge.type,
          viewMode: mode,
          crossStage: isCrossStageEdge(edge, assignments) ? 'yes' : 'no',
          sharedEdge: sharedCount > 1 ? 'yes' : 'no',
          curveDistance: sharedCount > 1 ? signedCurveDistance(edge.id, sharedCount) : 0,
          overlayAudience: overlay?.audience ?? '',
          overlayPhase: overlay?.phase ?? '',
          overlayEmphasis: visual?.emphasis ?? 'baseline',
        },
      }
    })
  addStageFlowEdges(graph, visibleIds, edges, mode)
  return [...nodes, ...edges]
}

function overlaySize(value: number): 'small' | 'medium' | 'large' {
  if (value >= 8) return 'large'
  if (value >= 3) return 'medium'
  return 'small'
}

function addStageFlowEdges(
  graph: KnowledgeGraphView,
  visibleIds: Set<string>,
  edges: ElementDefinition[],
  mode: GraphViewMode,
): void {
  const stages = graph.nodes
    .filter((node) => node.type === 'stage' && visibleIds.has(node.id))
    .sort((left, right) => stageSequence(left) - stageSequence(right))
  for (let index = 0; index < stages.length - 1; index += 1) {
    const source = stages[index]
    const target = stages[index + 1]
    if (!source || !target) continue
    edges.push({
      data: {
        id: `stage-flow:${source.id}:${target.id}`,
        source: source.id,
        target: target.id,
        label: '教学流程',
        edgeType: 'STAGE_FLOW',
        viewMode: mode,
        crossStage: 'yes',
      },
    })
  }
}

function signedCurveDistance(edgeId: string, sharedCount: number): number {
  const hash = Array.from(edgeId).reduce(
    (value, character) => value + (character.codePointAt(0) ?? 0),
    0,
  )
  return (hash % 2 === 0 ? 1 : -1) * (18 + sharedCount * 6)
}

function isKnowledgeNode(type: KnowledgeNodeType): boolean {
  return ['knowledge_point', 'knowledge_resource', 'strategy'].includes(type)
}
