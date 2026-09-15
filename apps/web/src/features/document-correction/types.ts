/* [组件导读]
 * 业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
 * 用途：定义本业务或运行环境的 TypeScript 类型。
 * 为什么与边界：类型帮助调用方理解字段约定，但编译后的接口数据仍需后端验证；类型断言不会自动清理或验证真实响应。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
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
