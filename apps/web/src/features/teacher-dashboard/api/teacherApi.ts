import { request } from '@/shared/api/http'
import type { Attempt } from '@/features/training/types'
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
  score: number
  evidence_summary: string
  mapping_method: string
  created_at: string
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
