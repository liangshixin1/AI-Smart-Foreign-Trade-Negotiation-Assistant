import { describe, expect, it } from 'vitest'

import {
  pointToSegmentDistance,
  progressiveFocusNodeIds,
  shouldActivateImmediately,
} from './graphInteraction'
import type { KnowledgeGraphView } from './types'

const graph: KnowledgeGraphView = {
  graph_version: 'focus-test',
  node_count: 5,
  edge_count: 4,
  nodes: [
    node('stage:S1', 'stage'),
    node('stage:S2', 'stage'),
    node('phenomenon:P1', 'phenomenon'),
    node('phenomenon:P2', 'phenomenon'),
    node('knowledge:K1', 'knowledge_point'),
  ],
  edges: [
    edge('stage:S1', 'phenomenon:P1'),
    edge('stage:S2', 'phenomenon:P2'),
    edge('phenomenon:P1', 'knowledge:K1'),
    edge('phenomenon:P2', 'knowledge:K1'),
  ],
}

describe('graphInteraction', () => {
  it('reveals the hierarchy progressively from stage to phenomenon to knowledge', () => {
    expect(progressiveFocusNodeIds(graph, 'stage:S1')).toEqual(
      new Set(['stage:S1', 'phenomenon:P1']),
    )
    expect(progressiveFocusNodeIds(graph, 'phenomenon:P1')).toEqual(
      new Set(['phenomenon:P1', 'stage:S1', 'knowledge:K1']),
    )
  })

  it('shows every phenomenon and stage branch for a shared knowledge point', () => {
    expect(progressiveFocusNodeIds(graph, 'knowledge:K1')).toEqual(
      new Set(['knowledge:K1', 'phenomenon:P1', 'phenomenon:P2', 'stage:S1', 'stage:S2']),
    )
  })

  it('measures the pointer corridor around a relationship segment', () => {
    expect(pointToSegmentDistance({ x: 50, y: 12 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(12)
  })

  it('prioritises the active hierarchy and delays unrelated peer takeovers', () => {
    expect(shouldActivateImmediately(graph, 'stage:S1', 'phenomenon:P1')).toBe(true)
    expect(shouldActivateImmediately(graph, 'stage:S1', 'knowledge:K1')).toBe(false)
    expect(shouldActivateImmediately(graph, 'phenomenon:P1', 'knowledge:K1')).toBe(true)
    expect(shouldActivateImmediately(graph, 'phenomenon:P1', 'phenomenon:P2')).toBe(false)
    expect(shouldActivateImmediately(graph, 'knowledge:K1', 'phenomenon:P2')).toBe(true)
  })
})

function node(id: string, type: KnowledgeGraphView['nodes'][number]['type']) {
  return { id, type, source_type: type, label: id, short_label: id, properties: {} }
}

function edge(source: string, target: string) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'RELATES',
    properties: {},
  }
}
