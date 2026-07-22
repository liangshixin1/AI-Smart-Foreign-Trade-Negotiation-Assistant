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
}
