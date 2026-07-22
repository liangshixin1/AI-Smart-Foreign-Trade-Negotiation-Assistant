import type { CourseMap, UnitDetail } from '@/features/curriculum/types'
import { request } from '@/shared/api/http'

export const curriculumApi = {
  map(accessToken: string): Promise<CourseMap> {
    return request('/api/v1/courses/current/map', {}, accessToken)
  },
  unit(unitId: string, accessToken: string): Promise<UnitDetail> {
    return request(`/api/v1/units/${encodeURIComponent(unitId)}`, {}, accessToken)
  },
}
