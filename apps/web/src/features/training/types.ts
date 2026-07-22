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
}

export interface RoundEvaluation {
  id: string
  student_message_id: string
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
  id: string
  unit_id: string
  unit_title: string
  training_mode: 'negotiation' | 'business_email' | 'document_review'
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
  id: string
  unit_id: string
  unit_title: string
  training_mode: Attempt['training_mode']
  status: AttemptStatus
  overall_score: number | null
  retry_of_attempt_id: string | null
  created_at: string
  updated_at: string
}
