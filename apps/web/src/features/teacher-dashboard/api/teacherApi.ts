/* [组件导读]
 * 业务名词：学情是学习活动与训练评价的汇总；轮次是一次学生发言及对应反馈，回放用于核对历史证据。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { request } from '@/shared/api/http'
import type { Attempt } from '@/features/training/types'
import type { SimulationSession } from '@/features/simulation/types'
import type {
  Classroom,
  Overview,
  Student,
  StudentDetail,
  StudentInput,
  StudentUpdate,
} from '../types'

export interface AttemptReplay {
  attempt: Attempt
  course_version_id: string
  content_bindings: Record<string, string>
  submission_created_at: string | null
  frozen_submission: Record<string, unknown> | null
  scaffold_interactions: ScaffoldInteraction[]
  graph_learning_evidence: GraphLearningEvidence[]
  round_learning_diagnostics: RoundLearningDiagnostic[]
  final_learning_diagnostic: LearningDiagnostic | null
  simulation: SimulationSession | null
}

export type DiagnosticDimensionKey =
  | 'domain_knowledge'
  | 'language_control'
  | 'negotiation_strategy'
  | 'adaptability'
  | 'intercultural_pragmatics'
  | 'self_regulation'

export interface DiagnosticEvidence {
  message_id: string
  quote: string
  interpretation: string
}

export interface DiagnosticDimension {
  dimension_key: DiagnosticDimensionKey
  score: number
  judgment: string
  evidence: DiagnosticEvidence[]
}

export interface KnowledgeMastery {
  knowledge_point: string
  status: 'not_observed' | 'emerging' | 'developing' | 'secure'
  evidence: DiagnosticEvidence[]
}

export interface LearningDiagnostic {
  framework_version: 'zpd-da-v1'
  learner_stage: 'foundation' | 'developing' | 'competent' | 'advanced'
  challenge_level: number
  support_level: 'explicit_model' | 'guided_choice' | 'implicit_prompt' | 'independent'
  negotiation_style:
    'cautious' | 'analytical' | 'assertive' | 'collaborative' | 'adaptive' | 'unclear'
  adaptability_summary: string
  dimensions: DiagnosticDimension[]
  knowledge_mastery: KnowledgeMastery[]
  next_stretch_target: string
  mediation_strategy: string
  confidence: number
}

export interface RoundLearningDiagnostic {
  round_evaluation_id: string
  student_message_id: string
  created_at: string
  diagnostic: LearningDiagnostic
}

export interface ScaffoldInteraction {
  id: string
  graph_version: string
  scaffold_node_key: string
  phenomenon_node_key: string | null
  event_type: 'revealed' | 'used'
  level: string
  scaffold_snapshot: Record<string, unknown>
  created_at: string
}

export interface GraphLearningEvidence {
  id: string
  round_evaluation_id: string
  student_message_id: string
  graph_version: string
  phenomenon_node_keys: string[]
  strategy_node_keys: string[]
  knowledge_resource_node_keys: string[]
  knowledge_point_node_keys: string[]
  knowledge_type_breakdown: Record<string, number>
  node_evidence?: Array<{
    node_id: string
    node_type: string
    application_state: string
    evidence_excerpt: string
    reason: string
    contextual_how: string
    confidence: number
  }>
  score: number
  evidence_summary: string
  mapping_method: string
  created_at: string
  node_labels: Record<string, string>
}

export const teacherApi = {
  classrooms: (token: string) => request<Classroom[]>('/api/v1/teacher/classrooms', {}, token),
  overview: (token: string, id: string) =>
    request<Overview>(`/api/v1/teacher/classrooms/${id}/overview`, {}, token),
  students: (token: string, id: string) =>
    request<Student[]>(`/api/v1/teacher/classrooms/${id}/students`, {}, token),
  create: (token: string, id: string, data: StudentInput) =>
    request<Student>(
      `/api/v1/teacher/classrooms/${id}/students`,
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),
  update: (token: string, id: string, studentId: string, data: StudentUpdate) =>
    request<Student>(
      `/api/v1/teacher/classrooms/${id}/students/${studentId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token,
    ),
  importRows: (token: string, id: string, rows: StudentInput[]) =>
    request<{ created: number }>(
      `/api/v1/teacher/classrooms/${id}/students/import`,
      { method: 'POST', body: JSON.stringify({ rows }) },
      token,
    ),
  remove: (token: string, id: string, studentId: string) =>
    request<undefined>(
      `/api/v1/teacher/classrooms/${id}/students/${studentId}`,
      { method: 'DELETE' },
      token,
    ),
  studentDetail: (token: string, studentId: string) =>
    request<StudentDetail>(`/api/v1/teacher/students/${studentId}/progress`, {}, token),
  attemptReplay: (token: string, attemptId: string) =>
    request<AttemptReplay>(`/api/v1/teacher/attempts/${attemptId}`, {}, token),
}
