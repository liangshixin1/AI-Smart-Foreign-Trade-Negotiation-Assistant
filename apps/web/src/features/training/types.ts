/* [组件导读]
 * 业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
 * 用途：定义本业务或运行环境的 TypeScript 类型。
 * 为什么与边界：类型帮助调用方理解字段约定，但编译后的接口数据仍需后端验证；类型断言不会自动清理或验证真实响应。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export type AttemptStatus =
  | 'generating_scenario'
  | 'generation_failed'
  | 'in_progress'
  | 'submitted'
  | 'evaluating'
  | 'evaluation_failed'
  | 'completed'
  | 'retry_created'

export interface ScenarioPublic {
  scenario_title: string
  scenario_summary: string
  student_task: string
  student_role: string
  ai_role: string
  product: string
  negotiation_targets: string[]
  checklist: string[]
  opening_message: string
}

export interface TrainingMessage {
  id: string
  sequence_no: number
  role: 'student' | 'assistant'
  content: string
  status: 'completed' | 'streaming' | 'failed'
  created_at: string
}

export interface ChecklistAssessment {
  item: string
  satisfied: boolean
  rationale: string
}

export interface GraphRecommendation {
  node_id: string
  node_type: 'knowledge_resource' | 'strategy'
  title: string
  confidence: number
  reason: string
  reveal_level: number
  application_state?:
    | 'applied_correctly'
    | 'applied_partially'
    | 'misapplied'
    | 'recalled_unused'
    | 'missed_required'
    | 'recommended_next'
  evidence_excerpt?: string
  contextual_how?: string
}

export interface RoundEvaluation {
  id: string
  student_message_id: string | null
  source_type?: string
  source_id?: string | null
  assistant_message_id: string
  status: string
  score: number
  pros: string
  cons: string
  detailed_evaluation: string
  next_step_suggestion: string
  checklist_results: ChecklistAssessment[]
  recommendations: GraphRecommendation[]
  model_name: string
  prompt_version: string
  created_at: string
}

export interface EvaluationEvidence {
  message_id: string
  quote: string
  reason: string
}

export interface EvaluationDimension {
  dimension_key: string
  label: string
  score: number
  weight: number
  comment: string
  evidence: EvaluationEvidence[]
}

export interface EvaluationResult {
  id: string
  overall_score: number
  level: string
  summary: string
  strengths: string[]
  improvements: string[]
  next_actions: string[]
  knowledge_tags: string[]
  model_name: string
  prompt_version: string
  evaluation_status: string
  created_at: string
  dimensions: EvaluationDimension[]
}

export interface Attempt {
  workspace_kind?: string | null
  id: string
  unit_id: string
  unit_title: string
  training_mode: 'negotiation' | 'business_email' | 'document_review'
  experience_mode: 'chat' | 'simulation'
  conversation_revision: number
  simulation_summary: {
    profile_id: string
    profile_version: string
    asset_pack_version: string
    analysis_status: string
    state_revision: number
  } | null
  status: AttemptStatus
  difficulty: string
  scenario: ScenarioPublic | null
  messages: TrainingMessage[]
  round_evaluations: RoundEvaluation[]
  evaluation: EvaluationResult | null
  draft_content: string
  retry_of_attempt_id: string | null
  created_at: string
  updated_at: string
}

export interface AttemptHistoryItem {
  workspace_kind?: string | null
  id: string
  unit_id: string
  unit_title: string
  training_mode: Attempt['training_mode']
  experience_mode: Attempt['experience_mode']
  status: AttemptStatus
  overall_score: number | null
  retry_of_attempt_id: string | null
  created_at: string
  updated_at: string
}
