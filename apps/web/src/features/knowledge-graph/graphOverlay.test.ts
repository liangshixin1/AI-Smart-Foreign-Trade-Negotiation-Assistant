import { describe, expect, it } from 'vitest'

import type { RoundEvaluation } from '@/features/training/types'
import type { GraphLearningEvidence } from '@/features/teacher-dashboard/api/teacherApi'

import {
  attemptRoundOverlay,
  briefingOverlay,
  graphFromScaffold,
  insightFocusGraph,
  insightOverlay,
  liveCompassOverlay,
  replayFocusGraph,
  replayOverlay,
  sessionReplayOverlay,
} from './graphOverlay'
import type { AttemptScaffold, KnowledgeGraphView, KnowledgeInsights } from './types'

const stageNode = node('stage:s1', 'stage', '询盘')
const phenomenonNode = node('phenomenon:p1', 'phenomenon', '客户压价')
const anchorNode = node('knowledge:k1', 'knowledge_point', '锚定效应')
const concessionNode = node('knowledge:k2', 'knowledge_point', '条件让步')

const graph: KnowledgeGraphView = {
  graph_version: 'v3',
  nodes: [stageNode, phenomenonNode, anchorNode, concessionNode],
  edges: [
    edge('e-stage', 'stage:s1', 'phenomenon:p1'),
    edge('e-k1', 'phenomenon:p1', 'knowledge:k1'),
    edge('e-k2', 'phenomenon:p1', 'knowledge:k2'),
  ],
  node_count: 4,
  edge_count: 3,
}

const scaffold: AttemptScaffold = {
  attempt_id: 'attempt-1',
  unit_id: 'unit-1',
  graph_version: 'v3',
  scenario: null,
  phenomena: [phenomenonNode],
  knowledge_resources: [anchorNode],
  strategies: [concessionNode],
  knowledge_points: [anchorNode, concessionNode],
  scaffolds: [],
  edges: graph.edges.slice(1),
}

describe('graph visual overlays', () => {
  it('keeps fixed candidates and distinguishes current from historical round nodes', () => {
    const evaluations = [round('r1', 'knowledge:k1'), round('r2', 'knowledge:k2')]
    const view = graphFromScaffold(scaffold)
    const overlay = attemptRoundOverlay(scaffold, evaluations)

    expect(view.nodes.map((item) => item.id)).toEqual([
      'phenomenon:p1',
      'knowledge:k1',
      'knowledge:k2',
    ])
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k2')?.emphasis).toBe(
      'current_round',
    )
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k1')?.emphasis).toBe('history')
    expect(overlay.edges.find((item) => item.edge_id === 'e-k2')?.emphasis).toBe('current_round')
  })

  it('builds a student profile path and maps evidence to learning states', () => {
    const insights = insightFixture()
    const focus = insightFocusGraph(graph, insights)
    const overlay = insightOverlay(focus, insights, 'student')

    expect(focus.nodes.map((item) => item.id)).toEqual(
      expect.arrayContaining(['stage:s1', 'phenomenon:p1', 'knowledge:k1']),
    )
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k1')?.learning_state).toBe(
      'review',
    )
  })

  it('restores the teacher replay chain and highlights the selected round', () => {
    const evidence = [evidenceRecord('ev1', 'knowledge:k1'), evidenceRecord('ev2', 'knowledge:k2')]
    const focus = replayFocusGraph(graph, evidence)
    const overlay = replayOverlay(focus, evidence, 'ev2')

    expect(focus.nodes.map((item) => item.id)).toEqual(
      expect.arrayContaining(['stage:s1', 'phenomenon:p1', 'knowledge:k2']),
    )
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k2')?.emphasis).toBe(
      'current_round',
    )
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k1')?.emphasis).toBe('history')
    expect(overlay.nodes.find((item) => item.node_id === 'stage:s1')?.emphasis).toBe(
      'current_round',
    )
  })

  it('keeps the complete graph while briefing and live compass only spotlight the current path', () => {
    const briefing = briefingOverlay(graph, scaffold, insightFixture())
    const live = liveCompassOverlay(graph, scaffold, [round('r1', 'knowledge:k1')])

    expect(briefing.phase).toBe('briefing')
    expect(briefing.nodes).toHaveLength(graph.node_count)
    expect(briefing.nodes.find((item) => item.node_id === 'stage:s1')?.emphasis).toBe(
      'current_round',
    )
    expect(live.phase).toBe('compass')
    expect(live.nodes).toHaveLength(graph.node_count)
    expect(live.nodes.find((item) => item.node_id === 'knowledge:k1')?.application_state).toBe(
      'applied_correctly',
    )
  })

  it('shows only explicitly diagnosed weaknesses in the post-training gap overlay', () => {
    const correct = round('r1', 'knowledge:k1')
    const missed = round('r2', 'knowledge:k2', 'missed_required')
    const overlay = sessionReplayOverlay(graph, scaffold, [correct, missed], 1, true)

    expect(overlay.nodes).toHaveLength(graph.node_count)
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k2')?.emphasis).toBe(
      'current_round',
    )
    expect(overlay.nodes.find((item) => item.node_id === 'knowledge:k1')?.emphasis).not.toBe(
      'current_round',
    )
  })
})

