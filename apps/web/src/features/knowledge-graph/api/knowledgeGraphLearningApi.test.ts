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

  it('maps Neo4j labels to the three teaching view node types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          graph_version: 'kg-1',
          nodes: [
            { id: 'p1', type: 'Phenomenon', label: '客户压价', properties: {} },
            { id: 's1', type: 'NegotiationStrategy', label: '条件让步', properties: {} },
            { id: 'k1', type: 'TradeRule', label: 'CISG', properties: {} },
            { id: 'k2', type: 'Terminology', label: 'L/C', properties: {} },
          ],
          edges: [],
          node_count: 4,
          edge_count: 0,
        }),
      ),
    )

    const graph = await knowledgeGraphLearningApi.teacherGraph('token')

    expect(graph.nodes.map((node) => node.type)).toEqual([
      'phenomenon',
      'strategy',
      'knowledge_resource',
      'knowledge_resource',
    ])
    expect(graph.nodes[2]?.source_type).toBe('TradeRule')
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
