/* [组件导读]
 * 业务名词：变更集是待评审的图谱改动；发布版是通过评审后可读取的图数据，模型配置按生成场景、对话和评价分用途。
 * 用途：定义本业务或运行环境的 TypeScript 类型。
 * 为什么与边界：类型帮助调用方理解字段约定，但编译后的接口数据仍需后端验证；类型断言不会自动清理或验证真实响应。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export interface KnowledgeImportJob {
  id: string
  template_version: string
  source_filename: string
  source_hash: string
  source_size: number
  status: string
  error_count: number
  warning_count: number
  created_at: string
  updated_at: string
  idempotent_replay: boolean
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'suggestion'
  code: string
  sheet_name: string
  row_number: number | null
  column_name: string | null
  message: string
}

export interface TeachingSituation {
  situation_id: string
  signal: string
  recognition: string
}

export interface TeachingCasePreview {
  case_id: string
  title: string
  course_unit: string
  training_mode: string
  task: string
  situations: TeachingSituation[]
  strategies: Array<{ situation_id: string; name: string; action: string }>
  resources: Array<{ type: string; title: string; timing: string }>
  scaffolds: Array<{ situation_id: string; level: string; trigger: string }>
  rubrics: Array<{ dimension: string; weight: number }>
  outcomes: Array<{ result: string; ideal: boolean }>
}

export interface GraphChangeSet {
  id: string
  import_job_id: string
  status: string
  compiler_version: string
  teaching_preview: TeachingCasePreview[]
  nodes: Array<Record<string, unknown>>
  relationships: Array<Record<string, unknown>>
  summary: Record<string, number>
  rejection_reason: string | null
}

export interface GraphPublication {
  id: string
  change_set_id: string
  graph_version: string
  environment: string
  status: string
  is_active: boolean
  storage_backend: string
  published_at: string
  rolled_back_at: string | null
}