function node(id: string, type: KnowledgeGraphView['nodes'][number]['type'], label: string) {
  return { id, type, label, short_label: label, source_type: type, properties: {} }
}
function edge(id: string, source: string, target: string) {
  return { id, source, target, type: 'SUPPORTS', properties: {} }
}
function round(
  id: string,
  nodeId: string,
  applicationState: NonNullable<
    RoundEvaluation['recommendations'][number]['application_state']
  > = 'applied_correctly',
): RoundEvaluation {
  return {
    id,
    student_message_id: `student-${id}`,
    assistant_message_id: `assistant-${id}`,
    status: 'completed',
    score: 72,
    pros: '表达清楚',
    cons: '条件不完整',
    detailed_evaluation: '本轮形成性评价',
    next_step_suggestion: '补充条件',
    checklist_results: [],
    recommendations: [
      {
        node_id: nodeId,
        node_type: 'knowledge_resource',
        title: nodeId,
        confidence: 0.9,
        reason: '与本轮表达相关',
        reveal_level: 1,
        application_state: applicationState,
        evidence_excerpt: 'Please issue a firm offer.',
        contextual_how: '用于处理当前局面',
      },
    ],
    model_name: 'test',
    prompt_version: 'v1',
    created_at: '2026-09-03T00:00:00Z',
  }
}
function evidenceRecord(id: string, nodeId: string): GraphLearningEvidence {
  return {
    id,
    round_evaluation_id: id,
    student_message_id: `student-${id}`,
    graph_version: 'v3',
    phenomenon_node_keys: ['phenomenon:p1'],
    strategy_node_keys: [],
    knowledge_resource_node_keys: [nodeId],
    knowledge_point_node_keys: [nodeId],
    knowledge_type_breakdown: {},
    score: 68,
    evidence_summary: '证据摘要',
    mapping_method: 'fixed_candidates_llm_selected',
    created_at: '2026-09-03T00:00:00Z',
    node_labels: {},
  }
}
function insightFixture(): KnowledgeInsights {
  return {
    scope: 'student',
    scope_id: 'student-1',
    graph_version: 'v3',
    completed_attempts: 1,
    average_score: 68,
    evidence_rounds: 1,
    students_with_evidence: 1,
    learning_views: 1,
    learning_completions: 0,
    stage_insights: [
      {
        node_id: 'stage:s1',
        label: '询盘',
        evidence_count: 1,
        attempt_count: 1,
        student_count: 1,
        average_score: 68,
        needs_attention: true,
      },
    ],
    phenomenon_insights: [
      {
        node_id: 'phenomenon:p1',
        label: '客户压价',
        stage_id: 'stage:s1',
        stage_label: '询盘',
        evidence_count: 1,
        attempt_count: 1,
        student_count: 1,
        average_score: 68,
        needs_attention: true,
        scaffold_reveal_count: 0,
        scaffold_use_count: 0,
      },
    ],
    knowledge_insights: [
      {
        node_id: 'knowledge:k1',
        label: '锚定效应',
        node_type: 'KnowledgePoint',
        knowledge_type: 'Strategy',
        evidence_count: 1,
        attempt_count: 1,
        student_count: 1,
        average_score: 68,
        needs_attention: true,
        recommendation_count: 1,
        content_view_count: 1,
        content_completion_count: 0,
        last_activity_at: '2026-09-03T00:00:00Z',
      },
    ],
    weak_units: [],
  }
}
