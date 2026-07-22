export type KnowledgeNodeType = 'phenomenon' | 'knowledge_resource' | 'strategy'

export interface KnowledgeGraphNode {
  id: string
  type: KnowledgeNodeType
  label: string
  source_type: string
  properties: Record<string, unknown>
}

export interface KnowledgeGraphEdge {
  id: string
  source: string
  target: string
  type: string
  properties: Record<string, unknown>
}

export interface KnowledgeGraphView {
  graph_version: string
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  node_count: number
  edge_count: number
}

export interface AttemptScaffold {
  attempt_id: string
  unit_id: string
  graph_version: string
  scenario: KnowledgeGraphNode | null
  phenomena: KnowledgeGraphNode[]
  knowledge_resources: KnowledgeGraphNode[]
  strategies: KnowledgeGraphNode[]
  scaffolds: ScaffoldHint[]
  edges: KnowledgeGraphEdge[]
}

export interface ScaffoldHint {
  id: string
  phenomenon_id: string
  level: string
  trigger: string
  content: string | null
  revealed: boolean
  used: boolean
}

export type ScaffoldEventType = 'revealed' | 'used'

export interface KnowledgeWeakUnit {
  unit_id: string
  unit_title: string
  attempt_count: number
  average_score: number | null
  needs_attention: boolean
  phenomenon_ids: string[]
  knowledge_resource_ids: string[]
  strategy_ids: string[]
  scaffold_reveal_count: number
  scaffold_use_count: number
  students_using_scaffolds: number
}

export interface KnowledgeInsights {
  scope: 'classroom' | 'student'
  scope_id: string
  graph_version: string
  completed_attempts: number
  average_score: number | null
  weak_units: KnowledgeWeakUnit[]
}

export interface LearningContent {
  graph_version: string
  node_id: string
  node_type: string
  title: string
  summary: string
  markdown_body: string
  assets: LearningAsset[]
  status: 'draft' | 'published'
  updated_at: string | null
}

export interface LearningAsset {
  id: string
  kind: 'video' | 'slides'
  filename: string
  content_type: string
  size_bytes: number
  updated_at: string
}

export type LearningContentInput = Pick<
  LearningContent,
  'title' | 'summary' | 'markdown_body' | 'status'
>
