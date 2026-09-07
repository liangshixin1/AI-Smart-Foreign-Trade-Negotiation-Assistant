import { describe, expect, it } from 'vitest'

import type { KnowledgeGraphView } from './types'
import {
  isCrossStageEdge,
  nodeStageAssignments,
  stageSequence,
  teachingPositions,
} from './graphPresentation'

const graph: KnowledgeGraphView = {
  graph_version: 'expert-v3',
  node_count: 6,
  edge_count: 4,
  nodes: [
    {
      id: 'stage:S1',
      type: 'stage',
      source_type: 'Stage',
      label: '询盘',
      short_label: '询盘',
      properties: { StageID: 'S1', Seq: 1 },
    },
    {
      id: 'stage:S2',
      type: 'stage',
      source_type: 'Stage',
      label: '发盘',
      short_label: '发盘',
      properties: { StageID: 'S2', Seq: 2 },
    },
    {
      id: 'phenomenon:P1.01',
      type: 'phenomenon',
      source_type: 'Phenomenon',
      label: '试探性询盘',
      short_label: '试探性询盘',
      properties: { StageID: 'S1' },
    },
    {
      id: 'phenomenon:P2.01',
      type: 'phenomenon',
      source_type: 'Phenomenon',
      label: '持续提供虚盘',
      short_label: '持续提供虚盘',
      properties: { StageID: 'S2' },
    },
    {
      id: 'knowledge:K001',
      type: 'knowledge_point',
      source_type: 'KnowledgePoint',
      label: '询盘的定义',
      short_label: '询盘的定义',
      knowledge_type: 'Concept',
      properties: { HomeStageID: 'S1' },
    },
    {
      id: 'knowledge:K002',
      type: 'knowledge_point',
      source_type: 'KnowledgePoint',
      label: '发盘的定义',
      short_label: '发盘的定义',
      knowledge_type: 'Legal',
      properties: { HomeStageID: 'S2' },
    },
  ],
  edges: [
    {
      id: 's1-p1',
      source: 'stage:S1',
      target: 'phenomenon:P1.01',
      type: 'CONTAINS_PHENOMENON',
      properties: {},
    },
    {
      id: 's2-p2',
      source: 'stage:S2',
      target: 'phenomenon:P2.01',
      type: 'CONTAINS_PHENOMENON',
      properties: {},
    },
    {
      id: 'p1-k1',
      source: 'phenomenon:P1.01',
      target: 'knowledge:K001',
      type: 'REQUIRES_KNOWLEDGE',
      properties: {},
    },
    {
      id: 'p2-k1',
      source: 'phenomenon:P2.01',
      target: 'knowledge:K001',
      type: 'REQUIRES_KNOWLEDGE',
      properties: {},
    },
  ],
}

describe('graphPresentation', () => {
  it('keeps the expert stage order and gives every visible child a stable position', () => {
    const firstStage = graph.nodes[0]
    const secondStage = graph.nodes[1]
    if (!firstStage || !secondStage) throw new Error('测试图谱缺少阶段节点。')
    expect(stageSequence(firstStage)).toBe(1)
    expect(stageSequence(secondStage)).toBe(2)
    const first = teachingPositions(graph)
    const second = teachingPositions(graph)
    expect(first).toEqual(second)
    expect(first.has('phenomenon:P1.01')).toBe(true)
    expect(first.has('knowledge:K002')).toBe(true)
  })

  it('marks shared cross-stage relationships without changing HomeStageID', () => {
    const assignments = nodeStageAssignments(graph)
    const crossStageEdge = graph.edges[3]
    if (!crossStageEdge) throw new Error('测试图谱缺少跨阶段关系。')
    expect(assignments.get('knowledge:K001')).toBe('stage:S1')
    expect(isCrossStageEdge(crossStageEdge, assignments)).toBe(true)
  })
})
