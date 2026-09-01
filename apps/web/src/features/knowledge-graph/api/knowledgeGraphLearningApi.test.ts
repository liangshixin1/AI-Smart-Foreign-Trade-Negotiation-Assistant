import { afterEach, describe, expect, it, vi } from 'vitest'

import { knowledgeGraphLearningApi } from './knowledgeGraphLearningApi'

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('knowledgeGraphLearningApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps legacy and unified Neo4j knowledge nodes without losing expert type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          graph_version: 'kg-1',
          nodes: [
            {
              id: 'c1',
              type: 'Scenario',
              label: 'Price Negotiation',
              short_label: '价格谈判',
              properties: {},
            },
            {
              id: 'p1',
              type: 'Phenomenon',
              label: 'Price pressure',
              short_label: '客户压价',
              properties: {},
            },
            {
              id: 's1',
              type: 'NegotiationStrategy',
              label: 'Conditional concession',
              short_label: '条件让步',
              properties: {},
            },
            {
              id: 'k1',
              type: 'TradeRule',
              label: 'CISG',
              short_label: 'CISG规则',
              properties: {},
            },
            {
              id: 'k2',
              type: 'Terminology',
              label: 'L/C',
              short_label: '信用证',
              properties: {},
            },
            {
              id: 'k3',
              type: 'KnowledgePoint',
              label: 'Conditional concession strategy',
              short_label: '条件让步',
              properties: { KnowledgeTypeCode: 'Strategy' },
            },
          ],
          edges: [],
          node_count: 6,
          edge_count: 0,
        }),
      ),
    )

    const graph = await knowledgeGraphLearningApi.teacherGraph('token')

    expect(graph.nodes.map((node) => node.type)).toEqual([
      'scenario',
      'phenomenon',
      'strategy',
      'knowledge_resource',
      'knowledge_resource',
      'knowledge_point',
    ])
    expect(graph.nodes[3]?.source_type).toBe('TradeRule')
    expect(graph.nodes[1]?.short_label).toBe('客户压价')
    expect(graph.nodes[5]?.knowledge_type).toBe('Strategy')
  })

  it('sends an idempotent scaffold interaction payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'event-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await knowledgeGraphLearningApi.recordScaffoldEvent(
      'token',
      'attempt-1',
      { id: 'hint-1', level: '一级' },
      'revealed',
      'scaffold-event-1',
    )

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(typeof options.body).toBe('string')
    if (typeof options.body !== 'string') throw new Error('Expected JSON request body')
    expect(JSON.parse(options.body)).toEqual({
      node_id: 'hint-1',
      event_type: 'revealed',
      level: '一级',
      client_event_id: 'scaffold-event-1',
    })
  })

  it('sends a version-bound optimistic display update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        graph_version: 'kg-1',
        node_id: 'phenomenon:P01',
        short_label: '客户压价应对',
        revision: 2,
        has_override: true,
        updated_at: '2026-07-26T10:00:00Z',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await knowledgeGraphLearningApi.updateNodeDisplay(
      'token',
      'phenomenon:P01',
      'kg-1',
      '客户压价应对',
      1,
    )

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/phenomenon%3AP01/display')
    expect(options.method).toBe('PUT')
    expect(typeof options.body).toBe('string')
    if (typeof options.body !== 'string') throw new Error('Expected JSON request body')
    expect(JSON.parse(options.body)).toEqual({
      graph_version: 'kg-1',
      short_name_zh: '客户压价应对',
      expected_revision: 1,
    })
  })

  it('uploads a teaching file instead of sending a public media URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ assets: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['video'], 'CIF 讲解.mp4', { type: 'video/mp4' })

    await knowledgeGraphLearningApi.uploadTeacherAsset('token', 'knowledge:K001', 'video', file)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/knowledge%3AK001/assets/video')
    expect(options.method).toBe('PUT')
    expect(options.body).toBe(file)
    const headers = new Headers(options.headers)
    expect(headers.get('X-File-Name')).toBe(encodeURIComponent(file.name))
  })
})
