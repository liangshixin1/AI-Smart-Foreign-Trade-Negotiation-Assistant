export type Value = string | number | Record<string, string | number> | null
export interface Target {
  ref: string
  label: string
  tag: string
  value_type: string
  value: Value
  inputs: string[]
}
export interface Field {
  field_id: string
  tag: string
  label: string
  value_type: string
  display_value: string
  value: Value
  inputs: string[]
  items: { item_id: string; text: string; value_type: string; value: Value; inputs: string[] }[]
}
export interface Annotation {
  annotation_id?: string
  target_ref: string
  issue_category: string
  evidence_ref: string
  proposed_value: Value
  optional_note: string
}
export interface Result {
  score: number
  passed: boolean
  summary: string
  gross_score: number
  penalty: number
  critical_misses: string[]
  false_positives: { target_ref: string; penalty: number }[]
  issue_results: {
    target_ref: string
    located: boolean
    corrected: boolean
    evidence_correct: boolean
    original_value: Value
    student_value: Value
    standard_value: Value
    score: number
    weight: number
    source_fact_ref: string
    parts: Record<string, number>
  }[]
}
export interface CorrectionSession {
  attempt_id: string
  profile: Record<string, string>
  briefing: { fact_groups: { fact_id: string; value: unknown }[] }
  document: {
    title: string
    watermark: string
    document_number: string
    sections: { section_id: string; title: string; fields: Field[] }[]
  }
  annotations: Annotation[]
  revision: number
  read_only: boolean
  submission_status: string
  result: Result | null
  feedback: { status?: string; summary?: string; message?: string }
  hashes: Record<string, string | null>
}
