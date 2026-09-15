/* [组件导读]
 * 业务名词：课程由章节和小节组成；小节是训练入口，一次实际作答会形成独立的 Attempt（训练记录）。
 * 用途：定义本业务或运行环境的 TypeScript 类型。
 * 为什么与边界：类型帮助调用方理解字段约定，但编译后的接口数据仍需后端验证；类型断言不会自动清理或验证真实响应。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export interface UnitMapItem {
  id: string
  title: string
  description: string
  training_mode: string
  estimated_minutes: number
  status: string
  sort_order: number
  active_attempt_id: string | null
}

export interface ChapterMapItem {
  id: string
  title: string
  sort_order: number
  units: UnitMapItem[]
}

export interface CourseMap {
  course_id: string
  course_title: string
  course_version: string
  completed_units: number
  total_units: number
  chapters: ChapterMapItem[]
}

export interface RubricDimension {
  key: string
  label: string
  weight: number
}

export interface UnitDetail {
  workspace_kind?: string | null
  document_correction_enabled?: boolean
  id: string
  title: string
  description: string
  learning_objectives: string[]
  training_mode: string
  prerequisite_unit_ids: string[]
  estimated_minutes: number
  difficulty_options: string[]
  knowledge_tags: string[]
  rubric_dimensions: RubricDimension[]
  status: string
  supported_experience_modes: Array<'chat' | 'simulation'>
}
