export interface Classroom {
  id: string
  name: string
  student_count: number
}
export interface Overview {
  student_count: number
  active_students_7d: number
  completed_attempts: number
  average_score: number | null
  attention_count: number
  weak_dimensions: CompetencySummary[]
}
export interface Student {
  id: string
  student_no: string
  display_name: string
  email: string
  status: string
  completed_units: number
  total_units: number
  completion_rate: number
  current_unit_title: string | null
  latest_score: number | null
  last_active_at: string | null
  risk_reasons: string[]
}
export interface StudentInput {
  student_no: string
  display_name: string
  email: string
  initial_password: string
}
export interface StudentUpdate {
  display_name?: string
  email?: string
  status?: 'active' | 'disabled'
  new_password?: string
}
export interface AttemptSummary {
  id: string
  unit_id: string
  unit_title: string
  status: string
  overall_score: number | null
  created_at: string
  completed_at: string | null
}
export interface StudentDetail {
  student: Student
  attempts: AttemptSummary[]
  competencies: CompetencySummary[]
}
export interface DimensionTrendPoint {
  attempt_id: string
  score: number
  created_at: string
}
export interface CompetencySummary {
  dimension_key: string
  label: string
  average_score: number
  latest_score: number
  evidence_count: number
  attempt_count: number
  needs_attention: boolean
  trend: DimensionTrendPoint[]
}
