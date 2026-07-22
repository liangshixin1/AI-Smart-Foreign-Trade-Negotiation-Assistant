import { request, requestBlob } from '@/shared/api/http'

import type {
  AttemptScaffold,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphView,
  KnowledgeInsights,
  LearningContent,
  LearningContentInput,
  KnowledgeNodeType,
  ScaffoldEventType,
  ScaffoldHint,
} from '../types'

interface GraphNodeWire {
  id: string
  type: string
  label: string
  properties: Record<string, unknown>
}
interface GraphEdgeWire extends Omit<KnowledgeGraphEdge, 'properties'> {
  properties: Record<string, unknown>
}
interface GraphViewWire extends Omit<KnowledgeGraphView, 'nodes' | 'edges'> {
  nodes: GraphNodeWire[]
  edges: GraphEdgeWire[]
}
interface AttemptScaffoldWire extends Omit<
  AttemptScaffold,
  'scenario' | 'phenomena' | 'knowledge_resources' | 'strategies' | 'edges'
> {
  scenario: GraphNodeWire | null
  phenomena: GraphNodeWire[]
  knowledge_resources: GraphNodeWire[]
  strategies: GraphNodeWire[]
  edges: GraphEdgeWire[]
}

function normalizedType(type: string): KnowledgeNodeType {
  if (type === 'Phenomenon') return 'phenomenon'
  if (type === 'NegotiationStrategy') return 'strategy'
  return 'knowledge_resource'
}

function normalizeNode(node: GraphNodeWire): KnowledgeGraphNode {
  return { ...node, source_type: node.type, type: normalizedType(node.type) }
}

function normalizeGraph(graph: GraphViewWire): KnowledgeGraphView {
  return { ...graph, nodes: graph.nodes.map(normalizeNode) }
}

function normalizeScaffold(value: AttemptScaffoldWire): AttemptScaffold {
  return {
    ...value,
    scenario: value.scenario ? normalizeNode(value.scenario) : null,
    phenomena: value.phenomena.map(normalizeNode),
    knowledge_resources: value.knowledge_resources.map(normalizeNode),
    strategies: value.strategies.map(normalizeNode),
  }
}

export const knowledgeGraphLearningApi = {
  attemptScaffold: async (token: string, attemptId: string) =>
    normalizeScaffold(
      await request<AttemptScaffoldWire>(
        `/api/v1/knowledge-graph/student/attempts/${attemptId}/scaffolds`,
        {},
        token,
      ),
    ),
  recordScaffoldEvent: (
    token: string,
    attemptId: string,
    hint: Pick<ScaffoldHint, 'id' | 'level'>,
    eventType: ScaffoldEventType,
    clientEventId: string,
  ) =>
    request<{ id: string }>(
      `/api/v1/knowledge-graph/student/attempts/${attemptId}/scaffold-events`,
      {
        method: 'POST',
        body: JSON.stringify({
          node_id: hint.id,
          event_type: eventType,
          level: hint.level,
          client_event_id: clientEventId,
        }),
      },
      token,
    ),
  teacherGraph: async (token: string) =>
    normalizeGraph(
      await request<GraphViewWire>('/api/v1/knowledge-graph/teacher/graph', {}, token),
    ),
  studentGraph: async (token: string) =>
    normalizeGraph(
      await request<GraphViewWire>('/api/v1/knowledge-graph/student/graph', {}, token),
    ),
  studentContent: (token: string, nodeId: string) =>
    request<LearningContent>(
      `/api/v1/knowledge-graph/student/content/${encodeURIComponent(nodeId)}`,
      {},
      token,
    ),
  teacherContents: (token: string) =>
    request<LearningContent[]>('/api/v1/knowledge-graph/teacher/content', {}, token),
  teacherContent: (token: string, nodeId: string) =>
    request<LearningContent>(
      `/api/v1/knowledge-graph/teacher/content/${encodeURIComponent(nodeId)}`,
      {},
      token,
    ),
  updateTeacherContent: (token: string, nodeId: string, payload: LearningContentInput) =>
    request<LearningContent>(
      `/api/v1/knowledge-graph/teacher/content/${encodeURIComponent(nodeId)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      token,
    ),
  uploadTeacherAsset: (token: string, nodeId: string, kind: 'video' | 'slides', file: File) =>
    request<LearningContent>(
      `/api/v1/knowledge-graph/teacher/content/${encodeURIComponent(nodeId)}/assets/${kind}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      },
      token,
    ),
  deleteTeacherAsset: (token: string, nodeId: string, kind: 'video' | 'slides') =>
    request<LearningContent>(
      `/api/v1/knowledge-graph/teacher/content/${encodeURIComponent(nodeId)}/assets/${kind}`,
      { method: 'DELETE' },
      token,
    ),
  teacherAsset: (token: string, nodeId: string, kind: 'video' | 'slides') =>
    requestBlob(
      `/api/v1/knowledge-graph/teacher/content/${encodeURIComponent(nodeId)}/assets/${kind}`,
      token,
    ),
  studentAsset: (token: string, nodeId: string, kind: 'video' | 'slides') =>
    requestBlob(
      `/api/v1/knowledge-graph/student/content/${encodeURIComponent(nodeId)}/assets/${kind}`,
      token,
    ),
  classroomInsights: (token: string, classroomId: string) =>
    request<KnowledgeInsights>(
      `/api/v1/knowledge-graph/teacher/classrooms/${classroomId}/insights`,
      {},
      token,
    ),
  studentInsights: (token: string, studentId: string) =>
    request<KnowledgeInsights>(
      `/api/v1/knowledge-graph/teacher/students/${studentId}/insights`,
      {},
      token,
    ),
}
