export type KnowledgeNodeType =
  'stage' | 'scenario' | 'phenomenon' | 'knowledge_point' | 'knowledge_resource' | 'strategy'

export type KnowledgePointType =
  'Concept' | 'Correspondence' | 'Cross-cultural' | 'Legal' | 'Procedure' | 'Risk' | 'Strategy'

export interface KnowledgeGraphNode {
  id: string
  type: KnowledgeNodeType
  label: string
  short_label: string
  source_type: string
  knowledge_type?: KnowledgePointType
  properties: Record<string, unknown>
  display_revision?: number
  has_display_override?: boolean
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
  knowledge_points: KnowledgeGraphNode[]
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
  knowledge_point_ids: string[]
  knowledge_type_breakdown: Record<string, number>
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
  evidence_rounds: number
  students_with_evidence: number
  learning_views: number
  learning_completions: number
  stage_insights: StageLearningInsight[]
  phenomenon_insights: PhenomenonLearningInsight[]
  knowledge_insights: KnowledgeNodeLearningInsight[]
  weak_units: KnowledgeWeakUnit[]
}

export interface KnowledgeNodeLearningInsight {
  node_id: string
  label: string
  node_type: string
  knowledge_type: string | null
  evidence_count: number
  attempt_count: number
  student_count: number
  average_score: number | null
  needs_attention: boolean
  recommendation_count: number
  content_view_count: number
  content_completion_count: number
  last_activity_at: string | null
}

export interface PhenomenonLearningInsight {
  node_id: string
  label: string
  stage_id: string | null
  stage_label: string | null
  evidence_count: number
  attempt_count: number
  student_count: number
  average_score: number | null
  needs_attention: boolean
  scaffold_reveal_count: number
  scaffold_use_count: number
}

export interface StageLearningInsight {
  node_id: string
  label: string
  evidence_count: number
  attempt_count: number
  student_count: number
  average_score: number | null
  needs_attention: boolean
}

export type LearningActivitySource = 'map' | 'training' | 'evaluation' | 'profile'

export interface LearningActivity {
  id: string
  graph_version: string
  node_key: string
  node_type: string
  event_type: 'viewed' | 'completed'
  source: LearningActivitySource
  attempt_id: string | null
  created_at: string
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

export interface NodeDisplayMutation {
  graph_version: string
  node_id: string
  short_label: string
  revision: number
  has_override: boolean
  updated_at: string | null
}
